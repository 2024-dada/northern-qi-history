(() => {
  'use strict';
  const cases = window.COURT_GAME_CASES;
  const verdicts = {
    support: '已见材料支持', refute: '已见材料否定',
    conflict: '已见呈报有分歧', unknown: '目前材料不足'
  };
  const decrees = {
    severe: { name: '签发重刑诏令', control: 18, trust: -15, result: '严令已发，朝中暂时噤声。下轮呈报可能更谨慎，也可能更不完整。' },
    delay: { name: '暂缓处置', control: -8, trust: 10, result: '处置暂缓，相关人员愿意继续陈述，催办的奏报仍会送来。' },
    review: { name: '交人复核', control: 2, trust: 3, result: '复核任务已经发出。值房继续运转，新的呈报将在下一案展开。' }
  };
  const clamp = value => Math.max(0, Math.min(100, value));

  function randomFor(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let mixed = Math.imul(value ^ value >>> 15, value | 1);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffled(items, random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function makeRun(seed, ruler, firstCase = null) {
    const random = randomFor(seed);
    const chosenRuler = ruler === 'random' ? ['高洋', '高湛', '高纬'][Math.floor(random() * 3)] : ruler;
    const pool = cases.filter(item => item.fiction || item.ruler === chosenRuler);
    let picked = shuffled(pool, random).slice(0, 3);
    if (firstCase) {
      const fixed = pool.find(item => item.id === firstCase);
      if (fixed) picked = [fixed, ...shuffled(pool.filter(item => item !== fixed), random).slice(0, 2)];
    }
    if (picked.every(item => item.fiction)) {
      const historical = shuffled(pool.filter(item => !item.fiction), random)[0];
      picked[Math.floor(random() * 3)] = historical;
    }
    const pressureLabels = ['边报催促回奏', '近臣争执不下', '值房要求尽快定夺'];
    return {
      seed, ruler: chosenRuler, requestedRuler: ruler, firstCase,
      control: 50, trust: 50, tokens: 3, index: 0, history: [],
      rounds: picked.map(item => ({
        id: item.id, order: shuffled([0, 1, 2, 3], random),
        pressure: [4, 8, 12][Math.floor(random() * 3)],
        pressureLabel: pressureLabels[Math.floor(random() * pressureLabels.length)]
      }))
    };
  }
  function expectedVerdict(item, revealed) {
    const kinds = new Set(revealed.map(index => item.clues[index][2]));
    if (kinds.has('support') && kinds.has('refute')) return 'conflict';
    if (kinds.has('support')) return 'support';
    if (kinds.has('refute')) return 'refute';
    return 'unknown';
  }
  function evidenceScore(item, revealed, selected) {
    if (!selected.length || selected.length > 2 || selected.some(index => !revealed.includes(index))) return 0;
    const required = new Set(revealed.map(index => item.clues[index][2]).filter(kind => kind !== 'context'));
    if (!required.size) return selected.every(index => item.clues[index][2] === 'context') ? 6 : 0;
    const supplied = new Set(selected.map(index => item.clues[index][2]));
    const matches = [...required].filter(kind => supplied.has(kind)).length;
    return Math.round(6 * matches / required.size);
  }
  function scoreRun(run) {
    return Math.round((run.history.reduce((sum, item) => sum + item.points, 0) + run.control * .2 + run.trust * .2) * 10) / 10;
  }
  window.COURT_GAME_ENGINE = Object.freeze({ makeRun, expectedVerdict, evidenceScore, scoreRun, decrees });

  const panel = document.querySelector('#court-game');
  if (!panel) return;
  const board = panel.querySelector('[data-court-board]');
  const status = panel.querySelector('[data-court-status]');
  const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  let run = null;
  let draft = null;
  let mode = 'setup';
  let pendingCase = null;
  let best = 0;
  let storageNote = '';
  try { best = Math.max(0, Math.min(100, Number(localStorage.getItem('qi-court-best-v1')) || 0)); }
  catch { storageNote = '浏览器无法保存分数，本次仍可完整游玩。'; }

  const currentCase = () => cases.find(item => item.id === run.rounds[run.index].id);
  const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  const button = (action, label, extra = '') => `<button type="button" data-court-action="${action}" ${extra}>${label}</button>`;
  function links(item) {
    return `<div class="court-source-links">
      <button type="button" data-event="${item.event}">查看${item.fiction ? '关联历史事件' : '原事件'} ↗</button>${item.source ? `<button type="button" data-source="${item.source}">核对史料出处 ↗</button>` : ''}</div>`;
  }
  function announce(message) { status.textContent = message; }
  function render(focusSelector = null) {
    if (mode === 'setup') renderSetup();
    if (mode === 'round') renderRound();
    if (mode === 'result') renderResult();
    if (mode === 'finished') renderFinished();
    if (focusSelector) {
      const target = board.querySelector(focusSelector);
      target?.focus({ preventScroll: true });
      if (focusSelector === 'h3') target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  function renderSetup() {
    const fixed = cases.find(item => item.id === pendingCase);
    board.innerHTML = `<div class="court-intro">
      <div>
      <p class="court-kicker">北齐宫廷 · 三案推演</p>
      <h3 tabindex="-1">一念成诏</h3>
      <p>坐上御座，读奏报、查线索，再决定是否落印。你的选择会改变朝局控制与信任，也会影响下一案先收到什么。</p>
      <p class="court-boundary">史实题引用本站材料。新增呈报、朝局数值与诏令后果均为游戏推演。</p>
      </div>
      <div class="court-setup">
      <label for="court-ruler">选择君主</label>
      <select id="court-ruler" ${fixed ? 'disabled' : ''}>${[['random', '随机君主'], ['高洋', '高洋'], ['高湛', '高湛'], ['高纬', '高纬']].map(([value, label]) => `<option value="${value}" ${fixed?.ruler === value ? 'selected' : ''}>${label}</option>`).join('')}</select>${fixed ? `<p>以「${esc(fixed.title)}」开局，角色为${fixed.ruler}。</p>` : ''}${button('start', run && !run.finished ? '重新开局 · 放弃当前进度' : '登殿开局', 'class="court-primary"')}${run ? button('return', '返回当前牌局') : ''}<p>每局 3 案 · 3 枚查档签 · 约 4–6 分钟</p>
      <p>本机最高分 <strong>${best}</strong> / 100</p>
      </div>
      </div>
      <details class="court-rules">
      <summary>玩法与计分</summary>
      <p>每案免费展开两张呈报，其余每张消耗一枚查档签。选择最多两张作为判断依据，再判断已展开材料是支持、否定、相互矛盾还是不足。可点选卡片，也可把卡片拖进证据区。</p>
      <p>每案判断 14 分，证据匹配 6 分；三案共 60 分。最终控制与信任各占 20 分。只按本轮已经展开的材料判分；仅有背景信息时，「目前材料不足」可得满判断分。</p>
      <p>每轮先承受 4、8 或 12 点控制压力。重刑诏令增加 18 控制、减少 15 信任；暂缓减少 8 控制、增加 10 信任；复核增加 2 控制、增加 3 信任。信任低于 35，下一案先收到两张间接背景呈报。</p>
      <p>数值限制在 0–100。结算可复现同一牌局，最高分保存在当前浏览器。</p>
      </details>
      <p class="court-storage">${esc(storageNote)}</p>`;
  }
  function beginRound() {
    const item = currentCase();
    const round = run.rounds[run.index];
    const indirect = run.trust < 35;
    const first = indirect ? round.order.filter(index => item.clues[index][2] === 'context').slice(0, 2) : round.order.slice(0, 2);
    draft = { revealed: first, selected: [], verdict: '', decree: '', indirect };
    mode = 'round';
    render('h3');
    announce(`第 ${run.index + 1} 案已展开。${indirect ? '信任偏低，先收到两份间接呈报。' : ''}`);
  }
  function metrics() {
    return `<div class="court-metrics">
      <span>君主 <b>${esc(run.ruler)}</b>
      </span>
      <span>第 <b>${run.index + 1}</b> / 3 案</span>
      <label>控制 <b>${run.control}</b>
      <meter min="0" max="100" value="${run.control}">${run.control}</meter>
      </label>
      <label>信任 <b>${run.trust}</b>
      <meter min="0" max="100" value="${run.trust}">${run.trust}</meter>
      </label>
      <span>查档签 <b>${run.tokens}</b> / 3</span>
      </div>`;
  }
  function renderRound() {
    const item = currentCase();
    const round = run.rounds[run.index];
    board.innerHTML = `${metrics()}<div class="court-round-heading">
      <div>
      <p class="court-kicker">${item.fiction ? '全案为虚构推演' : '史实摘要 · 依据本站已收录材料'}</p>
      <h3 tabindex="-1">${esc(item.title)}</h3>
      </div>${button('setup', '换角色 / 重开')}</div>
      <p class="court-pressure">本轮推演压力 · ${round.pressureLabel}，落印时控制 −${round.pressure}。${draft.indirect ? '信任低于 35，先送达两份间接呈报。' : ''}</p>
      <p class="court-claim">
      <strong>本轮要判断的陈述</strong>${esc(item.claim)}</p>
      <div class="court-clues">${round.order.map(index => {
      const [title, content] = item.clues[index];
      const opened = draft.revealed.includes(index);
      const chosen = draft.selected.includes(index);
      return `<article class="court-clue ${opened ? 'is-open' : 'is-sealed'} ${chosen ? 'is-selected' : ''}" ${opened ? `draggable="true" data-court-drag="${index}"` : ''}>
      <h4>${esc(opened ? title : '封存线索')}</h4>${opened ? `<p>${esc(content)}</p>
      <label>
      <input type="checkbox" data-court-evidence="${index}" ${chosen ? 'checked' : ''}> 用作判断依据</label>` : `<p>展开后可加入判断依据。</p>${button('reveal', '查档 · 消耗 1 签', `data-clue="${index}" ${run.tokens ? '' : 'disabled'}`)}`}</article>`;
    }).join('')}</div>
      <div class="court-evidence" data-court-drop role="group" aria-label="已选证据">
      <strong>判断依据 · ${draft.selected.length} / 2</strong>
      <p>${draft.selected.length ? draft.selected.map(index => esc(item.clues[index][0])).join(' ＋ ') : '点选已展开卡片的复选框，或拖动卡片到这里。'}</p>
      <small>建议选择直接涉及本轮陈述的材料；只有背景信息时也可据此判断材料不足。</small>
      </div>
      <fieldset class="court-options">
      <legend>你怎样看待已展开的材料？</legend>${Object.entries(verdicts).map(([key, label]) => `<label>
      <input type="radio" name="court-verdict" value="${key}" ${draft.verdict === key ? 'checked' : ''}>${label}</label>`).join('')}</fieldset>
      <fieldset class="court-options court-decrees">
      <legend>本轮诏令 · 后果均为推演</legend>${Object.entries(decrees).map(([key, value]) => `<label>
      <input type="radio" name="court-decree" value="${key}" ${draft.decree === key ? 'checked' : ''}>
      <span>
      <b>${value.name}</b>
      <small>控制 ${value.control > 0 ? '+' : ''}${value.control} · 信任 ${value.trust > 0 ? '+' : ''}${value.trust}</small>
      </span>
      </label>`).join('')}</fieldset>
      <div class="court-submit">${button('seal', '落印 · 签发诏令', 'class="court-seal"')}<p>选择判断依据、材料判断和诏令后即可落印。</p>
      </div>`;
  }
  function reveal(index) {
    if (mode !== 'round' || run.tokens <= 0 || draft.revealed.includes(index)) return;
    if (!run.rounds[run.index].order.includes(index)) return;
    run.tokens--;
    draft.revealed.push(index);
    render(`[data-court-evidence="${index}"]`);
    announce(`已展开「${currentCase().clues[index][0]}」，剩余 ${run.tokens} 枚查档签。`);
  }
  function selectEvidence(index, selected) {
    if (mode !== 'round' || !draft.revealed.includes(index)) return;
    if (selected && !draft.selected.includes(index)) {
      if (draft.selected.length === 2) {
        render(`[data-court-evidence="${index}"]`);
        announce('最多选择两张证据，请先取消一张。');
        return;
      }
      draft.selected.push(index);
    } else if (!selected) draft.selected = draft.selected.filter(value => value !== index);
    render(`[data-court-evidence="${index}"]`);
    announce(`已选择 ${draft.selected.length} 张判断依据。`);
  }
  function seal() {
    if (mode !== 'round') return;
    if (!draft.selected.length || !draft.verdict || !draft.decree) {
      announce('请先选择至少一张判断依据、一个材料判断和一种诏令。');
      const target = !draft.selected.length ? '[data-court-evidence]' : !draft.verdict ? '[name="court-verdict"]' : '[name="court-decree"]';
      board.querySelector(target)?.focus();
      return;
    }
    const item = currentCase();
    const expected = expectedVerdict(item, draft.revealed);
    const judgmentPoints = draft.verdict === expected ? 14 : 0;
    const proofPoints = evidenceScore(item, draft.revealed, draft.selected);
    const decree = decrees[draft.decree];
    const oldControl = run.control;
    const oldTrust = run.trust;
    run.control = clamp(run.control - run.rounds[run.index].pressure + decree.control);
    run.trust = clamp(run.trust + decree.trust);
    run.history.push({
      id: item.id, expected, verdict: draft.verdict, decree: draft.decree,
      revealed: [...draft.revealed], selected: [...draft.selected],
      judgmentPoints, proofPoints, points: judgmentPoints + proofPoints,
      controlDelta: run.control - oldControl, trustDelta: run.trust - oldTrust
    });
    mode = 'result';
    render('h3');
    announce(`诏令已签发。本案获得 ${judgmentPoints + proofPoints} / 20 分。`);
  }
  function renderResult() {
    const item = currentCase();
    const result = run.history[run.index];
    const delta = number => `${number > 0 ? '+' : ''}${number}`;
    board.innerHTML = `${metrics()}<div class="court-result">
      <span class="court-stamp" aria-hidden="true">诏已下</span>
      <p class="court-kicker">第 ${run.index + 1} 案结算 · 推演后果</p>
      <h3 tabindex="-1">${decrees[result.decree].name}</h3>
      <p>${decrees[result.decree].result}</p>
      <p>
      <b>控制 ${delta(result.controlDelta)} · 信任 ${delta(result.trustDelta)}</b>（已计入本轮压力）</p>
      <div class="court-score">
      <b>${result.points}</b>
      <span>/ 20<br>判断 ${result.judgmentPoints} / 14 · 证据 ${result.proofPoints} / 6</span>
      </div>
      <h4>回看这次判断</h4>
      <p>你的判断是「${verdicts[result.verdict]}」。按已展开的材料，本轮应判为「${verdicts[result.expected]}」。</p>
      <p>${result.expected === 'unknown' ? '你目前展开的材料只提供背景，足以说明需要继续查档。' : esc(item.explanation)}</p>
      <p>你选择的依据为 ${result.selected.map(index => `「${esc(item.clues[index][0])}」`).join('、')}。</p>
      <p>${result.proofPoints === 6 ? '所选依据覆盖了已展开材料中与陈述相关的方向。' : '证据分要求覆盖已见的支持或否定方向；出现相反呈报时，两个方向都需要引用。'}</p>
      <details>
      <summary>查看全部线索与题目说明</summary>${item.clues.map(([title, content, kind]) => `<p>
      <b>${esc(title)}</b> · ${kind === 'context' ? '背景材料' : kind === 'support' ? '支持方向' : '否定方向'}<br>${esc(content)}</p>`).join('')}<p>${esc(item.explanation)}</p>
      </details>${links(item)}${button('next', run.index === 2 ? '合卷 · 查看总分' : '下一案 →', 'class="court-primary"')}</div>`;
  }
  function finish() {
    mode = 'finished';
    run.finished = true;
    const score = scoreRun(run);
    if (score > best) {
      best = score;
      try { localStorage.setItem('qi-court-best-v1', String(best)); }
      catch { storageNote = '本次最高分无法保存在浏览器中。'; }
    }
    render('h3');
    announce(`三案结束，总分 ${score} / 100。`);
  }
  function renderFinished() {
    const points = run.history.reduce((sum, result) => sum + result.points, 0);
    board.innerHTML = `<div class="court-result">
      <p class="court-kicker">${esc(run.ruler)} · 三案已结</p>
      <h3 tabindex="-1">一念之后，回看诏令</h3>
      <div class="court-score">
      <b>${scoreRun(run)}</b>
      <span>/ 100<br>本机最高 ${best}</span>
      </div>
      <p>判断与证据 ${points} / 60 · 控制 ${(run.control * .2).toFixed(1)} / 20 · 信任 ${(run.trust * .2).toFixed(1)} / 20</p>
      <p>这局的分数同时记录查证质量和推演中的朝局代价。每项诏令如何影响历史，需要回到原事件核对。</p>
      <ol class="court-recap">${run.history.map(result => {
      const item = cases.find(entry => entry.id === result.id);
      return `<li>
      <h4>${esc(item.title)} · ${result.points} / 20</h4>
      <p>${decrees[result.decree].name} · ${verdicts[result.verdict]}</p>
      <p>${esc(item.explanation)}</p>${links(item)}</li>`;
    }).join('')}</ol>
      <div class="court-replay">${button('replay', '原局重玩')}${button('new', '随机新局', 'class="court-primary"')}${button('setup', '重新选君主')}</div>
      <p class="court-storage">${esc(storageNote)}</p>
      <small>牌局编号 ${run.seed} · 题库 v1 · 原局重玩恢复相同君主、案序和开场随机安排，后续呈报仍受你的新选择影响。</small>
      </div>`;
  }

  panel.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-court-evidence]')) selectEvidence(Number(input.dataset.courtEvidence), input.checked);
    if (mode === 'round' && input.name === 'court-verdict') draft.verdict = input.value;
    if (mode === 'round' && input.name === 'court-decree') draft.decree = input.value;
  });
  panel.addEventListener('click', event => {
    const target = event.target.closest('[data-court-action]');
    if (!target) return;
    const action = target.dataset.courtAction;
    if (action === 'start') {
      const fixed = cases.find(item => item.id === pendingCase);
      run = makeRun(freshSeed(), fixed?.ruler || board.querySelector('#court-ruler').value, pendingCase);
      beginRound();
    }
    if (action === 'reveal') reveal(Number(target.dataset.clue));
    if (action === 'seal') seal();
    if (action === 'next' && mode === 'result') {
      if (run.index === 2) finish();
      else { run.index++; beginRound(); }
    }
    if (action === 'setup') { pendingCase = null; mode = 'setup'; render('h3'); }
    if (action === 'return' && run) { mode = run.history.length > run.index ? (run.finished ? 'finished' : 'result') : 'round'; render('h3'); }
    if (action === 'replay' && mode === 'finished') { run = makeRun(run.seed, run.requestedRuler, run.firstCase); beginRound(); }
    if (action === 'new' && mode === 'finished') { run = makeRun(freshSeed(), 'random'); beginRound(); }
  });
  panel.addEventListener('dragstart', event => {
    const card = event.target.closest('[data-court-drag]');
    if (card && event.dataTransfer) event.dataTransfer.setData('text/plain', 'qi-court:' + card.dataset.courtDrag);
  });
  panel.addEventListener('dragover', event => { if (event.target.closest('[data-court-drop]')) event.preventDefault(); });
  panel.addEventListener('drop', event => {
    if (!event.target.closest('[data-court-drop]')) return;
    event.preventDefault();
    const match = /^qi-court:([0-3])$/.exec(event.dataTransfer?.getData('text/plain') || '');
    if (match) selectEvidence(Number(match[1]), true);
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-court-open]');
    if (!trigger) return;
    pendingCase = trigger.dataset.courtOpen || null;
    mode = 'setup';
    const dialog = document.querySelector('#detail-dialog');
    if (dialog.open) dialog.querySelector('.dialog-close').click();
    render('h3');
    panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  });
  const dialogBody = document.querySelector('#dialog-body');
  new MutationObserver(() => {
    const actions = dialogBody.querySelector('.event-actions');
    const permalink = dialogBody.querySelector('[data-event-permalink]');
    if (!actions || !permalink || actions.querySelector('[data-court-open]')) return;
    const hash = new URL(permalink.href).hash;
    const eventId = new URLSearchParams(hash.slice(1)).get('event');
    const item = cases.find(entry => !entry.fiction && entry.event === eventId);
    if (item) actions.insertAdjacentHTML('beforeend', `<button type="button" data-court-open="${item.id}">以此案开始宫廷推演 ↗</button>`);
  }).observe(dialogBody, { childList: true, subtree: true });
  render();
})();
