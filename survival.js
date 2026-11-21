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
    const meleeBonus = engine.damageBonus(run, 'sword');
    const bowBonus = engine.damageBonus(run, 'bow');
    const mutiny = run.talents.mutiny;
    const next = `${run.layer}|${run.level}|${run.score}|${Math.ceil(run.player.hp)}|${run.player.hp}|${run.player.maxHp}|${weapon}|${run.player.bowAmmo}|${meleeBonus}|${bowBonus}|${mutiny}`;
    if (next === lastHud) return;
    $('[data-hud-layer]').textContent = String(run.layer);
    $('[data-hud-level]').textContent = run.layer > 5 ? '5 · 进阶' : `${run.level} / 5`;
    $('[data-hud-score]').textContent = run.score.toLocaleString('zh-CN');
    $('[data-hud-weapon]').textContent = weapon;
    $('[data-hud-arrows]').textContent = String(run.player.bowAmmo);
    $('[data-hud-strength]').hidden = !meleeBonus;
    if (meleeBonus) $('[data-hud-strength] b').textContent = meleeBonus === bowBonus
      ? `+${meleeBonus}%` : `近战 +${meleeBonus}% · 弓箭 +${bowBonus}%`;
    $('[data-hud-mutiny]').hidden = !mutiny;
    if (mutiny) $('[data-hud-mutiny] b').textContent = `${mutiny} 名/秒`;
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
    const ranks = {basic: '基础加成', common: '普通天赋', rare: '稀有天赋', epic: '史诗天赋'};
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

  function resetHud() {
    $('[data-hud-layer]').textContent = '—';
    $('[data-hud-level]').textContent = '— / 5';
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
    if (mode === 'over') return;
    mode = 'over';
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

  function pauseGame() {
    if (mode !== 'playing') return;
    mode = 'paused';
    audio?.setPlaying(false);
    pressed.clear();
    stickVector = {x: 0, y: 0};
    showOnly('pause');
    setLive('已暂停，暂停期间不计时。');
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    mode = 'playing';
    audio?.setPlaying(true);
    showOnly(run?.phase === 'upgrade' ? 'upgrade' : null);
    lastMessage = '';
    setLive(run?.phase === 'upgrade' ? '请选择移速或闪避加成。' : '继续闯关。');
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

  function hexToRgb(color) {
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex.slice(0, 6);
    const n = parseInt(full, 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [212, 195, 148];
  }

  function buildFloor() {
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
    for (const x of [82, W - 82]) {
      for (let y = 60; y < H - 50; y += 82) {
        f.fillStyle = 'rgba(0,0,0,.35)';
        f.beginPath(); f.ellipse(x + 3, y + 5, 13, 7, 0, 0, Math.PI * 2); f.fill();
        f.fillStyle = trim(.2);
        f.beginPath(); f.arc(x, y, 10, 0, Math.PI * 2); f.fill();
        f.strokeStyle = trim(.34);
        f.stroke();
      }
    }
    // Vignette: corners fall into shadow.
    const v = f.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .28, W / 2, H / 2, Math.hypot(W, H) * .56);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.5)');
    f.fillStyle = v;
    f.fillRect(0, 0, W, H);
    floorDirty = false;
  }

  function drawBackdrop(time) {
    if (floorDirty) buildFloor();
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
    circle(W / 2, H / 2, 118 + Math.sin(time * .3) * 3, null, mapTrim, 1);
    ctx.restore();
    text('北齐宫苑 · 游戏示意地图', 47, 48, 'rgba(235,222,190,.48)', 10, 'left', 400);
  }

  // Warm torchlight around the player, with a faint flicker.
  function drawLight(time) {
    const p = run.player;
    const flicker = reducedMotion.matches ? 0 : Math.sin(time * 9.1) * 4 + Math.sin(time * 23.7) * 2;
    const r = engine.FOG.revealRadius + 26 + flicker;
    const g = ctx.createRadialGradient(p.x, p.y - 6, 8, p.x, p.y, r);
    g.addColorStop(0, 'rgba(255,214,150,.16)');
    g.addColorStop(.5, 'rgba(255,190,120,.07)');
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
  let shake = 0;
  function moveState(entity, time) {
    let m = motion.get(entity);
    if (!m) { m = {x: entity.x, y: entity.y, phase: Math.random() * 6, speed: 0, side: 1, shownHp: entity.hp, alive: entity.alive !== false, lastDust: 0}; motion.set(entity, m); }
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
  function spawnPuff(x, y, color, count = 10, power = 1) {
    if (reducedMotion.matches) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
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
    text(`${title} ${Math.ceil(entity.hp)}/${entity.maxHp}`, entity.x, y - 7, '#f3e8cc', 9, 'center', 650);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, Math.max(0, w), h, Math.min(r, w / 2)); return; }
    ctx.rect(x, y, Math.max(0, w), h);
  }

  const enemyLook = {
    soldier: {robe: '#4d5a52', trim: '#b9aa83', sash: '#7b3a2c', skin: '#c8ab86', head: 'helmet', helm: '#3b4440', plume: '#8e3527'},
    general: {robe: '#7a3b30', trim: '#e0c07c', sash: '#2a2118', skin: '#caa984', head: 'helmet', helm: '#5c4a2c', plume: '#d6a04a'},
    marshal: {robe: '#8f6a33', trim: '#f2d48a', sash: '#6b2017', skin: '#cfae86', head: 'helmet', helm: '#2b2620', plume: '#b8322a', banner: '#a3352a'},
    friendly: {robe: '#3f6a56', trim: '#a9dcb0', sash: '#d5c27e', skin: '#c9ad88', head: 'cap'}
  };
  function drawEnemy(enemy, time) {
    const m = moveState(enemy, time);
    if (!enemy.alive) {
      if (m.alive) { m.alive = false; spawnPuff(enemy.x, enemy.y, enemy.friendly ? 'rgba(120,170,140,.8)' : 'rgba(25,22,20,.85)', enemy.type === 'soldier' ? 9 : 16, enemy.type === 'soldier' ? .9 : 1.3); spawnPuff(enemy.x, enemy.y - 6, 'rgba(160,48,34,.7)', 4, .6); }
      return;
    }
    m.alive = true;
    const hurt = enemy.hitUntil > run.elapsed;
    const look = enemy.friendly ? enemyLook.friendly : enemyLook[enemy.type] || enemyLook.soldier;
    const r = enemy.radius;
    drawFigure(enemy.x, enemy.y, r, {...look, m, ghost: hurt && Math.floor(time * 30) % 2}, time);
    if (hurt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; circle(enemy.x, enemy.y - r * .3, r * 1.1, 'rgba(255,170,120,.18)', null); ctx.restore(); }
    const bladeLength = enemy.type === 'marshal' ? 30 : enemy.type === 'general' ? 25 : 20;
    drawBlade(enemy.x + Math.cos(enemy.facing || 0) * 4, enemy.y - r * .1 + Math.sin(enemy.facing || 0) * 4, enemy.facing, bladeLength, enemy.friendly ? '#c6e6b8' : '#c2c9c0', enemy.type !== 'soldier');
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

  function drawPlayerSweep(time) {
    const player = run.player;
    const finish = weaponEffects[player.swingWeapon];
    if (player.swingStartedAt === null || !finish || player.swingWeapon === 'bow') return;
    const progress = Math.min(1, (time - player.swingStartedAt) / .28);
    const radius = player.swingRange;
    const facing = player.swingFacing;
    const end = facing - 1.15 + Math.min(progress * 2, 1) * 2.3;
    const start = Math.max(facing - 1.25, end - 1.3);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = finish.color;
    ctx.globalAlpha = (1 - progress) * .28;
    ctx.lineWidth = finish.width * 3.1;
    ctx.beginPath(); ctx.arc(player.x, player.y, radius - finish.width, start, end); ctx.stroke();
    ctx.globalAlpha = (1 - progress) * .98;
    ctx.lineWidth = finish.width;
    ctx.beginPath(); ctx.arc(player.x, player.y, radius, start, end); ctx.stroke();
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
    else if (now.hp > before.hp + .5) audio?.event?.('heal');
    if (now.melee !== before.melee && now.melee || now.ammo > before.ammo + .5) audio?.event?.('pickup');
    if (now.alive < before.alive) audio?.event?.('defeat');
    if (now.bossPhase === 2 && before.bossPhase !== 2) { audio?.event?.('drum'); shake = Math.max(shake, 7); }
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
      ctx.save();
      ctx.globalAlpha = (1 - progress) * .86;
      circle(x, y, 5 + effect.burst * progress, null, effect.color, effect.width * .5);
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
        trail.addColorStop(1, 'rgba(247,206,128,.72)');
        ctx.strokeStyle = trail;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(0, 0); ctx.stroke();
      }
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
    if (boss.phase === 2) {
      const a = .28 + Math.sin(time * 6) * .12;
      const g = ctx.createRadialGradient(boss.x, boss.y, 10, boss.x, boss.y, 54);
      g.addColorStop(0, `rgba(220,90,60,${a})`); g.addColorStop(1, 'rgba(220,90,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(boss.x, boss.y, 54, 0, Math.PI * 2); ctx.fill();
    }
    drawFigure(boss.x, boss.y, boss.radius || 24, {robe: '#6e2a20', trim: '#e8c46a', sash: '#d2a548', skin: '#d2b48c', head: 'crown', m, ghost: hurt && Math.floor(time * 30) % 2}, time);
    drawHealthBar(boss, 78, boss.phase === 2 ? '皇帝 · 震怒' : '皇帝');
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
    if (player.meleeWeapon) {
      const len = player.meleeWeapon === 'poleaxe' ? 30 : player.meleeWeapon === 'longSword' ? 27 : 22;
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
    if (run.emperor.alive) drawSwingTelegraph(run.emperor, time, 'rgba(224,95,72,.36)');
    drawPlayerSweep(time);
    for (const enemy of run.enemies) drawEnemy(enemy, time);
    drawEmperor(time);
    drawPlayer(time);
    drawArrowEffects(time);
    drawImpacts(time);
    drawParticles(mode === 'playing' ? dt : 0);
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
    drawHurtVignette();
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
      for (let i = impacts.length - 1; i >= 0; i--) {
        if (run.elapsed - impacts[i].start >= .26) impacts.splice(i, 1);
      }
      cueCombat();
      cueEvents();
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
