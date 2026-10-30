# AI答疑服务

`worker.js` 是已部署服务的无密钥源码快照，包含41条站内材料的检索数据。它是服务端Cloudflare Worker代码，不能在浏览器中运行。

- 服务地址：https://northern-qi-ai-help.bright-guppy-8139.chatgpt.site
- 问答端点：`POST /api/chat`；健康检查：`GET /health`
- 独立答疑页：`GET /chat`，使用同源API；主站请求使用`text/plain;charset=UTF-8`承载JSON以避免跨域预检，后端继续兼容旧JSON请求并验证Origin。手机跨域连接失败时提供独立入口，问题/事件编号通过URL片段保留，不进入HTTP请求URL；该入口不能解决服务域名本身无法访问的问题。
- 服务端环境变量：`DEEPSEEK_API_KEY`（秘密）、`DEEPSEEK_MODEL`（当前deepseek-flash）。所有密钥只在托管后台设置。
- 接口限制问题长度、上下文长度、历史轮数、输出token和调用超时；提供按IP/实例内存计数的尽力限流。此限流不构成账户级费用硬上限，生产访问量增加后需持久化限额或用户鉴权。
- 服务不保存聊天记录，前端只在本次页面内存中保留最近三轮。站内资料及模型解释不等于已完成原典影印核验，尚未启用实时联网搜索。

部署源工作区在主项目旁的`ai-service/`，通过Sites保存版本、部署；不要把任何生产密钥复制到这个目录。史料更新后，在该工作区运行`node scripts/sync-corpus.mjs`重新生成检索快照，再同步此文件并部署服务。
