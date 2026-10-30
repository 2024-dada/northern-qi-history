(() => {
 'use strict';
 const endpoint='https://northern-qi-ai-help.bright-guppy-8139.chatgpt.site/api/chat';
 const main=document.body.classList.contains('qi-companion')?'../index.html':'index.html';
 const panel=document.createElement('dialog');panel.className='ai-help-dialog';panel.setAttribute('aria-labelledby','ai-help-title');
 panel.innerHTML='<header class="ai-help-header"><div><small>帝怒之后 · 阅读助手</small><h2 id="ai-help-title">AI答疑</h2></div><button type="button" data-ai-close aria-label="关闭AI答疑">×</button></header><p class="ai-help-note">可解读当前页面、查找站内材料或询问历史知识。AI可能出错；史料关键句仍待核，暂未启用实时联网搜索。</p><label class="ai-help-context"><input type="checkbox" checked data-ai-context>结合当前阅读内容 <span data-ai-reading></span></label><div class="ai-help-prompts"><button type="button" data-ai-prompt="请通俗解释当前页面的内容，并区分史料记载与项目解释。">解释这一页</button><button type="button" data-ai-prompt="当前事件有哪些史料依据？有什么分歧或待核问题？">查找史料依据</button><button type="button" data-ai-prompt="高欢与高洋分别是什么身份？北齐是谁建立的？">试问历史知识</button></div><div class="ai-help-log" role="log" aria-label="答疑记录" aria-live="polite" tabindex="0"></div><p class="ai-help-status" role="status" aria-live="polite"></p><form class="ai-help-form"><label for="ai-question">你的问题</label><textarea id="ai-question" maxlength="1000" rows="2" placeholder="例如：这个事件为什么不能只用暴怒解释？" required></textarea><div><button type="button" data-ai-clear>清空对话</button><button type="submit">发送问题 ↗</button></div></form>';
 document.body.append(panel);
 const form=panel.querySelector('form'),input=panel.querySelector('textarea'),log=panel.querySelector('.ai-help-log'),status=panel.querySelector('.ai-help-status'),send=form.querySelector('[type=submit]');
 let history=[],reading={},controller=null,opener=null;
 function context(){
  const detail=document.querySelector('#detail-dialog[open]'),story=document.querySelector('#story-overlay[open] .story-page.active');
  if(detail){const link=detail.querySelector('[data-event-permalink]');return {event:link?new URLSearchParams(new URL(link.href).hash.slice(1)).get('event'):'',title:detail.querySelector('#dialog-title')?.textContent||'出处说明',text:detail.querySelector('#dialog-body')?.innerText.slice(0,3000)||''};}
  if(story)return {title:story.querySelector('.s-title')?.textContent||'人物故事',text:story.innerText.slice(0,3000)};
  const section=[...document.querySelectorAll('main section')].find(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight*.5&&r.bottom>innerHeight*.5;});
  return {title:section?.querySelector('h2')?.textContent||document.title,text:section?.innerText.slice(0,3000)||document.querySelector('.companion-context')?.innerText||'北齐高氏历史课程网页'};
 }
 function open(button){opener=button;reading=context();panel.querySelector('[data-ai-reading]').textContent='· '+reading.title;panel.showModal();document.documentElement.classList.add('ai-help-open');document.dispatchEvent(new CustomEvent('ui-settings-toggle',{detail:{open:true}}));input.focus();}
 function addEntry(role,text,sources=[]){
  const entry=document.createElement('article');entry.className='ai-help-message ai-help-'+role;
  const label=document.createElement('strong');label.textContent=role==='user'?'你':'AI答疑';const content=document.createElement('div');content.textContent=text;entry.append(label,content);
  if(sources.length){const refs=document.createElement('div');refs.className='ai-help-sources';const title=document.createElement('p');title.textContent='本次检索到的站内材料（不等于每条都被答案引用）';refs.append(title);for(const source of sources){if(!/^[ED]\d{2}$/.test(source.id))continue;const a=document.createElement('a');a.href=main+'#event='+encodeURIComponent(source.id);a.textContent='['+source.id+'] '+source.title;a.addEventListener('click',()=>panel.close());refs.append(a);}entry.append(refs);}
  log.append(entry);entry.scrollIntoView({block:'nearest'});
 }
 function addLauncher(target){if(!target||target.querySelector('[data-ai-help]'))return;const button=document.createElement('button');button.type='button';button.dataset.aiHelp='';button.className='ai-help-launch';button.textContent='AI答疑';button.setAttribute('aria-haspopup','dialog');target.append(button);}
 addLauncher(document.querySelector('.site-header nav')||document.querySelector('.companion-nav div'));
 const detail=document.querySelector('#dialog-body');if(detail){addLauncher(detail.querySelector('.event-actions'));new MutationObserver(()=>addLauncher(detail.querySelector('.event-actions'))).observe(detail,{childList:true});}
 addLauncher(document.querySelector('.story-keyboard-help'));
 document.addEventListener('click',event=>{const button=event.target.closest('[data-ai-help]');if(button)open(button);});
 panel.querySelector('[data-ai-close]').onclick=()=>panel.close();
 panel.addEventListener('close',()=>{document.documentElement.classList.remove('ai-help-open');if(opener?.isConnected)opener.focus({preventScroll:true});});
 panel.addEventListener('keydown',event=>event.stopPropagation());
 panel.querySelectorAll('[data-ai-prompt]').forEach(button=>button.onclick=()=>{input.value=button.dataset.aiPrompt;input.focus();});
 panel.querySelector('[data-ai-clear]').onclick=()=>{controller?.abort();history=[];log.replaceChildren();status.textContent='已清空本次对话。';};
 form.addEventListener('submit',async event=>{
  event.preventDefault();const question=input.value.trim();if(!question||controller)return;
  const current=new AbortController();controller=current;send.disabled=true;status.textContent='正在查找材料并思考…';addEntry('user',question);input.value='';
  const timeout=setTimeout(()=>current.abort(),55000);
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:current.signal,body:JSON.stringify({question,history,context:panel.querySelector('[data-ai-context]').checked?reading:{}})});const result=await response.json();if(!response.ok)throw new Error(result.error||'服务暂时不可用');if(current.signal.aborted)return;addEntry('assistant',result.answer,result.sources||[]);history.push({role:'user',content:question},{role:'assistant',content:result.answer});history=history.slice(-6);status.textContent=result.notice||'回答仅供参考，请核对原典。';}
  catch(error){if(!current.signal.aborted){status.textContent='未能回答：'+(error.message==='Failed to fetch'?'服务暂时连接不上，请稍后再试。':error.message);input.value=question;}else if(log.childElementCount)status.textContent='请求已取消或超时，可重新提问。';}
  finally{clearTimeout(timeout);controller=null;send.disabled=false;}
 });
})();
