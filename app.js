(() => {
  'use strict';
  const data=window.RESEARCH, dialog=document.querySelector('#detail-dialog'), body=document.querySelector('#dialog-body');
  const escape=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const links=(source)=>source.links.map(([label,url])=>`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`).join('');
  const memory={read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}};
  const savedValues=memory.read('qi-saved-events',[]);
  const saved=new Set(Array.isArray(savedValues)?savedValues.filter(id=>data.events.some(e=>e.id===id)):[]);
  const readValues=memory.read('qi-read-events',[]);
  const readEvents=new Set(Array.isArray(readValues)?readValues.filter(id=>data.events.some(e=>e.id===id)):[]);
  let searchWords=[];
  function highlighted(value){
    if(!searchWords.length)return escape(value);
    const pattern=new RegExp('('+searchWords.map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','giu');
    return String(value).split(pattern).map((part,i)=>i%2?`<mark>${escape(part)}</mark>`:escape(part)).join('');
  }
  let onlySaved=false, lastChapter=null;
  let returnFocus=null, parentEvent=null, parentVisual=null, activeEvent=null;
  function show(content){dialog.classList.remove('scene-expanded');if(!dialog.open)returnFocus=document.activeElement;body.innerHTML=content;if(!dialog.open)dialog.showModal();document.documentElement.classList.add('detail-open');dialog.scrollTop=0;dialog.querySelector('.dialog-close').focus();}
  function sourceDetail(key,backEvent=null){activeEvent=null;const s=data.sources[key];if(!s)return;parentEvent=backEvent;show(`<p class="eyebrow">原典出处 / [${s.number}]</p><h2 id="dialog-title">${escape(s.title)}</h2><p>${escape(s.book)}</p><h3>所用版本与入口</h3><p>${escape(s.edition)}</p><h3>原文短引 · 简体转写</h3><blockquote>${escape(s.quote||'原句定位与影印核对待完成；此处不生成引文。').replace(/\n/g,'<br>')}</blockquote><h3>白话与阅读提示</h3><p>${escape(s.explanation)}</p><div class="source-state">${escape(s.status)}</div><div class="dialog-links">${links(s)}</div>${backEvent?'<button class="dialog-back" data-back-event>← 返回事件详情</button>':''}`);}
  function eventDetail(id,visualKey=null){const e=data.events.find(x=>x.id===id);if(!e)return;activeEvent=id;readEvents.add(id);memory.write('qi-read-events',[...readEvents]);renderEvents();parentEvent=null;const s=data.sources[e.source];const visual=data.visuals?.find(v=>v.key===visualKey&&v.event===id)||data.visuals?.find(v=>v.event===id);parentVisual=visual?.key;const dossier=e.dossier||data.dossierForEvent?.[id];const related=(data.relatedEvents?.[id]||[]).map(key=>data.events.find(x=>x.id===key)).filter(Boolean);const controls=(visual||dossier)?`<div class="scene-detail-controls">${['motion','speed','replay'].map(action=>`<button type="button" data-animation-action="${action}">${escape(document.querySelector('#violence-'+action)?.textContent||({motion:'播放／暂停',speed:'速度切换',replay:'重播'})[action])}</button>`).join('')}${visual?'<label class="scene-scrub-label">动作进度<input type="range" min="0" max="100" step="1" value="0" data-scene-progress aria-label="场景动作进度"><output data-scene-time>0%</output></label>':''}</div>`:'';const extra=dossier?`<section class="detail-visual"><p class="visual-label">${escape(dossier.status)}</p>${data.dossierArtwork(dossier,true)}${e.dossier?"":`<p>${escape(dossier.account)}</p>`}<p class="visual-boundary">${escape(dossier.boundary)}</p></section>`:'';const visualPanel=visual?`<section class="detail-visual" aria-label="暴力方式与史料边界"><p class="visual-label">${escape(visual.tag)} · ${escape(visual.status)}</p>${data.visualArtwork(visual,"detail-"+visual.key)}<blockquote>${escape(visual.quote)}</blockquote><p class="visual-boundary">${escape(visual.boundary)}</p><p><strong>往深处问：</strong>${escape(visual.question)}</p></section>`:"";show(`<p class="eyebrow">${escape(e.id)} / ${escape(e.ruler)} / ${escape(e.year)}</p><h2 id="dialog-title">${escape(e.name)}</h2><p>${escape(e.type)}</p><div class="event-actions"><a href="#event=${escape(e.id)}${visual?`&visual=${escape(visual.key)}`:""}" data-event-permalink>此事件的独立链接 ↗</a><button type="button" data-copy-event>复制链接</button><button type="button" data-save-event="${escape(e.id)}" aria-pressed="${saved.has(e.id)}">${saved.has(e.id)?'★ 已收藏':'☆ 收藏材料'}</button><span class="event-feedback" role="status" aria-live="polite"></span></div>${controls}${visual?'<div class="scene-inspection"><button type="button" data-scene-once>单次播放</button><button type="button" data-scene-nudge="-1" aria-label="动画进度后退百分之一">−1%</button><button type="button" data-scene-nudge="1" aria-label="动画进度前进百分之一">+1%</button><button type="button" data-expand-scene aria-pressed="false">放大画面 ⤢</button><span data-scene-state role="status" aria-live="polite">可拖动进度，逐步查看动作</span></div><div class="scene-jumps" role="group" aria-label="动画关键帧"><span>逐步看动作</span><button type="button" data-scene-jump="20">① 蓄势</button><button type="button" data-scene-jump="45">② 接触</button><button type="button" data-scene-jump="75">③ 后果</button></div>':""}${visualPanel}${extra}<h3>事件处境</h3><p>${escape(e.context)}</p><h3>谁推动、谁下令、谁执行</h3><p>${escape(e.agency)}</p>${s.quote?`<blockquote>${escape(s.quote).replace(/\n/g,'<br>')}</blockquote>`:''}${e.boundary?`<div class="source-state">${escape(e.status)}<br>${escape(e.boundary)}</div>`:''}<h3>原因初析 · 主次暂定</h3><p><strong>主要候选：</strong>${escape(e.primary)}</p><p><strong>次要／促成：</strong>${escape(e.secondary)}</p><div class="source-state">${escape(s.status)}<br>原因排序是本项目初析，未完成现代学术研究核验。</div><button class="related-source" data-event-source="${e.source}" data-parent-event="${e.id}">展开出处 [${s.number}] ↗</button><div class="dialog-links">${links(s)}</div>${related.length?`<h3>沿同一问题继续</h3>${related.map(x=>`<button class="related-source" data-event="${x.id}">${escape(x.name)} ↗</button>`).join(" ")}`:""}`);}
  function methodDetail(){activeEvent=null;parentEvent=null;show('<p class="eyebrow">关于史料</p><h2 id="dialog-title">先核事件，再谈解释。</h2><p>这份网页把死亡、伤害、宫廷行为与比较材料放在同一档案中。它不是全书事件统计，也不把样本数量作为人物残暴排名。</p><h3>我们怎样区分材料</h3><ul><li>事件与记载分开：同一次死亡在多书出现，不重复计数。</li><li>亲自实施、下令、促成与执行分开；年号不能直接决定施事者。</li><li>原文、白话、史臣评价和项目解释分开。</li><li>字词、日期或叙述有分歧时，保留分歧，回到影印核字。</li></ul><h3>为什么多来源还要检查文本关系</h3><p>《四库全书总目》记载传世《北齐书》有取《北史》补亡的情况。多个书名可能承袭同一文本，不能自动成为独立见证。</p><div class="dialog-links"><a href="https://www.shidianguji.com/book/SK0000A/chapter/1kgsnkeqjizoo" target="_blank" rel="noopener noreferrer">识典 · 北齐书提要 ↗</a></div><h3>当前核验状态</h3><p>已做原典录文初对照；关键句影印核字、版本关系和现代学术解释仍待完成。示意图只帮助理解，不能充当历史现场证据。</p><div class="source-state">人物对话为史书所述，不标作现场逐字录音；宫阙、人物与位置图均为示意。</div>');}
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{document.documentElement.classList.remove('detail-open');activeEvent=null;if(location.hash.startsWith('#event='))history.replaceState(null,'',location.pathname+location.search+'#explore');if(returnFocus?.isConnected)returnFocus.focus();parentEvent=null;});
  document.addEventListener('click',event=>{const t=event.target.closest('[data-animation-action],[data-source],[data-event],[data-open-method],[data-event-source],[data-back-event]');if(!t)return;if(t.hasAttribute('data-animation-action')){document.querySelector('#violence-'+t.dataset.animationAction)?.click();dialog.querySelectorAll('[data-animation-action]').forEach(b=>b.textContent=document.querySelector('#violence-'+b.dataset.animationAction).textContent);return;}if(t.hasAttribute('data-source'))sourceDetail(t.dataset.source);else if(t.hasAttribute('data-event'))eventDetail(t.dataset.event,t.dataset.visual);else if(t.hasAttribute('data-open-method'))methodDetail();else if(t.hasAttribute('data-event-source'))sourceDetail(t.dataset.eventSource,t.dataset.parentEvent);else if(t.hasAttribute('data-back-event')&&parentEvent)eventDetail(parentEvent,parentVisual);});
  const art={scroll:'<path d="M25 20h70v100H25zM25 20q-20 0-12 14h12M95 120q20 0 12-14H95"/><path d="M42 40h36M42 56h36M42 72h23M42 88h36"/>',network:'<circle cx="60" cy="55" r="16"/><circle cx="22" cy="105" r="10"/><circle cx="100" cy="105" r="10"/><path d="M50 70l-22 25M70 70l22 25M22 40h25M100 40H74"/>',command:'<path d="M20 25h80v45H20zM60 70v28M45 87l15 15 15-15M30 120h60"/><path d="M35 43h50M35 55h35"/>',seal:'<path d="M40 20h40v26H40zM25 46h70v28H25zM20 110h80v13H20z"/><path d="M40 92h40" stroke="#9d4236"/>'};
  function stage(index){const s=data.stages[index];document.querySelectorAll('[data-stage]').forEach(b=>{const active=Number(b.dataset.stage)===index;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelector('#stage-index').textContent=String(index+1).padStart(2,'0');document.querySelector('#stage-kicker').textContent=s.kicker;document.querySelector('#stage-title').textContent=s.title;document.querySelector('#stage-text').textContent=s.text;document.querySelector('#stage-quote').textContent=s.quote;document.querySelector('#stage-quote-label').textContent=([0,3].includes(index)?'史书短引 · 简体转写':'阅读提示 · 项目概括');document.querySelector('#stage-art').innerHTML=`<svg viewBox="0 0 120 145" fill="none" stroke="#8b8f79" stroke-width="1.5">${art[s.symbol]}</svg>`;}
  document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>stage(Number(b.dataset.stage))));stage(0);
  function node(key){const n=data.nodes[key];document.querySelectorAll('[data-node]').forEach(b=>{const active=b.dataset.node===key;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelector('#node-role').textContent=n.role;document.querySelector('#node-title').textContent=n.title;document.querySelector('#node-text').textContent=n.text;}
  document.querySelectorAll('[data-node]').forEach(b=>b.addEventListener('click',()=>node(b.dataset.node)));node('ruler');
  const conclusions={annals:'本纪突出突然发作；仅凭这一段，无法解释所有此前过程。',biography:'后妃传显示延续过程；但不能凭时间延伸就否定情绪因素。',both:'两种叙述重心不同。对既往关系的猜忌有线索，突然失控与延续惩罚的权重仍不能确定。'};
  function version(key){document.querySelectorAll('[data-version]').forEach(b=>{const active=b.dataset.version===key;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-text]').forEach(a=>a.hidden=key!=='both'&&a.dataset.text!==key);document.querySelector('.comparison').classList.toggle('single',key!=='both');document.querySelector('#version-conclusion').textContent=conclusions[key];}
  document.querySelectorAll('[data-version]').forEach(b=>b.addEventListener('click',()=>version(b.dataset.version)));version('both');
  let filter='全部', view='person', topic='全部';
  const classifications={
    E01:{date:547,method:'记载待核',disputed:true},E02:{date:559,method:'处斩'},
    E03:{date:559,method:'处斩'},E04:{date:null,method:'记载待核',disputed:true},
    E05:{date:563,method:'记载待核',disputed:true},E06:{date:566,method:'拷打致死'},
    E07:{date:571,method:'宫中命令杀害'},E08:{date:572,method:'宫中命令杀害',disputed:true},
    E09:{date:573,method:'遣使送毒药'},E10:{date:573,method:'处斩'}
  };
  data.events.forEach(e=>{if(!classifications[e.id])classifications[e.id]={date:e.date??null,method:e.method||e.type,disputed:/待核|线索|分歧|推断/.test(e.status||'')};e.category=e.category||'暴力事件';});
  const viewNotes={person:'按人物与材料类型查找，点开可见事件、关系、原因初析和来源。',time:'按已定位的年份排列；具体年份未定的事件单列，不强行补入时间顺序。',method:'依据方式或行为类型分组；伤害、死亡与宫廷生活分别标注。方式未明的单列，具体器物与操作不补造。',difference:'查看日期、方式或篇章叙述有分歧，以及尚待核验的材料，点开详情核对相应来源。'};
  function eventRow(e){return `<button class="event-row${readEvents.has(e.id)?' event-read':''}" data-event="${e.id}" aria-label="展开${escape(e.name)}"><span class="event-id">${String(data.events.indexOf(e)+1).padStart(2,"0")}</span><span class="event-ruler">${escape(e.ruler)}</span><span class="event-content"><strong>${highlighted(e.name)}${saved.has(e.id)?'<span class="event-saved" aria-label="已收藏"> ★</span>':''}</strong><span class="event-meta">${highlighted(e.type)}${readEvents.has(e.id)?'<span class="read-badge">已读</span>':''}</span></span><span class="event-year">${escape(e.year)}</span><span class="event-arrow" aria-hidden="true">↗</span></button>`;}
  function renderEvents(){
    const normalize=value=>String(value).normalize('NFKC').toLowerCase();const words=normalize(document.querySelector('#event-search').value.trim()).split(/\s+/).filter(Boolean);
    searchWords=words;
    let events=data.events.filter(e=>(!onlySaved||saved.has(e.id))&&(filter==='全部'||e.ruler.includes(filter))&&(topic==='全部'||e.category===topic)&&words.every(word=>normalize([e.name,e.ruler,e.aliases,e.type,e.year,e.context,e.status,classifications[e.id].method].join(' ')).includes(word)));
    if(view==='difference')events=events.filter(e=>classifications[e.id].disputed);
    if(view==='person')events.sort((a,b)=>['高澄','高洋','高湛','高纬','高绰','高演','胡太后'].indexOf(a.ruler.split('、')[0])-['高澄','高洋','高湛','高纬','高绰','高演','胡太后'].indexOf(b.ruler.split('、')[0]));
    if(view==='time')events.sort((a,b)=>(classifications[a.id].date??Infinity)-(classifications[b.id].date??Infinity));
    let html='';
    if(view==='time'||view==='method'||view==='person'){
      const groups=new Map();
      events.forEach(e=>{const c=classifications[e.id];const key=view==='time'?(c.date?`${c.date}年`:'具体年份待核'):view==='person'?e.ruler.split('、')[0]:c.method;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);});
      groups.forEach((items,key)=>{html+=`<h3 class="event-group-heading">${escape(key)}</h3>${items.map(eventRow).join('')}`;});
    }else html=events.map(eventRow).join('');
    document.querySelector('#event-list').innerHTML=html;
    document.querySelector('#result-count').textContent=`显示 ${events.length} / ${data.events.length} 条材料`;
    document.querySelector('#view-note').textContent=viewNotes[view];
    document.querySelector('#empty-results').hidden=events.length>0;
    document.querySelector('#reading-count').textContent=`已读 ${readEvents.size} / ${data.events.length}`;
    const chips=[filter!=='全部'&&['filter',filter],topic!=='全部'&&['topic',topic],view!=='person'&&['view',({time:'按时间',method:'按方式',difference:'看分歧'})[view]],words.length&&['search','搜索：'+document.querySelector('#event-search').value.trim()],onlySaved&&['saved','只看收藏']].filter(Boolean);
    document.querySelector('#active-filters').innerHTML=chips.map(([key,label])=>`<button type="button" data-clear-explore="${key}" aria-label="取消${escape(label)}">${escape(label)} <span aria-hidden="true">×</span></button>`).join('');
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});renderEvents();}));
  document.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{topic=b.dataset.topic;document.querySelectorAll('[data-topic]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderEvents();}));
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});renderEvents();}));document.querySelector('#event-search').addEventListener('input',renderEvents);renderEvents();
  document.querySelector('#reset-explore')?.addEventListener('click',()=>{onlySaved=false;document.querySelector('#saved-only').setAttribute('aria-pressed','false');document.querySelector('#event-search').value='';document.querySelector('[data-view=person]').click();document.querySelector('[data-topic="全部"]').click();document.querySelector('[data-filter="全部"]').click();});
  document.querySelector('#explore').addEventListener('click',event=>{
    const clear=event.target.closest('[data-clear-explore]'),prompt=event.target.closest('[data-search-prompt]');
    if(prompt){document.querySelector('#reset-explore').click();const input=document.querySelector('#event-search');input.value=prompt.dataset.searchPrompt;renderEvents();input.focus();}
    if(!clear)return;
    const key=clear.dataset.clearExplore;
    if(key==='filter')document.querySelector('[data-filter="全部"]').click();
    if(key==='topic')document.querySelector('[data-topic="全部"]').click();
    if(key==='view')document.querySelector('[data-view="person"]').click();
    if(key==='saved')document.querySelector('#saved-only').click();
    if(key==='search'){document.querySelector('#event-search').value='';renderEvents();}
    document.querySelector('#event-search').focus({preventScroll:true});
  });
  const galleryCards=[...document.querySelectorAll('.violence-card')];
  document.querySelectorAll('[data-gallery-ruler]').forEach(button=>button.addEventListener('click',()=>{const ruler=button.dataset.galleryRuler;document.querySelectorAll('[data-gallery-ruler]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));let count=0;galleryCards.forEach(card=>{const event=data.events.find(e=>e.id===card.dataset.event);const show=ruler==='全部'||event?.ruler.includes(ruler);card.hidden=!show;if(show)count++;});document.querySelector('#gallery-count').textContent=`显示 ${count} / ${galleryCards.length} 幅动态档案`;}));
  document.querySelector('#source-list').innerHTML=Object.entries(data.sources).map(([key,s])=>`<li><button data-source="${key}">${escape(s.book)}</button><small>${escape(s.title)}</small></li>`).join('');
  const chapters=[...document.querySelectorAll('[data-chapter]')], railLinks=[...document.querySelectorAll('.chapter-rail nav a')];
  function updateProgress(){const total=document.documentElement.scrollHeight-window.innerHeight;const progress=document.querySelector('#page-progress');if(progress)progress.style.width=(total>0?Math.min(100,window.scrollY/total*100):0)+'%';document.querySelector('.back-to-top')?.classList.toggle('visible',window.scrollY>window.innerHeight);const position=window.innerHeight*.35;let active=0;chapters.forEach((c,i)=>{if(c.getBoundingClientRect().top<=position)active=i;});railLinks.forEach((a,i)=>{a.classList.toggle('active',i===active);if(i===active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});document.querySelector('#reading-progress').style.width=`${(active+1)/chapters.length*100}%`;document.querySelector('#progress-label').textContent=`第 ${active+1} / ${chapters.length} 层`;if(!dialog.open&&chapters[0].getBoundingClientRect().top<=position&&chapters.at(-1).getBoundingClientRect().bottom>0&&lastChapter!==chapters[active].id){lastChapter=chapters[active].id;memory.write('qi-reading-chapter',lastChapter);}}
  const storedChapter=memory.read('qi-reading-chapter',null);let scheduled=false;window.addEventListener('scroll',()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{updateProgress();scheduled=false;});},{passive:true});updateProgress();

  // Stable event links and continuous browsing reuse the same evidence dialog.
  const eventObserver=new MutationObserver(()=>{
    if(!activeEvent||body.querySelector('.event-pagination'))return;
    const visibleIds=[...document.querySelectorAll('#event-list [data-event]')].map(b=>b.dataset.event);
    const ids=visibleIds.includes(activeEvent)?visibleIds:data.events.map(e=>e.id);
    const index=ids.indexOf(activeEvent);
    const nav=document.createElement('nav');nav.className='event-pagination';nav.setAttribute('aria-label','连续阅读材料');
    nav.innerHTML=`<button type="button" data-event="${ids[index-1]||''}" ${index===0?'disabled':''}>← 上一条</button><span>${index+1} / ${ids.length} · 当前材料列表</span><button type="button" data-event="${ids[index+1]||''}" ${index===ids.length-1?'disabled':''}>下一条 →</button>`;
    body.append(nav);
    const phases=[...body.querySelectorAll('.v-art .v-phase')];body.querySelectorAll('[data-scene-jump]').forEach((button,index)=>{if(phases[index])button.textContent=phases[index].textContent.trim();});
    if(location.hash.startsWith('#event='))history.replaceState(null,'',location.pathname+location.search+'#event='+activeEvent+(parentVisual?'&visual='+parentVisual:''));
  });
  eventObserver.observe(body,{childList:true});
  function openLinkedEvent(){
    if(!location.hash.startsWith('#event='))return;
    const params=new URLSearchParams(location.hash.slice(1));
    const id=params.get('event');
    if(data.events.some(e=>e.id===id))eventDetail(id,params.get('visual'));
  }
  window.addEventListener('hashchange',openLinkedEvent);openLinkedEvent();
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!dialog.open&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.matches('input,textarea,[contenteditable=true]')){
      event.preventDefault();document.querySelector('#event-search').focus();document.querySelector('#event-search').scrollIntoView({block:'center'});
    }
  });
  window.addEventListener('resize',updateProgress,{passive:true});

  function updateSavedCount(){document.querySelector('#saved-only').textContent=`只看收藏 · ${saved.size}`;}
  updateSavedCount();
  document.querySelector('#saved-only').addEventListener('click',()=>{onlySaved=!onlySaved;document.querySelector('#saved-only').setAttribute('aria-pressed',String(onlySaved));renderEvents();});
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-save-event],[data-copy-event],[data-scene-jump]');if(!button)return;
    if(button.hasAttribute('data-save-event')){
      const id=button.dataset.saveEvent;if(saved.has(id))saved.delete(id);else saved.add(id);
      const persisted=memory.write('qi-saved-events',[...saved]);button.setAttribute('aria-pressed',String(saved.has(id)));button.textContent=saved.has(id)?'★ 已收藏':'☆ 收藏材料';updateSavedCount();renderEvents();
      body.querySelector('.event-feedback').textContent=persisted?(saved.has(id)?'已保存，稍后可在自由探索查看。':'已取消收藏。'):'已暂存本次浏览；浏览器未允许持久保存。';
    }else if(button.hasAttribute('data-copy-event')){
      const url=new URL(body.querySelector('[data-event-permalink]').getAttribute('href'),location.href).href;
      try{await navigator.clipboard.writeText(url);body.querySelector('.event-feedback').textContent='链接已复制。';}catch{body.querySelector('.event-feedback').textContent='请右键上方独立链接，选择复制链接。';}
    }else{
      const input=body.querySelector('[data-scene-progress]');if(input){input.value=button.dataset.sceneJump;input.dispatchEvent(new Event('input',{bubbles:true}));}
    }
  });
  const resume=document.querySelector('#resume-reading'),previousChapter=storedChapter;
  const previousIndex=chapters.findIndex(c=>c.id===previousChapter);
  if(previousIndex>=0){resume.hidden=false;resume.href='#'+previousChapter;resume.textContent=`继续上次阅读 · 第 ${previousIndex+1} 层 →`;}
})();
