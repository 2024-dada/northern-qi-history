/* Animated Canvas illustrations for the game's hazard types. */
(() => {
  'use strict';

  const tau = Math.PI * 2;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const houndShape = new Path2D('M -19 -4 Q -18 -12 -7 -10 L 6 -10 Q 11 -11 15 -17 L 16 -24 L 22 -18 L 25 -17 L 28 -22 L 29 -13 L 35 -9 L 33 -5 L 23 -4 L 16 3 Q 10 8 -2 3 Q -16 7 -19 -4 Z');
  const bladeShape = new Path2D('M -37 0 Q -2 -11 37 -4 Q 31 6 17 8 L -37 6 Z');
  const cupShape = new Path2D('M -22 0 Q -17 21 -5 23 L -4 31 L -13 34 L -13 37 H 13 V 34 L 4 31 L 5 23 Q 17 21 22 0 Z');

  function fillPath(ctx, shape, fill, edge, width = 1.2) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = width;
      ctx.stroke(shape);
    }
  }

  function ellipse(ctx, x, y, rx, ry, fill, edge) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, tau);
    ctx.fillStyle = fill;
    ctx.fill();
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
  }

  function line(ctx, points, color, width) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawHound(ctx, x, y, direction, stride, active, warning, size) {
    ellipse(ctx, x, y + 11 * size, 24 * size, 5 * size, '#0b0d0b77');
    ctx.save();
    ctx.translate(x, y);
    const gait = Math.sin(stride);
    ctx.scale(direction * size, size);
    ctx.rotate(warning ? .13 : gait * .07);
    for (const [leg, far] of [[-14, true], [12, true], [-14, false], [12, false]]) {
      const reach = gait * (leg > 0 ? 1 : -1) * (far ? -.6 : 1);
      const knee = leg + reach * 7 - 3;
      line(ctx, [[leg, 1], [knee, 8], [leg + reach * 11 + 2, 14]],
        far ? '#64513c' : '#ad8058', far ? 3.5 : 4.5);
    }
    ctx.beginPath();
    ctx.moveTo(-15, -4);
    ctx.quadraticCurveTo(-23, -7, -28, -14 + gait * 5);
    ctx.strokeStyle = '#a1734f';
    ctx.lineWidth = 3;
    ctx.stroke();
    const coat = ctx.createLinearGradient(0, -21, 0, 10);
    coat.addColorStop(0, '#b38a60');
    coat.addColorStop(1, '#4a372a');
    fillPath(ctx, houndShape, coat, '#d1a474');
    line(ctx, [[-14, -5], [-7, -8], [4, -7], [13, -12]], '#d9a879', 1.2);
    line(ctx, [[16, -14], [20, -6], [18, -2]], '#a34936', 2.6);
    line(ctx, [[26, -8], [32, -5]], '#36261b', 1.2);
    ellipse(ctx, 26, -12, 1.35, 1.15, active ? '#ffd980' : '#e7b77b');
    ctx.restore();
  }

  function drawDogPack(ctx, time, {active, warning}) {
    const speed = active ? 3.1 : warning ? 1.45 : .85;
    for (let i = 0; i < 3; i++) {
      const rhythm = time * speed + i * 2.09;
      const surge = active ? 9 : 0;
      const x = Math.sin(rhythm) * (21 + surge) + (i - 1) * 11;
      const y = (i - 1) * 29 + Math.cos(rhythm) * 4;
      const direction = Math.cos(rhythm) >= 0 ? 1 : -1;
      if (active) {
        for (let j = 1; j <= 3; j++) {
          const drift = (time * 24 + j * 7) % 22;
          ellipse(ctx, x - direction * (14 + drift), y + 11 - j, 2 + j, 1 + j * .5, '#d7ae7950');
        }
      }
      drawHound(ctx, x, y, direction, rhythm * 4.5, active, warning, i === 1 ? 1.06 : .83);
    }
  }

  function drawScorpion(ctx, x, y, size, angle, time, active) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(size, size);
    ellipse(ctx, -3, 6, 22, 10, '#0b0d0b75');
    const twitch = Math.sin(time * 5);
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 4; leg++) {
        const root = -10 + 5 * leg;
        const reach = Math.sin(time * 4 + leg) * 2;
        line(ctx, [[root, side * 4], [root - 3 + reach, side * 10],
          [root - 6 + reach, side * (14 + leg % 2 * 2)]], '#a27658', 1.8);
      }
      line(ctx, [[8, side * 3], [15, side * 8], [20, side * (10 + twitch)]], '#c48756', 3);
      ellipse(ctx, 20, side * (10 + twitch), 4.5, 3.5, '#965e48', '#e1a46d');
      line(ctx, [[20, side * (10 + twitch)], [25, side * 13], [28, side * 11]], '#dba171', 2);
      line(ctx, [[21, side * (10 + twitch)], [26, side * 8]], '#dba171', 1.6);
    }
    for (let plate = 0; plate < 5; plate++) {
      ellipse(ctx, -12 + plate * 4.5, 0, 4.8, 5.8 + plate * .36, '#965945', '#d69b67');
    }
    ellipse(ctx, 8, 0, 5, 5, '#b37152', '#e5b076');
    ellipse(ctx, 10, -1.5, .9, .9, '#fff1bc');
    ellipse(ctx, 10, 1.5, .9, .9, '#fff1bc');

    const beat = (time * 1.1) % 1;
    const flick = active ? Math.pow(Math.sin(beat * Math.PI), 10) : .07 + twitch * .06;
    const joints = [[-14, 0], [-23, -3], [-25, -12], [-20, -21],
      [-11, -25 + flick * 5], [-2 + flick * 11, -23 + flick * 8],
      [4 + flick * 15, -17 + flick * 13], [4 + flick * 23, -11 + flick * 15]];
    line(ctx, joints, '#2e1b1a', 6);
    line(ctx, joints, '#be8556', 4);
    for (const [jx, jy] of joints.slice(1, -1)) ellipse(ctx, jx, jy, 2.8, 2.6, '#b57954', '#ebae70');
    const tip = joints[joints.length - 1];
    line(ctx, [joints[joints.length - 2], tip, [tip[0] - 3, tip[1] + 3]], '#f2bc7a', 2.4);
    if (active && flick > .83) {
      for (const dy of [-8, 0, 8]) line(ctx, [[tip[0] + 4, tip[1]], [tip[0] + 11, tip[1] + dy]], '#ffe2a6', 1.3);
    }
    ctx.restore();
  }

  function drawScorpions(ctx, time, {active}) {
    const drift = Math.sin(time * 1.2) * 3;
    drawScorpion(ctx, -31 + drift, 15, .82, -.12, time, active);
    drawScorpion(ctx, 32 - drift, -14, .76, Math.PI + .18, time + .38, active);
  }

  function drawFire(ctx, time, {active, warning}) {
    ellipse(ctx, 0, 20, 58, 23, active ? '#cd4d3250' : '#b65a3933');
    for (let i = 0; i < 13; i++) {
      const x = (i * 23 % 97) - 48;
      const y = 12 + (i * 13 % 26);
      ellipse(ctx, x, y, 4 + i % 4, 2.2, i % 3 ? '#482c25' : '#d37c4a', '#a05237');
    }
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 13;
      const y = 19 + Math.cos(i * .9) * 9;
      const height = (active ? 36 : warning ? 16 : 8) + (i % 3) * 6 + Math.sin(time * 6 + i) * 5;
      const bend = Math.sin(time * 4 + i) * 8;
      const flame = new Path2D();
      flame.moveTo(x - 10, y);
      flame.bezierCurveTo(x - 17, y - height * .4, x + bend - 5, y - height * .62, x + bend, y - height);
      flame.bezierCurveTo(x + bend + 1, y - height * .58, x + 18, y - height * .38, x + 9, y);
      flame.quadraticCurveTo(x, y + 5, x - 10, y);
      const color = ctx.createLinearGradient(0, y - height, 0, y + 3);
      color.addColorStop(0, '#b34431');
      color.addColorStop(.6, '#ed813c');
      color.addColorStop(1, '#fff0a2');
      fillPath(ctx, flame, color, active ? '#ffa76a' : null);
    }
    for (let i = 0; i < 16; i++) {
      const cycle = (time * (active ? .74 : .36) + i * .217) % 1;
      const x = (i * 33 % 101) - 50 + Math.sin(cycle * 4 + i) * 6;
      ellipse(ctx, x, 18 - cycle * 76, 1 + (i % 3) * .55, 1.55,
        `rgba(253,167,90,${(1 - cycle) * (active ? .92 : .4)})`);
    }
  }

  function drawRods(ctx, time, {active, warning}) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 36;
      const beat = (time * (active ? 1.55 : .7) + i * .24) % 1;
      const fall = active ? Math.pow(Math.sin(beat * Math.PI), 8) : warning ? .21 : .07;
      ellipse(ctx, x, 31, 15, 7, '#492a2388', '#bd8b5d');
      ctx.save();
      ctx.translate(x - 7, -21 + fall * 30);
      ctx.rotate(-.82 + fall * 1.25);
      line(ctx, [[0, -24], [0, 22]], '#371e19', 9);
      line(ctx, [[0, -23], [0, 21]], '#a76c43', 6);
      line(ctx, [[-1.8, -21], [-1.8, 18]], '#e2aa72', 1.2);
      for (const y of [-17, -13, 16]) line(ctx, [[-3, y], [3, y]], '#e4b77e', 1.6);
      ctx.restore();
      if (active && fall > .62) {
        for (const dx of [-12, 0, 12]) line(ctx, [[x, 29], [x + dx, 39]], '#f2bb76', 1.7);
      }
    }
  }

  function drawArrowRain(ctx, time, {active, warning}) {
    for (let lane = 0; lane < 5; lane++) {
      const y = (lane - 2) * 22;
      const flight = (time * (active ? 129 : 38) + lane * 43) % 151;
      const x = flight - 75;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(.27);
      if (active) line(ctx, [[-39, 0], [-10, 0]], '#ace3df88', 2);
      line(ctx, [[-19, 0], [16, 0]], active ? '#e7f5df' : '#84aab3', 1.8);
      line(ctx, [[10, -3.5], [17, 0], [10, 3.5]], '#d7e8de', 2.2);
      line(ctx, [[-20, -3], [-14, 0], [-20, 3]], '#d1a36d', 2);
      ctx.restore();
    }
    if (warning) {
      for (const y of [-26, 0, 26]) line(ctx, [[-60, y], [60, y + 28]], '#a6d4d052', 1.5);
    }
  }

  function drawBlade(ctx, time, {active, warning}) {
    const beat = (time * (active ? 1.1 : .42)) % 1;
    const sweep = active ? Math.pow(Math.sin(beat * Math.PI), 8) : 0;
    ellipse(ctx, 0, 30, 42, 13, '#3b3b4388', '#9f9db3');
    ellipse(ctx, 0, 27, 28, 6, '#1c272b', '#bbb2bb');
    if (active && sweep > .25) {
      ctx.beginPath();
      ctx.ellipse(0, 3, 57, 32, -.37, .13, 2.88);
      ctx.strokeStyle = `rgba(202,224,255,${sweep * .74})`;
      ctx.lineWidth = 2 + sweep * 3;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(3, -11 + sweep * 18);
    ctx.rotate(-.68 + sweep * 1.35 - (warning ? .24 : 0));
    const steel = ctx.createLinearGradient(0, -12, 0, 9);
    steel.addColorStop(0, '#747f94');
    steel.addColorStop(.6, '#f5eddd');
    steel.addColorStop(1, '#9caaaf');
    fillPath(ctx, bladeShape, steel, '#fff6da');
    line(ctx, [[-37, -7], [-37, 13]], '#d6ae77', 4);
    line(ctx, [[-55, 3], [-41, 3]], '#8f4f46', 6);
    ellipse(ctx, -56, 3, 3.6, 3.6, '#dbb780');
    ctx.restore();
  }

  function drawPoison(ctx, time, {active, warning}) {
    ellipse(ctx, 0, 39, 35, 7, '#17251b88', '#9bb27a');
    for (let i = 0; i < 12; i++) {
      const age = (time * (active ? .63 : .32) + i * .159) % 1;
      const x = Math.sin(age * 5 + i * 2.3) * (6 + age * (active ? 40 : 23));
      const y = -age * (active ? 59 : warning ? 43 : 28);
      ellipse(ctx, x, y, 4 + age * 7, 2.5 + age * 5,
        `rgba(161,214,121,${(1 - age) * (active ? .36 : .19)})`);
    }
    const bronze = ctx.createLinearGradient(-22, 0, 22, 35);
    bronze.addColorStop(0, '#a0a372');
    bronze.addColorStop(.58, '#587449');
    bronze.addColorStop(1, '#334b3b');
    fillPath(ctx, cupShape, bronze, '#b5ba8c', 1.7);
    ellipse(ctx, 0, 0, 22, 6, '#26372a', '#c9cd98');
    ellipse(ctx, 0, 1.5, 17.5, 3.4, active ? '#a1d87a' : '#587d4e');
    ellipse(ctx, Math.sin(time * 2) * 7, 1, 5, 1.5, '#d1f0aa95');
    for (const x of [-10, 0, 10]) line(ctx, [[x - 3, 10], [x, 14], [x + 3, 10]], '#c5c58f', 1);
  }

  const artwork = {
    dog: {draw: drawDogPack, color: '#dfab71'},
    scorpion: {draw: drawScorpions, color: '#df9b77'},
    fire: {draw: drawFire, color: '#ff9c62'},
    rods: {draw: drawRods, color: '#d7a473'},
    arrows: {draw: drawArrowRain, color: '#a0cad5'},
    blade: {draw: drawBlade, color: '#cac3e7'},
    poison: {draw: drawPoison, color: '#a6c888'}
  };

  function draw(ctx, hazard, time, state, worldUnitsPerCssPixel) {
    const {x, y, radius, offset, type} = hazard;
    const {active, warning} = state;
    const {draw: drawArt, color} = artwork[type];
    const artTime = reduceMotion.matches ? .4 : time + offset;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const floor = ctx.createRadialGradient(0, 0, 9, 0, 0, radius);
    floor.addColorStop(0, active ? '#312320' : '#202a24');
    floor.addColorStop(.77, '#18211e');
    floor.addColorStop(1, `${color}${active ? '58' : warning ? '39' : '20'}`);
    ellipse(ctx, 0, 0, radius, radius, floor);
    ctx.save();
    ctx.clip();
    const scale = radius / 76;
    ctx.scale(scale, scale);
    drawArt(ctx, artTime, state);
    ctx.restore();

    const rim = active ? '#ffad80' : color;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 5, 0, tau);
    ctx.strokeStyle = `${rim}48`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, tau);
    ctx.strokeStyle = active || warning ? rim : `${rim}98`;
    ctx.lineWidth = active ? 3 : 1.6;
    ctx.setLineDash(active ? [] : warning ? [7, 4] : [3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 8; i++) {
      const angle = i * tau / 8;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      line(ctx, [[ux * (radius - 4), uy * (radius - 4)], [ux * (radius + 3), uy * (radius + 3)]], rim, 1.4);
    }

    const labelScale = Math.min(Math.max(worldUnitsPerCssPixel, 1), 1.85);
    ctx.translate(0, -radius - 4);
    ctx.scale(labelScale, labelScale);
    ctx.fillStyle = '#0d1715f3';
    ctx.strokeStyle = `${rim}b0`;
    ctx.lineWidth = 1;
    ctx.fillRect(-58, -30, 116, 30);
    ctx.strokeRect(-58, -30, 116, 30);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 11px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    ctx.fillStyle = '#fff0d2';
    ctx.fillText(`${hazard.name}区`, 0, -21);
    ctx.font = '600 9px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    ctx.fillStyle = active || warning ? rim : '#c4c4ae';
    const status = active ? '生效' : warning ? '预警' : '暂歇';
    ctx.fillText(`${status} · ${hazard.damagePerSecond} 点/秒`, 0, -8);
    ctx.restore();
  }

  window.SURVIVAL_HAZARD_ART = {draw};
})();
