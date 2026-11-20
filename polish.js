/* Gentle section reveal. Sections already on screen at load stay put; nothing hides without JS. */
(() => {
  'use strict';
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = [...document.querySelectorAll(
    '.has-sidebar :is(.visit-guide,.orientation,.case-preview,.chapter,.family-stories,.survival-launch,.sources)'
  )];
  if (!targets.length) return;
  const viewport = window.innerHeight || document.documentElement.clientHeight;
  for (const el of targets) {
    const box = el.getBoundingClientRect();
    if (box.top < viewport * 0.92 && box.bottom > 0) continue;
    el.classList.add('qi-reveal');
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }
  }, {rootMargin: '0px 0px -6% 0px', threshold: 0.04});
  document.documentElement.classList.add('qi-reveal-ready');
  for (const el of targets) if (el.classList.contains('qi-reveal')) observer.observe(el);
  // A jump (anchor, deep link, print) should never land on a half-hidden section.
  const revealAll = () => targets.forEach(el => el.classList.add('is-revealed'));
  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id || id.includes('=')) return;
    document.getElementById(id)?.closest('.qi-reveal')?.classList.add('is-revealed');
  });
  window.addEventListener('beforeprint', revealAll);
})();
