(() => {
  'use strict';

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const toggle = document.querySelector('[data-game-sound]');
  const slider = document.querySelector('[data-game-sound-volume]');
  const soundtrack = document.querySelector('[data-game-music]');
  const musicToggle = document.querySelector('[data-game-music-toggle]');
  const options = {
    sword: {air: 1950, length: .105, knock: 285, ring: 1640, tail: .15},
    longSword: {air: 1180, length: .18, knock: 185, ring: 1160, tail: .25},
    poleaxe: {air: 580, length: .23, knock: 89, ring: 540, tail: .27},
    bow: {air: 2280, length: .09, knock: 234, ring: 780, tail: .10},
    guard: {air: 950, length: .14, knock: 135, ring: 820, tail: .16}
  };
  let enabled = true, musicEnabled = true, volume = 56, playing = false;
  let context, master, noiseBuffer, wind, musicGain;

  try {
    enabled = localStorage.getItem('qi-survival-sound') !== 'false';
    musicEnabled = localStorage.getItem('qi-survival-music') !== 'false';
    const saved = localStorage.getItem('qi-survival-volume');
    if (saved !== null && Number.isFinite(Number(saved))) volume = Math.min(100, Math.max(0, Number(saved)));
  } catch { /* Preferences are optional. */ }

  function renderControls() {
    toggle.disabled = !AudioContextClass;
    toggle.setAttribute('aria-pressed', String(enabled && Boolean(AudioContextClass)));
    toggle.textContent = !AudioContextClass ? '音效不可用' : enabled ? '音效开' : '音效关';
    musicToggle.setAttribute('aria-pressed', String(musicEnabled));
    musicToggle.textContent = musicEnabled ? '配乐开' : '配乐关';
    slider.value = String(volume);
  }

  function setup() {
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = volume / 100 * .65;
    master.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const phase = i / samples.length * Math.PI * 2;
      const gust = .74 + .16 * Math.sin(phase) + .1 * Math.sin(phase * 3 + .7);
      samples[i] = (Math.random() * 2 - 1) * gust;
    }
  }

  function makeNoise(type, frequency) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = type;
    filter.frequency.value = frequency;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.addEventListener('ended', () => { source.disconnect(); filter.disconnect(); gain.disconnect(); }, {once: true});
    return {source, filter, gain: gain.gain};
  }

  function updateSound() {
    if (!AudioContextClass) return;
    if (!playing || !enabled || !volume) {
      if (wind) {
        const at = context.currentTime;
        wind.gain.setTargetAtTime(0, at, .042);
        wind.source.stop(at + .22);
        wind = null;
      }
      if (!enabled || !volume) master?.gain.setTargetAtTime(0, context.currentTime, .025);
      return;
    }
    try {
      if (!context) setup();
      master.gain.setTargetAtTime(volume / 100 * .65, context.currentTime, .04);
      context.resume().catch(() => {});
      if (wind) return;
      wind = makeNoise('lowpass', 360);
      wind.source.loop = true;
      wind.gain.value = 0;
      wind.gain.setTargetAtTime(.2, context.currentTime, .3);
      wind.source.start();
    } catch { /* Unsupported audio must leave play available. */ }
  }

  function updateMusic() {
    if (!playing || !musicEnabled || !volume) {
      soundtrack.pause();
      return;
    }
    const level = volume / 100 * .46;
    // The media gain gives mobile browsers a volume control of their own.
    if (!musicGain && AudioContextClass && location.protocol !== 'file:') {
      try {
        if (!context) setup();
        const gain = context.createGain();
        gain.gain.value = level;
        context.createMediaElementSource(soundtrack).connect(gain);
        gain.connect(context.destination);
        musicGain = gain;
      } catch { /* Use the media element directly if a graph can't be created. */ }
    }
    if (musicGain) {
      musicGain.gain.setTargetAtTime(level, context.currentTime, .05);
      context.resume().catch(() => {});
    } else {
      soundtrack.volume = level;
    }
    if (soundtrack.paused) soundtrack.play().catch(() => {});
  }

  function pulse(type, frequency, endFrequency, duration, level, at) {
    const {source, filter, gain} = makeNoise(type, frequency);
    filter.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    gain.setValueAtTime(.0001, at);
    gain.exponentialRampToValueAtTime(level, at + .013);
    gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.start(at, Math.random() * 2);
    source.stop(at + duration);
  }

  function tone(frequency, endFrequency, duration, level, at) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration);
    oscillator.addEventListener('ended', () => { oscillator.disconnect(); gain.disconnect(); }, {once: true});
  }

  const lastPlayed = new Map();
  function cue(kind, weapon, gain, delay) {
    if (!playing || !enabled || !volume || context?.state !== 'running' || gain <= .07) return;
    const key = kind + weapon;
    const now = context.currentTime;
    if (now - (lastPlayed.get(key) ?? -Infinity) < .075) return;
    lastPlayed.set(key, now);
    const at = now + delay;
    const sound = options[weapon];
    if (kind === 'swing') {
      pulse('bandpass', sound.air, sound.air * .43, sound.length, .17 * gain, at);
      if (weapon === 'bow') tone(560, 210, .07, .11 * gain, at);
    } else {
      pulse('bandpass', sound.ring, sound.ring * .52, sound.tail, .11 * gain, at);
      tone(sound.knock, sound.knock * .64, Math.min(.12, sound.tail), .22 * gain, at);
      if (weapon !== 'bow') tone(sound.ring, sound.ring * .83, sound.tail, .043 * gain, at + .006);
    }
  }

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem('qi-survival-sound', String(enabled)); } catch {}
    renderControls();
    updateSound();
  });
  slider.addEventListener('input', () => {
    volume = Number(slider.value);
    try { localStorage.setItem('qi-survival-volume', String(volume)); } catch {}
    updateSound();
    updateMusic();
  });
  musicToggle.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    try { localStorage.setItem('qi-survival-music', String(musicEnabled)); } catch {}
    renderControls();
    updateMusic();
  });
  renderControls();
  window.SURVIVAL_AUDIO = Object.freeze({
    setPlaying(active, {restart = false} = {}) {
      playing = active;
      if (restart && soundtrack.currentTime > 0) soundtrack.currentTime = 0;
      updateSound();
      updateMusic();
    },
    cue
  });
})();
