# VoxFlame LiveKit Transition Plan（2026-03-31）

> 目的不是“换个更新的框架”，而是把 `RTC / RTM execution layer` 逐步从 `Agora + TEN` 过渡到更自主可控的 `LiveKit-based runtime`，同时保持现有产品主链稳定可用。
>
> 状态说明（2026-04-02）：
> - 这份文档继续保留为“迁移原则与顺序”文档
> - 当前最准确的现状盘点、缺口矩阵和三节点路线，见
>   [VOXFLAME_LIVEKIT_REPLACEMENT_ROADMAP_2026-04-02.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_LIVEKIT_REPLACEMENT_ROADMAP_2026-04-02.md)
> - 当前还不能把 `livekit_agent` 表述成“已经可替代 `TEN + Agora`”

## 1. 迁移目的

这次迁移只服务两个目标：

1. `RTC / RTM` 执行层逐步转向自主可控，降低对声网 API 的强绑定。
2. 为后续更深的 `memory / coach / light voice surface` 铺一层更干净的 execution adapter，而不是把这些能力继续长在 `Agora SDK + TEN graph` 细节上。

换句话说：

- 这次先换的是 `Execution Plane`
- 不是现在就重做 `Control Plane`
- 更不是先重做 `Memory Plane`

当前默认判断保持不变：

- `workspace owner`
- `dataset schema`
- `session intent / readiness / capability gating`

这些 contract 都先不动。

## 2. 为什么是 LiveKit

按 LiveKit 官方文档，它的核心对象是：

- `Room`
- `Participant`
- `Track`
- `Data`

它天然适合把我们当前的：

- `session`
- `participant`
- `transport_send_control`
- `audio track`

收进同一套 realtime 心智，而不是继续分裂成：

- Agora `RTC channel`
- Agora `RTM channel`
- TEN worker / graph join

对 VoxFlame 最关键的是两点：

1. `Room / Participant / Track / Data` 这套模型更适合我们已经建立起来的 vendor-neutral contract。
2. LiveKit 允许 self-host transport，也有 Agents worker / job 模型，便于后续把现役执行面从“第三方 SDK 心智”收成“我们自己的控制面 + 可替换执行面”。

官方参考：

- LiveKit rooms / participants / tracks:
  https://docs.livekit.io/intro/basics/rooms-participants-tracks
- LiveKit connect / room model:
  https://docs.livekit.io/intro/basics/connect
- LiveKit transport overview:
  https://docs.livekit.io/transport
- LiveKit Agents build / dispatch / job:
  https://docs.livekit.io/agents/build
  https://docs.livekit.io/agents/server/agent-dispatch
  https://docs.livekit.io/agents/server/job

## 3. 当前不动什么

为了让过渡干净，中间态必须明确“哪些先不动”：

1. backend `/api/rtc/session/*`
   - 继续作为唯一控制面事实源
2. frontend `surface / session intent / session readiness`
   - 继续沿用当前 contract
3. `workspace owner`
   - 继续承担 durable profile / expression / review owner
4. `dataset`
   - 继续作为独立链路，不绑到 execution backend 迁移里
5. 用户页面和主路径
   - 沟通、训练、记忆三页不因为迁移而重做 UI

这次迁移的基本原则是：

- `control plane 保持稳定`
- `execution adapter 渐进替换`
- `memory 等执行层稳定后再加深`

## 4. 分阶段迁移

### Phase A：先做 execution backend seam

目标：

- 在 backend / frontend contract 中正式引入 `executionBackend`
- 默认仍走 `agora_ten`
- `livekit` 作为显式 opt-in 实验路径

当前已落地：

- backend `StartRtcSessionInput / RtcStartSessionResult`
- backend `/api/rtc/session/start` 接受 `executionBackend`
- frontend `StartRtcSessionResponse.executionBackend`
- frontend `session-execution.ts` 作为统一 execution adapter

收口标准：

- 默认流量完全不变
- 显式请求 `livekit` 时，得到清晰失败而不是静默走偏

### Phase B：引入 LiveKit transport adapter

目标：

- 保留 backend control plane 不变
- 在 frontend runtime 下新增 `livekit transport adapter`
- 先只覆盖 `communication workspace`

这一阶段替换的模块：

1. [agora-transport.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/agora-transport.ts)
   - 不删除，先与 `livekit-transport.ts` 并存
2. [session-execution.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-execution.ts)
   - 从“硬编码 Agora wrapper”升级成真正的 backend-selected adapter
3. backend `rtc-orchestration.service`
   - 新增 `livekit_realtime` 准备逻辑与 token/config 注入

当前已前进到：

- backend 已能通过官方 `livekit-server-sdk` 生成 `participant token + metadata + attributes + agent dispatch metadata`
- frontend 已有受保护的 `livekit transport adapter` seam，但还没完成 communication 全链路 smoke
- 下一阶段不再是“定义字段”，而是把 communication minimal loop 真接起来

此时还不动：

- TEN graph
- 训练 feedback 主链
- dataset 上传链

### Phase C：LiveKit 与 TEN 并行

目标：

- 让 `communication workspace` 先出现两条可验证执行链：
  - `agora_ten`
  - `livekit`

这阶段不是“切流量”，而是“可对照双跑”。

推荐方式：

1. backend control plane 继续返回同一份 `intent / readiness / grantedCapabilities`
2. 只有 `executionBackend` 改变
3. `agora_ten` 继续是默认
4. `livekit` 只通过显式环境变量、实验页面入口或测试脚本启用

### Phase D：评估 TEN 是否继续保留

要先回答两个问题：

1. LiveKit 只替 transport，就已经足够吗？
2. TEN graph 继续作为 agent execution runtime，是否仍然拖住调试、扩展和记忆系统接入？

只有在 `communication workspace` 的 LiveKit 版稳定后，才决定：

- 保留 TEN 一段时间
- 或继续向 `LiveKit Agents / custom worker` 迁移

## 5. 并行测试怎么做

在开始真实并行测试前，先保持一个清晰判断：

- `节点 1：LiveKit 服务基座` 已完成第一版开发态
- `节点 2：替代现役 TEN 功能并跑通全链路` 仍未完成
- `节点 3：删除 TEN + Agora` 现在还不能开始

也就是说，下面这些验证标准是为了推进“功能等价替代”，不是为了证明“已经替代完成”。

迁移期间，测试标准分三层。

### 5.1 静态与单测

每次改 execution seam，至少要过：

- `cd backend && npm run build`
- `cd frontend && npm test`
- `cd frontend && npm run build`

单测当前至少覆盖：

- `session-runtime`
- `session-actions`
- `session-audio`
- `session-execution`

其中 `session-execution` 的价值很直接：

- 默认不影响现役 Agora/TEN
- 显式 `livekit` 时会早失败、可诊断

### 5.2 控制面 contract smoke

在 LiveKit transport 真正接入前，先验证控制面：

1. `GET /api/rtc/health`
   - 能看到 `supportedExecutionBackends`
   - 默认 `defaultExecutionBackend=agora_ten`
   - 能看到 `executionBackendStatus.agora_ten/livekit`
2. `POST /api/rtc/session/start` 不传 `executionBackend`
   - 正常走现役路径
3. `POST /api/rtc/session/start` 传 `executionBackend=livekit`
   - 如果 `RTC_ENABLE_LIVEKIT_EXPERIMENT` 没开，应返回明确 `501`
   - 如果开了实验流量但缺 `LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET`，应返回明确 `503` 并提示缺少哪些 env
   - 如果 env 完整，则应返回真实 `room / participant token / metadata / dispatch`，而不是再假装“尚未接线”

这一步的目的不是“LiveKit 能连”，而是证明：

- 迁移 seam 已成立
- 默认流量不受影响
- 实验流量不会误入现网主链

### 5.2.1 当前实验环境变量

进入真正的 LiveKit transport 接入前，先统一约定这几个变量：

- `RTC_ENABLE_LIVEKIT_EXPERIMENT=1`
- `LIVEKIT_URL=wss://...`
- `LIVEKIT_API_KEY=...`
- `LIVEKIT_API_SECRET=...`
- `LIVEKIT_AGENT_NAME=voxflame-agent`（可选，给后续 agent dispatch 留入口）

这样做的目的不是立刻切流量，而是：

- 让 backend 能明确报告“是否已具备并行测试条件”
- 让 `agora_ten` 继续稳态 serving
- 让 `livekit` 只在显式实验时暴露出来

### 5.2.2 为什么 self-host 了还需要这些变量

`self-host LiveKit` 的目标是：

- 我们自己拥有 WebRTC / room / data plane
- 不再依赖 Agora/TEN 的托管执行面
- 后续把 agent runtime、training、memory 继续沉到自己的基础设施上

但这不等于“浏览器和 agent 不再需要知道连哪里”。

即使完全是我们自己部署的 LiveKit，也仍然需要：

1. `LIVEKIT_URL`
   - 告诉浏览器和 worker 去连哪台我们自己的 LiveKit server
2. `LIVEKIT_API_KEY / LIVEKIT_API_SECRET`
   - backend 需要它给 participant 签 token，也需要它做 agent dispatch
   - 这是我们自己的 server key，不是第三方 SaaS 凭据
3. `LIVEKIT_AGENT_NAME`
   - 这是我们给 worker 约定的 dispatch 名称，用来让 backend 把某个 room 派发给正确的 agent

也就是说，LiveKit 带来的不是“没有 env”，而是：

- 从“依赖外部托管执行面”变成“只依赖我们自己的部署地址和密钥”
- 从“厂商私有 RTC/RTM 语义”变成“标准化的 room / participant / data / dispatch 语义”

### 5.2.3 自部署路线

#### 本地开发

1. 本机先起 `livekit-server --dev`
2. backend 通过 `LIVEKIT_API_KEY / SECRET` 给浏览器签 participant token
3. `livekit_agent` 作为 worker 向同一台 LiveKit server 注册
4. frontend 用 LiveKit SDK 进 room 做 communication smoke

仓库内的第一版开发基座应固定成：

- `docker-compose.yml` 里的 `livekit-server`
- [infra/livekit/livekit.dev.yaml](/home/ubuntu/VoxFlame-Agent/infra/livekit/livekit.dev.yaml)

也就是说，后续继续开发前，优先先起：

```bash
sudo docker compose up -d livekit-server
```

#### 预发环境

1. 自己部署一套 LiveKit server
2. 配好域名、TLS、WebRTC/TURN 端口
3. backend 和 `livekit_agent` 都指向这套预发 LiveKit
4. 只让 `communication workspace` 先切实验流量

#### 正式替换

1. `livekit_agent` 接管 communication 主链
2. 再迁 `training feedback / correction / memory tooling`
3. 默认 execution backend 切到 LiveKit
4. 最后清退 Agora/TEN 旧代码和容器

这里的关键约束要写实：

- 当前 `livekit_agent` 已经能跑通 communication text rewrite，但还没有达到现役 `TEN` 执行面的功能等价
- 当前现役模型路径仍以 `DashScope / Qwen-first` 为准
- 在 `vad / asr / tts / correction / training feedback / memory tooling` 逐项补齐前，不能把“正式替换”写成近在眼前

### 5.3 并行运行 smoke

当 `livekit transport adapter` 落地后，至少要做 4 组对照：

1. 沟通连接
   - `agora_ten` 能连
   - `livekit` 也能连
2. 文字输入
   - 两边都能发送控制消息并收到 agent 响应
3. 麦克风与远端音频
   - 两边都能完成 `publish / subscribe / playback`
4. 断开与回收
   - 两边都能 stop cleanly，不残留 ghost session

推荐对照维度：

- `session/start` 成功率
- 首次 agent 音频返回时间
- 文字/音频双通道是否都可用
- 中断和断开是否稳定
- 控制台和容器日志是否有持续错误

### 5.4 切流门槛

只有在下面都满足后，才进入清旧代码：

1. `communication workspace` 的 LiveKit 路径达到与现役主链同等可用
2. 至少完成一轮 Docker + Playwright + 真实登录 smoke
3. 关键日志不再依赖 Agora/RTM 私有诊断心智
4. backend control plane 能稳定地区分和诊断两种 execution backend

## 6. 什么时候再正式加深记忆系统

先不要把更深的记忆系统继续长在当前 `Agora + TEN` 细节上。

正式恢复 `memory / coach / expression kit deepening` 的时机是：

1. LiveKit 迁移至少完成 `communication workspace` 对照验证
2. execution adapter 稳定，不再频繁变更 session lifecycle
3. backend control plane 能稳定承接 provider diagnostics / execution selection

也就是：

- `先稳 execution`
- `再深 memory`

## 7. 最后怎么清旧代码

旧代码不能“迁移着迁移着就一直留着”。

建议的清理顺序：

1. 先停止新增 Agora/TEN 相关逻辑
2. LiveKit 达标后，先清前端 Agora transport 直接依赖
3. 再清 backend 里只服务 Agora/TEN 的 token / channel 概念
4. 最后才清 TEN rtc graph 与相关 compose 依赖

当前还要再补一个退出门槛：

5. `DashScope-first` 的 production path 已在 LiveKit 路径下被正式接通，不再只是 OpenAI fallback stub

清理门槛必须是：

- 新链路已跑通
- 默认流量已切换
- smoke 已重新建立
- compat 退出条件已满足

否则不要提前删。
