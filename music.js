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
  let room = null;
  let roomMix = null;
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
      master.gain.value = (volume / 100) * 0.28;

      // A short, soft room tail gives the plucks space without a repeating
      // delay that can make the loop sound electronic.
      room = context.createConvolver();
      const roomLength = Math.floor(context.sampleRate * 0.85);
      const impulse = context.createBuffer(2, roomLength, context.sampleRate);
      for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const samples = impulse.getChannelData(channel);
        for (let i = 0; i < roomLength; i += 1) {
          const fade = 1 - i / roomLength;
          samples[i] = (Math.random() * 2 - 1) * fade * fade * fade * 0.32;
        }
      }
      room.buffer = impulse;
      room.normalize = false;
      roomMix = context.createGain();
      roomMix.gain.value = 0.12;
      room.connect(roomMix);
      roomMix.connect(master);
      master.connect(context.destination);
      unlocked = context.state === 'running';
    } catch {
      unavailable = true;
      context = null;
      render();
    }
  }

  // Original D major pentatonic phrases, shaped like a quiet plucked-string
  // melody. Sparse wooden taps give it a gentle pulse without a drum beat.
  const phrases = [
    [74, null, 76, 78, null, 81, 78, null, 76, 74, null, 71, 74, null, 76, null],
    [78, null, 81, null, 83, 81, null, 78, 76, null, 74, 76, null, 78, 76, null]
  ];
  const tempo = 92;
  const stepDuration = 60 / tempo / 2;
  const toFrequency = midi => 440 * Math.pow(2, (midi - 69) / 12);

  function pluck(midi, at, strength = 1) {
    if (!context || !master || !room) return;
    const frequency = toFrequency(midi);
    const voice = context.createGain();
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(Math.min(4200, frequency * 7), at);
    tone.Q.value = 0.45;
    tone.connect(voice);
    voice.connect(master);
    voice.connect(room);

    // A few naturally decaying string partials sound warmer than a triangle
    // wave and leave out the buzzy synth edge.
    const partials = [
      { ratio: 1, level: 0.62, decay: 0.82 },
      { ratio: 2.01, level: 0.2, decay: 0.42 },
      { ratio: 3.98, level: 0.075, decay: 0.22 },
      { ratio: 6.02, level: 0.025, decay: 0.12 }
    ];
    const oscillators = [];
    const partialGains = [];
    partials.forEach((partial, index) => {
      const string = context.createOscillator();
      const partialGain = context.createGain();
      string.type = 'sine';
      string.frequency.setValueAtTime(frequency * partial.ratio, at);
      string.detune.setValueAtTime(index === 1 ? -1.2 : index === 2 ? 0.8 : 0, at);
      partialGain.gain.setValueAtTime(0.0001, at);
      partialGain.gain.linearRampToValueAtTime(0.14 * strength * partial.level, at + 0.006);
      partialGain.gain.exponentialRampToValueAtTime(0.0001, at + partial.decay);
      string.connect(partialGain);
      partialGain.connect(tone);
      string.start(at);
      string.stop(at + partial.decay + 0.035);
      oscillators.push(string);
      partialGains.push(partialGain);
    });

    // A very quiet, short noise touch suggests the string being picked.
    const touchLength = Math.floor(context.sampleRate * 0.018);
    const touchBuffer = context.createBuffer(1, touchLength, context.sampleRate);
    const touchSamples = touchBuffer.getChannelData(0);
    for (let i = 0; i < touchLength; i += 1) {
      touchSamples[i] = (Math.random() * 2 - 1) * (1 - i / touchLength) * 0.5;
    }
    const touch = context.createBufferSource();
    const touchGain = context.createGain();
    touch.buffer = touchBuffer;
    touchGain.gain.value = 0.018 * strength;
    touch.connect(touchGain);
    touchGain.connect(tone);
    touch.start(at);
    touch.stop(at + 0.02);

    oscillators[0].addEventListener('ended', () => {
      oscillators.forEach(string => string.disconnect());
      partialGains.forEach(gain => gain.disconnect());
      touch.disconnect();
      touchGain.disconnect();
      tone.disconnect();
      voice.disconnect();
    }, { once: true });
  }

  function woodTap(at, strength = 1) {
    if (!context || !master) return;
    const length = Math.floor(context.sampleRate * 0.045);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
    const tap = context.createBufferSource();
    const tone = context.createBiquadFilter();
    const envelope = context.createGain();
    tap.buffer = buffer;
    tone.type = 'bandpass';
    tone.frequency.value = 880;
    tone.Q.value = 0.65;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(0.016 * strength, at + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
    tap.connect(tone);
    tone.connect(envelope);
    envelope.connect(master);
    tap.start(at);
    tap.stop(at + 0.05);
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
      const swing = position % 2 === 1 ? stepDuration * 0.045 : 0;
      if (note !== null) pluck(note, nextStepAt + swing, position === 0 || position === 8 ? 1 : 0.78);
      if (position === 0 || position === 8) woodTap(nextStepAt, position === 0 ? 0.48 : 0.34);
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
    if (master && context) master.gain.setTargetAtTime((volume / 100) * 0.28, context.currentTime, 0.08);
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
