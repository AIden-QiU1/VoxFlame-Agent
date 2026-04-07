# 当前任务状态

> 最后更新: 2026-04-07

## 当前主线

- 主任务：把当前产品主线收成 `长时重要表达准备 -> 现场沟通辅助 -> 复盘记忆沉淀` 的 5 天闭环。
- 当前执行面：`frontend -> backend -> self-hosted livekit-server -> livekit_agent`。
- 当前最重要的体验问题：
  - 沟通页链路偏慢，主要慢在 `ASR final -> DashScope correction/reply -> TTS`
  - 当前沟通页应只显示最终可直接说出去的结果，不再展示“表达对照”
  - 登录态仍有过期 token 噪音，需要继续收口

## 最新收口

1. 腾讯云公网 HTTPS 预览入口已成立
   - 当前已新增 `https` profile 下的 `Caddy` 入口
   - 当前公网 HTTPS 预览地址：`https://111.230.35.89`
   - 浏览器级访问已通过；首页可正常打开
   - 同域 `https://111.230.35.89/api/rtc/health` 已命中 backend，并按预期返回 `401 Unauthorized`
   - backend 当前已对浏览器侧返回：
     - `LIVEKIT_BROWSER_URL=wss://111.230.35.89`
     - `VOXFLAME_PUBLIC_BASE_URL=https://111.230.35.89`
   - 已新增部署清单文档：
     - [docs/TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md](/home/ubuntu/VoxFlame-Agent/docs/TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md)

2. 大陆正式上线边界已查清
   - `sslip.io` 这类未备案临时域名在腾讯云大陆机上会撞备案拦截，不适合继续作为正式路线
   - 这台机器已经成功签到 `Let's Encrypt` 的公网 IP 证书
   - 正式品牌入口仍然建议使用自有备案域名，而不是长期停留在 IP 入口

3. LiveKit 部署配置已补一层稳定性
   - 已新增 `infra/livekit/start-livekit.sh`
   - `docker-compose.yml` 现在会把 `LIVEKIT_SERVER_DEV_MODE` 传进 `livekit-server`
   - 当前公网预览配置来源于 `infra/livekit/livekit.public.yaml`

4. 沟通页展示已收口
   - 已移除 `表达对照`
   - 已从前端状态树中删除 `currentDualLine / DualLineSubtitle` 残留
   - 当前用户界面不再单独展示“机器听到的”
   - fallback 文案不再输出“现在先按当前沟通场景继续 / 我先帮你把这句话往前推进”这类铺垫

5. LiveKit 连接主链已成立
   - 沟通页现在已经可以连接助手
   - 之前的前端自断连问题已通过稳定 `disconnect` callback 修复

6. 当前慢的主要根因已经查清
   - `livekit-agent` 日志已出现：
     - `DashScope reply generation failed: The read operation timed out`
   - 说明当前慢点主要在纠错/改写调用，不是 LiveKit 连接本身
   - 当前已增加 `reply timeout` 自适应策略：
     - 短句不再傻等完整超时上限
     - 更长表达仍保留较宽容的等待窗口

7. turn/audio 主线现状
   - 已有：
     - RMS VAD
     - barge-in 门槛
     - LiveKit Python RTC APM
     - server-side audio telemetry
   - 仍待继续：
     - `room_options.audio_input`
     - 更稳的 endpointing / interruption policy
     - 会话内 `speaker differentiation`

## 下一步

1. 继续压缩沟通链路延迟
   - 优先查清 DashScope correction/reply timeout 的调用方式和超时配置
   - 继续评估“最终结果先出、再异步升级”是否更符合当前产品体验
   - 重点核实 TTS 慢链路是否需要单独降级或拆开

2. 基于当前 HTTPS 预览入口继续做真实公网 smoke
   - 重点验证浏览器麦克风权限
   - 重点验证外网 RTC 连接和 `wss://111.230.35.89` 行为
   - 决定是否继续保留 IP 预览入口，还是尽快切到自有备案域名

3. 收口沟通页消息语义
   - 用户只看最终可直接说出的句子
   - 原始 transcript 只留给系统内部 telemetry / memory，不作为主展示

4. 继续推进 5 天计划
   - `prepared expression`
   - 训练页结构化规律提取
   - 记忆页收成 `热词 / 用户发音规律 / 场景总结`
