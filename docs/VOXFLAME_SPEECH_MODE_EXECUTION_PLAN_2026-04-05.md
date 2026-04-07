# VoxFlame 长时表达模式执行计划（2026-04-05）

> 目标不是把产品做成“演讲 App”，而是在未来 5 天内把现有 VoxFlame 收成一套能真实帮助构音障碍用户完成高压、长时、结构化表达的产品闭环。现场 10 分钟演讲只是当前最严格的验证场景。

> 文档边界：
> - 这份文档只回答“这 5 天先做什么、为什么这样排、如何验收”
> - 产品整体定义、页面职责和长期架构判断，以 [VOXFLAME_PRODUCT_PRD_2026-03-24.md](VOXFLAME_PRODUCT_PRD_2026-03-24.md) 为准

## 1. 北极星目标

### 5 天内必须达成

1. 用户可以围绕一篇固定演讲稿连续练习，让产品逐步学会：
   - 这篇稿子的结构
   - 用户自己的表达习惯
   - 最容易被听错的句子和词
2. 用户在现场演讲时，产品可以实时显示“它听到了什么”和“它建议如何表达”，且用户能立即打断、纠正、接管。
3. 现场模式支持长音频连续运行，至少覆盖一次约 10 分钟演讲，而不是只支持零散短句。
4. 记忆页不只是训练复盘，而是变成“用户全面画像页 + 场景准备页 + 复盘页”。

### 这 5 天不要赌的事情

1. 不要把成败押在“4/5 天内微调模型会显著变强”上。
2. 不要试图重做记忆架构。
3. 不要再发散做通用能力、全新页面系统或大规模底层重构。

结论：这 5 天的主线应是 `长时重要表达体验 + 现有 LiveKit / Memory 架构上的最小扩展`，而不是继续抽象框架。

### 一个必须更新的判断

在今天这种 vibe coding 时代，`5 天做出一套真正够用的记忆系统和产品收口` 并不算离谱。

真正困难的不是写代码速度，而是 3 个更本质的问题：

1. 我们是否真的理解模型该做什么，不该做什么
   - 实时链路要稳、快、可打断
   - 总结链路要强、准、结构化
   - 不能把所有任务都塞给一个“最强模型”
2. 我们是否真的理解 agent 的角色
   - agent 不是替用户即兴发挥
   - agent 是把用户准备过的规律、热词、保底句、补救策略，在现场稳定调出来
3. 我们是否真的理解记忆的本质
   - 记忆不是保存更多流水
   - 记忆是压缩出：
     - 这个人最常见的规律
     - 这个人最容易被听错的点
     - 这个人在哪些场景最需要准备
     - 这个人当前最该先带走的表达

结论：这 5 天如果失败，更可能是因为分析和取舍不准，而不是因为“来不及写出来”。

## 2. 对 speech.md 的产品判断

[speech.md](../speech.md) 不是产品最终形态本身，而是当前最严格的验证样本。它是一份高风险、高情绪负担、结构化强、时长长的公开表达任务。它暴露出的真实产品需求不是“更强的翻译”，而是 4 个更具体的问题：

1. `信任问题`
   - 用户最怕 AI 说出自己没想说的话。
   - 所以产品必须让“AI 听到了什么”可见、可核对、可打断。
2. `长程稳定性问题`
   - 10 分钟演讲不是短句问答。
   - 产品必须支持长时间连续显示、段落切换、重点句保护和低认知负担的 UI。
3. `习惯压缩问题`
   - 练习不是为了留下很多数据，而是为了把它收成少量可靠习惯：
     - 开场怎么说
     - 卡住时怎么补
     - 哪些句子最容易出错
     - 哪些句子需要提前准备
4. `现场控制权问题`
   - AI 只能做外骨骼，不能抢叙事权。
   - 用户必须能实时判断系统是否听对、是否该接着说、是否需要切换到预置句或提示卡。

## 3. 产品命名边界

这份计划里的 `speech` 或“演讲”只是内部验证语境，不应直接变成前端主文案。

对外更合适的产品语义应该是：

1. `长时表达`
2. `重要表达`
3. `结构化表达`
4. `提前准备`
5. `现场辅助`

结论：

1. 前端不应围绕“演讲”一词组织全部信息架构。
2. 真正该做的是让产品支持：
   - 用户准备一段重要表达
   - 用户持续练习
   - 用户在现场实时确认“系统听对了吗”
   - 用户在需要时立刻拿回控制权
3. 演讲只是我们验证“这套能力是否真的够强”的测试场景。

### 一个新增的前端/数据原则

1. 一切从产品和用户出发，而不是从“字段是否齐全”出发。
2. 前端展示优先来源于：
   - 真实 corpus
   - 结构化 feedback
   - workspace snapshot
   - 可解释的规则推导
3. 不保留没有意义的空字段、空占位和宽泛关键词。
4. `keywords` 只在高置信、对准备/检索/记忆真正有帮助时才写入，而且数量要少、语义要准。
5. 训练页和记忆页不再围绕拼音、声母、韵母、声调做产品主语义；后续统一收口到三类真正面向用户的语义：
   - 热词
   - 用户发音规律
   - 场景总结

## 4. 现有代码能接住什么

结合当前代码现状，VoxFlame 已经有足够好的宿主，不需要另起一套系统：

1. `LiveKit communication / training runtime` 已经跑通：
   - communication：ASR / correction / TTS / interrupt / turn-taking 基本可用
   - training：`training_feedback_request -> training_feedback` 已开始进入现有 memory 链
2. `workspace snapshot` 已经是现役 durable owner：
   - `profile_bundle`
   - `session_review`
   - `expression_kit`
3. 记忆页已经有“准备页”的雏形：
   - 最近亮点
   - 下一步
   - 个体化表达建议
   - 当前最值得先记住的事
4. 训练页已经能持续积累：
   - 上传样本
   - 训练反馈
   - `training_profile_summary`

所以当前最优策略不是重做 memory，而是：

`继续沿 workspace snapshot / training_result / training_profile_summary 语义，加一层 speech-specific derived experience`

### 当前 LiveKit 真相

到今天为止，`LiveKit` 在仓库里的真实位置已经很清楚：

1. 它已经是现役 execution plane
   - `frontend -> backend -> self-hosted livekit-server -> livekit_agent`
2. 它不再是迁移试验
   - 沟通页主链、训练页最小反馈链都已经接上
3. 它也还没有“万事大吉”
   - 当前缺口不在 transport，而在：
     - `session.userdata`
     - `PreparationContextPack`
     - `session-close compaction`
     - 训练页 / 记忆页 AI parity

结论：下一步不是继续围绕 LiveKit 迁移写计划，而是直接在现有 LiveKit 执行面上把训练页、记忆页和现场准备能力补完整。

### 当前 agent 能力盘点

#### 已经成立

1. `ASR`
   - 已接入 DashScope realtime ASR
   - 能产出 interim / final transcript
2. `TTS`
   - 已接入 DashScope realtime TTS
   - 已能在 LiveKit 房间发布 assistant audio track
3. `interruption`
   - 用户重新开口时，当前 TTS 可以被打断
4. `turn detection`
   - 已有基于 RMS 的 server-side VAD
   - 已能产出 `speech_started / speech_stopped`
5. `training feedback`
   - `training_feedback_request -> training_feedback` 已跑通

#### 还不够

1. `turn detection` 还只是第一版
   - 现在主要是 `RMS + silence window + 工程默认打断门槛`
   - 当前 `QWEN_ASR_BARGE_IN_MIN_SPEECH_MS=220` 只是工程默认起始值，不是 LiveKit 官方推荐定值
   - 还没有接上 LiveKit 官方更完整的 `turn_detection / min_interruption_duration / endpointing` 心智
2. `speaker differentiation`
   - 还没有会话内说话人区分
   - 更没有持久化 voiceprint
3. `typed session memory`
   - `session.userdata` 第一片已经落地
   - `PreparationContextPack` 第二片也已经落地：backend 现已把 `workspace snapshot.preparation` 注入 session metadata / dispatch metadata
4. `session-close compaction`
   - 第一片已经落地：
     - session end 时会生成 `session_compaction`
     - 当前会把 `fallback phrases / risky terms / pronunciation patterns / support strategies / hotwords / interruption telemetry`
       压成结构化语义记忆
     - 现有 `memory growth -> workspace snapshot` 已开始消费这层 compact memory
   - 这轮又往前收了一层：
     - 记忆页和训练画像不再继续扩成“重点音节 / 易混声母 / 易混韵母 / 声调提醒”这类栏目
     - 现役产品语义开始统一收口到：`热词 / 用户发音规律 / 场景总结`
   - 还没做完的，是让这层 compaction 继续长出更强的 pattern extraction 与 recall policy
5. `构音障碍语音处理`
   - 当前主要依赖浏览器 WebRTC 的 `echoCancellation / noiseSuppression / autoGainControl`
   - 输入电平提示第一片已经落地：沟通页和训练页都会给出实时收音质量反馈
   - LiveKit Python RTC `AudioProcessingModule` 第一片已经接上：
     - 当前会在 agent 订阅到的房间麦克风帧上先做官方 APM 处理
     - 第一版采用保守配置：
       - `noise_suppression=true`
       - `high_pass_filter=true`
       - `echo_cancellation=false`
       - `auto_gain_control=false`
     - 这一步的边界很清楚：
       - 现在处理的是远端订阅音频，不是本地全双工采集
       - 对构音障碍用户也先避免过激增益和误伤发音特征
   - 还没有收口到 LiveKit 官方 `room_options.audio_input` 那层更完整的 noise cancellation / audio input 管理
   - server-side audio telemetry 第一片也已经接上：
     - agent 现在会发 `normalized_level / peak_level / clipping_detected / apm_enabled`
     - 这让我们后续能更可靠地区分“发音问题”和“收音问题”
   - 也还没有“保守型降噪 + 会话内 speaker differentiation”的成体系策略

### 关于降噪 / interruption / 音纹的当前判断

1. `降噪`
   - 需要，但要保守
   - 不能为了“更干净”把用户本来的发音特征一起抹掉
   - 现阶段不做激进语音重建，优先做 `浏览器基础处理 + LiveKit audio_input/APM + 输入电平提示`
2. `音量控制`
   - 输入电平可视化第一片已经落地
   - 现在系统会在沟通页和训练页提示：
     - 声音偏小
     - 收音稳定
     - 声音过冲
   - 后续还要继续补：
     - 麦克风距离建议与更细的 telemetry
     - `room_options.audio_input` 接入后的更完整 server-side 策略
3. `interruption`
   - 当前已经有基本能力
   - 下一步要补的是官方推荐的 policy，不是只会“检测到 speech_started 就停 TTS”
   - 目标是逐步从“自定义 RMS VAD + 默认阈值”收口到 `turn detector + interruption policy + manual/hybrid turn control`
4. `音纹 / speaker differentiation`
   - 多人沟通里确实有价值
   - 但短期应该先做“会话内说话人区分”，而不是直接上长期 voiceprint 库

### 一个需要补准的 LiveKit 判断

当前不该再把 `LiveKit` 和“记忆系统本体”混成一件事。

更准确的分工应该是：

1. `LiveKit`
   - RTC / room / participant / data plane
   - session-local typed state
   - session report raw material
2. `backend + workspace snapshot`
   - durable user memory owner
3. `Qdrant`
   - 后续 semantic recall 增强层
4. `Redis`
   - 只有在真的需要 ephemeral coordination 时再引入

详见：

- [VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md](VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md)

## 5. 外部参考真正值得借的长处

### A. OpenClaw 的长处：记忆不是“堆更多内容”，而是“明确事实源 + 可控上下文装配”

参考：

- [/home/ubuntu/openclaw/docs/concepts/memory.md](/home/ubuntu/openclaw/docs/concepts/memory.md)
- [/home/ubuntu/openclaw/docs/concepts/context-engine.md](/home/ubuntu/openclaw/docs/concepts/context-engine.md)
- [/home/ubuntu/openclaw/docs/reference/memory-config.md](/home/ubuntu/openclaw/docs/reference/memory-config.md)

它最值得借的不是 Markdown 这种具体落盘形式，而是 3 个思想：

1. `memory source of truth` 必须和 `runtime context assembly` 分开
   - memory 负责保存 durable facts
   - context engine 负责决定这轮模型真正该看到什么
2. 记忆要支持自动压缩
   - OpenClaw 在 compaction 前会做一次 silent memory flush
   - 这很适合借到 VoxFlame：在训练或沟通会话结束时，自动把本轮规律压成结构化摘要
3. 检索不是单一向量
   - 它同时强调 hybrid search、temporal decay、citation
   - 对 VoxFlame 的启发是：记忆系统要同时记“长期规律”和“最近高压任务”

对 VoxFlame 的直接帮助：

1. 记忆页应继续以 `workspace snapshot` 为唯一 durable owner
2. 但需要加一层“pattern extraction / context assembly”
3. agent 与 LLM correction 不该直接吃原始训练流水，而应吃压缩后的：
   - 发音规律
   - 常见误听点
   - 热词
   - 当前任务场景
   - 当前最该优先的表达策略

### B. VibeVoice 的长处：长音频不是简单滚动转写，而是“全局上下文 + 结构化输出 + 热词”

参考：

- [/home/ubuntu/VibeVoice/docs/vibevoice-asr.md](/home/ubuntu/VibeVoice/docs/vibevoice-asr.md)
- [/home/ubuntu/VibeVoice/docs/vibevoice-realtime-0.5b.md](/home/ubuntu/VibeVoice/docs/vibevoice-realtime-0.5b.md)

它最值得借的有 4 点：

1. `长时单遍处理` 的目标意识很清楚
   - VibeVoice-ASR 明确把 60 分钟单次输入作为能力目标
   - 它强调不能因为切小块而丢掉全局语义和说话人连续性
2. `结构化 transcript`
   - 它不是只出文本，而是强调 `Who / When / What`
   - 这对 VoxFlame 的启发是：长时表达模式不该只显示一长串字，而要有段落、时间、重点句结构
3. `hotwords` 是第一等公民
   - 它明确支持 customized hotwords
   - 这非常契合 VoxFlame 的“人名、机构名、产品名、专有词必须保真”
4. `实时与长时分两条优化目标`
   - VibeVoice-Realtime 更像实时 TTS / streaming 方案
   - 长时 ASR 更像回放复盘和长上下文总结方案

对 VoxFlame 的直接帮助：

1. 不要把“现场实时显示”和“训练后长时复盘”混成同一个处理器
2. 更好的做法是两级：
   - `Level 1`: 现场低延迟 LiveKit + DashScope realtime loop
   - `Level 2`: 训练后或演练后做长时 transcript review，提取段落规律、热词、风险句
3. 当前 5 天内，不建议直接把 VibeVoice 作为现役主运行时替换
   - 它的长处更适合做“离线/准离线复盘能力设计参考”
   - 尤其 `qwen3.5/3.6 + DashScope + LiveKit` 已经是我们现役链，切换底座风险太高

### C. Lime 的长处：前端设计不是炫技，而是让用户在高压场景里看得懂、用得住

参考：

- [/home/ubuntu/lime/AGENTS.md](/home/ubuntu/lime/AGENTS.md)
- [/home/ubuntu/lime/docs/aiprompts/design-language.md](/home/ubuntu/lime/docs/aiprompts/design-language.md)

它最值得借的不是具体视觉风格，而是判断标准：

1. 中文排版优先
2. 信息优先，装饰只服务层级
3. 工作台按页面类型决定宽度，不做整仓统一窄列
4. 背景要轻，卡片要稳
5. 主表面避免半透明和磨砂

对 VoxFlame 的直接帮助：

1. 训练页和记忆页都不该越做越花
2. 长时表达场景尤其要稳：
   - 大字
   - 稳定分区
   - 少量高价值操作
   - 不要让背景抢注意力
3. 记忆页应该是“准备工作台”，不是信息堆栈

### D. CLEAR-VOX-MODEL 的长处：记住规律比记住所有样本更重要

参考：

- [/home/ubuntu/CLEAR-VOX-MODEL/research/experiments/exp004_llm_rerank.md](/home/ubuntu/CLEAR-VOX-MODEL/research/experiments/exp004_llm_rerank.md)
- [/home/ubuntu/CLEAR-VOX-MODEL/research/insights/key_findings.md](/home/ubuntu/CLEAR-VOX-MODEL/research/insights/key_findings.md)
- [/home/ubuntu/CLEAR-VOX-MODEL/README.md](/home/ubuntu/CLEAR-VOX-MODEL/README.md)

它最值得借的 4 个结论：

1. 个体差异是核心挑战
   - 对构音障碍来说，用户之间差异极大
   - 所以 VoxFlame 的 memory 重点必须是“个人规律”
2. 个性化数据价值远高于盲目扩量
   - `1 小时个性化数据 > 10 小时混合数据`
   - 对这 5 天意味着：你的 rehearsal 数据非常值钱
3. LLM 后处理是现实可用的增益点
   - 它明确提出 `N-best + LLM rerank`
   - 虽然现在这条实验还是计划中，但方向对：LLM correction 不应只看 top-1 文本
4. 中文构音障碍的重点不只是音素，还有声调和语义通顺
   - 所以后处理和记忆都必须记录“规律”，不只是字面错字

对 VoxFlame 的直接帮助：

1. 训练页和记忆页要重点沉淀：
   - 高频误听模式
   - 稳定热词
   - 经 correction 后最可靠的表达版本
2. correction 的最终目标不是“最像标准普通话”，而是“在这个人的习惯里最可信、最通顺、最不越权”

### E. LiveKit 官方 best practices 的长处：session memory、room state、durable memory 三层分工很清楚

详见：

- [VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md](VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md)

它对这 5 天目标最有帮助的地方在于：

1. `userdata` 很适合承接一次 rehearsal / live session 的 typed working state
2. `chat_ctx` 适合装“当前任务最小必要准备”，不适合装整个长期画像
3. `participant attributes / metadata` 只适合低频共享状态，不适合高频 transcript
4. `session report` 很适合拿来做 session-close compaction
5. 这让我们可以把“实时稳定”和“长期记忆压缩”分开，不用继续把所有问题硬塞给一个 runtime loop

### F. LiveKit 官方最值得直接借的技巧：不是换 provider，而是把 session / audio / turn primitives 用完整

我们当前继续用 `DashScope / Qwen-first` 完全没问题，但要尽量把 LiveKit 官方已经做好的 voice agent 原语借全。

最值得直接落地的 5 件事：

1. `AgentSession turn handling`
   - 官方明确把 `turn_detection / interruptions / min_interruption_duration / endpointing` 当成一等配置，而不是让每个项目都靠裸 VAD 自己拼。
2. `manual / hybrid turn control`
   - 官方给了 `start_turn / end_turn / cancel_turn` 的 RPC 范式。
   - 这非常适合构音障碍场景下的“按住说 / 明确结束 / 说错就取消”心智。
3. `room_options.audio_input`
   - 官方建议把 noise cancellation 放在 `session.start(... room_options=...)` 层，而不是只依赖浏览器采集约束。
4. `session.userdata`
   - 官方把它视为 typed per-session state。
   - 这正适合我们承接本轮 reheasal/live 的当前段落、热词命中、最近误听模式、当前场景。
5. `participant attributes`
   - 官方建议它承接低频共享状态，而不是高频 transcript。
   - 这很适合我们后面做当前模式、语言偏好、会话角色之类的轻状态同步。

结论：

下一步不是“换掉 DashScope”，而是 `在继续使用 DashScope API 的前提下，把 LiveKit 官方推荐的 turn / audio / state primitives 接完整`。

## 6. 对 VoxFlame 的具体产品决策

### A. 所有页面都应该继续变得更直白、更简单

这是当前阶段的产品硬要求：

1. 用户不是来理解系统架构的
2. 用户也不应该在高压场景里学习复杂交互
3. 所有页面都应该满足：
   - 第一眼就知道现在能做什么
   - 第二眼就知道下一步点哪里
   - 出错时知道系统听到了什么、哪里错了

对 3 个主页面的直接要求：

1. `沟通页`
   - 最简单
   - 最少按钮
   - 只保留现场必须的信息和动作
2. `训练页`
   - 也要简单，但允许比沟通页多一点结构
   - 因为它承担 rehearsal 和规律提取
3. `记忆页`
   - 不能做成信息垃圾场
   - 它的复杂度应该来自“更完整的准备”，而不是更复杂的控件

### B. “准备”应该以记忆页为 owner，以沟通页为入口

CEO / 产品设计角度，最好的分工不是二选一，而是：

1. `记忆页` 做准备内容的 owner
   - 负责完整的：
     - 用户画像
     - 常见场景
     - 当前最重要场景
     - 热词
     - 发音规律
     - 最稳表达
     - 保底句
2. `沟通页` 只显示当前场景下最小必要准备
   - 例如：
     - 这次先记住哪三句
     - 哪个词最容易被听错
     - 没听清时怎么补
   - 这些内容应该来自记忆页的 owner 数据，而不是沟通页自己再长一套状态

结论：

`准备内容应该沉在记忆页，沟通页只拉起当前场景所需的最小准备。`

### C. 不管是 5 天后的演讲，还是以后上课/讨论问题，都应该用同一套产品心智

不要为“演讲”“上课”“讨论问题”各做一套页面。

更好的产品抽象是：

1. `我要准备一段重要表达`
2. `我要现场把它说出来`
3. `我说完后要把规律留下来`

对应页面角色：

1. `训练页`
   - 帮用户把重要表达练成习惯
2. `沟通页`
   - 帮用户在现场安全地说出来
3. `记忆页`
   - 帮用户把这件事沉淀成长期可复用准备

### D. 不要把赌注压在“现场 agent 自由发挥”上

从 CEO 角度，这是当前阶段最重要的风险判断之一。

现场 agent 的价值当然重要，但不能让产品策略变成：

`平时不准备 -> 现场全靠模型聪明发挥`

因为高压表达场景下，真正昂贵的是：

1. 听错
2. 乱说
3. 说得太慢
4. 用户不敢继续说

所以更好的产品策略是：

1. 平时通过训练页和记忆页把“规律、热词、保底句、关键表达”准备好
2. 现场 agent 再在这个基础上发挥
3. 现场发挥的边界必须清楚：
   - 优先保真
   - 优先用户原意
   - 不擅自扩写
   - 不越权替用户做观点表达

一句话：

`最好的现场 agent，不是最会即兴创作的 agent，而是最会在准备好的边界里稳定帮助用户表达的 agent。`

### A. 记忆最重要的是记规律/特点，不是记流水

这条已经是当前产品的硬原则：

1. 不要把记忆页做成训练日志墙
2. 要把训练和沟通的原始流水压成：
   - `发音特点`
   - `常见误听规律`
   - `热词`
   - `常见场景`
   - `当前重要场景`
   - `最可靠表达`

### B. correction 要分两层

1. `实时 correction`
   - 服务现场
   - 低延迟
   - 可打断
2. `复盘 correction`
   - 服务训练后总结
   - 允许更重的 LLM 推理
   - 用来提炼规律、热词、候选表达

### C. 长音频也要分两层

1. `现场模式`
   - 低延迟滚动显示
   - 当前段落锚点
   - 用户随时确认系统是否听对
2. `长时复盘模式`
   - 对一整段 5 到 10 分钟表达重新切段、总结、提热词、提风险句
   - 借鉴 VibeVoice 的“长时单遍 / structured transcript / hotword”目标意识

### D. 结构化输出必须正式化

官方参考：

- [Alibaba Cloud Model Studio: Structured output](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output)

这对 VoxFlame 的直接意义是：

1. LLM correction 输出不能再是松散文本
2. training summary / memory extraction 也不该再靠脆弱字符串解析
3. 应该逐步切到固定 schema，例如：
   - `recognized_text`
   - `corrected_text`
   - `confidence_band`
   - `hotwords`
   - `pronunciation_patterns`
   - `scene`
   - `next_step`

## 7. 核心产品问题拆解

### A. 现场前

目标：把一段重要表达练成“可现场使用的习惯包”。

必须解决：

1. 长稿切片
   - 不是把全文一次扔给用户练。
   - 要切成段落、关键句、风险词、救场句。
2. 个体化误听点
   - 记录哪些句子最容易被 ASR 听错
   - 记录哪些句子经过 correction 后最稳定
3. 习惯压缩
   - 每次练习结束，不产出长报告，而产出：
     - 今天最该记住的 3 件事
     - 明天上台前只看哪几句
     - 哪几个词要慢一点 / 重一点 / 分段说

### B. 现场中

目标：让用户在 10 分钟级别的长时表达里敢持续说，而不是盯着 UI 慌。

必须解决：

1. 实时显示什么
   - `我刚刚说的原文`
   - `系统理解后的表达`
   - `当前段落锚点`
2. 什么不能太复杂
   - 不能让用户一边演讲一边看太多按钮
   - 不能让 UI 像调试台
3. 什么时候必须给控制权
   - 听错时立刻标出来
   - 支持一键回到用户原话
   - 支持切到预设“保底句”

### C. 记忆页真正应该承担什么

目标：让记忆页服务 agent、LLM correction 和用户自己的准备，而不是退化成训练记录列表。

必须解决：

1. `用户全面画像`
   - 当前表达习惯
   - 当前最容易被误听的点
   - 当前最稳的表达方式
   - 当前希望别人如何配合
2. `常见场景`
   - 用户最常遇到哪些沟通场景
   - 每个场景下已经沉淀了哪些可直接复用的话
3. `马上要面对的场景`
   - 接下来要面对的是面试、就医、课堂发言、公开分享还是陌生场景表达
   - 系统要能把“这次最该准备什么”顶上来
4. `给 agent/LLM correction 用的结构化上下文`
   - 让 correction 不只看当前一句话
   - 还知道当前用户是谁、习惯怎样、场景是什么、接下来在做什么

结论：

`记忆页的本体是“用户和场景的准备页”，训练结果只是其中一个输入源。`

### D. 现场后

目标：让这次重要表达变成下一次更稳的记忆输入。

必须解决：

1. 自动生成 session review
   - 哪一段最稳
   - 哪一段最容易卡
   - 哪几个词需要长期练
2. 更新 expression kit
   - 哪些表达已经稳定可复用
3. 更新 profile bundle
   - 当前沟通背景
   - 当前最值得优先记住的策略

## 8. 这 5 天真正该依赖什么

### 关键依赖

1. `LiveKit self-hosted RTC`
   - 承接长时音频、房间数据和实时控制事件
   - 本地开发验证继续统一走 `http://localhost:3000`
2. `DashScope / Qwen-first`
   - 当前最现实的 ASR / rewrite / TTS provider
3. `workspace memory`
   - 继续做 durable profile / review / expression owner

### 不应作为关键路径的依赖

1. 新一轮微调模型马上显著提升
2. 大规模新数据集在 3 天内训练完成
3. 全新 memory architecture

### 微调和数据的正确位置

数据录入、标注准确、后续微调当然要继续优化，但在这 5 天里的定位应该是：

1. `长期增益`
   - 未来几周持续降低误识别率
2. `非短期关键路径`
   - 不能作为本次重要表达成功的主要保障

换句话说：

`短期靠产品控制权 + 记忆压缩 + 长时表达专项流程兜底，长期再靠数据和微调抬上限。`

## 8. 4/6 新增吸收的工程判断

基于 2026-04-06 的外部工程观察，这 5 天内最值得直接吸收的，不是再换一套“流行全栈”，而是把当前主线补成更稳的 contract 与上下文纪律。

### A. 先补 shared contract，不急着换 backend / mobile 框架

当前仓库最该优先共用的不是某个框架，而是跨页面、跨 runtime、跨未来 surface 的数据语言。

这 5 天内最值得先抽出来的 shared contract：

1. `session metadata`
2. `dispatch metadata`
3. `training_feedback`
4. `session_compaction`
5. `workspace snapshot.preparation`
6. `important-expression / prepared-expression` 视图

结论：

1. 先把这些对象做稳，比“现在切 Nest / GraphQL / Prisma / RN 全家桶”更重要
2. 当前 backend 继续以现有 `Express + TypeScript` 为主，不为框架迁移打断专项主线
3. future mobile / PWA / desktop companion 都应该优先复用这套 contract，而不是各长一套会话启动协议

### B. 这 5 天应补一层 `context assembly`

当前 durable memory owner 已经明确是 `backend + workspace snapshot`，但 speech 模式还需要一层更明确的 runtime context assembly。

这层的职责不是保存更多内容，而是为这次重要表达挑出“当前模型真正该看什么”。

speech mode 里，优先装配的应是：

1. 当前段落 / 当前表达目标
2. 当前场景的 3 到 5 条关键准备
3. 风险词 / 热词 / 专有名词
4. 最近最相关的误听规律
5. 保底句 / 卡住时补救句

不应直接灌入：

1. 原始 transcript 全量流水
2. 全量训练历史
3. 整份长期画像原文

结论：

1. `workspace snapshot` 继续做 durable owner
2. `context assembly` 做当前 session 的最小准备装配
3. correction / rewrite / live assist 默认吃装配后的最小上下文，而不是直接吃原始记忆流水

### C. 这 5 天就可以补的离线压缩节奏

当前已经有 `session-close compaction` 第一片，所以这 5 天可以进一步把“白天流水、结束后压缩”的节奏写成专项要求。

最值得优先沉淀的不是整段 transcript，而是：

1. 高频误听模式
2. 稳定热词
3. 当前重要表达的可靠说法
4. 容易卡住的段落
5. 打断 / 接管时机

结论：

1. 现场实时链路负责稳和可打断
2. session close / review 链路负责重一点的 pattern extraction
3. 记忆页展示压缩结果，不展示原始流水墙



这次专项里明确要做：

1. 让 `prepared expression -> context assembly -> live assist -> session compaction` 真正闭环
2. 让记忆页和 correction 开始正式吃“规律 + 热词 + 风险句”
3. 让未来 mobile / desktop companion 所需的 contract 先在 web 主链里稳定下来

## 9. 需要查和持续对齐的核心参考

### LiveKit 官方

1. 自部署与生产部署
   - https://docs.livekit.io/transport/self-hosting/deployment/
   - 关键点：
     - 生产环境需要域名、TLS、TURN
     - 推荐配置文件
     - Docker 环境建议 host networking
2. Rooms / Participants / Tracks
   - https://docs.livekit.io/intro/basics/rooms-participants-tracks/
   - 关键点：
     - room 是实时会话容器
     - participant 可以是用户、agent、服务
     - track 是音频/视频/数据流
3. Data packets
   - https://docs.livekit.io/transport/data/packets/
   - 关键点：
     - 适合发送低延迟控制事件
     - 当前可继续承接 `speech_activity / correction / training_feedback / speech control`
4. Agent sessions / userdata
   - https://docs.livekit.io/agents/logic/sessions
   - https://docs.livekit.io/agents/logic/agents-handoffs
   - 关键点：
     - `userdata` 是官方支持的 typed per-session state
     - 适合承接当前段落、当前场景、最近误听模式、热词命中等 session-local state
5. Turns / interruptions
   - https://docs.livekit.io/agents/logic/turns/
   - https://livekit.io/field-guides/guide/vad-turn-detection-configuration
   - 关键点：
     - 官方推荐把 `turn detection + interruptions + endpointing` 作为一组能力看待
     - `min_interruption_duration` 这类门槛是官方工程心智的一部分
     - manual turn control (`start_turn / end_turn / cancel_turn`) 是正式支持范式
6. Audio input / noise cancellation
   - https://docs.livekit.io/agents/start/voice-ai
   - https://docs.livekit.io/reference/python/livekit/rtc/apm.html
   - 关键点：
     - `room_options.audio_input` 可以配置 noise cancellation
     - Python RTC 还有 APM 能力：echo cancellation / noise suppression / high-pass filter / gain control
     - 对构音障碍用户要保守使用，优先减少误伤而不是追求“最干净”

### DashScope / Model Studio 官方

1. OpenAI-compatible 模型兼容表
   - https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope
   - 关键点：
     - 当前 OpenAI-compatible 可用模型明确列出 `qwen3.5-flash / qwen3.5-plus`
     - 当前公开文档里尚未看到 `qwen3.6` 出现在这条兼容表中
2. 支持模型与能力总表
   - https://www.alibabacloud.com/help/en/model-studio/models
   - 关键点：
     - `fun-asr-realtime` 当前仍是主实时 ASR 入口
     - `qwen3-tts-flash-realtime / qwen3-tts-instruct-flash-realtime` 已是现役实时 TTS 入口

### 仓库内权威文档

1. [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md)
2. [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
3. [LiveKit Agent README](../livekit_agent/README.md)
4. [文档导航](README.md)

## 10. 5 天综合执行计划

### 在 Day 计划之前先固定一条技术原则

`LiveKit 官方原语尽量接完整，DashScope provider 继续按需使用。`

也就是：

1. `turn / interruption`
   - 尽量向官方 `turn_detection + interruption policy + manual control` 收口
2. `audio input`
   - 尽量把 noise cancellation / APM 放进官方 `room_options.audio_input` 思路
3. `session state`
   - 尽量把会话内 typed state 放进 `session.userdata`
4. `shared lightweight state`
   - 尽量把低频共享状态放进 `participant attributes`
5. `provider`
   - ASR / TTS / rewrite 继续用 DashScope，只要它们挂在这套更完整的 session/turn/audio 结构里就行

### 官方最佳实践落地顺序

这部分优先级高于继续拍脑袋调阈值。

1. `Phase A: session.userdata + PreparationContextPack`
   - 在 `livekit_agent` 里正式引入 typed session state
   - session start 前组装最小准备包
   - 让 correction / training feedback / scene prep 都读这层，而不是继续靠零散回调 glue
   - 当前状态：`session.userdata + backend preparation injection` 已完成
2. `Phase B: turn handling 收口到官方心智`
   - 保留当前 RMS VAD 作为短期 fallback
   - 但主目标切到：
     - 更成熟的 turn detector
     - `min_interruption_duration / endpointing` 组合
     - 必要时引入 `manual / hybrid turn control`
3. `Phase C: audio input / APM`
   - 在继续保留浏览器采集约束的同时
   - 研究并接入 LiveKit 官方 `room_options.audio_input` 或 Python RTC APM 路线
   - 输入电平提示第一片已完成
   - LiveKit Python RTC `AudioProcessingModule` 第一片已完成
   - server-side audio telemetry 第一片已完成
   - 下一步重点转到：
     - `room_options.audio_input`
     - 更细的 audio telemetry
     - 会话内 speaker differentiation 前的保守音频策略
4. `Phase D: participant attributes + session-close compaction`
   - 把低频共享状态和 session-local compaction 分开
   - 让 session 结束时自动把规律压入 `workspace snapshot`
   - 当前状态：`session-close compaction` 第一片已完成，下一步重点转到 `participant attributes + 更强 compaction`

### Day 1：把重要表达材料变成“可练、可记、可确认”的资产

目标：让产品开始围绕一段重要表达形成专属记忆。

开发重点：

0. 先完成 `Phase A`
   - `session.userdata`
   - `PreparationContextPack`
   - 最小 session-local typed state
1. 新增 `prepared expression` 轻量数据层
   - 不重做 memory owner
   - 作为 `workspace snapshot` 上的派生视图或轻量扩展
   - 最少包括：
     - `speech_title`
     - `speech_sections`
     - `high_risk_phrases`
     - `fallback_phrases`
     - `last_rehearsed_at`
2. 以 [speech.md](../speech.md) 作为第一份验证样本导入
   - 切成段落 / 关键句 / 风险词
3. 训练页新增“结构化长表达练习”模式
   - 不是通用句库
   - 是按一段完整表达的结构逐段练
4. 每次练习结束，沉淀 3 类信息
   - 听错最多的句子
   - 最稳的表达版本
   - 明天上台前只该再看一次的内容

验收：

1. 用户可以在训练页按结构段落练
2. 记忆页能出现一个“本次重要表达准备”区域
3. 每次练习后这个区域会更新

### Day 2：把训练页做成“结构化长表达练习”

目标：让练习不再是散句，而是围绕完整表达沉淀“规律/热词/风险句”。

开发重点：

1. 训练结果正式提取：
   - 高频误听句
   - 高频热词
   - 关键发音特点
   - 最稳表达版本
2. 引入结构化输出
   - correction 结果、训练总结、pattern extraction 改成稳定 schema
3. 训练完成后直接更新：
   - `training_result`
   - `training_profile_summary`
   - `workspace snapshot` 的 speech/important-expression 视图
4. 开始做 `Phase B`
   - 把当前 interruption 从“工程默认阈值”往官方 turn handling 收口
   - 评估 manual / hybrid turn control 是否更适合构音障碍 rehearsal

### Day 3：把现场模式做成能支撑长时表达的实时界面

目标：支持 10 分钟级长时表达过程中的实时显示和控制。

开发重点：

1. 沟通页新增“长时重要表达模式”
   - 更大字幕
   - 更少按钮
   - 更清楚地分三层：
     - 我刚刚说的
     - 系统理解的
     - 当前段落提示
2. 做“听对了吗”确认机制
   - 当 ASR / correction 明显不稳时，快速提示
   - 用户可立即纠正
3. 做长时 transcript 策略
   - 不能无限堆整页文本
   - 用 rolling window + 当前段落锚点 + 可展开历史
4. 做现场保底机制
   - 一键切到保底短句
   - 一键显示下一段关键句
5. 完成 `Phase C`
   - 输入电平提示
   - 收音质量提示
   - 保守型 noise cancellation / APM 接入验证

验收：

1. 一次 10 分钟级表达中，页面不会被长文本拖垮
2. 用户能看清系统听到的内容
3. 用户能在听错时快速纠正或切保底句

### Day 4：把 rehearsal -> live -> review 串成闭环

目标：让系统不只是“帮一次”，而是形成习惯与可复用经验。

开发重点：

1. 记忆页变成真正的“用户画像 + 下次准备页”
   - 当前状态
   - 当前常见场景
   - 接下来要面对的场景
   - 这次最稳的三句
   - 最危险的三句
   - 下一步
2. session review 重点改成任务导向
   - 不是泛化“最近一次训练”
   - 而是“用户最近在准备什么、现在最该注意什么”
3. expression kit 服务于当前场景
   - 开场白
   - 卡壳修复句
   - 过渡句
   - 求助句
4. 开始做 `Phase D`
   - participant attributes 只承接低频共享状态
   - session-close compaction 把本轮规律压回 durable memory

验收：

1. 长时表达结束后，记忆页自动长出可复用的准备材料
2. 用户第二次进入时，不需要从零开始
3. rehearsal 和 live mode 能互相喂数据

### Day 5：做最后一轮“用户画像 + 当前场景准备”收口

目标：让记忆页和 correction 真正吃到“规律”，不是只吃最近一次 transcript。

开发重点：

1. 记忆页顶部固定成 4 块：
   - 我是谁
   - 我常见的场景
   - 我现在最重要的场景
   - 我当前最该记住的规律/热词
2. correction prompt/context 正式吃：
   - hotwords
   - common confusions
   - scene
   - communication preferences
3. 做一次完整 rehearsal + live smoke
   - 看训练页是否能收规律
   - 看记忆页是否能表达规律
   - 看沟通页是否能实时纠正
4. 复核 LiveKit 官方 best practices 对齐度
   - turn handling 是否仍大量依赖自定义 heuristics
   - audio input 是否仍只依赖浏览器约束
   - userdata / attributes / compaction 是否真正落地

## 11. 下一步具体开发顺序

按优先级排序：

1. `prepared expression asset ingestion`
   - 先把 [speech.md](../speech.md) 作为第一份验证样本结构化进产品
2. `structured rehearsal mode`
   - 训练页按结构段落练习
3. `memory page as profile + scene prep owner`
   - 把“用户是谁 / 常见场景 / 当前任务 / 推荐准备”顶上来
4. `pattern extraction + structured output`
   - 把训练结果压成规律/热词/风险句
5. `long-form live assist mode`
   - 沟通页长时字幕 + 锚点 + 保底句
6. `review mode`
   - 记忆页把结果收成下次准备页
7. `human-interaction hardening`
   - interruption / barge-in policy
   - 输入电平提示
   - 会话内 speaker differentiation
8. 再继续做数据录入和微调优化
9. 所有 `interruption / audio / session state` 相关实现，优先继续向 LiveKit 官方 primitives 对齐，而不是继续累加只属于 VoxFlame 的 ad-hoc 参数

## 12. 不该做的事

1. 不要现在重做 memory architecture
2. 不要为了“模型可能更强”而拖延产品控制机制
3. 不要把“演讲”误写成产品唯一主场景
4. 不要把 UI 做成调试面板

## 13. 本轮建议的第一刀

最值得立刻开始的开发切片：

1. 新增 `prepared expression` 结构化资产
2. 为训练页加 `pattern extraction` 和结构化输出
3. 记忆页顶部新增“当前重要表达准备”模块，并突出热词/规律而不是复盘流水

原因：

1. 这刀不需要改大架构
2. 这刀能立刻把 rehearsal、memory、correction 串起来
3. 这刀最能在 5 天内给“重要现场表达成功率”带来确定性提升
