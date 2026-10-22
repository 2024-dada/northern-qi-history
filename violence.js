(() => {
  'use strict';
  const entries = [
    {key:'slash',event:'E02',tag:'挥砍 · 处斩',status:'致死记载',title:'高德政及妻、子被处斩',subtitle:'高洋 → 高德政及妻、子 · 559年',quote:'遂曳出斩之。',boundary:'原文记处斩；刀具、姿势和落刀动作仅为象征，不指认最终执行者。',question:'高洋与高德政的冲突，为何波及妻子和儿子？'},
    {key:'thrust',event:'E02',tag:'突刺 · 先行伤害',status:'此刻尚未致死',title:'高德政被刺伤，次日被处斩',subtitle:'高洋 → 高德政 · 559年',quote:'亲以刀子刺之。',boundary:'对应此前刺伤阶段，不是一次独立刺杀；与次日处斩分开。部位与动作轨迹为设计示意。',question:'从亲自伤害到下令处斩，暴力怎样逐步升级？'},
    {key:'rear',event:'E08',tag:'召见 · 从后杀害',status:'致死记载',title:'高纬召见斛律光并下令杀害',subtitle:'高纬下令 / 刘桃枝等执行 · 572年',quote:'桃枝自后拉而杀之。',boundary:'只示意从后接近与死亡结果，不把“拉”扩写为确定的扼颈或绞杀技法。',question:'谣言、近臣与君主之间，谁把猜忌变成了命令？'},
    {key:'punish',event:'E06',tag:'受刑 · 折胫致死',status:'致死记载',title:'高孝琬遭折胫后死亡',subtitle:'高湛（太上皇）→ 高孝琬 · 566年',quote:'上皇愈怒，折其两胫而死。',boundary:'腿部朱色标记表示史书所述损伤，不复原工具、具体施刑动作；最后执行者未详。',question:'宗族里的叔侄，为什么不能再以叔侄相称？'},
    {key:'poison',event:'E09',tag:'遣使 · 赐毒',status:'致死记载',title:'高纬派人送毒药给兰陵王',subtitle:'高纬下令 / 徐之范送药 · 573年',quote:'帝使徐之范饮以毒药。',boundary:'药器为视觉符号；原文未明确药物成分、剂量与器物样式。',question:'军功与宗室身份，为什么会引起君主猜忌？'},
    {key:'behead',event:'E04',tag:'斩首记载 · 遮挡示意',status:'斩首记载 · 过程有分歧',title:'薛嫔被杀：斩首与时间记载有分歧',subtitle:'高洋 → 薛嫔 · 天保年间',quote:'无故斩首。',boundary:'本纪明确记斩首，直接执行者尚未核定；刀光、遮挡、倒地与刀具均为简化美术示意，不补造现场。后妃传记生产后遇害，时间过程仍须并读。',question:'同一次死亡，为什么在不同篇章中呈现不同的时间与情绪？'},
    {key:'drink',event:'E05',tag:'强饮 · 押送后死亡',status:'方式有分歧',title:'高孝瑜强饮后死亡：致死方式有分歧',subtitle:'高湛 → 高孝瑜 · 563年',quote:'槛之于车 / 鸩之于车',boundary:'两条线代表不同文本描述，不合并成确定毒杀。“槛／鸩”关键字仍待影印核验。',question:'一个字的不同，会怎样改变对死亡方式与杀意的判断？'}
  ];
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scenes = {
    slash:{actor:'执行者未详',actorRole:'奉命处斩',victim:'高德政',victimRole:'受害者 · 妻子亦遭杀害',ruler:'高洋下令',relation:'皇帝 → 开国旧臣',steps:['举刀','挥砍','死亡结果']},
    thrust:{actor:'高洋',actorRole:'亲自刺伤',victim:'高德政',victimRole:'受伤者 · 此刻未死',ruler:'君臣冲突',relation:'皇帝 → 劝谏旧臣',steps:['持刀','突刺','受伤']},
    rear:{actor:'刘桃枝等',actorRole:'直接执行者',victim:'斛律光',victimRole:'掌兵重臣 · 受害者',ruler:'高纬下令',relation:'君主 → 重臣 / 内侍执行',steps:['召入宫','从后接近','死亡结果']},
    punish:{actor:'执行者未详',actorRole:'施刑示意',victim:'高孝琬',victimRole:'高湛之侄 · 受害者',ruler:'高湛（太上皇）',relation:'叔侄 / 皇权与宗室',steps:['受刑','胫部损伤','死亡结果']},
    poison:{actor:'徐之范',actorRole:'奉命送药',victim:'高长恭',victimRole:'兰陵王 · 受害者',ruler:'高纬下令',relation:'君主 → 宗室将领',steps:['使者送药','饮药','死亡结果']},
    behead:{actor:'执行者未详',actorRole:'施害归于高洋 / 动作示意',victim:'薛嫔',victimRole:'受害者 · 姓名标签保留',ruler:'高洋施害 / 本纪所述',relation:'皇帝 → 宫中女性',steps:['蓄势','遮挡 / 刀光','史载斩首']},
    drink:{actor:'奉命强饮者',actorRole:'身份未详',victim:'高孝瑜',victimRole:'河南王 · 受害者',ruler:'高湛命强饮',relation:'娄子彦押送 / 致死方式有分歧',steps:['强迫饮酒','押送','死亡记载']}
  };
  let figureSerial=0;
  function figure(x,y,role,key) {
    const armed=role==='actor'&&['slash','thrust','behead'].includes(key), length=key==='thrust'?32:48;
    const facing=(key==='rear'&&role==='actor')||(role==='victim')?-1:1;
    const id='costume-'+figureSerial++, dark=role==='actor'?'#334e46':'#775943',mid=role==='actor'?'#789584':'#c0a078',light=role==='actor'?'#9fb19b':'#dbc398';
    return `<g class="v-rig rig-${role}" data-role="${role}" data-x="${x}" data-y="${y}" data-facing="${facing}" transform="translate(${x} ${y})"><defs><linearGradient id="${id}" x1="0" x2="1"><stop stop-color="${dark}"/><stop offset=".38" stop-color="${mid}"/><stop offset=".7" stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient><linearGradient id="${id}-steel" x2=".3" y2="1"><stop stop-color="#f6ead4"/><stop offset=".45" stop-color="#b8c7bf"/><stop offset=".55" stop-color="#fff7db"/><stop offset="1" stop-color="#718e85"/></linearGradient><radialGradient id="${id}-shadow"><stop stop-color="#07100c" stop-opacity=".65"/><stop offset="1" stop-color="#07100c" stop-opacity="0"/></radialGradient></defs><ellipse class="rig-shadow" cy="7" rx="36" ry="7" fill="url(#${id}-shadow)"/><g class="rig-move"><g transform="scale(${facing} 1)"><g class="rig-torso" transform="rotate(0 0 -25)"><path d="M-10-75Q-25-65-30-39L-23-33L-6-61Z" fill="${dark}" stroke="${mid}" stroke-width=".5"/><path d="M-15-5L-17 6L-4 8L-2 4L-8 0" fill="#1a2923"/><g class="rig-front-foot"><path d="M6-5L10 4Q22 3 24 8H6L2 3Z" fill="#1a2923" stroke="#a39268" stroke-width=".5"/></g><g class="rig-hem"><path d="M-12-82Q-19-70-17-48L-27-1Q-10 5 2 1Q15 5 27-1L16-48Q17-70 11-82Z" fill="url(#${id})" stroke="${light}" stroke-opacity=".45" stroke-width=".6"/><path d="M-10-75L2-53L12-77M2-53L8-8M-12-47L-18-7M13-43L21-4M-20-3Q0 4 23-3" fill="none" stroke="${dark}" stroke-width="1.3" stroke-opacity=".6"/><path d="M-6-76L3-58L10-77" fill="none" stroke="#dbc592" stroke-width="2"/><path d="M-17-44Q0-40 17-44L17-39Q0-34-17-39Z" fill="#493d2d"/><rect x="-2" y="-43" width="7" height="5" rx="1" fill="#c5a56a"/><path d="M3-37L8-13L13-14L8-37" fill="#9b7850"/><path d="M-14-51Q-7-56-4-57M11-52L14-57M-20-17L-17-30" fill="none" stroke="${light}" stroke-opacity=".45" stroke-width=".8"/></g><path d="M-5-88V-80L6-79V-88" fill="#bba47e"/><g class="rig-head"><path d="M-10-107Q-12-99-8-92L-3-87L7-89L11-94L15-97L11-100L11-106Z" fill="#d0b892"/><path d="M-10-106Q-13-93-7-90L-5-103H11V-109Z" fill="#29362c"/><path d="M-15-110H14L10-119H-9Z" fill="#344339" stroke="#b3a377" stroke-width=".6"/><path d="M-10-111H10M-4-118V-112M6-118V-112" stroke="#c2aa7d" stroke-opacity=".5" stroke-width=".5"/><path d="M5-102H9M6-95L10-95" stroke="#635641" stroke-width=".7"/></g><g transform="translate(10 -69)"><g class="rig-shoulder"><path d="M-3-8Q10-12 24-6L30 5L25 12Q12 8-3 8Z" fill="url(#${id})" stroke="${light}" stroke-opacity=".4" stroke-width=".5"/><path d="M4-5L20-1M7 4L22 7" stroke="${dark}" stroke-opacity=".5" fill="none"/><g transform="translate(26 0)"><g class="rig-elbow"><path d="M-2-5L18-6L25-4L25 5L18 7L-2 5Z" fill="${mid}" stroke="${light}" stroke-opacity=".4" stroke-width=".5"/><path d="M16-6L16 6M20-5V5" stroke="#d4bf8e" stroke-width="1.5"/><g transform="translate(24 0)"><path d="M0-4L7-3L9 0L6 4H0Z" fill="#cdb58d"/>${armed?`<g class="rig-weapon" data-length="${length}"><path d="M5-4L${length}-6L${length+4}-2L${length} 1L5 4Z" fill="url(#${id}-steel)" stroke="#e7dfc4" stroke-width=".5"/><path d="M7-2L${length} -3" stroke="#fff9e7" stroke-width=".7"/><path d="M9 1L${length-7}-1" stroke="#49695f" stroke-opacity=".5" stroke-width=".55"/><path d="M11-1H19M22-1H27" stroke="#f2ead3" stroke-opacity=".6" stroke-width=".35"/><path d="M4-9Q6-7 5-2V3Q6 8 4 9" fill="none" stroke="#c5a472" stroke-width="2.7"/><path d="M3-6V6" stroke="#f0d3a0" stroke-width=".7"/><circle cx="4" cy="0" r="1.2" fill="#604b30"/><path d="M-6 0H4" stroke="#785c3d" stroke-width="4"/><path d="M-5-2L-3 2M-2-2L0 2M1-2L3 2" stroke="#cfb789" stroke-width=".8"/><ellipse cx="-7" rx="2.1" ry="3.2" fill="#b49a6a" stroke="#ead2a3" stroke-width=".45"/></g>`:''}</g></g></g></g></g></g></g></g></g>`;
  }
  function backdrop(uid,floor=223) {
    return `<defs><linearGradient id="${uid}-bg" x2=".8" y2="1"><stop stop-color="#101e1b"/><stop offset=".5" stop-color="#2b4238"/><stop offset="1" stop-color="#172b23"/></linearGradient><radialGradient id="${uid}-light"><stop stop-color="#c5ae7a" stop-opacity=".17"/><stop offset="1" stop-color="#c5ae7a" stop-opacity="0"/></radialGradient><linearGradient id="${uid}-floor" y2="1" x2="0"><stop stop-color="#4b6350" stop-opacity=".2"/><stop offset="1" stop-color="#0e211b" stop-opacity=".8"/></linearGradient></defs><rect width="480" height="340" fill="url(#${uid}-bg)"/><ellipse cx="323" cy="116" rx="175" ry="137" fill="url(#${uid}-light)"/><g class="scene-architecture" fill="none" stroke="#b2a27c" stroke-opacity=".13"><path d="M45 104L97 79H383L438 104M59 105H421M69 111H411M94 79L140 66H340L385 79M79 112V${floor}M401 112V${floor}M89 115V${floor}M391 115V${floor}"/><path d="M113 113H365V${floor}H113Z M126 117H352V${floor}H126Z"/><path d="M145 119V${floor}M167 119V${floor}M189 119V${floor}M291 119V${floor}M313 119V${floor}M335 119V${floor}" stroke-opacity=".08"/><path d="M224 120H256V${floor}H224Z" fill="#071810" fill-opacity=".4"/></g><path d="M0 ${floor}H480V340H0Z" fill="url(#${uid}-floor)"/><g stroke="#b4a17e" stroke-opacity=".08" fill="none"><path d="M24 ${floor}H456M5 ${floor+17}H475M0 ${floor+41}H480M70 340L170 ${floor}M410 340L311 ${floor}M240 ${floor}V340"/></g><g class="scene-motes" fill="#d0b583">${Array.from({length:9},(_,i)=>`<circle data-dust="${i}" cx="${69+i*43}" cy="${88+i%4*35}" r="${i%3===0?1:.6}" opacity=".14"/>`).join('')}</g><g fill="#101f19" opacity=".55"><path d="M0 61H18V${floor+10}H0M462 61H480V${floor+10}H462"/></g><path d="M22 19H42M22 19V39M458 19H438M458 19V39" fill="none" stroke="#ad9670" stroke-opacity=".4"/>`;
  }
  window.RESEARCH.sceneFigure=figure;
  window.RESEARCH.sceneBackdrop=backdrop;
  // Reuse the same drawn figures in the existing guided four-act scene.
  const guideVictim=document.querySelector('#scene-victim'),guideExecutor=document.querySelector('#scene-executor');
  if(guideVictim)guideVictim.innerHTML=figure(0,0,'victim','none');
  if(guideExecutor)guideExecutor.innerHTML=figure(0,0,'actor','rear');
  function nameplate(x,name,role) {return `<g class="v-nameplate"><text x="${x}" y="249" text-anchor="middle">${esc(name)}</text><text class="v-role" x="${x}" y="268" text-anchor="middle">${esc(role)}</text></g>`;}
  function bloodEffect(key) {
    if(!['slash','thrust'].includes(key))return '';
    const count=key==='thrust'?14:22;
    const drops=Array.from({length:count},(_,i)=>{
      const direction=i%5===0?-1:1;
      const dx=direction*(15+(i*17)%76), dy=-12-(i*13)%51;
      const radius=(key==='thrust'?1.6:2.2)+(i%4)*.55;
      return `<circle class="v-drop" r="${radius}" cx="0" cy="0" style="--blood-x:${dx}px;--blood-y:${dy}px;--blood-fall:${dy+70}px;--blood-delay:${(i%3)*.04}s"/>`;
    }).join('');
    return `<g class="v-blood" transform="translate(277 151)" aria-hidden="true"><circle class="v-blood-haze" r="38"/><g class="v-blood-jet"><path d="M0 0Q27-23 65-14M0 2Q25-3 49 13M-2-1Q10-21 34-31" fill="none" stroke="#c13e31" stroke-width="3" stroke-linecap="round"/></g>${drops}<g class="v-blood-residue"><path d="M4 1L13 5L9 10L15 15L7 17L3 10L-2 6Z"/><ellipse cx="29" cy="54" rx="12" ry="2"/></g></g>`;
  }
  function executionScreen() {
    return `<g class="v-execution-screen" opacity="0" aria-hidden="true"><path d="M214 82H391V231H214Z" fill="#14251e"/><path d="M222 89H384M222 225H384" stroke="#ad9266" stroke-opacity=".3"/><path class="v-screen-glint" d="M230 100L354 203" stroke="#e3d4b0" stroke-width="2"/></g><g class="v-history-result" opacity="0"><rect x="342" y="88" width="111" height="30" rx="2" fill="#17291f" stroke="#b78b60" stroke-opacity=".6"/><text x="397" y="108" text-anchor="middle" fill="#e3c99c" font-size="16">史载斩首</text></g>`;
  }
  function artwork(entry,uid) {
    const k=entry.key, info=scenes[k], ax=k==='rear'?360:148, vx=k==='rear'?278:k==='poison'?326:280;
    return `<svg class="v-art v-${k}" viewBox="0 0 480 340" role="img" aria-label="${esc(info.ruler+'；'+info.actor+' → '+info.victim+'；'+entry.tag)}"><defs><radialGradient id="${uid}-glow"><stop stop-color="#587062" stop-opacity=".5"/><stop offset="1" stop-color="#263a32" stop-opacity="0"/></radialGradient><pattern id="${uid}-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#d8c6a4" stroke-opacity=".045"/></pattern></defs><path fill="#20342d" d="M0 0H480V340H0Z"/><path fill="url(#${uid}-grid)" d="M0 0H480V340H0Z"/><ellipse cx="260" cy="150" rx="240" ry="170" fill="url(#${uid}-glow)"/><circle cx="370" cy="85" r="46" fill="#d1b382" opacity=".1"/><g fill="none" stroke="#c4b78f" stroke-opacity=".16"><path d="M34 222H446M73 215V93H409V215M55 93L116 66H361L426 93M89 103H396M100 108V207M378 108V207"/><path d="M22 21H40M22 21V39M458 21H440M458 21V39"/></g>${backdrop(uid)}<g class="v-relation"><rect x="44" y="19" width="392" height="40" rx="2" fill="#13271f" fill-opacity=".65"/><text x="57" y="35">${esc(info.ruler)}</text><path class="v-order" d="M177 31H206" stroke="#c47757" stroke-width="1.5" fill="none"/><path d="M202 27L208 31L202 35" stroke="#c47757" fill="none"/><text class="v-relation-note" x="219" y="35">${esc(info.relation)}</text><text class="v-relation-note" x="57" y="50">${esc(k==='thrust'?'亲自实施':k==='drink'?'强饮与押送分别记录':'下令者与执行者分开')}</text></g><g class="v-trail" fill="none" stroke="#e1c28b"><path class="v-sweep-soft" stroke-width="5" stroke-opacity=".12"/><path class="v-sweep-edge" stroke-width="1.2"/><path class="v-sweep-fan" fill="#c9ab75" fill-opacity=".12" stroke="none"/></g>${figure(ax,216,'actor',k)}${figure(vx,216,'victim',k)}<g class="v-rear-reach" style="display:none" transform="translate(338 138)"><path d="M0 0L-36 5L-58 16" fill="none" stroke="#859982" stroke-width="7" stroke-linecap="round"/></g><g class="v-cup" transform="translate(212 158)"><path d="M-15-8H15L11 7Q0 15-11 7Z" fill="#9f855b" stroke="#ddc38f" stroke-width=".8"/><ellipse cy="-8" rx="15" ry="3" fill="#c8ad73"/><ellipse cy="-8" rx="11" ry="1.8" fill="#77543b"/><path d="M-7-4L-5 7M7-4L5 7" stroke="#dac192" stroke-opacity=".4"/><path d="M0 11V22M-9 23H9" stroke="#c9b382" stroke-width="3"/><path class="v-ripple" d="M-9-10Q0-15 9-10" fill="none" stroke="#d89c72"/></g><g class="v-contact" transform="translate(277 151)" fill="none" stroke="#d4a078"><path d="M-9-4L-18-8M-8 4L-17 9M-1-9L-2-18" stroke-width="2"/></g><g class="v-harm" stroke="#c07857" fill="none" stroke-width="2"><path d="M272 191L281 199L273 205L282 213M285 192L293 200L285 206L294 214"/><ellipse cx="283" cy="204" rx="23" ry="17" stroke-opacity=".35"/></g><g class="v-cart" fill="none" stroke="#a7ad90" stroke-width="2"><path d="M241 181H321V215H241Z M234 215H331"/><circle cx="249" cy="224" r="7"/><circle cx="317" cy="224" r="7"/></g><g class="v-fork" fill="none" stroke="#bb9670"><path d="M280 277V282L214 287M280 282L347 287"/></g>${bloodEffect(k)}${k==='behead'?executionScreen():''}${nameplate(ax,info.actor,info.actorRole)}${nameplate(vx,info.victim,info.victimRole)}<g class="v-verdict"><rect x="408" y="169" width="34" height="44" rx="1" fill="none" stroke="#bf7558"/><text x="425" y="188" text-anchor="middle" fill="#cb8968" font-size="13">${k==='thrust'?'伤':'命'}</text><text x="425" y="205" text-anchor="middle" fill="#cb8968" font-size="13">${k==='thrust'?'害':k==='drink'?'疑':'断'}</text></g><path d="M27 286H452" stroke="#998966" stroke-opacity=".2"/><path class="v-clock-line" d="M27 286H452" pathLength="1" stroke="#bd9b63" stroke-width="1.2" stroke-dasharray="1"/><g class="v-phases">${info.steps.map((step,i)=>`<g class="v-phase v-phase-${i}"><circle cx="${47+i*139}" cy="303" r="2"/><text x="${58+i*139}" y="307">${i+1}. ${esc(step)}</text></g>`).join('')}</g><text x="26" y="329" fill="#8c9d88" font-size="9">${k==='drink'?'槛 / 鸩 · 两条记载':k==='thrust'?'先行伤害 / 尚未致死':'人物动作与器物为示意'}</text><text x="453" y="329" text-anchor="end" fill="#8c9d88" font-size="9">${entry.event}</text></svg>`;
  }
  window.RESEARCH.visuals=entries;
  window.RESEARCH.visualArtwork=artwork;
  const cards=document.querySelector('#violence-cards');
  cards.innerHTML=entries.map((e,i)=>`<button class="violence-card" type="button" data-event="${e.event}" data-visual="${e.key}" aria-label="${esc(e.tag)}：展开${esc(e.title)}"><span class="v-card-top"><span>${String(i+1).padStart(2,'0')} / ${esc(e.tag)}</span><span class="v-status">${esc(e.status)}</span></span>${artwork(e,'archive-'+i)}<span class="v-card-body"><span class="v-subtitle">${esc(e.subtitle)}</span><strong>${esc(e.title)}</strong><span class="v-question">${esc(e.question)}</span><span class="v-card-link">查看事件经过与原因 <span aria-hidden="true">↗</span></span></span></button>`).join('');
  const preferences={read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}};
  const bloodToggle=document.querySelector('#violence-blood');
  const bloodEnabled=preferences.read('qi-blood-enabled',true)!==false;
  document.documentElement.classList.toggle('blood-disabled',!bloodEnabled);
  bloodToggle.setAttribute('aria-pressed',String(bloodEnabled));bloodToggle.textContent=bloodEnabled?'血色特效：开启':'血色特效：关闭';
  bloodToggle.addEventListener('click',()=>{
    const off=document.documentElement.classList.toggle('blood-disabled');
    bloodToggle.setAttribute('aria-pressed',String(!off));preferences.write('qi-blood-enabled',!off);
    bloodToggle.textContent=off?'血色特效：关闭':'血色特效：开启';
  });
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'), toggle=document.querySelector('#violence-motion');
  let paused=reduce.matches, tracked=[], previous=null, speed=preferences.read('qi-animation-speed',1)===.55?.55:1;
  function updateSpeed(){document.documentElement.classList.toggle('scene-slow',speed!==1);const button=document.querySelector('#violence-speed');button.textContent=speed===1?'速度：正常':'速度：慢放';button.setAttribute('aria-pressed',String(speed!==1));}updateSpeed();
  const poses={
    behead:[[0,0,-4,-65,8],[.17,-5,-9,-92,25],[.31,-4,-8,-94,22],[.36,0,-2,-69,10],[.43,18,12,-25,2],[.49,19,10,28,6],[.64,10,2,48,9],[.88,10,2,48,9],[1,10,2,48,9]],
    slash:[[0,0,-4,-65,8],[.17,-5,-9,-92,25],[.31,-4,-8,-94,22],[.36,0,-2,-69,10],[.43,18,12,-6,4],[.49,19,10,28,6],[.64,10,2,48,9],[.88,10,2,48,9],[1,10,2,48,9]],
    thrust:[[0,0,-3,30,-105],[.2,-4,-7,35,-115],[.39,22,10,-3,6],[.55,22,8,-3,6],[.78,0,-3,30,-105],[1,0,-3,30,-105]],
    rear:[[0,32,0,60,15],[.18,24,0,55,15],[.42,-16,-6,5,5],[.63,-16,-6,5,5],[.87,32,0,60,15],[1,32,0,60,15]],
    punish:[[0,0,0,55,15],[.25,0,-3,25,20],[.44,10,7,30,15],[.7,10,4,30,15],[1,0,0,55,15]],
    poison:[[0,0,0,15,15],[.2,16,3,10,15],[.4,35,6,-8,15],[.63,35,3,12,20],[.88,0,0,15,15],[1,0,0,15,15]],
    drink:[[0,0,0,15,15],[.22,16,3,10,15],[.4,29,6,-8,15],[.64,29,3,12,20],[.88,0,0,15,15],[1,0,0,15,15]]
  };
  const clamp=(v)=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const wave=(p,a,b,c,d)=>p<a||p>d?0:p<b?smooth((p-a)/(b-a)):p<c?1:1-smooth((p-c)/(d-c));
  const radians=v=>v*Math.PI/180;
  function poseAt(key,p){const frames=poses[key];let i=0;while(i<frames.length-2&&p>frames[i+1][0])i++;const a=frames[i],b=frames[i+1],t=smooth((p-a[0])/(b[0]-a[0]));return a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);}
  const cycleFor=key=>key==='behead'?7200:5600;
  function worldPoint(rig,pose,x,y,drop=0){
    const [step,body]=pose,angle=radians(body),facing=Number(rig.dataset.facing);
    return {x:Number(rig.dataset.x)+step+facing*(x*Math.cos(angle)-(y+25)*Math.sin(angle)),y:Number(rig.dataset.y)+drop+x*Math.sin(angle)+(y+25)*Math.cos(angle)-25};
  }
  function bladeTip(rig,pose){const [,body,shoulder,elbow]=pose,hand=worldPoint(rig,pose,10+26*Math.cos(radians(shoulder))+24*Math.cos(radians(shoulder+elbow)),-69+26*Math.sin(radians(shoulder))+24*Math.sin(radians(shoulder+elbow))),length=Number(rig.querySelector('.rig-weapon')?.dataset.length||0),angle=radians(body+shoulder+elbow);return {x:hand.x+Number(rig.dataset.facing)*length*Math.cos(angle),y:hand.y+length*Math.sin(angle)};}
  function rigPose(rig,pose,drop=0){
    const [step,body,shoulder,elbow]=pose;
    rig.querySelector('.rig-move').setAttribute('transform',`translate(${step} ${drop})`);
    rig.querySelector('.rig-torso').setAttribute('transform',`rotate(${body} 0 -25)`);
    rig.querySelector('.rig-shoulder').setAttribute('transform',`rotate(${shoulder})`);
    rig.querySelector('.rig-elbow').setAttribute('transform',`rotate(${elbow})`);
    rig.querySelector('.rig-hem').setAttribute('transform',`skewX(${body*.12})`);
    rig.querySelector('.rig-shadow').setAttribute('rx',String(36+Math.abs(step)*.1));
    rig.querySelector('.rig-front-foot').setAttribute('transform',`rotate(${-body*.5} 8 -3)`);
    // Return the hand in scene coordinates, so props cannot detach from it.
    const x=10+26*Math.cos(radians(shoulder))+24*Math.cos(radians(shoulder+elbow));
    const y=-69+26*Math.sin(radians(shoulder))+24*Math.sin(radians(shoulder+elbow));
    const bx=x*Math.cos(radians(body))-(y+25)*Math.sin(radians(body));
    const by=x*Math.sin(radians(body))+(y+25)*Math.cos(radians(body))-25;
    const hand={x:Number(rig.dataset.x)+step+Number(rig.dataset.facing)*bx,y:Number(rig.dataset.y)+drop+by};const length=Number(rig.querySelector('.rig-weapon')?.dataset.length||0),angle=radians(body+shoulder+elbow);return {...hand,tip:{x:hand.x+Number(rig.dataset.facing)*length*Math.cos(angle),y:hand.y+length*Math.sin(angle)}};
  }
  function drawScene(scene){
    const {svg,key,actor,victim}=scene,p=(scene.elapsed%cycleFor(key))/cycleFor(key),strike=['slash','behead'].includes(key)?.43:.39,impact=wave(p,strike-.005,strike+.045,.64,.86);
    if(svg.closest('.detail-visual')){const slider=document.querySelector('[data-scene-progress]');if(slider)slider.value=String(Math.round(p*100));const output=document.querySelector('[data-scene-time]');if(output)output.textContent=Math.round(p*100)+'%';
      const phaseIndex=p<.32?0:p<.55?1:2,buttons=[...document.querySelectorAll('[data-scene-jump]')];
      buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===phaseIndex)));
      if(slider)slider.setAttribute('aria-valuetext',`${Math.round(p*100)}%，${buttons[phaseIndex]?.textContent||'动作阶段'}`);
    }
    const actorPose=poseAt(key,p);actorPose[1]+=Math.sin(p*Math.PI*2)*.45;const hand=rigPose(actor,actorPose);
    const fatal=['slash','rear','poison','behead'].includes(key);
    let victimPose=[impact*4,-impact*15,65-impact*13,18+impact*9],drop=impact*5;
    if(key==='behead'){const reaction=smooth((p-.48)/.22);victimPose=[reaction*10,-reaction*77,65-reaction*20,18+reaction*18];drop=reaction*10;}
    if(key==='slash'){const recoil=wave(p,strike,strike+.12,.82,.97);victimPose=[recoil*9,-recoil*42,65-recoil*20,18+recoil*16];drop=recoil*18;}
    if(key==='punish'){victimPose=[impact*7,-impact*20,70,15];drop=impact*8;}
    if(['poison','drink'].includes(key)){const sip=wave(p,.34,.47,.63,.83);victimPose=[0,-sip*7,25-sip*80,15+sip*38];}
    const otherHand=rigPose(victim,victimPose,drop);
    victim.querySelector('.rig-move').style.opacity=String(fatal?1-impact*.5:1-impact*.16);
    const cup=svg.querySelector('.v-cup');
    if(['poison','drink'].includes(key)){
      const transfer=smooth((p-.34)/.13),a=p<.47?hand:otherHand;
      const cx=p<.47?hand.x+(otherHand.x-hand.x)*transfer:a.x;
      const cy=p<.47?hand.y+(otherHand.y-hand.y)*transfer:a.y;
      cup.setAttribute('transform',`translate(${cx} ${cy-9}) rotate(${-28*wave(p,.43,.5,.63,.75)})`);
      cup.style.opacity=String(wave(p,.06,.18,.68,.79));
    }
    svg.querySelector('.v-clock-line').setAttribute('stroke-dashoffset',String(1-p));
    svg.querySelectorAll('[data-dust]').forEach((dust,i)=>dust.setAttribute('transform',`translate(${Math.sin(p*6.28+i)*3} ${-p*8})`));
    const cutting=['slash','behead'].includes(key);
    scene.trail=cutting&&p>=.32&&p<=.56?Array.from({length:9},(_,i)=>{const time=Math.max(.32,p-(8-i)*.005),pose=poseAt(key,time);pose[1]+=Math.sin(time*Math.PI*2)*.45;return bladeTip(actor,pose);}):[];
    const path=scene.trail.map((point,i)=>`${i?'L':'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    svg.querySelector('.v-sweep-soft').setAttribute('d',path);
    svg.querySelector('.v-sweep-edge').setAttribute('d',path);
    svg.querySelector('.v-sweep-fan').setAttribute('d',scene.trail.length>1?`M${hand.x} ${hand.y} ${path.replace(/^M/,'L')} Z`:'');
    svg.querySelector('.v-trail').style.opacity=String(cutting?wave(p,.34,.4,.48,.56):0);
    if(key==='behead'){
      const cover=wave(p,.365,.405,.53,.65);
      svg.querySelector('.v-execution-screen').style.opacity=String(cover);
      svg.querySelector('.v-screen-glint').style.opacity=String(wave(p,.405,.43,.455,.49));
      svg.querySelector('.v-history-result').style.opacity=String(wave(p,.55,.65,.91,.99));
      victim.querySelector('.rig-move').style.opacity=String(1-smooth((p-.94)/.06));
      if(svg.closest('.detail-visual'))document.dispatchEvent(new CustomEvent('scene-progress',{detail:{key,progress:p}}));
    }
    svg.querySelector('.v-contact').style.opacity=String(['slash','thrust'].includes(key)?wave(p,strike-.01,strike+.01,strike+.035,strike+.1):0);
    svg.querySelector('.v-harm').style.opacity=String(key==='punish'?impact:0);
    svg.querySelector('.v-cart').style.opacity=String(key==='drink'?wave(p,.52,.6,.74,.85):0);
    svg.querySelector('.v-verdict').style.opacity=String(wave(p,.5,.58,.8,.92));
    svg.querySelectorAll('.v-phase').forEach((phase,i)=>phase.style.opacity=String(i===(p<.32?0:p<.55?1:2)?1:.25));
    const blood=svg.querySelector('.v-blood');
    if(blood){
      blood.setAttribute('transform',`translate(${Number(victim.dataset.x)+victimPose[0]-3} ${Number(victim.dataset.y)+drop-(key==='behead'?86:65)})`);
      const burst=wave(p,strike,strike+.025,strike+.065,strike+.2);
      blood.querySelector('.v-blood-jet').style.opacity=String(burst);
      blood.querySelector('.v-blood-jet').setAttribute('transform',`scale(${.3+burst*.7})`);
      blood.querySelector('.v-blood-haze').style.opacity=String(burst*.12);
      blood.querySelector('.v-blood-residue').style.opacity=String(wave(p,strike+.06,strike+.13,.72,.86)*.55);
      blood.querySelectorAll('.v-drop').forEach((particle,i)=>{
        const t=clamp((p-strike-i%3*.007)/.18);
        const dx=parseFloat(particle.style.getPropertyValue('--blood-x')),dy=parseFloat(particle.style.getPropertyValue('--blood-y'));
        particle.style.opacity=String(t>0&&t<1?Math.sin(t*Math.PI):0);
        particle.setAttribute('transform',`translate(${dx*t} ${dy*t+70*t*t}) scale(${.6+.4*t})`);
      });
    }
  }
  const detailPositions=new Map();
  function collect(){
    const old=new Map(tracked.map(item=>[item.svg,item]));
    tracked.filter(item=>item.svg.closest('.detail-visual')).forEach(item=>detailPositions.set(item.key,item.elapsed));
    let restored=false;
    tracked=[...document.querySelectorAll('.v-art')].map(svg=>{
      if(old.has(svg))return old.get(svg);
      const key=entries.find(entry=>svg.classList.contains('v-'+entry.key)).key;
      const resume=svg.closest('.detail-visual')&&detailPositions.has(key);restored=restored||resume;
      return {svg,key,actor:svg.querySelector('.rig-actor'),victim:svg.querySelector('.rig-victim'),elapsed:resume?detailPositions.get(key):reduce.matches?2900:0};
    });
    if(restored){paused=true;update();const status=document.querySelector('[data-scene-state]');if(status)status.textContent='已恢复本次浏览的进度，点击播放继续';}
    tracked.forEach(drawScene);
  }
  const update=()=>{toggle.setAttribute('aria-pressed',String(paused));toggle.textContent=paused?'播放卡片动画 ▷':'暂停卡片动画 Ⅱ';document.querySelectorAll('[data-animation-action=motion]').forEach(button=>button.textContent=toggle.textContent.replace('卡片',''));};
  document.querySelector('#violence-speed')?.addEventListener('click',()=>{speed=speed===1?.55:1;preferences.write('qi-animation-speed',speed);updateSpeed();});
  document.querySelector('#violence-replay')?.addEventListener('click',()=>{tracked.forEach(scene=>{scene.once=false;scene.elapsed=reduce.matches?2900:0;drawScene(scene);});const state=document.querySelector('[data-scene-state]');if(state)state.textContent='已回到开始，点击播放查看';document.dispatchEvent(new Event('archive-replay'));});
  toggle.addEventListener('click',()=>{paused=!paused;update();});
  document.addEventListener('input',event=>{if(!event.target.matches('[data-scene-progress]'))return;paused=true;update();const p=Number(event.target.value)/100;tracked.filter(scene=>scene.svg.closest('.detail-visual')).forEach(scene=>{scene.once=false;scene.elapsed=Math.min(.999,p)*cycleFor(scene.key);scene.trail=[];drawScene(scene);});document.querySelector('[data-animation-action=motion]').textContent=toggle.textContent.replace('卡片','');const state=document.querySelector('[data-scene-state]');if(state)state.textContent='已暂停，可拖动进度查看细节';});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-scene-once],[data-scene-nudge],[data-expand-scene]');if(!button)return;
    const dialog=document.querySelector('#detail-dialog');
    if(button.hasAttribute('data-expand-scene')){const expanded=dialog.classList.toggle('scene-expanded');button.setAttribute('aria-pressed',String(expanded));button.textContent=expanded?'恢复画面 ⤡':'放大画面 ⤢';requestAnimationFrame(()=>dialog.querySelector('.scene-workbench').scrollIntoView({block:'start',behavior:'instant'}));return;}
    if(button.hasAttribute('data-scene-nudge')){const slider=dialog.querySelector('[data-scene-progress]');slider.value=String(Math.max(0,Math.min(100,Number(slider.value)+Number(button.dataset.sceneNudge))));slider.dispatchEvent(new Event('input',{bubbles:true}));dialog.querySelector('[data-scene-state]').textContent='已暂停，可用进度条或 ±1% 查看细节';return;}
    tracked.filter(scene=>scene.svg.closest('.detail-visual')).forEach(scene=>{scene.once=true;scene.elapsed=0;drawScene(scene);});
    paused=false;update();dialog.querySelector('[data-scene-state]').textContent='正在单次播放，结束后停在结果画面';
  });
  document.addEventListener('visibilitychange',()=>{previous=null;});
  reduce.addEventListener('change' ,()=>{paused=reduce.matches;tracked.forEach(item=>{item.elapsed=reduce.matches?2900:0;drawScene(item);});update();});
  const observer=new IntersectionObserver(items=>items.forEach(item=>item.target.classList.toggle('in-view',item.isIntersecting)),{threshold:.1});
  cards.querySelectorAll('.violence-card').forEach(card=>observer.observe(card));
  new MutationObserver(collect).observe(document.querySelector('#dialog-body'),{childList:true});
  function frame(now){const dt=previous===null?0:Math.min(now-previous,50);previous=now;const dialogOpen=document.querySelector('#detail-dialog').open;
    if(document.documentElement.classList.contains('ui-settings-open')){requestAnimationFrame(frame);return;}
    tracked.forEach(scene=>{const modal=!!scene.svg.closest('.detail-visual');const visible=modal?dialogOpen:!dialogOpen&&scene.svg.closest('.violence-card').classList.contains('in-view');if(visible&&!document.hidden&&!paused){scene.elapsed+=dt*speed;
      if(modal&&scene.once&&scene.elapsed>=cycleFor(scene.key)*.9){scene.elapsed=cycleFor(scene.key)*.9;scene.once=false;paused=true;update();document.querySelector('[data-scene-state]').textContent='单次播放结束 · 已停在结果画面';}
      drawScene(scene);}});
    requestAnimationFrame(frame);
  }
  collect();update();requestAnimationFrame(frame);
})();
