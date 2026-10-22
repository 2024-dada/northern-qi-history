(() => {
  'use strict';
  const themes=[
    {id:'paper',name:'原版宣纸',description:'暖纸底色与朱砂点缀',colors:['#ede8dc','#252c25','#9d4236']},
    {id:'jade',name:'青瓷竹影',description:'浅青底色与深绿文字',colors:['#e4eee7','#203e34','#23684f']},
    {id:'blue',name:'月白藏蓝',description:'月白底色与藏蓝点缀',colors:['#e6edf5','#223a51','#365f95']},
    {id:'night',name:'墨夜阅读',description:'深色底面与柔和浅字',colors:['#151d20','#edf0df','#e7b889']}
  ];
  const root=document.documentElement,key='qi-ui-theme';
  let selected='paper';
  try{const saved=localStorage.getItem(key);if(themes.some(t=>t.id===saved))selected=saved;}catch{}
  root.dataset.uiTheme=selected;
  function mount(){
    const panel=document.createElement('dialog');panel.id='ui-settings';panel.className='ui-settings-dialog';panel.setAttribute('aria-labelledby','ui-settings-title');
    panel.innerHTML=`<div class="ui-settings-heading"><div><p class="ui-settings-kicker">阅读外观</p><h2 id="ui-settings-title">界面设置</h2></div><button type="button" class="ui-settings-close" aria-label="关闭界面设置">×</button></div><p class="ui-settings-intro">选择一种配色，整页立即生效。主站和人物故事页共用你的选择。</p><fieldset class="ui-theme-options"><legend>选择界面配色</legend>${themes.map(theme=>`<label class="ui-theme-choice"><input type="radio" name="qi-ui-theme" value="${theme.id}"><span class="ui-theme-swatches" aria-hidden="true">${theme.colors.map(color=>`<i style="background:${color}"></i>`).join('')}</span><span class="ui-theme-copy"><strong>${theme.name}</strong><small>${theme.description}</small></span><span class="ui-theme-selected" aria-hidden="true">✓</span></label>`).join('')}</fieldset><p class="ui-settings-note">动画、人物画像和图表的含义配色保持不变。设置仅保存在当前浏览器。</p><div class="ui-settings-footer"><button type="button" data-ui-reset>恢复原版配色</button><button type="button" data-ui-done>完成</button></div><p class="ui-settings-status" role="status" aria-live="polite"></p>`;
    document.body.append(panel);
    let opener=null;
    const sync=()=>{panel.querySelectorAll('input[name="qi-ui-theme"]').forEach(input=>input.checked=input.value===selected);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themes.find(t=>t.id===selected).colors[0]);};
    const apply=(id,persist=true)=>{
      if(!themes.some(theme=>theme.id===id))return;selected=id;root.dataset.uiTheme=id;sync();
      let saved=true;if(persist){try{localStorage.setItem(key,id);}catch{saved=false;}}
      panel.querySelector('.ui-settings-status').textContent=persist?(saved?'已应用并保存，下次打开将继续使用。':'已应用，但当前浏览器无法保存；刷新后可能恢复默认。'):'';
    };
    function notifyOpen(open){root.classList.toggle('ui-settings-open',open);document.dispatchEvent(new CustomEvent('ui-settings-toggle',{detail:{open}}));}
    document.querySelectorAll('[data-ui-settings]').forEach(button=>{button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>{opener=button;sync();panel.showModal();notifyOpen(true);panel.querySelector('input:checked').focus();});});
    panel.addEventListener('change',event=>{if(event.target.matches('input[name="qi-ui-theme"]'))apply(event.target.value);});
    panel.querySelector('.ui-settings-close').addEventListener('click',()=>panel.close());
    panel.querySelector('[data-ui-done]').addEventListener('click',()=>panel.close());
    panel.querySelector('[data-ui-reset]').addEventListener('click',()=>apply('paper'));
    panel.addEventListener('close',()=>{notifyOpen(false);if(opener?.isConnected)opener.focus({preventScroll:true});});
    panel.addEventListener('click',event=>{if(event.target!==panel)return;const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();});
    document.addEventListener('keydown',event=>{if(panel.open)event.stopPropagation();},true);
    window.addEventListener('storage',event=>{if(event.key===key)apply(themes.some(t=>t.id===event.newValue)?event.newValue:'paper',false);});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
