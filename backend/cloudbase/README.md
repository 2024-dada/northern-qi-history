# AI答疑：腾讯云 CloudBase 迁移包

状态：代码已准备，2026-10-30已零元开通上海免费体验环境，但未部署AI或完成国内手机验收。真实控制台确认体验版执行超时固定3秒、不可修改；当前同步等待模型答复的实现需要更长时间，不能直接用于此体验版。个人版单月报价19.90元（未购买），是否升级由用户决定。不能把此包当作已上线服务。

## 架构与部署

- 使用 CloudBase **普通事件云函数**（不要选择需要监听端口的 HTTP 云函数），通过 HTTP 网关对外开放。
- Node.js 20.19 或支持 Web Request/Response/fetch 的更新运行时；入口 `index.main`，超时至少60秒。不需要安装任何依赖。
- 在项目执行 `node backend/build-cloudbase.mjs`，产物在主工作区的 `outputs/cloudbase-ai/`。压缩该目录里的文件，使 index.js 位于 ZIP 根层。
- 创建国内地域环境并上传 ZIP。在后台配置环境变量：`PUBLIC_ORIGIN` 为平台分配的 HTTPS 源站地址（只有协议和域名、不带路径），`DEEPSEEK_API_KEY` 为秘密，`DEEPSEEK_MODEL` 为 `deepseek-flash`。不要把密钥放在源码、CLI参数、部署包或GitHub。
- HTTP 网关把 `/api/chat`、`/health`、`/`、`/chat`、`/chat/` 路由到本函数，保留原始路径；允许公开HTTP调用。若控制台有“集成响应”，启用它以保留状态码、响应头和响应体。
- 保持公网出站可访问 `https://api.deepseek.com`。不要配置无公网出口的VPC。
- 默认域名只用于开发测试，可能出现提示中间页、响应附件头、限频或平台风控。正式使用按平台要求绑定自定义域名，相关费用及备案流程由账号持有人确认。

## 接回原网站前

1. `/health` 返回JSON、`configured:true`、`records:41`。
2. 从 GitHub 主站来源发送 `text/plain;charset=UTF-8` POST 到 `/api/chat`，检查JSON与精确的 `Access-Control-Allow-Origin` 响应头。不要把网关CORS设成与函数重复的多值响应头。
3. 使用国内手机关闭VPN，分别在Safari/微信实际发送问题；验证正常答案、史料链接、无中间页/阻断页。仅能打开聊天框不算通过。
4. 获得真实可用域名后，再把 `ai-help.js` 中跨站API地址换成新域名，更新两页资源版本并发布GitHub Pages。独立页仍使用同源 `/api/chat`，不需要修改。
5. 国内网络失败时暂不切换正式入口。GitHub Pages本身的国内可达性也要独立验收；若主站也不稳定，应把静态站迁到同一可达站点，而非只改AI接口。

## 保留的边界

直接复用 `backend/worker.js` 的41条材料、检索、提示词、Origin校验、输入长度限制与请求超时；没有新增模型调用渠道或聊天持久化。

按IP限流仍为每实例内存尽力限制，不能作为全局费用上限；网关不提供可信 sourceIp 时共用 anonymous 限额。不信任客户端传入的CF或转发IP头。扩大访问前应在腾讯云配置网关限流、预算告警及适合的调用鉴权。

平台文档：
- https://docs.cloudbase.net/service/access-cloud-function
- https://docs.cloudbase.net/cloud-function/how-coding
- https://docs.cloudbase.net/service/alias
