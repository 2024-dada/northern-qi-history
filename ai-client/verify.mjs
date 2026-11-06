import assert from 'node:assert/strict';
import {createAnswer,retrieve} from './client.js';
assert.equal(retrieve('高德政',{event:'E02'})[0].id,'E02');
let calls=0;
const answer=createAnswer({key:'test-only-not-a-real-key',fetchImpl:async(url,init)=>{
 calls++;assert.equal(String(url),'https://api.deepseek.com/chat/completions');
 assert.deepEqual([...new Headers(init.headers).keys()].sort(),['authorization','content-type']);
 assert.equal(init.credentials,'omit');
 const body=JSON.parse(init.body);assert.equal(body.model,'deepseek-flash');assert.equal(body.messages[1].content,'历史问题');
 const sent=JSON.parse(body.messages.at(-1).content);assert.equal(sent.当前页面.event,'E02');assert.equal(sent.站内检索材料[0].id,'E02');
 return Response.json({choices:[{message:{content:'模拟答案'}}]});
}});
const result=await answer({question:'高德政为何被杀',history:[{role:'user',content:'历史问题'}],context:{event:'E02',text:'当前页面'}});
assert.equal(result.answer,'模拟答案');assert.equal(result.sources[0].id,'E02');assert.equal(calls,1);
for(const status of [401,402,429,500]){
 let n=0;const fail=createAnswer({key:'test-only-not-a-real-key',fetchImpl:async()=>{n++;return Response.json({error:{message:'fixture'}},{status});}});
 await assert.rejects(()=>fail({question:'历史问题'}),status===401?/密钥无效/:status===402?/余额不足/:status===429?/频繁/:/繁忙/);assert.equal(n,1);
}
const network=createAnswer({key:'test-only-not-a-real-key',fetchImpl:async()=>{throw new TypeError('fixture');}});
await assert.rejects(()=>network({question:'历史问题'}),/无法直连DeepSeek/);
const controller=new AbortController();controller.abort();
await assert.rejects(()=>answer({question:'历史问题'},{signal:controller.signal}));
assert.equal(calls,1);
console.log('Browser SDK checks passed: corpus, context, history, CORS headers, errors, no retry, cancellation.');
