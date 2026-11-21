(() => {
  'use strict';

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const toggle = document.querySelector('[data-game-sound]');
  const slider = document.querySelector('[data-game-sound-volume]');
  const soundtrack = document.querySelector('[data-game-music]');
  const musicToggle = document.querySelector('[data-game-music-toggle]');
  const musicMix = .17;
  const windMix = .075;
  const options = {
    sword: {air: 1950, length: .105, knock: 285, ring: 1640, tail: .15},
    longSword: {air: 1180, length: .18, knock: 185, ring: 1160, tail: .25},
    poleaxe: {air: 580, length: .23, knock: 89, ring: 540, tail: .27},
    spear: {air: 1500, length: .12, knock: 160, ring: 980, tail: .18},
    bow: {air: 2280, length: .09, knock: 234, ring: 780, tail: .10},
    guard: {air: 950, length: .14, knock: 135, ring: 820, tail: .16}
  };
  let enabled = true, musicEnabled = true, volume = 56, playing = false;
  let context, master, noiseBuffer, wind, musicGain, hall;

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
    // A small palace-hall echo: two damped feedback delays fed from a send bus.
    try {
      hall = context.createGain();
      hall.gain.value = .22;
      const tone = context.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 2400;
      hall.connect(tone);
      for (const [time, feedback] of [[.083, .38], [.131, .31]]) {
        const delay = context.createDelay(.5), fb = context.createGain(), damp = context.createBiquadFilter();
        delay.delayTime.value = time; fb.gain.value = feedback;
        damp.type = 'lowpass'; damp.frequency.value = 1800;
        tone.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay);
        damp.connect(master);
      }
    } catch { hall = null; }
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
      try { // slow gusts sweep the wind filter
        const lfo = context.createOscillator(), depth = context.createGain();
        lfo.frequency.value = .07; depth.gain.value = 140;
        lfo.connect(depth); depth.connect(wind.filter.frequency);
        lfo.start(); wind.source.addEventListener('ended', () => { lfo.stop(); lfo.disconnect(); depth.disconnect(); }, {once: true});
      } catch { /* static wind is fine */ }
      wind.gain.value = 0;
      wind.gain.setTargetAtTime(windMix, context.currentTime, .3);
      wind.source.start();
    } catch { /* Unsupported audio must leave play available. */ }
  }

  function updateMusic() {
    if (!playing || !musicEnabled || !volume) {
      soundtrack.pause();
      return;
    }
    const level = volume / 100 * musicMix;
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
      musicGain.gain.cancelScheduledValues(context.currentTime);
      musicGain.gain.setTargetAtTime(level, context.currentTime, .05);
      context.resume().catch(() => {});
    } else {
      soundtrack.volume = level;
    }
    if (soundtrack.paused) soundtrack.play().catch(() => {});
  }

  function duckMusic(at) {
    if (!musicGain || soundtrack.paused) return;
    const level = volume / 100 * musicMix;
    const gain = musicGain.gain;
    gain.cancelScheduledValues(at);
    gain.setTargetAtTime(level * .42, at, .009);
    gain.setTargetAtTime(level, at + .12, .075);
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
    if (hall) gain.connect(hall);
    oscillator.start(at);
    oscillator.stop(at + duration);
    oscillator.addEventListener('ended', () => { oscillator.disconnect(); gain.disconnect(); }, {once: true});
  }

  function voice(frequency, duration, level, at, {type = 'sine', bend = 1, attack = .006, send = .5} = {}) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (bend !== 1) oscillator.frequency.exponentialRampToValueAtTime(frequency * bend, at + duration);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(master);
    if (hall && send) {
      const wet = context.createGain(); wet.gain.value = send;
      gain.connect(wet); wet.connect(hall);
      oscillator.addEventListener('ended', () => wet.disconnect(), {once: true});
    }
    oscillator.start(at);
    oscillator.stop(at + duration + .05);
    oscillator.addEventListener('ended', () => { oscillator.disconnect(); gain.disconnect(); }, {once: true});
  }

  // Event voices: gong, drum, bells. Pentatonic on D so they sit with the soundtrack.
  const D = 146.83, pent = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
  const events = {
    pickup(at) { voice(1760, .16, .07, at, {type: 'triangle', send: .3}); voice(2637, .22, .045, at + .045, {send: .4}); },
    heal(at) { pent.slice(1, 4).forEach((r, i) => voice(D * 4 * r, .5, .06, at + i * .075, {send: .6})); },
    revive(at) { pent.forEach((r, i) => voice(D * 2 * r, .9, .07, at + i * .06, {type: 'triangle', send: .7})); },
    hurt(at, weight = .6) {
      voice(110, .2, .22 * (.5 + weight), at, {bend: .55, send: .15});
      pulse('lowpass', 900, 160, .16, .12 * (.5 + weight), at);
    },
    defeat(at) { voice(196, .12, .1, at, {type: 'triangle', bend: .7, send: .25}); pulse('bandpass', 700, 300, .08, .05, at); },
    drum(at) { [0, .19].forEach(t => { voice(72, .5, .38, at + t, {bend: .6, send: .5}); pulse('lowpass', 420, 90, .3, .16, at + t); }); },
    gong(at, root = 98) { // inharmonic partials with a slow shimmer
      [[1, .26, 3.2], [1.48, .12, 2.4], [2.02, .09, 2.0], [2.74, .06, 1.6], [3.42, .035, 1.2], [4.1, .02, .9]].forEach(([r, l, d]) =>
        voice(root * r, d, l, at, {attack: .012, bend: .995, send: .8}));
      pulse('bandpass', 1400, 500, .5, .05, at);
    },
    clear(at) { events.gong(at, 98); [0, 2, 4].forEach((n, i) => voice(D * 2 * pent[n], 1.1, .06, at + .35 + i * .12, {type: 'triangle', send: .7})); },
    levelup(at) { [0, 2, 3, 5].forEach((n, i) => voice(D * 2 * pent[n], .55, .065, at + i * .07, {send: .6})); },
    over(at) { events.gong(at, 73.4); voice(D, 1.8, .1, at + .25, {type: 'triangle', bend: .94, send: .6}); voice(D * 6 / 5 / 2 * 2, 1.6, .07, at + .5, {bend: .94, send: .6}); }
  };
  const eventGap = {defeat: .09, hurt: .32, pickup: .12, heal: .2};
  const eventLast = new Map();
  function event(name, weight) {
    if (!enabled || !volume || !context || context.state !== 'running' || !events[name]) return;
    const now = context.currentTime;
    if (now - (eventLast.get(name) ?? -Infinity) < (eventGap[name] ?? .25)) return;
    eventLast.set(name, now);
    if (name === 'clear' || name === 'over' || name === 'drum') duckMusic(now);
    try { events[name](now + .004, weight); } catch { /* sound must never interrupt play */ }
  }

  const lastPlayed = new Map();
  function cue(kind, weapon, gain, delay) {
    if (!playing || !enabled || !volume || context?.state !== 'running' || gain <= .07) return;
    const key = kind + weapon;
    const now = context.currentTime;
    if (now - (lastPlayed.get(key) ?? -Infinity) < .075) return;
    lastPlayed.set(key, now);
    const at = now + delay;
    const sound = options[weapon] || options.guard;
    if (kind === 'warn') { tone(880, 820, .05, .045 * gain, at); return; }
    if (kind === 'block') { tone(210, 150, .07, .2 * gain, at); pulse('bandpass', 700, 300, .06, .08 * gain, at); return; }
    if (kind === 'dash') { pulse('bandpass', 900, 400, .2, .12 * gain, at); return; }
    if (kind === 'thunder') { pulse('lowpass', 260, 120, .35, .3 * gain, at); tone(90, 50, .3, .22 * gain, at); return; }
    if (kind === 'phoenix') { event('revive'); return; }
    if (kind === 'phase' || kind === 'engage') { event('drum'); return; }
    if (kind === 'summon') { tone(300, 240, .18, .07 * gain, at); return; }
    if (kind === 'swing') {
      pulse('bandpass', sound.air, sound.air * .43, sound.length, .17 * gain, at);
      if (weapon === 'bow') tone(560, 210, .07, .11 * gain, at);
    } else {
      if (weapon !== 'guard') duckMusic(at);
      pulse('bandpass', sound.ring, sound.ring * .52, sound.tail, .14 * gain, at);
      tone(sound.knock, sound.knock * .64, Math.min(.12, sound.tail), .30 * gain, at);
      if (weapon !== 'bow') tone(sound.ring, sound.ring * .83, sound.tail, .055 * gain, at + .006);
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
    cue,
    event
  });
})();
