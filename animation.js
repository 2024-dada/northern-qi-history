(() => {
  'use strict';
  const scene = document.querySelector('#scene-animation');
  if (!scene) return;
  const find = selector => scene.querySelector(selector);
  const play = find('[data-scene-play]');
  const scrub = find('#scene-scrub');
  const steps = [...scene.querySelectorAll('[data-scene-step]')];
  const actors = ['victim', 'executor', 'command', 'stamp', 'trace'].reduce((all, key) => {
    all[key] = find(`#scene-${key}`); return all;
  }, {});
  const frames = [
    { title: '高纬召斛律光入宫', text: '史书叙述，高纬以赏赐、召见等方式使斛律光入宫。画面用剪影走入表示这一过程，不复原实际路线。', evidence: '依据概括｜《北齐书》卷十七；《资治通鉴》卷171。' },
    { title: '高纬下令，刘桃枝等执行', text: '高纬负责杀害决策与召见，刘桃枝等负责实施。朱线只表示命令关系；这一幕不确定真实下令时点，也不表示高纬在现场。', evidence: '依据概括｜史书分别叙述君主决策与宫中实施。' },
    { title: '史书记载刘桃枝从后杀害', text: '刘桃枝的剪影从后方接近，用重叠与墨色变化表示杀害。原文的“拉”不在这里扩写成一套确定的动作或器物。', evidence: '原文短引 · 简体转写｜“桃枝自后拉而杀之。”——《北齐书》卷十七' },
    { title: '事件结果与尚待核实的问题', text: '斛律光遇害。结合上方关系图分析此前的指控、推动者与君主猜忌。具体传递环节和日期仍需核实，动画不能代替这些证据。', evidence: '核验边界｜572年；两书月份有分歧。关键句影印待核。' }
  ];
  const duration = 20000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let time = 0, running = false, lastTick = null, raf = null, previousPhase = -1;
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const between = (start, end) => ease((time - start) / (end - start));

  function render() {
    const phase = Math.min(3, Math.floor(time / 5000));
    // Reduced-motion mode advances only through still compositions.
    const incoming = reducedMotion ? (phase > 0 ? 1 : 0) : between(500, 4200);
    const approaching = reducedMotion ? (phase >= 2 ? 1 : 0) : between(10000, 13000);
    const disappearing = reducedMotion ? (phase >= 3 ? 1 : 0) : between(13200, 16700);
    const command = reducedMotion ? (phase >= 1 ? 1 : 0) : between(5300, 8500);
    const victimX = 620 - 170 * incoming;
    const executorX = 685 - 195 * approaching;
    const walk = reducedMotion || incoming === 0 || incoming === 1 ? 0 : Math.sin(time / 170) * 1.5;
    actors.victim.setAttribute('transform', `translate(${victimX} ${247 + walk})`);
    actors.victim.setAttribute('opacity', String(1 - disappearing));
    actors.executor.setAttribute('transform', `translate(${executorX} 247) rotate(${-6 * approaching})`);
    actors.executor.setAttribute('opacity', String(clamp((time - 8500) / 1300) * (1 - disappearing * .75)));
    find('#scene-victim-label').setAttribute('x', String(victimX));
    find('#scene-executor-label').setAttribute('x', String(executorX));
    actors.command.setAttribute('stroke-dashoffset', String(330 * (1 - command)));
    actors.command.setAttribute('opacity', String(phase > 0 ? 1 : 0));
    actors.stamp.setAttribute('opacity', String(reducedMotion ? (phase >= 3 ? 1 : 0) : between(15300, 17500)));
    actors.trace.setAttribute('opacity', String(disappearing));
    scrub.value = String(time);
    const elapsed = Math.floor(time / 1000);
    find('#scene-time').textContent = `${String(elapsed).padStart(2, '0')} / 20 秒`;
    scrub.setAttribute('aria-valuetext', `${elapsed}秒，${frames[phase].title}`);
    scene.dataset.playback = running ? 'playing' : time === duration ? 'ended' : 'paused';
    if (phase !== previousPhase) {
      find('#scene-phase').textContent = `${String(phase + 1).padStart(2, '0')} / 04`;
      find('#scene-title').textContent = frames[phase].title;
      find('#scene-description').textContent = frames[phase].text;
      find('#scene-evidence').textContent = frames[phase].evidence;
      steps.forEach((button, i) => {
        button.classList.toggle('active', i === phase);
        button.setAttribute('aria-pressed', String(i === phase));
      });
      previousPhase = phase;
    }
    play.textContent = running ? 'Ⅱ 暂停' : time === 0 ? '▶ 播放示意动画' : time === duration ? '↻ 再看一次' : '▶ 继续播放';
  }

  function stop() {
    running = false; lastTick = null;
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null; render();
  }
  function tick(now) {
    if (!running) return;
    if (lastTick !== null) time = Math.min(duration, time + now - lastTick);
    lastTick = now;
    if (time === duration) { stop(); return; }
    render(); raf = requestAnimationFrame(tick);
  }
  function start() {
    if (time === duration) time = 0;
    scene.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
    running = true; lastTick = null; render(); raf = requestAnimationFrame(tick);
  }
  play.addEventListener('click', () => running ? stop() : start());
  find('[data-scene-replay]').addEventListener('click', () => { stop(); time = 0; start(); });
  steps.forEach(button => button.addEventListener('click', () => {
    stop(); time = Number(button.dataset.sceneStep) * 5000 + 2500; render();
  }));
  scrub.addEventListener('input', () => { const target = Number(scrub.value); stop(); time = target; render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) stop(); });
  // Do not keep advancing the film beneath an open source dialog.
  new MutationObserver(() => {
    if (document.querySelector('#detail-dialog').open && running) stop();
  }).observe(document.querySelector('#detail-dialog'), { attributes: true, attributeFilter: ['open'] });
  if (reducedMotion) find('#scene-motion-note').hidden = false;
  render();
})();
