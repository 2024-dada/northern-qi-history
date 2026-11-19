(() => {
  'use strict';

  const engine = window.SURVIVAL_ENGINE;
  const records = window.SURVIVAL_RECORDS;
  const canvas = document.querySelector('#survival-canvas');
  if (!canvas || !engine || !Array.isArray(records)) return;

  const ctx = canvas.getContext('2d', {alpha: false});
  const fogCanvas = document.createElement('canvas');
  fogCanvas.width = engine.WORLD.width;
  fogCanvas.height = engine.WORLD.height;
  const fogCtx = fogCanvas.getContext('2d');
  const memoryCanvas = document.createElement('canvas');
  memoryCanvas.width = engine.WORLD.width;
  memoryCanvas.height = engine.WORLD.height;
  const memoryCtx = memoryCanvas.getContext('2d');
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
      $('[data-current-hazards]').innerHTML = '<li>开始后显示场景插画、史料编号与游戏伤害值。</li>';
      $('[data-found-records]').textContent = '触碰背景档案可查看非暴力材料；不影响分数。';
      lastFoundCount = 0;
      return;
    }
    const encounter = run.layer >= 5
      ? '大将军带领三支分散的将领小队。'
      : run.layer >= 3 ? '三支将领小队分散巡查。' : '三支追兵小队分散搜索。';
    $('[data-current-layer-note]').textContent = `第 ${run.layer} 层 · ${encounter}地图视野外的物件会隐藏。`;
    $('[data-current-hazards]').innerHTML = run.layerRecords.map(record => {
      const profile = engine.hazardProfile(record);
      return `<li>
      <a href="${escapeHtml(record.source)}"><em>${escapeHtml(record.id)}</em> ${escapeHtml(record.title)}</a>
      <small>${escapeHtml(profile.tier)} · 游戏伤害 ${profile.damagePerSecond} 点/秒 · ${escapeHtml(record.status)}</small>
    </li>`;
    }).join('');
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
    $('[data-final-summary]').textContent = `存活 ${formatTime(run.elapsed)} · 到达第 ${run.layer} 层 · 击退追兵与将领 ${run.enemyKills} 名（其中将领 ${run.generalKills} 名）· 击败大将军 ${run.marshalKills} 名、皇帝 ${run.bossKills} 位。`;
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
    canvas.focus({preventScroll: true});
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
    setLive('输入名称后开始。WASD 控制移动；拾取武器后会自动攻击近处敌人。');
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

  function drawScorpion(x, y, scale, phase, active) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const swing = Math.sin(phase * 3.2) * .55;
    const tailColor = active ? '#efbc70' : '#b89a65';
    ctx.strokeStyle = tailColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(8 + swing * 5, -12, 5 + swing * 10, -20);
    ctx.quadraticCurveTo(1 + swing * 16, -29, 8 + swing * 19, -35);
    ctx.stroke();
    ctx.fillStyle = '#c07a48';
    ctx.beginPath();
    ctx.moveTo(7 + swing * 19, -34);
    ctx.lineTo(16 + swing * 19, -41);
    ctx.lineTo(12 + swing * 19, -29);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#94563e';
    ctx.beginPath();
    ctx.ellipse(0, 3, 8, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let index = 0; index < 4; index++) {
      const side = index % 2 ? 1 : -1;
      const offset = Math.floor(index / 2) * 5;
      ctx.strokeStyle = '#c48b59';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(side * 5, offset);
      ctx.lineTo(side * 12, offset + 2);
      ctx.lineTo(side * 15, offset + 7);
      ctx.stroke();
    }
    circle(0, -9, 5.5, '#b8754c', '#e2bd7c', 1.2);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#e0ad6a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(side * 3, -10);
      ctx.lineTo(side * 9, -16);
      ctx.lineTo(side * 13, -14 + side * 2);
      ctx.moveTo(side * 9, -16);
      ctx.lineTo(side * 13, -19 + side * 2);
      ctx.stroke();
    }
    if (active && Math.sin(phase * 3.2) > .55) {
      ctx.strokeStyle = 'rgba(247,202,119,.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(12 + swing * 12, -30, 9, -.8, .85);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHazardScene(hazard, now, state) {
    const {x, y, radius, record} = hazard;
    const scene = record.scene;
    const active = state.active;
    const pulse = .5 + Math.sin(now * (active ? 5 : 2) + hazard.offset) * .12;
    const box = hazard.shape === 'square';
    const left = x - radius, top = y - radius * .76;
    ctx.save();
    ctx.beginPath();
    if (box) ctx.rect(left, top, radius * 2, radius * 1.52);
    else ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    const ground = active ? 'rgba(100,42,32,.34)' : 'rgba(100,70,43,.18)';
    ctx.fillStyle = ground;
    ctx.fillRect(left, top, radius * 2, radius * 1.52);

    if (scene === 'scorpion') {
      ctx.fillStyle = 'rgba(29,20,17,.55)';
      ctx.beginPath();
      ctx.ellipse(x, y + 7, radius * .78, radius * .54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(224,193,137,.82)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 7, radius * .8, radius * .56, 0, Math.PI * .05, Math.PI * .95);
      ctx.stroke();
      ctx.fillStyle = 'rgba(16,20,17,.9)';
      ctx.beginPath();
      ctx.ellipse(x - 3, y + 7, radius * .3, 5, -.05, 0, Math.PI * 2);
      ctx.fill();
      circle(x + radius * .23, y + 6, 5, '#302821', '#b59c6b', 1);
      for (const creature of hazard.creatures) {
        const drift = Math.sin(now * 1.8 + creature.phase) * 3;
        drawScorpion(x + creature.x + drift, y + creature.y, creature.scale, now + creature.phase, active);
      }
      if (active) {
        ctx.strokeStyle = `rgba(240,190,105,${.26 + pulse * .34})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y + 7, radius * (.71 + pulse * .04), radius * .46, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (scene === 'cauldron') {
      const scale = radius / 86;
      ctx.save(); ctx.translate(x, y + 5); ctx.scale(scale, scale);
      for (let i = 0; i < 5; i++) {
        const offset = (i - 2) * 22;
        ctx.fillStyle = '#c1784f';
        ctx.beginPath(); ctx.moveTo(offset, 3); ctx.quadraticCurveTo(offset - 8, -12 - Math.sin(now * 4 + i) * 4, offset + 3, -23); ctx.quadraticCurveTo(offset + 16, -11, offset + 7, 3); ctx.fill();
      }
      ctx.fillStyle = '#333c35'; ctx.beginPath(); ctx.moveTo(-52, -15); ctx.lineTo(52, -15); ctx.lineTo(41, 28); ctx.quadraticCurveTo(0, 48, -41, 28); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d5b876'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -15, 52, 10, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (scene === 'cage') {
      ctx.strokeStyle = 'rgba(214,194,143,.86)'; ctx.lineWidth = 3;
      ctx.strokeRect(x - radius * .52, y - radius * .47, radius * 1.04, radius * .92);
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * radius * .13, y - radius * .46); ctx.lineTo(x + i * radius * .13, y + radius * .44); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x - radius * .5, y - radius * .15); ctx.lineTo(x + radius * .5, y - radius * .15); ctx.moveTo(x - radius * .5, y + radius * .16); ctx.lineTo(x + radius * .5, y + radius * .16); ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#ba6746'; ctx.beginPath(); ctx.moveTo(x + side * radius * .58, y + radius * .48); ctx.quadraticCurveTo(x + side * radius * .4, y + radius * .16, x + side * radius * .58, y - radius * .03); ctx.quadraticCurveTo(x + side * radius * .75, y + radius * .2, x + side * radius * .58, y + radius * .48); ctx.fill();
      }
    } else if (scene === 'river') {
      for (let row = -2; row <= 2; row++) {
        const yy = y + row * 18;
        ctx.strokeStyle = `rgba(121,175,164,${.32 + pulse * .18})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - radius, yy); ctx.bezierCurveTo(x - radius * .3, yy - 12, x + radius * .2, yy + 12, x + radius, yy - 2); ctx.stroke();
      }
      for (let i = -1; i <= 1; i++) {
        const tx = x + i * radius * .42 + Math.sin(now + i) * 3;
        ctx.fillStyle = 'rgba(221,207,174,.88)'; ctx.fillRect(tx - 10, y + i * 15 - 13, 20, 26);
        ctx.strokeStyle = '#7f5342'; ctx.lineWidth = 1; ctx.strokeRect(tx - 10, y + i * 15 - 13, 20, 26);
        text('名', tx, y + i * 15, '#6d4439', 9, 'center', 650);
      }
    } else if (scene === 'saw') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(now * (active ? 2.2 : .45));
      circle(0, 0, radius * .42, 'rgba(40,46,39,.8)', '#c9ad70', 2);
      ctx.strokeStyle = '#c9ad70'; ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) { const angle = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * .27, Math.sin(angle) * radius * .27); ctx.lineTo(Math.cos(angle) * radius * .57, Math.sin(angle) * radius * .57); ctx.stroke(); }
      circle(0, 0, radius * .12, '#8d493b', '#e0c27f', 2); ctx.restore();
      if (active) { ctx.strokeStyle = 'rgba(233,164,103,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, radius * .67, now * 2, now * 2 + 1.35); ctx.stroke(); }
    } else if (scene === 'arrow') {
      for (let i = 0; i < 7; i++) {
        const travel = (now * (active ? 100 : 38) + i * 31) % (radius * 2 + 25);
        const px = x - radius + travel;
        const py = y + Math.sin(now * 2 + i) * radius * .45 + (i % 2) * 15;
        ctx.strokeStyle = active ? 'rgba(238,190,111,.88)' : 'rgba(206,188,145,.54)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px - 18, py - 5); ctx.lineTo(px + 12, py + 3); ctx.lineTo(px + 5, py - 5); ctx.moveTo(px + 12, py + 3); ctx.lineTo(px + 3, py + 9); ctx.stroke();
      }
    } else if (scene === 'dog' || scene === 'animal') {
      for (let i = 0; i < (scene === 'dog' ? 3 : 4); i++) {
        const phase = now * (active ? 2.5 : .7) + i * 2.15;
        const angle = phase + i * .6;
        const px = x + Math.cos(angle) * radius * .43;
        const py = y + Math.sin(angle) * radius * .3;
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(phase) * .15);
        ctx.fillStyle = '#333b33';
        ctx.beginPath(); ctx.ellipse(0, 0, 17, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(14, -5, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(13, -10); ctx.lineTo(11, -18); ctx.lineTo(18, -11); ctx.fill();
        for (const leg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(leg * 7, 4); ctx.lineTo(leg * 9 + Math.sin(phase * 5) * 3, 15); ctx.strokeStyle = '#333b33'; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.strokeStyle = '#333b33'; ctx.beginPath(); ctx.moveTo(-14, -1); ctx.lineTo(-24, -9 + Math.sin(phase) * 4); ctx.stroke();
        ctx.restore();
      }
    } else if (scene === 'beat') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(now * (active ? 5 : 1) + hazard.offset) * (active ? .5 : .18));
      ctx.strokeStyle = '#d4b878'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -radius * .62); ctx.lineTo(0, radius * .34); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = `rgba(240,197,124,${active ? .62 : .22})`; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 18, y + 8, 18 + i * 11 + Math.sin(now * 4) * 3, -.7, .7); ctx.stroke(); }
      circle(x - 28, y + 18, 11, '#313a33', '#c8b177', 1.5);
      ctx.fillStyle = '#313a33'; ctx.beginPath(); ctx.moveTo(x - 42, y + 45); ctx.lineTo(x - 36, y + 29); ctx.lineTo(x - 20, y + 29); ctx.lineTo(x - 14, y + 45); ctx.fill();
    } else if (scene === 'assassin') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(now * (active ? .8 : .15));
      for (const angle of [-.58, .58]) { ctx.save(); ctx.rotate(angle); ctx.fillStyle = '#d3bd88'; ctx.beginPath(); ctx.moveTo(-radius * .5, -3); ctx.lineTo(radius * .45, 0); ctx.lineTo(-radius * .5, 3); ctx.closePath(); ctx.fill(); ctx.fillRect(-radius * .58, -5, radius * .18, 10); ctx.restore(); }
      ctx.restore();
      if (active) { ctx.strokeStyle = `rgba(237,196,120,${.35 + pulse * .35})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, radius * .6, now, now + 1.1); ctx.stroke(); }
    } else if (scene === 'wrestle') {
      ctx.strokeStyle = 'rgba(216,190,131,.68)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y + 9, radius * (.26 + i * .17), radius * (.12 + i * .08), now * .15, 0, Math.PI * 2); ctx.stroke(); }
      for (const side of [-1, 1]) { circle(x + side * 20, y - 12, 8, '#b9a17b', '#473d32', 1); ctx.strokeStyle = '#53665a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x + side * 20, y - 4); ctx.lineTo(x - side * 7, y + 16); ctx.lineTo(x + side * 22, y + 29); ctx.stroke(); }
    } else if (scene === 'seal') {
      ctx.fillStyle = '#e3d4b0'; ctx.fillRect(x - radius * .4, y - radius * .42, radius * .8, radius * .84);
      ctx.strokeStyle = '#987e59'; ctx.lineWidth = 2; ctx.strokeRect(x - radius * .4, y - radius * .42, radius * .8, radius * .84);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - radius * .27, y + i * 15); ctx.lineTo(x + radius * .27, y + i * 15); ctx.stroke(); }
      circle(x + radius * .19, y + radius * .16, radius * .16, `rgba(152,62,49,${active ? .78 : .52})`, '#713c31', 2);
      text('敕', x + radius * .19, y + radius * .16, '#f2d9ac', 14, 'center', 700);
    } else if (scene === 'mask') {
      ctx.fillStyle = '#d8c69b'; ctx.beginPath(); ctx.ellipse(x, y, radius * .38, radius * .48, Math.sin(now) * .04, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#313a33'; circle(x - radius * .14, y - radius * .04, 5, '#313a33', null); circle(x + radius * .14, y - radius * .04, 5, '#313a33', null);
      ctx.strokeStyle = '#8f493a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 12, y + 17); ctx.quadraticCurveTo(x, y + 23, x + 12, y + 17); ctx.stroke();
      for (let i = 0; i < 5; i++) { const px = x + Math.sin(now * .7 + i * 3) * radius * .63; const py = y + Math.cos(now * .8 + i * 2) * radius * .44; circle(px, py, 2 + (i % 2), 'rgba(224,204,159,.7)', null); }
    } else if (scene === 'archive') {
      for (let i = -1; i <= 1; i++) {
        ctx.save(); ctx.translate(x + i * 22, y + i * -8); ctx.rotate(i * .12);
        ctx.fillStyle = '#e2d4b3'; ctx.fillRect(-19, -27, 38, 54); ctx.strokeStyle = '#9c8760'; ctx.lineWidth = 1.5; ctx.strokeRect(-19, -27, 38, 54);
        for (let row = -1; row <= 1; row++) { ctx.beginPath(); ctx.moveTo(-12, row * 10); ctx.lineTo(12, row * 10); ctx.stroke(); }
        ctx.restore();
      }
      circle(x + 31, y + 18, 10, '#934638', '#e1c487', 2);
    }
    ctx.restore();

    const tint = active ? `rgba(177,70,52,${.1 + pulse * .08})` : state.warning ? 'rgba(199,162,92,.12)' : 'rgba(195,173,122,.045)';
    const line = active ? 'rgba(224,126,96,.9)' : state.warning ? 'rgba(226,199,134,.76)' : 'rgba(192,174,132,.48)';
    ctx.fillStyle = tint;
    ctx.strokeStyle = line;
    ctx.lineWidth = active ? 2.8 : 1.5;
    ctx.setLineDash(active ? [] : [6, 7]);
    if (box) ctx.strokeRect(left, top, radius * 2, radius * 1.52);
    else circle(x, y, radius, null, line, active ? 2.8 : 1.5);
    ctx.setLineDash([]);

    const scale = canvas.clientWidth > 0 ? W / canvas.clientWidth : 1;
    const labelWidth = 192 * scale;
    const labelHeight = 34 * scale;
    ctx.fillStyle = 'rgba(12,18,15,.92)';
    ctx.fillRect(x - labelWidth / 2, y - radius - labelHeight - 4, labelWidth, labelHeight);
    ctx.strokeStyle = active ? 'rgba(223,155,104,.76)' : 'rgba(208,184,126,.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - labelWidth / 2, y - radius - labelHeight - 4, labelWidth, labelHeight);
    const status = active ? '生效中' : state.warning ? '即将出现' : '史料场景';
    text(`${record.id} · ${record.title}`, x, y - radius - labelHeight * .68, '#f3e7c9', 9, 'center', 650);
    text(`${status} · ${hazard.tier} · 游戏伤害 ${hazard.damagePerSecond} 点/秒`, x, y - radius - labelHeight * .23, active ? '#f0b295' : '#e5d6aa', 8, 'center', 600);
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

  function drawWeapon(weapon, time) {
    if (weapon.collected) return;
    const lift = Math.sin(time * 3 + weapon.x) * 3;
    ctx.save();
    ctx.translate(weapon.x, weapon.y + lift);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = 'rgba(221,196,137,.15)';
    ctx.fillRect(-18, -18, 36, 36);
    ctx.fillStyle = '#d5c18b';
    ctx.fillRect(-2, -20, 4, 25);
    ctx.fillStyle = '#b77d57';
    ctx.fillRect(-2, 5, 4, 9);
    ctx.fillRect(-7, 3, 14, 3);
    ctx.restore();
    text('武器', weapon.x, weapon.y + 27 + lift, '#ead7aa', 10, 'center', 600);
  }

  function drawHealingItem(item, time) {
    if (item.collected) return;
    const lift = Math.sin(time * 2.6 + item.y) * 2;
    ctx.save();
    ctx.translate(item.x, item.y + lift);
    circle(0, 0, 15, 'rgba(164,190,132,.2)', 'rgba(199,220,151,.85)', 1.5);
    ctx.fillStyle = '#d7dfae';
    ctx.fillRect(-4, -8, 8, 16);
    ctx.fillRect(-8, -4, 16, 8);
    ctx.restore();
    text('回血药', item.x, item.y + 27 + lift, '#dfe8bb', 10, 'center', 600);
  }

  function drawHealthBar(entity, width, title) {
    const x = entity.x - width / 2;
    const y = entity.y - entity.radius - 17;
    const ratio = Math.max(0, entity.hp / entity.maxHp);
    ctx.fillStyle = 'rgba(7,12,10,.88)';
    ctx.fillRect(x - 1, y - 1, width + 2, 6);
    ctx.fillStyle = '#603d36';
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = ratio > .45 ? '#a6bd83' : '#dc8063';
    ctx.fillRect(x, y, width * ratio, 4);
    text(`${title} ${Math.ceil(entity.hp)}/${entity.maxHp}`, entity.x, y - 8, '#f0e5ca', 8, 'center', 600);
  }

  function drawEnemy(enemy, time) {
    if (!enemy.alive) return;
    const hurt = enemy.hitUntil > run.elapsed;
    ctx.save();
    ctx.translate(enemy.x, enemy.y + Math.sin(time * 2 + enemy.x) * .8);
    if (hurt && Math.floor(time * 30) % 2) ctx.globalAlpha = .45;
    circle(0, 3, enemy.radius + 4, 'rgba(5,10,8,.28)', null);
    const bodyColor = enemy.type === 'marshal' ? '#b28b4e' : enemy.type === 'general' ? '#865044' : '#53675c';
    const trimColor = enemy.type === 'soldier' ? '#b9aa83' : '#dfc17f';
    ctx.beginPath();
    ctx.moveTo(-enemy.radius, enemy.radius + 4);
    ctx.lineTo(-enemy.radius + 4, -2);
    ctx.lineTo(-enemy.radius * .6, -enemy.radius * .65);
    ctx.lineTo(enemy.radius * .6, -enemy.radius * .65);
    ctx.lineTo(enemy.radius - 4, -2);
    ctx.lineTo(enemy.radius, enemy.radius + 4);
    ctx.closePath();
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = enemy.type === 'marshal' ? 2 : 1;
    ctx.stroke();
    circle(0, -enemy.radius, enemy.type === 'soldier' ? 5 : 7, '#c6aa87', '#473b31', 1);
    ctx.beginPath();
    ctx.moveTo(-7, -enemy.radius - 3);
    ctx.lineTo(0, -enemy.radius - (enemy.type === 'marshal' ? 16 : 10));
    ctx.lineTo(7, -enemy.radius - 3);
    ctx.closePath();
    ctx.fillStyle = trimColor;
    ctx.fill();
    if (enemy.type === 'marshal') {
      ctx.strokeStyle = 'rgba(224,195,125,.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius - 13);
      ctx.lineTo(0, -enemy.radius - 30);
      ctx.lineTo(12, -enemy.radius - 25);
      ctx.lineTo(0, -enemy.radius - 20);
      ctx.stroke();
    }
    ctx.restore();
    drawHealthBar(enemy, enemy.type === 'soldier' ? 36 : enemy.type === 'general' ? 50 : 66, enemy.label);
  }

  function drawFog() {
    const fog = engine.FOG;
    const columns = Math.ceil(W / fog.cellSize);
    const rows = Math.ceil(H / fog.cellSize);
    if (run.exploredDirty) {
      memoryCtx.clearRect(0, 0, W, H);
      memoryCtx.fillStyle = 'rgba(0,0,0,.48)';
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          if (run.explored[row * columns + column]) {
            memoryCtx.fillRect(column * fog.cellSize, row * fog.cellSize, fog.cellSize + .5, fog.cellSize + .5);
          }
        }
      }
      run.exploredDirty = false;
    }
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.globalAlpha = 1;
    fogCtx.fillStyle = '#020405';
    fogCtx.fillRect(0, 0, W, H);
    fogCtx.globalCompositeOperation = 'destination-out';
    fogCtx.drawImage(memoryCanvas, 0, 0, W, H);
    fogCtx.globalAlpha = 1;
    const radius = fog.revealRadius;
    const gradient = fogCtx.createRadialGradient(run.player.x, run.player.y, radius - fog.fade, run.player.x, run.player.y, radius);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(.82, 'rgba(0,0,0,.98)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    fogCtx.fillStyle = gradient;
    fogCtx.beginPath();
    fogCtx.arc(run.player.x, run.player.y, radius, 0, Math.PI * 2);
    fogCtx.fill();
    fogCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(fogCanvas, 0, 0, W, H);
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
    drawHealthBar(boss, 74, '皇帝');
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
    for (const hazard of run.hazards) drawHazardScene(hazard, time, engine.hazardState(hazard, run.stageElapsed));
    for (const context of run.contexts) drawContext(context, time);
    for (const weapon of run.weaponPickups) drawWeapon(weapon, time);
    for (const item of run.healingItems) drawHealingItem(item, time);
    for (const enemy of run.enemies) drawEnemy(enemy, time);
    drawEmperor(time);
    drawPlayer(time);
    if (run.attackFlash && run.attackFlash.until > run.elapsed) {
      ctx.save();
      ctx.strokeStyle = `rgba(234,211,151,${Math.max(.25, (run.attackFlash.until - run.elapsed) / .16)})`;
      ctx.lineWidth = 3;
      circle(run.attackFlash.x, run.attackFlash.y, 28 + (run.elapsed * 80 % 8), null, ctx.strokeStyle, 3);
      ctx.restore();
    }
    if (run.hitText && run.hitText.until > run.elapsed) {
      const progress = 1 - (run.hitText.until - run.elapsed) / .72;
      text(run.hitText.value, run.hitText.x, run.hitText.y - 27 - progress * 17, '#ffe09a', 17, 'center', 800);
    }
    drawFog();
    text('未探索区域被黑雾遮挡', W - 28, 48, 'rgba(226,220,197,.68)', 10, 'right', 500);
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
      canvas.focus({preventScroll: true});
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
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) {
      const interactiveTarget = event.target instanceof Element && event.target.closest('input, button, a, summary');
      if (mode !== 'playing' || interactiveTarget) return;
      if (event.key.startsWith('Arrow')) event.preventDefault();
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
