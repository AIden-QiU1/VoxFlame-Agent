# VoxFlame 执行路线图（2026-03-05）

> 合并来源：`ARCHITECTURE_ANALYSIS.md`、`COMPREHENSIVE_DEVELOPMENT_PLAN.md`、`DYSARTHRIC_FEATURES_PLAN.md`  
> 目标：形成单一执行文档，避免多份“计划文档”并行漂移

> 2026-03-09 补充：基于 `ideas/` 复盘与外部资料核验，近期主线已重排为“主动沟通 / 训练反馈 / 个体记忆”，全屏字幕降级为辅助能力。详见 [产品方向重排](COMMUNICATION_FIRST_PRODUCT_RESET_2026-03-09.md)。

---

## 1. 执行总则

1. 先做“沟通成功率”，再做“体验增益”。
2. 先做可验证闭环，再做功能扩张。
3. 所有关键技术结论必须可追溯到代码或官方文档。

---

## 2. 当前基线（以代码为准）

1. TEN 主链路已跑通：`WebSocket -> ASR -> LLM纠错 -> TTS`。
2. `main_control` 已完成 `per-session` 会话状态隔离，`interrupt_threshold_ms` 已在代码路径生效。
3. `memory_layer -> corrector` 与 `save_conversation` 已形成可运行闭环。
4. 现有最高优先级是“稳定性验证 + 观测 + 回归门禁”，而非盲目加模块。

关联文档：
- [TEN 框架能力与上限评估](TEN_FRAMEWORK_CAPABILITY_CEILING_REPORT_2026-03-05.md)
- [统一记忆系统报告](VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md)

---

## 3. 90 天主路径（MVP -> 可规模验证）

## 3.1 P0（第 1-4 周）：稳定沟通主回路（已完成基础实现，进入验证）

### 工作包 A：会话隔离与并发稳定

- 状态：✅ `main_control` 已完成 `per-session state` 分桶（按 `client_id/session_id`）。
- 杜绝多客户端串话、串字幕、串音频。
- 建立会话级 trace 字段：`session_id`、`turn_id`、`request_id`。

验收标准：

- 并发 10 会话，无串流/串话事故。
- 异常断线可恢复，不污染其他会话状态。

### 工作包 B：打断状态机工程化

- 状态：✅ `interrupt_threshold_ms` 已落地；下一步聚焦误打断观测与调参。
- 区分噪声触发、短音节触发、明确插话触发。
- 建立可回放打断日志（触发原因+时序）。

验收标准：

- 打断成功率 > 95%。
- 误打断率在灰度期持续下降。

### 工作包 C：记忆闭环（最小可用已完成）

- 状态：✅ `voice_profile/memory_context` 下发、`llm_correction` 消费、`save_conversation` 调用均已接通。
- 下一步：补并发/弱网场景下写入一致性验证与检索质量评估。

验收标准：

- 记忆写入成功率 > 99%。
- 热词/混淆模式对纠错命中有可观提升。

## 3.2 P0（第 2-6 周）：先解决“怎么开口”和“怎么练”

### 工作包 D：第一句话 / 场景沟通 Starter Kit

- 预设场景卡片（医疗 / 家庭 / 陌生人 / 紧急）+ 用户自定义。
- 快捷短语板与一键代播闭环合并设计，而不是分散成多个入口。
- 保留确认、打断、回退、重试。

验收标准：

- 医疗 / 家庭 / 陌生人场景可在 <= 2 步进入可表达状态。
- 识别失败时，starter kit 仍能完成核心沟通任务。

### 工作包 E：训练反馈与数据采集页

- 训练页从“录音上传页”重构为“中文目标句 + 反馈页”。
- 展示目标句、拼音、重点发音提示、录后对照结果。
- 反馈维度优先覆盖：声母、韵母、声调、漏字 / 多字，不照搬英文发音训练逻辑。
- 明确数据保存边界，并输出单次反馈与趋势反馈。

验收标准：

- 每次录音后，用户都能看到本次读了什么、系统听成了什么、拼音差异和哪里容易混淆。
- 用户可理解哪些数据被保存，以及这些数据如何服务后续训练与沟通。

### 工作包 F：双行字幕 / 全屏显示（辅助能力）

- 双行字幕继续承担“系统是否听错”的可解释性角色。
- 全屏字幕保留给面对面展示等场景，但不再作为首页主价值与近期主任务。

验收标准：

- 用户可快速区分“系统识别问题”和“表达清晰度问题”。
- 辅助显示不挤占首页与主沟通流程。

---

## 4. 180 天路径（V1：可持续优化）

## 4.1 P1（第 2-3 月）：轮次治理与个体沟通记忆

1. VAD 与 Turn Detection 分层接入（先灰度后主链路）。
2. 建立个体沟通记忆最小模型：高频表达、混淆词、场景偏好、训练历史。
3. 建立训练复盘页，但反馈口径保持为“趋势与建议”，不冒充医学诊断。

验收标准：

- 轮次误判率下降，用户等待感降低。
- 个体记忆能稳定服务场景模板推荐、快捷短语排序和纠错上下文。

## 4.2 P1（第 3-6 月）：场景声音提醒与设备联动原型

1. 定义统一事件模型：声音事件、置信度、提醒优先级、反馈通道。
2. 原型验证 3 到 5 个高价值声音事件（如门铃、烟雾报警器、呼叫姓名）。
3. 优先设计 `硬件 -> App / Relay -> VoxFlame` 路径，而不是直接押注浏览器硬件 API。

验收标准：

- 至少一条端到端事件链可跑通。
- 用户能自定义事件与反馈方式，且配置路径清晰。

---

## 5. 365 天路径（V2：康复闭环与协作）

1. 记忆治理：同意层级、TTL、导出/删除审计。
2. 康复师协作视图：会话摘要、错误模式、训练建议。
3. 高价值音频片段异步多模态索引（不进实时主回路）。
4. 场景感知与沟通记忆开始合流，形成更强的个体化沟通助手。

---

## 6. 关键技术点核验（避免想象）

以下结论来自官方文档与标准：

1. WebSocket 协议是基于 TCP 的帧协议（RFC 6455）。  
   来源：https://www.rfc-editor.org/rfc/rfc6455
2. WebRTC 是多协议栈，不是“单协议”，其数据通道常见为 SCTP over DTLS over UDP（RFC 8831）。  
   来源：https://www.rfc-editor.org/rfc/rfc8831
3. 浏览器音频采集层可配置 `echoCancellation`、`noiseSuppression`、`autoGainControl`。  
   来源：https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints
4. OpenAI Realtime 在浏览器推荐 WebRTC，在服务端集成常用 WebSocket。  
   来源：
   - https://platform.openai.com/docs/guides/realtime-webrtc  
   - https://platform.openai.com/docs/guides/realtime-websocket
5. Gemini Live 当前每个会话仅允许一种响应模态（`TEXT` 或 `AUDIO`），并存在会话时长约束。  
   来源：https://ai.google.dev/gemini-api/docs/live-guide
6. 阿里云 Qwen Realtime 支持 WebSocket、服务端 VAD 与中断参数。  
   来源：https://www.alibabacloud.com/help/en/model-studio/realtime
7. `Web Bluetooth API` 依赖 secure context，且兼容性有限。  
   来源：https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
8. `Web Serial API` 依赖 secure context，且可用性有限。  
   来源：https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
9. `WebHID API` 仍为实验性能力，且兼容性有限。  
   来源：https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API

---

## 7. 本文档取代关系

本文件取代并合并以下文档：

- `ARCHITECTURE_ANALYSIS.md`
- `COMPREHENSIVE_DEVELOPMENT_PLAN.md`
- `DYSARTHRIC_FEATURES_PLAN.md`
