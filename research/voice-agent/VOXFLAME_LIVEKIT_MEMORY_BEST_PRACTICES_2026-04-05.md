# VoxFlame LiveKit 记忆最佳实践研究（2026-04-05）

> 目标不是把 `LiveKit` 误当成完整记忆系统，而是弄清楚它在 `session memory / room state / durable memory / semantic recall` 这几层里分别该做什么，不该做什么。

## 1. 结论先行

对 VoxFlame 来说，当前最重要的 8 个判断是：

1. `LiveKit Agents` 自带的是“会话内状态”和“会话报告”能力，不是 durable user memory owner。
2. `session.userdata` 最适合承接当前会话里的 typed working state。
3. `chat_ctx / loaded chat history` 最适合承接“本轮模型真正要看到的压缩上下文”，而不是长期画像真相层。
4. `participant attributes / metadata` 只适合低频、轻量、需要 room 内共享的状态；不适合高频 transcript 或大块记忆。
5. `text streams / RPC / data packets` 是前端与 agent 同步运行时状态的通道，不是 durable memory。
6. durable memory 仍应由 `backend + Supabase workspace snapshot` 持有，LiveKit 只负责把本轮 session 的结果稳定产出来。
7. `Qdrant` 对 VoxFlame 最适合扮演异步 semantic recall 层，而不是当前主链启动前提。
8. `Redis` 不是 LiveKit 记忆系统的默认必需品；只有当我们明确需要实时缓存、协调或限流时才引入。

一句话总结：

`LiveKit 负责 session，VoxFlame backend 负责 memory owner，Qdrant 负责增强召回。`

## 2. 官方与上游真正给出的原语

### 2.1 Session 内状态：`userdata`

上游 `livekit-agents` README 和示例明确把 `userdata` 作为会话内 typed state 使用：

- [CLEAR-VOX-MODEL research entry](../../references/clear-vox-model/modules/research/README.md)
- [references/agents/examples/voice_agents/realtime_load_chat_history.py](/home/ubuntu/VoxFlame-Agent/references/agents/examples/voice_agents/realtime_load_chat_history.py)

典型模式是：

1. 在 `@server.rtc_session()` entrypoint 创建 `AgentSession[StoryData](userdata=userdata)`
2. 在 tool 或 handoff 中写入 `context.userdata.*`
3. 后续 agent reply、tool call、handoff 都继续读这份 session-local state

这说明 LiveKit 官方心智里，`userdata` 更像：

- 当前房间这次对话的 typed scratchpad
- 本轮用户已确认过的信息
- 当前任务进度
- 当前 agent handoff 状态

而不是：

- 跨天 durable profile
- 跨设备长期画像
- 可检索的用户历史真相层

### 2.2 模型上下文：`chat_ctx / loaded history`

LiveKit 官方示例 `realtime_load_chat_history.py` 展示了一个很重要的 best practice：

- 先把已有历史整理成压缩后的 text messages
- 再写进 `llm.ChatContext`
- 然后作为 `Agent(..., chat_ctx=chat_ctx)` 的启动上下文

这说明在 LiveKit 体系里：

1. durable history 不会自动变成模型上下文
2. 你要显式决定“这一轮让模型看到哪些历史”
3. 这层更像 `context assembly`，不是 memory owner

这和 OpenClaw 的判断高度一致：

- truth source 和 runtime context assembly 要分开

### 2.3 会话结束与可压缩产物：`session report`

上游实现里，`JobContext.make_session_report()` 会把这些东西写进 `SessionReport`：

- `events=session._recorded_events`
- `chat_history=session.history.copy()`
- `model_usage=session.usage.model_usage`

见：

- [references/agents/livekit-agents/livekit/agents/job.py](/home/ubuntu/VoxFlame-Agent/references/agents/livekit-agents/livekit/agents/job.py)

这说明 LiveKit 官方已经默认把“会话报告”作为一个重要出口。  
对 VoxFlame 的含义非常直接：

1. session 内聊天与事件是可以稳定导出的
2. 这份导出物非常适合作为：
   - session review raw material
   - pattern extraction 输入
   - correction/ASR/TTS usage 诊断输入
3. 但它仍然不是最后的 durable memory 结构

也就是说：

`session report = memory compaction 的输入，不是 memory 本体。`

### 2.4 房间内共享状态：participant metadata / attributes

LiveKit 官方明确区分：

- `metadata`：任意 JSON string，适合初始化或轻量共享
- `attributes`：适合低频状态同步

官方文档还明确给了两个重要约束：

1. 总大小限制是 64 KiB
2. 不建议高于“每几秒一次”的频率更新

来源：

- https://docs.livekit.io/home/client/state/participant-attributes/

这对 VoxFlame 的直接结论是：

适合放这里的有：

- `scene`
- `session_intent`
- `execution_backend`
- 当前是否处于 `training` / `communication`
- 很短的 `agent_state`

不适合放这里的有：

- 高频 transcript
- 长文本 correction
- 完整 session review
- 用户画像大对象
- 长期热词列表全文

### 2.5 前端与 agent 的数据面：优先高层 API，不滥用低层包

LiveKit 官方数据面文档强调：

- 文本内容优先用 `text streams`
- 业务请求/响应优先考虑 `RPC`
- `data packets` 更适合低层、轻量、定制状态

来源：

- https://docs.livekit.io/home/client/data/
- https://docs.livekit.io/home/client/data/text-streams/
- https://docs.livekit.io/home/client/data/rpc/

这对 VoxFlame 的含义是：

1. `speech_activity / end_audio / interrupt` 这类轻量控制信号可以继续走 room data
2. assistant transcript、长段提示、长时滚动文本，长期更适合迁到 `text streams`
3. 需要显式请求/回复的 UI 动作，后续适合评估 `RPC`

### 2.6 LiveKit 还强调“把外部数据塞回 prompt 前先做裁剪”

LiveKit 官方 external data 文档强调：

- 可以在回复前从自己的数据库或 RAG 系统拿外部数据
- 但系统 prompt 不适合塞很长的 profile 或大文档
- 应该做结构化裁剪，只放当前任务最需要的内容

来源：

- https://docs.livekit.io/agents/build/external-data/

这和 VoxFlame 目前要做的“准备层 / 规律层 / 当前场景最小准备”完全对齐。

## 3. 对 VoxFlame 最关键的架构翻译

### 3.1 哪些东西应该属于 LiveKit session memory

应该放在 `session.userdata` 或 session-local state 的：

1. 当前 rehearsal/沟通 session 的任务状态
2. 当前段落锚点、当前目标句
3. 本轮临时累计到的误听模式
4. 本轮热词命中
5. 当前 turn / interrupt / VAD 状态
6. 当前 room participant 的临时偏好或已确认事实

它们的特点是：

- 生命周期 = 一次 session
- 强依赖当前房间
- 断线重连可以重建
- 不应该直接作为长期画像真相层

### 3.2 哪些东西应该属于 VoxFlame durable memory

应该继续由 `backend + Supabase + workspace snapshot` 承接的：

1. `profile_bundle`
2. `session_review`
3. `preparation`
4. `expression_kit`
5. `communication_preferences`
6. `training_profile_summary`
7. `hotwords / confusion patterns / stable listener guidance`

它们的特点是：

- 跨 session
- 跨页面
- 跨设备
- 需要治理、压缩、导出、回滚

### 3.3 哪些东西应该是 session->memory 的 compaction 输出

最适合在 session 结束后压缩写回 durable layer 的：

1. 本轮最稳定的 3 到 5 个热词
2. 本轮新增或再次确认的高频误听规律
3. 本轮最可靠的表达版本
4. 当前任务/场景的准备建议
5. 当前 `listener guidance`
6. 训练页得到的 `focus_syllables / articulation_tips / pronunciation_targets`

不应直接原样写回 durable memory 的：

1. 整个长 transcript 原文
2. 所有 room data 原始事件
3. 高频中间状态
4. 每次 partial transcript

## 4. `Qdrant / Redis` 在这套架构里到底该放哪

### 4.1 Qdrant：异步 recall layer，不是主记忆 owner

结合仓库现状和当前 memory 主文档：

- [Voice Agent 上下文与记忆综合](./CONTEXT_AND_MEMORY_RESEARCH_SYNTHESIS_2026-08-14.md)

Qdrant 最适合的角色是：

1. `prepared expression` 语义召回
2. 长 rehearsal 文本/片段的近义检索
3. 热词和高风险句的历史召回
4. 长时复盘时的 related examples 查询

不适合做：

1. durable user profile 真相层
2. 实时 session working memory
3. 所有启动前提

所以：

- 把 `qdrant` 放到 `extras` profile 作为当前启动策略，是合理的
- 但后续产品能力上，Qdrant 仍应被正式接回 `semantic recall layer`

### 4.2 Redis：当前不是记忆系统必需件

我查了当前仓库，`backend/src`、`frontend/src`、`livekit_agent` 现在没有运行时直接引用 `redis`。

这说明目前：

- `Redis` 不是现役记忆链的 owner
- 也不是 LiveKit memory best practice 的默认前提

如果未来引入，最合适的角色会是：

1. session 临时缓存
2. 高频事件去抖/缓冲
3. 多 worker 协调
4. 限流/队列

不适合做：

1. 用户长期画像真相层
2. 训练结果 durable owner

## 5. 对当前代码的最佳实践建议

### 5.1 现在应补的第一层：typed session state

当前 `livekit_agent/app.py` 主要在自己维护 callback/state 组织逻辑。  
下一步更符合 LiveKit 官方心智的做法是：

1. 给 `livekit_agent` 增加显式 typed `SessionUserdata`
2. 把这些字段先收进去：
   - `active_scene`
   - `active_prepared_asset_id`
   - `current_outline_index`
   - `current_hotwords`
   - `recent_confusions`
   - `listener_guidance`
   - `last_clarity_score`

这样可以避免我们把一部分 session memory 散落在 callback 和 room data glue 里。

### 5.2 现在应补的第二层：session start context assembly

在 entrypoint 启动前，不该把整个 `workspace snapshot` 直接塞给模型。  
更稳的做法是：

1. backend 继续拥有 durable truth
2. 在 session start 时组装一个最小 `PreparationContextPack`
3. 只把这些内容注入 `chat_ctx / instructions`
   - 当前场景
   - 这次最重要的 3 到 5 句
   - 3 到 10 个热词
   - 高频误听规律
   - 当前 listener guidance

这符合 LiveKit external-data 的官方建议，也符合你现在 5 天目标。

### 5.3 现在应补的第三层：session close compaction

我们应该把 `session report` 思路真正长到 VoxFlame：

1. session 内积累：
   - transcript
   - correction
   - training feedback
   - hotword hits
   - confusion hits
2. session 结束时做一次 compaction
3. 再写回：
   - `training_result`
   - `training_profile_summary`
   - `workspace preparation`
   - `session_review`

这一步会比“每个 turn 都往长期记忆写很多东西”更稳。

### 5.4 前端数据面应长期升级

当前 VoxFlame 还在较多使用自定义 room data。  
短期可接受，但长期更符合 LiveKit 最佳实践的方向是：

1. `speech_activity / end_audio / interrupt` 保持低层轻量消息
2. assistant transcript / 长时滚动文本逐步迁到 `text streams`
3. 明确 request/response 型 UI 动作用 `RPC` 评估替代

这会让我们的运行时协议更接近 LiveKit 官方生态，而不是自己维持一套越来越重的 room data 私有协议。

## 6. 对 5 天目标最有帮助的最小落地

如果只考虑“5 天后让产品更有机会帮你完成高压、长时、结构化表达”，最值钱的并不是立刻引入完整 Qdrant/Redis。

最值钱的是：

1. `prepared-expression context pack`
   - 当前重要表达
   - 风险词
   - 热词
   - listener guidance
   - 保底句
2. `session-local pattern accumulator`
   - 本轮误听规律
   - 本轮容易卡住的位置
   - 本轮稳定表达版本
3. `session-close compaction`
   - 把上面两层稳定写回 `workspace snapshot`

只有当这三层稳定后，Qdrant 的收益才会明显放大。

## 7. 最终架构判断

对 VoxFlame 当前阶段，最健康的记忆结构应该是：

1. `LiveKit`
   - RTC / room / participant / data
   - session-local typed state
   - session report raw material
2. `backend + Supabase`
   - durable workspace owner
   - profile / preparation / review / expression kit
3. `Qdrant`
   - optional semantic recall layer
   - 仅在需要召回长历史、热词、风险句、prepared expression 近义样本时触发
4. `Redis`
   - 如果未来需要，就做 ephemeral coordination/cache
   - 不做 durable memory owner

这套分工最符合：

- LiveKit 官方心智
- OpenClaw 的 truth/context 分离
- 你对“记忆要记规律/特点，而不是堆流水”的要求
- VoxFlame 当前 5 天目标

## 8. 直接可执行的下一步

1. 在 `livekit_agent` 新增 typed `session.userdata`
2. 在 session start 前做 `PreparationContextPack` 组装
3. 在 session close 时做 `pattern extraction + compaction`
4. 再把 `Qdrant` 接回 backend 的 `semantic recall layer`
5. 不把 `Redis` 先硬塞进记忆主链

## 参考

### 官方文档

- LiveKit Agents: https://docs.livekit.io/agents/
- Passing state / session data: https://docs.livekit.io/agents/build/state/
- External data: https://docs.livekit.io/agents/build/external-data/
- Participant attributes & metadata: https://docs.livekit.io/home/client/state/participant-attributes/
- Data overview: https://docs.livekit.io/home/client/data/
- Text streams: https://docs.livekit.io/home/client/data/text-streams/
- RPC: https://docs.livekit.io/home/client/data/rpc/
- Turn detection: https://docs.livekit.io/agents/build/turns/

### 上游实现与示例

- [CLEAR-VOX-MODEL research entry](../../references/clear-vox-model/modules/research/README.md)
- [references/agents/examples/voice_agents/realtime_load_chat_history.py](/home/ubuntu/VoxFlame-Agent/references/agents/examples/voice_agents/realtime_load_chat_history.py)
- [references/agents/livekit-agents/livekit/agents/job.py](/home/ubuntu/VoxFlame-Agent/references/agents/livekit-agents/livekit/agents/job.py)

### 仓库现有记忆参考

- [Voice Agent 上下文与记忆综合](./CONTEXT_AND_MEMORY_RESEARCH_SYNTHESIS_2026-08-14.md)
