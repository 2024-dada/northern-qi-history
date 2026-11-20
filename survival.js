(() => {
  'use strict';

  const engine = window.SURVIVAL_ENGINE;
  const hazardArt = window.SURVIVAL_HAZARD_ART;
  const records = window.SURVIVAL_RECORDS;
  const canvas = document.querySelector('#survival-canvas');
  if (!canvas || !engine || !hazardArt || !Array.isArray(records)) return;
  const recordsById = new Map(records.map(record => [record.id, record]));

  const ctx = canvas.getContext('2d', {alpha: false});
  const mapArt = new Image();
  mapArt.decoding = 'async';
  let mapTop, mapBottom, mapTrim;
  function updateMapTheme() {
    const styles = getComputedStyle(document.documentElement);
    mapTop = styles.getPropertyValue('--ui-map-top').trim() || '#23332c';
    mapBottom = styles.getPropertyValue('--ui-map-bottom').trim() || '#17231f';
    mapTrim = styles.getPropertyValue('--ui-map-trim').trim() || '#d4c394';
    const art = styles.getPropertyValue('--ui-landscape').trim().match(/^url\(["']?(.*?)["']?\)$/);
    if (!art) return;
    const url = new URL(art[1], document.baseURI).href;
    if (mapArt.src !== url) mapArt.src = url;
  }
  updateMapTheme();
  document.addEventListener('ui-theme-change', updateMapTheme);
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
  let lastMessage = '';
  let renderedUpgradeChoices = null;
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
  const gameFullscreenClass = 'is-game-fullscreen';
  const fullscreenButton = $('[data-game-action="toggle-fullscreen"]');
  const setFullscreenLayout = active => {
    document.documentElement.classList.toggle(gameFullscreenClass, active);
    fullscreenButton.textContent = active ? '退出全屏' : '全屏';
  };
  const requestFullscreen = async () => {
    setFullscreenLayout(true);
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
      if (!document.documentElement.requestFullscreen) setLive('浏览器未提供全屏接口，已切换到沉浸式全屏布局。');
      return;
    }
    try {
      await document.documentElement.requestFullscreen({navigationUI: 'hide'});
    } catch {
      setLive('浏览器拒绝原生全屏，已切换到沉浸式全屏布局。');
    }
  };
  const exitFullscreen = async () => {
    setFullscreenLayout(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch { /* The fallback layout has already been removed. */ }
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
      <a href="${escapeHtml(record.source)}">
        <em>${escapeHtml(record.id)}</em><span>${escapeHtml(record.title)}</span>
        <small>${escapeHtml(record.time)} · ${escapeHtml(record.category)} · ${escapeHtml(record.status)}</small>
      </a>
    </li>`).join('');
  }

  function renderLayerHazards() {
    if (!run) {
      $('[data-current-layer-note]').textContent = '每层随机出现 4 种酷刑区。';
      $('[data-current-hazards]').innerHTML = '<li>开局后显示本层类型、伤害和出处。</li>';
      return;
    }
    const encounter = run.layer >= 5
      ? `大将军带领三支分散的将领小队；皇帝半血时召来 ${run.layer - 1} 名将领。`
      : run.layer >= 3 ? '三支将领小队分散巡查。' : '三支追兵小队分散搜索。';
    $('[data-current-layer-note]').textContent = `第 ${run.layer} 层 · ${encounter}地图视野外的物件会隐藏。`;
    $('[data-current-hazards]').innerHTML = run.hazards.map(hazard => {
      const links = hazard.sources.map(id => recordsById.get(id)).filter(Boolean).map(record =>
        `<a href="${escapeHtml(record.source)}" title="${escapeHtml(record.title)}"
          aria-label="史料 ${escapeHtml(record.id)}，${escapeHtml(record.title)}">${escapeHtml(record.id)}</a>`
      ).join(' ');
      return `<li><strong>${escapeHtml(hazard.name)}区</strong>
        <small>生效时 ${hazard.damagePerSecond} 点/秒</small>
        <span class="survival-hazard-sources">史料 ${links}</span></li>`;
    }).join('');
  }

  function updateHud() {
    if (!run) return;
    const weapon = run.player.meleeWeapon ? engine.MELEE_WEAPONS[run.player.meleeWeapon].label : '未拾取';
    const next = `${run.layer}|${run.level}|${run.score}|${Math.ceil(run.player.hp)}|${run.player.hp}|${run.player.maxHp}|${weapon}|${run.player.bowAmmo}`;
    if (next === lastHud) return;
    $('[data-hud-layer]').textContent = String(run.layer);
    $('[data-hud-level]').textContent = run.layer > 5 ? '5 · 进阶' : `${run.level} / 5`;
    $('[data-hud-score]').textContent = run.score.toLocaleString('zh-CN');
    $('[data-hud-weapon]').textContent = weapon;
    $('[data-hud-arrows]').textContent = String(run.player.bowAmmo);
    $('[data-hud-hp]').textContent = `${Math.ceil(run.player.hp)} / ${run.player.maxHp}`;
    $('[data-hud-health-fill]').style.width = `${Math.max(0, run.player.hp / run.player.maxHp * 100)}%`;
    $('[data-hud-health-fill]').style.background = run.player.hp / run.player.maxHp <= .3
      ? 'linear-gradient(90deg,#a34e40,#d2765a)'
      : 'linear-gradient(90deg,#93a273,#d6b878)';
    lastHud = next;
  }

  function renderUpgradeChoices() {
    const choices = $('[data-upgrade-choices]');
    if (!run?.upgradeChoices?.length) {
      if (choices.childElementCount) choices.replaceChildren();
      renderedUpgradeChoices = null;
      return;
    }
    // The animation loop checks the upgrade phase every frame. Keep the existing
    // buttons while the choices are unchanged so pointerup/click can reach them.
    if (renderedUpgradeChoices === run.upgradeChoices) return;
    choices.innerHTML = run.upgradeChoices.map(choice => `<button type="button" data-game-upgrade="${escapeHtml(choice.id)}" class="talent-${escapeHtml(choice.rarity)}">
      <small>${choice.rarity === 'basic' ? '基础加成' : ({common: '普通天赋', rare: '稀有天赋', epic: '史诗天赋', legendary: '传说天赋'}[choice.rarity] || '')}</small>
      <strong>${escapeHtml(choice.title)}</strong><span>${escapeHtml(choice.description)}</span>
    </button>`).join('');
    renderedUpgradeChoices = run.upgradeChoices;
  }

  function resetHud() {
    $('[data-hud-layer]').textContent = '—';
    $('[data-hud-level]').textContent = '— / 5';
    $('[data-hud-score]').textContent = '0';
    $('[data-hud-weapon]').textContent = '未拾取';
    $('[data-hud-arrows]').textContent = '0';
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
      run = engine.createRun(name, seed);
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
    renderUpgradeChoices();
    lastMessage = '';
    updateHud();
    renderLayerHazards();
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
    renderUpgradeChoices();
    showOnly('start');
    resetHud();
    renderLayerHazards();
    setLive('输入名称后开始。WASD 控制移动；近战自动挥击，弓箭自动瞄准。');
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
    gradient.addColorStop(0, mapTop);
    gradient.addColorStop(1, mapBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    if (mapArt.complete && mapArt.naturalWidth) {
      const scale = Math.max(W / mapArt.naturalWidth, H / mapArt.naturalHeight);
      const width = mapArt.naturalWidth * scale;
      const height = mapArt.naturalHeight * scale;
      ctx.save();
      ctx.globalAlpha = run ? .12 : .25;
      ctx.drawImage(mapArt, (W - width) / 2, (H - height) / 2, width, height);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = mapTrim;
    ctx.lineWidth = 1;
    for (let x = 28; x < W; x += 54) {
      for (let y = 28; y < H; y += 54) {
        const offset = ((Math.floor(x / 54) + Math.floor(y / 54)) % 2) * 2;
        ctx.strokeRect(x + offset, y + offset, 25, 25);
      }
    }
    ctx.restore();

    ctx.strokeStyle = `${mapTrim}7a`;
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, W - 44, H - 44);
    ctx.strokeStyle = `${mapTrim}2e`;
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, W - 64, H - 64);
    for (const x of [82, W - 82]) {
      ctx.fillStyle = `${mapTrim}29`;
      ctx.fillRect(x - 12, 35, 24, H - 70);
      ctx.strokeStyle = `${mapTrim}2e`;
      ctx.strokeRect(x - 12, 35, 24, H - 70);
    }
    // Palace courtyard axis, patterned after the site's architectural illustration.
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = mapTrim;
    ctx.setLineDash([5, 13]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 48);
    ctx.lineTo(W / 2, H - 48);
    ctx.moveTo(105, H / 2);
    ctx.lineTo(W - 105, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    circle(W / 2, H / 2, 118 + Math.sin(time * .3) * 3, null, mapTrim, 1);
    ctx.restore();
    text('北齐宫苑 · 游戏示意地图', 47, 48, 'rgba(235,222,190,.48)', 10, 'left', 400);
  }

  function drawWeapon(weapon, time) {
    if (weapon.collected) return;
    const lift = Math.sin(time * 3 + weapon.x) * 3;
    ctx.save();
    ctx.translate(weapon.x, weapon.y + lift);
    ctx.fillStyle = 'rgba(221,196,137,.15)';
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
    if (weapon.type === 'bow') {
      ctx.strokeStyle = '#d5c18b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(-3, 0, 12, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#e1d4b4'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(1, -11); ctx.lineTo(1, 11); ctx.stroke();
    } else {
      ctx.rotate(-Math.PI / 4);
      const size = weapon.type === 'poleaxe' ? 1.35 : weapon.type === 'longSword' ? 1.15 : 1;
      ctx.scale(size, size);
      ctx.fillStyle = '#d5c18b';
      ctx.fillRect(-2, -20, 4, 25);
      ctx.fillStyle = '#b77d57';
      ctx.fillRect(-2, 5, 4, 9);
      ctx.fillRect(-7, 3, 14, 3);
      if (weapon.type === 'poleaxe') {
        ctx.fillStyle = '#c5b27d'; ctx.beginPath();
        ctx.moveTo(-3, -16); ctx.lineTo(-12, -12); ctx.lineTo(-10, -6); ctx.lineTo(-2, -9);
        ctx.moveTo(3, -18); ctx.lineTo(11, -22); ctx.lineTo(10, -12); ctx.lineTo(3, -9);
        ctx.fill();
      }
    }
    ctx.restore();
    const label = weapon.type === 'bow' ? `箭 ×${weapon.arrows}` : engine.MELEE_WEAPONS[weapon.type].label;
    text(label, weapon.x, weapon.y + 27 + lift, '#ead7aa', 9, 'center', 600);
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
    const bodyColor = enemy.friendly ? '#527e69' : enemy.type === 'marshal' ? '#b28b4e' : enemy.type === 'general' ? '#865044' : '#53675c';
    const trimColor = enemy.friendly ? '#9bd7a7' : enemy.type === 'soldier' ? '#b9aa83' : '#dfc17f';
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
    const bladeLength = enemy.type === 'marshal' ? 24 : enemy.type === 'general' ? 20 : 16;
    ctx.save();
    ctx.rotate(enemy.facing || 0);
    ctx.strokeStyle = enemy.friendly ? '#b8e2a6' : '#d7c798';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(bladeLength, 4); ctx.stroke();
    ctx.restore();
    ctx.restore();
    drawHealthBar(enemy, enemy.type === 'soldier' ? 36 : enemy.type === 'general' ? 50 : 66, enemy.label);
  }

  function drawSwingTelegraph(actor, time, color) {
    if (actor.swingStartedAt === null || actor.swingStartedAt === undefined) return;
    const elapsed = Math.max(0, time - actor.swingStartedAt);
    const windup = actor.swingWindup || .025;
    const progress = Math.min(1, elapsed / (windup + .2));
    const facing = actor.swingFacing ?? actor.facing ?? 0;
    const span = Math.PI * (.22 + progress * .16);
    const radius = actor.swingRange || actor.attackRange || 48;
    ctx.save();
    ctx.globalAlpha = elapsed < windup ? .55 : Math.max(.16, .72 - (elapsed - windup) * 2.2);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(actor.x, actor.y);
    ctx.arc(actor.x, actor.y, radius, facing - span, facing + span);
    ctx.closePath();
    ctx.fill();
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(actor.x, actor.y, radius, facing - span, facing + span); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawWeaponRadius(player) {
    const weapon = player.meleeWeapon && engine.MELEE_WEAPONS[player.meleeWeapon];
    if (!weapon) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(232,207,146,.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]);
    circle(player.x, player.y, weapon.range, null, ctx.strokeStyle, 1);
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawArrowEffects(time) {
    for (const arrow of run.projectileEffects) {
      const progress = Math.min(1, (time - arrow.startedAt) / (arrow.until - arrow.startedAt));
      const x = arrow.x1 + (arrow.x2 - arrow.x1) * progress;
      const y = arrow.y1 + (arrow.y2 - arrow.y1) * progress;
      const angle = Math.atan2(arrow.y2 - arrow.y1, arrow.x2 - arrow.x1);
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.strokeStyle = 'rgba(248,226,167,.94)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
      ctx.fillStyle = '#f2d18b'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(5, -3); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
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
    if (boss.phase === 2) {
      ctx.save();
      ctx.strokeStyle = `rgba(222,126,92,${.36 + Math.sin(time * 7) * .18})`;
      ctx.lineWidth = 2;
      circle(boss.x, boss.y, 38, null, ctx.strokeStyle, 2);
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
    if (player.meleeWeapon) {
      const bladeLength = player.meleeWeapon === 'poleaxe' ? 25 : player.meleeWeapon === 'longSword' ? 22 : 18;
      ctx.save(); ctx.rotate(player.facing || 0);
      ctx.strokeStyle = '#e4d3a1'; ctx.lineWidth = 2.7;
      ctx.beginPath(); ctx.moveTo(5, 2); ctx.lineTo(bladeLength, 2); ctx.stroke();
      ctx.restore();
    } else if (player.bowAmmo > 0) {
      ctx.save(); ctx.rotate(player.facing || 0);
      ctx.strokeStyle = '#d9bf82'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(12, 0, 9, -1.15, 1.15); ctx.stroke();
      ctx.restore();
    }
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
    const worldUnitsPerCssPixel = W / (canvas.clientWidth || W);
    for (const hazard of run.hazards) {
      hazardArt.draw(ctx, hazard, time, engine.hazardState(hazard, run.stageElapsed), worldUnitsPerCssPixel);
    }
    for (const weapon of run.weaponPickups) drawWeapon(weapon, time);
    for (const item of run.healingItems) drawHealingItem(item, time);
    drawWeaponRadius(run.player);
    for (const enemy of run.enemies) {
      if (!enemy.alive) continue;
      drawSwingTelegraph(enemy, time, enemy.friendly ? 'rgba(146,220,157,.32)' : 'rgba(225,124,92,.3)');
    }
    if (run.emperor.alive) drawSwingTelegraph(run.emperor, time, 'rgba(224,95,72,.36)');
    drawSwingTelegraph(run.player, time, 'rgba(237,209,143,.32)');
    for (const enemy of run.enemies) drawEnemy(enemy, time);
    drawEmperor(time);
    drawPlayer(time);
    drawArrowEffects(time);
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
      engine.advance(run, moveVector(), dt);
      updateHud();
      if (run.message) setLive(run.message);
      if (run.phase === 'upgrade') {
        renderUpgradeChoices();
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
    if (action === 'toggle-fullscreen') {
      if (document.documentElement.classList.contains(gameFullscreenClass)) exitFullscreen();
      else requestFullscreen();
    }
    if (action === 'exit-fullscreen') exitFullscreen();
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
      const selectedTitle = run.upgradeChoices.find(choice => choice.id === selected)?.title
        || (selected === 'speed' ? '移速提升' : '闪避提升');
      if (!engine.chooseUpgrade(run, selected)) return;
      mode = 'playing';
      showOnly(null);
      updateHud();
      renderLayerHazards();
      renderUpgradeChoices();
      lastMessage = '';
      setLive(`${selectedTitle}已生效。${run.message}`);
      canvas.focus({preventScroll: true});
    }
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-game-action]');
    if (action) handleAction(action.dataset.gameAction, action);
    const upgrade = event.target.closest('[data-game-upgrade]');
    if (upgrade) handleAction('', upgrade);
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) setFullscreenLayout(false);
  });
  document.addEventListener('ui-settings-toggle', event => {
    if (event.detail.open) pauseGame();
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
  renderLayerHazards();
  resetHud();
  showOnly('start');
  requestAnimationFrame(frame);
})();
