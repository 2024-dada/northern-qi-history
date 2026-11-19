/* Deterministic rules for the standalone game. */
(function attach(root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.SURVIVAL_ENGINE = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createEngine() {
  'use strict';

  const WORLD = Object.freeze({width: 1100, height: 640, margin: 46});
  const FOG = Object.freeze({cellSize: 24, revealRadius: 158, fade: 28});
  const HAZARD_PROFILES = Object.freeze({
    cauldron: {damagePerSecond: 9, tier: '高危', name: '刑具与灼热意象'},
    cage: {damagePerSecond: 8, tier: '高危', name: '铁笼与火焰意象'},
    river: {damagePerSecond: 5, tier: '中危', name: '河流与姓名牌意象'},
    saw: {damagePerSecond: 10, tier: '极高', name: '刑具意象'},
    beat: {damagePerSecond: 6, tier: '中危', name: '鞭杖与冲击意象'},
    arrow: {damagePerSecond: 7, tier: '高危', name: '弓矢攻防意象'},
    scorpion: {damagePerSecond: 12, tier: '极高', name: '蝎盆意象'},
    dog: {damagePerSecond: 9, tier: '高危', name: '犬影追逐意象'},
    animal: {damagePerSecond: 8, tier: '高危', name: '动物伤害意象'},
    wrestle: {damagePerSecond: 8, tier: '高危', name: '角力意象'},
    assassin: {damagePerSecond: 9, tier: '高危', name: '刺杀意象'},
    seal: {damagePerSecond: 6, tier: '中危', name: '诏令与权力意象'},
    mask: {damagePerSecond: 5, tier: '中危', name: '面具与身份意象'},
    archive: {damagePerSecond: 5, tier: '中危', name: '史料档案意象'}
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const hazardProfile = record => HAZARD_PROFILES[record?.scene] || HAZARD_PROFILES.archive;

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

  function createEnemy(run, type, point, groupId, leaderId = null) {
    const definitions = {
      soldier: {label: '追兵', hp: 50, radius: 12, speed: 112, damage: 6, attackDelay: 1.05, points: 35},
      general: {label: '将领', hp: 100, radius: 16, speed: 102, damage: 7, attackDelay: 1.15, points: 100},
      marshal: {label: '大将军', hp: 200, radius: 21, speed: 94, damage: 8, attackDelay: 1.2, points: 220}
    };
    const definition = definitions[type];
    const enemy = {
      id: `enemy-${run.enemySequence++}`,
      type, label: definition.label, x: point.x, y: point.y,
      hp: definition.hp, maxHp: definition.hp, radius: definition.radius,
      speed: definition.speed + run.random() * 12, damage: definition.damage,
      attackDelay: definition.attackDelay, points: definition.points,
      groupId, leaderId, alive: true, lastAttackAt: -run.random(),
      hitUntil: 0, noticeRadius: 340
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

  function addFormation(run, center, {general = false, soldiers = 2, marshal = false, leaderId = null} = {}) {
    const group = {
      id: `group-${run.groups.length + 1}`,
      x: center.x, y: center.y, alerted: false, noticeRadius: 340, members: []
    };
    run.groups.push(group);
    const occupied = [];
    let leader = null;
    if (marshal) {
      leader = createEnemy(run, 'marshal', center, group.id, leaderId);
      run.marshal = leader;
      group.members.push(leader);
      occupied.push(leader);
    } else if (general) {
      leader = createEnemy(run, 'general', center, group.id, leaderId);
      group.members.push(leader);
      occupied.push(leader);
    }
    for (let index = 0; index < soldiers; index++) {
      const point = formationPoint(run, center, occupied);
      const soldier = createEnemy(run, 'soldier', point, group.id, leader?.id || leaderId);
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

  function spawnLayer(run) {
    const random = run.random;
    const hazardRecords = shuffle(run.violentRecords, random).slice(0, Math.min(4, run.violentRecords.length));
    run.layerRecords = hazardRecords;
    run.hazards = hazardRecords.map(record => {
      const point = position(random, [{...run.player, minimum: 175}]);
      const profile = hazardProfile(record);
      const radius = 68 + random() * 34;
      const creatures = record.scene === 'scorpion'
        ? Array.from({length: 8 + Math.floor(random() * 5)}, () => {
          const angle = random() * Math.PI * 2;
          const spread = random() * radius * .72;
          return {x: Math.cos(angle) * spread, y: Math.sin(angle) * spread, phase: random() * Math.PI * 2, scale: .72 + random() * .45};
        })
        : [];
      return {
        ...point, record,
        radius,
        offset: random() * 12,
        shape: random() < .28 ? 'square' : 'circle',
        damagePerSecond: profile.damagePerSecond,
        tier: profile.tier,
        illustration: profile.name,
        creatures,
        damagePulseAt: 0
      };
    });
    const contextRecords = shuffle(run.contextRecords, random).slice(0, Math.min(2, run.contextRecords.length));
    run.contexts = contextRecords.map(record => ({
      ...position(random, [{...run.player, minimum: 180}]), record, collected: false
    }));

    const bossPoint = position(random, [{...run.player, minimum: 320}]);
    run.emperor = {
      ...bossPoint, id: `emperor-${run.layer}`, label: '皇帝', type: 'emperor',
      alive: true, radius: 25, hp: 125, maxHp: 125, speed: 54 + Math.min(run.layer, 8) * 3,
      damage: 8, attackDelay: 1.1, lastAttackAt: -Infinity, hitUntil: 0
    };
    run.player.hasWeapon = false;
    run.weaponPickups = [];
    run.healingItems = [];
    run.stageElapsed = 0;
    spawnEnemyGroups(run);

    for (let index = 0; index < 2; index++) {
      const avoid = [
        {...run.player, minimum: 215}, {...run.emperor, minimum: 185},
        ...run.hazards.map(hazard => ({...hazard, minimum: hazard.radius + 48})),
        ...run.groups.map(group => ({...group, minimum: 110})),
        ...run.weaponPickups.map(item => ({...item, minimum: 150}))
      ];
      run.weaponPickups.push({...position(random, avoid), collected: false});
    }
    for (let index = 0; index < 2; index++) {
      const avoid = [
        {...run.player, minimum: 180}, {...run.emperor, minimum: 95},
        ...run.groups.map(group => ({...group, minimum: 95})),
        ...run.healingItems.map(item => ({...item, minimum: 140}))
      ];
      run.healingItems.push({...position(random, avoid), collected: false});
    }

    run.explored = new Uint8Array(Math.ceil(WORLD.width / FOG.cellSize) * Math.ceil(WORLD.height / FOG.cellSize));
    markExplored(run);
    run.phase = 'playing';
    const formationNote = run.layer >= 5
      ? '大将军、三支将领队伍和皇帝已经分散布防。'
      : run.layer >= 3 ? '三支将领队伍已分散追捕。' : '三支追兵小队正在宫苑中搜索。';
    run.message = `第 ${run.layer} 层：未探索区域被黑雾遮住。${formationNote}寻找武器与药品。`;
  }

  function createRun(name, seed, records) {
    const violentRecords = records.filter(record => record.violent);
    const contextRecords = records.filter(record => !record.violent);
    if (violentRecords.length < 4 || records.length !== 41) throw new Error('游戏需要完整的41条史料索引。');
    const run = {
      name, seed: seed >>> 0, random: randomFor(seed), violentRecords, contextRecords,
      elapsed: 0, stageElapsed: 0, layer: 1, level: 1, score: 0,
      bossKills: 0, marshalKills: 0, enemyKills: 0, foundRecords: [],
      upgrades: {speed: 0, dodge: 0}, nextAttackAt: 0, attackFlash: null,
      enemySequence: 1, lastHitAt: -Infinity, lastContactAt: -Infinity, flashUntil: 0,
      player: {
        x: WORLD.width / 2, y: WORLD.height / 2, radius: 16, hp: 100, maxHp: 100,
        speed: 235, dodge: 0, hasWeapon: false, attackDamage: 25
      },
      hazards: [], contexts: [], layerRecords: [], emperor: null, marshal: null,
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
      ...run.enemies.filter(enemy => enemy.alive),
      ...(run.emperor.alive ? [run.emperor] : [])
    ];
  }

  function applyTradeDamage(run, now) {
    const damage = 4;
    if (run.player.dodge && run.random() < run.player.dodge) {
      run.message = '你避开了对手的反击。';
      return;
    }
    run.player.hp = Math.max(0, run.player.hp - damage);
    run.flashUntil = now + .16;
    if (run.player.hp <= 0) run.phase = 'over';
  }

  function completeLayerIfReady(run) {
    if (run.emperor.alive || (run.marshal && run.marshal.alive)) return false;
    run.score = Math.floor(run.elapsed * 10) + run.bossKills * 300 + run.marshalKills * 220 + run.enemyKills * 35;
    run.message = `第 ${run.layer} 层首领已击败。${run.level < 5 ? '请选择一项升级。' : '进入下一层。'}`;
    if (run.level < 5) {
      run.phase = 'upgrade';
    } else {
      run.layer++;
      spawnLayer(run);
    }
    return true;
  }

  function performAttack(run, now) {
    if (now < run.nextAttackAt) return;
    run.nextAttackAt = now + .52;
    if (!run.player.hasWeapon) {
      run.message = '还没有武器。探索地图，靠近发光武器拾取。';
      return;
    }
    const targets = targetList(run)
      .map(target => ({target, span: distance(run.player, target)}))
      .filter(item => item.span <= Math.max(86, run.player.radius + item.target.radius + 48))
      .sort((a, b) => a.span - b.span);
    if (!targets.length) {
      run.message = '挥击未命中。靠近敌人后再按空格或 J 攻击。';
      return;
    }
    const target = targets[0].target;
    const dealt = Math.min(run.player.attackDamage, target.hp);
    target.hp = Math.max(0, target.hp - dealt);
    target.hitUntil = now + .18;
    run.attackFlash = {x: target.x, y: target.y, until: now + .16};
    run.hitText = {x: target.x, y: target.y, value: `−${dealt}`, until: now + .72};
    applyTradeDamage(run, now);

    if (target.hp <= 0) {
      target.alive = false;
      if (target.type === 'emperor') {
        run.bossKills++;
        run.score += 300;
        run.message = run.marshal?.alive
          ? '皇帝已被击败，但大将军仍在战场。继续战斗。'
          : '皇帝已被击败。';
      } else if (target.type === 'marshal') {
        run.marshalKills++;
        run.score += target.points;
        run.message = '大将军已被击败。将领队伍仍可能继续追击。';
      } else {
        run.enemyKills++;
        run.score += target.points;
        run.message = `${target.label}已被击退。`;
      }
      if (run.phase === 'over') return;
      if (completeLayerIfReady(run) || run.phase !== 'playing') return;
    } else {
      run.message = `命中${target.label}：−${dealt}，剩余 ${Math.ceil(target.hp)} / ${target.maxHp}。你承受反击 4 点。`;
    }
  }

  function moveToward(entity, point, speed, dt) {
    const dx = point.x - entity.x;
    const dy = point.y - entity.y;
    const span = Math.hypot(dx, dy) || 1;
    entity.x = clamp(entity.x + dx / span * speed * dt, WORLD.margin, WORLD.width - WORLD.margin);
    entity.y = clamp(entity.y + dy / span * speed * dt, WORLD.margin, WORLD.height - WORLD.margin);
  }

  function updateEnemies(run, now, dt) {
    for (const group of run.groups) {
      if (!group.alerted && distance(run.player, group) <= group.noticeRadius) {
        group.alerted = true;
        run.message = group.command
          ? '大将军的亲兵发现了你，附近的将领小队也正赶来。'
          : group.members.some(enemy => enemy.type === 'general')
            ? '将领发现了你，所属小队开始追击。'
            : '追兵发现了你，正在靠近。';
      }
      for (const enemy of group.members) {
        if (!enemy.alive || !group.alerted) continue;
        const span = distance(run.player, enemy);
        const contactRange = run.player.radius + enemy.radius + 7;
        if (span > contactRange) {
          moveToward(enemy, run.player, enemy.speed, dt);
        } else if (now - enemy.lastAttackAt >= enemy.attackDelay) {
          enemy.lastAttackAt = now;
          takeHit(run, now, enemy.damage, `${enemy.label}近身攻击`);
          if (run.phase === 'over') return;
        }
      }
    }
  }

  function advance(run, input, deltaSeconds) {
    if (run.phase !== 'playing') return;
    const dt = clamp(Number(deltaSeconds) || 0, 0, .05);
    if (!dt) return;
    run.elapsed += dt;
    run.stageElapsed += dt;
    const now = run.elapsed;
    const moveX = clamp(Number(input?.x) || 0, -1, 1);
    const moveY = clamp(Number(input?.y) || 0, -1, 1);
    const magnitude = Math.hypot(moveX, moveY) || 1;
    run.player.x = clamp(run.player.x + moveX / magnitude * run.player.speed * dt, WORLD.margin, WORLD.width - WORLD.margin);
    run.player.y = clamp(run.player.y + moveY / magnitude * run.player.speed * dt, WORLD.margin, WORLD.height - WORLD.margin);
    markExplored(run);

    for (const weapon of run.weaponPickups) {
      if (weapon.collected || distance(run.player, weapon) >= 30) continue;
      weapon.collected = true;
      run.player.hasWeapon = true;
      run.message = '拾到武器。按空格或 J 挥击；每次交锋双方都会损失体力。';
    }
    for (const item of run.healingItems) {
      if (item.collected || run.player.hp >= run.player.maxHp || distance(run.player, item) >= 30) continue;
      item.collected = true;
      const before = run.player.hp;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + 32);
      run.message = `拾取回血药：体力恢复 ${Math.ceil(run.player.hp - before)} 点。`;
    }
    for (const context of run.contexts) {
      if (context.collected || distance(run.player, context) >= 28) continue;
      context.collected = true;
      if (!run.foundRecords.some(record => record.id === context.record.id)) run.foundRecords.push(context.record);
      run.message = `拾取背景档案：${context.record.title}。这条材料不是危险区域。`;
    }

    if (run.emperor.alive) {
      moveToward(run.emperor, run.player, run.emperor.speed, dt);
      if (distance(run.player, run.emperor) < run.player.radius + run.emperor.radius + 8 && now - run.emperor.lastAttackAt >= run.emperor.attackDelay) {
        run.emperor.lastAttackAt = now;
        takeHit(run, now, run.emperor.damage, '皇帝近身攻击');
      }
    }
    updateEnemies(run, now, dt);
    if (run.phase === 'over') return;

    if (input?.attack) performAttack(run, now);
    if (run.phase !== 'playing') return;

    for (const hazard of run.hazards) {
      const state = hazardState(hazard, run.stageElapsed);
      if (state.active && distance(run.player, hazard) < hazard.radius) {
        run.player.hp = Math.max(0, run.player.hp - hazard.damagePerSecond * dt);
        if (now >= hazard.damagePulseAt) {
          hazard.damagePulseAt = now + .5;
          run.flashUntil = now + .12;
          run.message = `进入「${hazard.record.title}」场景：游戏伤害 ${hazard.damagePerSecond} 点体力/秒。`;
        }
        if (run.player.hp <= 0) {
          run.phase = 'over';
          break;
        }
      }
    }
    run.score = Math.floor(run.elapsed * 10) + run.bossKills * 300 + run.marshalKills * 220 + run.enemyKills * 35;
  }

  function chooseUpgrade(run, choice) {
    if (run.phase !== 'upgrade' || !['speed', 'dodge'].includes(choice)) return false;
    run.level = Math.min(5, run.level + 1);
    if (choice === 'speed') {
      run.player.speed = Math.min(340, run.player.speed + 30);
      run.upgrades.speed++;
    } else {
      run.player.dodge = Math.min(.5, run.player.dodge + .1);
      run.upgrades.dodge++;
    }
    run.layer++;
    spawnLayer(run);
    return true;
  }

  return Object.freeze({WORLD, FOG, HAZARD_PROFILES, createRun, advance, chooseUpgrade, hazardState, hazardProfile});
});
