import worker from './runtime/worker.mjs';

export async function handle(context){
  const headers=new Headers(context.request.headers);
  // Replace user-controlled forwarding headers with the platform's trusted IP.
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-for');
  if(typeof context.clientIp==='string'&&context.clientIp.length<=64){
    headers.set('cf-connecting-ip',context.clientIp);
  }
  // A gateway may pass an internal HTTP URL to the Node handler. Use an
  // operator-configured HTTPS origin, never a client forwarding header.
  let request=context.request;
  if(context.env?.PUBLIC_ORIGIN){
    let publicOrigin;
    try{
      publicOrigin=new URL(context.env.PUBLIC_ORIGIN);
      if(publicOrigin.protocol!=='https:'||publicOrigin.username||publicOrigin.password||
        publicOrigin.pathname!=='/'||publicOrigin.search||publicOrigin.hash)throw new Error();
    }catch{
      return Response.json({error:'答疑服务公网域名配置有误。'},{status:503});
    }
    const incoming=new URL(context.request.url);
    request=new Request(publicOrigin.origin+incoming.pathname+incoming.search,context.request);
  }
  request=new Request(request,{headers});
  return worker.fetch(request,{
    DEEPSEEK_API_KEY:context.env?.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL:context.env?.DEEPSEEK_MODEL||'deepseek-flash'
  });
}
