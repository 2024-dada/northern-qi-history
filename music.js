(() => {
  'use strict';

  const music = document.querySelector('[data-reading-music]');
  if (!music) return;
  const toggle = document.querySelector('[data-music-toggle]');
  const slider = document.querySelector('[data-music-volume]');
  const output = document.querySelector('[data-music-volume-output]');
  const state = document.querySelector('[data-music-state]');
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let enabled = true, volume = Number(slider.value), graph, blocked = false;

  try {
    enabled = localStorage.getItem('qi-background-music-enabled') !== 'false';
    const saved = localStorage.getItem('qi-background-music-volume');
    if (saved !== null && Number.isFinite(Number(saved))) volume = Math.min(100, Math.max(0, Number(saved)));
  } catch { /* Preferences are optional. */ }

  function render() {
    const active = enabled && !music.paused;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled && blocked ? '播放古琴背景音乐' : enabled ? '关闭古琴背景音乐' : '开启古琴背景音乐');
    output.textContent = volume + '%';
    state.textContent = music.error ? '古琴载入失败' : !enabled ? '古琴已关' : active ? '《酒狂》·播放中' : blocked ? '《酒狂》·轻点页面播放' : '古琴《酒狂》';
    toggle.classList.toggle('is-playing', active);
    toggle.classList.toggle('is-pending', enabled && !active);
  }

  function applyVolume() {
    music.muted = volume === 0;
    if (graph) {
      music.volume = 1;
      graph.gain.gain.setTargetAtTime(volume / 100, graph.context.currentTime, .045);
    } else {
      music.volume = volume / 100;
    }
  }

  function prepareVolumeGraph() {
    if (graph || !AudioContextClass || location.protocol === 'file:') return;
    try {
      const context = new AudioContextClass();
      const gain = context.createGain();
      gain.gain.value = volume / 100;
      const source = context.createMediaElementSource(music);
      source.connect(gain);
      gain.connect(context.destination);
      graph = {context, gain};
      applyVolume();
    } catch { /* Media-element volume is still available. */ }
  }

  // Fade in on start and out on stop, so the guqin never cuts in or off abruptly.
  function fadeTo(level, seconds) {
    if (!graph) return;
    const gain = graph.gain.gain, now = graph.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(level, now + seconds);
  }

  let stopTimer = 0;
  function stop() {
    clearTimeout(stopTimer);
    if (!graph || music.paused) { music.pause(); return; }
    fadeTo(0, .7);
    stopTimer = setTimeout(() => { if (!enabled || document.hidden) music.pause(); }, 720);
  }

  function play(fromGesture = false) {
    if (!enabled || document.hidden) return;
    clearTimeout(stopTimer);
    if (fromGesture) prepareVolumeGraph();
    graph?.context.resume().catch(() => {});
    const wasPaused = music.paused;
    if (graph && wasPaused) { graph.gain.gain.cancelScheduledValues(graph.context.currentTime); graph.gain.gain.setValueAtTime(0, graph.context.currentTime); }
    music.play().then(() => { blocked = false; if (graph) fadeTo(volume / 100, wasPaused ? 2.4 : .3); render(); }).catch(error => {
      if (error.name === 'NotAllowedError') blocked = true;
      render();
    });
  }

  slider.value = String(volume);
  applyVolume();
  render();
  for (const event of ['playing', 'pause', 'error']) music.addEventListener(event, render);

  toggle.addEventListener('click', () => {
    if (enabled && blocked) {
      play(true);
      return;
    }
    enabled = !enabled;
    try { localStorage.setItem('qi-background-music-enabled', String(enabled)); } catch {}
    if (enabled) play(true);
    else stop();
    render();
  });
  slider.addEventListener('input', () => {
    volume = Number(slider.value);
    try { localStorage.setItem('qi-background-music-volume', String(volume)); } catch {}
    applyVolume();
    render();
    if (music.paused && enabled && volume > 0) play(true);
  });

  function firstInteraction(event) {
    if (event.target instanceof Element && event.target.closest('[data-music-toggle],[data-music-volume]')) return;
    play(true);
    document.removeEventListener('pointerdown', firstInteraction, true);
    document.removeEventListener('keydown', firstInteraction, true);
  }
  document.addEventListener('pointerdown', firstInteraction, true);
  document.addEventListener('keydown', firstInteraction, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music.pause();
    else play();
  });
  play();
})();
