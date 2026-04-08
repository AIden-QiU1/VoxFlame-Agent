# VoxFlame Speech Mode 执行计划（2026-04-05，2026-04-08 收口版）

> 这份文档现在只保留 `speech mode` 现役主线。已经完成的铺垫、PWA 噪音、泛化愿景和不再阻塞当前交付的项，都从执行视角里拿掉。

## 1. 当前北极星

当前要交付的不是“复杂演讲助手”，而是一条真正能现场使用的主链：

`准备稿/练习 -> 记忆压缩 -> LiveKit preparation context -> 实时字幕辅助 -> 会后 session compaction`

现场主界面不是新页面体系，而是当前已经存在的“字幕辅助 / 全屏字幕模式”。

现场模式的核心要求只有三件事：

1. 用户开口后，系统稳定给出最终字幕，不乱发挥。
2. 长时间连续运行时，ASR / correction / agent dispatch 不要彼此拖死。
3. 训练与准备沉淀出来的热词、风险词、保底句，能被现场链路真实吃到。

## 2. 已完成并退出主执行清单的事项

下面这些已经成立，不再作为当前执行文档的主线：

1. `prepared expression` durable owner 已建立
   - backend 已有读写/总结接口
   - 记忆页已能上传/保存/手动总结准备稿
   - 训练页已能围绕准备稿做 periodic summary
2. `workspace snapshot -> LiveKit preparation context` 已打通
   - `hotwords`
   - `asr_hotword_entries`
   - `risky_terms`
   - `fallback_phrases`
   - `next_focus / rehearsal_summary`
3. `livekit_agent` 最小 correction runtime 已成立
   - ASR final / correction / TTS / interruption 基线可用
   - session userdata / preparation pack 第一版已在跑
4. PWA 已重新开启
5. 腾讯云 HTTPS 预览链路已成立

结论：当前不再继续扩写这些“已成立基础设施”，除非它们重新成为现场字幕主链的 blocker。

## 3. 现场主链的现役定义

### 3.1 前端

前端继续使用现有的 `字幕辅助 / 全屏字幕模式`，不再新建一套“演讲页”。

前端原则：

1. 前端只做最简单的字幕展示。
2. 主界面只保留：
   - 当前最终字幕
   - 最近几条滚动字幕
   - 轻量的“识别中 / 整理中”状态
3. 不把准备稿编辑、复杂提示卡、训练结构化反馈塞进现场字幕页。

### 3.2 后端 / agent

后端和 `livekit_agent` 才是当前重点，核心不是“更多 UI”，而是：

1. 最终 transcript 进入 agent 后，不能阻塞 ASR 事件接收。
2. 字幕模式下，应优先把资源留给 `ASR + correction`，不让不必要的 TTS 拖住主链。
3. 长时会话必须显式提高 session timeout，不能继续按短会话心智运行。
4. 准备上下文只作为纠错辅助，不变成现场替用户发挥的借口。

## 4. 2026-04-08 新收口

### 4.1 已补上的关键能力

1. 现有字幕辅助模式已经开始显式通知 agent
   - 前端进入/退出全屏字幕模式时，会发 `caption_mode_update`
   - agent 会切到字幕模式心智，而不是继续按代播模式工作
2. `livekit_agent` 最终 transcript 处理改成了排队调度
   - 不再在 ASR 事件回调里直接等待纠错/TTS 完成
   - 改为异步入队、单 worker 串行处理
   - 避免长句或慢 TTS 把后续 ASR 事件拖住
3. 字幕模式下 agent 会跳过 TTS
   - 现场既然看字幕，就不要再让 TTS 占住主链预算
4. 沟通页会话启动时已显式申请长会话
   - 当前前端已按 `1800s` 启动实时会话
5. 现有全屏字幕模式已经改成更适合长时使用
   - 当前字幕
   - 最近字幕
   - `识别中 / 正在整理本句...` 轻状态
6. 前端消息列表已经做了上限裁剪
   - 避免长时会话把页面状态越堆越大

### 4.2 同一天继续做的减法收口

1. 训练页已经不再展示逐句 AI 教练点评
   - 页面只保留：
     - `准备内容`
     - `拆句训练`
     - `录音`
     - `标签 / 目标句 / 系统听到 / 保存状态`
     - `每 50 句更新一次的纠错总结`
2. 记忆页已经不再展示训练进度、成长报表、最近会话等噪音
   - 页面只保留：
     - `准备内容 owner`
     - `自定义热词`
     - `训练总结 / 高频误听 / ASR 热词包`
3. 训练侧逐句 feedback runtime 已退出现役主链
   - 前端不再请求 `training_coach_request`
   - RTC capability 不再声明 `training_feedback_request`
   - `livekit_agent` 不再消费或回发逐句训练点评消息
4. prepared-expression auto summary 的 cadence 已改成 `50` 句
   - 目的不是给用户看训练报表
   - 而是定期把“热词 / 高频误听 / 重点词句”压回 correction context
5. backend 不再在没有用户准备内容时回退到默认 `speech` prepared-expression
   - 现场和训练链路都不再依赖特定演讲样例的硬编码

### 4.3 当前验证

已通过：

1. `cd frontend && npm run build`
2. `cd frontend && npm test`
3. `cd livekit_agent && python3 -m unittest discover tests -v`

## 5. 现在真正还剩什么

当前剩余工作只保留和“现场字幕稳定性”直接相关的项。

### P0

1. 真实长时 smoke
   - 连续运行 10 分钟左右
   - 观察是否出现 room / RTM / ASR websocket / worker 调度异常
2. Docker 日志核实排队调度表现
   - 看 queue size 是否持续堆积
   - 看是否仍存在 reply generation timeout 把后续 turn 压住
3. 现场字幕节奏继续打磨
   - 重点看短句是否过快闪烁
   - 重点看长句是否需要更稳的 finalize / 分段策略
4. prepared-expression -> correction context 真实 smoke
   - 看 50 句 auto summary 是否稳定回流
   - 看热词 / 高频误听是否真实影响 correction 结果

### P1

1. `turn detection / endpointing` 继续向 LiveKit 官方心智靠拢
   - 现在还是工程版 RMS + silence window
   - 需要继续减少过早 finalize 和误打断
2. session-close compaction 继续收口
   - 会后把高频误听、热词、规律继续压缩回 workspace snapshot
3. 为字幕模式补一轮真实部署 smoke
   - HTTPS
   - 麦克风权限
   - 外网网络条件下的长时保持

## 6. 明确不再作为当前主线的项

下面这些判断现在成立，但不继续占用本执行文档的注意力：

1. 不再把“重新做一套现场页面系统”当作下一步。
2. 不再把“泛化多 agent / companion runtime”当作现场主链优先级。
3. 不再把“训练页结构化反馈样式怎么更花”当作当前 blocker。
4. 不再把 PWA、部署 checklist、泛化记忆研究放在这份执行计划的主体里。

## 7. 当前验收口径

这份计划的阶段性验收不再是“功能很多”，而是这 4 条：

1. 用户打开现有字幕辅助模式，能持续看到稳定最终字幕。
2. 现场连续使用时，不会因为 correction/TTS 调度把 ASR 接收拖住。
3. 训练和准备沉淀的热词/风险词/保底句，确实能影响现场纠错结果。
4. 10 分钟级别的真实 smoke 后，Docker 日志里没有新的明显结构性阻塞。
