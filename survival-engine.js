/* Small, deterministic game rules shared by the canvas UI and no other site code. */
(function attach(root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.SURVIVAL_ENGINE = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createEngine() {
  'use strict';

  const WORLD = Object.freeze({width: 1100, height: 640, margin: 46});
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
    for (let attempt = 0; attempt < 40; attempt++) {
      point = {
        x: WORLD.margin + 58 + random() * (WORLD.width - WORLD.margin * 2 - 116),
        y: WORLD.margin + 55 + random() * (WORLD.height - WORLD.margin * 2 - 110)
      };
      if (avoid.every(item => distance(point, item) >= item.minimum)) return point;
    }
    return point;
  }

  function spawnLayer(run) {
    const random = run.random;
    const hazardRecords = shuffle(run.violentRecords, random).slice(0, Math.min(4, run.violentRecords.length));
    run.layerRecords = hazardRecords;
    run.hazards = hazardRecords.map(record => {
      const point = position(random, [{...run.player, minimum: 175}]);
      return {
        ...point,
        record,
        radius: 68 + random() * 34,
        offset: random() * 12,
        shape: random() < .28 ? 'square' : 'circle'
      };
    });
    const contextRecords = shuffle(run.contextRecords, random).slice(0, Math.min(2, run.contextRecords.length));
    run.contexts = contextRecords.map(record => ({
      ...position(random, [{...run.player, minimum: 180}]), record, collected: false
    }));
    const bossPoint = position(random, [{...run.player, minimum: 320}]);
    run.emperor = {...bossPoint, alive: true, radius: 25};
    run.weapon = {...position(random, [
      {...run.player, minimum: 220}, {...run.emperor, minimum: 200},
      ...run.hazards.map(hazard => ({...hazard, minimum: hazard.radius + 80}))
    ]), collected: false};
    run.stageElapsed = 0;
    run.phase = 'playing';
    run.message = `第 ${run.layer} 层：寻找散落武器，再接近皇帝。`;
  }

  function createRun(name, seed, records) {
    const violentRecords = records.filter(record => record.violent);
    const contextRecords = records.filter(record => !record.violent);
    if (violentRecords.length < 4 || records.length !== 41) throw new Error('游戏需要完整的41条史料索引。');
    const run = {
      name, seed: seed >>> 0, random: randomFor(seed), violentRecords, contextRecords,
      elapsed: 0, stageElapsed: 0, layer: 1, level: 1, score: 0,
      bossKills: 0, foundRecords: [], upgrades: {speed: 0, dodge: 0},
      lastHitAt: -Infinity, lastContactAt: -Infinity, flashUntil: 0,
      player: {x: WORLD.width / 2, y: WORLD.height / 2, radius: 16, hp: 100, speed: 235, dodge: 0, hasWeapon: false},
      hazards: [], contexts: [], layerRecords: [], emperor: null, weapon: null,
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
    if (now - run.lastHitAt < .85) return false;
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

  function advance(run, input, deltaSeconds) {
    if (run.phase !== 'playing') return;
    const dt = clamp(Number(deltaSeconds) || 0, 0, .05);
    if (!dt) return;
    const now = run.elapsed;
    run.elapsed += dt;
    run.stageElapsed += dt;
    const moveX = clamp(Number(input?.x) || 0, -1, 1);
    const moveY = clamp(Number(input?.y) || 0, -1, 1);
    const magnitude = Math.hypot(moveX, moveY) || 1;
    run.player.x = clamp(run.player.x + moveX / magnitude * run.player.speed * dt, WORLD.margin, WORLD.width - WORLD.margin);
    run.player.y = clamp(run.player.y + moveY / magnitude * run.player.speed * dt, WORLD.margin, WORLD.height - WORLD.margin);

    if (!run.weapon.collected && distance(run.player, run.weapon) < 32) {
      run.weapon.collected = true;
      run.player.hasWeapon = true;
      run.message = '拾到武器。靠近皇帝即可结束本层。';
    }
    for (const context of run.contexts) {
      if (context.collected || distance(run.player, context) >= 28) continue;
      context.collected = true;
      if (!run.foundRecords.some(record => record.id === context.record.id)) run.foundRecords.push(context.record);
      run.message = `拾取背景档案：${context.record.title}。这条材料不是危险区域。`;
    }

    if (run.emperor.alive) {
      const dx = run.player.x - run.emperor.x;
      const dy = run.player.y - run.emperor.y;
      const span = Math.hypot(dx, dy) || 1;
      const emperorSpeed = 48 + Math.min(run.layer - 1, 8) * 5 + run.level * 2;
      run.emperor.x = clamp(run.emperor.x + dx / span * emperorSpeed * dt, WORLD.margin, WORLD.width - WORLD.margin);
      run.emperor.y = clamp(run.emperor.y + dy / span * emperorSpeed * dt, WORLD.margin, WORLD.height - WORLD.margin);
      if (distance(run.player, run.emperor) < run.player.radius + run.emperor.radius || distance(run.player, run.emperor) < 37) {
        if (run.player.hasWeapon) {
          run.player.hasWeapon = false;
          run.emperor.alive = false;
          run.bossKills++;
          run.score = Math.floor(run.elapsed * 10) + run.bossKills * 300;
          run.message = `击败关底皇帝！得分 +300。${run.level < 5 ? '请选择一项升级。' : '进入下一层。'}`;
          if (run.level < 5) run.phase = 'upgrade';
          else {
            run.layer++;
            spawnLayer(run);
          }
          return;
        }
        takeHit(run, now, 14, '与未持武器的皇帝相遇');
      }
    }

    for (const hazard of run.hazards) {
      const state = hazardState(hazard, run.stageElapsed);
      if (state.active && distance(run.player, hazard) < hazard.radius) {
        takeHit(run, now, 10, `进入「${hazard.record.title}」的抽象危险区`);
        if (run.phase === 'over') break;
      }
    }
    run.score = Math.floor(run.elapsed * 10) + run.bossKills * 300;
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

  return Object.freeze({WORLD, createRun, advance, chooseUpgrade, hazardState});
});
