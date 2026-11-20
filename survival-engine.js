/* Deterministic rules for the standalone game. */
(function attach(root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.SURVIVAL_ENGINE = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createEngine() {
  'use strict';

  const WORLD = Object.freeze({width: 1100, height: 640, margin: 46});
  const FOG = Object.freeze({cellSize: 24, revealRadius: 158, fade: 28});
  const MELEE_WEAPONS = Object.freeze({
    sword: {label: '宝剑', range: 52, damage: 25, cooldown: .68},
    longSword: {label: '长剑', range: 72, damage: 25, cooldown: .76},
    poleaxe: {label: '长柄斧', range: 96, damage: 25, cooldown: .88}
  });
  const ARROW_DAMAGE = Object.freeze({soldier: 17, general: 20, marshal: 25, emperor: 13});
  const STRENGTH_MULTIPLIER = 1.3;
  const TALENT_WEIGHTS = Object.freeze({common: 45, rare: 30, epic: 20, legendary: 5});
  const HAZARD_PROFILES = Object.freeze({
    dog: {name: '纵犬', damagePerSecond: 9, sources: ['D23', 'D24']},
    scorpion: {name: '蝎蜇', damagePerSecond: 12, sources: ['D18']},
    fire: {name: '火焰', damagePerSecond: 11, sources: ['D04']},
    rods: {name: '杖击', damagePerSecond: 6, sources: ['D11', 'E06']},
    arrows: {name: '箭雨', damagePerSecond: 7, sources: ['D15']},
    blade: {name: '斩刑', damagePerSecond: 10, sources: ['E03', 'E10']},
    poison: {name: '赐毒', damagePerSecond: 8, sources: ['E09']}
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

  function createEnemy(run, type, point, groupId, leaderId = null, friendly = false) {
    const definitions = {
      soldier: {label: '追兵', hp: 50, radius: 12, speed: 112, damage: 6, attackDelay: 1.05, points: 35},
      general: {label: '将领', hp: 100, radius: 16, speed: 102, damage: 7, attackDelay: 1.15, points: 100},
      marshal: {label: '大将军', hp: 200, radius: 21, speed: 94, damage: 8, attackDelay: 1.2, points: 220}
    };
    const definition = definitions[type];
    const floor = Math.max(0, run.layer - 1);
    const healthScale = 1.12 ** floor;
    const damageScale = 1.08 ** floor;
    const speedScale = Math.min(1.45, 1 + floor * .02);
    const cadenceScale = Math.max(.45, 1 - floor * .035);
    const enemy = {
      id: `enemy-${run.enemySequence++}`,
      type, label: friendly ? '援军' : definition.label, friendly,
      x: point.x, y: point.y, facing: 0,
      hp: Math.ceil(definition.hp * healthScale), maxHp: Math.ceil(definition.hp * healthScale), radius: definition.radius,
      speed: (definition.speed + run.random() * 12) * speedScale,
      damage: Math.ceil(definition.damage * damageScale),
      attackRange: type === 'soldier' ? 38 : type === 'general' ? 48 : 58,
      attackDelay: Math.max(.5, definition.attackDelay * cadenceScale), points: definition.points,
      groupId, leaderId, alive: true, lastAttackAt: -run.random(),
      hitUntil: 0, noticeRadius: 340, swingStartedAt: null, swingResolved: false,
      swingWindup: Math.max(.14, .34 * cadenceScale)
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

  function addFormation(run, center, {general = false, soldiers = 2, marshal = false, leaderId = null, friendly = false} = {}) {
    const group = {
      id: `group-${run.groups.length + 1}`, friendly,
      x: center.x, y: center.y, alerted: false, noticeRadius: 340, members: []
    };
    run.groups.push(group);
    const occupied = [];
    let leader = null;
    if (marshal) {
      leader = createEnemy(run, 'marshal', center, group.id, leaderId, friendly);
      run.marshal = leader;
      group.members.push(leader);
      occupied.push(leader);
    } else if (general) {
      leader = createEnemy(run, 'general', center, group.id, leaderId, friendly);
      group.members.push(leader);
      occupied.push(leader);
    }
    for (let index = 0; index < soldiers; index++) {
      const point = formationPoint(run, center, occupied);
      const soldier = createEnemy(run, 'soldier', point, group.id, leader?.id || leaderId, friendly);
      group.members.push(soldier);
      occupied.push(soldier);
    }
    return group;
  }

  function spawnEnemyGroups(run) {
    run.groups = [];
    run.enemies = [];
    run.marshal = null;
    const reserved = [{...run.player, minimum: 285}, {...run.emperor, minimum: 190}];

    if (run.layer >= 5) {
      const marshalPoint = position(run.random, reserved);
      reserved.push({...marshalPoint, minimum: 230});
      const marshalGroup = addFormation(run, marshalPoint, {marshal: true, soldiers: 2});
      for (let index = 0; index < 3; index++) {
        const center = position(run.random, reserved);
        reserved.push({...center, minimum: 220});
        addFormation(run, center, {general: true, soldiers: 2, leaderId: run.marshal.id});
      }
      marshalGroup.command = '大将军';
      return;
    }

    for (let index = 0; index < 3; index++) {
      const center = position(run.random, reserved);
      reserved.push({...center, minimum: 215});
      addFormation(run, center, {
        general: run.layer >= 3,
        soldiers: run.layer >= 3 ? 3 : 2
      });
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

  function spawnLayer(run) {
    const random = run.random;
    run.hazards = spawnHazards(random, run.player);

    const bossPoint = position(random, [{...run.player, minimum: 320}]);
    const bossBaseHp = 125 * (1.12 ** Math.max(0, run.layer - 1));
    run.emperor = {
      ...bossPoint, id: `emperor-${run.layer}`, label: '皇帝', type: 'emperor',
      alive: true, radius: 25, hp: Math.ceil(bossBaseHp), maxHp: Math.ceil(bossBaseHp), speed: (54 + Math.min(run.layer, 8) * 3) * Math.min(1.45, 1 + (run.layer - 1) * .02),
      damage: Math.ceil(8 * (1.08 ** Math.max(0, run.layer - 1))),
      attackRange: 68, attackDelay: Math.max(.5, 1.1 * Math.max(.45, 1 - (run.layer - 1) * .035)),
      lastAttackAt: -Infinity, hitUntil: 0, facing: 0, swingStartedAt: null,
      swingResolved: false, swingWindup: Math.max(.14, .34 * Math.max(.45, 1 - (run.layer - 1) * .035)),
      phase: 1, phaseSummonCount: run.layer >= 5 ? run.layer - 1 : 0
    };
    run.nextImperialGeneralAt = run.elapsed + 5;
    run.layerGeneralsSpawned = 0;
    run.nextMutinyAt = run.talents.mutiny ? run.elapsed + 5 : Infinity;
    run.player.meleeWeapon = run.talents.startPoleaxe ? 'poleaxe' : run.talents.startSword ? 'sword' : null;
    run.player.bowAmmo = run.talents.startBow ? 10 : 0;
    run.player.hasWeapon = Boolean(run.player.meleeWeapon || run.player.bowAmmo);
    run.player.swingStartedAt = null;
    run.player.swingResolved = false;
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
    for (let index = 0; index < 2; index++) {
      const avoid = [
        ...pickupAvoid,
        ...run.weaponPickups.map(item => ({...item, minimum: 150}))
      ];
      const type = ['sword', 'longSword', 'poleaxe'][Math.floor(random() * 3)];
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
    const formationNote = run.layer >= 5
      ? '大将军、三支将领队伍和皇帝已经分散布防。'
      : run.layer >= 3 ? '三支将领队伍已分散追捕。' : '三支追兵小队正在宫苑中搜索。';
    run.message = `第 ${run.layer} 层：未探索区域被黑雾遮住。${formationNote}皇帝每 5 秒会召来一名将领；回血药每 5 秒刷新。寻找近战武器与弓箭；靠近时自动挥砍，较远时自动射箭。`;
  }

  function createRun(name, seed) {
    const run = {
      name, seed: seed >>> 0, random: randomFor(seed),
      elapsed: 0, stageElapsed: 0, layer: 1, level: 1, score: 0,
      bossKills: 0, marshalKills: 0, generalKills: 0, enemyKills: 0,
      upgrades: {speed: 0, dodge: 0}, talents: {
        maxHealth: 0, regeneration: 0, speed: 0, dodge: 0,
        startSword: false, startBow: false, startPoleaxe: false, strength: false,
        reviveCharges: 0, mutiny: false
      },
      upgradeChoices: [], nextAttackAt: 0, attackFlash: null, projectileEffects: [],
      enemySequence: 1, lastHitAt: -Infinity, lastContactAt: -Infinity, flashUntil: 0,
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

  function takeHit(run, now, amount, reason) {
    if (now - run.lastHitAt < .8) return false;
    run.lastHitAt = now;
    if (run.player.dodge && run.random() < run.player.dodge) {
      run.message = `闪避成功：${reason}。`;
      return false;
    }
    run.player.hp = Math.max(0, run.player.hp - amount);
    run.flashUntil = now + .24;
    run.message = `${reason}，体力减少 ${amount}。`;
    if (run.player.hp <= 0) run.phase = 'over';
    return true;
  }

  function targetList(run) {
    return [
      ...run.enemies.filter(enemy => enemy.alive && !enemy.friendly),
      ...(run.emperor.alive ? [run.emperor] : [])
    ];
  }

  function spawnImperialGeneral(run, phaseSummon = false) {
    if (!run.emperor.alive) return;
    const emperor = run.emperor;
    const activeEnemies = run.enemies.filter(enemy => enemy.alive);
    const ring = 82 + Math.min(run.layerGeneralsSpawned, 5) * 15;
    let point = null;
    for (let attempt = 0; attempt < 36; attempt++) {
      const angle = run.random() * Math.PI * 2;
      const span = ring + run.random() * 22;
      const candidate = {
        x: clamp(emperor.x + Math.cos(angle) * span, WORLD.margin + 25, WORLD.width - WORLD.margin - 25),
        y: clamp(emperor.y + Math.sin(angle) * span, WORLD.margin + 25, WORLD.height - WORLD.margin - 25)
      };
      if (distance(candidate, emperor) < 58 || distance(candidate, run.player) < 42) continue;
      if (activeEnemies.some(enemy => distance(candidate, enemy) < 38)) continue;
      point = candidate;
      break;
    }
    if (!point) {
      const angle = run.random() * Math.PI * 2;
      point = {
        x: clamp(emperor.x + Math.cos(angle) * 92, WORLD.margin + 25, WORLD.width - WORLD.margin - 25),
        y: clamp(emperor.y + Math.sin(angle) * 92, WORLD.margin + 25, WORLD.height - WORLD.margin - 25)
      };
    }
    const group = addFormation(run, point, {general: true, soldiers: 0});
    group.kind = phaseSummon ? 'emperorPhase' : 'emperorGuard';
    run.layerGeneralsSpawned++;
    run.message = phaseSummon ? '皇帝进入第二阶段，召来将领围攻。' : '皇帝召来一名将领增援。';
  }

  function reviveOrEnd(run, now) {
    if (run.player.hp > 0) return;
    if (run.talents.reviveCharges > 0) {
      run.talents.reviveCharges--;
      run.player.hp = Math.ceil(run.player.maxHp * .6);
      run.player.invulnerableUntil = now + 2;
      run.flashUntil = now + 2;
      run.message = `续命触发：恢复至 ${run.player.hp} 点体力，并获得 2 秒保护。剩余 ${run.talents.reviveCharges} 次。`;
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

  function createTalentChoices(run) {
    const cards = {
      common: [
        {id: 'vitality', rarity: 'common', title: '强健体魄', description: '最大体力 +15，并立即恢复 15 点。'},
        {id: 'regeneration', rarity: 'common', title: '调息', description: '每秒恢复 0.75 点体力。'},
        {id: 'swift', rarity: 'common', title: '轻身', description: '移动速度 +10。'},
        {id: 'evasion', rarity: 'common', title: '身法', description: '闪避率 +5%，最高 50%。'}
      ],
      rare: [
        ...(!run.talents.strength ? [{id: 'strength', rarity: 'rare', title: '力量', description: '本局近战和弓箭伤害 +30%。每局仅能选择一次。'}] : []),
        ...(!run.talents.startSword ? [{id: 'startSword', rarity: 'rare', title: '佩剑随行', description: '今后每层开始时自带宝剑。'}] : []),
        ...(!run.talents.startBow ? [{id: 'startBow', rarity: 'rare', title: '备箭', description: '今后每层开始时自带弓，并获得 10 支箭。'}] : [])
      ],
      epic: [
        ...(!run.talents.startPoleaxe ? [{id: 'startPoleaxe', rarity: 'epic', title: '长柄重器', description: '今后每层开始时自带长柄斧。'}] : []),
        {id: 'revive', rarity: 'epic', title: '续命', description: '获得一次复起机会：恢复 60% 体力并保护 2 秒，可叠加。'}
      ],
      legendary: [
        ...(!run.talents.mutiny ? [{id: 'mutiny', rarity: 'legendary', title: '宫门兵变', description: '每 5 秒在身边召来一名援军，追兵 90%，将领 10%。'}] : [])
      ]
    };
    const selected = [];
    while (selected.length < 3) {
      const availableByRarity = Object.fromEntries(Object.keys(cards).map(rarity => [
        rarity, cards[rarity].filter(card => !selected.some(item => item.id === card.id))
      ]));
      const availableRarities = Object.keys(availableByRarity).filter(rarity => availableByRarity[rarity].length);
      if (!availableRarities.length) break;
      const totalWeight = availableRarities.reduce((sum, rarity) => sum + TALENT_WEIGHTS[rarity], 0);
      let roll = run.random() * totalWeight;
      let rarity = availableRarities[0];
      for (const candidate of availableRarities) {
        roll -= TALENT_WEIGHTS[candidate];
        if (roll < 0) { rarity = candidate; break; }
      }
      const pool = availableByRarity[rarity];
      selected.push(pool[Math.floor(run.random() * pool.length)]);
    }
    return selected;
  }

  function completeLayerIfReady(run) {
    if (run.emperor.alive) return false;
    run.score = Math.floor(run.elapsed * 10) + run.bossKills * 300 + run.marshalKills * 220 + run.enemyKills * 35;
    run.phase = 'upgrade';
    if (run.layer < 5) {
      run.level = run.layer + 1;
      run.upgradeChoices = [
        {id: 'speed', rarity: 'basic', title: '移速提升', description: '移动速度 +20，方便穿过宫道。'},
        {id: 'dodge', rarity: 'basic', title: '闪避提升', description: '闪避率 +10%，最高 50%。'}
      ];
      run.message = `第 ${run.layer} 层皇帝已击败。等级提升至 ${run.level}，选择移速或闪避。`;
    } else {
      run.level = 5;
      run.upgradeChoices = createTalentChoices(run);
      run.message = `第 ${run.layer} 层皇帝已击败。选择一项进阶天赋，继续挑战更强的下一层。`;
    }
    return true;
  }

  function damageTarget(run, target, amount, now) {
    if (!target.alive) return;
    const dealt = Math.min(Math.ceil(amount), target.hp);
    target.hp = Math.max(0, target.hp - dealt);
    target.hitUntil = now + .2;
    run.attackFlash = {x: target.x, y: target.y, until: now + .2};
    run.hitText = {x: target.x, y: target.y, value: `−${dealt}`, until: now + .72};
    if (target.type === 'emperor' && target.hp > 0 && run.layer >= 5 && target.phase === 1 && target.hp <= target.maxHp / 2) {
      target.phase = 2;
      run.message = `皇帝进入第二阶段：召来 ${target.phaseSummonCount} 名将领。`;
      for (let index = 0; index < target.phaseSummonCount; index++) spawnImperialGeneral(run, true);
      run.message = `皇帝进入第二阶段：召来 ${target.phaseSummonCount} 名将领。`;
    }
    if (target.hp > 0) {
      const hit = target.friendly ? '援军受击' : `命中${target.label}`;
      run.message = `${hit}：−${dealt}，剩余 ${Math.ceil(target.hp)} / ${target.maxHp}。`;
      return;
    }
    target.alive = false;
    if (target.friendly) {
      run.message = '援军已被击退。';
    } else if (target.type === 'emperor') {
      run.bossKills++;
      run.score += 300;
      run.message = `皇帝已被击败，第 ${run.layer} 层结束。`;
      completeLayerIfReady(run);
    } else {
      if (target.type === 'marshal') run.marshalKills++;
      if (target.type === 'general') run.generalKills++;
      run.enemyKills++;
      run.score += target.points;
      run.message = `${target.label}已被击退。`;
    }
  }

  function nearestTarget(from, targets) {
    let closest = null;
    for (const target of targets) {
      if (target.alive === false) continue;
      const span = distance(from, target);
      if (!closest || span < closest.span) closest = {target, span};
    }
    return closest;
  }

  function performAttack(run, now) {
    if (now < run.nextAttackAt) return;
    const targets = targetList(run);
    const damageMultiplier = run.talents.strength ? STRENGTH_MULTIPLIER : 1;
    const melee = run.player.meleeWeapon ? MELEE_WEAPONS[run.player.meleeWeapon] : null;
    const inMeleeRange = melee ? targets.filter(target => distance(run.player, target) <= melee.range + target.radius) : [];
    if (inMeleeRange.length) {
      run.nextAttackAt = now + melee.cooldown;
      run.player.swingStartedAt = now;
      run.player.swingResolved = true;
      run.player.swingUntil = now + .28;
      const target = nearestTarget(run.player, inMeleeRange).target;
      run.player.facing = Math.atan2(target.y - run.player.y, target.x - run.player.x);
      run.player.swingFacing = run.player.facing;
      run.player.swingRange = melee.range;
      for (const hit of inMeleeRange) {
        damageTarget(run, hit, melee.damage * damageMultiplier, now);
        if (run.phase !== 'playing') return;
      }
      return;
    }
    if (run.player.bowAmmo <= 0) return;
    const closest = nearestTarget(run.player, targets);
    if (!closest || closest.span > 240) return;
    const target = closest.target;
    run.player.bowAmmo--;
    run.player.hasWeapon = Boolean(run.player.meleeWeapon || run.player.bowAmmo);
    run.player.facing = Math.atan2(target.y - run.player.y, target.x - run.player.x);
    run.player.swingStartedAt = now;
    run.player.swingResolved = true;
    run.player.swingUntil = now + .24;
    run.player.swingFacing = run.player.facing;
    run.player.swingRange = closest.span;
    run.nextAttackAt = now + .72;
    run.projectileEffects.push({x1: run.player.x, y1: run.player.y, x2: target.x, y2: target.y, startedAt: now, until: now + .24});
    damageTarget(run, target, (ARROW_DAMAGE[target.type] || 13) * damageMultiplier, now);
  }

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
        const hit = actor.swingTarget;
        if (hit && hit.alive !== false && distance(actor, hit) <= actor.attackRange + hit.radius) {
          if (hit === run.player) {
            takeHit(run, now, actor.damage, `${actor.label}挥砍命中`);
          } else {
            const damage = actor.friendly ? (actor.type === 'general' ? 26 : 18) : actor.damage;
            damageTarget(run, hit, damage, now);
          }
        }
      }
      if (swingTime >= actor.swingWindup + .2) {
        actor.swingStartedAt = null;
        actor.swingTarget = null;
      }
      return;
    }
    if (!target) return;
    const span = distance(actor, target);
    actor.facing = Math.atan2(target.y - actor.y, target.x - actor.x);
    if (span > actor.attackRange + target.radius) {
      moveToward(actor, target, actor.speed, dt);
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

  function updateEnemies(run, now, dt) {
    const defenders = [run.player, ...run.enemies.filter(unit => unit.friendly && unit.alive)];
    const imperial = defenders.length > 1 ? targetList(run) : [];
    for (const group of run.groups) {
      if (group.friendly) {
        for (const ally of group.members) {
          if (!ally.alive) continue;
          const target = nearestTarget(ally, imperial)?.target;
          updateMeleeActor(run, ally, target, now, dt);
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
          : group.kind?.startsWith('emperor')
            ? '皇帝召来的将领发现了你，正在追击。'
            : group.members.some(enemy => enemy.type === 'general')
              ? '将领发现了你，所属小队开始追击。'
              : '追兵发现了你，正在靠近。';
      }
      for (const enemy of group.members) {
        if (!enemy.alive || !group.alerted) continue;
        const target = nearestTarget(enemy, defenders)?.target;
        updateMeleeActor(run, enemy, target, now, dt);
        if (run.phase === 'over') return;
      }
    }
    if (run.emperor.alive) {
      const target = nearestTarget(run.emperor, defenders)?.target;
      updateMeleeActor(run, run.emperor, target, now, dt);
    }
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

  function spawnMutinyAlly(run) {
    const angle = run.random() * Math.PI * 2;
    const point = {
      x: clamp(run.player.x + Math.cos(angle) * 54, WORLD.margin + 28, WORLD.width - WORLD.margin - 28),
      y: clamp(run.player.y + Math.sin(angle) * 54, WORLD.margin + 28, WORLD.height - WORLD.margin - 28)
    };
    const general = run.random() < .1;
    const group = addFormation(run, point, {general, soldiers: general ? 0 : 1, friendly: true});
    group.kind = 'mutiny';
    run.message = `兵变响应：${general ? '将领' : '追兵'}援军已在身边加入。`;
  }

  function advance(run, input, deltaSeconds) {
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

    for (const weapon of run.weaponPickups) {
      if (weapon.collected || distance(run.player, weapon) >= 30) continue;
      weapon.collected = true;
      if (weapon.type === 'bow') {
        run.player.bowAmmo += weapon.arrows;
        run.message = `拾到弓箭：获得 ${weapon.arrows} 支箭，当前剩余 ${run.player.bowAmmo} 支。弓箭会自动瞄准 240 范围内最近的目标。`;
      } else {
        const current = run.player.meleeWeapon && MELEE_WEAPONS[run.player.meleeWeapon];
        const next = MELEE_WEAPONS[weapon.type];
        if (!current || next.range > current.range) run.player.meleeWeapon = weapon.type;
        run.message = `拾到${next.label}：近战挥击半径 ${next.range}，范围内的敌人会同时受击。`;
      }
      run.player.hasWeapon = Boolean(run.player.meleeWeapon || run.player.bowAmmo);
    }
    for (const item of run.healingItems) {
      if (item.collected || run.player.hp >= run.player.maxHp || distance(run.player, item) >= 30) continue;
      item.collected = true;
      const before = run.player.hp;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + 32);
      run.message = `拾取回血药：体力恢复 ${Math.ceil(run.player.hp - before)} 点。`;
    }
    if (run.talents.regeneration > 0 && run.player.hp > 0 && run.player.hp < run.player.maxHp) {
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + run.talents.regeneration * dt);
    }
    updateEnemies(run, now, dt);
    if (run.phase !== 'playing') return;

    if (run.emperor.alive && now >= run.nextImperialGeneralAt) {
      spawnImperialGeneral(run);
      run.nextImperialGeneralAt = now + 5;
    }
    if (run.talents.mutiny && now >= run.nextMutinyAt) {
      spawnMutinyAlly(run);
      run.nextMutinyAt = now + 5;
    }
    if (now >= run.nextHealthSpawnAt) {
      spawnHealingPack(run);
      run.nextHealthSpawnAt = now + 5;
    }
    performAttack(run, now);
    if (run.phase !== 'playing') return;

    for (const hazard of run.hazards) {
      const state = hazardState(hazard, run.stageElapsed);
      if (state.active && distance(run.player, hazard) < hazard.radius && now >= run.player.invulnerableUntil) {
        run.player.hp = Math.max(0, run.player.hp - hazard.damagePerSecond * dt);
        if (now >= hazard.damagePulseAt) {
          hazard.damagePulseAt = now + .5;
          run.flashUntil = now + .12;
          run.message = `${hazard.name}区生效，每秒扣除 ${hazard.damagePerSecond} 点体力。`;
        }
        if (run.player.hp <= 0) {
          reviveOrEnd(run, now);
          if (run.phase === 'over') break;
        }
      }
    }
    run.projectileEffects = run.projectileEffects.filter(effect => effect.until > now);
    run.score = Math.floor(run.elapsed * 10) + run.bossKills * 300 + run.marshalKills * 220 + run.enemyKills * 35;
  }

  function applyTalent(run, choice) {
    if (choice.id === 'vitality') {
      run.player.maxHp += 15;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + 15);
      run.talents.maxHealth += 15;
    } else if (choice.id === 'regeneration') run.talents.regeneration += .75;
    else if (choice.id === 'swift') {
      run.player.speed = Math.min(300, run.player.speed + 10);
      run.talents.speed += 10;
    } else if (choice.id === 'evasion') {
      run.player.dodge = Math.min(.5, run.player.dodge + .05);
      run.talents.dodge += .05;
    } else if (choice.id === 'startSword') run.talents.startSword = true;
    else if (choice.id === 'startBow') run.talents.startBow = true;
    else if (choice.id === 'strength') run.talents.strength = true;
    else if (choice.id === 'startPoleaxe') run.talents.startPoleaxe = true;
    else if (choice.id === 'revive') run.talents.reviveCharges++;
    else if (choice.id === 'mutiny') run.talents.mutiny = true;
  }

  function chooseUpgrade(run, choiceId) {
    if (run.phase !== 'upgrade') return false;
    if (run.layer < 5) {
      if (!['speed', 'dodge'].includes(choiceId)) return false;
      run.level = Math.min(5, run.level + 1);
      if (choiceId === 'speed') {
        run.player.speed = Math.min(280, run.player.speed + 20);
        run.upgrades.speed++;
      } else {
        run.player.dodge = Math.min(.5, run.player.dodge + .1);
        run.upgrades.dodge++;
      }
    } else {
      const choice = run.upgradeChoices.find(card => card.id === choiceId);
      if (!choice || (choice.id === 'strength' && run.talents.strength)) return false;
      applyTalent(run, choice);
      run.level = 5;
    }
    run.layer++;
    spawnLayer(run);
    return true;
  }

  return Object.freeze({WORLD, FOG, MELEE_WEAPONS, createRun, advance, chooseUpgrade, hazardState});
});
