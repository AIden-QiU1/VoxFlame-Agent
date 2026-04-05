# VoxFlame LiveKit Communication Minimal Loop Plan（2026-04-02）

> 目标不是“先把所有 TEN 功能一次迁完”，而是先定义清楚：
> 在 VoxFlame 里，`communication workspace` 的 LiveKit 最小闭环到底要满足什么，
> 当前代码已经做到哪一步，还差什么。

## 1. 最小闭环的完成定义

对 VoxFlame 来说，`communication workspace` 的 LiveKit 最小闭环至少要满足 6 件事：

1. backend 能返回真实可用的 LiveKit room/token/dispatch metadata
2. frontend 能用 token 进 room
3. frontend 能把本地麦克风音频真正 publish 到 room
4. `livekit_agent` 能被 dispatch，接收到 session metadata，并加入同一个 room
5. `livekit_agent` 能给前端回一条最小可消费的响应
   - 可以先是文本/data event
   - 然后再到音频回复
6. 断开和资源回收是干净的

只满足 `1 + 2`，不能算 communication loop 跑通。

## 2. 当前代码现状

### 2.1 backend

已具备：

- [livekit-session.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/livekit-session.service.ts)
  - 生成 `participant token`
  - 生成 `participant metadata`
  - 生成 `participant attributes`
  - 生成 `agent dispatch metadata`
- [livekit-config.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/livekit-config.service.ts)
  - 能诊断 `LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET`
  - 能明确区分 `501` 和 `503`

判断：

- backend 控制面已经达到 communication minimal loop 的第 1 步
- 这层不是当前最主要 blocker

### 2.2 frontend transport

当前 [livekit-transport.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/livekit-transport.ts) 已做到：

1. `Room.prepareConnection()`
2. `room.connect()`
3. `room.localParticipant.publishData(...)`
4. `RoomEvent.DataReceived`
5. 远端音轨订阅后的播放

当前进展更新（2026-04-02）：

- LiveKit 本地麦克风 publish 的第一刀已经落地到
  [session-audio.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/realtime-audio/session-audio.ts)
- 现有录音动作已不再把“麦克风轨”写死成 Agora 类型，而是通过统一的
  `SessionMicrophoneTrack` 同时承接 Agora 与 LiveKit 本地音轨
- 这一刀已经通过前端 runtime tests 和 `npm run build`

当前还没做到的关键项是：

1. frontend 与 `livekit_agent` 的正式 room data control contract
2. `livekit_agent` 发回前端现有 reducer 可直接消费的最小 assistant event
3. 真实 LiveKit communication smoke

所以现在 frontend 只能算：

- `room/data connected + local microphone publish wired`

不能算：

- `live voice communication connected`

### 2.3 livekit_agent

当前 [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py) 已做到：

1. `AgentServer`
2. `@rtc_session(agent_name=...)`
3. `ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)`
4. `wait_for_participant()`
5. 解析 participant metadata + dispatch metadata
6. 启动一个最小 `AgentSession`

但当前仍明显是 stub：

1. 当前已不再依赖 `openai.realtime.RealtimeModel()`；communication text rewrite 已切到 DashScope OpenAI-compatible `/chat/completions`
2. 没有显式 `vad / stt / tts` 组合
3. 没有接现役 `DashScope / Qwen-first` provider
4. 没有 training feedback / memory/tooling bridge
5. 没有定义和 frontend 对齐的 room data control contract

所以它现在能算：

- LiveKit worker skeleton

还不能算：

- VoxFlame communication runtime replacement

## 3. 当前最真实的 blocker 排序

按“哪一步最先挡住我们继续推进”排序，当前 blocker 已经更新为：

1. `worker registration` 已不再是 blocker，真实根因已经确认是 shell 代理污染
2. 当前最小 communication loop 已跑通，但只覆盖了 `text/data` 路径，还没有覆盖 `audio reply`
3. `livekit_agent` 当前已经具备 `DashScope / Qwen-first` 的 communication text rewrite，但还没有迁入现役 `vad / asr / correction / tts / training feedback / memory tooling`
4. 所以当前一号任务已经从“修 LiveKit 基座”切到“把现役 TEN 能力逐项迁入 LiveKit”

这轮真实验证后的状态判断：

- `frontend -> backend -> livekit room` 已经稳定返回 `session/start -> 200 -> 页面显示已连接`
- `livekit_agent` 现在能被 dispatch、成功加入同一 room、并通过 room data 回前端最小 assistant transcript
- 同一条链已经在 Docker 里的 `livekit-agent` service 上复测通过，不再依赖手工本地 worker

所以现在最不该做的事是：

- 再回头怀疑 LiveKit 基座能不能注册 worker
- 先删 TEN
- 先在不清能力边界的情况下横向迁 training/memory 全部逻辑

## 4. 下一刀最值得做什么

### Step A：先把 LiveKit worker registration 基座打穿

目标：

- 让官方最小 worker 和 VoxFlame `livekit_agent` 都能稳定注册到本地 self-hosted LiveKit server

当前事实：

1. 这轮已经把 `livekit-server:v1.9.8` 作为开发基座固定下来
2. 真正根因不是 server 版本，而是 shell 的 `HTTP_PROXY / HTTPS_PROXY / ALL_PROXY`
3. `livekit-agents` worker 默认会继承这些 env，导致本地 `/agent` 注册和 job 子进程 `ctx.connect()` 都被错误代理
4. 当前 [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py) 已在连接 `127.0.0.1 / localhost / livekit-server` 时主动清理这些代理 env，并继续保留 `AgentServer(http_proxy=None)`
5. [docker-compose.yml](/home/ubuntu/VoxFlame-Agent/docker-compose.yml) 里的 `livekit-agent` 也已显式设置 `NO_PROXY=127.0.0.1,localhost,livekit-server`

完成标志：

- `registered worker`
- `assigned job to worker`
- `agent participant active`

当前状态：

- 已完成
- 现在不需要再把 worker registration 当成主 blocker

### Step B：定义最小 room data control contract

目标：

- 用 LiveKit room data 先替掉最小 RTM control 语义

第一版只需要 3 类消息：

1. `session_init_ack`
2. `user_text_input`
3. `assistant_text_output`

第二版再补：

4. `speech_started`
5. `speech_stopped`
6. `interrupt`
7. `end_audio`

完成标志：

- frontend 能收到 `livekit_agent` 发回的一条结构化文本响应

当前状态（2026-04-02）：

- 第一版最小 contract 已落地到 [livekit_agent/data_contract.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/data_contract.py)
- [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py) 现在会：
  - 在 room ready 后主动发 `session_init_ack`
  - 监听 room data 的 `user_input`
  - 回发一条符合前端现有 reducer 形状的 `assistant transcript`
- 这层先走 data contract，不先把 OpenAI realtime、语音回复和 training 事件一起搅进来

### Step C：让 livekit_agent 回一条最小可消费响应

目标：

- 先别追求完整语音回路
- 先让 `livekit_agent` 回一条前端能消化的结构化响应

建议方式：

1. 先通过 room data 发结构化 JSON
2. 字段尽量对齐现有 `RtcMessageEnvelope`
3. 第一条只要求能进入现有消息列表和状态 reducer

完成标志：

- 页面里出现一条来自 LiveKit 路径的 assistant message

当前状态：

- 第一版已在 worker 端实现
- 真实浏览器 + self-hosted LiveKit + Docker `livekit-agent` 的 smoke 已确认：
  - 页面能进入 `已连接`
  - 用户文字消息能进入会话列表
  - `assistant transcript` 能回到页面现有 reducer/UI

### Step D：再补音频回复

目标：

- 在文本最小 loop 稳定后，再把音频回复接通

原因：

- 先跑通结构化控制和消息 contract，能显著降低调试复杂度
- 否则会同时卡在音频轨、模型、打断、消息归并 4 个问题上

## 5. 和官方最佳实践怎么对齐

`references/agents/README.md` 和 LiveKit 官方心智对我们最有用的不是“照抄 example”，而是下面 4 条：

1. `AgentServer + AgentSession` 是 runtime host 基座
2. `dispatch + metadata` 是连接 control plane 和 worker 的标准方式
3. `VAD / STT / LLM / TTS` 应该是可组合组件，而不是绑死在 graph 私有协议里
4. 应该先建立可重复的测试和 session-level smoke，再删旧执行面

对 VoxFlame 来说，这 4 条在当前阶段落地成：

1. backend 继续是唯一 control plane
2. LiveKit room data 先接最小 control contract
3. `livekit_agent` 先跑 communication minimal loop
4. 再逐项迁 `DashScope-first` 语音能力

## 6. 这一阶段不做什么

1. 不提前做 training feedback 迁移
2. 不提前做 memory deepening
3. 不提前删 `ten_agent`
4. 不把 OpenAI stub 误写成现役 DashScope 替代方案

## 7. 下一轮代码实施建议

按最小风险排序，建议下一轮先做：

1. 修 `livekit-server` 开发基座，直到官方最小 worker 能注册
2. 再让 VoxFlame `livekit_agent` 注册成功
3. 然后回到 frontend/livekit_agent 最小 room data message contract smoke
4. 最后才继续音频回复和更深迁移

做到这里，才能说：

- LiveKit communication minimal loop 第一次真正跑通了

## 8. 相关参考

- [VOXFLAME_LIVEKIT_REPLACEMENT_ROADMAP_2026-04-02.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_LIVEKIT_REPLACEMENT_ROADMAP_2026-04-02.md)
- [VOXFLAME_LIVEKIT_TRANSITION_PLAN_2026-03-31.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_LIVEKIT_TRANSITION_PLAN_2026-03-31.md)
- [references/agents/README.md](/home/ubuntu/VoxFlame-Agent/references/agents/README.md)
- LiveKit Agent sessions:
  https://docs.livekit.io/agents/build/sessions
- LiveKit self-hosting:
  https://docs.livekit.io/transport/self-hosting/
