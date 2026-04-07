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

1. 沟通页展示已收口
   - 已移除 `表达对照`
   - 当前用户界面不再单独展示“机器听到的”
   - fallback 文案不再输出“现在先按当前沟通场景继续 / 我先帮你把这句话往前推进”这类铺垫

2. LiveKit 连接主链已成立
   - 沟通页现在已经可以连接助手
   - 之前的前端自断连问题已通过稳定 `disconnect` callback 修复

3. 当前慢的主要根因已经查清
   - `livekit-agent` 日志已出现：
     - `DashScope reply generation failed: The read operation timed out`
   - 说明当前慢点主要在纠错/改写调用，不是 LiveKit 连接本身

4. turn/audio 主线现状
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
   - 评估“ASR final 先上屏，再异步 correction”是否更符合当前产品体验

2. 收口沟通页消息语义
   - 用户只看最终可直接说出的句子
   - 原始 transcript 只留给系统内部 telemetry / memory，不作为主展示

3. 继续推进 5 天计划
   - `prepared expression`
   - 训练页结构化规律提取
   - 记忆页收成 `热词 / 用户发音规律 / 场景总结`
