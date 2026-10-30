import worker from './runtime/worker.mjs';

export async function handle(context){
  const headers=new Headers(context.request.headers);
  // Replace user-controlled forwarding headers with the platform's trusted IP.
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-for');
  if(typeof context.clientIp==='string'&&context.clientIp.length<=64){
    headers.set('cf-connecting-ip',context.clientIp);
  }
  const request=new Request(context.request,{headers});
  return worker.fetch(request,{
    DEEPSEEK_API_KEY:context.env?.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL:context.env?.DEEPSEEK_MODEL||'deepseek-flash'
  });
}
