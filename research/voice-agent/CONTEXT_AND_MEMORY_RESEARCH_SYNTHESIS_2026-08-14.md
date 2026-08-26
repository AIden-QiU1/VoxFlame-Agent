# Voice Agent 上下文与记忆研究综合（2026-08-14）

本文合并原 `FASTER_WHISPER_MEMORY_AND_CONTEXT_ESSENCE_2026-04-14.md` 与 `EVER_OS_MEMORY_AND_CONTEXT_ESSENCE_2026-04-14.md` 的可执行结论，并与当前 VoxFlame LiveKit / workspace 边界对齐。原文件由 Git 历史保留，不再作为平级入口。

## 一句话结论

上下文能力的关键不是无限积累，而是**有界输入、可熔断延续、显式作用域、受控检索和严格写入**。LiveKit/session 负责会话态，backend workspace 负责 durable memory；二者不能互相冒充。

## ASR 上下文

- 长音频先切窗再识别；不能把全量音频和历史文本无限送入模型。
- 跨窗口延续只携带受限的 previous tokens / prompt，并设置长度、时间和置信度门槛。
- 当温度、置信度、重复或异常段触发风险时应重置 prompt，避免错误在后续窗口滚雪球。
- hotwords 是小规模、可解释、可撤回的词汇偏置，不是把整份用户档案塞进 prompt。
- word timestamps、异常段检测和去重是上下文压缩的前置条件。

## Memory 与检索

- 写入和检索接口分离；“能搜到”不代表“允许长期写入”。
- 元数据是一等能力，至少表达 user/session/source/type/time/consent 等作用域。
- 轻量确定性检索与语义检索可以并存，但必须共享同一 durable owner 和权限边界。
- 可替换的是 context assembly / retrieval strategy，不是再创建平级 memory store。
- 临时会话、隐私模式和 TTL 数据必须能排除或清理。
- user/group/session scope 必须显式隔离，不能靠 prompt 猜归属。

## 当前 VoxFlame 映射

```text
LiveKit room / participant / chat context
  = session-local state

backend workspace snapshot / profile / prepared expressions
  = durable owner

Qdrant（按需）
  = semantic recall layer，不是新 owner

Redis（按需）
  = ephemeral coordination/cache，不是 durable memory
```

应用层继续遵守：

- 会话结束后只有明确 schema、来源和用途的数据才能写入 workspace。
- 用户纠正、hotword、发音规律和准备材料分别保留类型，不压成一段不可审计 summary。
- context assembly 失败时降级到最小 profile，不得阻断核心沟通。
- memory/上下文优化必须同时验证沟通成功率、延迟、错误传播和跨用户隔离。

## 不采用

- 不直接把第三方 memory 系统作为插件接入生产用户数据。
- 不建立第二套 durable memory 服务。
- 不把完整历史、诊断信息或 secrets 注入运行时 prompt。
- 不把单次训练反馈自动升级为长期用户事实。

## 回流状态

本综合对应 [RF-005](../APPLICATION_FEEDBACK_REGISTRY.md)：`adopt`。它确认并强化现役边界，不授权新增 runtime 主链。

