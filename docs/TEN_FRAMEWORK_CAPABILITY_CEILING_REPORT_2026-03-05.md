# TEN 框架能力与上限评估报告（VoxFlame）

> 日期：2026-03-05  
> 分析范围：`ten_agent/` 当前实现 + `ten-framework/` 官方示例与文档  
> 目标：评估 TEN 在 VoxFlame 场景下的真实能力边界、性能上限、发展路径与自研边界

---

## 1. 结论先行

1. **TEN 不等于必须 Agora。**  
   TEN 官方明确支持 RTC 与 WebSocket 两种连接模式；你们当前 `ten_agent` 已经是纯 WebSocket 方案。

2. **你们当前瓶颈不在 TEN runtime，而在“会话状态模型 + 外部模型 RTT + 记忆闭环完整度”。**  
   目前最影响上限的是多客户端隔离、打断状态机精细度、memory 数据链路闭环，而不是是否继续使用 TEN。

3. **TEN 的上限在“实时流式编排层”很高，但在“复杂 Agent 控制面”需要你们补强。**  
   TEN 适合做语音数据平面（ASR/LLM/TTS/VAD/turn/tool 的实时路由），复杂策略、会话治理、记忆治理应上移到你们自定义控制层。

4. **对 VoxFlame 阶段目标，最佳路径是“继续基于 TEN + 自建控制面”而非立即完全自研框架。**  
   先用 TEN 保持交付速度，同时把会话隔离、观测、记忆治理、供应商抽象做成你们可迁移的核心资产。

---

## 2. 证据与现状映射

## 2.1 官方 TEN 能力边界（代码证据）

- TEN README 明确写了 voice assistant 支持 **RTC + WebSocket**：  
  `ten-framework/README.md:82`
- 官方有独立 WebSocket Quickstart：  
  `ten-framework/docs/getting-started/websocket-voice-assistant-quick-start.md:6-13`
- 官方 WebSocket 示例图中直接使用 `websocket_server`，没有 `agora_rtc`：  
  `ten-framework/ai_agents/agents/examples/websocket-example/tenapp/property.json:11-21`

结论：**Agora 是示例常见默认，不是 TEN 的技术强依赖。**

## 2.2 你们 ten_agent 当前架构（代码证据）

- 当前主图：`websocket_server -> stt -> main_control -> corrector -> tts (+ memory_layer)`  
  `ten_agent/property.json:11-96`
- 传输链路是 WebSocket，端口 `8766`，无 `agora_rtc` 节点：  
  `ten_agent/property.json:11-20`
- `main_control` 负责打断与总协调：  
  `ten_agent/extension_src/voxflame_main_python/extension.py:36-155`
- `memory_layer` 已接入图：  
  `ten_agent/property.json:83-95`

## 2.3 当前实现状态与剩余缺口（2026-03-06）

### A. 多客户端链路：核心隔离已完成，压测与门禁待补

- WebSocket 层确实支持多客户端并携带 `client_id`：  
  `ten_agent/extension_src/websocket_server/websocket_server.py:48-123`  
  `ten_agent/extension_src/websocket_server/extension.py:301-323`
- `main_control` 已按 `client_id` 建立 `SessionContext` 分桶：  
  `ten_agent/extension_src/voxflame_main_python/extension.py:22-36`  
  `ten_agent/extension_src/voxflame_main_python/extension.py:50-58`
- 回传链路已支持目标客户端定向发送：  
  `ten_agent/extension_src/websocket_server/extension.py:394-428`

当前缺口：需要补并发压测、弱网回放、串话回归门禁，验证“实现正确”到“运行稳定”。

### B. 打断状态机：阈值已落地，仍缺少可观测指标

- 参数存在于配置：  
  `ten_agent/property.json:48`  
  `ten_agent/extension_src/voxflame_main_python/config.py:23`
- 代码中已使用阈值判定是否触发打断：  
  `ten_agent/extension_src/voxflame_main_python/extension.py:864`

当前缺口：缺少打断成功率、误打断率、用户可感知等待时长的统一看板。

### C. Memory 链路：已闭环，待推进检索质量与治理

- `property.json` 定义了 `save_conversation`、`voice_profile`、`memory_context` 连接：  
  `ten_agent/property.json:185-191`  
  `ten_agent/property.json:292-310`
- `memory_layer` 广播已执行 `send_data`：  
  `ten_agent/extension_src/memory_layer_python/extension.py:460-533`
- `voxflame_main` 已发送 `save_conversation`：  
  `ten_agent/extension_src/voxflame_main_python/extension.py:868-897`
- `llm_correction` 已消费 `voice_profile` 与 `memory_context`：  
  `ten_agent/extension_src/llm_correction_python/extension.py:174-188`

当前缺口：后端语义检索质量、记忆治理策略（TTL/审计/导出删除）尚未成体系。

### D. VAD / Turn Detection：仍未进入当前图

- 当前图未包含 `ten_vad_python` 或 `ten_turn_detection` 节点：  
  `ten_agent/property.json:8-313`
- 官方示例给出了 VAD 和 Turn Detection 的典型接法：  
  `ten-framework/ai_agents/agents/examples/voice-assistant-with-ten-vad/tenapp/property.json:106-139`  
  `ten-framework/ai_agents/agents/examples/voice-assistant-with-turn-detection/tenapp/property.json:103-112`

影响：轮次完结判断主要依赖 ASR final，复杂停顿语境下仍有延迟和误判空间。

---

## 3. TEN 的能力上限：该看什么，不该看什么

## 3.1 TEN 的强项（你们应继续利用）

1. **实时流式图编排**：音频帧、数据、命令三通道统一，适合语音 Agent 数据平面。  
2. **扩展可插拔**：ASR/LLM/TTS/工具扩展切换成本低，便于供应商替换。  
3. **运行时成熟度**：现有生态里已有 VAD、turn detection、memory、tool 示例。  
4. **工程效率高**：比从零写事件总线/调度/插件机制快一个量级。

## 3.2 TEN 的天然弱项（需要你们补）

1. **复杂会话治理不是框架自动完成的**：多租户会话隔离、状态一致性需要业务层设计。  
2. **长期记忆治理需要自建策略层**：可遗忘、权限、审计、冲突合并不在 TEN runtime 核心内。  
3. **产品级可观测要自行建设**：SLO 分解、分段追踪、故障回放需要你们定义。

## 3.3 性能上限分层模型（VoxFlame 语音链路）

端到端延迟可分解为：

`T_total = T_capture + T_transport + T_stt + T_policy + T_llm + T_tts_first_chunk + T_playback_buffer`

在你们现有链路中：

- `T_stt/T_llm/T_tts_first_chunk` 是主要大头（外部 API RTT + 模型推理）
- `T_policy` 受你们主控状态机与轮次策略影响
- TEN runtime 本身通常不是首要瓶颈，除非扩展内部阻塞或并发模型不当

结论：**TEN 的“理论上限”高于你们当前“工程上限”；当前上限由业务控制层决定。**

---

## 4. Agora 成本问题：是否必须、何时值得

## 4.1 结论

- 对 VoxFlame 当前阶段（单端/双端语音助手 + 字幕镜 + 纠错 + 记忆）：**不必强制 Agora**。  
- WebSocket 模式已经可满足 MVP 到 V1 大部分需求，并降低集成与运营复杂度。

## 4.2 为什么团队会误以为“TEN 必须 Agora”

1. 官方多数 voice-assistant 示例默认用了 `agora_rtc`。  
2. OpenClaw 示例与 turn detection 示例都走了 Agora 版本。  
3. 文档入口容易先看到 RTC 路线。

但这不改变事实：官方同时提供了 WebSocket 快速入口和示例图。

## 4.3 OpenClaw 与 Agora 的关系（关键澄清）

- OpenClaw 示例确实使用 Agora：  
  `ten-framework/ai_agents/agents/examples/openclaw-example/README.md:16-18`  
  `ten-framework/ai_agents/agents/examples/openclaw-example/tenapp/property.json:11-25`
- 但 OpenClaw 的核心是工具委托扩展 `openclaw_gateway_tool_python`，不是 RTC 节点本身：  
  `ten-framework/ai_agents/agents/examples/openclaw-example/tenapp/property.json:88-104`

结论：**OpenClaw 能力可以迁移到 WebSocket 图，不要求 Agora 作为前置。**

---

## 5. VoxFlame 还能从 TEN 继续榨出的价值

## 5.1 可立即开发的 4 个方向（低风险高收益）

1. **观测与回归门禁（P0）**  
   建立端到端时延、误打断率、重连恢复率指标，并接入回归测试门禁。

2. **VAD + 语义轮次双层判定（P1）**  
   VAD 判声学边界，turn detection 判语义完结；先在“训练复盘模式”灰度，再进实时对话主链路。

3. **记忆检索质量提升（P0）**  
   把“写入已闭环”推进到“检索可用”：补语义检索、重排、命中评估与回归样本。

4. **会话治理完善（P0）**  
   统一 session trace 字段，完善异常断线恢复与多客户端并发场景防串话验证。

## 5.2 对软硬件一体目标的直接价值

- 设备端/边缘端可复用 TEN 图能力做协议统一（麦克风、蓝牙、本地音频前处理）。  
- 云端保留你们控制面做策略和记忆治理，形成“端侧采集 + 云侧决策 + 可回放审计”的一致架构。  
- 有利于后续多形态终端（手机/PWA/轻硬件）共用一套 Agent 数据平面。

---

## 6. 若未来自研语音 Agent 框架，必须注意的共性问题

## 6.1 共性风险（不依赖具体框架）

1. **时序一致性**：ASR interim/final、TTS start/end、flush 的先后序必须可证明。  
2. **多会话并发模型**：每会话单 actor，跨会话零共享可变状态。  
3. **可观测性**：每一轮链路都要有 trace_id/session_id/stage latency。  
4. **供应商抽象**：ASR/LLM/TTS 热切换能力必须从 Day-1 设计。  
5. **记忆治理**：可忘记、可导出、可审计、可撤销权限。

## 6.2 必须重点自研的模块

1. **Session Router + State Store**（硬性）  
2. **Barge-in/Turn State Machine**（硬性）  
3. **Memory Orchestrator**（短期/长期/本地/云同步）  
4. **Observability Plane**（指标、日志、追踪、回放）  
5. **Policy Engine**（同意模型、权限、敏感场景策略）

如果以上模块不自研，仅替换“运行框架”本身，收益非常有限。

---

## 7. 面向 2026 阶段目标的建议路线

## 7.1 2026 Q2（P0，2-4 周）

1. 补全核心 SLO 看板与链路追踪（时延、打断、重连）。  
2. 完成多客户端并发压测与弱网回放基线。  
3. 灰度接入 VAD/Turn Detection 并定义回退策略。  
4. 提升 memory 检索质量并建立评估集。

验收指标：

- 并发 10 会话无串话/串流  
- p95 打断成功率 > 95%  
- 纠错链路 p95 < 2.5s（按你们当前云模型组合）

## 7.2 2026 Q3（P1，4-8 周）

1. 引入 VAD 双路并联（ASR + VAD）。  
2. 灰度接入 turn detection（先训练模式，再沟通模式）。  
3. 建立“文本记忆 + 音频特征记忆”统一检索接口。

验收指标：

- 误打断率下降  
- 轮次完结判定准确率提升  
- 会话摘要与复盘命中率可量化

## 7.3 2026 Q4（P2，持续）

1. 把 TEN 固化为数据平面，抽离你们可迁移控制面。  
2. 评估是否在特定场景引入 RTC（而非全量切换）。  
3. 针对轻硬件形态补端侧缓存、断网降级、功耗策略。

---

## 8. 最终建议（架构决策）

**建议采用：`TEN Runtime + VoxFlame Control Plane` 双层架构。**

- TEN 负责：实时流处理、扩展装配、协议桥接。  
- VoxFlame 自研层负责：会话治理、策略引擎、记忆治理、观测与审计。

这条路线兼顾：

1. 短期交付速度（不推倒重来）  
2. 中期技术壁垒（核心能力沉淀在你们自己手里）  
3. 长期可迁移性（未来可替换底层 runtime，而不丢控制面资产）

---

## 9. 传输层附录（WebSocket vs WebRTC，核验版）

> 本节用于替代旧版 `WEBSOCKET_VS_RTC_GUIDE.md` 的核心结论，保留可验证技术点。

## 9.1 不应再争论的事实

1. **WebSocket 是 TCP 上的全双工消息通道（RFC 6455）**，优点是实现简单、工程成本低。  
2. **WebRTC 不是“单协议”而是媒体协议栈**，实时媒体链路通常建立在 UDP 相关路径上（DataChannel 常见为 SCTP/DTLS/UDP，RFC 8831）。  
3. **浏览器可直接启用音频前处理约束**：`echoCancellation`、`noiseSuppression`、`autoGainControl`（MDN/W3C 规范接口）。

## 9.2 对 VoxFlame 的工程含义

1. 在你们当前阶段，WebSocket 路线成立：交付快、链路可控、与现有 TEN 图一致。  
2. 只有当“弱网实时性 + 大规模并发媒体 + 更强抗抖动”成为主要痛点时，才值得引入 RTC。  
3. 推荐策略仍是“先 WebSocket 稳主链路，再按场景引入 RTC 增强”，而不是全量迁移。

## 9.3 外部核验来源（官方/标准）

1. RFC 6455 (WebSocket): https://www.rfc-editor.org/rfc/rfc6455  
2. RFC 8831 (WebRTC Data Channel): https://www.rfc-editor.org/rfc/rfc8831  
3. W3C WebRTC 1.0: https://www.w3.org/TR/webrtc/  
4. MDN 媒体采集约束（AEC/NS/AGC）: https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints  
5. OpenAI Realtime WebRTC: https://platform.openai.com/docs/guides/realtime-webrtc  
6. OpenAI Realtime WebSocket: https://platform.openai.com/docs/guides/realtime-websocket  
7. Gemini Live Guide: https://ai.google.dev/gemini-api/docs/live-guide  
8. Alibaba Qwen Realtime: https://www.alibabacloud.com/help/en/model-studio/realtime

---

## 10. 取代关系（文档治理）

本报告替代以下分散 TEN 文档并统一维护：

- `TEN_FRAMEWORK_ANALYSIS.md`
- `TEN_EXTENSIONS_ANALYSIS.md`
- `TEN_VAD_ANALYSIS.md`
- `TEN_TURN_DETECTION_ANALYSIS.md`
- `WEBSOCKET_VS_RTC_GUIDE.md`

后续 TEN 与传输协议相关决策请优先更新本文件，避免再次分叉。
