(() => {
  'use strict';

  const engine = window.SURVIVAL_ENGINE;
  const records = window.SURVIVAL_RECORDS;
  const canvas = document.querySelector('#survival-canvas');
  if (!canvas || !engine || !Array.isArray(records)) return;

  const ctx = canvas.getContext('2d', {alpha: false});
  const $ = selector => document.querySelector(selector);
  const W = engine.WORLD.width;
  const H = engine.WORLD.height;
  const nameInput = $('#player-name');
  const live = $('[data-game-live]');
  const overlay = name => $(`[data-overlay="${name}"]`);
  const storageKey = 'qi-survival-rank-v1';
  const pressed = new Set();
  let run = null;
  let mode = 'ready';
  let stickPointer = null;
  let stickVector = {x: 0, y: 0};
  let rankRows = [];
  let storageAvailable = true;
  let lastHud = '';
  let lastFoundCount = 0;
  let lastMessage = '';
  let priorFrame = performance.now();
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const formatTime = seconds => {
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
  const setLive = message => {
    if (message && message !== lastMessage) {
      live.textContent = message;
      lastMessage = message;
    }
  };
  const requestFullscreen = () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({navigationUI: 'hide'}).catch(() => {});
    }
  };
  const showOnly = selected => {
    for (const name of ['start', 'upgrade', 'pause', 'over']) overlay(name).hidden = name !== selected;
  };

  function loadRankings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      rankRows = Array.isArray(saved) ? saved.filter(row =>
        row && typeof row.name === 'string' && Number.isFinite(row.score) && Number.isFinite(row.elapsed)
      ).slice(0, 10) : [];
    } catch {
      storageAvailable = false;
      rankRows = [];
    }
    $('[data-storage-note]').textContent = storageAvailable ? '' : '浏览器存储不可用：本局仍可玩，但不能保存排行榜。';
    renderRankings();
  }

  function renderRankings() {
    const list = $('[data-local-rankings]');
    if (!rankRows.length) {
      list.innerHTML = '<li class="survival-empty-rank">还没有记录。完成一局后会显示前十名。</li>';
      return;
    }
    list.innerHTML = rankRows.slice(0, 10).map((row, index) => `<li>
      <span class="rank-number">${String(index + 1).padStart(2, '0')}</span>
      <span class="rank-name" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}<small class="rank-meta"> · ${formatTime(row.elapsed)} · ${row.layer}层</small></span>
      <span class="rank-score">${row.score.toLocaleString('zh-CN')}</span>
    </li>`).join('');
  }

  function saveRun() {
    const row = {
      name: run.name,
      score: run.score,
      elapsed: run.elapsed,
      layer: run.layer,
      bossKills: run.bossKills,
      timestamp: Date.now()
    };
    if (storageAvailable) {
      try {
        rankRows.push(row);
        rankRows.sort((a, b) => b.score - a.score || b.elapsed - a.elapsed || b.layer - a.layer);
        rankRows = rankRows.slice(0, 10);
        localStorage.setItem(storageKey, JSON.stringify(rankRows));
      } catch {
        storageAvailable = false;
        $('[data-storage-note]').textContent = '浏览器拒绝保存记录，本局分数只在本次页面显示。';
      }
    }
    renderRankings();
  }

  function renderRecordIndex() {
    $('[data-record-count]').textContent = String(records.length);
    $('[data-record-index]').innerHTML = records.map(record => `<li>
      <a href="${escapeHtml(record.source)}" ${run?.foundRecords.some(found => found.id === record.id) ? 'class="is-found"' : ''}>
        <em>${escapeHtml(record.id)}</em><span>${escapeHtml(record.title)}</span>
        <small>${escapeHtml(record.time)} · ${escapeHtml(record.category)} · ${escapeHtml(record.status)}</small>
      </a>
    </li>`).join('');
  }

  function renderLayerRecords() {
    if (!run) {
      $('[data-current-layer-note]').textContent = '开始游戏后显示本层随机出现的史料主题。';
      $('[data-current-hazards]').innerHTML = '<li>危险区域只作抽象游戏机制。</li>';
      $('[data-found-records]').textContent = '触碰背景档案可查看非暴力材料；不影响分数。';
      lastFoundCount = 0;
      return;
    }
    $('[data-current-layer-note]').textContent = `第 ${run.layer} 层 · 从27条暴力事件中随机抽取 ${run.layerRecords.length} 条危险主题。`;
    $('[data-current-hazards]').innerHTML = run.layerRecords.map(record => `<li>
      <a href="${escapeHtml(record.source)}"><em>${escapeHtml(record.id)}</em> ${escapeHtml(record.title)}</a>
      <small>${escapeHtml(record.status)}</small>
    </li>`).join('');
    $('[data-found-records]').textContent = run.foundRecords.length
      ? `本局触及 ${run.foundRecords.length} 条背景材料：${run.foundRecords.map(record => record.id).join('、')}。`
      : '地图中还散落着无伤害的背景档案，触碰后可在右侧查看。';
    lastFoundCount = run.foundRecords.length;
    renderRecordIndex();
  }

  function updateHud() {
    if (!run) return;
    const next = `${run.layer}|${run.level}|${run.score}|${Math.ceil(run.player.hp)}|${run.player.hp}`;
    if (next === lastHud) return;
    $('[data-hud-layer]').textContent = String(run.layer);
    $('[data-hud-level]').textContent = `${run.level} / 5`;
    $('[data-hud-score]').textContent = run.score.toLocaleString('zh-CN');
    $('[data-hud-hp]').textContent = `${Math.ceil(run.player.hp)} / 100`;
    $('[data-hud-health-fill]').style.width = `${Math.max(0, run.player.hp)}%`;
    $('[data-hud-health-fill]').style.background = run.player.hp <= 30
      ? 'linear-gradient(90deg,#a34e40,#d2765a)'
      : 'linear-gradient(90deg,#93a273,#d6b878)';
    lastHud = next;
  }

  function resetHud() {
    $('[data-hud-layer]').textContent = '—';
    $('[data-hud-level]').textContent = '— / 5';
    $('[data-hud-score]').textContent = '0';
    $('[data-hud-hp]').textContent = '100 / 100';
    $('[data-hud-health-fill]').style.width = '100%';
    lastHud = '';
  }

  function startGame() {
    const name = Array.from(nameInput.value.trim().replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, 16).join('');
    if (!name) {
      nameInput.setCustomValidity('请先输入玩家名称。');
      nameInput.reportValidity();
      nameInput.focus();
      return;
    }
    nameInput.setCustomValidity('');
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      run = engine.createRun(name, seed, records);
    } catch (error) {
      setLive(error.message || '游戏数据未能加载，请刷新页面后重试。');
      return;
    }
    mode = 'playing';
    requestFullscreen();
    pressed.clear();
    stickVector = {x: 0, y: 0};
    $('[data-game-action="pause"]').disabled = false;
    showOnly(null);
    lastFoundCount = 0;
    lastMessage = '';
    updateHud();
    renderLayerRecords();
    setLive(run.message);
    canvas.focus({preventScroll: true});
  }

  function endGame() {
    if (mode === 'over') return;
    mode = 'over';
    pressed.clear();
    stickVector = {x: 0, y: 0};
    $('[data-game-action="pause"]').disabled = true;
    saveRun();
    $('[data-final-score]').textContent = run.score.toLocaleString('zh-CN');
    $('[data-final-summary]').textContent = `存活 ${formatTime(run.elapsed)} · 到达第 ${run.layer} 层 · 击败 ${run.bossKills} 位皇帝。`;
    showOnly('over');
    setLive(`本局结束，得分 ${run.score}。排行榜只保存到当前浏览器。`);
  }

  function pauseGame() {
    if (mode !== 'playing') return;
    mode = 'paused';
    pressed.clear();
    stickVector = {x: 0, y: 0};
    showOnly('pause');
    setLive('已暂停，暂停期间不计时。');
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    mode = 'playing';
    showOnly(run?.phase === 'upgrade' ? 'upgrade' : null);
    lastMessage = '';
    setLive(run?.phase === 'upgrade' ? '请选择移速或闪避加成。' : '继续闯关。');
  }

  function resetToReady() {
    mode = 'ready';
    run = null;
    pressed.clear();
    stickVector = {x: 0, y: 0};
    $('[data-game-action="pause"]').disabled = true;
    showOnly('start');
    resetHud();
    renderLayerRecords();
    renderRecordIndex();
    setLive('输入名称后开始。危险表现为抽象区域，不复原施刑现场。');
  }

  function moveVector() {
    let x = stickVector.x, y = stickVector.y;
    if (pressed.has('ArrowLeft') || pressed.has('a') || pressed.has('A')) x--;
    if (pressed.has('ArrowRight') || pressed.has('d') || pressed.has('D')) x++;
    if (pressed.has('ArrowUp') || pressed.has('w') || pressed.has('W')) y--;
    if (pressed.has('ArrowDown') || pressed.has('s') || pressed.has('S')) y++;
    return {x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y))};
  }

  function circle(x, y, radius, fill, stroke, width = 1) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  function text(content, x, y, color, size = 12, align = 'center', weight = 500) {
    const scale = canvas.clientWidth > 0 ? W / canvas.clientWidth : 1;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size * scale}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(content, x, y, 230 * scale);
  }

  function drawBackdrop(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#23332c');
    gradient.addColorStop(.48, '#1b2a24');
    gradient.addColorStop(1, '#17231f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = '#d4c394';
    ctx.lineWidth = 1;
    for (let x = 28; x < W; x += 54) {
      for (let y = 28; y < H; y += 54) {
        const offset = ((Math.floor(x / 54) + Math.floor(y / 54)) % 2) * 2;
        ctx.strokeRect(x + offset, y + offset, 25, 25);
      }
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(217,195,145,.48)';
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, W - 44, H - 44);
    ctx.strokeStyle = 'rgba(217,195,145,.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, W - 64, H - 64);
    for (const x of [82, W - 82]) {
      ctx.fillStyle = 'rgba(207,184,129,.16)';
      ctx.fillRect(x - 12, 35, 24, H - 70);
      ctx.strokeStyle = 'rgba(224,202,151,.18)';
      ctx.strokeRect(x - 12, 35, 24, H - 70);
    }
    // Palace courtyard axis, patterned after the site's architectural illustration.
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = '#d5c18c';
    ctx.setLineDash([5, 13]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 48);
    ctx.lineTo(W / 2, H - 48);
    ctx.moveTo(105, H / 2);
    ctx.lineTo(W - 105, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    circle(W / 2, H / 2, 118 + Math.sin(time * .3) * 3, null, 'rgba(208,184,126,.14)', 1);
    ctx.restore();
    text('北齐宫苑 · 游戏示意地图', 47, 48, 'rgba(235,222,190,.48)', 10, 'left', 400);
  }

  function drawHazard(hazard, now) {
    const state = engine.hazardState(hazard, run.stageElapsed);
    const pulse = .5 + Math.sin(now * (state.active ? 8 : 3) + hazard.offset) * .12;
    ctx.save();
    const tint = state.active ? `rgba(184,83,62,${.18 + pulse * .1})` : state.warning ? 'rgba(199,162,92,.12)' : 'rgba(195,173,122,.045)';
    const line = state.active ? 'rgba(220,126,96,.78)' : state.warning ? 'rgba(226,199,134,.64)' : 'rgba(192,174,132,.22)';
    ctx.fillStyle = tint;
    ctx.strokeStyle = line;
    ctx.lineWidth = state.active ? 2.4 : 1.3;
    ctx.setLineDash(state.active ? [] : [6, 7]);
    if (hazard.shape === 'square') {
      ctx.fillRect(hazard.x - hazard.radius, hazard.y - hazard.radius * .76, hazard.radius * 2, hazard.radius * 1.52);
      ctx.strokeRect(hazard.x - hazard.radius, hazard.y - hazard.radius * .76, hazard.radius * 2, hazard.radius * 1.52);
    } else {
      circle(hazard.x, hazard.y, hazard.radius, tint, line, state.active ? 2.4 : 1.3);
      circle(hazard.x, hazard.y, hazard.radius * .74, null, state.active ? 'rgba(235,162,117,.32)' : 'rgba(192,174,132,.14)', 1);
    }
    ctx.setLineDash([]);
    const scale = canvas.clientWidth > 0 ? W / canvas.clientWidth : 1;
    const labelWidth = 104 * scale;
    const labelHeight = 25 * scale;
    ctx.fillStyle = 'rgba(15,24,20,.82)';
    ctx.fillRect(hazard.x - labelWidth / 2, hazard.y - labelHeight * .64, labelWidth, labelHeight);
    text(`${state.active ? '危险生效' : state.warning ? '即将出现' : '危险主题'} · ${hazard.record.id}`, hazard.x, hazard.y - labelHeight * .12, state.active ? '#f0b295' : '#e5d6aa', 10, 'center', 650);
    ctx.restore();
  }

  function drawContext(context, time) {
    if (context.collected) return;
    ctx.save();
    const pulse = 1 + Math.sin(time * 2 + context.x) * .08;
    ctx.translate(context.x, context.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(209,180,118,.16)';
    ctx.fillRect(-20, -20, 40, 40);
    ctx.strokeStyle = 'rgba(224,196,132,.78)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-15, -15, 30, 30);
    text('档', 0, 0, '#ead69f', 16, 'center', 700);
    ctx.restore();
    text('背景档案', context.x, context.y + 29, 'rgba(239,224,185,.74)', 9, 'center', 500);
  }

  function drawWeapon(time) {
    if (run.weapon.collected) return;
    const lift = Math.sin(time * 3) * 3;
    ctx.save();
    ctx.translate(run.weapon.x, run.weapon.y + lift);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = 'rgba(221,196,137,.15)';
    ctx.fillRect(-18, -18, 36, 36);
    ctx.fillStyle = '#d5c18b';
    ctx.fillRect(-2, -20, 4, 25);
    ctx.fillStyle = '#b77d57';
    ctx.fillRect(-2, 5, 4, 9);
    ctx.fillRect(-7, 3, 14, 3);
    ctx.restore();
    text('散落武器', run.weapon.x, run.weapon.y + 27 + lift, '#ead7aa', 10, 'center', 600);
  }

  function drawEmperor(time) {
    const boss = run.emperor;
    if (!boss.alive) {
      circle(boss.x, boss.y, 31, 'rgba(219,190,119,.12)', 'rgba(219,190,119,.52)', 1.5);
      text('关底已破', boss.x, boss.y + 1, '#e5cb8c', 11, 'center', 650);
      return;
    }
    ctx.save();
    ctx.translate(boss.x, boss.y + Math.sin(time * 2) * 1.3);
    circle(0, 3, 32, 'rgba(9,15,13,.24)', null);
    ctx.beginPath();
    ctx.moveTo(-24, 28); ctx.lineTo(-18, 6); ctx.lineTo(-12, -5); ctx.lineTo(12, -5); ctx.lineTo(18, 6); ctx.lineTo(24, 28); ctx.closePath();
    ctx.fillStyle = '#834f40'; ctx.fill();
    ctx.strokeStyle = '#d2b678'; ctx.lineWidth = 1.5; ctx.stroke();
    circle(0, -15, 10, '#d4b990', '#5a4638', 1);
    ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(-8, -34); ctx.lineTo(-2, -27); ctx.lineTo(3, -37); ctx.lineTo(7, -27); ctx.lineTo(12, -32); ctx.lineTo(11, -21); ctx.closePath();
    ctx.fillStyle = '#d2b76e'; ctx.fill();
    ctx.restore();
    text('皇帝', boss.x, boss.y + 44, '#f1d9aa', 11, 'center', 700);
    if (run.player.hasWeapon) {
      ctx.save();
      ctx.strokeStyle = `rgba(235,208,145,${.4 + Math.sin(time * 7) * .18})`;
      ctx.lineWidth = 2;
      circle(boss.x, boss.y, 39, null, ctx.strokeStyle, 2);
      ctx.restore();
    }
  }

  function drawPlayer(time) {
    const player = run.player;
    const hurt = run.flashUntil > run.elapsed;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (hurt && Math.floor(time * 22) % 2) ctx.globalAlpha = .45;
    circle(0, 3, 22, 'rgba(7,13,11,.32)', null);
    ctx.beginPath();
    ctx.moveTo(-13, 19); ctx.lineTo(-9, -4); ctx.lineTo(-5, -10); ctx.lineTo(5, -10); ctx.lineTo(9, -4); ctx.lineTo(14, 19); ctx.closePath();
    ctx.fillStyle = '#809487'; ctx.fill();
    ctx.strokeStyle = '#d4c7a0'; ctx.lineWidth = 1; ctx.stroke();
    circle(0, -14, 7, '#d4b995', '#26352e', 1);
    ctx.beginPath(); ctx.moveTo(-7, -18); ctx.lineTo(0, -27); ctx.lineTo(7, -18); ctx.closePath();
    ctx.fillStyle = '#394b40'; ctx.fill();
    circle(0, -3, 27, null, hurt ? 'rgba(224,126,93,.8)' : 'rgba(221,201,151,.4)', 1.2);
    ctx.restore();
    text('被囚者', player.x, player.y + 33, '#e2dbc7', 10, 'center', 600);
  }

  function draw() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    const time = run?.elapsed || performance.now() / 1000;
    drawBackdrop(time);
    if (!run) {
      text('收集武器 · 避开危险区域 · 寻找出口', W / 2, H / 2 + 168, 'rgba(237,225,194,.72)', 14, 'center', 500);
      return;
    }
    for (const hazard of run.hazards) drawHazard(hazard, time);
    for (const context of run.contexts) drawContext(context, time);
    drawWeapon(time);
    drawEmperor(time);
    drawPlayer(time);
    if (run.phase === 'upgrade') {
      ctx.fillStyle = 'rgba(213,190,130,.8)';
      ctx.fillRect(W / 2 - 1, H / 2 - 30, 2, 60);
      text('请选择升级，暂停期间不计时', W / 2, H / 2 + 47, '#ecd69e', 13, 'center', 700);
    }
  }

  function frame(now) {
    const dt = Math.min(Math.max(0, (now - priorFrame) / 1000), .05);
    priorFrame = now;
    if (mode === 'playing' && run) {
      const previousLayer = run.layer;
      engine.advance(run, moveVector(), dt);
      updateHud();
      if (run.layer !== previousLayer || run.foundRecords.length !== lastFoundCount) renderLayerRecords();
      if (run.message) setLive(run.message);
      if (run.phase === 'upgrade') {
        showOnly('upgrade');
        $('[data-game-action="pause"]').disabled = false;
      } else if (run.phase === 'over') endGame();
    }
    draw();
    requestAnimationFrame(frame);
  }

  function handleAction(action, target) {
    if (action === 'start') startGame();
    if (action === 'pause') pauseGame();
    if (action === 'resume') resumeGame();
    if (action === 'exit-fullscreen' && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (action === 'restart' || action === 'again') resetToReady();
    if (action === 'clear-rank') {
      if (!rankRows.length || !window.confirm('清空此浏览器保存的本机排行榜？')) return;
      rankRows = [];
      try { localStorage.removeItem(storageKey); }
      catch { storageAvailable = false; $('[data-storage-note]').textContent = '浏览器存储不可用，无法清除已保存记录。'; }
      renderRankings();
    }
    if (target?.dataset.gameUpgrade && run) {
      const selected = target.dataset.gameUpgrade;
      if (!engine.chooseUpgrade(run, selected)) return;
      mode = 'playing';
      showOnly(null);
      updateHud();
      renderLayerRecords();
      lastMessage = '';
      setLive(`${selected === 'speed' ? '移速' : '闪避'}加成已生效。${run.message}`);
    }
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-game-action]');
    if (action) handleAction(action.dataset.gameAction, action);
    const upgrade = event.target.closest('[data-game-upgrade]');
    if (upgrade) handleAction('', upgrade);
  });

  nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
  nameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') startGame();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (mode === 'playing') pauseGame();
      else if (mode === 'paused') resumeGame();
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) {
      if (mode !== 'playing' || event.target.closest('input, button, a, summary')) return;
      if (event.key.startsWith('Arrow') || event.key === ' ') event.preventDefault();
      pressed.add(event.key);
    }
  });
  document.addEventListener('keyup', event => pressed.delete(event.key));
  window.addEventListener('blur', () => pressed.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') {
      pauseGame();
      setLive('切换到其他页面，游戏已自动暂停；暂停期间不计时。');
    }
  });

  const stick = $('[data-stick]');
  const knob = $('[data-stick-knob]');
  function updateStick(event) {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width * .31;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const span = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, radius / span);
    const x = dx * scale, y = dy * scale;
    stickVector = {x: x / radius, y: y / radius};
    knob.style.transform = `translate(${x}px, ${y}px)`;
  }
  stick.addEventListener('pointerdown', event => {
    if (mode !== 'playing') return;
    event.preventDefault();
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    updateStick(event);
  });
  stick.addEventListener('pointermove', event => {
    if (event.pointerId === stickPointer) updateStick(event);
  });
  const resetStick = event => {
    if (event.pointerId !== stickPointer) return;
    stickPointer = null;
    stickVector = {x: 0, y: 0};
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', resetStick);
  stick.addEventListener('pointercancel', resetStick);

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  window.addEventListener('resize', resizeCanvas, {passive: true});
  resizeCanvas();
  loadRankings();
  renderRecordIndex();
  renderLayerRecords();
  resetHud();
  showOnly('start');
  requestAnimationFrame(frame);
})();
