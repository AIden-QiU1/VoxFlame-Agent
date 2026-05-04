# VoxFlame Control Plane

> 状态：控制面实现深文档。
>
> 产品层关于 multi-surface、session_strategy、surface contract 的主参考，优先看 [产品 PRD](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)；App / Mobile Workbench 方向看 [VoxFlame App / Mobile Workbench Best Practices And Opportunity（2026-05-04）](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)。
>
> 本文档不再承担产品运行时主文角色；相关产品判断已经并回 PRD 与具体 surface 专题文档，这里只继续保留 backend 控制面实现、对象模型和风险收口。

## 为什么单独写这份文档

`VoxFlame` 已经不只是“一个前端 + 一个 backend + 一个 realtime worker”。

如果不把控制面单独命名出来，后面这些复杂度会继续混在一起：

- 会话创建与销毁
- `communication / training` 模式切换
- token、graph、runtime property 注入
- 健康检查、诊断、smoke、provider 状态
- Web、PWA、未来 App 与 execution plane 之间的职责边界

这份文档的目标不是描述所有实现细节，而是明确：

- 控制面负责什么
- 不负责什么
- 现在谁在承担这层职责
- 后面怎么继续收口

## 一句话定义

`Control Plane` 是 `VoxFlame` 的运行编排层。

它不直接做 ASR、纠错、TTS 和训练反馈，而是决定：

- 何时启动一段会话
- 用哪条 graph 和哪些 runtime properties
- 谁可以请求这段会话
- 会话如何被观测、保活、诊断和结束

## 当前唯一事实源

当前运行时唯一事实源已经是：

`Frontend LiveKit RTC/Data -> Backend /api/rtc/session/* -> self-hosted livekit-server -> livekit_agent`

这意味着：

- 前端不能自己成为真正的会话控制面
- execution runtime 也不应该自己决定产品层的 mode、权限和 surface 策略
- backend 当前是最接近控制面的中枢

## Control Plane 负责什么

### 1. Session Lifecycle

- 生成或接受 `requestId`
- 决定 room/session metadata
- 分配 participant / dispatch metadata
- 管理 `start / ping / stop`
- 给前端返回 LiveKit 所需 token 和连接信息

### 2. Mode Routing

- 明确 `communication` 与 `training` 的模式语义
- 把模式映射成 runtime property overrides
- 控制哪些能力在某个模式下可用或默认关闭

### 3. Runtime Configuration

- LiveKit URL / dispatch metadata
- timeout
- runtime property overrides
- 未来的 provider fallback、feature flags、diagnostics switches

### 4. Health And Diagnostics

- 暴露 `/health`
- 暴露 graph 列表和配置状态
- 后续应增加 provider 健康、smoke 状态、最近错误摘要

### 5. Boundary Enforcement

- 控制哪些 surface 可以触发哪些能力
- 控制哪些 mode 允许哪些 side effects
- 防止 UI、prompt 或运行时事件直接绕过边界

## Control Plane 不负责什么

- 不直接执行 ASR/TTS/纠错
- 不直接保存长期记忆内容
- 不承担 UI 展示逻辑
- 不把 skill / MCP / tool 细节塞进前端 hook
- 不让 execution runtime 承接产品治理逻辑

## 当前实现映射

### Backend

- [backend/src/services/rtc-orchestration.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/rtc-orchestration.service.ts)
  当前控制面核心服务。负责：
  - `listGraphs`
  - `startSession`
  - `stopSession`
  - `pingSession`
  - mode 到 property overrides 的映射

- [backend/src/controllers/rtc.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/rtc.controller.ts)
  当前控制面 API 入口。负责：
  - `/health`
  - `/graphs`
  - `/session/start`
  - `/session/stop`
  - `/session/ping`

### Frontend

- [frontend/src/hooks/useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts)
  当前承担了部分 client-side control 角色：
  - 请求 backend start session
  - 管 LiveKit 会话连接生命周期
  - 做 transcript / feedback / profile sync 的事件路由

它现在是“控制面客户端”，但不应该继续膨胀成第二个控制面。

### Execution Plane

- [backend/src/services/livekit-session.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/livekit-session.service.ts)
- [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py)

当前执行面拓扑事实源已经切到 `self-hosted livekit-server + livekit_agent`。

## 建议的数据模型

后续控制面讨论尽量围绕下面几个对象，而不是围绕“某个 hook”或“某个按钮”展开：

### Session Intent

- `surface`
- `mode`
- `userId`
- `requestId`
- `channelName`
- `requestedCapabilities`
- `deviceContext`

### Session Runtime

- `roomName`
- `participantIdentity`
- `accessToken`
- `livekitUrl`
- `dispatchMetadata`
- `timeoutSeconds`
- `runtimeOverrides`

### Session State

- `created`
- `connecting`
- `active`
- `degraded`
- `ending`
- `stopped`
- `failed`

## 未来 App 接入时的控制面原则

以后做移动端或桌面端时，控制面要继续保持中枢角色。

### Web / PWA

- 适合训练工作台、页面态状态、可视化反馈

### Mobile App

- 适合麦克风权限、通知、轻训练、日常沟通触发

### Desktop / Local Companion

- 适合更强诊断、实验能力和本地节点控制

但无论哪个 surface 发起请求，都不应该绕过 backend 控制面直接决定 graph、token、mode 和 side effects。

## 当前主要风险

### 风险 1：前端 hook 继续长成第二个控制面

如果 `useRtcAgentSession` 继续承接：

- 模式治理
- 记忆写入决策
- 运行时能力边界
- 复杂状态恢复

那后面 web、mobile、desktop 会各长一份控制逻辑。

### 风险 2：execution runtime 承担过多产品治理

`livekit_agent` 应该优先负责执行态协调，而不是长期承接：

- 产品模式治理
- surface 策略
- 记忆落库决策
- capability discoverability

### 风险 3：缺少显式诊断与健康层

现在有 `/health` 和图列表，但还缺：

- provider health
- last smoke status
- 当前 mode/capability matrix
- 关键错误摘要

## 后续收口方向

### Phase 1

- 保持 backend `rtc-orchestration` 为控制面单一入口
- 前端只消费 session result，不扩展产品治理职责
- 用 [capability-registry.md](/home/ubuntu/VoxFlame-Agent/docs/capability-registry.md) 明确 mode 和 capability 的关系
- 把控制面文案和对象模型彻底收口到 LiveKit 现役事实：
  - 不再使用 `RTM token / graphName` 这类旧执行面词汇
  - session-local state 交给 `livekit_agent` 的 `session.userdata`
  - 低频共享状态交给 participant attributes

当前这一步已经补了一刀到现役代码：

- `rtc-orchestration` 现在会在 `workspace_snapshot_read` 可用且用户已认证时，读取 `workspace snapshot.preparation`
- 并把它作为 `preparation_context` 注入 participant metadata / dispatch metadata
- `livekit_agent` 再把这层 preparation 收进 `session.userdata`

### Phase 2

- 抽出更明确的 control-plane schema
- 增加 provider health / smoke / diagnostics 只读接口
- 让 `training` 和 `communication` 的差异更多在控制面定义，而不是散在 hook、prompt 和 `livekit_agent` 里

### Phase 3

- 为未来 mobile / desktop companion 预留统一会话启动协议
- 形成真正的 surface -> control plane -> execution plane 协议层

## 当前结论

`VoxFlame` 现在已经有控制面雏形，但还没有真正把它制度化。

接下来最重要的不是再多写一个 runtime，而是继续把：

- 会话生命周期
- mode 路由
- capability gating
- 诊断与健康

从零散实现，收口成清楚的控制面 contract。
