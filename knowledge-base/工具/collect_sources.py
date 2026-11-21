from pathlib import Path
from html.parser import HTMLParser
import urllib.request,json,re,hashlib,concurrent.futures,time
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'website/.git').exists());DB=ROOT/'02_史料数据库'
class Reader(HTMLParser):
 def __init__(self):super().__init__();self.level=0;self.target=False;self.parts=[];self.title='';self.heading=False;self.skip=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='article' and 'chapter-reader' in a.get('class',''):self.target=True;self.level=1;return
  if not self.target:return
  if tag=='article':self.level+=1
  if tag in ('script','style'):self.skip+=1
  if tag=='h3':self.heading=True
  if tag in ('p','h3','br'):self.parts.append('\n')
 def handle_endtag(self,tag):
  if not self.target:return
  if tag=='h3':self.heading=False
  if tag in ('script','style'):self.skip=max(0,self.skip-1)
  if tag in ('p','h3'):self.parts.append('\n')
  if tag=='article':
   self.level-=1
   if self.level==0:self.target=False
 def handle_data(self,s):
  if self.target and not self.skip:
   if self.heading:self.title+=s
   else:self.parts.append(s)
def get_records():
 s=(ROOT/'website/ai-client/corpus.js').read_text(encoding='utf8');return json.loads(s.split('=',1)[1].strip().rstrip(';'))
def norm(s):return re.sub(r'\s+','',s)
def main():
 records=get_records();urls={}
 for r in records:
  for _,u in r['source'].get('links',[]):
   if 'shidianguji.com' in u and '/chapter/' in u:urls.setdefault(u,[]).append(r['id'])
 extra={
 'https://www.shidianguji.com/book/LS0015/chapter/LS0015_9':['E04','D01','D02','D03','D04','D05','D07','D08'],
 'https://www.shidianguji.com/book/LS0011/chapter/LS0011_7':['D28','D30','D31'],
 'https://www.shidianguji.com/book/LS0011/chapter/LS0011_13':['D32'],
 'https://www.shidianguji.com/book/LS0011/chapter/LS0011_14':['E06','D13','D14'],
 'https://www.shidianguji.com/book/NGJ8924119990125431003/chapter/1lq09on9r1hye':['E08'],
 'https://www.shidianguji.com/book/LS0011/chapter/LS0011_8':['D31'],
 'https://www.shidianguji.com/book/LS0010/chapter/LS0010_18':['E01','D30'],
 'https://www.shidianguji.com/book/CADAL01027542/chapter/1l47vy81dut6e':['D04'],
 }
 for u,ids in extra.items():urls.setdefault(u,[]).extend(ids)
 cache=DB/'03_索引/采集缓存';cache.mkdir(exist_ok=True)
 def fetch(pair):
  u,ids=pair;key=hashlib.sha256(u.encode()).hexdigest()[:16];p=cache/(key+'.json')
  if p.exists():return json.loads(p.read_text(encoding='utf8'))
  try:
   req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (historical-course-source-archive)'})
   html=urllib.request.urlopen(req,timeout=50).read().decode('utf8');a=Reader();a.feed(html);body=re.sub(r'\n[ \t]*\n+','\n\n',''.join(a.parts)).strip()
   if len(body)<100:raise ValueError('正文不足100字或未找到公开article正文')
   title=re.search(r'<title>(.*?)</title>',html,re.S);book='北齐书' if '北齐书' in (title[1] if title else '') else ('北史' if '北史' in (title[1] if title else '') else ('资治通鉴' if '资治通鉴' in (title[1] if title else '') else '史纠' if '史纠' in (title[1] if title else '') else '待核书名'))
   row={'url':u,'source_id':'S-'+key,'book':book,'chapter':a.title.strip(),'text':body,'candidate_events':sorted(set(ids)),'sha256':hashlib.sha256(body.encode()).hexdigest(),'collected_at':'2026-11-12','status':'公开网页录文收录；影印与版本待核'};p.write_text(json.dumps(row,ensure_ascii=False),encoding='utf8');print('OK',key,len(body),flush=True);return row
  except Exception as e:return {'url':u,'candidate_events':ids,'error':str(e)}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(fetch,urls.items()))
 (DB/'03_索引/采集结果.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8');print('RESULT',sum('text'in x for x in results),'/',len(results),flush=True)
if __name__=='__main__':main()
