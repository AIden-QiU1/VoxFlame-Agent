# Founder Collaboration Loop（2026-03-25）

> 这份文档定义 `VoxFlame` 当前的人机协作方式：怎么继续开发、怎么同步架构判断、怎么把研究沉淀成你能快速掌握的材料。

## 1. 目标

这套协作不是为了“让 agent 多做一点”，而是为了让我们两个人都更快进入同一个判断。

要同时做到：

1. 功能继续稳定推进
2. 关键技术路线你能越来越看懂
3. 产品判断不只停留在聊天里
4. 经验可以累积、自动同步、持续清理

## 2. 默认协作节奏

### 2.1 开发主线

1. 先基于代码现状和一手用户事实判断下一刀
2. 先做最小可运行切片
3. 做完就验证
4. 再把结论同步到 `PRD / current / summary`

### 2.2 技术学习主线

当我完成一轮较深的技术研究后，默认不只给你“结论”，还要补一份简短的阅读入口。

默认格式：

1. 一本最值得读的经典书或系统资料
2. 两到三篇最关键的官方文档
3. 一个最值得跟读的开源仓库
4. 一段“为什么现在读它”说明

目标不是让你一次读完，而是让你把握当前架构演进的主干。

### 2.3 产品讨论主线

当产品判断出现分叉时，默认按这 4 个问题一起讨论：

1. 它解决的是哪个真实瞬间？
2. 它会不会增加用户的社交压力？
3. 它会不会破坏当前主链路？
4. 它是否值得占用当前阶段的前 20% 资源？

## 3. 我负责的输出

### 3.1 研究后给你的“短阅读”

后续涉及以下主题时，我默认补技术阅读推荐：

1. realtime / RTC / transport
2. control plane / backend contract
3. memory / agent / tools
4. dataset / recorder / training feedback
5. frontend workspace / interaction architecture

### 3.2 研发过程中的“短结论”

每完成一轮关键探索，我默认给你：

1. 一个短结论
2. 为什么这么判断
3. 还剩什么风险
4. 你现在最值得补看的 1 到 3 个材料

## 4. 你负责的输入

你不需要把问题整理得很“标准”。

最有价值的是这几类输入：

1. 你最近一次真实沟通失败或成功的场景
2. 你觉得某个页面“别扭”的直觉反馈
3. 你对一个功能的优先级判断
4. 你最近看到的好产品、好硬件、好交互

如果你给的是原始材料，我负责把它翻成：

`场景任务 -> 产品约束 -> 技术切片 -> 文档更新`

## 5. 当前推荐的技术阅读组织方式

后续我会按这 4 条主线给你推荐材料：

### A. 产品与页面

- 你需要知道页面为什么这样分：`首页 -> 沟通工作台 -> 练习工作台 -> 沟通档案`
- 重点是任务入口、认知负担、可信度和用户主导权

### B. 控制面与后端

- 你需要知道为什么长期 contract 要逐步收口到 backend
- 重点是 `session / profile bundle / session review / expression kit`

### C. 执行面与 realtime

- 你需要知道为什么现役执行面已经收口成 `Frontend -> Backend -> self-hosted LiveKit -> livekit_agent`
- 重点是：
  - 前端负责产品交互、会话前准备和用户可见控制
  - backend 负责 durable contract、workspace owner 和数据边界
  - LiveKit 负责 realtime transport
  - `livekit_agent` 负责 session-local intelligence，而不是长期 owner

### D. 记忆与 agent

- 你需要知道为什么 `memory != dataset`
- 重点是 `frontend local fallback / backend durable workspace / livekit_agent working memory`

## 5.1 当前更推荐的学习顺序

如果你要真正把这套架构看懂，建议按这个顺序读和学：

1. 先看产品主链路
   - 为什么页面是 `首页 -> 沟通工作台 -> 训练工作台 -> 沟通档案`
   - 先知道每个页面各自解决什么真实瞬间
2. 再看 backend contract
   - 为什么 `workspace` 是 durable owner
   - 为什么 `dataset != memory`
   - 为什么很多“产品真相”最后都要收进 backend snapshot
3. 再看 realtime 执行面
   - 为什么前端不能直接承担长期记忆
   - 为什么 LiveKit 适合承载 transport / room / data channel
   - 为什么 `assistant_runtime.py` 是 session / context / correction 的运行时核心
4. 最后再看模型与 compaction
   - 哪些模型负责低时延纠错
   - 哪些模型负责总结 / 计划 / 压缩
   - 为什么 durable write 必须晚于 realtime correctness

## 6. 文档沉淀规则

为了减少信息散落，默认按下面沉淀：

1. 长期产品判断进 `PRD`
2. 最近任务进 `.tasks/current.md`
3. 最近必须知道的状态进 `.claude-summary.md`
4. 专门方法论进 `docs/`

如果我给你的技术阅读建议会持续复用，就继续写进这类专门文档，而不是只留在聊天里。

## 7. 当前约定

从这份文档开始，后续当我做较深的技术研究或产品研究时，会默认补一个新的小节：

1. `本轮最值得读`
2. `为什么现在读`
3. `读完后你应该掌握什么`

这样你可以逐步建立对 `VoxFlame` 架构演进的全局把握，而不是每次都从零进入上下文。
