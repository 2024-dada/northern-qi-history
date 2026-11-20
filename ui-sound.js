/* Quiet interface sounds for the reading site, synthesised with Web Audio (no extra downloads).
   Wood tick for navigation, paper turn for switching panels, a soft plucked string when a
   source card opens and a lower one when it closes. Off with one switch; the choice is remembered. */
(() => {
  'use strict';
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const toggle = document.querySelector('[data-ui-sfx]');
  const label = document.querySelector('[data-ui-sfx-label]');
  if (!AudioContextClass) { toggle?.setAttribute('hidden', ''); return; }

  const KEY = 'qi-ui-sfx';
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'false'; } catch { /* optional */ }
  let ctx, master, noise;
  const last = new Map();

  function render() {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(enabled));
    if (label) label.textContent = enabled ? '交互音效：开' : '交互音效：关';
  }

  function setup() {
    if (ctx) return true;
    try {
      ctx = new AudioContextClass();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = .003; comp.release.value = .2;
      master = ctx.createGain();
      master.gain.value = .5;
      master.connect(comp); comp.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * .6, ctx.sampleRate);
      const d = noise.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) { // soft pink-ish noise
        const w = Math.random() * 2 - 1;
        b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .2965; b2 = .57 * b2 + w * 1.0526;
        d[i] = (b0 + b1 + b2 + w * .1848) * .2;
      }
      return true;
    } catch { ctx = null; return false; }
  }

  function env(gain, at, peak, attack, decay) {
    gain.setValueAtTime(.0001, at);
    gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.exponentialRampToValueAtTime(.0001, at + attack + decay);
  }
  function burst(at, {type = 'bandpass', from, to, q = 1, peak, attack = .004, decay, offset = 0}) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
    env(g.gain, at, peak, attack, decay);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(at, offset); src.stop(at + attack + decay + .02);
  }
  function partial(at, freq, peak, decay, bend = 1, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(freq * bend, at + decay);
    env(g.gain, at, peak, .006, decay);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + decay + .05);
  }

  const voices = {
    tick(at) { // small wooden block
      partial(at, 1180, .09, .05, .82);
      partial(at, 2350, .025, .03, .9);
      burst(at, {from: 3200, to: 2400, q: 2.5, peak: .05, decay: .025});
    },
    page(at) { // paper turning
      burst(at, {from: 900, to: 3600, q: .7, peak: .11, attack: .03, decay: .16, offset: Math.random() * .3});
      burst(at + .05, {type: 'highpass', from: 4200, to: 5200, q: .4, peak: .035, attack: .02, decay: .09});
    },
    pluck(at, root = 293.66) { // plucked silk string, slight downward slide like 绰注
      partial(at, root, .16, 1.25, .985);
      partial(at, root * 2, .07, .8, .99);
      partial(at, root * 3, .035, .45, .995);
      partial(at, root * 4.02, .015, .28);
      burst(at, {from: 2600, to: 900, q: 1.4, peak: .045, decay: .05});
    },
    close(at) { voices.pluck(at, 220); }
  };

  function play(kind, ...args) {
    if (!enabled || !setup()) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    if (now - (last.get(kind) ?? -1) < .06) return;
    last.set(kind, now);
    try { voices[kind](now + .005, ...args); } catch { /* never block the click */ }
  }

  const rules = [
    ['[data-music-toggle],[data-music-volume],[data-ui-sfx]', null],
    ['[data-source],[data-event],[data-open-method],[data-event-source]', 'pluck'],
    ['.dialog-close,[data-back-event]', 'close'],
    ['.timeline button,.segmented button,.scene-steps button,.network-node,.explore-views button,[data-gallery-ruler],[data-version]', 'page'],
    ['.site-header nav>a,.chapter-rail a,.case-preview a,.visit-guide a,.next-chapter,.qi-chronology a,.hero-actions a,summary,.text-button,[data-ui-settings],.scene-play,.scene-replay,.sidebar-toggle', 'tick']
  ];
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    for (const [selector, kind] of rules) {
      if (event.target.closest(selector)) { if (kind) play(kind); return; }
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('dialog[open]')) play('close');
  }, true);

  toggle?.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(KEY, String(enabled)); } catch {}
    render();
    if (enabled) play('tick');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ctx?.state === 'running') ctx.suspend().catch(() => {});
  });
  render();
  window.QI_UI_SOUND = Object.freeze({play});
})();
