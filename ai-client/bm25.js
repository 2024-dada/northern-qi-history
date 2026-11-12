const TRADITIONAL_TO_SIMPLIFIED=Object.fromEntries(`
後:后 齊:齐 國:国 書:书 殺:杀 斬:斩 歲:岁 見:见 無:无 婦:妇 兒:儿 嬪:嫔 與:与 內:内 極:极 過:过 別:别 縣:县 長:长 劉:刘 陽:阳 陰:阴 時:时 實:实 戶:户 聖:圣 號:号 兩:两 亂:乱 雲:云 園:园 鐵:铁 從:从 舉:举 謝:谢 難:难 說:说 頭:头 剝:剥 貴:贵 稱:称 飲:饮 餘:余 獻:献 經:经 異:异 為:为 愛:爱 門:门 將:将 軍:军 學:学 會:会 萬:万 眾:众 於:于 傳:传 獲:获 發:发 體:体 聲:声 進:进 讓:让 帶:带 邊:边 劍:剑 斷:断 聞:闻 宮:宫 關:关 羅:罗 賜:赐 還:还 報:报 屬:属 舊:旧 廣:广 華:华 縱:纵 陳:陈 張:张 楊:杨 趙:赵 樂:乐 親:亲 淚:泪 臺:台 當:当 應:应 戰:战 傷:伤 敵:敌 諸:诸 來:来 間:间 動:动 畫:画 權:权 勢:势 爭:争 隊:队 話:话 讀:读 記:记 錄:录 證:证 對:对 錯:错 現:现 歷:历 誰:谁 這:这 個:个 氣:气 錢:钱 費:费 歸:归 種:种 臨:临 豈:岂 歐:欧 惡:恶 敗:败 職:职 儀:仪 變:变 顯:显 壓:压 諫:谏 謀:谋 謂:谓 復:复 辭:辞 姦:奸 損:损 續:续 轉:转 換:换 統:统 簡:简 專:专 該:该 細:细 緻:致 設:设 優:优 質:质 條:条 評:评 價:价 檢:检 測:测 須:须 領:领 數:数 庫:库 區:区 塊:块 頻:频 率:率 環:环 鑰:钥 盜:盗 竊:窃 遺:遗 強:强 興:兴 龍:龙 鳳:凤 馬:马 魚:鱼 鳥:鸟 獸:兽 雞:鸡 鬥:斗 雜:杂 燒:烧 熱:热 盡:尽 縛:缚 懲:惩 罰:罚 禍:祸 冊:册 詔:诏 諡:谥 廟:庙 齡:龄 屍:尸 廢:废 淵:渊 緩:缓 偽:伪 術:术 醫:医 藥:药 隱:隐 險:险 遷:迁 驅:驱 奪:夺 執:执 隨:随 誤:误 輯:辑 擴:扩 訂:订 構:构 憑:凭 檔:档 觀:观 覽:览 寫:写 輸:输 語:语 談:谈 論:论 習:习 課:课 師:师 節:节 標:标 樣:样 綱:纲 紀:纪 參:参 帳:账 註:注 認:认 佈:布 絡:络 訊:讯 準:准 確:确 採:采 組:组 織:织 載:载 麼:么 髮:发 義:义 臉:脸 麵:面 額:额 購:购 閱:阅 產:产 業:业 授:授 權:权 錶:表 鐘:钟 齋:斋 聽:听 風:风 雖:虽 嚴:严 徵:征 徹:彻 鏈:链 選:选 殘:残 當:当 開:开 圍:围 階:阶 層:层 記:记 講:讲 體:体 個:个
`.trim().split(/\s+/).map(pair=>pair.split(':')));

const FIELD_WEIGHTS={people:4,topics:3,time:1.5,book:1.5,text:1};
const K1=1.2,B=0.75;
const METHOD_RULES=[
  {pattern:/恐怖刑法|酷刑|刑法|刑罚|刑名|处刑方式|死法|杀法|杀人方式|杀害方式|处死方式|怎么杀|如何杀|怎样被杀|怎么被杀/,label:'个案中的杀害或处置方式',display:['杀','斩','诛','戮','赐死','鸩','毒','杖','鞭','挞','烹','焚','烧','刺','槊','铁笼','支解','剥'],terms:['杀','斩','诛','戮','赐死','鸩','毒','杖','鞭','挞','烹','焚','烧','刺','槊','铁笼','支解','剥']},
  {pattern:/斩首|砍头|斩杀|处斩/,label:'斩杀相关记载',display:['斩','诛','处死'],terms:['斩','诛','杀','死','首']},
  {pattern:/毒杀|毒死|赐毒|鸩毒|饮毒/,label:'毒杀相关记载',display:['鸩','毒','赐死'],terms:['鸩','毒','酖','饮','死','赐死']},
  {pattern:/杖杀|杖刑|杖责|鞭打|鞭杀/,label:'杖责或鞭击相关记载',display:['杖','鞭','挞'],terms:['杖','鞭','挞','击','打']},
  {pattern:/烧死|焚烧|烹杀|火刑/,label:'焚烧或烹杀相关记载',display:['烹','焚','烧','火'],terms:['烹','焚','烧','火','杀']},
  {pattern:/刺死|刺杀|槊杀/,label:'刺杀相关记载',display:['刺','槊','刃'],terms:['刺','槊','刃','杀']}
];
const CAUSE_TERMS=['权','忌','恐','畏','怒','谏','诬','谗','谋','逆','夺位','储位'];
const FILLER_PHRASES=/请问|请|帮我|告诉我|网站|网页|本站|站内|中的|里的|里面的|里面|罗列|列举|列出|盘点|汇总|清单|有哪些|都有哪些|有什么|分别|具体|一下|相关内容/g;
const FOLLOW_UP=/^(?:那|所以|这|这个|该|其|他|她|他们|她们|还有|然后)/;

function simplify(value){
  return String(value||'').normalize('NFKC').toLowerCase().replace(/[\u3400-\u9fff]/g,char=>TRADITIONAL_TO_SIMPLIFIED[char]||char);
}

function tokenize(value){
  const terms=[];
  for(const part of simplify(value).match(/[a-z0-9]+|[\u3400-\u9fff]+/g)||[]){
    if(/^[\u3400-\u9fff]+$/.test(part)){
      if(part.length===1)terms.push(part);
      for(let i=0;i<part.length-1;i++)terms.push(part.slice(i,i+2));
    }else terms.push(part);
  }
  return terms;
}

function fieldTerms(chunk,field){
  if(field==='text')return chunk.text||'';
  const value=chunk.fields?.[field]??chunk[field]??'';
  return Array.isArray(value)?value.join(' '):value;
}

function makeQueryPlan(question,context,history){
  const normalized=simplify(question);
  const compare=/比较|对比|区别|差别|异同|各自|分别|有何不同|对照/.test(normalized);
  const list=/罗列|列举|列出|有哪些|都有哪些|盘点|汇总|清单|一共|分别/.test(normalized);
  const lawCode=/法典|法条|律令|刑律|法律制度|制度条文|具体罪名/.test(normalized);
  const cause=/为什么|为何|为啥|原因|缘由|动机|目的/.test(normalized);
  const methodRule=METHOD_RULES.find(rule=>rule.pattern.test(normalized));
  const queryTerms=new Map();
  const add=(value,weight)=>{for(const term of tokenize(value))if(weight>(queryTerms.get(term)||0))queryTerms.set(term,weight);};
  for(const term of tokenize(normalized.replace(FILLER_PHRASES,' ')))add(term,1);

  if(!lawCode&&methodRule)for(const term of methodRule.terms)add(term,0.22);
  if(cause)for(const term of CAUSE_TERMS)add(term,0.18);

  const followUp=FOLLOW_UP.test(normalized)||/(?:呢|那样|这样|上述)$/.test(normalized);
  const lastUserQuestion=[...history].reverse().find(item=>item?.role==='user'&&typeof item.content==='string')?.content||'';
  let usedContext=false;
  if(followUp){
    if(context.title){add(context.title,0.55);usedContext=true;}
    if(lastUserQuestion){add(lastUserQuestion,0.35);usedContext=true;}
  }

  const intent=lawCode?'formal-law':compare?'comparison':list?'list':cause?'cause':methodRule?'method':'general';
  const scopeNote=lawCode
    ?'本站没有系统收录北齐法典或律令，不能用个案记载代替正式刑律条文。'
    :methodRule
      ?'按本站个案中记载的杀害或处置方式检索；这不是完整的刑罚清单。'
      :cause
        ?'动机词只用于找相关材料，史书记载与项目解释需分开，不能仅凭检索词认定动机。'
        :'';
  const displayTerms=lawCode?[]:methodRule?methodRule.display.slice(0,10):cause?['权力','猜忌','恐惧','进谏','谋逆']:[];
  const label=lawCode?'正式刑律/法典问题':compare?'比较问题':list?(methodRule?`列举：${methodRule.label}`:'列举问题'):cause?'原因分析问题':methodRule?.label||'按原问题检索';
  return {terms:queryTerms,intent,label,displayTerms,scopeNote,usedContext};
}

export function createBM25Retriever(records,chunks,{k1=K1,b=B}={}){
  const byId=new Map(records.map(record=>[record.id,record]));
  const prepared=chunks.map(chunk=>{
    const fields=Object.fromEntries(Object.keys(FIELD_WEIGHTS).map(field=>{
      const terms=tokenize(fieldTerms(chunk,field)),frequencies=new Map();
      for(const term of terms)frequencies.set(term,(frequencies.get(term)||0)+1);
      return [field,{frequencies,length:terms.length}];
    }));
    return {chunk,fields};
  });
  const stats={};
  for(const field of Object.keys(FIELD_WEIGHTS)){
    const df=new Map();let total=0;
    for(const document of prepared){
      const data=document.fields[field];total+=data.length;
      for(const term of data.frequencies.keys())df.set(term,(df.get(term)||0)+1);
    }
    stats[field]={df,averageLength:prepared.length?total/prepared.length:0};
  }
  function scoreDocument(document,queryTerms,contextEvent){
    let score=0;
    for(const [field,weight] of Object.entries(FIELD_WEIGHTS)){
      const data=document.fields[field],fieldStats=stats[field];
      if(!data.length||!fieldStats.averageLength)continue;
      for(const [term,queryWeight] of queryTerms){
        const tf=data.frequencies.get(term)||0,df=fieldStats.df.get(term)||0;
        if(!tf||!df)continue;
        const idf=Math.log(1+(prepared.length-df+0.5)/(df+0.5));
        const norm=tf+k1*(1-b+b*data.length/fieldStats.averageLength);
        score+=queryWeight*weight*idf*(tf*(k1+1))/norm;
      }
    }
    if(contextEvent&&document.chunk.event_ids?.includes(contextEvent))score+=2;
    return score;
  }
  return function retrieve(question,context={},history=[]){
    const queryPlan=makeQueryPlan(question,context,history);
    const queryTerms=queryPlan.terms;
    if(!queryTerms.size&&!context.event)return {events:[],chunks:[],queryOptimization:querySummary(queryPlan)};
    const ranked=prepared.map(document=>({document,score:scoreDocument(document,queryTerms,context.event)}))
      .filter(item=>item.score>0)
      .sort((a,b)=>b.score-a.score||a.document.chunk.chunk_id.localeCompare(b.document.chunk.chunk_id));
    if(!ranked.length)return {events:[],chunks:[],queryOptimization:querySummary(queryPlan)};
    const comparison=queryPlan.intent==='comparison',broad=queryPlan.intent==='list'||comparison;
    const eventLimit=queryPlan.intent==='list'?8:comparison?6:4;
    const chunkLimit=queryPlan.intent==='list'?12:comparison?10:6;
    const groupScores=new Map();
    for(const item of ranked.slice(0,broad?32:16))for(const id of item.document.chunk.event_ids||[]){
      const record=byId.get(id);if(!record)continue;
      const group=groupScores.get(id)||{record,score:0,count:0};
      group.score+=item.score/(1+group.count*0.75);group.count++;
      groupScores.set(id,group);
    }
    const events=[...groupScores.values()].sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id)).slice(0,eventLimit);
    const selected=[],selectedIds=new Set();
    for(let pass=0;pass<2;pass++)for(const event of events){
      const match=ranked.find(item=>!selectedIds.has(item.document.chunk.chunk_id)&&item.document.chunk.event_ids?.includes(event.record.id));
      if(match){selected.push(match);selectedIds.add(match.document.chunk.chunk_id);}
    }
    for(const item of ranked){
      if(selected.length>=chunkLimit)break;
      const chunk=item.document.chunk;
      if(!selectedIds.has(chunk.chunk_id)&&!(chunk.event_ids||[]).length){selected.push(item);selectedIds.add(chunk.chunk_id);}
    }
    const selectedEvents=events.filter(event=>selected.some(item=>item.document.chunk.event_ids?.includes(event.record.id))).map(event=>{
      const evidence=selected.filter(item=>item.document.chunk.event_ids?.includes(event.record.id)).slice(0,2).map(item=>{
        const chunk=item.document.chunk;
        return {chunk_id:chunk.chunk_id,text:chunk.text,book:chunk.book,juan:chunk.juan,chapter:chunk.chapter,url:chunk.url,source_urls:chunk.source_urls,verification:chunk.verification};
      });
      return {...event.record,evidence};
    });
    return {events:selectedEvents,chunks:selected.map(item=>item.document.chunk),queryOptimization:querySummary(queryPlan)};
  };
}

function querySummary(plan){
  return {intent:plan.intent,label:plan.label,expandedTerms:plan.displayTerms,scopeNote:plan.scopeNote,usedContext:plan.usedContext};
}

export {tokenize as tokenizeBM25};
