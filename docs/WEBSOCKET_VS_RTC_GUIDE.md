# WebSocket vs RTC 技术选型指南

本文档汇总了 Voice Agent 开发中 WebSocket 与 RTC（WebRTC）技术选型的官方资料、优秀文章和对比分析。

## 目录

1. [核心观点](#核心观点)
2. [技术对比表](#技术对比表)
3. [官方资源链接](#官方资源链接)
4. [优秀文章推荐](#优秀文章推荐)
5. [混合架构方案](#混合架构方案)
6. [VoxFlame 选型建议](#voxflame-选型建议)

---

## 核心观点

来自声网毛玉杰在 RTE2025 大会的分享：

> "WebSocket 与 WebRTC 并非直接可比的竞争技术"
> 
> "若业务本身无音视频需求，不应盲目选择 WebRTC"
> 
> "选择协议不只是选择传输方式，而是在定义用户体验的上限"

### 关键结论

1. WebSocket 适用场景：小数据量、状态同步、开发成本较低
2. WebRTC 适用场景：实时音视频传输、复杂媒体处理
3. 混合架构推荐：WebSocket 负责信令控制，WebRTC 处理媒体流

---

## 技术对比表

| 特性 | WebSocket | WebRTC |
|------|-----------|--------|
| 协议基础 | TCP + HTTP | UDP-like (DTLS/SRTP) |
| 传输保证 | 有序可靠传输 | 优先速度，容忍丢包 |
| 延迟 | 中等 (TCP 重传机制) | 极低 (无需等待重传) |
| 3A 处理 | 需自行实现 | 内置 AEC/ANS/AGC |
| 跨网络性能 | 稳定但延迟波动 | 自适应带宽/网络抖动 |
| 开发复杂度 | 低 | 高 |
| 加密 | TLS/SSL | DTLS + SRTP |
| P2P 支持 | 需中转服务器 | 原生支持 |
| 适合场景 | 信令、文本、控制指令 | 实时音视频流 |

### 性能对比

| 场景 | WebSocket | WebRTC |
|------|-----------|--------|
| 理想网络 | 优秀 | 优秀 |
| 网络抖动 | 明显卡顿 | 平滑处理 |
| 丢包环境 | TCP 重传导致延迟 | 继续传输，忽略丢失 |
| 高并发 | 依赖服务器 | SFU 可扩展 |

---

## 官方资源链接

### TEN Framework 官方

| 资源 | 链接 |
|------|------|
| TEN Framework GitHub | https://github.com/TEN-framework/TEN-Agent |
| TEN VAD | https://github.com/TEN-framework/ten-vad |
| TEN Turn Detection | https://github.com/TEN-framework/TEN-Turn-Detection |
| RTE 开发者社区 | https://www.rtecommunity.dev/ |

### 声网 Agora 官方文档

| 资源 | 链接 |
|------|------|
| Web SDK API Reference | https://doc.shengwang.cn/api-ref/rtc/javascript/overview |
| React SDK Reference | https://doc.shengwang.cn/api-ref/rtc/react/globals |
| 产品文档中心 | https://docs.agora.io/cn/ |

### 对话式 AI 学习资源

| 资源 | 链接 |
|------|------|
| 对话式 AI 好奇者手册 | https://www.rtecommunity.dev/conversational-ai-for-the-curious/ |
| 2025 对话式 AI 白皮书 | RTE2025 大会发布 |

---

## 优秀文章推荐

### 核心必读

1. 成为一个进阶语音智能体开发者（RTE101 技术专场回顾）
   - SegmentFault: https://segmentfault.com/a/1190000047442762
   - 知乎: https://zhuanlan.zhihu.com/p/1979121498926097229
   - 内容：WebSocket vs WebRTC、TEN VAD、3A 处理、Voice Agent 落地

2. 为何 WebRTC 是实时语音 AI 架构的最佳传输方案
   - 链接：https://www.nxrte.com/jishu/webrtc/62114.html
   - 内容：WebRTC 优势、架构设计、与 WebSocket 对比

3. Pion 创始人聊 WebRTC、AI、SIP 和 QUIC
   - 链接：https://zhuanlan.zhihu.com/p/1978129419102074203
   - 内容：WebRTC 技术原理、Voice Agent 实践

### 实践指南

4. 使用 Amazon Bedrock 和 Pipecat 构建低延迟智能语音 Agent
   - 链接：https://aws.amazon.com/cn/blogs/china/building-low-latency-intelligent-voice-agents-using-amazon-bedrock-and-pipecat/
   - 内容：WebSocket vs WebRTC 选型、原型与生产环境

5. RTC：Voice Agent 的高铁网络
   - 链接：https://www.rtecommunity.dev/t/t_KldcVJAt4XRNKa
   - 内容：RTC 技术栈、底层优化

6. 打造 AI 语音对话智能体：为什么 RTC 至关重要（即构科技）
   - 链接：https://www.zego.im/blog/2424.html
   - 内容：RTC 全流程低延迟方案

7. WebRTC 与 WebSocket：实时通信的理想协议
   - 链接：https://www.zego.im/blog/1971.html
   - 内容：两种协议对比详解

### 大会与活动

8. RTE 2025 第十一届实时互联网大会
   - 官网：https://www.rteconf.com/
   - 内容：对话式 AI 论坛、技术分享

---

## 混合架构方案

### 推荐架构

用户设备
   |
   +-- WebSocket --> 信令服务器 --> 会话管理、状态同步
   |
   +-- WebRTC ----> 媒体服务器 --> 音频流、AI 处理
                        |
                        +-- ASR (语音识别)
                        +-- LLM (大模型)
                        +-- TTS (语音合成)

### 数据流分离

| 数据类型 | 协议 | 说明 |
|----------|------|------|
| 信令/控制 | WebSocket | 会话建立、状态同步、文本消息 |
| 音频流 | WebRTC | 实时语音、低延迟传输 |
| 视频流 | WebRTC | 可选，视频通话 |
| 文件传输 | HTTP/WebSocket | 大文件、历史数据 |

---

## VoxFlame 选型建议

### 当前阶段（v1.0-v2.0）：WebSocket 优先

适合原因：
- 快速验证核心功能
- 降低开发复杂度
- 适配更多客户端环境
- LLM 语音纠正是当前重点

技术方案：
- WebSocket 传输音频流
- 服务端处理 VAD、ASR、LLM、TTS
- 前端简单播放器实现

### 演进阶段（v3.0+）：RTC 增强

升级时机：
- 用户规模扩大
- 网络环境复杂化
- 需要更低延迟
- 需要视频支持

技术方案：
- 声网 Agora RTC SDK
- SFU 媒体服务器架构
- 混合信令/媒体分离

### 选型决策树

是否需要极低延迟（<200ms）？
  +-- 是 --> WebRTC
  +-- 否 --> 继续评估
              |
              用户网络环境是否复杂多变？
                +-- 是 --> WebRTC (自适应能力)
                +-- 否 --> 继续评估
                            |
                            开发资源是否充足？
                              +-- 是 --> WebRTC (更好体验)
                              +-- 否 --> WebSocket (快速上线)

---

## 参考引用

### RTE101 技术专场核心分享

林子毅（TEN VAD 核心开发者）
- 3A 技术（AEC、ANS、AGC）是 Voice Agent 的前置守门员
- TEN VAD：极致轻量（300KB）、高精准度、Agent Friendly

毛玉杰（声网生成式 AI 产品负责人）
- WebSocket 基于 TCP，开发成本低
- WebRTC 是完整媒体协议栈，为实时音视频而生
- 混合架构：WebSocket 信令 + WebRTC 媒体

段涛（声网音视频实验室负责人）
- 对话式 AI 三维度：理解、表达、交互
- 线上实际错误率可能比测试高 4-5 倍

白宦成（阶跃星辰）
- Voice Agent 必须有 ToolCall 和 MCP
- 延迟优化：流式调用、并行执行、预测性执行

---

## 更新日志

- 2025-01-XX：初始版本，汇总 WebSocket/RTC 选型资料
