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
  // People: reign years and roles follow the standard accounts in 《北齐书》《北史》.
  const people = {
    '高欢': ['东魏权臣，北齐政权的奠基者', '547 年去世，高洋称帝后追尊为神武帝。他的儿子高澄、高洋、高演、高湛先后掌权。', '#people'],
    '高澄': ['高欢长子，东魏权臣', '北齐建立前掌握东魏朝政，549 年遇刺身亡，后被追尊为文襄帝。', '#people'],
    '高洋': ['北齐文宣帝，550—559 年在位', '高欢次子，550 年受东魏禅让建立北齐。本站第一案（高德政）与第四案（薛嫔）都发生在他在位时。', '#chapter-1'],
    '高演': ['北齐孝昭帝，560—561 年在位', '高欢之子，废黜高洋之子高殷后即位，在位约一年。', '#people'],
    '高湛': ['北齐武成帝，561—565 年在位', '高欢之子。565 年传位给儿子高纬，自称太上皇，仍掌实权，569 年去世。', '#people'],
    '高纬': ['北齐后主，565—577 年在位', '高湛之子。第二案（斛律光）、第三案（高俨）都由他下令；577 年北齐被北周所灭。', '#chapter-2'],
    '高俨': ['琅琊王，高纬之弟', '曾诛杀权臣和士开并调动军队，571 年被高纬下令杀害。本站第三案。', '#chapter-3'],
    '高德政': ['北齐开国旧臣', '曾协助高洋受禅建国，后因多次劝谏与高洋冲突，559 年与妻、子一同被杀。本站第一案。', '#chapter-1'],
    '斛律光': ['北齐名将，掌兵重臣', '名将斛律金之子，女儿是高纬的皇后。572 年被召入宫杀害，史书记其时年五十八。本站第二案。', '#chapter-2'],
    '祖珽': ['北齐大臣，后主时掌权', '与斛律光不和，利用北周散布的谣言进言；高俨案中又以古代杀亲典故劝高纬。', '#chapter-2'],
    '和士开': ['武成帝、后主的宠臣', '长期左右朝政，571 年被高俨假传命令诛杀，高俨案由此而起。', '#chapter-3'],
    '韦孝宽': ['北周名将', '史书记他编造并散布针对斛律光的歌谣，是斛律光案中“敌方谣言”的来源。', '#chapter-2'],
    '刘桃枝': ['北齐宫中力士', '多次奉命执行杀害，斛律光案中“自后拉而杀之”的执行者。', '#chapter-2'],
    '薛嫔': ['高洋的嫔妃', '被高洋杀害。《北史》本纪与后妃传对其遇害的时间和情由记载不同。本站第四案。', '#chapter-4']
  };
  for (const [name, [role, text, link]] of Object.entries(people)) defs.set(name, {title: name, role, text, link});
  const terms = ['后妃传', '本纪', '列传', '《北齐书》', '《北史》', '《资治通鉴》', '《魏书》', '太上皇', '宗室', '近臣', '天保', '禅让', '影印', '录文', '异文', ...Object.keys(people).sort((a, b) => b.length - a.length)].filter(t => defs.has(t));
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
        button.className = people[word] ? 'qi-term qi-person' : 'qi-term';
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
  pop.innerHTML = '<strong></strong><em></em><p></p><a href="#glossary">在读史小词典中查看全部词条 ↓</a>';
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
    const role = pop.querySelector('em');
    role.textContent = def.role || '';
    role.hidden = !def.role;
    pop.querySelector('p').textContent = def.text;
    const link = pop.querySelector('a');
    link.href = def.link || '#glossary';
    link.textContent = def.link ? (def.link === '#people' ? '回到人物关系与族谱 ↑' : '查看相关案例 ↗') : '在读史小词典中查看全部词条 ↓';
    pop.classList.toggle('is-person', Boolean(def.role));
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

/* Estimated reading time for each case (about 400 Chinese characters a minute). */
(() => {
  'use strict';
  for (const chapter of document.querySelectorAll('.has-sidebar .chapter')) {
    const eyebrow = chapter.querySelector(':scope > .eyebrow');
    if (!eyebrow || eyebrow.querySelector('.qi-readtime')) continue;
    const chars = (chapter.innerText || chapter.textContent || '').replace(/\s+/g, '').length;
    const minutes = Math.max(1, Math.round(chars / 400));
    const chip = document.createElement('span');
    chip.className = 'qi-readtime';
    chip.textContent = `约 ${minutes} 分钟`;
    chip.setAttribute('aria-label', `本节预计阅读约 ${minutes} 分钟`);
    eyebrow.append(chip);
  }
})();
