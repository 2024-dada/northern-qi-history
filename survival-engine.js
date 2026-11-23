/* Deterministic rules for the standalone game. */
(function attach(root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.SURVIVAL_ENGINE = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createEngine() {
  'use strict';

  const WORLD = Object.freeze({width: 1100, height: 640, margin: 46});
  const FOG = Object.freeze({cellSize: 24, revealRadius: 158, fade: 28});
  const DEG = Math.PI / 180;
  // Each weapon owns one hit shape. The same shape is drawn on screen and used
  // for the hit test, so what the player sees is exactly what lands.
  const MELEE_WEAPONS = Object.freeze({
    sword: {label: '宝剑', range: 52, damage: 18, cooldown: .5, shape: 'single', note: '出手最快，只打最近一人'},
    longSword: {label: '长剑', range: 72, damage: 26, cooldown: .75, shape: 'fan', arc: 120 * DEG, note: '120° 扇面挥砍'},
    poleaxe: {label: '长柄斧', range: 82, damage: 35, cooldown: 1.15, shape: 'fan', arc: 180 * DEG, note: '180° 半圆重劈'},
    spear: {label: '长枪', range: 110, damage: 30, cooldown: .95, shape: 'line', width: 24, pierce: 2, note: '直线突刺，贯穿两人'},
    dualBlades: {label: '双刀', range: 48, damage: 10, cooldown: .34, shape: 'twin', arc: 140 * DEG, note: '左右开弓，同时砍最近两人'},
    mace: {label: '铁锏', range: 56, damage: 34, cooldown: 1.25, shape: 'fan', arc: 90 * DEG, stun: .6, breaker: true, note: '无视盾牌，砸晕 0.6 秒'},
    halberd: {label: '戟', range: 96, damage: 27, cooldown: 1, shape: 'line', width: 40, pierce: 3, knockback: 26, note: '宽刃直刺，贯穿三人并击退'},
    meteor: {label: '流星锤', range: 74, damage: 22, cooldown: 1.1, shape: 'circle', note: '360° 抡圈，周身一圈全中'},
    crossbow: {label: '连弩', range: 220, damage: 16, cooldown: .85, shape: 'line', width: 12, pierce: 3, bolt: true, note: '远射弩矢，直线贯穿三人，不耗箭'}
  });
  const MELEE_POOL_EARLY = ['sword', 'longSword', 'poleaxe', 'dualBlades', 'mace'];
  const MELEE_POOL_LATE = [...MELEE_POOL_EARLY, 'spear', 'halberd', 'meteor', 'crossbow'];
  const SWAP_RADIUS = 34;
  const BOW_RANGE = 240;
  const ARROW_DAMAGE = Object.freeze({soldier: 17, shield: 13, archer: 20, spearman: 17, general: 20, marshal: 25, emperor: 13});
  const ARROW_TRAVEL = .18;
  const MUTINY_INTERVAL = 5;
  const REINFORCE_INTERVAL = 6;
  const REINFORCE_CAP = 3;
  const TALENT_WEIGHTS = Object.freeze({common: 45, rare: 30, epic: 18, legendary: 7});
  const TALENT_CARDS = {
    common: [
      {id: 'vitality', rarity: 'common', title: '强健体魄', description: '最大体力 +15，并立即恢复 15 点。'},
      {id: 'regeneration', rarity: 'common', title: '调息', description: '每点每秒恢复 0.75 点体力。'},
      {id: 'swift', rarity: 'common', title: '轻身', description: '每点移动速度 +20，方便穿过宫道。'},
      {id: 'evasion', rarity: 'common', title: '身法', description: '每点闪避率提高：剩余未闪避部分的 12%（叠得越多越接近但不会到 100%）。'},
      {id: 'herbal', rarity: 'common', title: '识药', description: '每点让回血药多恢复 10 点体力。'},
      {id: 'steady', rarity: 'common', title: '稳步', description: '每点让火焰、犬、蝎等刑区伤害降低 20%（最多 60%）。'}
    ],
    rare: [
      {id: 'strength', rarity: 'rare', title: '力量', description: '每点让本局近战和弓箭伤害各提高 20%。'},
      {id: 'startSword', rarity: 'rare', title: '佩剑随行', description: '每层自带宝剑，每点近战伤害 +10%。'},
      {id: 'startSpear', rarity: 'rare', title: '枪不离身', description: '每层自带长枪，每点近战伤害 +10%。'},
      {id: 'startBow', rarity: 'rare', title: '备箭', description: '每层自带弓，每点在该层开始时提供 10 支箭。'},
      {id: 'swiftBlade', rarity: 'rare', title: '快刀', description: '每点让近战出手间隔缩短 8%（最多 40%）。'},
      {id: 'reach', rarity: 'rare', title: '臂展', description: '每点让所有近战武器的攻击半径 / 长度 +12%（最多 +100%）。'},
      {id: 'counter', rarity: 'rare', title: '见隙', description: '每点让你对破绽中的敌人（盾兵收盾、枪兵收势、皇帝喘息）多造成 35% 伤害。'}
    ],
    epic: [
      {id: 'startPoleaxe', rarity: 'epic', title: '长柄重器', description: '每层自带长柄斧，每点近战伤害 +10%。'},
      {id: 'revive', rarity: 'epic', title: '续命', description: '每点获得一次复起机会，恢复至 60% 体力并保护 2 秒。'},
      {id: 'mutiny', rarity: 'epic', title: '宫门兵变', description: '每 5 秒触发一次，每点召唤一名援军，10% 将领、90% 小兵。'},
      {id: 'bloodlust', rarity: 'epic', title: '嗜战', description: '每点让你每击退一名敌人恢复 4 点体力。'},
      {id: 'foresight', rarity: 'epic', title: '洞察', description: '每点让所有敌方预警延长 30%（最多延长一倍），弓手和枪兵出手更易躲开。'}
    ],
    legendary: [
      {id: 'thunder', rarity: 'legendary', title: '雷霆', description: '每第 4 次近战命中引发一圈震波，对 95 范围内所有敌人造成该武器 60% 的伤害。再选一次变为每 3 次、之后每 2 次。'},
      {id: 'phoenix', rarity: 'legendary', title: '涅槃', description: '每点每层一次：受到致命伤时满体力复起，并以烈焰灼伤 120 范围内的敌人。'},
      {id: 'arrowStorm', rarity: 'legendary', title: '万箭齐发', description: '每点让每次射箭额外分出两支，射向附近其他敌人（各 60% 伤害），不额外耗箭。'},
      {id: 'defection', rarity: 'legendary', title: '倒戈', description: '皇帝召来的将领有 40% 机会当场倒戈，转为你的援军；每多一点，剩余几率再取 40%。'}
    ]
  };
  const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
  const ENEMY_TYPES = Object.freeze({
    soldier: {label: '刀兵', hp: 50, radius: 12, speed: 112, damage: 6, attackDelay: 1.05, points: 35, range: 38},
    shield: {label: '盾兵', hp: 72, radius: 14, speed: 94, damage: 6, attackDelay: 1.3, points: 50, range: 40},
    archer: {label: '弓手', hp: 40, radius: 12, speed: 106, damage: 7, attackDelay: 1.2, points: 45, range: 36},
    spearman: {label: '枪兵', hp: 56, radius: 13, speed: 108, damage: 9, attackDelay: 1.25, points: 55, range: 46},
    general: {label: '将领', hp: 100, radius: 16, speed: 102, damage: 7, attackDelay: 1.15, points: 100, range: 48},
    marshal: {label: '大将军', hp: 200, radius: 21, speed: 94, damage: 8, attackDelay: 1.2, points: 220, range: 58}
  });
  const HAZARD_PROFILES = Object.freeze({
    dog: {name: '纵犬', damagePerSecond: 9, sources: ['D23', 'D24']},
    scorpion: {name: '蝎蜇', damagePerSecond: 12, sources: ['D18']},
    fire: {name: '火焰', damagePerSecond: 11, sources: ['D04']},
    rods: {name: '杖击', damagePerSecond: 6, sources: ['D11', 'E06']},
    arrows: {name: '箭雨', damagePerSecond: 7, sources: ['D15']},
    blade: {name: '斩刑', damagePerSecond: 10, sources: ['E03', 'E10']},
    poison: {name: '赐毒', damagePerSecond: 8, sources: ['E09']}
  });
  const SCENES = Object.freeze([
    {id: 'gate', name: '宫门外廊', layers: '1–2'},
    {id: 'court', name: '内廷庭院', layers: '3–4'},
    {id: 'hall', name: '正殿前庭', layers: '5+'}
  ]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const sceneFor = layer => layer >= 5 ? SCENES[2] : layer >= 3 ? SCENES[1] : SCENES[0];

  function randomFor(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let mixed = Math.imul(value ^ value >>> 15, value | 1);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /* ---------- shared shapes: used by hit tests and by the renderer ---------- */
  // line: {x, y, facing, length, width}; fan: {x, y, facing, range, arc}; circle: {x, y, radius}
  function inShape(shape, point, pad = 0) {
    const dx = point.x - shape.x, dy = point.y - shape.y;
    if (shape.kind === 'circle') return Math.hypot(dx, dy) <= shape.radius + pad;
    if (shape.kind === 'line') {
      const cos = Math.cos(shape.facing), sin = Math.sin(shape.facing);
      const along = dx * cos + dy * sin;
      const across = Math.abs(-dx * sin + dy * cos);
      return along >= -pad && along <= shape.length + pad && across <= shape.width / 2 + pad;
    }
    if (shape.kind === 'fan') {
      const span = Math.hypot(dx, dy);
      if (span > shape.range + pad) return false;
      if (span <= pad) return true;
      // widen the cone by the target's own radius at that distance
      const slack = Math.asin(Math.min(1, pad / Math.max(span, 1)));
      return angleGap(Math.atan2(dy, dx), shape.facing) <= shape.arc / 2 + slack;
    }
    return false;
  }

  function alongLine(shape, point) {
    return (point.x - shape.x) * Math.cos(shape.facing) + (point.y - shape.y) * Math.sin(shape.facing);
  }

  function position(random, avoid = []) {
    let point;
    for (let attempt = 0; attempt < 55; attempt++) {
      point = {
        x: WORLD.margin + 58 + random() * (WORLD.width - WORLD.margin * 2 - 116),
        y: WORLD.margin + 55 + random() * (WORLD.height - WORLD.margin * 2 - 110)
      };
      if (avoid.every(item => distance(point, item) >= item.minimum)) return point;
    }
    return point;
  }

  function markExplored(run) {
    const size = FOG.cellSize;
    const columns = Math.ceil(WORLD.width / size);
    const rows = Math.ceil(WORLD.height / size);
    const left = Math.max(0, Math.floor((run.player.x - FOG.revealRadius) / size));
    const right = Math.min(columns - 1, Math.ceil((run.player.x + FOG.revealRadius) / size));
    const top = Math.max(0, Math.floor((run.player.y - FOG.revealRadius) / size));
    const bottom = Math.min(rows - 1, Math.ceil((run.player.y + FOG.revealRadius) / size));
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        const point = {x: (column + .5) * size, y: (row + .5) * size};
        if (distance(run.player, point) <= FOG.revealRadius + size * .6) {
          const index = row * columns + column;
          if (!run.explored[index]) {
            run.explored[index] = 1;
            run.exploredDirty = true;
          }
        }
      }
    }
  }

  const floorScale = run => {
    const floor = Math.max(0, run.layer - 1);
    return {
      health: 1.12 ** floor, damage: 1.08 ** floor,
      speed: Math.min(1.45, 1 + floor * .02), cadence: Math.max(.45, 1 - floor * .035)
    };
  };

  function createEnemy(run, type, point, groupId, leaderId = null, friendly = false) {
    const definition = ENEMY_TYPES[type];
    const scale = floorScale(run);
    const hp = Math.ceil(definition.hp * scale.health);
    const enemy = {
      id: `enemy-${run.enemySequence++}`,
      type, label: friendly ? '援军' : definition.label, friendly,
      x: point.x, y: point.y, facing: 0, bornAt: run.elapsed,
      hp, maxHp: hp, radius: definition.radius,
      speed: (definition.speed + run.random() * 12) * scale.speed,
      damage: Math.ceil(definition.damage * scale.damage),
      attackRange: definition.range,
      attackDelay: Math.max(.5, definition.attackDelay * scale.cadence), points: definition.points,
      groupId, leaderId, alive: true, lastAttackAt: -run.random(),
      hitUntil: 0, noticeRadius: 340, swingStartedAt: null, swingResolved: false,
      swingWindup: Math.max(.14, .34 * scale.cadence),
      openUntil: 0, recoverUntil: 0, aimUntil: 0, dash: null,
      nextSkillAt: run.elapsed + .8 + run.random() * 1.6
    };
    run.enemies.push(enemy);
    return enemy;
  }

  function formationPoint(run, center, occupied) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = run.random() * Math.PI * 2;
      const radius = 28 + run.random() * 48;
      const point = {
        x: clamp(center.x + Math.cos(angle) * radius, WORLD.margin + 38, WORLD.width - WORLD.margin - 38),
        y: clamp(center.y + Math.sin(angle) * radius, WORLD.margin + 38, WORLD.height - WORLD.margin - 38)
      };
      if (occupied.every(item => distance(point, item) >= 27)) return point;
    }
    return {x: center.x + 35, y: center.y + 25};
  }

  function addFormation(run, center, {general = false, soldiers = 0, units = null, marshal = false, leaderId = null, friendly = false} = {}) {
    const group = {
      id: `group-${run.groupSequence++}`, friendly,
      x: center.x, y: center.y, alerted: false, noticeRadius: 340, members: []
    };
    run.groups.push(group);
    const occupied = [];
    let leader = null;
    if (marshal) {
      leader = createEnemy(run, 'marshal', center, group.id, leaderId, friendly);
      run.marshal = leader;
    } else if (general) {
      leader = createEnemy(run, 'general', center, group.id, leaderId, friendly);
    }
    if (leader) { group.members.push(leader); occupied.push(leader); }
    const roster = units || Array.from({length: soldiers}, () => 'soldier');
    for (const type of roster) {
      const point = formationPoint(run, center, occupied);
      const unit = createEnemy(run, type, point, group.id, leader?.id || leaderId, friendly);
      group.members.push(unit);
      occupied.push(unit);
    }
    return group;
  }

  // Each floor introduces one new kind of soldier, so the player learns it alone first.
  function rosterFor(layer, index) {
    if (layer <= 1) return {units: ['soldier', 'soldier']};
    if (layer === 2) return {units: index === 2 ? ['soldier', 'soldier', 'shield'] : ['shield', 'soldier']};
    if (layer === 3) return {general: true, units: [['shield', 'archer', 'soldier'], ['soldier', 'archer', 'soldier'], ['shield', 'soldier', 'archer']][index]};
    return {general: true, units: [['spearman', 'shield', 'soldier'], ['spearman', 'archer', 'soldier'], ['shield', 'archer', 'spearman']][index]};
  }

  function spawnEnemyGroups(run) {
    run.groups = [];
    run.enemies = [];
    run.marshal = null;
    const reserved = [{...run.player, minimum: 285}, {...run.emperor, minimum: 190}];

    if (run.layer >= 5) {
      const marshalPoint = position(run.random, reserved);
      reserved.push({...marshalPoint, minimum: 230});
      const marshalGroup = addFormation(run, marshalPoint, {marshal: true, units: ['shield', 'soldier']});
      marshalGroup.command = '大将军';
      const squads = [
        {name: '盾阵', units: ['shield', 'shield', 'soldier']},
        {name: '弓阵', units: ['archer', 'archer', 'soldier']},
        {name: '枪阵', units: ['spearman', 'spearman', 'shield']}
      ];
      for (const squad of squads) {
        const center = position(run.random, reserved);
        reserved.push({...center, minimum: 220});
        const group = addFormation(run, center, {general: true, units: squad.units, leaderId: run.marshal.id});
        group.squad = squad.name;
      }
      return;
    }

    for (let index = 0; index < 3; index++) {
      const center = position(run.random, reserved);
      reserved.push({...center, minimum: 215});
      addFormation(run, center, rosterFor(run.layer, index));
    }
  }

  function spawnHazards(random, player) {
    const slots = [];
    for (const y of [153, 327, 501]) {
      for (const x of [143, 414, 686, 957]) {
        const point = {x: x + (random() - .5) * 60, y: y + (random() - .5) * 10};
        if (distance(point, player) >= 160) slots.push(point);
      }
    }
    const spots = shuffle(slots, random);
    return shuffle(Object.keys(HAZARD_PROFILES), random).slice(0, 4).map((type, index) => ({
      ...spots[index],
      type,
      ...HAZARD_PROFILES[type],
      radius: 69 + random() * 11,
      offset: random() * 12,
      damagePulseAt: 0
    }));
  }

  /* ---------- emperor phases ---------- */
  function emperorPlan(layer) {
    if (layer <= 1) return [{at: 1, name: '挥扫', moves: []}];
    if (layer === 2) return [{at: 1, name: '挥扫', moves: []}, {at: .6, name: '护驾', moves: ['guard']}];
    if (layer === 3) return [{at: 1, name: '挥扫', moves: []}, {at: .6, name: '齐射', moves: ['volley']}];
    if (layer === 4) return [{at: 1, name: '挥扫', moves: []}, {at: .6, name: '追袭', moves: ['charge']}];
    return [
      {at: 1, name: '守阵', moves: ['guard']},
      {at: .7, name: '弓阵', moves: ['volley', 'guard']},
      {at: .35, name: '追袭', moves: ['charge', 'lock', 'volley']}
    ];
  }

  function phaseIndexFor(emperor) {
    const ratio = emperor.hp / emperor.maxHp;
    let index = 0;
    emperor.plan.forEach((phase, i) => { if (ratio <= phase.at) index = i; });
    return index;
  }

  function spawnLayer(run) {
    const random = run.random;
    run.hazards = spawnHazards(random, run.player);
    run.scene = sceneFor(run.layer).id;
    run.sceneName = sceneFor(run.layer).name;

    const bossPoint = position(random, [{...run.player, minimum: 320}]);
    const scale = floorScale(run);
    const bossHp = Math.ceil(125 * scale.health * (run.layer >= 5 ? 1.8 : 1));
    const plan = emperorPlan(run.layer);
    run.emperor = {
      ...bossPoint, id: `emperor-${run.layer}`, label: '皇帝', type: 'emperor',
      alive: true, radius: 25, hp: bossHp, maxHp: bossHp,
      speed: (54 + Math.min(run.layer, 8) * 3) * scale.speed,
      damage: Math.ceil(8 * scale.damage),
      attackRange: 88, hitUntil: 0, facing: Math.PI / 2,
      swingStartedAt: null, swingResolved: false, swingWindup: Math.max(.45, .72 * scale.cadence),
      plan, phase: 0, phaseName: plan[0].name, thresholds: plan.slice(1).map(phase => phase.at),
      engaged: false, wardUntil: 0, busyUntil: 0, nextActionAt: 0, openUntil: 0, dash: null, moveCycle: 0
    };
    run.nextImperialGeneralAt = Infinity;
    run.layerGeneralsSpawned = 0;
    run.layerCleared = false;
    run.phoenixReady = run.talents.phoenix;
    run.player.meleeWeapon = run.talents.startPoleaxe ? 'poleaxe' : run.talents.startSpear ? 'spear' : run.talents.startSword ? 'sword' : null;
    run.player.bowAmmo = run.talents.startBow * 10;
    run.player.hasWeapon = Boolean(run.player.meleeWeapon || run.player.bowAmmo);
    run.player.swingStartedAt = null;
    run.player.swingResolved = false;
    run.projectileEffects.length = 0;
    run.telegraphs = [];
    run.bursts = [];
    run.swapCandidate = null;
    run.player.invulnerableUntil = Math.max(run.player.invulnerableUntil || 0, run.elapsed);
    run.weaponPickups = [];
    run.healingItems = [];
    run.stageElapsed = 0;
    spawnEnemyGroups(run);

    const pickupAvoid = [
      {...run.player, minimum: 215}, {...run.emperor, minimum: 185},
      ...run.hazards.map(hazard => ({...hazard, minimum: hazard.radius + 48})),
      ...run.groups.map(group => ({...group, minimum: 110}))
    ];
    const meleePool = run.layer >= 3 ? MELEE_POOL_LATE : MELEE_POOL_EARLY;
    for (let index = 0; index < 3; index++) {
      const avoid = [...pickupAvoid, ...run.weaponPickups.map(item => ({...item, minimum: 150}))];
      const type = run.layer === 4 && index === 0 ? 'spear' : meleePool[Math.floor(random() * meleePool.length)];
      run.weaponPickups.push({...position(random, avoid), type, collected: false});
    }
    for (let index = 0; index < 2; index++) {
      const avoid = [...pickupAvoid, ...run.weaponPickups.map(item => ({...item, minimum: 62}))];
      run.weaponPickups.push({...position(random, avoid), type: 'bow', arrows: 5, collected: false});
    }
    for (let index = 0; index < 2; index++) {
      const avoid = [
        {...run.player, minimum: 180}, {...run.emperor, minimum: 95},
        ...run.hazards.map(hazard => ({...hazard, minimum: hazard.radius + 34})),
        ...run.groups.map(group => ({...group, minimum: 95})),
        ...run.healingItems.map(item => ({...item, minimum: 140}))
      ];
      run.healingItems.push({...position(random, avoid), createdAt: run.elapsed, collected: false});
    }
    if (!Number.isFinite(run.nextHealthSpawnAt)) run.nextHealthSpawnAt = run.elapsed + 5;

    run.explored = new Uint8Array(Math.ceil(WORLD.width / FOG.cellSize) * Math.ceil(WORLD.height / FOG.cellSize));
    markExplored(run);
    run.phase = 'playing';
    const notes = {
      1: '三支刀兵小队在宫苑中搜索。',
      2: '盾兵登场：正面举盾减伤，挥盾之后会露出破绽。',
      3: '弓手登场：红线是瞄准方向，看见就横移。',
      4: '枪兵登场：直线预警后会冲刺，冲完收势时最好打。本层必有一杆长枪。',
      5: '大将军与盾阵、弓阵、枪阵三队已布防。'
    };
    run.message = `第 ${run.layer} 层 · ${run.sceneName}：${notes[Math.min(run.layer, 5)]}皇帝发现你之后才会开战并召将。`;
  }

  function createRun(name, seed) {
    const run = {
      name, seed: seed >>> 0, random: randomFor(seed),
      elapsed: 0, stageElapsed: 0, layer: 1, level: 1, score: 0,
      bossKills: 0, marshalKills: 0, generalKills: 0, enemyKills: 0,
      upgrades: {speed: 0, dodge: 0},
      talents: Object.fromEntries(Object.values(TALENT_CARDS).flat().map(({id}) => [id, 0])),
      reviveCharges: 0, nextRebellionAt: 0, nextMutinyAt: Infinity, meleeHits: 0,
      upgradeChoices: [], nextAttackAt: 0, combatCues: [], projectileEffects: [], telegraphs: [], bursts: [],
      enemySequence: 1, groupSequence: 1, telegraphSequence: 1, lastHitAt: -Infinity, lastContactAt: -Infinity, flashUntil: 0,
      player: {
        x: WORLD.width / 2, y: WORLD.height / 2, radius: 16, hp: 100, maxHp: 100,
        speed: 128, dodge: 0, hasWeapon: false, meleeWeapon: null, bowAmmo: 0,
        facing: -Math.PI / 2, swingStartedAt: null, swingResolved: false,
        invulnerableUntil: 0, regenRemainder: 0
      },
      hazards: [], emperor: null, marshal: null,
      enemies: [], groups: [], weaponPickups: [], healingItems: [], explored: new Uint8Array(0), exploredDirty: true,
      phase: 'playing', message: ''
    };
    spawnLayer(run);
    return run;
  }

  function hazardState(hazard, elapsed) {
    const phase = (elapsed + hazard.offset) % 12;
    const warning = phase >= 7 && phase < 9.5;
    const active = phase >= 9.5 || phase < 2.3;
    return {warning, active};
  }

  function targetList(run) {
    return [
      ...run.enemies.filter(enemy => enemy.alive && !enemy.friendly),
      ...(run.emperor.alive ? [run.emperor] : [])
    ];
  }

  function combatCue(run, kind, weapon, actor, delay = 0) {
    run.combatCues.push({kind, weapon, x: actor.x, y: actor.y, delay});
  }

  function burst(run, x, y, radius, kind) {
    run.bursts.push({x, y, radius, kind, startedAt: run.elapsed, until: run.elapsed + .55});
  }

  function freePointNear(run, center, ring) {
    const active = run.enemies.filter(enemy => enemy.alive);
    for (let attempt = 0; attempt < 36; attempt++) {
      const angle = run.random() * Math.PI * 2;
      const span = ring + run.random() * 22;
      const candidate = {
        x: clamp(center.x + Math.cos(angle) * span, WORLD.margin + 25, WORLD.width - WORLD.margin - 25),
        y: clamp(center.y + Math.sin(angle) * span, WORLD.margin + 25, WORLD.height - WORLD.margin - 25)
      };
      if (distance(candidate, center) < 58 || distance(candidate, run.player) < 42) continue;
      if (active.some(enemy => distance(candidate, enemy) < 38)) continue;
      return candidate;
    }
    const angle = run.random() * Math.PI * 2;
    return {
      x: clamp(center.x + Math.cos(angle) * 92, WORLD.margin + 25, WORLD.width - WORLD.margin - 25),
      y: clamp(center.y + Math.sin(angle) * 92, WORLD.margin + 25, WORLD.height - WORLD.margin - 25)
    };
  }

  function emperorSummonsAlive(run) {
    return run.enemies.filter(enemy => enemy.alive && !enemy.friendly && enemy.summoned).length;
  }

  // Summons from the emperor. Returns how many hostile units actually arrived.
  function spawnImperialUnits(run, units, general, kind) {
    if (!run.emperor.alive) return 0;
    const room = REINFORCE_CAP - emperorSummonsAlive(run);
    if (room <= 0) return 0;
    const roster = units.slice(0, general ? Math.max(0, room - 1) : room);
    const point = freePointNear(run, run.emperor, 82 + Math.min(run.layerGeneralsSpawned, 5) * 12);
    const defects = general && run.talents.defection > 0 && run.random() < 1 - .6 ** run.talents.defection;
    const group = addFormation(run, point, {general, units: roster, friendly: defects});
    group.kind = defects ? 'mutiny' : kind;
    group.alerted = true;
    if (general) run.layerGeneralsSpawned++;
    for (const unit of group.members) unit.summoned = !defects;
    combatCue(run, 'summon', 'guard', point);
    if (defects) {
      run.message = '倒戈：皇帝召来的将领转投你这一边。';
      return 0;
    }
    return group.members.length;
  }

  function enterEmperorPhase(run, index, now, emperor = run.emperor) {
    emperor.phase = index;
    const phase = emperor.plan[index];
    emperor.phaseName = phase.name;
    emperor.moveCycle = 0;
    emperor.wardUntil = now + 1;
    emperor.nextActionAt = Math.min(emperor.nextActionAt, now + .6);
    combatCue(run, 'phase', 'guard', emperor);
    if (emperor.friendly) {
      if (phase.name !== '追袭') spawnRebelGuard(run, emperor, ['soldier']);
      return;
    }
    const entry = {
      护驾: () => spawnImperialUnits(run, ['shield', 'shield'], false, 'emperorPhase'),
      守阵: () => spawnImperialUnits(run, ['shield', 'shield'], false, 'emperorPhase'),
      齐射: () => spawnImperialUnits(run, ['archer'], false, 'emperorPhase'),
      弓阵: () => spawnImperialUnits(run, ['archer', 'archer'], false, 'emperorPhase'),
      追袭: () => 0
    }[phase.name];
    entry?.();
    const lines = {
      护驾: '皇帝喝令护驾，盾兵围上来了。', 守阵: '皇帝结成守阵，盾兵护在身前。',
      齐射: '皇帝下令齐射：注意三道红线。', 弓阵: '皇帝转入弓阵：箭线与盾兵交替压上。',
      追袭: '皇帝亲自追袭：直线冲锋之后会喘息，抓住破绽。'
    };
    run.message = `皇帝进入「${phase.name}」阶段。${lines[phase.name] || ''}`;
  }

  /* ---------- damage ---------- */
  function isOpen(target, now) {
    if (now < (target.stunUntil || 0)) return true;
    if (target.type === 'emperor') return now < target.openUntil;
    if (target.type === 'shield') return now < target.openUntil;
    if (target.type === 'spearman') return now < target.recoverUntil;
    return false;
  }

  function finishLayer(run) {
    if (run.layerCleared) return false;
    run.layerCleared = true;
    run.telegraphs = [];
    return completeLayerIfReady(run);
  }

  function damageTarget(run, target, amount, now, weapon, source = null, gear = null) {
    if (!target.alive || target.hiddenUntil > now) return 0;
    let scaled = amount;
    if (source && (!target.friendly || target.type === 'emperor')) {
      if (isOpen(target, now)) scaled *= 1.25 + .35 * (source === run.player ? run.talents.counter : 0);
      else if (target.type === 'emperor' && now < target.wardUntil) scaled = 0;
      else if (target.type === 'emperor' && target.engaged) scaled *= run.layer >= 5 ? .5 : .8;
      else if (target.type === 'shield' && !target.friendly && !gear?.breaker) {
        const from = Math.atan2(source.y - target.y, source.x - target.x);
        if (angleGap(from, target.facing) <= 60 * DEG) {
          scaled *= .45;
          target.blockedAt = now;
          combatCue(run, 'block', 'guard', target);
        }
      }
    }
    const dealt = Math.min(Math.ceil(scaled), target.hp);
    target.hp = Math.max(0, target.hp - dealt);
    target.hitUntil = now + .2;
    const delay = weapon === 'bow' ? ARROW_TRAVEL : 0;
    combatCue(run, 'impact', weapon, target, delay);
    run.hitText = {x: target.x, y: target.y, value: `−${dealt}`, start: now + delay, until: now + delay + .72};
    if (target.type === 'emperor') {
      if (!target.friendly && !target.engaged) engageEmperor(run, now);
      if (target.hp > 0) {
        const index = phaseIndexFor(target);
        if (index > target.phase) { enterEmperorPhase(run, index, now, target); return dealt; }
      }
    }
    if (target.hp > 0) {
      {
        const hit = target.friendly ? '援军受击' : `命中${target.label}`;
        const tag = target.type === 'emperor' && now < target.wardUntil ? '（换阵护体，刀枪不入）' : target.blockedAt === now ? '（被盾挡下大半）' : isOpen(target, now) && !target.friendly ? '（破绽）' : '';
        run.message = `${hit}${tag}：−${dealt}，剩余 ${Math.ceil(target.hp)} / ${target.maxHp}。`;
      }
      return dealt;
    }
    target.alive = false;
    if (target.friendly) {
      run.message = '援军已被击退。';
    } else if (target.type === 'emperor') {
      run.bossKills++;
      run.message = `皇帝已被击败，第 ${run.layer} 层结束。`;
      finishLayer(run);
    } else {
      if (target.type === 'marshal') run.marshalKills++;
      if (target.type === 'general') run.generalKills++;
      run.enemyKills++;
      run.message = `${target.label}已被击退。`;
      if (run.talents.bloodlust > 0 && run.player.hp > 0) {
        run.player.hp = Math.min(run.player.maxHp, run.player.hp + 4 * run.talents.bloodlust);
      }
      run.telegraphs = run.telegraphs.filter(item => item.owner !== target || item.done);
    }
    return dealt;
  }

  function reviveOrEnd(run, now) {
    if (run.player.hp > 0) return;
    if (run.phoenixReady > 0) {
      run.phoenixReady--;
      run.player.hp = run.player.maxHp;
      run.player.invulnerableUntil = now + 2;
      run.flashUntil = now + 2;
      burst(run, run.player.x, run.player.y, 120, 'phoenix');
      combatCue(run, 'phoenix', 'guard', run.player);
      const ring = {kind: 'circle', x: run.player.x, y: run.player.y, radius: 120};
      for (const target of targetList(run)) {
        if (inShape(ring, target, target.radius)) damageTarget(run, target, 40 * floorScale(run).damage, now, 'guard', run.player);
        if (run.phase !== 'playing') return;
      }
      run.message = `涅槃：浴火复起，体力全满。本层还剩 ${run.phoenixReady} 次。`;
      return;
    }
    if (run.reviveCharges > 0) {
      run.reviveCharges--;
      run.player.hp = Math.ceil(run.player.maxHp * .6);
      run.player.invulnerableUntil = now + 2;
      run.flashUntil = now + 2;
      run.message = `续命触发：恢复至 ${run.player.hp} 点体力，并获得 2 秒保护。剩余 ${run.reviveCharges} 次。`;
      return;
    }
    run.phase = 'over';
  }

  function takeHit(run, now, amount, reason) {
    if (now < run.player.invulnerableUntil || now - run.lastHitAt < .38) return false;
    run.lastHitAt = now;
    if (run.player.dodge && run.random() < run.player.dodge) {
      run.message = `闪避成功：${reason}。`;
      return false;
    }
    run.player.hp = Math.max(0, run.player.hp - amount);
    run.flashUntil = now + .24;
    run.message = `${reason}，体力减少 ${amount}。`;
    reviveOrEnd(run, now);
    return true;
  }

  /* ---------- telegraphs: one record drives the warning and the hit ---------- */
  function warn(run, owner, shape, delay, damage, label, extra = {}) {
    const stretch = Math.min(2, 1 + .3 * (run.talents.foresight || 0));
    const telegraph = {
      id: `t-${run.telegraphSequence++}`, owner, ...shape, damage, label,
      startAt: run.elapsed, resolveAt: run.elapsed + delay * stretch, done: false, ...extra
    };
    run.telegraphs.push(telegraph);
    combatCue(run, 'warn', 'guard', owner || shape);
    return telegraph;
  }

  function resolveTelegraphs(run, now) {
    for (const telegraph of run.telegraphs) {
      if (telegraph.done || now < telegraph.resolveAt) continue;
      telegraph.done = true;
      telegraph.doneAt = now;
      const owner = telegraph.owner;
      if (owner && owner.alive === false) continue;
      if (telegraph.arrow) {
        const reach = telegraph.length;
        run.projectileEffects.push({
          x1: telegraph.x, y1: telegraph.y,
          x2: telegraph.x + Math.cos(telegraph.facing) * reach, y2: telegraph.y + Math.sin(telegraph.facing) * reach,
          startedAt: now, until: now + .22, hostile: !owner?.friendly
        });
      }
      if (telegraph.damage && owner?.friendly) {
        for (const target of targetList(run)) {
          if (inShape(telegraph, target, target.radius * .5)) damageTarget(run, target, telegraph.damage, now, 'guard', owner);
          if (run.phase !== 'playing') return;
        }
      } else if (telegraph.damage) {
        if (inShape(telegraph, run.player, run.player.radius * .55)) {
          if (takeHit(run, now, telegraph.damage, telegraph.label)) combatCue(run, 'impact', 'guard', run.player);
          if (run.phase !== 'playing') return;
        }
        for (const ally of run.enemies) {
          if (ally.alive && ally.friendly && !(ally.hiddenUntil > now) && inShape(telegraph, ally, ally.radius * .5)) damageTarget(run, ally, telegraph.damage, now, 'guard');
        }
      }
      if (telegraph.then === 'dash' && owner) {
        const length = telegraph.length - owner.radius;
        owner.dash = {
          x0: owner.x, y0: owner.y, startedAt: now, until: now + .24,
          x1: clamp(owner.x + Math.cos(telegraph.facing) * length, WORLD.margin, WORLD.width - WORLD.margin),
          y1: clamp(owner.y + Math.sin(telegraph.facing) * length, WORLD.margin, WORLD.height - WORLD.margin)
        };
        combatCue(run, 'dash', 'guard', owner);
      }
      if (telegraph.then === 'lockburst') burst(run, telegraph.x, telegraph.y, telegraph.radius, 'lock');
      if (telegraph.opening && owner) {
        const until = now + telegraph.opening + (telegraph.then === 'dash' ? .24 : 0);
        if (owner.type === 'spearman') owner.recoverUntil = until;
        else owner.openUntil = Math.max(owner.openUntil || 0, until);
      }
    }
    run.telegraphs = run.telegraphs.filter(item => !item.done || now - item.doneAt < .28);
  }

  function pendingFor(run, owner) {
    return run.telegraphs.some(item => item.owner === owner && !item.done);
  }

  function stepDash(actor, now) {
    if (!actor.dash) return false;
    const k = clamp((now - actor.dash.startedAt) / (actor.dash.until - actor.dash.startedAt), 0, 1);
    actor.x = actor.dash.x0 + (actor.dash.x1 - actor.dash.x0) * k;
    actor.y = actor.dash.y0 + (actor.dash.y1 - actor.dash.y0) * k;
    if (k >= 1) actor.dash = null;
    return true;
  }

  /* ---------- player attacks ---------- */
  function createTalentChoices(run) {
    const selected = [];
    while (selected.length < 3) {
      const availableByRarity = Object.fromEntries(Object.entries(TALENT_CARDS).map(([rarity, cards]) => [
        rarity, cards.filter(card => !selected.some(item => item.id === card.id))
      ]));
      const availableRarities = RARITY_ORDER.filter(rarity => availableByRarity[rarity].length);
      if (!availableRarities.length) break;
      const totalWeight = availableRarities.reduce((sum, rarity) => sum + TALENT_WEIGHTS[rarity], 0);
      let roll = run.random() * totalWeight;
      let rarity = availableRarities[0];
      for (const candidate of availableRarities) {
        roll -= TALENT_WEIGHTS[candidate];
        if (roll < 0) { rarity = candidate; break; }
      }
      const pool = availableByRarity[rarity];
      selected.push({...pool[Math.floor(run.random() * pool.length)]});
    }
    return selected;
  }

  function completeLayerIfReady(run) {
    if (run.emperor.alive) return false;
    run.score = scoreOf(run);
    run.phase = 'upgrade';
    run.upgradeChoices = createTalentChoices(run);
    const legend = run.upgradeChoices.some(card => card.rarity === 'legendary');
    run.message = `第 ${run.layer} 层皇帝已击败。${legend ? '出现了传说天赋！' : ''}三选一，天赋可以无限叠加。`;
    return true;
  }

  function nearestTarget(from, targets) {
    let closest = null;
    let bestSquared = Infinity;
    for (const target of targets) {
      if (target.alive === false) continue;
      const dx = target.x - from.x, dy = target.y - from.y;
      const squared = dx * dx + dy * dy;
      if (squared < bestSquared) {
        bestSquared = squared;
        closest = target;
      }
    }
    return closest ? {target: closest, span: Math.sqrt(bestSquared)} : null;
  }

  function damageBonus(run, weapon) {
    const {strength, startSword, startPoleaxe, startSpear = 0} = run.talents;
    return 4 * (run.level - 1) + 20 * strength + (weapon === 'bow' ? 0 : 10 * (startSword + startPoleaxe + startSpear));
  }

  const reachOf = run => Math.min(2, 1 + .12 * (run.talents.reach || 0));
  function meleeShape(player, weapon, facing, reach = 1) {
    const range = weapon.range * reach;
    if (weapon.shape === 'line') return {kind: 'line', x: player.x, y: player.y, facing, length: range, width: weapon.width};
    if (weapon.shape === 'circle') return {kind: 'circle', x: player.x, y: player.y, facing, radius: range};
    if (weapon.shape === 'fan' || weapon.shape === 'twin') return {kind: 'fan', x: player.x, y: player.y, facing, range, arc: weapon.arc};
    return {kind: 'fan', x: player.x, y: player.y, facing, range, arc: 70 * DEG};
  }

  function meleeVictims(run, weapon, shape, targets, primary) {
    if (weapon.shape === 'single') return [primary];
    if (weapon.shape === 'twin') return targets.sort((a, b) => distance(run.player, a) - distance(run.player, b)).slice(0, 2);
    const inside = targets.filter(target => inShape(shape, target, target.radius));
    if (weapon.shape === 'line') {
      return inside.sort((a, b) => alongLine(shape, a) - alongLine(shape, b)).slice(0, weapon.pierce);
    }
    return inside;
  }

  function performAttack(run, now) {
    if (now < run.nextAttackAt) return;
    const targets = targetList(run);
    const weaponId = run.player.meleeWeapon;
    const melee = weaponId ? MELEE_WEAPONS[weaponId] : null;
    const reach = reachOf(run);
    const reachable = melee ? targets.filter(target => distance(run.player, target) <= melee.range * reach + target.radius) : [];
    if (reachable.length) {
      const primary = nearestTarget(run.player, reachable).target;
      const facing = Math.atan2(primary.y - run.player.y, primary.x - run.player.x);
      const shape = meleeShape(run.player, melee, facing, reach);
      const victims = meleeVictims(run, melee, shape, reachable, primary);
      const haste = Math.max(.6, 1 - .08 * run.talents.swiftBlade);
      run.nextAttackAt = now + melee.cooldown * haste;
      Object.assign(run.player, {
        facing, swingFacing: facing, swingRange: melee.range * reach, swingWeapon: weaponId, swingShape: shape,
        swingStartedAt: now, swingResolved: true, swingUntil: now + (weaponId === 'spear' ? .22 : .28)
      });
      combatCue(run, 'swing', weaponId, run.player);
      const multiplier = 1 + damageBonus(run, weaponId) / 100;
      if (melee.bolt) run.projectileEffects.push({x1: run.player.x, y1: run.player.y, x2: run.player.x + Math.cos(facing) * shape.length, y2: run.player.y + Math.sin(facing) * shape.length, startedAt: now, until: now + .14, bolt: true});
      for (const hit of victims) {
        damageTarget(run, hit, melee.damage * multiplier, now, weaponId, run.player, melee);
        if (run.phase !== 'playing') return;
        if (!hit.alive || hit.type === 'emperor') continue;
        if (melee.stun) { hit.stunUntil = now + melee.stun; hit.swingStartedAt = null; }
        if (melee.knockback) {
          const away = Math.atan2(hit.y - run.player.y, hit.x - run.player.x);
          hit.x = clamp(hit.x + Math.cos(away) * melee.knockback, WORLD.margin, WORLD.width - WORLD.margin);
          hit.y = clamp(hit.y + Math.sin(away) * melee.knockback, WORLD.margin, WORLD.height - WORLD.margin);
        }
      }
      if (run.talents.thunder > 0 && ++run.meleeHits % Math.max(2, 5 - run.talents.thunder) === 0) {
        const ring = {kind: 'circle', x: run.player.x, y: run.player.y, radius: 95};
        burst(run, ring.x, ring.y, ring.radius, 'thunder');
        combatCue(run, 'thunder', weaponId, run.player);
        for (const target of targetList(run)) {
          if (!inShape(ring, target, target.radius)) continue;
          damageTarget(run, target, melee.damage * multiplier * .6, now, weaponId, run.player);
          if (run.phase !== 'playing') return;
        }
      }
      return;
    }
    if (run.player.bowAmmo <= 0) return;
    const closest = nearestTarget(run.player, targets);
    if (!closest || closest.span > BOW_RANGE) return;
    const target = closest.target;
    run.player.bowAmmo--;
    run.player.hasWeapon = Boolean(run.player.meleeWeapon || run.player.bowAmmo);
    const facing = Math.atan2(target.y - run.player.y, target.x - run.player.x);
    Object.assign(run.player, {
      facing, swingFacing: facing, swingRange: closest.span, swingWeapon: 'bow', swingShape: null,
      swingStartedAt: now, swingResolved: true, swingUntil: now + .24
    });
    run.nextAttackAt = now + .72;
    combatCue(run, 'swing', 'bow', run.player);
    const volley = [{target, share: 1}];
    if (run.talents.arrowStorm > 0) {
      targets.filter(item => item !== target && distance(run.player, item) <= BOW_RANGE)
        .sort((a, b) => distance(run.player, a) - distance(run.player, b))
        .slice(0, 2 * run.talents.arrowStorm).forEach(item => volley.push({target: item, share: .6}));
    }
    for (const shot of volley) {
      run.projectileEffects.push({x1: run.player.x, y1: run.player.y, x2: shot.target.x, y2: shot.target.y, startedAt: now, until: now + ARROW_TRAVEL});
      damageTarget(run, shot.target, (ARROW_DAMAGE[shot.target.type] || 13) * shot.share * (1 + damageBonus(run, 'bow') / 100), now, 'bow', run.player);
      if (run.phase !== 'playing') return;
    }
  }

  /* ---------- enemy behaviour ---------- */
  function moveToward(entity, point, speed, dt) {
    const dx = point.x - entity.x;
    const dy = point.y - entity.y;
    const span = Math.hypot(dx, dy) || 1;
    entity.facing = Math.atan2(dy, dx);
    entity.x = clamp(entity.x + dx / span * speed * dt, WORLD.margin, WORLD.width - WORLD.margin);
    entity.y = clamp(entity.y + dy / span * speed * dt, WORLD.margin, WORLD.height - WORLD.margin);
  }

  function updateMeleeActor(run, actor, target, now, dt) {
    if (actor.swingStartedAt !== null) {
      const swingTime = now - actor.swingStartedAt;
      if (!actor.swingResolved && swingTime >= actor.swingWindup) {
        actor.swingResolved = true;
        combatCue(run, 'swing', 'guard', actor);
        const hit = actor.swingTarget;
        const shape = {kind: 'fan', x: actor.x, y: actor.y, facing: actor.swingFacing, range: actor.attackRange, arc: 110 * DEG};
        if (hit && hit.alive !== false && inShape(shape, hit, hit.radius)) {
          if (hit === run.player) {
            if (takeHit(run, now, actor.damage, `${actor.label}挥砍命中`)) combatCue(run, 'impact', 'guard', hit);
          } else {
            const damage = actor.friendly ? (actor.type === 'marshal' ? 38 : actor.type === 'general' ? 26 : 18) : actor.damage;
            damageTarget(run, hit, damage, now, 'guard', actor);
          }
        }
        if (actor.type === 'shield' && !actor.friendly) actor.openUntil = now + .8;
      }
      if (swingTime >= actor.swingWindup + .2) {
        actor.swingStartedAt = null;
        actor.swingTarget = null;
      }
      return;
    }
    if (!target) return;
    const span = distance(actor, target);
    const opened = actor.type === 'shield' && now < actor.openUntil;
    if (!opened) actor.facing = Math.atan2(target.y - actor.y, target.x - actor.x);
    if (span > actor.attackRange + target.radius) {
      const facing = actor.facing;
      moveToward(actor, target, actor.speed * (opened ? .35 : 1), dt);
      if (opened) actor.facing = facing;
      return;
    }
    if (now - actor.lastAttackAt >= actor.attackDelay) {
      actor.lastAttackAt = now;
      actor.swingStartedAt = now;
      actor.swingResolved = false;
      actor.swingFacing = actor.facing;
      actor.swingTarget = target;
    }
  }

  function updateArcher(run, archer, target, now, dt) {
    if (now < archer.aimUntil || pendingFor(run, archer)) return;
    const span = distance(archer, target);
    const facing = Math.atan2(target.y - archer.y, target.x - archer.x);
    archer.facing = facing;
    if (now >= archer.nextSkillAt && span <= 300) {
      archer.nextSkillAt = now + 3;
      archer.aimUntil = now + .9;
      warn(run, archer, {kind: 'line', x: archer.x, y: archer.y, facing, length: 320, width: 16}, .9, archer.damage + 2, '弓手冷箭命中', {arrow: true});
      return;
    }
    if (span < 140) {
      moveToward(archer, {x: archer.x * 2 - target.x, y: archer.y * 2 - target.y}, archer.speed * .9, dt);
      archer.facing = facing;
    } else if (span > 200) moveToward(archer, target, archer.speed, dt);
    else {
      const side = (archer.enemySide ??= run.random() < .5 ? 1 : -1);
      moveToward(archer, {x: archer.x - Math.sin(facing) * side * 40, y: archer.y + Math.cos(facing) * side * 40}, archer.speed * .4, dt);
      archer.facing = facing;
    }
  }

  function updateSpearman(run, spearman, target, now, dt) {
    if (stepDash(spearman, now)) return;
    if (now < spearman.recoverUntil || pendingFor(run, spearman)) return;
    const span = distance(spearman, target);
    if (now >= spearman.nextSkillAt && span <= 200 && span > 30) {
      const facing = Math.atan2(target.y - spearman.y, target.x - spearman.x);
      spearman.facing = facing;
      spearman.nextSkillAt = now + 3.5;
      warn(run, spearman, {kind: 'line', x: spearman.x, y: spearman.y, facing, length: 200, width: 28}, .9, spearman.damage + 3, '枪兵冲刺命中', {then: 'dash', opening: .8});
      return;
    }
    updateMeleeActor(run, spearman, target, now, dt);
  }

  function updateUnit(run, unit, target, now, dt) {
    if (!target) return;
    if (now < (unit.stunUntil || 0)) return;
    if (unit.friendly) return updateMeleeActor(run, unit, target, now, dt);
    if (unit.type === 'archer') return updateArcher(run, unit, target, now, dt);
    if (unit.type === 'spearman') return updateSpearman(run, unit, target, now, dt);
    return updateMeleeActor(run, unit, target, now, dt);
  }

  function engageEmperor(run, now) {
    const emperor = run.emperor;
    if (emperor.engaged) return;
    emperor.engaged = true;
    emperor.nextActionAt = now + .9;
    run.nextImperialGeneralAt = now + REINFORCE_INTERVAL;
    combatCue(run, 'engage', 'guard', emperor);
    run.message = `皇帝发现了你，「${emperor.phaseName}」开始。保持移动，看清地上的预警。`;
  }

  function emperorAct(run, emperor, target, now) {
    const phase = emperor.plan[emperor.phase];
    const span = distance(emperor, target);
    const facing = Math.atan2(target.y - emperor.y, target.x - emperor.x);
    const late = run.layer >= 5;
    const gap = Math.max(.55, 1.15 - run.layer * .06);
    const moves = phase.moves;
    const close = span <= emperor.attackRange + target.radius + 6;
    // up close the emperor still slips in a special every third action
    if (close && !(moves.length && emperor.sweeps >= 2)) {
      emperor.sweeps = (emperor.sweeps || 0) + 1;
      emperor.facing = facing;
      const delay = emperor.swingWindup;
      warn(run, emperor, {kind: 'fan', x: emperor.x, y: emperor.y, facing, range: emperor.attackRange, arc: 150 * DEG}, delay, Math.ceil(emperor.damage * (late ? 2 : 1.4)), '皇帝横扫命中', {opening: late ? .45 : .6});
      emperor.busyUntil = now + delay + .4;
      emperor.nextActionAt = emperor.busyUntil + gap * .5;
      return true;
    }
    if (!moves.length) return false;
    emperor.sweeps = 0;
    const move = moves[emperor.moveCycle++ % moves.length];
    emperor.facing = facing;
    if (move === 'guard') {
      const arrived = emperor.friendly ? spawnRebelGuard(run, emperor, late ? ['shield', 'soldier'] : ['shield']) : spawnImperialUnits(run, late ? ['shield', 'soldier'] : ['shield'], false, 'emperorGuard');
      if (arrived) run.message = emperor.friendly ? '反叛皇帝召来护卫。' : '皇帝喝令护驾。';
      emperor.busyUntil = now + .5;
    } else if (move === 'volley') {
      const spread = late ? 16 : 20;
      for (const offset of [-spread, 0, spread]) {
        warn(run, emperor, {kind: 'line', x: emperor.x, y: emperor.y, facing: facing + offset * DEG, length: 360, width: 18}, 1, Math.ceil(emperor.damage * .8), '皇帝齐射命中', {arrow: true});
      }
      emperor.busyUntil = now + 1.25;
      emperor.openUntil = now + 1 + .6;
    } else if (move === 'charge') {
      const length = Math.min(260, span + 40);
      warn(run, emperor, {kind: 'line', x: emperor.x, y: emperor.y, facing, length, width: 36}, .9, Math.ceil(emperor.damage * 1.3), '皇帝冲锋命中', {then: 'dash', opening: 1});
      emperor.busyUntil = now + .9 + .24 + 1;
    } else if (move === 'lock') {
      warn(run, emperor, {kind: 'circle', x: target.x, y: target.y, radius: 64}, 1, Math.ceil(emperor.damage * 1.4), '落点封锁命中', {then: 'lockburst', opening: 1});
      emperor.busyUntil = now + 2;
    }
    emperor.nextActionAt = emperor.busyUntil + gap;
    return true;
  }

  function updateEmperor(run, now, dt, defenders) {
    const emperor = run.emperor;
    if (!emperor.alive) return;
    if (!emperor.engaged) {
      if (distance(run.player, emperor) <= FOG.revealRadius + 50) engageEmperor(run, now);
      else return;
    }
    if (stepDash(emperor, now)) return;
    if (now < emperor.busyUntil || pendingFor(run, emperor)) return;
    const target = nearestTarget(emperor, defenders)?.target;
    if (!target) return;
    if (now >= emperor.nextActionAt && emperorAct(run, emperor, target, now)) return;
    if (distance(emperor, target) > emperor.attackRange * .8) moveToward(emperor, target, emperor.speed, dt);
    else emperor.facing = Math.atan2(target.y - emperor.y, target.x - emperor.x);
  }

  function updateEnemies(run, now, dt) {
    const defenders = [run.player, ...run.enemies.filter(unit => unit.friendly && unit.alive && !(unit.hiddenUntil > now))];
    const imperial = run.groups.some(group => group.friendly) ? targetList(run) : [];
    for (const group of run.groups) {
      if (group.friendly) {
        for (const ally of group.members) {
          if (!ally.alive) continue;
          const target = nearestTarget(ally, imperial)?.target;
          if (ally.type === 'emperor') updateRebelEmperor(run, ally, target, now, dt);
          else updateUnit(run, ally, target, now, dt);
          if (run.phase !== 'playing') return;
        }
        continue;
      }
      const spotted = !group.alerted && defenders.find(unit =>
        unit.alive !== false && distance(unit, group) <= group.noticeRadius
      );
      if (spotted) {
        group.alerted = true;
        run.message = spotted.friendly ? '敌军发现了援军，开始迎战。' : group.command
          ? '大将军的亲兵发现了你，附近的将领小队也正赶来。'
          : group.squad ? `将领率${group.squad}发现了你。`
            : group.members.some(enemy => enemy.type === 'general')
              ? '将领发现了你，所属小队开始追击。'
              : '追兵发现了你，正在靠近。';
      }
      for (const enemy of group.members) {
        if (!enemy.alive || !group.alerted) continue;
        updateUnit(run, enemy, nearestTarget(enemy, defenders)?.target, now, dt);
        if (run.phase === 'over') return;
      }
    }
    updateEmperor(run, now, dt, defenders);
  }

  function spawnHealingPack(run) {
    run.healingItems = run.healingItems.filter(item => !item.collected);
    const activePacks = run.healingItems;
    if (activePacks.length >= 4) {
      const oldest = activePacks.sort((a, b) => a.createdAt - b.createdAt)[0];
      run.healingItems.splice(run.healingItems.indexOf(oldest), 1);
    }
    const avoid = [
      {...run.player, minimum: 170},
      ...(run.emperor?.alive ? [{...run.emperor, minimum: 100}] : []),
      ...run.hazards.map(hazard => ({...hazard, minimum: hazard.radius + 38})),
      ...run.groups.filter(group => !group.friendly).map(group => ({...group, minimum: 95}))
    ];
    run.healingItems.push({...position(run.random, avoid), createdAt: run.elapsed, collected: false});
  }

  function spawnRebelGuard(run, emperor, units, general = false) {
    const group = addFormation(run, freePointNear(run, emperor, 48), {units, general, friendly: true});
    combatCue(run, 'summon', 'guard', emperor);
    return group.members.length;
  }

  function updateRebelEmperor(run, emperor, target, now, dt) {
    if (stepDash(emperor, now) || !target) return;
    if (emperor.hiddenUntil > now) {
      const away = Math.atan2(emperor.y - target.y, emperor.x - target.x);
      moveToward(emperor, {x: emperor.x + Math.cos(away) * 100, y: emperor.y + Math.sin(away) * 100}, emperor.speed, dt);
      return;
    }
    if (now < emperor.busyUntil || pendingFor(run, emperor)) return;
    if (emperor.hp <= emperor.maxHp * .45 && now >= emperor.nextHideAt && distance(emperor, target) < 160) {
      emperor.hiddenUntil = now + 1.6;
      emperor.nextHideAt = now + 7;
      return;
    }
    if (now >= emperor.nextReinforceAt) {
      spawnRebelGuard(run, emperor, [], true);
      emperor.nextReinforceAt = now + REINFORCE_INTERVAL;
    }
    if (now >= emperor.nextActionAt && emperorAct(run, emperor, target, now)) return;
    if (distance(emperor, target) > emperor.attackRange * .8) moveToward(emperor, target, emperor.speed, dt);
  }

  function summonRebellion(run) {
    if (run.phase !== 'playing' || run.elapsed < run.nextRebellionAt) return false;
    run.nextRebellionAt = run.elapsed + 10;
    pruneDead(run);
    const group = addFormation(run, run.player, {friendly: true});
    const count = run.level + 3;
    let monarchs = 0;
    for (let i = 0; i < count; i++) {
      const roll = run.random();
      const point = formationPoint(run, run.player, group.members);
      if (roll < .01) {
        const plan = [
          {at: 1, name: '守阵', moves: ['guard', 'volley', 'charge', 'lock']},
          ...emperorPlan(5).slice(1).map(phase => ({...phase, moves: [...new Set([...phase.moves, 'guard', 'volley', 'charge', 'lock'])]}))
        ];
        const hp = run.emperor.maxHp / 4;
        group.members.push({
          ...run.emperor, ...point, id: `rebel-emperor-${run.enemySequence++}`,
          friendly: true, label: '反叛皇帝', groupId: group.id, alive: true, hp, maxHp: hp,
          plan, phase: 0, phaseName: plan[0].name, engaged: true, hitUntil: 0,
          dash: null, swingStartedAt: null, busyUntil: 0, wardUntil: 0, openUntil: 0,
          moveCycle: 0, sweeps: 0, hiddenUntil: 0, nextHideAt: 0,
          nextActionAt: run.elapsed, nextReinforceAt: run.elapsed + REINFORCE_INTERVAL
        });
        run.enemies.push(group.members.at(-1));
        monarchs++;
      } else {
        const type = roll < .11 ? 'marshal' : roll < .51 ? 'general' : 'soldier';
        const unit = createEnemy(run, type, point, group.id, null, true);
        unit.label = `反叛${ENEMY_TYPES[type].label}`;
        group.members.push(unit);
      }
    }
    combatCue(run, 'summon', 'guard', run.player);
    run.message = `反叛军团：${count} 名援军加入${monarchs ? `，其中 ${monarchs} 名反叛皇帝` : ''}。`;
    return true;
  }

  function spawnMutinyAlly(run, general) {
    const angle = run.random() * Math.PI * 2;
    const point = {
      x: clamp(run.player.x + Math.cos(angle) * 54, WORLD.margin + 28, WORLD.width - WORLD.margin - 28),
      y: clamp(run.player.y + Math.sin(angle) * 54, WORLD.margin + 28, WORLD.height - WORLD.margin - 28)
    };
    const group = addFormation(run, point, {general, soldiers: general ? 0 : 1, friendly: true});
    group.kind = 'mutiny';
  }

  function pruneDead(run) {
    run.enemies = run.enemies.filter(enemy => enemy.alive);
    run.groups = run.groups.filter(group => group.members.some(enemy => enemy.alive));
  }

  function spawnMutinyAllies(run) {
    const count = run.talents.mutiny;
    let generals = 0;
    pruneDead(run);
    for (let i = 0; i < count; i++) {
      const general = run.random() < .1;
      if (general) generals++;
      spawnMutinyAlly(run, general);
    }
    run.message = `宫门兵变：援军加入，小兵 ${count - generals} 名、将领 ${generals} 名。`;
  }

  /* ---------- weapon pickup and swap ---------- */
  function nearestSwap(run) {
    let best = null;
    for (const item of run.weaponPickups) {
      if (item.collected || item.type === 'bow' || item.type === run.player.meleeWeapon) continue;
      const span = distance(run.player, item);
      if (span < SWAP_RADIUS && (!best || span < best.span)) best = {item, span};
    }
    return best?.item || null;
  }

  function swapWeapon(run) {
    const item = run.swapCandidate;
    if (!item || item.collected || !run.player.meleeWeapon) return false;
    const old = run.player.meleeWeapon;
    item.collected = true;
    run.player.meleeWeapon = item.type;
    // the old weapon is laid down where the new one was; attack cooldown carries over
    run.weaponPickups.push({x: item.x, y: item.y, type: old, collected: false, dropped: true});
    run.swapCandidate = null;
    run.swappedAt = run.elapsed;
    const next = MELEE_WEAPONS[item.type];
    run.message = `换上${next.label}（${next.note}），放下${MELEE_WEAPONS[old].label}。`;
    return true;
  }

  function collectItems(run) {
    for (const weapon of run.weaponPickups) {
      if (weapon.collected || distance(run.player, weapon) >= 30) continue;
      if (weapon.type === 'bow') {
        weapon.collected = true;
        run.player.bowAmmo += weapon.arrows;
        run.message = `拾到弓箭：获得 ${weapon.arrows} 支箭，当前剩余 ${run.player.bowAmmo} 支。近战够不着时会自动射向 ${BOW_RANGE} 内最近的目标。`;
      } else if (!run.player.meleeWeapon) {
        weapon.collected = true;
        run.player.meleeWeapon = weapon.type;
        const next = MELEE_WEAPONS[weapon.type];
        run.message = `拾到${next.label}：${next.note}，伤害 ${next.damage}，间隔 ${next.cooldown} 秒。`;
      }
      run.player.hasWeapon = Boolean(run.player.meleeWeapon || run.player.bowAmmo);
    }
    run.swapCandidate = run.player.meleeWeapon ? nearestSwap(run) : null;
  }

  const scoreOf = run => Math.floor(run.elapsed * 10) + run.bossKills * 300 + run.marshalKills * 220 + run.enemyKills * 35;

  function advance(run, input, deltaSeconds) {
    run.combatCues.length = 0;
    if (run.phase !== 'playing') return;
    const dt = clamp(Number(deltaSeconds) || 0, 0, .05);
    if (!dt) return;
    run.elapsed += dt;
    run.stageElapsed += dt;
    const now = run.elapsed;
    if (run.player.swingStartedAt !== null && now >= run.player.swingUntil) run.player.swingStartedAt = null;
    const moveX = clamp(Number(input?.x) || 0, -1, 1);
    const moveY = clamp(Number(input?.y) || 0, -1, 1);
    const magnitude = Math.hypot(moveX, moveY) || 1;
    if (Math.abs(moveX) + Math.abs(moveY) > .02) run.player.facing = Math.atan2(moveY, moveX);
    run.player.x = clamp(run.player.x + moveX / magnitude * run.player.speed * dt, WORLD.margin, WORLD.width - WORLD.margin);
    run.player.y = clamp(run.player.y + moveY / magnitude * run.player.speed * dt, WORLD.margin, WORLD.height - WORLD.margin);
    markExplored(run);

    collectItems(run);
    if (input?.swap) swapWeapon(run);
    if (input?.rebellion) summonRebellion(run);
    for (const item of run.healingItems) {
      if (item.collected || run.player.hp >= run.player.maxHp || distance(run.player, item) >= 30) continue;
      item.collected = true;
      const before = run.player.hp;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + 32 + 10 * run.talents.herbal);
      run.message = `拾取回血药：体力恢复 ${Math.ceil(run.player.hp - before)} 点。`;
    }
    if (run.talents.regeneration > 0 && run.player.hp > 0 && run.player.hp < run.player.maxHp) {
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + .75 * run.talents.regeneration * dt);
    }
    updateEnemies(run, now, dt);
    if (run.phase !== 'playing') return;
    resolveTelegraphs(run, now);
    if (run.phase !== 'playing') return;

    if (run.emperor.alive && run.emperor.engaged && now >= run.nextImperialGeneralAt) {
      const arrived = spawnImperialUnits(run, [], true, 'emperorGuard');
      if (arrived) run.message = '皇帝召来一名将领增援。';
      run.nextImperialGeneralAt = now + REINFORCE_INTERVAL;
    }
    if (now + 1e-9 >= run.nextMutinyAt) {
      spawnMutinyAllies(run);
      run.nextMutinyAt += MUTINY_INTERVAL;
    }
    if (now >= run.nextHealthSpawnAt) {
      spawnHealingPack(run);
      run.nextHealthSpawnAt = now + 5;
    }
    performAttack(run, now);
    if (run.phase !== 'playing') return;

    const shelter = Math.max(.4, 1 - .2 * run.talents.steady);
    for (const hazard of run.hazards) {
      const state = hazardState(hazard, run.stageElapsed);
      if (state.active && distance(run.player, hazard) < hazard.radius && now >= run.player.invulnerableUntil) {
        run.player.hp = Math.max(0, run.player.hp - hazard.damagePerSecond * shelter * dt);
        if (now >= hazard.damagePulseAt) {
          hazard.damagePulseAt = now + .5;
          run.flashUntil = now + .12;
          run.message = `${hazard.name}区生效，每秒扣除 ${Math.round(hazard.damagePerSecond * shelter * 10) / 10} 点体力。`;
        }
        if (run.player.hp <= 0) {
          reviveOrEnd(run, now);
          if (run.phase === 'over') break;
        }
      }
    }
    if (run.enemies.length > 60) pruneDead(run);
    run.projectileEffects = run.projectileEffects.filter(effect => effect.until > now);
    run.bursts = run.bursts.filter(effect => effect.until > now);
    run.score = scoreOf(run);
  }

  function applyTalent(run, choice) {
    run.talents[choice.id]++;
    if (choice.id === 'vitality') {
      run.player.maxHp += 15;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + 15);
    } else if (choice.id === 'swift') {
      run.player.speed += 20;
    } else if (choice.id === 'evasion') {
      run.player.dodge += (1 - run.player.dodge) * .12;
    } else if (choice.id === 'revive') {
      run.reviveCharges++;
    } else if (choice.id === 'mutiny' && run.talents.mutiny === 1) {
      run.nextMutinyAt = run.elapsed + MUTINY_INTERVAL;
    }
  }

  function chooseUpgrade(run, choiceId) {
    if (run.phase !== 'upgrade') return false;
    const choice = run.upgradeChoices.find(card => card.id === choiceId);
    if (!choice || !Object.hasOwn(run.talents, choiceId)) return false;
    applyTalent(run, choice);
    run.level++;
    run.player.maxHp += 12;
    run.player.speed += 6;
    run.layer++;
    spawnLayer(run);
    return true;
  }

  return Object.freeze({
    WORLD, FOG, MELEE_WEAPONS, MELEE_POOL_LATE, ENEMY_TYPES, TALENT_CARDS, SCENES, SWAP_RADIUS, BOW_RANGE,
    createRun, advance, chooseUpgrade, summonRebellion, hazardState, damageBonus, inShape, isOpen
  });
});
