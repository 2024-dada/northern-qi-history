from pathlib import Path
import json,re,hashlib,shutil,subprocess
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'website/.git').exists());DB=ROOT/'02_史料数据库'
KEYS={
'E01':['荀济','荀濟','大器'], 'E02':['德政'], 'E03':['杜弼','十年夏'], 'E04':['薛嫔','薛嬪'], 'E05':['孝瑜'], 'E06':['孝琬'], 'E07':['琅邪','仁威'], 'E08':['斛律光','明月'], 'E09':['长恭','長恭','徐之范'], 'E10':['季舒','张雕','張雕'],
'D01':['粉黛','散发','散髮','露身','妇人服','婦人服'], 'D02':['路晖礼','路暉禮'], 'D03':['西门豹','西門豹'], 'D04':['铁笼','鐵籠','地牢'], 'D05':['诸元','諸元','元氏'], 'D07':['穆嵩','尉子耀'], 'D08':['小榻','归彦','歸彥','太后不堪','举床','舉床','负太后','負太后'], 'D09':['奸我妇','奸我婦','元氏'], 'D10':['绍德','紹德','祖娥'], 'D11':['百年'], 'D13':['后遭','后丧','后喪','素锦','素錦','緋袍','绯袍'], 'D14':['士开','士開'], 'D15':['西鄙','羌兵','实弯弓','實彎弓','攻城','筑城','築城'], 'D16':['穷儿','窮兒'], 'D17':['斗鸡','鬥雞','逍遥郡君','逍遙郡君','仪同','儀同'], 'D18':['蝎','蠍'], 'D19':['杂户','雜戶','少女','姦人之女','奸人之女'], 'D21':['小怜','小憐'], 'D22':['孝卿','禅文','禪文','幼主','大丞相','高湝','任城王'], 'D23':['波斯狗','纵犬','縱犬'], 'D24':['抱儿','抱兒','儿血','兒血'], 'D25':['尉破胡','数狗','數狗','斩犬','斬犬','剥面','剝面'], 'D26':['猥萨','猥薩'], 'D27':['同日','非正嫡','文宣伯','同日生','学文宣','學文宣'], 'D28':['大车','大車'], 'D29':['奸我妇','奸我婦'], 'D30':['三拳','季舒'], 'D31':['兰京','蘭京','兰钦','蘭欽'], 'D32':['济南','濟南'], 'D34':['剥面皮','剝面皮'], 'D33':['昙献','曇獻','僧','太后']}
BOOKS={'CADAL01027542':'北齐书','LS0010':'魏书','LS0011':'北齐书','HY2035':'北齐书','SK0718':'北齐书','HY2039':'北史','LS0015':'北史','SK1259':'史纠','SBCK029':'资治通鉴','NGJ8924119990125431003':'二十一史·北齐书'}
JUAN={'1l47vy81dut6e':'卷十','LS0010_18':'卷十二','LS0011_155':'卷三十','LS0011_122':'卷二十四','LS0011_40':'卷十一','LS0011_42':'卷十一','LS0011_43':'卷十一','LS0011_53':'卷十二','LS0011_9':'卷四','LS0011_7':'卷三','LS0011_8':'卷四','LS0011_13':'卷六','LS0011_14':'卷七','1knzr0dqogf1i':'卷十二','1kp8q24mohnb3':'卷十四','1kp8q1nrqihq7':'卷八','LS0015_9':'卷七','1llq3weh5w2z7':'卷三','SBCK029_548':'卷一百七十一','1lq09on9r1hye':'卷十七','1knzr1adnzxmx':'卷三十九'}
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def norm(s):return re.sub(r'[\s\W_]','',s)
def split(text,limit=550):
 # Preserve original character order; never invent punctuation or overlap.
 parts=[];buf=''
 for sent in re.findall(r'.*?[。！？](?:[”’」』])?|.+$',text,re.S):
  if buf and len(buf)+len(sent)>limit:parts.append(buf);buf=''
  buf+=sent
 if buf:parts.append(buf)
 return parts

def main():
 raw=json.loads((DB/'03_索引/采集结果.json').read_text(encoding='utf8'));records=json.loads(subprocess.check_output(['node',str(DB/'工具/export-events.mjs')]).decode('utf8'))
 # Keep only canonical fields when rebuilding an already enriched corpus.
 records=[{k:v for k,v in r.items() if k not in ('evidence','knowledge_version','coverage')} for r in records]
 sources=[];chunks=[];bodyhash={};chunkhash={};failures=[]
 for row in raw:
  if '1kp8q24mohnb3' in row['url']:row['candidate_events']=sorted(set(row['candidate_events']+['D13','D28']))
  if 'LS0015_9' in row['url']:row['candidate_events']=sorted(set(row['candidate_events']+['D32']))
  if 'text'not in row:failures.append(row);continue
  row=dict(row);text=re.sub(r'\n?下一篇\s*$','',row['text']).strip();row['text']=text;url=row['url'];row['book']=next((v for k,v in BOOKS.items() if '/'+k+'/'in url),row.get('book','待核'));row['juan']=JUAN.get(url.rsplit('/',1)[-1],'卷次待核');row['sha256']=sha(text)
  text=re.sub(r'^帝纪第四\s+北齐书四\s+隋太子通事舍人李百药撰\s*','',text);row['text']=text;row['sha256']=sha(text)
  key=sha(norm(text))
  if key in bodyhash:
   old=bodyhash[key];old['alternate_urls'].append(url);old['candidate_events']=sorted(set(old['candidate_events']+row['candidate_events']));continue
  row['alternate_urls']=[];bodyhash[key]=row;sources.append(row)
 expected_sources={row['source_id'] for row in sources}
 for stale in (DB/'01_原文').rglob('S-*.md'):
  if re.fullmatch(r'S-[a-f0-9]{16}',stale.stem) and stale.stem not in expected_sources:stale.unlink()
 for row in sources:
  folder=DB/'01_原文'/row['book'].replace('·','_');folder.mkdir(exist_ok=True);relative=(folder/(row['source_id']+'.md')).relative_to(DB).as_posix();row['file']=relative
  meta={k:v for k,v in row.items() if k!='text'};md='---\n'+json.dumps(meta,ensure_ascii=False,indent=2)+'\n---\n\n# '+row['book']+' '+row['juan']+' '+row['chapter']+'\n\n## 原文录文\n\n'+row['text']+'\n';(DB/relative).write_text(md,encoding='utf8')
  pos=0
  for part in split(row['text']):
   if not part.strip():continue
   start=row['text'].find(part,pos);pos=start+len(part);key=sha(norm(part));cid='C-'+key[:16]
   ids=[e for e in row['candidate_events'] if any(k in part for k in KEYS.get(e,[]))]
   locator={'source_id':row['source_id'],'start':start,'end':pos,'url':row['url']}
   if key in chunkhash:
    c=chunkhash[key];c['provenance'].append(locator);c['event_ids']=sorted(set(c['event_ids']+ids));continue
   c={'chunk_id':cid,'text':part,'event_ids':ids,'provenance':[locator],'verification':'在线录文已收录；关键词候选关联，未完成逐断言核验；影印待核'};chunks.append(c);chunkhash[key]=c
 sourceby={s['source_id']:s for s in sources};coverage=[]
 for r in records:
  found=[c for c in chunks if r['id'] in c['event_ids']];r['knowledge_version']='20261112-primary-v1';r['coverage']='已找到原文候选段；尚需逐断言核验' if found else '尚未匹配原文段，保留研究线索状态'
  # Four literal evidence excerpts per event; all remaining chunks stay in the local/public database.
  evidence=[]
  for c in found[:4]:
   p=c['provenance'][0];s=sourceby[p['source_id']];evidence.append({'chunk_id':c['chunk_id'],'text':c['text'],'book':s['book'],'juan':s['juan'],'chapter':s['chapter'],'url':p['url'],'verification':c['verification']})
  r['evidence']=evidence;coverage.append({'event_id':r['id'],'name':r['name'],'candidate_chunks':[c['chunk_id'] for c in found],'status':r['coverage']})
  card='---\n'+json.dumps({'event_id':r['id'],'time':r.get('year','具体年份见项目卡；待核'),'theme':r['name'],'people':r['ruler'],'status':r['coverage']},ensure_ascii=False,indent=2)+'\n---\n\n# '+r['name']+'\n\n## 项目概述（非原典）\n\n'+r.get('context','')+'\n\n## 责任关系（项目整理）\n\n'+r.get('agency','')+'\n\n## 解释边界\n\n'+r.get('boundary','请核原典与版本。')+'\n\n## 原文候选块\n\n'+('\n'.join('- ['+c['chunk_id']+'](../02_切块/'+c['chunk_id']+'.md)' for c in found) or '尚未定位，不以AI扩写补足。')+'\n'
  (DB/'05_事件卡'/f"{r['id']}.md").write_text(card,encoding='utf8')
 expected_chunks={c['chunk_id'] for c in chunks}
 for stale in (DB/'02_切块').glob('C-*.md'):
  if stale.stem not in expected_chunks:stale.unlink()
 for c in chunks:
  people=sorted({r['ruler'] for r in records if r['id'] in c['event_ids']});topics=[r['name'] for r in records if r['id'] in c['event_ids']]
  md='---\n'+json.dumps({k:v for k,v in c.items() if k!='text'}|{'people':people,'topics':topics,'time':'按关联事件定位；原段未记时间则保持未知'},ensure_ascii=False,indent=2)+'\n---\n\n# 原文语义块\n\n'+c['text']+'\n';(DB/'02_切块'/(c['chunk_id']+'.md')).write_text(md,encoding='utf8')
 # Supersede the initial two excerpt chunks and single partial source with complete canonical text, not an extra copy.
 for pattern in ['02_切块/E02-S01-C*.md','01_原文/北齐书/S-BQS-030-GDZ-LS0011.md']:
  for old in DB.glob(pattern):old.unlink()
 manifest={'version':'20261112-primary-v1','sources':[{k:v for k,v in s.items() if k!='text'} for s in sources],'chunks':len(chunks),'events':len(records),'events_with_candidates':sum(bool(x['candidate_chunks']) for x in coverage),'failures':failures,'deduplication':'规范化正文SHA256去重页面；规范化块SHA256去重，保留全部出处。近似异文不自动删除。'}
 for name,data in [('来源清单.json',manifest),('原文切块.json',chunks),('事件覆盖.json',coverage)]: (DB/'03_索引'/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
 lines=['# 41条材料的原文覆盖核查','\n这是关键词候选覆盖，不是每条历史断言已证实。不同来源不自动等于独立证据。','\n|事件|主题|候选块数|状态|','|---|---|---|---|']
 lines +=['|'+x['event_id']+'|'+x['name']+'|'+str(len(x['candidate_chunks']))+'|'+x['status']+'|' for x in coverage]
 (DB/'04_核验与评测/41条材料覆盖表.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
 (ROOT/'website/ai-client/corpus.js').write_text('export const records='+json.dumps(records,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
 # Preserve backend SDK and protections, replace only the existing public corpus literal.
 for p in [ROOT/'ai-service/worker/index.js',ROOT/'website/backend/worker.js']:
  s=p.read_text(encoding='utf8');a=s.find('const RECORDS=');z=s.find(';\nconst CHAT_PAGE',a)
  if a<0 or z<0:raise ValueError('Cannot locate RECORDS literal in '+str(p))
  s=s[:a]+'const RECORDS='+json.dumps(records,ensure_ascii=False,separators=(',',':'))+s[z:];p.write_text(s,encoding='utf8')
 print(json.dumps({k:v for k,v in manifest.items() if k not in ['sources','failures']},ensure_ascii=False));print('failed',len(failures))
if __name__=='__main__':main()
