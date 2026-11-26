(() => {
  'use strict';

  const engine = window.SURVIVAL_ENGINE;
  const hazardArt = window.SURVIVAL_HAZARD_ART;
  const audio = window.SURVIVAL_AUDIO;
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
    floorDirty = true;
  }
  let floorDirty = true;
  mapArt.addEventListener('load', () => { floorDirty = true; });
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
  // Soft brush for explored ground, so the remembered map has feathered edges instead of square cells.
  const fogBrush = document.createElement('canvas');
  {
    const size = engine.FOG.cellSize * 3;
    fogBrush.width = fogBrush.height = size;
    const b = fogBrush.getContext('2d');
    const g = b.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(.45, 'rgba(0,0,0,.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = g;
    b.fillRect(0, 0, size, size);
  }
  // The courtyard floor is painted once per theme and reused every frame.
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = engine.WORLD.width;
  floorCanvas.height = engine.WORLD.height;
  const floorCtx = floorCanvas.getContext('2d');
  const $ = selector => document.querySelector(selector);
  const W = engine.WORLD.width;
  const H = engine.WORLD.height;
  const nameInput = $('#player-name');
  const live = $('[data-game-live]');
  const overlay = name => $(`[data-overlay="${name}"]`);
  const storageKey = 'qi-survival-rank-v1';
  const pressed = new Set();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const weaponEffects = {
    sword: {color: '#f4e8b4', width: 3, burst: 19, sparks: 4},
    longSword: {color: '#b8e2e0', width: 4, burst: 25, sparks: 5},
    poleaxe: {color: '#fac080', width: 7, burst: 35, sparks: 7},
    spear: {color: '#f0d9a0', width: 4, burst: 22, sparks: 5},
    dualBlades: {color: '#e8f0ff', width: 3, burst: 16, sparks: 3},
    mace: {color: '#f2b46a', width: 8, burst: 34, sparks: 8},
    halberd: {color: '#f5d48e', width: 6, burst: 28, sparks: 6},
    meteor: {color: '#ffcc88', width: 6, burst: 30, sparks: 7},
    crossbow: {color: '#e6d3a0', width: 3, burst: 18, sparks: 3},
    bow: {color: '#ffe3a0', width: 2, burst: 14, sparks: 4},
    guard: {color: '#e9a688', width: 3, burst: 15, sparks: 3}
  };
  const impacts = [];
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
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

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
  const skillButton = $('[data-game-action="rebellion"]');
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

  function updateSkillSlot() {
    const count = run ? 3 + Math.floor((run.layer - 1) / 5) : 3;
    const remaining = run ? Math.max(0, Math.ceil(run.nextRebellionAt - run.elapsed)) : 0;
    const suffix = remaining ? `${remaining} 秒` : `${count} 人 · Q`;
    skillButton.textContent = `召唤反叛军团 · ${suffix}`;
    skillButton.disabled = mode !== 'playing' || run?.phase !== 'playing' || remaining > 0;
  }

  function updateHud() {
    updateSkillSlot();
    if (!run) return;
    const weapon = run.player.meleeWeapon ? engine.MELEE_WEAPONS[run.player.meleeWeapon].label : '未拾取';
    const meleeBonus = engine.damageBonus(run, 'sword');
    const bowBonus = engine.damageBonus(run, 'bow');
    const mutiny = run.talents.mutiny;
    const next = `${run.layer}|${run.level}|${run.score}|${Math.ceil(run.player.hp)}|${run.player.hp}|${run.player.maxHp}|${weapon}|${run.player.bowAmmo}|${meleeBonus}|${bowBonus}|${mutiny}`;
    if (next === lastHud) return;
    $('[data-hud-layer]').textContent = String(run.layer);
    $('[data-hud-level]').textContent = String(run.level);
    $('[data-hud-score]').textContent = run.score.toLocaleString('zh-CN');
    $('[data-hud-weapon]').textContent = weapon;
    $('[data-hud-arrows]').textContent = String(run.player.bowAmmo);
    $('[data-hud-strength]').hidden = !meleeBonus;
    if (meleeBonus) $('[data-hud-strength] b').textContent = meleeBonus === bowBonus
      ? `+${meleeBonus}%` : `近战 +${meleeBonus}% · 弓箭 +${bowBonus}%`;
    $('[data-hud-mutiny]').hidden = !mutiny;
    if (mutiny) $('[data-hud-mutiny] b').textContent = `${mutiny} 名/5秒`;
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
    const ranks = {basic: '基础加成', common: '普通天赋', rare: '稀有天赋', epic: '史诗天赋', legendary: '传说天赋'};
    choices.innerHTML = run.upgradeChoices.map(choice => {
      const count = (choice.rarity === 'basic' ? run.upgrades : run.talents)[choice.id];
      return `<button type="button" data-game-upgrade="${escapeHtml(choice.id)}" class="talent-${escapeHtml(choice.rarity)}">
        <small>${ranks[choice.rarity]}</small><strong>${escapeHtml(choice.title)}</strong>
        <span>${escapeHtml(choice.description)}</span>
        ${count ? `<span class="talent-stack">已选 ${count} 点</span>` : ''}
      </button>`;
    }).join('');
    renderedUpgradeChoices = run.upgradeChoices;
  }

  const swapButton = $('[data-swap]');
  let swapShown = null;
  function updateSwapButton() {
    const item = run?.phase === 'playing' ? run.swapCandidate : null;
    const key = item ? item.type : '';
    if (key === swapShown) return;
    swapShown = key;
    swapButton.hidden = !item;
    if (item) $('[data-swap-label]').textContent = `换${engine.MELEE_WEAPONS[item.type].label}`;
  }

  function resetHud() {
    updateSkillSlot();
    $('[data-hud-layer]').textContent = '—';
    $('[data-hud-level]').textContent = '—';
    $('[data-hud-score]').textContent = '0';
    $('[data-hud-weapon]').textContent = '未拾取';
    $('[data-hud-arrows]').textContent = '0';
    $('[data-hud-strength]').hidden = true;
    $('[data-hud-mutiny]').hidden = true;
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
    impacts.length = 0;
    particles.length = 0;
    floaters.length = 0;
    rings.length = 0;
    eventState = null;
    audio?.setPlaying(true, {restart: true});
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
    swapButton.hidden = true; swapShown = null;
    if (mode === 'over') return;
    mode = 'over';
    rebellionQueued = false;
    updateSkillSlot();
    audio?.setPlaying(false);
    pressed.clear();
    stickVector = {x: 0, y: 0};
    $('[data-game-action="pause"]').disabled = true;
    saveRun();
    $('[data-final-score]').textContent = run.score.toLocaleString('zh-CN');
    $('[data-final-summary]').textContent = `存活 ${formatTime(run.elapsed)} · 到达第 ${run.layer} 层 · 击退追兵与将领 ${run.enemyKills} 名（其中将领 ${run.generalKills} 名）· 击败大将军 ${run.marshalKills} 名、皇帝 ${run.bossKills} 位。`;
    showOnly('over');
    setLive(`本局结束，得分 ${run.score}。排行榜只保存到当前浏览器。`);
  }

  // Pause card: this run at a glance plus one play tip taken from the rules.
  const pauseTips = [
    '宝剑、长剑、长柄斧的挥砍范围由小到大，被围住时长柄斧最稳。',
    '弓箭会在远处自动瞄准，但每支只命中一人，留给落单的敌人。',
    '回血药每 5 秒随机刷新一个，地图上最多同时留 4 个。',
    '皇帝每 5 秒召来一名将领，拖得越久，场上敌人越多。',
    '第五层起有大将军镇守，皇帝掉到半血还会召增援。',
    '敌军也会攻击你的援军，援军能替你分走火力。',
    '危险区有生效、预警、暂歇三种状态，看漆牌上的状态珠再进出。'
  ];
  let tipIndex = Math.floor(Math.random() * pauseTips.length);
  function renderPauseCard() {
    const stats = $('[data-pause-stats]');
    if (stats && run) {
      const rows = [['层数', `第 ${run.layer} 层`], ['存活', formatTime(run.elapsed)], ['得分', run.score.toLocaleString('zh-CN')], ['体力', `${Math.ceil(run.player.hp)} / ${run.player.maxHp}`]];
      stats.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');
    }
    const tip = $('[data-pause-tip]');
    if (tip) { tip.textContent = '提示：' + pauseTips[tipIndex]; tipIndex = (tipIndex + 1) % pauseTips.length; }
  }

  function pauseGame() {
    if (mode !== 'playing') return;
    mode = 'paused';
    rebellionQueued = false;
    updateSkillSlot();
    audio?.setPlaying(false);
    pressed.clear();
    stickVector = {x: 0, y: 0};
    renderPauseCard();
    showOnly('pause');
    setLive('已暂停，暂停期间不计时。');
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    mode = 'playing';
    updateSkillSlot();
    audio?.setPlaying(true);
    showOnly(run?.phase === 'upgrade' ? 'upgrade' : null);
    lastMessage = '';
    setLive(run?.phase === 'upgrade' ? '请从三张天赋中选择一张。' : '继续闯关。');
    canvas.focus({preventScroll: true});
  }

  function resetToReady() {
    mode = 'ready';
    audio?.setPlaying(false);
    impacts.length = 0;
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

  let swapQueued = false;
  let rebellionQueued = false;
  function moveVector() {
    let x = stickVector.x, y = stickVector.y;
    if (pressed.has('ArrowLeft') || pressed.has('a') || pressed.has('A')) x--;
    if (pressed.has('ArrowRight') || pressed.has('d') || pressed.has('D')) x++;
    if (pressed.has('ArrowUp') || pressed.has('w') || pressed.has('W')) y--;
    if (pressed.has('ArrowDown') || pressed.has('s') || pressed.has('S')) y++;
    const swap = swapQueued;
    const rebellion = rebellionQueued;
    rebellionQueued = false;
    swapQueued = false;
    return {x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), swap, rebellion};
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

  function hexToRgb(color) {
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex.slice(0, 6);
    const n = parseInt(full, 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [212, 195, 148];
  }

  function buildFloor(scene = 'gate') {
    const f = floorCtx;
    let seed = 20261121;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const [tr, tg, tb] = hexToRgb(mapTrim);
    const trim = a => `rgba(${tr},${tg},${tb},${a})`;
    f.setTransform(1, 0, 0, 1, 0, 0);
    const base = f.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, mapTop);
    base.addColorStop(1, mapBottom);
    f.fillStyle = base;
    f.fillRect(0, 0, W, H);
    if (mapArt.complete && mapArt.naturalWidth) {
      const scale = Math.max(W / mapArt.naturalWidth, H / mapArt.naturalHeight);
      f.globalAlpha = .1;
      f.drawImage(mapArt, (W - mapArt.naturalWidth * scale) / 2, (H - mapArt.naturalHeight * scale) / 2, mapArt.naturalWidth * scale, mapArt.naturalHeight * scale);
      f.globalAlpha = 1;
    }
    // Staggered flagstones with worn, uneven tones.
    const rowH = 48;
    for (let y = 36, row = 0; y < H - 36; y += rowH, row++) {
      let x = 36 - (row % 2) * 34;
      while (x < W - 36) {
        const w = 58 + Math.floor(rand() * 4) * 14;
        const x0 = Math.max(36, x), x1 = Math.min(W - 36, x + w);
        f.fillStyle = trim((.025 + rand() * .045).toFixed(3));
        f.fillRect(x0 + 1, y + 1, x1 - x0 - 2, rowH - 2);
        f.fillStyle = 'rgba(0,0,0,.28)';
        f.fillRect(x0, y + rowH - 1.5, x1 - x0, 1.5);
        f.fillRect(x1 - 1.5, y, 1.5, rowH);
        f.fillStyle = trim(.07);
        f.fillRect(x0 + 1, y + 1, x1 - x0 - 2, 1);
        x += w;
      }
    }
    // Imperial road (御道) along the courtyard axis.
    const road = 128;
    f.fillStyle = 'rgba(0,0,0,.18)';
    f.fillRect(W / 2 - road / 2, 36, road, H - 72);
    f.strokeStyle = trim(.26);
    f.lineWidth = 1.5;
    f.strokeRect(W / 2 - road / 2, 36, road, H - 72);
    f.strokeStyle = trim(.12);
    f.lineWidth = 1;
    f.strokeRect(W / 2 - road / 2 + 7, 36, road - 14, H - 72);
    for (let y = 70; y < H - 60; y += 96) { // carved cloud medallions on the road
      f.beginPath();
      f.ellipse(W / 2, y, 22, 12, 0, 0, Math.PI * 2);
      f.moveTo(W / 2 - 12, y); f.quadraticCurveTo(W / 2 - 4, y - 9, W / 2 + 4, y); f.quadraticCurveTo(W / 2 + 10, y + 7, W / 2 + 14, y - 2);
      f.strokeStyle = trim(.16);
      f.stroke();
    }
    // Speckled grit.
    for (let i = 0; i < 2600; i++) {
      f.fillStyle = rand() > .5 ? trim((rand() * .09).toFixed(3)) : `rgba(0,0,0,${(rand() * .22).toFixed(3)})`;
      f.fillRect(rand() * W, rand() * H, 1 + rand() * 1.4, 1 + rand() * 1.4);
    }
    // Walls and colonnades.
    f.strokeStyle = trim(.48);
    f.lineWidth = 2;
    f.strokeRect(22, 22, W - 44, H - 44);
    f.strokeStyle = trim(.18);
    f.lineWidth = 1;
    f.strokeRect(32, 32, W - 64, H - 64);
    for (const x of scene === 'court' ? [] : [82, W - 82]) {
      for (let y = 60; y < H - 50; y += 82) {
        f.fillStyle = 'rgba(0,0,0,.35)';
        f.beginPath(); f.ellipse(x + 3, y + 5, 13, 7, 0, 0, Math.PI * 2); f.fill();
        f.fillStyle = trim(.2);
        f.beginPath(); f.arc(x, y, 10, 0, Math.PI * 2); f.fill();
        f.strokeStyle = trim(.34);
        f.stroke();
      }
    }
    drawSceneDressing(f, scene, trim, rand);
    drawFloorAccents(f, scene);
    // Vignette: corners fall into shadow.
    const v = f.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .28, W / 2, H / 2, Math.hypot(W, H) * .56);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.5)');
    f.fillStyle = v;
    f.fillRect(0, 0, W, H);
    floorDirty = false;
  }

  let builtScene = null;
  function drawFloorAccents(f, scene) {
    const windowLight = {
      gate: [W * .28, .32, .72, '166,215,224'],
      court: [W * .15, .65, .46, '159,209,168'],
      hall: [W * .5, .08, .68, '244,181,100']
    };
    const [x, top, reach, color] = windowLight[scene] || windowLight.gate;
    const y = H * top;
    const glow = f.createRadialGradient(x, y, 12, x, y, H * reach);
    glow.addColorStop(0, `rgba(${color},.22)`);
    glow.addColorStop(1, `rgba(${color},0)`);
    f.fillStyle = glow;
    f.fillRect(0, 0, W, H);

    f.save();
    f.strokeStyle = `rgba(${color},.35)`;
    f.lineWidth = 1.25;
    for (const cornerX of [30, W - 30]) {
      for (const cornerY of [30, H - 30]) {
        const dx = cornerX < W / 2 ? 1 : -1;
        const dy = cornerY < H / 2 ? 1 : -1;
        f.beginPath();
        f.moveTo(cornerX + 42 * dx, cornerY);
        f.lineTo(cornerX, cornerY);
        f.lineTo(cornerX, cornerY + 42 * dy);
        f.moveTo(cornerX + 30 * dx, cornerY + 6 * dy);
        f.lineTo(cornerX + 6 * dx, cornerY + 6 * dy);
        f.lineTo(cornerX + 6 * dx, cornerY + 30 * dy);
        f.stroke();
      }
    }
    f.restore();
  }
  // Edge dressing per floor: 宫门外廊 / 内廷庭院 / 正殿前庭. Kept to the outer band so it never hides play.
  function drawSceneDressing(f, scene, trim, rand) {
    const lacquer = 'rgba(122,38,28,.55)', gold = 'rgba(214,176,98,.5)';
    if (scene === 'gate') {
      // gate towers on the top wall, doors with studs
      for (const cx of [W * .28, W * .72]) {
        f.fillStyle = 'rgba(0,0,0,.35)'; f.fillRect(cx - 62, 6, 124, 30);
        f.fillStyle = lacquer; f.fillRect(cx - 54, 10, 108, 24);
        f.fillStyle = gold;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 9; j++) { f.beginPath(); f.arc(cx - 44 + j * 11, 15 + i * 5.2, 1.1, 0, Math.PI * 2); f.fill(); }
        f.strokeStyle = trim(.45); f.lineWidth = 1.5; f.beginPath(); f.moveTo(cx, 10); f.lineTo(cx, 34); f.stroke();
        f.fillStyle = 'rgba(20,16,12,.8)'; f.beginPath(); f.moveTo(cx - 74, 9); f.quadraticCurveTo(cx, -4, cx + 74, 9); f.lineTo(cx + 66, 13); f.quadraticCurveTo(cx, 2, cx - 66, 13); f.fill();
      }
      // hanging lanterns along the corridor
      for (const x of [82, W - 82]) for (let y = 101; y < H - 60; y += 164) {
        const g = f.createRadialGradient(x, y, 1, x, y, 26); g.addColorStop(0, 'rgba(255,170,90,.32)'); g.addColorStop(1, 'rgba(255,170,90,0)');
        f.fillStyle = g; f.beginPath(); f.arc(x, y, 26, 0, Math.PI * 2); f.fill();
        f.fillStyle = 'rgba(176,58,36,.85)'; f.beginPath(); f.ellipse(x, y, 5.5, 7.5, 0, 0, Math.PI * 2); f.fill();
        f.fillStyle = gold; f.fillRect(x - 3, y - 9, 6, 2); f.fillRect(x - 3, y + 7, 6, 2);
      }
    } else if (scene === 'court') {
      // rockeries and pines in the corners, bronze vats on the long sides
      const rock = (x, y, s) => {
        f.fillStyle = 'rgba(0,0,0,.35)'; f.beginPath(); f.ellipse(x + 4, y + s * .55, s * 1.1, s * .35, 0, 0, Math.PI * 2); f.fill();
        f.fillStyle = 'rgba(96,104,96,.6)'; f.beginPath();
        f.moveTo(x - s, y + s * .5); f.quadraticCurveTo(x - s * 1.1, y - s * .4, x - s * .3, y - s); f.quadraticCurveTo(x + s * .2, y - s * .4, x + s * .5, y - s * .9);
        f.quadraticCurveTo(x + s * 1.1, y - s * .2, x + s, y + s * .5); f.closePath(); f.fill();
        f.strokeStyle = 'rgba(20,24,20,.6)'; f.lineWidth = 1; f.stroke();
        f.fillStyle = 'rgba(10,12,10,.55)';
        for (let i = 0; i < 3; i++) { f.beginPath(); f.ellipse(x - s * .4 + i * s * .4, y - s * .2 + (i % 2) * s * .3, s * .12, s * .18, 0, 0, Math.PI * 2); f.fill(); }
      };
      const pine = (x, y) => {
        f.strokeStyle = 'rgba(60,40,26,.8)'; f.lineWidth = 3; f.beginPath(); f.moveTo(x, y + 18); f.quadraticCurveTo(x - 6, y, x + 4, y - 16); f.stroke();
        f.fillStyle = 'rgba(40,74,52,.7)';
        for (const [dx, dy, r] of [[-10, -10, 11], [8, -16, 12], [0, -26, 9], [14, -4, 8]]) { f.beginPath(); f.ellipse(x + dx, y + dy, r * 1.5, r * .6, 0, 0, Math.PI * 2); f.fill(); }
      };
      rock(70, 78, 20); pine(102, 70); rock(W - 72, H - 76, 22); pine(W - 106, H - 64);
      rock(W - 70, 82, 16); rock(76, H - 80, 17); pine(W - 94, 96);
      for (const x of [74, W - 74]) for (const y of [H * .35, H * .65]) {
        f.fillStyle = 'rgba(0,0,0,.35)'; f.beginPath(); f.ellipse(x + 3, y + 10, 16, 6, 0, 0, Math.PI * 2); f.fill();
        f.fillStyle = 'rgba(92,110,82,.75)'; f.beginPath(); f.ellipse(x, y, 14, 12, 0, 0, Math.PI * 2); f.fill();
        f.strokeStyle = gold; f.lineWidth = 1.2; f.beginPath(); f.ellipse(x, y - 5, 13, 5, 0, 0, Math.PI * 2); f.stroke();
        f.fillStyle = 'rgba(20,30,34,.8)'; f.beginPath(); f.ellipse(x, y - 5, 11, 3.6, 0, 0, Math.PI * 2); f.fill();
      }
    } else {
      // raised hall platform with balustrade along the top, red pillars, incense burners
      f.fillStyle = 'rgba(0,0,0,.32)'; f.fillRect(36, 22, W - 72, 26);
      f.fillStyle = 'rgba(196,186,160,.16)'; f.fillRect(36, 22, W - 72, 20);
      f.strokeStyle = trim(.42); f.lineWidth = 1;
      f.beginPath(); f.moveTo(36, 42); f.lineTo(W - 36, 42); f.stroke();
      for (let x = 44; x < W - 40; x += 22) { f.beginPath(); f.moveTo(x, 24); f.lineTo(x, 42); f.stroke(); f.beginPath(); f.arc(x, 23, 2, 0, Math.PI * 2); f.stroke(); }
      // stairs in the middle of the platform
      for (let i = 0; i < 5; i++) { f.fillStyle = `rgba(210,196,160,${.1 + i * .03})`; f.fillRect(W / 2 - 70 + i * 3, 24 + i * 5, 140 - i * 6, 4); }
      for (const x of [82, W - 82]) for (let y = 60; y < H - 50; y += 82) {
        f.fillStyle = 'rgba(150,40,30,.5)'; f.beginPath(); f.arc(x, y, 7, 0, Math.PI * 2); f.fill();
      }
      for (const x of [W / 2 - 110, W / 2 + 110]) {
        const y = 74;
        f.fillStyle = 'rgba(0,0,0,.4)'; f.beginPath(); f.ellipse(x + 3, y + 10, 18, 6, 0, 0, Math.PI * 2); f.fill();
        f.fillStyle = 'rgba(120,98,60,.85)'; f.beginPath(); f.ellipse(x, y, 13, 10, 0, 0, Math.PI * 2); f.fill();
        f.fillRect(x - 9, y + 6, 3, 7); f.fillRect(x + 6, y + 6, 3, 7);
        f.strokeStyle = gold; f.lineWidth = 1; f.beginPath(); f.ellipse(x, y - 4, 10, 3.5, 0, 0, Math.PI * 2); f.stroke();
        f.strokeStyle = 'rgba(220,210,190,.18)'; f.lineWidth = 2;
        f.beginPath(); f.moveTo(x, y - 8); f.bezierCurveTo(x - 8, y - 22, x + 8, y - 30, x - 2, y - 44); f.stroke();
      }
      // red carpet on the imperial road
      f.fillStyle = 'rgba(120,30,24,.22)'; f.fillRect(W / 2 - 40, 48, 80, H - 84);
      f.strokeStyle = gold; f.lineWidth = 1; f.strokeRect(W / 2 - 36, 48, 72, H - 84);
    }
  }

  function drawBackdrop(time) {
    const scene = run?.scene || 'gate';
    if (floorDirty || builtScene !== scene) { buildFloor(scene); builtScene = scene; }
    ctx.drawImage(floorCanvas, 0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = mapTrim;
    ctx.setLineDash([5, 13]);
    ctx.beginPath();
    ctx.moveTo(105, H / 2);
    ctx.lineTo(W - 105, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const ornamentRadius = 118 + (reducedMotion.matches ? 0 : Math.sin(time * .3) * 3);
    circle(W / 2, H / 2, ornamentRadius, null, mapTrim, 1);
    ctx.restore();
    text(`北齐宫苑 · ${run?.sceneName || '宫门外廊'}`, 47, 48, 'rgba(235,222,190,.48)', 10, 'left', 400);
  }

  // Warm torchlight around the player, with a faint flicker.
  function drawLight(time) {
    const p = run.player;
    const flicker = reducedMotion.matches ? 0 : Math.sin(time * 9.1) * 4 + Math.sin(time * 23.7) * 2;
    const r = engine.FOG.revealRadius + 26 + flicker;
    const g = ctx.createRadialGradient(p.x, p.y - 6, 8, p.x, p.y, r);
    g.addColorStop(0, 'rgba(255,214,150,.1)');
    g.addColorStop(.35, 'rgba(255,196,128,.055)');
    g.addColorStop(.7, 'rgba(255,180,110,.02)');
    g.addColorStop(1, 'rgba(255,170,100,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawHurtVignette() {
    const left = run.flashUntil - run.elapsed;
    if (left <= 0 || left > .3) return;
    const a = Math.min(1, left / .24) * .42;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .32, W / 2, H / 2, Math.hypot(W, H) * .55);
    g.addColorStop(0, 'rgba(140,20,12,0)');
    g.addColorStop(1, `rgba(140,20,12,${a.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- Figure rendering: ink-mural characters with walk cycle, headgear by rank ----
  const motion = new WeakMap();
  const particles = [];
  const floaters = [];
  const rings = [];
  let shake = 0;
  function announce(x, y, label, color) {
    floaters.push({x, y, label, color, life: 0});
    rings.push({x, y, color, life: 0});
    if (floaters.length > 8) floaters.shift();
    if (rings.length > 8) rings.shift();
  }
  function drawAnnouncements(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life += dt;
      if (r.life > .5) { rings.splice(i, 1); continue; }
      const k = r.life / .5;
      ctx.save(); ctx.globalAlpha = (1 - k) * .9; ctx.strokeStyle = r.color; ctx.lineWidth = 2.5 * (1 - k) + .5;
      ctx.beginPath(); ctx.arc(r.x, r.y, 12 + k * 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.life += dt;
      if (f.life > 1.1) { floaters.splice(i, 1); continue; }
      const k = f.life / 1.1;
      const y = f.y - 26 - (reducedMotion.matches ? 0 : k * 26);
      ctx.save();
      ctx.globalAlpha = k < .15 ? k / .15 : 1 - Math.max(0, (k - .6) / .4);
      ctx.font = '700 14px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,12,6,.85)'; ctx.strokeText(f.label, f.x, y);
      ctx.fillStyle = f.color; ctx.fillText(f.label, f.x, y);
      ctx.restore();
    }
  }
  function moveState(entity, time) {
    let m = motion.get(entity);
    if (!m) {
      m = {x: entity.x, y: entity.y, phase: Math.random() * 6, speed: 0, side: 1, shownHp: entity.hp, alive: entity.alive !== false, lastDust: 0, born: run && run.stageElapsed > .6 ? run.elapsed : -9};
      motion.set(entity, m);
      if (m.born > 0 && entity.alive !== false) spawnPuff(entity.x, entity.y + 6, entity.friendly ? 'rgba(150,200,160,.55)' : 'rgba(30,26,22,.7)', 7, .7);
    }
    const dx = entity.x - m.x, dy = entity.y - m.y;
    const step = Math.hypot(dx, dy);
    m.speed = m.speed * .7 + Math.min(step, 6) * .3;
    m.phase += step * .22;
    if (Math.abs(dx) > .05) m.side = dx > 0 ? 1 : -1;
    else if (entity.facing !== undefined) { const c = Math.cos(entity.facing); if (Math.abs(c) > .3) m.side = c > 0 ? 1 : -1; }
    m.x = entity.x; m.y = entity.y;
    m.shownHp += (entity.hp - m.shownHp) * (entity.hp < m.shownHp ? .06 : .3);
    return m;
  }
  function shade(hex, amount) {
    const [r, g, b] = hexToRgb(hex);
    const f = v => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function drawFigure(x, y, r, o, time) {
    const m = o.m;
    const walking = m.speed > .25 && !reducedMotion.matches;
    const swing = walking ? Math.sin(m.phase) : Math.sin(time * 1.6 + m.x * .01) * .15;
    const bob = walking ? Math.abs(Math.sin(m.phase)) * 1.6 : 0;
    ctx.save();
    ctx.translate(x, y);
    // soft ground shadow
    const sh = ctx.createRadialGradient(0, r * .9, 1, 0, r * .9, r * 1.25);
    sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, r * .9, r * 1.25, r * .42, 0, 0, Math.PI * 2); ctx.fill();
    if (o.ghost) ctx.globalAlpha *= .45;
    ctx.translate(0, -bob);
    ctx.scale(m.side, 1);
    const w = r * 1.05, top = -r * .55, hem = r * .95;
    // far sleeve
    ctx.fillStyle = shade(o.robe, -.25);
    ctx.beginPath(); ctx.ellipse(-w * .72, top + r * .55 - swing * 2, r * .3, r * .55, .25 - swing * .25, 0, Math.PI * 2); ctx.fill();
    // robe body with flared, swaying hem
    const g = ctx.createLinearGradient(0, top, 0, hem);
    g.addColorStop(0, shade(o.robe, -.35)); g.addColorStop(.55, o.robe); g.addColorStop(1, shade(o.robe, .12));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * .5, top);
    ctx.quadraticCurveTo(-w * .62, r * .3, -w + swing * 2, hem);
    ctx.quadraticCurveTo(0, hem + r * .16, w + swing * 2, hem);
    ctx.quadraticCurveTo(w * .62, r * .3, w * .5, top);
    ctx.quadraticCurveTo(0, top - r * .14, -w * .5, top);
    ctx.fill();
    ctx.strokeStyle = o.trim; ctx.lineWidth = 1.4; ctx.globalAlpha *= .9;
    ctx.beginPath(); ctx.moveTo(-w + swing * 2, hem); ctx.quadraticCurveTo(0, hem + r * .16, w + swing * 2, hem); ctx.stroke();
    ctx.globalAlpha /= .9;
    // cross collar and sash
    ctx.strokeStyle = shade(o.trim, .15); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-w * .32, top + 1); ctx.lineTo(w * .05, top + r * .42); ctx.lineTo(w * .32, top + 1); ctx.stroke();
    ctx.fillStyle = o.sash;
    ctx.fillRect(-w * .56, top + r * .5, w * 1.12, Math.max(2, r * .14));
    ctx.strokeStyle = o.sash; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-w * .1, top + r * .62); ctx.quadraticCurveTo(-w * .18 - swing * 3, top + r * 1.05, -w * .3 - swing * 4, top + r * 1.35); ctx.stroke();
    // near sleeve
    ctx.fillStyle = shade(o.robe, -.08);
    ctx.beginPath(); ctx.ellipse(w * .7, top + r * .55 + swing * 2, r * .3, r * .56, -.25 + swing * .25, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = o.trim; ctx.lineWidth = .8; ctx.stroke();
    // head
    const hy = top - r * .38, hr = r * .36;
    ctx.fillStyle = o.skin;
    ctx.beginPath(); ctx.arc(hr * .12, hy, hr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1512';
    ctx.beginPath(); ctx.arc(-hr * .05, hy - hr * .12, hr * 1.02, Math.PI * .82, Math.PI * 1.96); ctx.quadraticCurveTo(hr * .2, hy - hr * .55, -hr * .3, hy + hr * .15); ctx.closePath(); ctx.fill();
    ctx.fillRect(hr * .42, hy - hr * .1, hr * .22, hr * .12); // eye
    if (o.head === 'cap') { // gauze cage-cap
      ctx.fillStyle = 'rgba(20,24,22,.55)'; ctx.strokeStyle = 'rgba(15,18,16,.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-hr * 1.05, hy + hr * .35); ctx.lineTo(-hr * .95, hy - hr * 1.55); ctx.quadraticCurveTo(hr * .1, hy - hr * 1.85, hr * 1.15, hy - hr * 1.55); ctx.lineTo(hr * 1.2, hy - hr * .1); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (o.head === 'helmet') { // iron helmet with plume
      ctx.fillStyle = o.helm; ctx.beginPath(); ctx.arc(hr * .1, hy - hr * .15, hr * 1.08, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(hr * 1.2, hy + hr * .25); ctx.lineTo(-hr * 1, hy + hr * .25); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade(o.helm, .3); ctx.lineWidth = .8; ctx.stroke();
      ctx.fillStyle = o.plume; ctx.beginPath(); ctx.moveTo(0, hy - hr * 1.15); ctx.quadraticCurveTo(-hr * .9 - swing * 2, hy - hr * 2.1, -hr * 1.5 - swing * 3, hy - hr * 1.4); ctx.quadraticCurveTo(-hr * .6, hy - hr * 1.55, 0, hy - hr * 1.15); ctx.fill();
      if (o.banner) { // marshal's back banner
        ctx.strokeStyle = '#2b2116'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-w * .45, top + r * .2); ctx.lineTo(-w * .45, top - r * 1.6); ctx.stroke();
        ctx.fillStyle = o.banner; ctx.beginPath(); ctx.moveTo(-w * .45, top - r * 1.6); ctx.quadraticCurveTo(-w * 1.1 - swing * 2, top - r * 1.45, -w * 1.25 - swing * 3, top - r * 1.15); ctx.lineTo(-w * .45, top - r * .9); ctx.closePath(); ctx.fill();
      }
    } else if (o.head === 'crown') { // mian crown with tassels
      ctx.fillStyle = '#1d1712'; ctx.fillRect(-hr * .55, hy - hr * 1.5, hr * 1.3, hr * .7);
      ctx.fillStyle = '#c9a24c'; ctx.save(); ctx.translate(hr * .1, hy - hr * 1.6); ctx.rotate(-.06); ctx.fillRect(-hr * 1.5, -hr * .16, hr * 3, hr * .32); ctx.restore();
      ctx.strokeStyle = '#e3c06a'; ctx.lineWidth = .8;
      for (let i = -3; i <= 3; i++) { const tx = hr * .1 + i * hr * .45; ctx.beginPath(); ctx.moveTo(tx, hy - hr * 1.45); ctx.lineTo(tx + swing, hy - hr * .5); ctx.stroke(); ctx.fillStyle = '#f0d58a'; ctx.beginPath(); ctx.arc(tx + swing, hy - hr * .5, .9, 0, Math.PI * 2); ctx.fill(); }
    } else if (o.head === 'loose') { // prisoner: loose hair down the back
      ctx.strokeStyle = '#15110e'; ctx.lineWidth = hr * .5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-hr * .6, hy); ctx.quadraticCurveTo(-hr * 1.2 - swing * 2, hy + hr * 1.3, -hr * .9 - swing * 3, hy + hr * 2.2); ctx.stroke(); ctx.lineCap = 'butt';
    }
    ctx.restore();
  }
  function drawBlade(x, y, angle, length, color, ring = true) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0);
    const g = ctx.createLinearGradient(0, -2, 0, 2);
    g.addColorStop(0, '#fffbea'); g.addColorStop(.5, color); g.addColorStop(1, '#5d6a63');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(8, -1.8); ctx.lineTo(length - 3, -2); ctx.lineTo(length + 2, 0); ctx.lineTo(length - 3, 1.6); ctx.lineTo(8, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8924f'; ctx.fillRect(6, -3.2, 2, 6.4);
    ctx.strokeStyle = '#3a2a1d'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, 0); ctx.stroke();
    if (ring) { ctx.strokeStyle = '#c9a45e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-2.4, 0, 2.6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function drawPoleaxe(x, y, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0);
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(30, 0); ctx.stroke();
    const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#6b7670'); g.addColorStop(.5, '#f1e9d2'); g.addColorStop(1, '#8c968f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(28, -1); ctx.quadraticCurveTo(30, -13, 20, -12); ctx.quadraticCurveTo(22, -6, 21, -1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(26, 1); ctx.lineTo(23, 7); ctx.lineTo(20, 1); ctx.fill();
    ctx.restore();
  }
  const MAX_PARTICLES = 180;
  function spawnPuff(x, y, color, count = 10, power = 1) {
    if (reducedMotion.matches) count = Math.ceil(count / 3);
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2, s = (18 + Math.random() * 46) * power;
      particles.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, r: 2 + Math.random() * 4 * power, life: 0, max: .45 + Math.random() * .45, color});
    }
  }
  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt; if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .9; p.vy *= .9;
      const k = p.life / p.max;
      ctx.globalAlpha = (1 - k) * .75;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.6), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // New weapons. Each draws pointing along +x after rotation, so pickups and the hand share one sketch.
  function drawWeaponSketch(type, x, y, angle, time = 0, swing = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0);
    const steel = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#7e8983'); g.addColorStop(.5, '#f2ebd6'); g.addColorStop(1, '#8c968f'); return g; };
    if (type === 'dualBlades') {
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(0, side * 5); ctx.rotate(side * (.18 + swing * .5));
        ctx.fillStyle = '#4a2c18'; ctx.fillRect(-5, -1.5, 6, 3);
        ctx.fillStyle = '#c9a24a'; ctx.fillRect(1, -3, 2, 6);
        ctx.fillStyle = steel(3, -3, 3, 3); ctx.beginPath(); ctx.moveTo(3, -2); ctx.quadraticCurveTo(14, -3.5, 20, side * -1.5); ctx.lineTo(3, 2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } else if (type === 'mace') {
      ctx.fillStyle = '#4a2c18'; ctx.fillRect(-6, -2, 9, 4);
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(3, -3.5, 2.5, 7);
      ctx.fillStyle = steel(5, -3, 5, 3); ctx.fillRect(5.5, -2.6, 20, 5.2);
      ctx.strokeStyle = 'rgba(40,40,40,.55)'; ctx.lineWidth = 1;
      for (let k = 9; k < 25; k += 4) { ctx.beginPath(); ctx.moveTo(k, -2.6); ctx.lineTo(k, 2.6); ctx.stroke(); }
      ctx.fillStyle = '#d8d2bf'; ctx.beginPath(); ctx.arc(26, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'halberd') {
      ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(34, 0); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = steel(34, -3, 34, 3); ctx.beginPath(); ctx.moveTo(33, -2.4); ctx.lineTo(46, 0); ctx.lineTo(33, 2.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = steel(24, -12, 30, 0); ctx.beginPath(); ctx.moveTo(26, -1); ctx.quadraticCurveTo(24, -12, 33, -13); ctx.quadraticCurveTo(29, -7, 32, -1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a3352a'; ctx.beginPath(); ctx.moveTo(24, 1); ctx.lineTo(19, 6); ctx.lineTo(22, 1); ctx.fill();
    } else if (type === 'meteor') {
      const spin = time * 9 + swing * 6, r = 9 + swing * 6;
      const bx = Math.cos(spin) * r + 6, by = Math.sin(spin) * r;
      ctx.fillStyle = '#4a2c18'; ctx.fillRect(-4, -1.6, 7, 3.2);
      ctx.strokeStyle = '#a9a28c'; ctx.lineWidth = 1; ctx.setLineDash([2, 1.5]);
      ctx.beginPath(); ctx.moveTo(3, 0); ctx.quadraticCurveTo((3 + bx) / 2, by / 2 + 3, bx, by); ctx.stroke(); ctx.setLineDash([]);
      const g = ctx.createRadialGradient(bx - 1.5, by - 1.5, .5, bx, by, 5); g.addColorStop(0, '#f0e6cc'); g.addColorStop(1, '#5b5a52');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8d2bf'; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * 4.8, by + Math.sin(a) * 4.8, 1, 0, Math.PI * 2); ctx.fill(); }
    } else if (type === 'crossbow') {
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(-8, -2, 26, 4);
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(-2, -1, 4, 6);
      ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(15, -12); ctx.quadraticCurveTo(21, 0, 15, 12); ctx.stroke();
      ctx.strokeStyle = '#efe4c6'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(15, -12); ctx.lineTo(4 + swing * 6, 0); ctx.lineTo(15, 12); ctx.stroke();
      if (swing < .5) { ctx.strokeStyle = '#cdbb8e'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(24, 0); ctx.stroke(); }
    }
    ctx.restore();
  }
  const SKETCHED = new Set(['dualBlades', 'mace', 'halberd', 'meteor', 'crossbow']);
  function drawWeapon(weapon, time) {
    if (weapon.collected) return;
    const lift = Math.sin(time * 3 + weapon.x) * 3;
    const pulse = .5 + Math.sin(time * 4 + weapon.y) * .5;
    ctx.save();
    ctx.translate(weapon.x, weapon.y + lift);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
    glow.addColorStop(0, `rgba(240,205,130,${.32 + pulse * .15})`); glow.addColorStop(1, 'rgba(240,205,130,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(240,210,140,${.25 + pulse * .35})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 15 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
    if (weapon.type === 'bow') {
      ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-4, 0, 12, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#d9b46a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-4, 0, 12, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#efe4c6'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(1.5, -11); ctx.lineTo(1.5, 11); ctx.stroke();
      ctx.strokeStyle = '#cdbb8e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(12, 0); ctx.stroke();
      ctx.fillStyle = '#e6d6aa'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(8, -2.5); ctx.lineTo(8, 2.5); ctx.fill();
    } else if (weapon.type === 'poleaxe') {
      ctx.rotate(-Math.PI / 4);
      ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, -22); ctx.stroke();
      const g = ctx.createLinearGradient(-12, 0, 12, 0); g.addColorStop(0, '#6b7670'); g.addColorStop(.5, '#f1e9d2'); g.addColorStop(1, '#8c968f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(1, -20); ctx.quadraticCurveTo(14, -18, 13, -7); ctx.quadraticCurveTo(7, -10, 1, -9); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-1, -18); ctx.lineTo(-7, -15); ctx.lineTo(-1, -12); ctx.fill();
      ctx.fillStyle = '#a3402f'; ctx.fillRect(-2, -8, 4, 3);
    } else if (weapon.type === 'spear') {
      ctx.restore(); ctx.save(); ctx.translate(weapon.x, weapon.y + lift);
      drawSpear(-14, 10, -Math.PI / 4, 34);
    } else if (SKETCHED.has(weapon.type)) {
      const span = weapon.type === 'halberd' ? 18 : 10;
      drawWeaponSketch(weapon.type, -span * .7, span * .7, -Math.PI / 4, time);
    } else {
      const len = weapon.type === 'longSword' ? 34 : 26;
      drawBlade(-len / 2 + 2, 0, -Math.PI / 4, len, '#b8c2ba');
    }
    ctx.restore();
    const label = weapon.type === 'bow' ? `箭 ×${weapon.arrows}` : engine.MELEE_WEAPONS[weapon.type].label;
    text(label, weapon.x, weapon.y + 29 + lift, '#f0dfb2', 10, 'center', 650);
  }

  function drawHealingItem(item, time) {
    if (item.collected) return;
    const lift = Math.sin(time * 2.6 + item.y) * 2;
    ctx.save();
    ctx.translate(item.x, item.y + lift);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    glow.addColorStop(0, 'rgba(170,215,140,.35)'); glow.addColorStop(1, 'rgba(170,215,140,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    // medicine gourd (药葫芦)
    const g = ctx.createRadialGradient(-3, -2, 1, 0, 2, 12);
    g.addColorStop(0, '#f2dc93'); g.addColorStop(1, '#a8752f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 4, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9e3a2b'; ctx.fillRect(-4.5, -1.5, 9, 2.4);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(-1.6, -12, 3.2, 3.5);
    ctx.strokeStyle = '#9e3a2b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(1, -10); ctx.quadraticCurveTo(7, -11, 6, -4); ctx.stroke();
    ctx.restore();
    text('回血药', item.x, item.y + 25 + lift, '#e4efc4', 10, 'center', 650);
  }

  function drawHealthBar(entity, width, title) {
    const m = motion.get(entity);
    const shown = m ? Math.max(entity.hp, m.shownHp) : entity.hp;
    const x = entity.x - width / 2;
    const y = entity.y - entity.radius * 2.15 - 14;
    const ratio = Math.max(0, entity.hp / entity.maxHp), trail = Math.max(0, Math.min(1, shown / entity.maxHp));
    ctx.fillStyle = 'rgba(8,10,9,.82)';
    roundRect(x - 1.5, y - 1.5, width + 3, 7, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(240,200,140,.55)';
    roundRect(x, y, width * trail, 4, 2); ctx.fill();
    const c = ctx.createLinearGradient(x, 0, x + width, 0);
    if (ratio > .45) { c.addColorStop(0, '#7f9d5f'); c.addColorStop(1, '#b9cf8e'); } else { c.addColorStop(0, '#a8402c'); c.addColorStop(1, '#e08a62'); }
    ctx.fillStyle = c;
    roundRect(x, y, width * ratio, 4, 2); ctx.fill();
    if (title) text(`${title} ${Math.ceil(entity.hp)}/${entity.maxHp}`, entity.x, y - 7, '#f3e8cc', 9, 'center', 650);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, Math.max(0, w), h, Math.min(r, w / 2)); return; }
    ctx.rect(x, y, Math.max(0, w), h);
  }

  const enemyLook = {
    soldier: {robe: '#4d5a52', trim: '#b9aa83', sash: '#7b3a2c', skin: '#c8ab86', head: 'helmet', helm: '#3b4440', plume: '#8e3527'},
    shield: {robe: '#5a5446', trim: '#c7b07c', sash: '#4a2a1e', skin: '#c8ab86', head: 'helmet', helm: '#45403a', plume: '#6d6a5e'},
    archer: {robe: '#4c5a3e', trim: '#b8b487', sash: '#6e4a26', skin: '#c9ad88', head: 'helmet', helm: '#3a3f2f', plume: '#a88a4a'},
    spearman: {robe: '#3f4d5e', trim: '#a9b7c4', sash: '#7b3a2c', skin: '#c8ab86', head: 'helmet', helm: '#2f3a46', plume: '#c64a36'},
    general: {robe: '#7a3b30', trim: '#e0c07c', sash: '#2a2118', skin: '#caa984', head: 'helmet', helm: '#5c4a2c', plume: '#d6a04a', banner: '#c48a2e'},
    marshal: {robe: '#8f6a33', trim: '#f2d48a', sash: '#6b2017', skin: '#cfae86', head: 'helmet', helm: '#2b2620', plume: '#b8322a', banner: '#a3352a'},
    friendly: {robe: '#3f6a56', trim: '#a9dcb0', sash: '#d5c27e', skin: '#c9ad88', head: 'cap'}
  };
  function drawEnemy(enemy, time) {
    if (enemy.hiddenUntil > run.elapsed) return;
    const m = moveState(enemy, time);
    if (!enemy.alive) {
      if (m.alive) { m.alive = false; const big = enemy.type === 'general' || enemy.type === 'marshal'; spawnPuff(enemy.x, enemy.y, enemy.friendly ? 'rgba(120,170,140,.8)' : 'rgba(25,22,20,.85)', big ? 16 : 9, big ? 1.3 : .9); spawnPuff(enemy.x, enemy.y - 6, 'rgba(160,48,34,.7)', 4, .6); }
      return;
    }
    m.alive = true;
    const hurt = enemy.hitUntil > run.elapsed;
    const look = enemy.friendly ? enemyLook.friendly : enemyLook[enemy.type] || enemyLook.soldier;
    const r = enemy.radius;
    const age = run.elapsed - m.born;
    if (age >= 0 && age < .7) { // summoning seal on the floor while the figure fades in
      const k = age / .7;
      ctx.save();
      ctx.globalAlpha = (1 - k) * .9;
      ctx.strokeStyle = enemy.friendly ? '#a9dcb0' : enemy.type === 'general' || enemy.type === 'marshal' ? '#e8b85c' : '#c9a46a';
      ctx.lineWidth = 1.6;
      ctx.translate(enemy.x, enemy.y + r * .9);
      ctx.scale(1, .42);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.2 + k * r * 1.4, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(k * 1.6);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .9, Math.sin(a) * r * .9); ctx.lineTo(Math.cos(a) * (r * 1.6 + k * r), Math.sin(a) * (r * 1.6 + k * r)); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.6);
    } else ctx.save();
    drawFigure(enemy.x, enemy.y, r, {...look, m, ghost: hurt && Math.floor(time * 30) % 2}, time);
    if (hurt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; circle(enemy.x, enemy.y - r * .3, r * 1.1, 'rgba(255,170,120,.18)', null); ctx.restore(); }
    drawEnemyGear(enemy, time);
    ctx.restore();
    if (!enemy.friendly && engine.isOpen(enemy, run.elapsed)) drawOpening(enemy, time);
    const officer = enemy.type === 'general' || enemy.type === 'marshal';
    const named = officer || enemy.friendly || run.elapsed - (m.namedAt ?? -9) < 1.4 || enemy.hp < enemy.maxHp && run.elapsed < enemy.hitUntil + 1.2;
    if (hurt) m.namedAt = run.elapsed;
    drawHealthBar(enemy, enemy.type === 'marshal' ? 66 : enemy.type === 'general' ? 50 : 34, named ? enemy.label : '');
  }

  function drawSpear(x, y, angle, length, shaft = '#6a4a2c') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0);
    ctx.strokeStyle = shaft; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-length * .35, 0); ctx.lineTo(length - 8, 0); ctx.stroke();
    ctx.fillStyle = '#d8ddd4'; ctx.beginPath(); ctx.moveTo(length - 9, -2.6); ctx.lineTo(length + 4, 0); ctx.lineTo(length - 9, 2.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a3352a'; ctx.beginPath(); ctx.moveTo(length - 10, 0); ctx.lineTo(length - 15, -4); ctx.lineTo(length - 13, 0); ctx.lineTo(length - 15, 4); ctx.closePath(); ctx.fill();
    ctx.lineCap = 'butt'; ctx.restore();
  }
  function drawBow(x, y, angle, drawn = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0);
    ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(4, 0, 10, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = '#d9b46a'; ctx.lineWidth = .9; ctx.beginPath(); ctx.arc(4, 0, 10, -1.2, 1.2); ctx.stroke();
    const pull = 7.6 - drawn * 6;
    ctx.strokeStyle = '#efe4c6'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(7.6, -9.3); ctx.lineTo(pull, 0); ctx.lineTo(7.6, 9.3); ctx.stroke();
    if (drawn > 0) { ctx.strokeStyle = '#cdbb8e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pull, 0); ctx.lineTo(18, 0); ctx.stroke(); }
    ctx.restore();
  }
  function drawRoundShield(x, y, r, angle, lowered) {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(-r * .3, -r * .3, 1, 0, 0, r);
    g.addColorStop(0, '#9a6a3a'); g.addColorStop(1, '#4a2c18');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, lowered ? r * .45 : 0, r * (lowered ? .9 : .62), r, angle, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d0a95c'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#e0c07c'; ctx.beginPath(); ctx.arc(0, lowered ? r * .45 : 0, r * .2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Silhouette props per unit: round shield, long pole, bow and quiver, back flags.
  function drawEnemyGear(enemy, time) {
    const r = enemy.radius, f = enemy.facing || 0, t = run.elapsed;
    const hx = enemy.x + Math.cos(f) * 4, hy = enemy.y - r * .1 + Math.sin(f) * 4;
    const tint = enemy.friendly ? '#c6e6b8' : '#c2c9c0';
    if (enemy.type === 'shield' && !enemy.friendly) {
      drawBlade(hx, hy, f, 17, tint, false);
      const open = t < enemy.openUntil, blocked = t - (enemy.blockedAt ?? -9) < .18;
      const sx = enemy.x + Math.cos(f) * r * (open ? .4 : .95), sy = enemy.y + Math.sin(f) * r * .55 - (open ? -2 : 2);
      drawRoundShield(sx, sy, r * .95, f + Math.PI / 2, open);
      if (blocked) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; circle(sx, sy, r * 1.1, 'rgba(255,220,150,.35)', null); ctx.restore(); }
    } else if (enemy.type === 'archer' && !enemy.friendly) {
      // quiver on the back
      ctx.save(); ctx.translate(enemy.x - Math.cos(f) * r * .6, enemy.y - r * .7); ctx.rotate(-.5);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(-3, -8, 6, 14);
      ctx.strokeStyle = '#e6d6aa'; ctx.lineWidth = .9; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 1.6, -8); ctx.lineTo(i * 1.6, -13); ctx.stroke(); }
      ctx.restore();
      const aiming = t < enemy.aimUntil ? 1 - (enemy.aimUntil - t) / .9 : 0;
      drawBow(hx, hy, f, aiming);
    } else if (enemy.type === 'spearman' && !enemy.friendly) {
      const recovering = t < enemy.recoverUntil;
      drawSpear(hx, hy, recovering ? f + .7 : f, 40);
    } else {
      const bladeLength = enemy.type === 'marshal' ? 30 : enemy.type === 'general' ? 25 : 20;
      drawBlade(hx, hy, f, bladeLength, tint, enemy.type === 'general' || enemy.type === 'marshal');
    }
  }
  function drawOpening(enemy, time) {
    const pulse = reducedMotion.matches ? .6 : .5 + Math.sin(time * 14) * .5;
    ctx.save();
    ctx.strokeStyle = `rgba(255,214,120,${.5 + pulse * .4})`; ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 4]);
    circle(enemy.x, enemy.y, enemy.radius + 7, null, ctx.strokeStyle, 1.6);
    ctx.setLineDash([]);
    ctx.restore();
    text('破绽', enemy.x, enemy.y - enemy.radius * 2.15 - 30, '#ffd98a', 10, 'center', 800);
  }

  // Warnings come from run.telegraphs — the same records the engine uses for hits.
  function telegraphPath(t, reach = 1) {
    ctx.beginPath();
    if (t.kind === 'line') {
      const c = Math.cos(t.facing), s = Math.sin(t.facing), hw = t.width / 2, L = t.length * reach;
      ctx.moveTo(t.x - s * hw, t.y + c * hw); ctx.lineTo(t.x - s * hw + c * L, t.y + c * hw + s * L);
      ctx.lineTo(t.x + s * hw + c * L, t.y - c * hw + s * L); ctx.lineTo(t.x + s * hw, t.y - c * hw); ctx.closePath();
    } else if (t.kind === 'fan') {
      ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, t.range * reach, t.facing - t.arc / 2, t.facing + t.arc / 2); ctx.closePath();
    } else {
      ctx.arc(t.x, t.y, t.radius * reach, 0, Math.PI * 2);
    }
  }
  function drawTelegraphs(time) {
    for (const t of run.telegraphs) {
      if (!t.damage && !t.then) continue;
      const span = t.resolveAt - t.startAt;
      const k = t.done ? 1 : Math.min(1, (time - t.startAt) / span);
      const flash = t.done ? Math.max(0, 1 - (time - t.doneAt) / .28) : 0;
      ctx.save();
      // outline: full shape, always visible
      telegraphPath(t);
      const shockwave = t.then === 'shockwave';
      ctx.fillStyle = t.done
        ? `rgba(255,190,140,${(.35 * flash).toFixed(3)})`
        : shockwave ? 'rgba(247,197,116,.18)' : t.owner?.friendly ? 'rgba(75,188,140,.18)' : 'rgba(200,54,36,.12)';
      ctx.fill();
      ctx.strokeStyle = t.done
        ? `rgba(255,220,170,${flash.toFixed(3)})`
        : shockwave ? `rgba(255,207,125,${(.55 + k * .4).toFixed(3)})`
          : `rgba(${t.owner?.friendly ? '111,229,176' : '236,96,70'},${(.5 + k * .45).toFixed(3)})`;
      ctx.lineWidth = t.done ? 2.4 : 1.4;
      if (!t.done && k < .5) ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      // fill grows toward resolution, so the moment of impact is readable
      if (!t.done) {
        telegraphPath(t, t.kind === 'line' ? k : Math.max(.08, k));
        ctx.fillStyle = `rgba(214,62,40,${(.16 + k * .26).toFixed(3)})`;
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawBursts(time) {
    for (const b of run.bursts) {
      const k = Math.min(1, (time - b.startedAt) / (b.until - b.startedAt));
      const color = b.kind === 'phoenix' ? '255,150,70' : b.kind === 'thunder' ? '170,210,255' : b.kind === 'shockwave' ? '244,197,116' : '255,120,90';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(b.x, b.y, b.radius * k * .4, b.x, b.y, b.radius * (.5 + k * .5));
      g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(.85, `rgba(${color},${(.4 * (1 - k)).toFixed(3)})`); g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${color},${(1 - k).toFixed(3)})`; ctx.lineWidth = 3 * (1 - k) + .6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * (.5 + k * .5), 0, Math.PI * 2); ctx.stroke();
      if (b.kind === 'thunder' && !reducedMotion.matches) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + b.x * .01;
          let x = b.x, y = b.y; ctx.moveTo(x, y);
          for (let j = 1; j <= 4; j++) { const d = b.radius * j / 4 * (.5 + k * .5); x = b.x + Math.cos(a + (j % 2 ? .18 : -.18)) * d; y = b.y + Math.sin(a + (j % 2 ? .18 : -.18)) * d; ctx.lineTo(x, y); }
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Comparison tablet over a weapon the player could swap to.
  function drawSwapPrompt(time) {
    const item = run.swapCandidate;
    if (!item) return;
    const next = engine.MELEE_WEAPONS[item.type], cur = engine.MELEE_WEAPONS[run.player.meleeWeapon];
    const lines = [`按 E 换上 ${next.label}`, `伤害 ${next.damage}  间隔 ${next.cooldown}s  距离 ${next.range}`, `${next.note} · 现持${cur.label}`];
    ctx.save();
    ctx.font = '600 11px "Microsoft YaHei", sans-serif';
    const w = Math.max(...lines.map(line => ctx.measureText(line).width)) + 20, h = 52;
    const x = Math.max(8, Math.min(W - w - 8, item.x - w / 2)), y = Math.max(8, item.y - 46 - h);
    ctx.fillStyle = 'rgba(14,12,10,.86)'; roundRect(x, y, w, h, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(232,200,128,.7)'; ctx.lineWidth = 1; roundRect(x + .5, y + .5, w - 1, h - 1, 6); ctx.stroke();
    ctx.restore();
    text(lines[0], x + w / 2, y + 15, '#f3d38a', 12, 'center', 800);
    text(lines[1], x + w / 2, y + 31, '#efe6cf', 10, 'center', 600);
    text(lines[2], x + w / 2, y + 45, 'rgba(236,222,190,.7)', 9, 'center', 500);
  }

  // Boss bar across the top once the emperor engages, with phase-threshold ticks.
  function drawBossBar(time) {
    const boss = run.emperor;
    if (!boss.alive || !boss.engaged) return;
    const m = motion.get(boss);
    const w = Math.min(420, W * .42), x = W / 2 - w / 2, y = 20;
    const ratio = Math.max(0, boss.hp / boss.maxHp), trail = m ? Math.min(1, Math.max(boss.hp, m.shownHp) / boss.maxHp) : ratio;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,7,.8)'; roundRect(x - 4, y - 4, w + 8, 16, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(214,176,98,.6)'; ctx.lineWidth = 1; roundRect(x - 4.5, y - 4.5, w + 9, 17, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(240,200,140,.5)'; roundRect(x, y, w * trail, 8, 2); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#7a1e16'); g.addColorStop(1, '#d4553a');
    ctx.fillStyle = g; roundRect(x, y, w * ratio, 8, 2); ctx.fill();
    for (const at of boss.thresholds) {
      const tx = x + w * at;
      ctx.fillStyle = ratio > at ? '#f3d38a' : 'rgba(243,211,138,.35)';
      ctx.fillRect(tx - 1, y - 5, 2, 18);
      ctx.beginPath(); ctx.moveTo(tx - 4, y - 7); ctx.lineTo(tx + 4, y - 7); ctx.lineTo(tx, y - 2); ctx.fill();
    }
    const state = run.elapsed < boss.wardUntil ? '换阵护体' : engine.isOpen(boss, run.elapsed) ? '破绽' : '';
    const label = `皇帝 · ${boss.phaseName}${state ? ' · ' + state : ''}`;
    const labelScale = W / (canvas.clientWidth || W);
    ctx.font = `800 ${13 * labelScale}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
    const labelWidth = Math.min(ctx.measureText(label).width, 230 * labelScale) + 18 * labelScale;
    const labelHeight = 21 * labelScale;
    const labelTop = y + 13;
    roundRect(W / 2 - labelWidth / 2, labelTop, labelWidth, labelHeight, 4);
    ctx.fillStyle = 'rgba(21,14,10,.9)';
    ctx.fill();
    ctx.strokeStyle = state === '破绽' ? '#ddb46d' : 'rgba(212,177,118,.48)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    text(label, W / 2, labelTop + labelHeight / 2, state === '破绽' ? '#ffd98a' : '#f3e8cc', 13, 'center', 800);
  }

  function drawSwingTelegraph(actor, time, color) {
    if (actor.swingStartedAt === null || actor.swingStartedAt === undefined) return;
    const elapsed = Math.max(0, time - actor.swingStartedAt);
    const windup = actor.swingWindup || .025;
    const progress = Math.min(1, elapsed / (windup + .2));
    const facing = actor.swingFacing ?? actor.facing ?? 0;
    const span = Math.PI * 110 / 360 * (.85 + progress * .15);
    const radius = actor.swingRange || actor.attackRange || 48;
    ctx.save();
    ctx.globalAlpha = elapsed < windup ? .6 : Math.max(.12, .75 - (elapsed - windup) * 2.4);
    const wedge = ctx.createRadialGradient(actor.x, actor.y, radius * .25, actor.x, actor.y, radius);
    wedge.addColorStop(0, 'rgba(0,0,0,0)');
    wedge.addColorStop(.7, color);
    wedge.addColorStop(1, color.replace(/[\d.]+\)$/, '0.75)'));
    ctx.fillStyle = wedge;
    ctx.beginPath();
    ctx.moveTo(actor.x, actor.y);
    ctx.arc(actor.x, actor.y, radius, facing - span, facing + span);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.9)');
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(actor.x, actor.y, radius, facing - span, facing + span); ctx.stroke();
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

  function drawPlayerSweep(time) {
    const player = run.player;
    const finish = weaponEffects[player.swingWeapon];
    if (player.swingStartedAt === null || !finish || player.swingWeapon === 'bow') return;
    const progress = Math.min(1, (time - player.swingStartedAt) / .28);
    const radius = player.swingRange;
    const facing = player.swingFacing;
    const shape = player.swingShape;
    if (player.swingWeapon === 'crossbow') return;
    if (shape?.kind === 'line') { drawThrust(player, shape, progress, finish); return; }
    if (shape?.kind === 'circle') { drawSpin(player, shape, progress, finish); return; }
    const half = shape?.kind === 'fan' ? Math.min(1.55, shape.arc / 2) : 1.15;
    const end = facing - half + Math.min(progress * 2, 1) * half * 2;
    const start = Math.max(facing - half - .1, end - Math.min(1.35, half * 1.2));
    const steps = 22, thick = finish.width * 2.6;
    const fade = Math.max(0, 1 - progress);
    ctx.save();
    // brush crescent: thick at the leading edge, tapering to a dry tail
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = start + (end - start) * t;
      ctx.lineTo(player.x + Math.cos(a) * (radius + thick * .25 * t), player.y + Math.sin(a) * (radius + thick * .25 * t));
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps, a = start + (end - start) * t;
      const w = thick * Math.pow(t, 1.6);
      ctx.lineTo(player.x + Math.cos(a) * (radius - w), player.y + Math.sin(a) * (radius - w));
    }
    ctx.closePath();
    const sx = player.x + Math.cos(start) * radius, sy = player.y + Math.sin(start) * radius;
    const ex = player.x + Math.cos(end) * radius, ey = player.y + Math.sin(end) * radius;
    const g = ctx.createLinearGradient(sx, sy, ex, ey);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, finish.color);
    ctx.globalAlpha = fade * .85;
    ctx.fillStyle = g;
    ctx.fill();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#fffaf0';
    ctx.lineWidth = Math.max(1, finish.width * .45);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(player.x, player.y, radius, Math.max(start, end - .5), end); ctx.stroke();
    ctx.restore();
  }

  function drawSpin(player, shape, progress, finish) {
    const fade = Math.max(0, 1 - progress);
    const lead = player.swingFacing + progress * Math.PI * 2.2;
    ctx.save();
    ctx.globalAlpha = fade * .85;
    ctx.lineCap = 'round';
    for (let k = 0; k < 18; k++) {
      const a0 = lead - k * .2, a1 = a0 - .2;
      ctx.strokeStyle = finish.color; ctx.globalAlpha = fade * .85 * (1 - k / 18);
      ctx.lineWidth = finish.width * (1 - k / 22);
      ctx.beginPath(); ctx.arc(player.x, player.y, shape.radius * .92, a1, a0); ctx.stroke();
    }
    ctx.globalAlpha = fade * .25; ctx.fillStyle = finish.color;
    ctx.beginPath(); ctx.arc(player.x, player.y, shape.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawThrust(player, shape, progress, finish) {
    const fade = Math.max(0, 1 - progress);
    const reach = shape.length * Math.min(1, progress * 3);
    const c = Math.cos(shape.facing), s = Math.sin(shape.facing);
    ctx.save();
    const g = ctx.createLinearGradient(player.x, player.y, player.x + c * shape.length, player.y + s * shape.length);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, finish.color);
    ctx.globalAlpha = fade * .8;
    ctx.fillStyle = g;
    const hw = shape.width / 2 * (1 - progress * .5);
    ctx.beginPath();
    ctx.moveTo(player.x - s * hw * .3, player.y + c * hw * .3);
    ctx.lineTo(player.x + c * reach - s * hw, player.y + s * reach + c * hw);
    ctx.lineTo(player.x + c * (reach + 10), player.y + s * (reach + 10));
    ctx.lineTo(player.x + c * reach + s * hw, player.y + s * reach - c * hw);
    ctx.lineTo(player.x + s * hw * .3, player.y - c * hw * .3);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = fade; ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(player.x + c * reach * .4, player.y + s * reach * .4); ctx.lineTo(player.x + c * (reach + 8), player.y + s * (reach + 8)); ctx.stroke();
    ctx.restore();
  }

  // Derive game events from state changes so the engine stays untouched.
  let eventState = null;
  function snapshot() {
    return {
      hp: run.player.hp, phase: run.phase, layer: run.layer,
      melee: run.player.meleeWeapon, ammo: run.player.bowAmmo,
      alive: run.enemies.reduce((n, e) => n + (e.alive && !e.friendly ? 1 : 0), 0) + (run.emperor.alive ? 1 : 0),
      bossPhase: run.emperor.phase, revives: run.reviveCharges
    };
  }
  function cueEvents() {
    const now = snapshot();
    const before = eventState;
    eventState = now;
    if (!before) return;
    if (now.phase === 'over' && before.phase !== 'over') { audio?.event?.('over'); return; }
    if (now.phase === 'upgrade' && before.phase !== 'upgrade') { audio?.event?.('clear'); return; }
    if (now.phase === 'playing' && before.phase === 'upgrade') { audio?.event?.('levelup'); return; }
    if (now.layer !== before.layer || now.phase !== 'playing') return;
    if (now.revives < before.revives) audio?.event?.('revive');
    else if (now.hp < before.hp - .5) { audio?.event?.('hurt', Math.min(1, (before.hp - now.hp) / 12)); shake = Math.max(shake, 3 + Math.min(6, before.hp - now.hp)); }
    else if (now.hp > before.hp + .5) { audio?.event?.('heal'); announce(run.player.x, run.player.y, `体力 +${Math.round(now.hp - before.hp)}`, '#cfe8a8'); spawnPuff(run.player.x, run.player.y, 'rgba(180,220,140,.6)', 6, .5); }
    if (now.melee !== before.melee && now.melee || now.ammo > before.ammo + .5) {
      audio?.event?.('pickup');
      const label = now.melee !== before.melee && now.melee ? `获得${engine.MELEE_WEAPONS[now.melee]?.label || '兵器'}` : `箭 +${Math.round(now.ammo - before.ammo)}`;
      announce(run.player.x, run.player.y, label, '#f3d38a');
      spawnPuff(run.player.x, run.player.y, 'rgba(240,205,130,.7)', 8, .55);
    }
    if (now.alive < before.alive) audio?.event?.('defeat');
    if (now.bossPhase > before.bossPhase) { audio?.event?.('drum'); shake = Math.max(shake, 7); }
  }

  function cueCombat() {
    const player = run.player;
    for (const cue of run.combatCues) {
      const distance = Math.hypot(cue.x - player.x, cue.y - player.y);
      const gain = Math.max(0, 1 - distance / 350) * (cue.weapon === 'guard' ? .62 : 1);
      audio?.cue(cue.kind, cue.weapon, gain, cue.delay);
      if (cue.kind === 'impact') {
        if (impacts.length === 32) impacts.shift();
        impacts.push({...cue, start: run.elapsed + cue.delay});
      }
    }
  }

  function drawImpacts(time) {
    for (const impact of impacts) {
      const progress = (time - impact.start) / .26;
      if (progress < 0 || progress >= 1) continue;
      const effect = weaponEffects[impact.weapon];
      const {x, y} = impact;
      if (!impact.puffed) { impact.puffed = true; spawnPuff(x, y, 'rgba(150,40,28,.75)', 3, .45); }
      ctx.save();
      ctx.globalAlpha = (1 - progress) * .86;
      circle(x, y, 5 + effect.burst * progress, null, effect.color, effect.width * .9 * (1 - progress) + .4);
      ctx.globalCompositeOperation = 'lighter';
      circle(x, y, 4 + 6 * (1 - progress), `rgba(255,236,190,${(.55 * (1 - progress)).toFixed(3)})`, null);
      ctx.globalCompositeOperation = 'source-over';
      if (!reducedMotion.matches) {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < effect.sparks; i++) {
          const angle = i * Math.PI * 2 / effect.sparks + x * .1;
          const from = 4 + effect.burst * progress;
          const to = from + 9 * (1 - progress);
          ctx.moveTo(x + Math.cos(angle) * from, y + Math.sin(angle) * from);
          ctx.lineTo(x + Math.cos(angle) * to, y + Math.sin(angle) * to);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawArrowEffects(time) {
    for (const arrow of run.projectileEffects) {
      const progress = Math.min(1, (time - arrow.startedAt) / (arrow.until - arrow.startedAt));
      const x = arrow.x1 + (arrow.x2 - arrow.x1) * progress;
      const y = arrow.y1 + (arrow.y2 - arrow.y1) * progress;
      const angle = Math.atan2(arrow.y2 - arrow.y1, arrow.x2 - arrow.x1);
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      if (!reducedMotion.matches) {
        const trail = ctx.createLinearGradient(-38, 0, 0, 0);
        trail.addColorStop(0, 'rgba(247,206,128,0)');
        trail.addColorStop(1, arrow.hostile ? 'rgba(236,110,80,.75)' : 'rgba(247,206,128,.72)');
        ctx.strokeStyle = trail;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(0, 0); ctx.stroke();
      }
      ctx.strokeStyle = '#a77a45'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = '#e9e2cf'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(6, -3.2); ctx.lineTo(7.5, 0); ctx.lineTo(6, 3.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9e3a2b';
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-15, -3.5); ctx.lineTo(-8, -1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-15, 3.5); ctx.lineTo(-8, 1); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawFog() {
    const fog = engine.FOG;
    const columns = Math.ceil(W / fog.cellSize);
    const rows = Math.ceil(H / fog.cellSize);
    if (run.exploredDirty) {
      memoryCtx.clearRect(0, 0, W, H);
      const brush = fogBrush.width, half = brush / 2, centre = fog.cellSize / 2;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          if (run.explored[row * columns + column]) {
            memoryCtx.drawImage(fogBrush, column * fog.cellSize + centre - half, row * fog.cellSize + centre - half, brush, brush);
          }
        }
      }
      run.exploredDirty = false;
    }
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.globalAlpha = 1;
    fogCtx.fillStyle = '#040807';
    fogCtx.fillRect(0, 0, W, H);
    fogCtx.globalCompositeOperation = 'destination-out';
    fogCtx.globalAlpha = .5;
    fogCtx.drawImage(memoryCanvas, 0, 0, W, H);
    fogCtx.globalAlpha = 1;
    const radius = fog.revealRadius;
    const gradient = fogCtx.createRadialGradient(run.player.x, run.player.y, radius - fog.fade * 2.2, run.player.x, run.player.y, radius);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(.55, 'rgba(0,0,0,.92)');
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
    const m = moveState(boss, time);
    if (!boss.alive) {
      if (m.alive) { m.alive = false; spawnPuff(boss.x, boss.y, 'rgba(201,162,76,.85)', 24, 1.6); spawnPuff(boss.x, boss.y, 'rgba(25,22,20,.85)', 16, 1.3); shake = Math.max(shake, 9); }
      const pulse = .5 + Math.sin(time * 2.5) * .5;
      circle(boss.x, boss.y, 30 + pulse * 3, 'rgba(219,190,119,.1)', `rgba(232,200,128,${.4 + pulse * .3})`, 1.5);
      text('关底已破', boss.x, boss.y + 1, '#f0d690', 12, 'center', 700);
      return;
    }
    m.alive = true;
    const hurt = boss.hitUntil > run.elapsed;
    if (boss.dash && !reducedMotion.matches) spawnPuff(boss.x, boss.y + 10, 'rgba(60,40,30,.5)', 1, .4);
    if (boss.phase > 0) {
      const a = .2 + boss.phase * .06 + (reducedMotion.matches ? 0 : Math.sin(time * 6) * .1);
      const g = ctx.createRadialGradient(boss.x, boss.y, 10, boss.x, boss.y, 54);
      g.addColorStop(0, `rgba(220,90,60,${a})`); g.addColorStop(1, 'rgba(220,90,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(boss.x, boss.y, 54, 0, Math.PI * 2); ctx.fill();
    }
    drawFigure(boss.x, boss.y, boss.radius || 24, {robe: '#6e2a20', trim: '#e8c46a', sash: '#d2a548', skin: '#d2b48c', head: 'crown', m, ghost: hurt && Math.floor(time * 30) % 2}, time);
    if (run.elapsed < boss.wardUntil) {
      ctx.save(); ctx.strokeStyle = 'rgba(243,211,138,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(boss.x, boss.y - 4, 36, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    } else if (engine.isOpen(boss, run.elapsed)) drawOpening(boss, time);
    if (!boss.engaged) drawHealthBar(boss, 78, '皇帝');
  }

  function drawPlayer(time) {
    const player = run.player;
    const m = moveState(player, time);
    const hurt = run.flashUntil > run.elapsed;
    if (m.speed > .9 && run.elapsed - m.lastDust > .14) { m.lastDust = run.elapsed; spawnPuff(player.x - m.side * 6, player.y + 15, 'rgba(205,190,150,.35)', 2, .35); }
    const ring = ctx.createRadialGradient(player.x, player.y + 10, 8, player.x, player.y + 10, 30);
    ring.addColorStop(0, hurt ? 'rgba(230,110,80,.28)' : 'rgba(240,215,150,.18)'); ring.addColorStop(1, 'rgba(240,215,150,0)');
    ctx.fillStyle = ring; ctx.beginPath(); ctx.ellipse(player.x, player.y + 12, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
    drawFigure(player.x, player.y, 18, {robe: '#d9d2bf', trim: '#8c7b5c', sash: '#6f5b3e', skin: '#d2b48c', head: 'loose', m, ghost: hurt && Math.floor(time * 22) % 2}, time);
    if (player.meleeWeapon === 'spear') {
      const thrust = player.swingStartedAt !== null && player.swingWeapon === 'spear' ? Math.sin(Math.min(1, (time - player.swingStartedAt) / .22) * Math.PI) * 14 : 0;
      drawSpear(player.x + Math.cos(player.facing || 0) * (5 + thrust), player.y - 2 + Math.sin(player.facing || 0) * (5 + thrust), player.facing, 42);
    } else if (SKETCHED.has(player.meleeWeapon)) {
      const swinging = player.swingStartedAt !== null && player.swingWeapon === player.meleeWeapon;
      const swing = swinging ? Math.sin(Math.min(1, (time - player.swingStartedAt) / .28) * Math.PI) : 0;
      const push = player.meleeWeapon === 'halberd' ? swing * 12 : 0;
      drawWeaponSketch(player.meleeWeapon, player.x + Math.cos(player.facing || 0) * (5 + push), player.y - 2 + Math.sin(player.facing || 0) * (5 + push), player.facing, time, swing);
    } else if (player.meleeWeapon === 'poleaxe') {
      drawPoleaxe(player.x + Math.cos(player.facing || 0) * 5, player.y - 2 + Math.sin(player.facing || 0) * 5, player.facing);
    } else if (player.meleeWeapon) {
      const len = player.meleeWeapon === 'longSword' ? 27 : 22;
      drawBlade(player.x + Math.cos(player.facing || 0) * 5, player.y - 2 + Math.sin(player.facing || 0) * 5, player.facing, len, '#d4dbd2');
    } else if (player.bowAmmo > 0) {
      ctx.save(); ctx.translate(player.x, player.y - 2); ctx.rotate(player.facing || 0);
      ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(12, 0, 10, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#d9b46a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(12, 0, 10, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#efe4c6'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(16.2, -9.1); ctx.lineTo(16.2, 9.1); ctx.stroke();
      ctx.restore();
    }
    text('被囚者', player.x, player.y + 34, '#efe6cf', 10, 'center', 650);
  }


  // ---- Stage banner, low-health pulse and minimap ----
  const numerals = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function layerName(n) {
    if (n <= 10) return numerals[n];
    if (n < 20) return '十' + numerals[n - 10];
    const tens = Math.floor(n / 10), ones = n % 10;
    return (tens < 10 ? numerals[tens] : String(tens)) + '十' + (ones ? numerals[ones] : '');
  }
  function drawStageBanner() {
    const t = run.stageElapsed;
    if (t > 2.6 || run.phase !== 'playing') return;
    const alpha = t < .35 ? t / .35 : t > 1.9 ? Math.max(0, (2.6 - t) / .7) : 1;
    const rise = reducedMotion.matches ? 0 : (1 - Math.min(1, t / .5)) * 12;
    ctx.save();
    ctx.globalAlpha = alpha;
    const band = ctx.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, 'rgba(10,12,11,0)'); band.addColorStop(.25, 'rgba(10,12,11,.78)'); band.addColorStop(.75, 'rgba(10,12,11,.78)'); band.addColorStop(1, 'rgba(10,12,11,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, H / 2 - 62 + rise, W, 112);
    ctx.strokeStyle = 'rgba(214,182,120,.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * .3, H / 2 - 56 + rise); ctx.lineTo(W * .7, H / 2 - 56 + rise); ctx.moveTo(W * .3, H / 2 + 44 + rise); ctx.lineTo(W * .7, H / 2 + 44 + rise); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f2dfae';
    ctx.font = '600 44px "STSong", "Songti SC", "Noto Serif SC", "SimSun", serif';
    ctx.fillText(`第${layerName(run.layer)}层`, W / 2 - 18, H / 2 - 12 + rise);
    // vermilion seal
    const sx = W / 2 + ctx.measureText(`第${layerName(run.layer)}层`).width / 2 + 4, sy = H / 2 - 30 + rise;
    ctx.fillStyle = '#a3352a'; ctx.fillRect(sx, sy, 30, 34);
    ctx.strokeStyle = '#f5e2c0'; ctx.lineWidth = 1.4; ctx.strokeRect(sx + 3, sy + 3, 24, 28);
    ctx.fillStyle = '#fbeedd'; ctx.font = '600 18px "STSong", "Songti SC", serif'; ctx.fillText('宫', sx + 15, sy + 18);
    ctx.font = '500 13px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(236,222,190,.85)';
    const intro = {1: '寻找武器 · 击败皇帝方可前进', 2: '盾兵登场 · 绕到背后或等它挥盾', 3: '弓手登场 · 看见红线就横移', 4: '枪兵登场 · 躲开冲刺再反击'}[run.layer] || '大将军镇守 · 盾阵弓阵枪阵';
    ctx.fillText(`${run.sceneName} · ${intro}`, W / 2, H / 2 + 28 + rise);
    ctx.restore();
  }
  function drawLowHealth(time) {
    const ratio = run.player.hp / run.player.maxHp;
    if (ratio > .3 || run.phase !== 'playing') return;
    const beat = reducedMotion.matches ? .5 : Math.pow(Math.max(0, Math.sin(time * 5.2)), 6);
    const a = (.16 + beat * .22) * (1 - ratio / .3 * .5);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .38, W / 2, H / 2, Math.hypot(W, H) * .56);
    g.addColorStop(0, 'rgba(120,18,10,0)'); g.addColorStop(1, `rgba(120,18,10,${a.toFixed(3)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const mapCanvas = document.createElement('canvas');
  const mapCtx = mapCanvas.getContext('2d');
  let mapStamp = -1;
  function drawMinimap() {
    const fog = engine.FOG, cols = Math.ceil(W / fog.cellSize), rows = Math.ceil(H / fog.cellSize);
    const mw = 132, mh = Math.round(mw * H / W), x0 = W - mw - 22, y0 = H - mh - 58;
    if (mapCanvas.width !== cols) { mapCanvas.width = cols; mapCanvas.height = rows; mapStamp = -1; }
    let count = 0;
    for (let i = 0; i < run.explored.length; i++) count += run.explored[i];
    if (count !== mapStamp) {
      mapStamp = count;
      const img = mapCtx.createImageData(cols, rows);
      for (let i = 0; i < run.explored.length; i++) {
        const on = run.explored[i];
        img.data[i * 4] = on ? 120 : 10; img.data[i * 4 + 1] = on ? 104 : 12; img.data[i * 4 + 2] = on ? 76 : 11; img.data[i * 4 + 3] = on ? 220 : 170;
      }
      mapCtx.putImageData(img, 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = .9;
    ctx.fillStyle = 'rgba(8,10,9,.7)'; ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mapCanvas, x0, y0, mw, mh);
    ctx.strokeStyle = 'rgba(214,182,120,.55)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 4.5, y0 - 4.5, mw + 9, mh + 9);
    const px = x0 + run.player.x / W * mw, py = y0 + run.player.y / H * mh;
    ctx.fillStyle = '#f5ead0'; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fill();
    const boss = run.emperor;
    const bi = Math.floor(boss.y / fog.cellSize) * cols + Math.floor(boss.x / fog.cellSize);
    if (boss.alive && run.explored[bi]) { ctx.fillStyle = '#d24a35'; ctx.beginPath(); ctx.arc(x0 + boss.x / W * mw, y0 + boss.y / H * mh, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    text('宫苑舆图', x0 + mw / 2, y0 - 11, 'rgba(232,214,170,.75)', 9, 'center', 600);
    ctx.restore();
  }

  let lastDraw = performance.now();
  function draw() {
    const nowMs = performance.now();
    const dt = Math.min(.05, (nowMs - lastDraw) / 1000);
    lastDraw = nowMs;
    let sx = 0, sy = 0;
    if (shake > .05 && !reducedMotion.matches && mode === 'playing') { sx = (Math.random() - .5) * shake; sy = (Math.random() - .5) * shake; }
    shake *= .86;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, sx * canvas.width / W, sy * canvas.height / H);
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
    drawTelegraphs(time);
    drawPlayerSweep(time);
    for (const enemy of run.enemies) drawEnemy(enemy, time);
    drawEmperor(time);
    drawPlayer(time);
    drawArrowEffects(time);
    drawBursts(time);
    drawImpacts(time);
    drawParticles(mode === 'playing' ? dt : 0);
    drawAnnouncements(mode === 'playing' ? dt : 0);
    if (run.hitText && run.hitText.start <= run.elapsed && run.hitText.until > run.elapsed) {
      const progress = 1 - (run.hitText.until - run.elapsed) / .72;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - progress) * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,14,8,.85)';
      ctx.font = `800 ${17 + (1 - progress) * 4}px "Microsoft YaHei", sans-serif`; ctx.textAlign = 'center';
      ctx.strokeText(run.hitText.value, run.hitText.x, run.hitText.y - 30 - progress * 20);
      ctx.fillStyle = '#ffe09a'; ctx.fillText(run.hitText.value, run.hitText.x, run.hitText.y - 30 - progress * 20);
      ctx.restore();
    }
    drawLight(time);
    drawFog();
    drawLowHealth(time);
    drawHurtVignette();
    drawSwapPrompt(time);
    drawMinimap();
    drawBossBar(time);
    drawStageBanner();
    text('未探索区域被黑雾遮挡', W - 28, 48, 'rgba(226,220,197,.68)', 10, 'right', 500);
    if (run.phase === 'upgrade') {
      ctx.fillStyle = 'rgba(213,190,130,.8)';
      ctx.fillRect(W / 2 - 1, H / 2 - 30, 2, 60);
      text('请选择天赋，暂停期间不计时', W / 2, H / 2 + 47, '#ecd69e', 13, 'center', 700);
    }
  }

  function frame(now) {
    const dt = Math.min(Math.max(0, (now - priorFrame) / 1000), .05);
    priorFrame = now;
    if (mode === 'playing' && run) {
      engine.advance(run, moveVector(), dt);
      for (let i = impacts.length - 1; i >= 0; i--) {
        if (run.elapsed - impacts[i].start >= .26) impacts.splice(i, 1);
      }
      cueCombat();
      cueEvents();
      updateHud();
      updateSwapButton();
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
    if (action === 'rebellion' && !skillButton.disabled) {
      rebellionQueued = true;
      canvas.focus({preventScroll:true});
    }
    if (action === 'swap' && mode === 'playing') { swapQueued = true; canvas.focus({preventScroll: true}); }
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
      impacts.length = 0;
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
    if (!upgrade) return;
    const box = upgrade.parentElement;
    if (reducedMotion.matches || !box || box.dataset.choosing) { if (!box?.dataset.choosing) handleAction('', upgrade); return; }
    // Brief flourish: the chosen tablet lifts and glows, the others fall away, then the choice applies.
    box.dataset.choosing = '1';
    upgrade.classList.add('is-chosen');
    for (const other of box.querySelectorAll('[data-game-upgrade]')) if (other !== upgrade) other.classList.add('is-dismissed');
    setTimeout(() => { delete box.dataset.choosing; handleAction('', upgrade); }, 360);
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
    if (event.key.toLowerCase() === 'q' && !event.repeat && !event.target.closest?.('input, textarea')) {
      handleAction('rebellion');
      return;
    }
    if ((event.key === 'e' || event.key === 'E') && mode === 'playing' && !(event.target instanceof Element && event.target.closest('input'))) {
      swapQueued = true;
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
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
