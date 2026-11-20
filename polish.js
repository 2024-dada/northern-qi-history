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

/* Copy the site citation. */
(() => {
  'use strict';
  const button = document.querySelector('[data-copy-citation]');
  if (!button) return;
  button.addEventListener('click', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const text = `《帝怒之后：北齐高氏暴力事件与史料叙述》，中国历史概论课程交互网页，2026。https://2024-dada.github.io/northern-qi-history/（${day}访问）。`;
    try { await navigator.clipboard.writeText(text); button.textContent = '已复制引用格式'; }
    catch { button.textContent = '无法自动复制，请手动选取上方文字'; }
    setTimeout(() => { button.textContent = '复制引用格式'; }, 2400);
  });
})();

/* Inline glossary: the first mention of a term in each section opens its definition in place. */
(() => {
  'use strict';
  const list = document.querySelector('.glossary-list');
  if (!list) return;
  const defs = new Map();
  for (const row of list.querySelectorAll(':scope > div')) {
    const title = row.querySelector('dt')?.textContent.trim();
    const text = row.querySelector('dd')?.textContent.trim();
    if (!title || !text) continue;
    for (const part of title.split(/\s*[\/·]\s*/)) defs.set(part.trim(), {title, text});
  }
  const terms = ['后妃传', '本纪', '列传', '《北齐书》', '《北史》', '《资治通鉴》', '《魏书》', '太上皇', '宗室', '近臣', '天保', '禅让', '影印', '录文', '异文'].filter(t => defs.has(t));
  if (!terms.length) return;
  const pattern = new RegExp(terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  const scopes = document.querySelectorAll('.has-sidebar :is(.orientation,.case-preview,.chapter,.visit-guide,.sources>p,.violence-intro)');
  const skip = 'a,button,sup,blockquote,mark,h1,h2,h3,h4,label,summary,.eyebrow,.glossary,.qi-term,script,style,svg,[data-card-reading]';
  let serial = 0;
  for (const scope of scopes) {
    const seen = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest(skip) || !pattern.test(node.data) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (let node of nodes) {
      let match;
      while (node && (match = node.data.match(pattern))) {
        const word = match[0];
        if (seen.has(word)) {
          const rest = node.data.slice(match.index + word.length);
          if (!pattern.test(rest)) break;
          node = node.splitText(match.index + word.length);
          continue;
        }
        seen.add(word);
        const after = node.splitText(match.index);
        const tail = after.splitText(word.length);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'qi-term';
        button.dataset.term = word;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'qi-term-pop');
        button.id = 'qi-term-' + serial++;
        button.textContent = word;
        after.replaceWith(button);
        node = tail;
      }
    }
  }
  const pop = document.createElement('div');
  pop.id = 'qi-term-pop';
  pop.className = 'qi-term-pop';
  pop.setAttribute('role', 'dialog');
  pop.hidden = true;
  pop.innerHTML = '<strong></strong><p></p><a href="#glossary">在读史小词典中查看全部词条 ↓</a>';
  document.body.append(pop);
  let current = null;
  function close() {
    if (!current) return;
    current.setAttribute('aria-expanded', 'false');
    pop.hidden = true;
    current = null;
  }
  function open(button) {
    const def = defs.get(button.dataset.term);
    if (!def) return;
    if (current === button) { close(); return; }
    close();
    current = button;
    button.setAttribute('aria-expanded', 'true');
    pop.querySelector('strong').textContent = def.title;
    pop.querySelector('p').textContent = def.text;
    pop.setAttribute('aria-label', def.title + ' 的解释');
    pop.hidden = false;
    const box = button.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    pop.style.width = width + 'px';
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, box.left + box.width / 2 - width / 2));
    const below = box.bottom + 10 + pop.offsetHeight < window.innerHeight;
    pop.style.left = left + window.scrollX + 'px';
    pop.style.top = (below ? box.bottom + 10 : box.top - pop.offsetHeight - 10) + window.scrollY + 'px';
    pop.dataset.side = below ? 'below' : 'above';
  }
  document.addEventListener('click', event => {
    const term = event.target.closest?.('.qi-term');
    if (term) { event.preventDefault(); open(term); return; }
    if (current && !event.target.closest?.('.qi-term-pop')) close();
    if (event.target.closest?.('.qi-term-pop a')) close();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && current) { const b = current; close(); b.focus(); } });
  window.addEventListener('resize', close);
})();
