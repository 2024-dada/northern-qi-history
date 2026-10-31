(() => {
  'use strict';

  const enabledKey = 'qi-background-music-enabled';
  const volumeKey = 'qi-background-music-volume';
  const toggle = document.querySelector('[data-music-toggle]');
  const slider = document.querySelector('[data-music-volume]');
  const output = document.querySelector('[data-music-volume-output]');
  const state = document.querySelector('[data-music-state]');
  if (!toggle || !slider || !output || !state) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let enabled = true;
  let volume = 24;
  let context = null;
  let master = null;
  let delay = null;
  let feedback = null;
  let scheduler = null;
  let nextStepAt = 0;
  let step = 0;
  let unlocked = false;
  let unavailable = false;

  try {
    const savedEnabled = localStorage.getItem(enabledKey);
    if (savedEnabled !== null) enabled = savedEnabled !== 'false';
    const savedVolume = Number(localStorage.getItem(volumeKey));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100) volume = savedVolume;
  } catch { /* Preferences remain usable for this visit when storage is blocked. */ }

  slider.value = String(volume);
  render();

  function render() {
    const playing = Boolean(context && context.state === 'running' && enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? '关闭古风背景音乐' : '开启古风背景音乐');
    output.value = `${volume}%`;
    output.textContent = `${volume}%`;
    state.textContent = unavailable ? '暂不支持' : !enabled ? '音乐已关' : playing ? '古风音乐·播放中' : '古风音乐·待启动';
    toggle.classList.toggle('is-playing', playing);
    toggle.classList.toggle('is-pending', enabled && !playing && !unavailable);
    toggle.disabled = unavailable;
    slider.disabled = unavailable;
  }

  function makeAudioGraph() {
    if (context || unavailable) return;
    if (!AudioContextClass) {
      unavailable = true;
      render();
      return;
    }
    try {
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = (volume / 100) * 0.32;

      delay = context.createDelay(0.8);
      delay.delayTime.value = 0.24;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4200;
      feedback = context.createGain();
      feedback.gain.value = 0.13;
      const wet = context.createGain();
      wet.gain.value = 0.12;

      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(master);
      master.connect(context.destination);
      unlocked = context.state === 'running';
    } catch {
      unavailable = true;
      context = null;
      render();
    }
  }

  // Original D major pentatonic phrases: bright plucked melody with a steady,
  // gentle pulse. Each slot is an eighth note; two phrases make a longer loop.
  const phrases = [
    [74, null, 81, 78, 76, null, 74, 69, 71, null, 74, 76, 78, null, 76, 74],
    [71, null, 74, 76, 81, null, 78, 76, 74, null, 76, 78, 81, 78, 76, null]
  ];
  const tempo = 108;
  const stepDuration = 60 / tempo / 2;
  const toFrequency = midi => 440 * Math.pow(2, (midi - 69) / 12);

  function pluck(midi, at, strength = 1) {
    if (!context || !master || !delay) return;
    const frequency = toFrequency(midi);
    const voice = context.createGain();
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(Math.min(6800, frequency * 9), at);
    tone.Q.value = 0.62;
    voice.gain.setValueAtTime(0.0001, at);
    voice.gain.linearRampToValueAtTime(0.12 * strength, at + 0.008);
    voice.gain.exponentialRampToValueAtTime(0.0001, at + 0.82);
    tone.connect(voice);
    voice.connect(master);
    voice.connect(delay);

    const fundamental = context.createOscillator();
    fundamental.type = 'triangle';
    fundamental.frequency.setValueAtTime(frequency * 1.008, at);
    fundamental.frequency.exponentialRampToValueAtTime(frequency, at + 0.035);
    fundamental.connect(tone);
    fundamental.start(at);
    fundamental.stop(at + 0.9);

    const overtone = context.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(frequency * 2, at);
    const overtoneGain = context.createGain();
    overtoneGain.gain.value = 0.16;
    overtone.connect(overtoneGain);
    overtoneGain.connect(tone);
    overtone.start(at);
    overtone.stop(at + 0.38);

    fundamental.addEventListener('ended', () => {
      fundamental.disconnect();
      overtone.disconnect();
      overtoneGain.disconnect();
      tone.disconnect();
      voice.disconnect();
    }, { once: true });
  }

  function woodTap(at, strength = 1) {
    if (!context || !master) return;
    const tap = context.createOscillator();
    const tone = context.createBiquadFilter();
    const envelope = context.createGain();
    tap.type = 'triangle';
    tap.frequency.setValueAtTime(760, at);
    tap.frequency.exponentialRampToValueAtTime(510, at + 0.025);
    tone.type = 'bandpass';
    tone.frequency.value = 980;
    tone.Q.value = 0.85;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(0.045 * strength, at + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.065);
    tap.connect(tone);
    tone.connect(envelope);
    envelope.connect(master);
    tap.start(at);
    tap.stop(at + 0.075);
    tap.addEventListener('ended', () => {
      tap.disconnect();
      tone.disconnect();
      envelope.disconnect();
    }, { once: true });
  }

  function scheduleNotes() {
    if (!context || context.state !== 'running' || !enabled) return;
    const horizon = context.currentTime + 0.22;
    while (nextStepAt < horizon) {
      const position = step % 16;
      const phrase = phrases[Math.floor(step / 16) % phrases.length];
      const note = phrase[position];
      if (note !== null) pluck(note, nextStepAt, position % 8 === 0 ? 1.08 : 0.86);
      if (position === 0) pluck(50, nextStepAt, 0.24);
      if (position === 8) pluck(57, nextStepAt, 0.2);
      if (position === 2 || position === 6 || position === 10 || position === 14) {
        woodTap(nextStepAt, position === 2 || position === 10 ? 0.62 : 0.46);
      }
      step += 1;
      nextStepAt += stepDuration;
    }
  }

  async function start() {
    if (!enabled || unavailable) return;
    makeAudioGraph();
    if (!context) return;
    try {
      await context.resume();
      unlocked = context.state === 'running';
      if (unlocked && !scheduler) {
        nextStepAt = context.currentTime + 0.08;
        scheduler = window.setInterval(scheduleNotes, 100);
      }
    } catch { unlocked = false; }
    render();
  }

  function updateVolume() {
    volume = Number(slider.value);
    if (master && context) master.gain.setTargetAtTime((volume / 100) * 0.32, context.currentTime, 0.08);
    output.value = `${volume}%`;
    output.textContent = `${volume}%`;
    try { localStorage.setItem(volumeKey, String(volume)); } catch { /* Ignore unavailable storage. */ }
  }

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(enabledKey, String(enabled)); } catch { /* Ignore unavailable storage. */ }
    if (enabled) {
      start();
    } else if (context) {
      context.suspend().catch(() => {});
      render();
    } else {
      render();
    }
  });
  slider.addEventListener('input', updateVolume);

  function firstInteraction() {
    if (!enabled || unlocked || unavailable) return;
    start();
  }
  document.addEventListener('pointerdown', firstInteraction, { once: true, capture: true });
  document.addEventListener('keydown', firstInteraction, { once: true, capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && context?.state === 'running') {
      context.suspend().catch(() => {});
    } else if (!document.hidden && enabled && unlocked && context?.state === 'suspended') {
      start();
    }
  });

  // Attempt autoplay. Browsers that require a user gesture keep the default-on
  // preference and start on the visitor's first interaction with the page.
  if (enabled) start();
})();
