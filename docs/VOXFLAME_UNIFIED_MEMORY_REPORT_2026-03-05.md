# VoxFlame 统一记忆系统报告（2026-03-05）

> 目标：把三类 memory 体系整合为一个可落地、可迭代、可合规的统一方案，服务 VoxFlame 的“软硬件一体沟通系统”路线。

---

## 1. 结论先行

VoxFlame 最合适的路线不是“单一记忆系统替代一切”，而是**三层融合**：

1. **会话与个体化短中期记忆（本地优先）**
   - 以当前 `memory_layer_python + LocalStore(SQLite+Markdown)` 为主干。
   - 负责实时纠错学习、热词、混淆模式、短期上下文。

2. **跨设备/跨会话长期记忆（服务化）**
   - 以 `Supabase` 为主数据平面，逐步接入 **PowerMem / mem0 类能力**作为“关系与语义增强层”。
   - 负责用户长期画像、结构化偏好、组织级知识与多 Agent 共享。

3. **音频多模态记忆（异步增强，不进实时主链路）**
   - 默认不做“全量音频向量化实时检索”，而做**选择性音频索引**。
   - 仅在高价值片段（低置信纠错、高风险场景、康复评估样本）启用音频 embedding / speaker / prosody 检索。

一句话策略：**在线文本优先保证时延，离线音频增强拉高个体化上限。**

---

## 2. 现有代码与配置现实（仓库实测）

### 2.1 已有基础能力（可复用）

1. TEN 侧已有 `memory_layer_python` 扩展：
   - 本地目录与 SQLite 初始化、会话表/话语表/纠错表/热词表/混淆模式表。
   - 支持 `correction_event` 学习、自动热词、清晰度滚动分数。
   - 参考：`ten_agent/extension_src/memory_layer_python/*`

2. 主流程已具备用户上下文注入与记忆事件触发：
   - `system_init` 注入用户信息。
   - session start/end、correction event 已连接。
   - 参考：`ten_agent/property.json`, `voxflame_main_python/extension.py`

3. 后端已有 Memory API 与 Supabase 表访问：
   - `/api/memory/add|search|user/:id|stats` 等。
   - 参考：`backend/src/controllers/memory.controller.ts`, `backend/src/services/supabase.service.ts`

### 2.2 当前缺口（2026-03-06）

1. **Memory 广播链路：已闭环，需回归门禁**
   - `_broadcast_voice_profile/_broadcast_clarity_score/_broadcast_memory_context` 已执行 `send_data`。
   - 当前重点从“修功能”转为“回归验证”：需要覆盖写入、广播、消费的自动化测试。

2. **`save_conversation` 写入：已闭环，需压测与回放**
   - `voxflame_main_python` 已发送 `save_conversation`，`memory_layer` 会话 turn 可累计。
   - 当前重点是并发与弱网条件下的一致性验证，避免漏写和重复写入。

3. **前后端记忆双栈并存且语义仍需统一**
   - 前端 `memory-service.ts` 是 localStorage 会话记忆与后端同步队列。
   - TEN 本地 SQLite 与后端 Supabase 是另一套事实源。
   - 结果：来源分裂、检索口径不一致、合并困难。

4. **后端“语义检索”仍是 TODO**
   - `searchMemories` 当前以文本检索为主（非完整向量语义检索）。

---

## 3. 三类 Memory 如何分工融合

## 3.1 传统记忆系统（TEN PowerMem / mem0）

定位：**服务化长期语义记忆与关系增强层**。

推荐用法：

1. 托管“跨会话、跨设备、跨 Agent”的长期事实与偏好。
2. 在检索阶段做语义召回与可选 reranker。
3. 以 `user_id + agent_id + session_id/run_id` 做作用域隔离。

与 VoxFlame 匹配点：

1. 现有 TEN 示例（PowerMem/memU）已经验证“turn interval + idle timeout”自动持久化模式。
2. mem0 提供开源可自托管，支持向量库与图关系能力，适合后续组织级扩展。

风险与控制：

1. 外部依赖增加运维复杂度（尤其 Graph + reranker）。
2. 必须把实时路径与服务化写入解耦，避免对话阻塞。
3. 所有外部写入都需要可降级（失败时回落本地）。

## 3.2 OpenClaw 代表的本地文件记忆

定位：**可审计、可编辑、可恢复的本地事实源**。

推荐用法：

1. `MEMORY.md` 存长期整理记忆（用户画像、沟通偏好、稳定事实）。
2. `memory/YYYY-MM-DD.md` 存日级运行日志（增量事件、上下文短期沉淀）。
3. 由后台索引工具做 `memory_search/memory_get` 风格检索（片段返回，按需精读）。

与 VoxFlame 匹配点：

1. 与“默认本地优先、用户可控”战略完全一致。
2. 天然支持合规审计、导出、人工修订、冲突修复。
3. 对软硬件形态友好：设备离线也可写本地事实源。

风险与控制：

1. 文件增长后检索质量受索引和切分策略影响。
2. 需要明确 compaction 与归档规则，防止上下文膨胀。

## 3.3 音频多模态记忆 / Audio RAG

定位：**高价值补充层，不是 MVP 主链路**。

关键判断：

1. 不是“要不要音频 RAG”，而是“**何时、对哪些片段、为哪些任务**做音频索引”。
2. 音频 RAG在研究上有潜力，但当前生产仍应以文本主检索为骨架。

推荐用法：

1. 默认路径：ASR/纠错文本入主记忆（可解释、低复杂度）。
2. 触发路径：仅对以下片段做异步音频 embedding：
   - 高纠错率或低清晰度片段
   - 医疗/紧急等高风险会话
   - 康复训练评估样本
3. 检索融合：文本召回为主，音频召回作 rerank/补充证据。

---

## 4. “音频都转文字吗？”与“音频RAG太慢吗？”

## 4.1 结论

1. **不建议全量只转文字后丢弃音频**：会损失韵律、说话人、情绪和发音特征。
2. **也不建议全量实时音频RAG**：系统复杂度和工程成本过高，不适合当前 MVP 目标。
3. **建议文本主干 + 音频增量索引**：兼顾生产可落地性与后续上限。

## 4.2 证据与推断

1. WavRAG（ACL 2025）显示端到端音频 RAG可在对比 ASR-Text RAG 时达到可比检索效果并报告 10x 加速。
2. VoxRAG（MAGMaR 2025）证明 transcription-free 可行，但其检索/答案精度仍有明显提升空间（并非即插即用生产方案）。
3. 从 API 成本结构看，音频链路成本通常高于纯文本链路，适合“按价值触发”而非“全量默认”。

> 推断（基于以上来源）：VoxFlame 当前阶段若把所有音频直接做 RAG 主路径，收益/成本比不优；更优策略是先把文本主路径做到稳定低延迟，再对关键音频片段做异步增强。

---

## 5. 统一架构（VoxFlame 建议版）

## 5.1 四层结构

1. **L0 实时工作记忆（RAM / 当前会话）**
   - 用于当前 turn 决策与打断恢复。

2. **L1 本地事实源（SQLite + Markdown）**
   - `~/.voxflame/memory.db`
   - `~/.voxflame/MEMORY.md`
   - `~/.voxflame/memory/YYYY-MM-DD.md`

3. **L2 云端结构化与语义层（Supabase + 可选 mem0/PowerMem）**
   - 会话元数据、用户画像、共享知识、跨端同步。

4. **L3 多模态索引层（Qdrant，异步）**
   - 文本向量、音频向量、说话人向量分集合管理。
   - 使用 on-disk + quantization 控制资源。

## 5.2 检索优先级

1. 先查 L1/L2 文本语义（低延迟、可解释）。
2. 不足时再触发 L3 音频相关召回。
3. 最后将结果裁剪为 prompt 可承载片段（top-k + 时间衰减 + 去重）。

---

## 6. 与软硬件一体目标的阶段对齐

## 阶段 A（MVP/90天）：先把“能稳定沟通”做透

1. 完成 TEN 记忆闭环后的回归与观测：确保 `save_conversation`、`voice_profile` 在并发场景稳定生效。
2. 统一事实源：TEN 本地记忆为主，前端 localStorage 记忆降为缓存层。
3. 后端补齐语义检索与权限校验（ownership）。

退出标准：

1. 记忆写入成功率 > 99%。
2. 检索 p95 < 120ms（本地+后端综合）。
3. 热词自动学习对纠错命中有可观提升。

## 阶段 B（V1/180天）：跨端个体化与可治理

1. 引入 mem0/PowerMem 作为可插拔长期语义层。
2. 建立记忆治理：同意层级、TTL、删除/导出审计。
3. 引入关系记忆（图）用于“人-地点-事件”场景增强。

## 阶段 C（V2/365天）：多模态康复飞轮

1. 音频片段选择性 embedding 管线。
2. 针对康复与高风险场景的音频检索策略。
3. 形成“沟通成功率 + 康复趋势”双闭环指标体系。

---

## 7. 立即执行清单（按优先级）

1. 建立 Memory 端到端回归：覆盖写入、检索、广播、消费全链路。
2. 统一 ID 规范：`user_id/session_id/agent_id` 在 TEN、Backend、Supabase 同名同语义。
3. 将前端 `memory-service` 明确为“会话缓存 + 断线缓冲”，TEN LocalStore 作为事实源。
4. 后端补齐语义检索增强（向量召回/重排）与 ownership 校验。
5. 定义“音频索引触发器”（低置信纠错、高价值场景、训练样本）并异步化。

---

## 8. 文档收敛决策

本报告已覆盖并替代以下旧文档的核心内容：

1. `docs/MEMORY_SYSTEM_PLAN.md`
2. `docs/VOXFLAME_MEMORY_DESIGN.md`
3. `docs/MEMORY_RAG_SYSTEMS_RESEARCH.md`

---

## 9. 主要参考（2026-03-05 核验）

### VoxFlame 本地代码/文档

1. `ten_agent/property.json`
2. `ten_agent/extension_src/memory_layer_python/extension.py`
3. `ten_agent/extension_src/memory_layer_python/stores/local_store.py`
4. `ten_agent/extension_src/voxflame_main_python/extension.py`
5. `backend/src/controllers/memory.controller.ts`
6. `backend/src/services/supabase.service.ts`
7. `frontend/src/lib/memory/memory-service.ts`
8. `openclaw/docs/concepts/memory.md`
9. `openclaw/extensions/memory-core/index.ts`
10. `ten-framework/ai_agents/agents/examples/voice-assistant-with-PowerMem/*`
11. `ten-framework/ai_agents/agents/examples/voice-assistant-with-memU/*`

### 外部一手资料

1. Mem0 Overview: https://docs.mem0.ai/platform/overview
2. Mem0 OSS Overview: https://docs.mem0.ai/open-source/overview
3. Mem0 Graph Memory: https://docs.mem0.ai/open-source/features/graph-memory
4. Mem0 OSS Configuration: https://docs.mem0.ai/open-source/configuration
5. WavRAG (ACL 2025): https://aclanthology.org/2025.acl-long.613/
6. VoxRAG (MAGMaR 2025): https://aclanthology.org/2025.magmar-1.3/
7. OpenAI API Pricing: https://platform.openai.com/docs/pricing
8. Qdrant Quantization Guide: https://qdrant.tech/documentation/guides/quantization/
