# VoxFlame LiveKit Replacement Roadmap（2026-04-02）

> 这份文档回答 4 个问题：
> 1. 当前 LiveKit 迁移现状到底是什么
> 2. 它和 `references/agents` 最佳实践差多少
> 3. 它离“替代 `TEN + Agora`”还差哪些功能
> 4. 最好的逐步替代顺序是什么

## 1. 结论先行

当前状态不能表述成“已经可以替代 `TEN + Agora`”。

更准确的结论是：

1. `LiveKit server` 本地开发基座已经落下第一版。
2. backend `control plane` 已经能生成真实的 LiveKit session material。
3. frontend 已经有受保护的 LiveKit transport seam。
4. `livekit_agent` 目前已具备基于 DashScope 的 communication text rewrite，但仍不是现役功能等价替代。
5. 现役 `TEN graph` 仍然是唯一真正跑通 `vad + asr + correction + tts + training feedback + memory layer` 的执行面。

因此现在的正确任务顺序不是：

- 立刻删 `TEN`
- 立刻宣布 LiveKit 可替代

而是：

1. 先把 `LiveKit server` 开发/预发部署基座固化。
2. 再把 `livekit_agent` 补齐到现役 TEN 主链能力。
3. 跑通 communication 全链路并行 smoke。
4. 再迁 training / memory tooling。
5. 最后才删 `TEN + Agora` 旧代码。

## 2. 现役执行面到底包含什么

按 [ten_agent/property.json](/home/ubuntu/VoxFlame-Agent/ten_agent/property.json)，当前现役主链不是一个简单的“说话 worker”，而是：

1. `agora_rtc`
2. `agora_rtm`
3. `voxflame_vad_python`
4. `qwen_asr_realtime_python`
5. `voxflame_main_python`
6. `llm_correction_python`
7. `qwen_tts_realtime_python`
8. `training_feedback_python`
9. `memory_layer_python`

这意味着“替代 `TEN + Agora`”的真实含义是替代下面 3 组东西：

### 2.1 Transport

- RTC 音频上行/下行
- RTM 控制消息
- participant / room lifecycle

### 2.2 Runtime orchestration

- VAD turn boundary
- ASR
- LLM correction
- TTS
- interrupt / flush / session init

### 2.3 Product events

- training feedback request / response
- clarity / transcript / profile update
- memory/tooling 接口对接

## 3. 当前 LiveKit 迁移已经做到什么

### 3.1 已完成的部分

1. 仓库内已经有正式的 LiveKit 开发基座
   - [docker-compose.yml](/home/ubuntu/VoxFlame-Agent/docker-compose.yml)
   - [infra/livekit/livekit.dev.yaml](/home/ubuntu/VoxFlame-Agent/infra/livekit/livekit.dev.yaml)

2. backend 已支持 `executionBackend=livekit`
   - [livekit-session.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/livekit-session.service.ts)
   - [rtc-orchestration.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/rtc-orchestration.service.ts)

3. frontend 已有 LiveKit execution seam
   - [session-execution.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-execution.ts)
   - [livekit-transport.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/livekit-transport.ts)

4. 主仓库里已经有自己的 `livekit_agent`
   - [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py)
   - [livekit_agent/session_context.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/session_context.py)
   - [livekit_agent/agent_factory.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/agent_factory.py)

5. 第一批最小验证已经存在
   - backend build / tests
   - frontend build / tests
   - `livekit_agent` pure logic tests
   - Playwright 真实 smoke 已经证明：
     - LiveKit `session/start` 可以走到 `200`
     - 页面可以进入 `已连接`
     - 但 dispatch 后仍拿不到可用 worker

### 3.2 还没有完成的部分

1. 本地 self-hosted `livekit-server` 还没有成为一个对 Agents worker 可靠可注册的开发基座
2. `livekit_agent` 还没有接上真正的 `vad / stt / tts / correction`
3. 还没有把 training feedback 事件迁进 LiveKit runtime
4. 还没有把 memory/tooling 接口迁进 LiveKit runtime
5. 还没有完成 communication workspace 的 LiveKit 真实全链路 smoke
6. 还没有达到“可移除 TEN + Agora”的门槛

## 4. 和 `references/agents` 最佳实践相比差在哪里

`references/agents/README.md` 明确强调的核心能力有：

1. `AgentServer`
2. `AgentSession`
3. 可组合的 `VAD / STT / LLM / TTS / Realtime API`
4. `dispatch APIs`
5. 数据 API / RPC
6. built-in test framework
7. self-hosted full stack

当前 VoxFlame 的 LiveKit 迁移只对齐了其中一部分：

| 能力 | 当前状态 | 备注 |
|---|---|---|
| `AgentServer + rtc_session` | 已对齐 | [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py) |
| dispatch metadata 恢复 session intent | 已对齐第一版 | [session_context.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/session_context.py) |
| self-host dev server | 已对齐第一版 | `compose` 内已有 `livekit-server` |
| built-in tests 思路 | 只做了最小 pure logic | 还没做 session-level E2E |
| VAD/STT/TTS/LLM 组合 | 未对齐 | 目前还是 stub |
| product event parity | 未对齐 | training/memory 未迁 |
| room data / control event parity | 未对齐 | 仍未替代当前 RTM 语义 |

所以当前最准确的评价是：

- 我们已经开始按 LiveKit 官方心智搭建
- 但离 `references/agents` 展示的完整 voice-agent best practice 还有明显距离
- 当前一号差距已经不是 app contract，而是 `self-hosted server -> worker registration` 基座还不稳定

## 5. DashScope-first 约束必须写清楚

现役 TEN 链当前是 `DashScope / Qwen-first`：

- `DASHSCOPE_API_KEY`
- `qwen3-asr-flash-realtime`
- `qwen3-tts-flash-realtime`
- DashScope compatible-mode correction / feedback model

这意味着 LiveKit 迁移不是“随便先接个通用 LLM provider 跑通就算完成”。

当前 [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py) 已经具备：

- `LiveKit worker skeleton`
- `DashScope/Qwen communication rewrite loop`

不能算：

- `DashScope-first production replacement`

因此当前迁移必须明确两层目标：

### 5.1 短期目标

先跑通 LiveKit communication minimal loop：

- room join
- participant token
- dispatch
- 文本/音频最小闭环

### 5.2 中期目标

把现役 DashScope/Qwen 路径迁进 LiveKit：

- VAD
- Qwen ASR realtime
- correction
- Qwen TTS realtime
- training feedback

只有这层补上后，LiveKit 才开始接近真实替代 TEN。

## 6. 三节点路线图

### 节点 1：部署好 LiveKit 服务

目标：

- 让 LiveKit 变成正式开发基座，而不是临时实验服务

当前状态：

- 已完成第一版 dev 基座
- 还未完成 production-grade 部署方案
- 并且这轮真实验证已经暴露：当前 compose 内 `livekit-server` 虽然能服务浏览器 participant 建房，但还不能稳定接受官方 Agents worker 注册

完成标准：

1. 本地 `docker compose up -d livekit-server` 稳定可复现
2. 官方最小 worker 能稳定打印 `registered worker`
3. backend/frontend/livekit_agent 都默认知道怎么接这台服务
4. 预发部署拓扑已经写清：域名、TLS、TURN、worker owner

### 节点 2：补齐现役 agent 执行链功能并跑通全链路

目标：

- 让 LiveKit 路径覆盖现役 TEN 主链的核心产品能力

必须逐项补齐：

1. `VAD`
2. `ASR`
3. `LLM correction`
4. `TTS`
5. `training feedback`
6. `memory/tooling bridge`
7. `session init / interrupt / flush / control event`

测试门槛：

1. backend contract smoke
2. frontend communication smoke
3. livekit worker session-level smoke
4. Docker smoke
5. Playwright 登录态 smoke
6. 和现役 `agora_ten` 的对照 smoke

### 节点 3：完全移除 TEN 相关代码

这一步必须最后做。

只有下面都满足后才能动刀：

1. communication LiveKit 路径达到现役等价
2. training 关键事件不退化
3. memory/tooling 关键接口不退化
4. 默认流量已切到 LiveKit
5. 新 smoke 已完整接管

清理顺序建议：

1. 停止新增 Agora/TEN 逻辑
2. 切默认 execution backend
3. 删除前端 Agora transport 直接依赖
4. 删除 backend 中 Agora/TEN 私有 transport 语义
5. 删除 `ten_agent/` 与 compose 中旧执行面依赖

## 7. 最好的逐步开发顺序

### Phase A：把 LiveKit 基座写稳

1. 固化 `compose` 内 LiveKit server
2. 用官方最小 worker 验证 worker registration
3. 统一 env 语义
4. 补 backend diagnostics
5. 跑控制面 smoke

### Phase B：先跑 communication minimal loop

1. frontend 通过 LiveKit 进 room
2. `livekit_agent` 收到 dispatch/session metadata
3. 完成文字或最小音频回路
4. 和现役 `agora_ten` 并行验证

### Phase C：逐项迁移 TEN 功能

顺序建议：

1. control event parity
2. VAD
3. ASR
4. correction
5. TTS
6. training feedback
7. memory/tooling bridge

### Phase D：再恢复更深的 memory 系统开发

原因很简单：

- 现在 memory 如果继续深绑在现役 `TEN + Agora` 细节上，之后还要再拆一次
- 先把 execution host 收敛，memory 才能长在稳定 contract 上

## 8. 现在最该做什么

按投入产出比，下一阶段最重要的不是“继续删旧代码”，而是：

1. 把 `livekit_agent` 从 stub 补到最小可跑 communication worker
2. 先把现役 `RTM control` 语义迁成 LiveKit room data/event contract
3. 补第一轮真实并行 smoke
4. 逐项建立 `TEN feature -> LiveKit replacement` 对照表并实施

现在最不该做的是：

1. 提前删除 `ten_agent`
2. 把 OpenAI stub 误写成 DashScope-ready 现役方案
3. 在 execution 仍不稳定时先大做 memory 深化

## 9. 相关参考

- [VOXFLAME_LIVEKIT_TRANSITION_PLAN_2026-03-31.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_LIVEKIT_TRANSITION_PLAN_2026-03-31.md)
- [VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)
- [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)
- [references/agents/README.md](/home/ubuntu/VoxFlame-Agent/references/agents/README.md)
- [ten_agent/property.json](/home/ubuntu/VoxFlame-Agent/ten_agent/property.json)
- LiveKit AgentSession:
  https://docs.livekit.io/agents/build/sessions
- LiveKit self-hosting overview:
  https://docs.livekit.io/transport/self-hosting/
- LiveKit production deployment:
  https://docs.livekit.io/home/self-hosting/deployment/
- LiveKit self-hosted agent deployments:
  https://docs.livekit.io/deploy/custom/deployments/
- LiveKit testing framework:
  https://docs.livekit.io/agents/start/testing/
- Alibaba Cloud Model Studio OpenAI-compatible chat:
  https://www.alibabacloud.com/help/doc-detail/3016807.html
