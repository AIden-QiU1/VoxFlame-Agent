# EverOS 记忆与上下文管理精髓（2026-04-14）

> 说明：用户提到的 `ever-os` 在开源仓库中对应 `EverOS / EverMemOS`。本文基于本地源码与文档提炼“可迁移到 VoxFlame 的最小内核”。

## 1. 一句话结论

EverOS 的真正价值不是“又一个向量库”，而是把记忆系统拆成了**清晰的三段式闭环**：

1. `POST /memories` 做增量写入与提取触发
2. 后台完成 MemCell -> Episode/Profile 等结构化沉淀
3. `GET /memories/search` 按 `keyword/vector/rrf/agentic` 选择检索策略并注入上下文

这和 VoxFlame 当前 `workspace snapshot + session compaction` 方向高度一致。

---

## 2. EverOS 最值得借鉴的 6 个点

## 2.1 写入与检索接口分离，且检索策略可切换

在 [`docs/api_docs/memory_api.md`](/home/ubuntu/ever-os/docs/api_docs/memory_api.md) 与 [`src/agentic_layer/memory_manager.py`](/home/ubuntu/ever-os/src/agentic_layer/memory_manager.py) 中，读取路径会按 `retrieve_method` 分发：

- `keyword`
- `vector`
- `hybrid`
- `rrf`
- `agentic`

对 VoxFlame 的意义：

1. 不再把“语义检索”作为单一开关。
2. 可以按场景切检索策略：实时沟通优先低延迟，复盘/准备可用更重策略。

## 2.2 元数据是一级能力，不是附加字段

`conversation_meta`（scene、user_details、timezone、tags）在 EverOS 是检索精度与隔离边界的前提。

对 VoxFlame 的意义：

1. `session_intent.scene/surface`、`participant_identity`、`request_id` 应继续作为记忆检索过滤条件。
2. 未来多人场景时，必须显式区分“患者本人记忆”和“陪护/医生上下文”。

## 2.3 “轻量检索”和“智能检索”并存

[`docs/advanced/RETRIEVAL_STRATEGIES.md`](/home/ubuntu/ever-os/docs/advanced/RETRIEVAL_STRATEGIES.md) 的核心不是算法名，而是产品策略：

1. latency-sensitive 走 lightweight
2. 复杂问题走 agentic

对 VoxFlame 的意义：

1. 沟通主回合：`rrf` 或更轻策略
2. 会话后复盘：允许 `agentic` 补全画像与建议

## 2.4 “上下文引擎插件”优先于“memory slot 插件”

在 OpenClaw 插件实现里（[`examples/openclaw-plugin/src/engine.js`](/home/ubuntu/ever-os/examples/openclaw-plugin/src/engine.js)）：

1. `assemble()` 回合前检索并注入 context
2. `afterTurn()` 回合后写回新记忆
3. 不要求用户手动触发 memory tool

对 VoxFlame 的意义：

1. “患者插件化”可行，而且建议走 **context engine plugin** 形态，不要先走裸 memory tool。
2. UX 上保持自然对话，不暴露“你现在在调用记忆工具”。

## 2.5 有临时会话排除与 TTL 清理意识

插件里明确跳过 `temp:/internal:` 会话，并有 session state TTL。

对 VoxFlame 的意义：

1. 数据采样、调试房间、内部测试房间不应写入患者长期画像。
2. session-local state 要有到期策略，避免“伪长期记忆”。

## 2.6 group/user 作用域隔离很实用

EverOS 的 `user_id + group_id` 作用域模型可直接借鉴到 VoxFlame 的多角色场景。

对 VoxFlame 的意义：

1. `patient_id` 应是 durable owner。
2. `group_id` 可以承载家庭、康复团队、机构等协作空间。

---

## 3. 患者能不能直接作为插件

结论：**可以，但建议把“患者”建模为插件配置中的身份与作用域，不是把患者本身当插件代码。**

推荐结构：

1. `voxflame-patient-context-plugin`（插件）
2. `patient_id / caregiver_id / clinician_id`（身份）
3. `group_id`（家庭或机构空间）
4. `memory_types`（默认 `episodic_memory + profile`，谨慎引入 event_log）
5. `retrieve_method`（默认 `rrf`，复盘任务可升级到 `agentic`）

这样做的好处：

1. 患者迁移设备时只迁插件配置，不迁业务逻辑。
2. 后端继续做 durable owner，插件只负责“按需装配上下文 + 回合后写回”。
3. 能和 VoxFlame 现有 `workspace snapshot` 兼容，不推翻现有 contract。

---

## 4. 对 VoxFlame 的落地改造建议

## 4.1 先做“插件接口”，再做“插件生态”

先在 `livekit_agent` 定义最小接口：

1. `assemble_context(session_ctx, query) -> PreparationContextPack`
2. `after_turn(session_ctx, turn_payload) -> write_result`
3. `on_session_close(session_ctx, summary_payload)`

## 4.2 后端加检索策略参数

在 `workspace`/memory 查询接口增加 `retrieve_method`，默认 `rrf`，为后续 agentic 预留。

## 4.3 严格写入边界

1. dataset 仍保存原始音频与逐句文本
2. durable memory 只存结构化摘要/画像项
3. 对医疗敏感字段增加显式标签与删除能力

---

## 5. 与当前 VoxFlame 兼容性判断

从现有代码看（`session_context.py`、`workspace-snapshot.ts`、`memory-growth.service.ts`）：

1. 已经具备 scene/capability/session metadata 基础
2. 已有 durable `workspace` 与训练摘要链路
3. 缺的是“策略化检索 + 插件化上下文装配”

因此，EverOS 的“context-engine + strategy retrieval + metadata-first”可以直接帮助 VoxFlame 下一阶段收口。
