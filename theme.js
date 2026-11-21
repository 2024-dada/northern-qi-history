(() => {
  'use strict';
  const defaultTheme='mural';
  const themes=[
    {id:'mural',name:'赭红石青',description:'暖色矿物颜料，配赭红与暗金',colors:['#f5e9d2','#30241e','#8a352d']},
    {id:'paper',name:'原版宣纸',description:'淡墨城楼、芦苇与素白纸纹',colors:['#f4eddf','#332b23','#8b4b38']},
    {id:'jade',name:'青瓷竹影',description:'竹林临江，一叶小舟穿过晨雾',colors:['#e5f0e5','#183f32','#23664d']},
    {id:'blue',name:'月白藏蓝',description:'青花远山、曲水与石桥',colors:['#eaf0fa','#223b58','#365f95']},
    {id:'night',name:'墨夜阅读',description:'月下宫阙，靛蓝夜色与暖灯',colors:['#141d29','#f0ebdf','#ebbd84']}
  ];
  const root=document.documentElement,key='qi-ui-theme';
  let selected=defaultTheme;
  try{const saved=localStorage.getItem(key);if(themes.some(t=>t.id===saved))selected=saved;}catch{}
  root.dataset.uiTheme=selected;
  function mount(){
    const panel=document.createElement('dialog');panel.id='ui-settings';panel.className='ui-settings-dialog';panel.setAttribute('aria-labelledby','ui-settings-title');
    panel.innerHTML=`<div class="ui-settings-heading"><h2 id="ui-settings-title">界面设置</h2><button type="button" class="ui-settings-close" aria-label="关闭界面设置">×</button></div>
      <p class="ui-settings-intro">切换主题会同时换背景和界面配色。主站、人物故事、讲解石和游戏共用你的选择。</p>
      <fieldset class="ui-theme-options"><legend>选择主题</legend>${themes.map(theme=>`
        <label class="ui-theme-choice">
          <input type="radio" name="qi-ui-theme" value="${theme.id}">
          <span class="ui-theme-preview" data-theme-preview="${theme.id}" aria-hidden="true">
            <span class="ui-theme-swatches">${theme.colors.map(color=>`<i style="background:${color}"></i>`).join('')}</span>
          </span>
          <span class="ui-theme-copy"><strong>${theme.name}</strong><small>${theme.description}</small></span>
          <span class="ui-theme-selected" aria-hidden="true">✓</span>
        </label>`).join('')}</fieldset>
      <p class="ui-settings-note">设置保存在当前浏览器。</p>
      <div class="ui-settings-footer"><button type="button" data-ui-reset>恢复默认主题</button><button type="button" data-ui-done>完成</button></div>
      <p class="ui-settings-status" role="status" aria-live="polite"></p>`;
    document.body.append(panel);
    let opener=null;
    const sync=()=>{panel.querySelectorAll('input[name="qi-ui-theme"]').forEach(input=>input.checked=input.value===selected);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themes.find(t=>t.id===selected).colors[0]);};
    const apply=(id,persist=true)=>{
      if(!themes.some(theme=>theme.id===id))return;
      selected=id;
      root.dataset.uiTheme=id;
      sync();
      document.dispatchEvent(new CustomEvent('ui-theme-change',{detail:{id}}));
      let saved=true;if(persist){try{localStorage.setItem(key,id);}catch{saved=false;}}
      panel.querySelector('.ui-settings-status').textContent=persist?(saved?'已应用并保存，下次打开将继续使用。':'已应用，但当前浏览器无法保存；刷新后可能恢复默认。'):'';
    };
    function notifyOpen(open){root.classList.toggle('ui-settings-open',open);document.dispatchEvent(new CustomEvent('ui-settings-toggle',{detail:{open}}));}
    document.querySelectorAll('[data-ui-settings]').forEach(button=>{button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>{opener=button;sync();panel.showModal();notifyOpen(true);panel.querySelector('input:checked').focus();});});
    panel.addEventListener('change',event=>{if(event.target.matches('input[name="qi-ui-theme"]'))apply(event.target.value);});
    panel.querySelector('.ui-settings-close').addEventListener('click',()=>panel.close());
    panel.querySelector('[data-ui-done]').addEventListener('click',()=>panel.close());
    panel.querySelector('[data-ui-reset]').addEventListener('click',()=>apply(defaultTheme));
    panel.addEventListener('close',()=>{notifyOpen(false);if(opener?.isConnected)opener.focus({preventScroll:true});});
    panel.addEventListener('click',event=>{if(event.target!==panel)return;const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();});
    document.addEventListener('keydown',event=>{if(panel.open)event.stopPropagation();},true);
    window.addEventListener('storage',event=>{
      if(event.key!==key&&event.key!==null)return;
      try{if(event.storageArea!==localStorage)return;}catch{return;}
      apply(themes.some(t=>t.id===event.newValue)?event.newValue:defaultTheme,false);
    });
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
