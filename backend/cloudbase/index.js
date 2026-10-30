'use strict';

// CloudBase ordinary Node.js cloud function; handler: index.main.
// Keep the existing Worker implementation and corpus as the single source.
let worker;
const reply = (statusCode, error) => ({
  statusCode,
  headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'},
  body: JSON.stringify({error}),
  isBase64Encoded: false
});

exports.main = async (event = {}) => {
  let origin;
  try {
    const configured = new URL(process.env.PUBLIC_ORIGIN);
    if (configured.protocol !== 'https:' || configured.username || configured.password ||
        configured.pathname !== '/' || configured.search || configured.hash) throw new Error();
    origin = configured.origin;
  } catch {
    return reply(503, '答疑服务尚未配置公网域名。');
  }

  try {
    const method = String(event.httpMethod || '').toUpperCase();
    const path = String(event.path || '/').split('?')[0];
    if (!['GET', 'HEAD', 'POST', 'OPTIONS'].includes(method)) return reply(405, '请求方法不支持。');
    if (!['/', '/chat', '/chat/', '/health', '/api/chat'].includes(path)) return reply(404, '接口不存在。');
    const raw = typeof event.body === 'string' ? event.body : '';
    if (Buffer.byteLength(raw) > 28000) return reply(413, '内容过长，请缩短问题。');
    const body = event.isBase64Encoded ? Buffer.from(raw, 'base64') : Buffer.from(raw);
    if (body.length > 20000) return reply(413, '内容过长，请缩短问题。');

    const incoming = new Headers(event.headers || {});
    const headers = new Headers();
    for (const name of ['origin', 'content-type']) {
      if (incoming.has(name)) headers.set(name, incoming.get(name));
    }
    // Never accept a browser-supplied CF-Connecting-IP or X-Forwarded-For.
    // Missing gateway source IP deliberately shares the conservative anonymous limit.
    const sourceIp = event.requestContext?.sourceIp || event.requestContext?.http?.sourceIp;
    if (typeof sourceIp === 'string' && sourceIp.length <= 64) headers.set('cf-connecting-ip', sourceIp);
    const init = {method, headers};
    if (!['GET', 'HEAD'].includes(method)) {
      init.body = body;
      headers.set('content-length', String(body.length));
    }
    worker ||= import('./worker.mjs');
    const service = (await worker).default;
    const result = await service.fetch(new Request(origin + path, init), {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-flash'
    });
    return {
      statusCode: result.status,
      headers: Object.fromEntries(result.headers),
      body: method === 'HEAD' ? '' : await result.text(),
      isBase64Encoded: false
    };
  } catch {
    return reply(500, '答疑服务暂时异常，请稍后重试。');
  }
};
