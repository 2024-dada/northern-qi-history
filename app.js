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
  async function copyText(text,feedback,success){
    try{await navigator.clipboard.writeText(text);feedback.textContent=success;}
    catch{feedback.textContent='自动复制不可用，可选中下方文字手动复制。';const field=document.createElement('textarea');field.className='copy-fallback';field.readOnly=true;field.value=text;field.setAttribute('aria-label','可手动复制的内容');feedback.append(field);field.focus();field.select();}
  }
  let onlySaved=false, lastChapter=null, readStatus='all', browsingIds=null;
  let returnFocus=null, returnHash='', eventScroll=0, eventSceneProgress=null, parentEvent=null, parentVisual=null, activeEvent=null;
  let largeText=memory.read('qi-large-text',false)===true;
  function updateTextSize(){document.documentElement.classList.toggle('reading-large',largeText);document.querySelectorAll('[data-text-size]').forEach(button=>{button.setAttribute('aria-pressed',String(largeText));button.textContent=largeText?'标准字号':'大字阅读';});}updateTextSize();
  document.addEventListener('click',event=>{if(!event.target.closest('[data-text-size]'))return;largeText=!largeText;memory.write('qi-large-text',largeText);updateTextSize();});
  function show(content){dialog.classList.remove('scene-expanded');if(!dialog.open){returnFocus=document.activeElement;returnHash=location.hash.startsWith('#event=')?'#explore':location.hash.startsWith('#source=')?'#sources':location.hash;}body.innerHTML=content;if(!dialog.open)dialog.showModal();document.documentElement.classList.add('detail-open');dialog.scrollTop=0;dialog.querySelector('.dialog-close').focus();}
  function sourceLink(key){const url=new URL(location.pathname,location.origin);url.hash='source='+encodeURIComponent(key);return url.href;}
  function sourceCitation(key){const source=data.sources[key];return [source.book,'条目定位：'+source.title,'版本与入口：'+source.edition,'核验状态：'+source.status,...source.links.map(([label,url])=>label+'：'+url),'本页出处说明：'+sourceLink(key)].join('\n');}
  function sourceDetail(key,backEvent=null){
    const source=data.sources[key];if(!source)return;
    if(backEvent){eventScroll=dialog.scrollTop;eventSceneProgress=body.querySelector('[data-scene-progress]')?.value??null;}
    activeEvent=null;parentEvent=backEvent;
    const related=data.events.filter(event=>event.source===key);
    const relatedPanel=related.length?`<section class="source-related"><h3>本页关联材料 · ${related.length} 条</h3><p>这些条目链接到同一出处；不因此视为彼此独立的史料见证。</p><div>${related.map(event=>`<button type="button" data-event="${event.id}"><span>${escape(event.ruler)}</span>${escape(event.name)} ↗</button>`).join('')}</div></section>`:'';
    show(`<p class="eyebrow">原典出处 / [${source.number}]</p><h2 id="dialog-title">${escape(source.title)}</h2><p>${escape(source.book)}</p><div class="source-tools"><a href="${escape(sourceLink(key))}" data-source-permalink>此出处的独立链接 ↗</a><button type="button" data-copy-source="${escape(key)}">复制出处与核验说明</button><span class="source-feedback" role="status" aria-live="polite"></span></div><h3>所用版本与入口</h3><p>${escape(source.edition)}</p><h3>史书原文（已转简体）</h3><blockquote>${escape(source.quote||'原句定位与影印核对待完成；此处不生成引文。').replace(/\n/g,'<br>')}</blockquote><h3>白话与阅读提示</h3><p>${escape(source.explanation)}</p><div class="source-state">${escape(source.status)}</div><div class="dialog-links">${links(source)}</div>${backEvent?'<button class="dialog-back" data-back-event>← 返回事件详情</button>':''}${relatedPanel}`);
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-copy-source]');if(!button)return;copyText(sourceCitation(button.dataset.copySource),body.querySelector('.source-feedback'),'已复制出处、原典入口和待核说明。');});
  function eventDetail(id,visualKey=null){const e=data.events.find(x=>x.id===id);if(!e)return;if(!browsingIds?.includes(id)){const visible=[...document.querySelectorAll('#event-list [data-event]')].map(b=>b.dataset.event);browsingIds=visible.includes(id)?visible:data.events.map(e=>e.id);}activeEvent=id;readEvents.add(id);memory.write('qi-read-events',[...readEvents]);parentEvent=null;const s=data.sources[e.source];const visual=data.visuals?.find(v=>v.key===visualKey&&v.event===id)||data.visuals?.find(v=>v.event===id);parentVisual=visual?.key;const dossier=e.dossier||data.dossierForEvent?.[id];const related=(data.relatedEvents?.[id]||[]).map(key=>data.events.find(x=>x.id===key)).filter(Boolean);const controls=(visual||dossier)?`<div class="scene-detail-controls">${['motion','speed','replay'].map(action=>`<button type="button" data-animation-action="${action}">${escape((document.querySelector('#violence-'+action)?.textContent||({motion:'播放／暂停',speed:'速度切换',replay:'重播'})[action]).replace('卡片',''))}</button>`).join('')}${visual?'<label class="scene-scrub-label">动作进度<input type="range" min="0" max="100" step="1" value="0" data-scene-progress aria-label="场景动作进度"><output data-scene-time>0%</output></label>':''}</div>`:'';const extra=dossier?`<section class="detail-visual"><p class="visual-label">${escape(dossier.status)}</p><p class="scene-relation-text">${escape(dossier.relation)}</p>${data.dossierArtwork(dossier,true)}${e.dossier?"":`<p>${escape(dossier.account)}</p>`}<p class="visual-boundary">${escape(dossier.boundary)}</p></section>`:'';const visualPanel=visual?`<section class="detail-visual" aria-label="暴力方式与史料边界"><p class="visual-label">${escape(visual.tag)} · ${escape(visual.status)}</p><p class="scene-relation-text">${escape(visual.subtitle)}</p>${data.visualArtwork(visual,"detail-"+visual.key)}<blockquote>${escape(visual.quote)}</blockquote><p class="visual-boundary">${escape(visual.boundary)}</p><p><strong>需要解释的问题：</strong>${escape(visual.question)}</p></section>`:"";show(`<p class="eyebrow">${escape(e.id)} / ${escape(e.ruler)} / ${escape(e.year)}</p><h2 id="dialog-title">${escape(e.name)}</h2><p>${escape(e.type)}</p><div class="event-actions"><a href="#event=${escape(e.id)}${visual?`&visual=${escape(visual.key)}`:""}" data-event-permalink>此事件的独立链接 ↗</a><button type="button" data-copy-event>复制链接</button><button type="button" data-save-event="${escape(e.id)}" aria-pressed="${saved.has(e.id)}">${saved.has(e.id)?'★ 已收藏':'☆ 收藏材料'}</button><span class="event-feedback" role="status" aria-live="polite"></span></div>${visual?'<div class="scene-workbench"><div class="scene-controls-panel">':''}${controls}${visual?'<div class="scene-inspection"><button type="button" data-scene-once>单次播放</button><button type="button" data-scene-nudge="-1" aria-label="动画进度后退百分之一">−1%</button><button type="button" data-scene-nudge="1" aria-label="动画进度前进百分之一">+1%</button><button type="button" data-expand-scene aria-pressed="false">放大画面 ⤢</button><span data-scene-state role="status" aria-live="polite">可拖动进度，逐步查看动作</span></div><div class="scene-jumps" role="group" aria-label="动画关键帧"><span>逐步看动作</span><button type="button" data-scene-jump="20">① 蓄势</button><button type="button" data-scene-jump="45">② 接触</button><button type="button" data-scene-jump="75">③ 后果</button></div>':""}${visual?'</div>':''}${visualPanel}${visual?'</div>':''}${extra}<h3>事件经过与背景</h3><p>${escape(e.context)}</p><h3>谁推动、谁下令、谁执行</h3><p>${escape(e.agency)}</p>${s.quote?`<blockquote>${escape(s.quote).replace(/\n/g,'<br>')}</blockquote>`:''}${e.boundary?`<div class="source-state">${escape(e.status)}<br>${escape(e.boundary)}</div>`:''}<h3>为什么发生：原因分析（暂定）</h3><p class="analysis-note">以下是项目依据现有记载提出的解释。主要原因是目前较有依据的解释；促成因素是可能推动事件的条件，两者都需要进一步核验。</p><p><strong>主要原因（暂定）：</strong>${escape(e.primary)}</p><p><strong>促成因素或其他解释：</strong>${escape(e.secondary)}</p><div class="source-state">${escape(s.status)}<br>原因排序是本项目初析，未完成现代学术研究核验。</div><button class="related-source" data-event-source="${e.source}" data-parent-event="${e.id}">展开出处 [${s.number}] ↗</button><div class="dialog-links">${links(s)}</div>${related.length?`<h3>可继续比较的相关事件</h3>${related.map(x=>`<button class="related-source" data-event="${x.id}">${escape(x.name)} ↗</button>`).join(" ")}`:""}`);}
  function methodDetail(){activeEvent=null;parentEvent=null;show('<p class="eyebrow">关于史料</p><h2 id="dialog-title">怎样使用史料和分析原因</h2><p>本页先介绍四个案例，再汇总更多事件和比较材料。阅读时应依次区分事件经过、下令与执行关系、原因解释，以及尚待核实的问题。条目数量不是死亡人数，也不用于给人物的残暴程度排名。</p><h3>我们怎样区分材料</h3><ul><li>事件与记载分开：同一次死亡在多书出现，不重复计数。</li><li>分清谁推动、谁下令、谁亲自实施。事件发生在哪位皇帝的年号下，不代表就是这位皇帝下令。</li><li>原文、白话、史臣评价和项目解释分开。</li><li>字词、日期或叙述有分歧时，保留分歧，回到影印核字。</li></ul><h3>为什么多来源还要检查文本关系</h3><p>《四库全书总目》指出，今天传下来的《北齐书》有部分内容取自《北史》，用于补充缺失篇章。因此，两部书出现相似记载，可能是沿用同一段文字，不能直接算作两份独立证据。</p><div class="dialog-links"><a href="https://www.shidianguji.com/book/SK0000A/chapter/1kgsnkeqjizoo" target="_blank" rel="noopener noreferrer">识典 · 北齐书提要 ↗</a></div><h3>当前核验状态</h3><p>已做原典录文初对照；关键句影印核字、版本关系和现代学术解释仍待完成。示意图只帮助理解，不能充当历史现场证据。</p><div class="source-state">人物对话为史书所述，不标作现场逐字录音；宫阙、人物与位置图均为示意。</div>');}
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{document.documentElement.classList.remove('detail-open');activeEvent=null;browsingIds=null;if(/^#(?:event|source)=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search+(returnHash||'#explore'));const focus=returnFocus?.isConnected?returnFocus:(returnFocus?.dataset.event?document.querySelector('#event-list [data-event="'+returnFocus.dataset.event+'"]'):null);(focus||document.querySelector('#event-list .event-row')||document.querySelector('#event-search'))?.focus({preventScroll:true});parentEvent=null;});
  document.addEventListener('click',event=>{const t=event.target.closest('[data-animation-action],[data-source],[data-event],[data-open-method],[data-event-source],[data-back-event]');if(!t)return;if(t.hasAttribute('data-animation-action')){document.querySelector('#violence-'+t.dataset.animationAction)?.click();dialog.querySelectorAll('[data-animation-action]').forEach(b=>b.textContent=document.querySelector('#violence-'+b.dataset.animationAction).textContent.replace('卡片',''));return;}if(t.hasAttribute('data-source'))sourceDetail(t.dataset.source);else if(t.hasAttribute('data-event'))eventDetail(t.dataset.event,t.dataset.visual);else if(t.hasAttribute('data-open-method'))methodDetail();else if(t.hasAttribute('data-event-source'))sourceDetail(t.dataset.eventSource,t.dataset.parentEvent);else if(t.hasAttribute('data-back-event')&&parentEvent){eventDetail(parentEvent,parentVisual);requestAnimationFrame(()=>{const slider=body.querySelector('[data-scene-progress]');if(slider&&eventSceneProgress!==null){slider.value=eventSceneProgress;slider.dispatchEvent(new Event('input',{bubbles:true}));}dialog.scrollTop=eventScroll;});}});
  const art={scroll:'<path d="M25 20h70v100H25zM25 20q-20 0-12 14h12M95 120q20 0 12-14H95"/><path d="M42 40h36M42 56h36M42 72h23M42 88h36"/>',network:'<circle cx="60" cy="55" r="16"/><circle cx="22" cy="105" r="10"/><circle cx="100" cy="105" r="10"/><path d="M50 70l-22 25M70 70l22 25M22 40h25M100 40H74"/>',command:'<path d="M20 25h80v45H20zM60 70v28M45 87l15 15 15-15M30 120h60"/><path d="M35 43h50M35 55h35"/>',seal:'<path d="M40 20h40v26H40zM25 46h70v28H25zM20 110h80v13H20z"/><path d="M40 92h40" stroke="#9d4236"/>'};
  function stage(index){const s=data.stages[index];document.querySelectorAll('[data-stage]').forEach(b=>{const active=Number(b.dataset.stage)===index;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelector('#stage-index').textContent=String(index+1).padStart(2,'0');document.querySelector('#stage-kicker').textContent=s.kicker;document.querySelector('#stage-title').textContent=s.title;document.querySelector('#stage-text').textContent=s.text;document.querySelector('#stage-quote').textContent=s.quote;document.querySelector('#stage-quote-label').textContent=([0,3].includes(index)?'史书原文（已转简体）':'根据记载整理的说明');document.querySelector('#stage-art').innerHTML=`<svg viewBox="0 0 120 145" fill="none" stroke="#8b8f79" stroke-width="1.5">${art[s.symbol]}</svg>`;}
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
  const viewNotes={person:'按人物与材料类型查找，点开可见事件经过、人物责任、原因分析和史料来源。',time:'按已定位的年份排列；具体年份未定的事件单列，不强行补入时间顺序。',method:'依据方式或行为类型分组；伤害、死亡与宫廷生活分别标注。方式未明的单列，具体器物与操作不补造。',difference:'查看日期、方式或篇章叙述有分歧，以及尚待核验的材料，点开详情核对相应来源。'};
  function eventRow(e){return `<button class="event-row${readEvents.has(e.id)?' event-read':''}" data-event="${e.id}" aria-label="展开${escape(e.name)}"><span class="event-id">${String(data.events.indexOf(e)+1).padStart(2,"0")}</span><span class="event-ruler">${escape(e.ruler)}</span><span class="event-content"><strong>${highlighted(e.name)}${saved.has(e.id)?'<span class="event-saved" aria-label="已收藏"> ★</span>':''}</strong><span class="event-meta">${highlighted(e.type)}${readEvents.has(e.id)?'<span class="read-badge">已读</span>':''}</span></span><span class="event-year">${escape(e.year)}</span><span class="event-arrow" aria-hidden="true">↗</span></button>`;}
  function explorationLink(){
    const url=new URL(location.pathname,location.origin);
    if(filter!=='全部')url.searchParams.set('ruler',filter);
    if(topic!=='全部')url.searchParams.set('topic',topic);
    if(view!=='person')url.searchParams.set('view',view);
    const query=document.querySelector('#event-search').value.trim();if(query)url.searchParams.set('q',query);
    url.hash='explore';return url.href;
  }
  function renderEvents(){
    const normalize=value=>String(value).normalize('NFKC').toLowerCase();const words=normalize(document.querySelector('#event-search').value.trim()).split(/\s+/).filter(Boolean);
    searchWords=words;
    let events=data.events.filter(e=>(!onlySaved||saved.has(e.id))&&(readStatus==='all'||readEvents.has(e.id)===(readStatus==='read'))&&(filter==='全部'||e.ruler.includes(filter))&&(topic==='全部'||e.category===topic)&&words.every(word=>normalize([e.name,e.ruler,e.aliases,e.type,e.year,e.context,e.status,classifications[e.id].method].join(' ')).includes(word)));
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
    const chips=[filter!=='全部'&&['filter',filter],topic!=='全部'&&['topic',topic],view!=='person'&&['view',({time:'按时间',method:'按方式',difference:'待核与分歧'})[view]],words.length&&['search','搜索：'+document.querySelector('#event-search').value.trim()],onlySaved&&['saved','只看收藏'],readStatus!=='all'&&['read',readStatus==='read'?'只看已读':'只看未读']].filter(Boolean);
    document.querySelector('#share-explore-link').href=explorationLink();
    document.querySelector('#active-filters').innerHTML=chips.map(([key,label])=>`<button type="button" data-clear-explore="${key}" aria-label="取消${escape(label)}">${escape(label)} <span aria-hidden="true">×</span></button>`).join('');
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});renderEvents();}));
  document.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{topic=b.dataset.topic;document.querySelectorAll('[data-topic]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderEvents();}));
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});renderEvents();}));document.querySelector('#event-search').addEventListener('input',renderEvents);renderEvents();
  document.querySelector('#reset-explore')?.addEventListener('click',()=>{onlySaved=false;readStatus='all';document.querySelector('#read-status').value='all';document.querySelector('#saved-only').setAttribute('aria-pressed','false');document.querySelector('#event-search').value='';document.querySelector('[data-view=person]').click();document.querySelector('[data-topic="全部"]').click();document.querySelector('[data-filter="全部"]').click();});
  document.querySelector('#explore').addEventListener('click',event=>{
    const clear=event.target.closest('[data-clear-explore]'),prompt=event.target.closest('[data-search-prompt]');
    if(prompt){document.querySelector('#reset-explore').click();const input=document.querySelector('#event-search');input.value=prompt.dataset.searchPrompt;renderEvents();input.focus();}
    if(!clear)return;
    const key=clear.dataset.clearExplore;
    if(key==='filter')document.querySelector('[data-filter="全部"]').click();
    if(key==='topic')document.querySelector('[data-topic="全部"]').click();
    if(key==='view')document.querySelector('[data-view="person"]').click();
    if(key==='saved')document.querySelector('#saved-only').click();
    if(key==='read'){readStatus='all';document.querySelector('#read-status').value='all';renderEvents();}
    if(key==='search'){document.querySelector('#event-search').value='';renderEvents();}
    document.querySelector('#event-search').focus({preventScroll:true});
  });
  document.querySelector('#read-status').addEventListener('change',event=>{readStatus=event.target.value;renderEvents();});
  document.querySelector('#copy-explore').addEventListener('click',()=>copyText(explorationLink(),document.querySelector('#explore-feedback'),'筛选链接已复制。收藏和已读条件只保留在当前浏览器。'));
  const sharedFilters=new URLSearchParams(location.search);
  [['ruler','filter'],['topic','topic'],['view','view']].forEach(([key,attribute])=>{const value=sharedFilters.get(key);const button=[...document.querySelectorAll('[data-'+attribute+']')].find(b=>b.dataset[attribute]===value);button?.click();});
  document.querySelector('#event-search').value=(sharedFilters.get('q')||'').slice(0,300);renderEvents();
  const galleryCards=[...document.querySelectorAll('.violence-card')];
  document.querySelectorAll('[data-gallery-ruler]').forEach(button=>button.addEventListener('click',()=>{const ruler=button.dataset.galleryRuler;document.querySelectorAll('[data-gallery-ruler]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));let count=0;galleryCards.forEach(card=>{const event=data.events.find(e=>e.id===card.dataset.event);const show=ruler==='全部'||event?.ruler.includes(ruler);card.hidden=!show;if(show)count++;});document.querySelector('#gallery-count').textContent=`显示 ${count} / ${galleryCards.length} 个动画场景`;}));
  document.querySelector('#source-list').innerHTML=Object.entries(data.sources).map(([key,s])=>`<li><button data-source="${key}">${escape(s.book)}</button><small>${escape(s.title)}</small></li>`).join('');
  const chapters=[...document.querySelectorAll('[data-chapter]')], railLinks=[...document.querySelectorAll('.chapter-rail nav a')];
  function updateProgress(){const total=document.documentElement.scrollHeight-window.innerHeight;const progress=document.querySelector('#page-progress');if(progress)progress.style.width=(total>0?Math.min(100,window.scrollY/total*100):0)+'%';document.querySelector('.back-to-top')?.classList.toggle('visible',window.scrollY>window.innerHeight);const position=window.innerHeight*.35;let active=0;chapters.forEach((c,i)=>{if(c.getBoundingClientRect().top<=position)active=i;});railLinks.forEach((a,i)=>{a.classList.toggle('active',i===active);if(i===active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});document.querySelector('#reading-progress').style.width=`${(active+1)/chapters.length*100}%`;document.querySelector('#progress-label').textContent=`第 ${active+1} / ${chapters.length} 节`;if(!dialog.open&&chapters[0].getBoundingClientRect().top<=position&&chapters.at(-1).getBoundingClientRect().bottom>0&&lastChapter!==chapters[active].id){lastChapter=chapters[active].id;memory.write('qi-reading-chapter',lastChapter);}}
  const storedChapter=memory.read('qi-reading-chapter',null);let scheduled=false;window.addEventListener('scroll',()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{updateProgress();scheduled=false;});},{passive:true});updateProgress();

  // Stable event links and continuous browsing reuse the same evidence dialog.
  const eventObserver=new MutationObserver(()=>{
    if(!activeEvent||body.querySelector('.event-pagination'))return;
    const ids=browsingIds||data.events.map(e=>e.id);
    const index=ids.indexOf(activeEvent);
    const nav=document.createElement('nav');nav.className='event-pagination';nav.setAttribute('aria-label','连续阅读材料');
    nav.innerHTML=`<button type="button" data-event="${ids[index-1]||''}" ${index===0?'disabled':''}>← 上一条</button><span>${index+1} / ${ids.length} · 当前材料列表</span><button type="button" data-event="${ids[index+1]||''}" ${index===ids.length-1?'disabled':''}>下一条 →</button>`;
    body.append(nav);
    const permalink=body.querySelector('[data-event-permalink]');const eventUrl=new URL(location.pathname,location.origin);eventUrl.hash='event='+activeEvent+(parentVisual?'&visual='+parentVisual:'');permalink.href=eventUrl.href;
    const context=[...body.children].find(el=>el.tagName==='H3'&&el.textContent==='事件经过与背景');
    const causes=[...body.children].find(el=>el.tagName==='H3'&&el.textContent.startsWith('为什么发生'));
    const sections=[['scene','动画',body.querySelector('.detail-visual')],['context','经过',context],['causes','原因',causes],['evidence','出处',body.querySelector('[data-event-source]')]].filter(([, ,target])=>target);
    const contents=document.createElement('nav');contents.className='detail-contents';contents.setAttribute('aria-label','详情内快速跳转');
    contents.innerHTML=sections.map(([key,label,target])=>{target.id='detail-'+key;return `<button type="button" data-detail-section="${key}">${label}</button>`;}).join('')+'<button type="button" data-text-size aria-pressed="'+largeText+'">'+(largeText?'标准字号':'大字阅读')+'</button>';
    body.querySelector('.event-actions').after(contents);
    const help=document.createElement('details');help.className='keyboard-help';help.innerHTML='<summary>键盘操作与进度记忆</summary><p><kbd>[</kbd> 上一条，<kbd>]</kbd> 下一条；有动作进度条时，<kbd>,</kbd> 后退 1%，<kbd>.</kbd> 前进 1%。进度条聚焦后也可使用方向键。<kbd>Esc</kbd> 关闭详情。同一场景在本次浏览中保留查看进度。</p>';contents.after(help);updateTextSize();renderEvents();
    const phases=[...body.querySelectorAll('.v-art .v-phase')];body.querySelectorAll('[data-scene-jump]').forEach((button,index)=>{if(phases[index])button.textContent=phases[index].textContent.trim();});
    if(/^#(?:event|source)=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search+'#event='+activeEvent+(parentVisual?'&visual='+parentVisual:''));
  });
  eventObserver.observe(body,{childList:true});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-detail-section]');if(!button)return;body.querySelector('#detail-'+button.dataset.detailSection)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
  const header=document.querySelector('.site-header'),rail=document.querySelector('.chapter-rail');
  const offsets=new ResizeObserver(()=>{document.documentElement.style.setProperty('--header-height',header.getBoundingClientRect().height+'px');document.documentElement.style.setProperty('--rail-height',window.innerWidth<=650?rail.getBoundingClientRect().height+'px':'0px');});offsets.observe(header);offsets.observe(rail);
  function openLinkedEvent(){
    if(location.hash.startsWith('#source=')){const key=new URLSearchParams(location.hash.slice(1)).get('source');if(Object.hasOwn(data.sources,key))sourceDetail(key);return;}
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
  document.addEventListener('keydown',event=>{
    if(!dialog.open||!activeEvent||event.ctrlKey||event.metaKey||event.altKey||event.target.matches('input,textarea,select,[contenteditable=true]'))return;
    if(event.key==='['||event.key===']'){const buttons=body.querySelectorAll('.event-pagination button');const button=buttons[event.key==='['?0:1];if(button&&!button.disabled){event.preventDefault();button.click();}}
    if(event.key===','||event.key==='.'){const button=body.querySelector('[data-scene-nudge="'+(event.key===','?'-1':'1')+'"]');if(button){event.preventDefault();button.click();}}
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
      body.querySelector('.event-feedback').textContent=persisted?(saved.has(id)?'已保存，可在“全部材料”中选择“只看收藏”查看。':'已取消收藏。'):'已暂存本次浏览；浏览器未允许持久保存。';
    }else if(button.hasAttribute('data-copy-event')){
      const url=new URL(body.querySelector('[data-event-permalink]').getAttribute('href'),location.href).href;
      await copyText(url,body.querySelector('.event-feedback'),'链接已复制。');
    }else{
      const input=body.querySelector('[data-scene-progress]');if(input){input.value=button.dataset.sceneJump;input.dispatchEvent(new Event('input',{bubbles:true}));}
    }
  });
  const resume=document.querySelector('#resume-reading'),previousChapter=storedChapter;
  const previousIndex=chapters.findIndex(c=>c.id===previousChapter);
  if(previousIndex>=0){resume.hidden=false;resume.href='#'+previousChapter;resume.textContent=`继续上次阅读 · 第 ${previousIndex+1} 节 →`;}
})();
