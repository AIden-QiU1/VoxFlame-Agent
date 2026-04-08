# 当前任务状态

> 最后更新: 2026-04-08

## 当前主线

- 主任务：把当前产品主线收成 `长时重要表达准备 -> 现场沟通辅助 -> 复盘记忆沉淀` 的 5 天闭环。
- 当前执行面：`frontend -> backend -> self-hosted livekit-server -> livekit_agent`。
- 当前最重要的体验问题：
  - 沟通页链路偏慢，主要慢在 `ASR final -> DashScope correction/reply -> TTS`
  - 当前沟通页应只显示最终可直接说出去的结果，不再展示“表达对照”
  - 登录态仍有过期 token 噪音，需要继续收口

## 最新收口

1. `speech mode` 的 prepared-expression 主链已经继续打通
   - backend 已新增 prepared-expression asset 的读写/总结接口
   - 记忆页现在已有“重要表达 owner”区：
     - 支持上传/粘贴 `.md/.txt`
     - 支持保存准备稿
     - 支持一键总结热词/规律/保底句
   - 训练页在 `prepared_expression` 模式下，达到周期门槛后会自动触发 `periodic_auto` summary
   - 当前链路已经开始形成：
     - `prepared expression -> rehearsal -> summary -> workspace snapshot -> LiveKit preparation context`

2. 训练页 / 记忆页 / 后台训练反馈链路已经按“只服务 correction”继续收口
   - 训练页已改成最小闭环：
     - `准备内容`
     - `拆句列表`
     - `录音`
     - `标签 / 目标句 / 系统听到 / 保存状态`
     - `每 50 句更新一次的纠错总结`
   - 记忆页已改成最小闭环：
     - `准备内容`
     - `自定义热词`
     - `训练总结 / 高频误听 / ASR 热词包`
   - 逐句 `training coach` 链路已退出现役主线：
     - 前端不再请求逐句大模型点评
     - RTC capability 不再声明 `training_feedback_request`
     - `livekit_agent` 不再消费 `training_coach_request`
     - `livekit_agent` 配置、测试和 README 中的旧 training extension 残留也已删除
   - `prepared expression` 自动总结节奏已改成 `50` 句

3. LiveKit correction context 已进一步收口
   - backend `rtc-orchestration` 已把 `asr_hotword_entries` 注入 `LiveKitPreparationContext`
   - `livekit_agent` 已会读取：
     - `hotwords`
     - `asr_hotword_entries`
     - `risky_terms`
     - `common_confusions`
     - `fallback_phrases`
   - `CommunicationAssistantRuntime` 现在已经改成：
     - 稳定前缀
     - 小窗口 recent history
     - 当前轮独立 prompt
     - 优先做“最小必要纠错”，减少大幅改写

4. PWA 已重新开启并补了一轮本地行为治理
   - frontend 生产 build 现在默认启用 PWA，已经重新生成 `public/sw.js`
   - 新增 `VOXFLAME_ENABLE_PWA_DEV=1`：
     - 需要时可显式允许 localhost 保留 service worker / install prompt
   - 默认 localhost 仍会清 runtime cache，避免开发时被旧 PWA 缓存污染

5. 最新验证已通过
   - `cd frontend && npm run build`
   - `cd frontend && npm test`
   - `cd backend && npm run build`
   - `python3 -m unittest discover livekit_agent/tests -v`
   - `sudo docker compose --profile https build --no-cache frontend backend livekit-agent`
   - `sudo docker compose --profile https up -d --force-recreate livekit-server backend frontend livekit-agent caddy`

6. 腾讯云公网 HTTPS 预览入口已成立
   - 当前已新增 `https` profile 下的 `Caddy` 入口
   - 当前公网 HTTPS 预览地址：`https://111.230.35.89`
   - 浏览器级访问已通过；首页可正常打开
   - 同域 `https://111.230.35.89/api/rtc/health` 已命中 backend，并按预期返回 `401 Unauthorized`
   - backend 当前已对浏览器侧返回：
     - `LIVEKIT_BROWSER_URL=wss://111.230.35.89`
     - `VOXFLAME_PUBLIC_BASE_URL=https://111.230.35.89`
   - 已新增部署清单文档：
     - [docs/TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md](/home/ubuntu/VoxFlame-Agent/docs/TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md)

7. 大陆正式上线边界已查清
   - `sslip.io` 这类未备案临时域名在腾讯云大陆机上会撞备案拦截，不适合继续作为正式路线
   - 这台机器已经成功签到 `Let's Encrypt` 的公网 IP 证书
   - 正式品牌入口仍然建议使用自有备案域名，而不是长期停留在 IP 入口

8. LiveKit 部署配置已补一层稳定性
   - 已新增 `infra/livekit/start-livekit.sh`
   - `docker-compose.yml` 现在会把 `LIVEKIT_SERVER_DEV_MODE` 传进 `livekit-server`
   - 当前公网预览配置来源于 `infra/livekit/livekit.public.yaml`

9. 沟通页展示已收口
   - 已移除 `表达对照`
   - 已从前端状态树中删除 `currentDualLine / DualLineSubtitle` 残留
   - 当前用户界面不再单独展示“机器听到的”
   - fallback 文案不再输出“现在先按当前沟通场景继续 / 我先帮你把这句话往前推进”这类铺垫

10. LiveKit 连接主链已成立
   - 沟通页现在已经可以连接助手
   - 之前的前端自断连问题已通过稳定 `disconnect` callback 修复

11. 当前慢的主要根因已经查清
   - `livekit-agent` 日志已出现：
     - `DashScope reply generation failed: The read operation timed out`
   - 说明当前慢点主要在纠错/改写调用，不是 LiveKit 连接本身
   - 当前已增加 `reply timeout` 自适应策略：
     - 短句不再傻等完整超时上限
     - 更长表达仍保留较宽容的等待窗口

12. turn/audio 主线现状
   - 已有：
     - RMS VAD
     - barge-in 门槛
     - LiveKit Python RTC APM
     - server-side audio telemetry
   - 仍待继续：
     - `room_options.audio_input`
     - 更稳的 endpointing / interruption policy
     - 会话内 `speaker differentiation`
13. 现场字幕主链已进一步收口
   - 继续复用现有 `字幕辅助 / 全屏字幕模式`
   - 沟通页启动时已显式申请 `1800s` 长会话
   - 前端进入字幕模式时会发送 `caption_mode_update`
   - `livekit_agent` 现在会：
     - 感知字幕模式
     - 字幕模式下跳过 TTS
     - 以异步入队、单 worker 串行方式处理最终 transcript
   - 全屏字幕模式现已支持：
     - 当前字幕
     - 最近字幕
     - `识别中 / 正在整理本句...`
   - 前端消息列表已加上限裁剪，减少长时会话状态膨胀
14. 公网登录跳转与新账号 smoke 已补齐
   - 未登录访问 `/contribute` / `/memory` 现在会正确跳到：
     - `https://111.230.35.89/login?next=%2Fcontribute`
     - `https://111.230.35.89/login?next=%2Fmemory`
   - 已直接注册新账号完成真实公网验证：
     - `voxflame.e2e.20260408152550@example.com`
   - 这个新账号下：
     - 训练页已是新布局
     - 记忆页已是新布局
     - 不会再自动带出默认 `speech.md` prepared-expression
15. HTTPS RTC 运行态根因已继续收口
   - 已确认并修掉两个 livekit-server 级问题：
     - `docker-compose` 直传 `LIVEKIT_TURN_TLS_PORT` 会让 `livekit-server v1.10.1` 即使在“脚本逻辑关闭 TURN/TLS”时仍报 `TURN domain required`
     - `livekit.public.yaml` 在当前腾讯云单公网 IP 预览形态下继续使用 `rtc.use_external_ip: true`，会诱发 `listen udp ...:7882: bind: address already in use`
   - 当前已落地：
     - `docker-compose.yml` 与 `infra/livekit/start-livekit.sh` 已改成 `VOXFLAME_LIVEKIT_TURN_*` 变量
     - `infra/livekit/livekit.public.yaml` 已改成显式 `rtc.node_ip: 111.230.35.89`
     - `.env` / `.env.example` 已同步切到新变量名
   - 当前 livekit-server 已稳定监听：
     - `7880/tcp`
     - `7881/tcp`
     - `7882/udp`
     - `3478/udp`
   - 浏览器公网 HTTPS smoke 已确认：
     - ICE server 现在只收到 `turn:111.230.35.89:3478?transport=udp`
     - 不再收到错误的 `turns:...:443`
     - 但连接仍停在 `checking / connecting`
   - 当前剩余 blocker 更像网络面：
     - 本机 `ufw` 未启用，`iptables INPUT ACCEPT`
     - 更像腾讯云安全组或用户上游网络还没放通 `3478/udp + 7882/udp + 7881/tcp`
16. HTTPS 公网 RTC 已补到可用态
   - 腾讯云防火墙已确认放开：
     - `80/tcp`
     - `443/tcp`
     - `7881/tcp`
     - `7882/udp`
     - `3478/udp`
   - 又定位到第二个 runtime 问题：
     - `livekit-agent` 在 `livekit-server` 不稳定时启动失败，worker 没有重新注册
   - 已执行：
     - `sudo docker compose restart livekit-agent`
   - 最新日志已确认：
     - `livekit-agent` 出现 `registered worker`
     - `livekit-server` 出现 `participant active`
     - `livekit-server` 出现 `mediaTrack published`
   - 当前判断：
     - HTTPS 公网主链已从“无法连通”推进到“可建立真实 UDP RTC + 发布音轨”
17. “录音后没有转录”这条假成功链已继续收口
   - backend 现在会在发 session token 前先探测：
     - `LIVEKIT_AGENT_HEALTH_URL`
     - 默认值：`http://livekit-agent:8081/`
   - frontend 现在会显式等待 `session_init_ack`
     - 没等到就不再显示“已连接”
     - 会直接报错，并阻止进入“空房间 + 无转录”的假成功状态
   - 当前还补了一次自动重试
     - 第一轮如果正好撞上 worker 恢复窗口，前端会自动重拉一轮会话再试一次
   - 同时把 profile/control bootstrap 消息放到了 init ack 之后
     - 避免 agent 尚未真正进房时控制消息先丢掉
   - `useRtcAgentSession` 失败路径也已清理 refs
     - 避免失败后 hook 误判“已经连着”

## 下一步

1. 做 10 分钟级别的真实长时字幕 smoke
   - 重点看 room / RTM / ASR websocket / worker 是否稳定
   - 重点看字幕模式下 queue size 是否持续堆积

2. 继续做真实 prepared-expression -> rehearsal -> correction context smoke
   - 重点确认训练满 `50` 句后的 auto summary 是否稳定回流到 workspace snapshot
   - 重点确认记忆页热词 + 训练总结是否真实影响现场 correction

3. 继续压缩字幕主链的 finalize / correction 节奏
   - 优先查清 DashScope correction timeout 是否仍会造成 backlog
   - 继续调 turn detection / endpointing，减少过早 finalize 与闪烁

4. 基于当前 HTTPS 预览入口继续做真实公网字幕 smoke
   - 重点验证浏览器麦克风权限
   - 重点验证腾讯云安全组放通 `3478/udp + 7882/udp + 7881/tcp` 后的外网 RTC 连接和长时间保持
   - 重点验证这轮 `session_init_ack gate + auto retry once` 在真实公网登录账号下是否稳定挡住“无 worker 假连接”

5. 继续把会后 compaction 收回 workspace snapshot
   - 让高频误听 / 热词 / 规律继续回流到现场纠错上下文
