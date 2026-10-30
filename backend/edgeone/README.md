# EdgeOne Makers 免费迁移

状态：已准备代码；未部署、未接入生产网站、未完成关闭VPN的国内手机问答验收。保留原有史料、检索、提示词、对话格式、来源链接和Origin校验。

## 部署

1. 用原腾讯云中国站账号进入 https://console.cloud.tencent.com/edgeone/pages 。只使用免费版，不购买CloudBase升级。
2. 从Git导入2024-dada/northern-qi-history，项目根目录选`backend/edgeone`；框架Other，构建`node build.mjs`，输出`public`。需要账号持有人按平台要求完成GitHub仓库授权。
3. 构建从相邻`../worker.js`复制当前41条材料及独立聊天界面到`runtime/worker.mjs`；部署包同时编译`cloud-functions/`为Node服务端函数。不要把CloudBase ZIP上传到这里，也不要把未构建源码当静态产物上传。
4. Cloud Functions最大时长在edgeone.json设60秒，内部模型请求45秒；使用Cloud Functions，不能误用CloudBase免费3秒函数。代码无第三方依赖。
5. 在平台环境变量设置秘密`DEEPSEEK_API_KEY`及普通值`DEEPSEEK_MODEL=deepseek-flash`。不将密钥写入代码、构建日志、GitHub或前端。没有新密钥配置时健康检查configured=false，问答返回503。
6. 加速区域/域名以控制台实际权限为准。中国大陆节点自定义域名按平台要求完成备案；没有域名时先用官方预览入口验收。

## 免费边界与验收

- 官方当前免费Cloud Functions额度：100万次/月，50万GB-s/月，最大时长默认30秒可设至120秒；应再以实际控制台为准。
- 中国站官方部署文档的预览链接仅3小时有效。不要把带临时访问令牌的地址直接硬编码成长期GitHub API地址；不要用定时刷新临时令牌代替正式入口。
- 先核对账号是否提供可持续使用的免费域名。若只提供限时预览，需要解决长期域名入口后才能把GitHub的AI接口切换。用户不接受增加托管费用，不能擅自购买域名、套餐或启用超额付费。
- `/health`应返回configured=true、records=41；GitHub Origin的POST应成功、其他Origin被拒；`/chat`使用同源API。
- 必须用国内手机关闭VPN实际发送问题，成功返回答案和材料链接，才算解决用户的问题。仅部署成功或桌面能打开不算。
- 模型请求仍由DeepSeek账户按其规则计费；免费托管不代表免费模型。限流仍是每实例内存尽力限制，并非全局费用硬上限。

官方资料：
- https://pages.edgeone.ai/zh/document/node-functions
- https://pages.edgeone.ai/zh/document/edgeone-json
- https://pages.edgeone.ai/zh/document/limits-and-quotas
- https://edgeone.ai/zh/document/160427672908292096
