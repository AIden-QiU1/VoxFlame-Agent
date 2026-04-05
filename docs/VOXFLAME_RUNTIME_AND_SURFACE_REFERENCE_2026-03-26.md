# VoxFlame Runtime And Surface Reference（2026-03-26）

> 这份文档吸收并取代了以下几类仓库分析文档的核心结论：
> - `TEN_FRAMEWORK_CAPABILITY_CEILING_REPORT_2026-03-05.md`
> - `VOXFLAME_ARCHITECTURE_LESSONS_FROM_OPENCLAW_2026-03-23.md`
> - `VOXFLAME_FIVE_PLANE_ARCHITECTURE_AND_CURRENT_MAP_2026-03-23.md`
> - `VOXFLAME_AGORA_REPLACEMENT_RESEARCH_2026-03-23.md`
> - `light-voice-surface.md`
>
> 它不是新的 PRD，而是给 PRD 和工程决策提供 runtime / surface / 迁移边界的统一参考。
>
> 状态说明：
> - 这份文档仍是现役主参考，主体已经稳定，已进入最后工程收尾
> - `session intent / readiness / capability gating` 的基础 contract 已经进代码
> - 当前还在继续收尾的是：把剩余运行时实现继续从 hook 下沉，并只在必要时同步文档状态；`workspace owner` 与 legacy compat 清理已基本完成
> - `Agora/TEN -> LiveKit` 迁移已经完成主执行面切换；`ten_agent/` 目录已从仓库物理移除，文中出现的 TEN 路径仅用于历史复盘

## 1. 结论先行

当前最重要的 runtime 判断只有 6 条：

1. 现役唯一事实源已经是  
   `Frontend LiveKit RTC/Data -> Backend /api/rtc/session/* -> self-hosted livekit-server -> livekit_agent`
2. `TEN + Agora` 已经退役；现在继续保留的只是少量历史分析文档，而不是现役执行面。
3. 架构讨论统一按五层进行：`Control / Execution / Memory / Capability / Surface`。
4. 近期不要为了“更先进的 runtime”重写主链，先把控制面、上传链路、画像 contract 和页面任务流收稳。
5. 中期所有新能力都要逐步改用供应商无关语言：`session / transport / capability / session_strategy`。
6. `light voice surface` 要作为主执行面之外的轻入口策略存在，而不是第二套主产品。

当前关于 `Agora/TEN -> LiveKit` 的正式迁移顺序，见：

- [VOXFLAME_LIVEKIT_TRANSITION_PLAN_2026-03-31.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_LIVEKIT_TRANSITION_PLAN_2026-03-31.md)
- [VOXFLAME_LIVEKIT_REPLACEMENT_ROADMAP_2026-04-02.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_LIVEKIT_REPLACEMENT_ROADMAP_2026-04-02.md)

## 2. 五层架构怎么落到当前代码

### 2.1 Control Plane

当前 owner：

- [rtc-orchestration.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/rtc-orchestration.service.ts)
- [rtc.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/rtc.controller.ts)
- [index.ts](/home/ubuntu/VoxFlame-Agent/backend/src/index.ts)

当前职责：

- session 创建、停止、health、mode 路由
- runtime 配置注入
- `communication / training` 两类会话的启动边界

当前问题：

- 前端 [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 仍承担了过多 client-side orchestration
- `session_strategy` 还没有成为正式 contract

控制面至少还要明确负责：

- session lifecycle
- mode routing
- runtime property overrides
- diagnostics / health / provider status
- surface 与 capability 的准入边界

控制面不应该负责：

- 直接执行 ASR / TTS / correction
- 直接保存 dataset 样本事实
- 承接页面级文案、提示和交互判断
- 让 TEN 主控继续长成产品治理层

后续讨论尽量围绕 3 个对象，而不是围绕某个 hook：

- `Session Intent`
  - `surface`
  - `mode`
  - `session_strategy`
  - `scene`
  - `requested_capabilities`
  - `device_context`
- `Session Runtime`
  - `graph_name`
  - `timeout_seconds`
  - `property_overrides`
  - `transport credentials`
- `Session State`
  - `created`
  - `connecting`
  - `active`
  - `degraded`
  - `ending`
  - `stopped`
  - `failed`

当前最主要的控制面风险仍然是：

- 前端 hook 长成第二控制面
- TEN 主控继续吞产品治理
- provider health / mode-capability matrix / last smoke status 还没正式化

### 2.2 Execution Plane

当前 owner：

- [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py)
- [livekit_agent/asr_runtime.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/asr_runtime.py)
- [livekit_agent/tts_runtime.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/tts_runtime.py)
- [livekit_agent/assistant_runtime.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/assistant_runtime.py)

当前判断：

- 现役主链已经能支撑 P0/P1 的沟通与训练
- 近期更该继续补齐训练页、记忆页 AI parity，而不是重新引入第二套执行面
- `livekit_agent` 已承接 `vad / asr / correction / tts / training_feedback` 主链
- 当前剩余差距集中在更深的 `memory / session_review / preparation` 等价能力，而不是实时 transport

### 2.3 Memory Plane

当前 owner：

- frontend local cache / recorder queue
- backend durable `workspace / profile bundle / session review`
- TEN runtime working memory

关键原则：

- `dataset != memory`
- runtime working state 不能等于 durable profile
- 页面不再各自拼长期画像

### 2.4 Capability Plane

当前要收口成的对象：

- expression kit
- session review
- starter context
- training feedback
- upload receipt
- future device / tool / MCP capabilities

关键原则：

- 先定义 capability contract，再谈谁来调用
- 不让页面按钮或 prompt 文案直接成为能力定义方式

当前真正该制度化的产品运行时 capability 是下面这些，而不是仓库协作能力表：

| capability_id | owner | callers | side_effect_level | source_of_truth | status |
|---|---|---|---|---|---|
| `rtc_session_start` | backend control plane | web / pwa / future surface | `session_mutation` | [rtc-orchestration.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/rtc-orchestration.service.ts) | `active` |
| `rtc_session_ping` | backend control plane | connected clients | `session_mutation` | [rtc.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/rtc.controller.ts) | `active` |
| `rtc_session_stop` | backend control plane | web / pwa / future surface | `session_mutation` | [rtc.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/rtc.controller.ts) | `active` |
| `rtm_send_control_event` | frontend rtc client | active realtime session | `session_mutation` | [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) | `active` |
| `training_feedback_request` | TEN execution plane | training session runtime | `session_mutation` | [training_feedback_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/training_feedback_python/extension.py) | `active` |
| `workspace_snapshot_read` | backend memory services | communication / training / memory surfaces | `read_only` | [memory.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/memory.controller.ts) | `active` |
| `voice_profile_update` | training runtime + backend memory | training session runtime | `profile_mutation` | [training-profile.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/training/training-profile.ts) | `active` |
| `upload_artifact_persist` | backend upload services | training surface | `profile_mutation` | [upload-artifact.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/upload-artifact.service.ts) | `active` |
| `provider_health_check` | backend control plane | ops / future admin surface | `read_only` | planned | `planned` |

这些 capability 至少要说清 5 件事：

- 谁是 owner
- 谁能调用
- 运行在哪个 mode / surface
- 副作用等级是什么
- smoke / diagnostics 从哪里看

### 2.5 Surface Plane

当前 surface：

- 首页 `/`
- 沟通工作台 `/?mode=communicate`
- 练习工作台 `/contribute`
- 沟通档案 `/memory`
- PWA 作为现役可安装 surface

未来 surface：

- light voice surface
- mobile companion
- desktop companion

## 3. 为什么说 `TEN + Agora` 还是过渡执行面

不是因为它今天不能用，而是因为它把太多运行时语义绑在了供应商概念上：

- room/channel/token 语义
- worker join 方式
- transport/runtime 配置
- 前端 Agora SDK 心智
- TEN graph 与 vendor package 绑定

这决定了后续产品语言不能继续围绕：

- `channel_name`
- `rtc token / rtm token`
- `bot_uid / user_uid`

而应逐步改成：

- `session`
- `transport`
- `participant`
- `capability`
- `session_strategy`

同时也要避免另一个误判：

- LiveKit 迁移不是“只把 transport 从 Agora 换掉”
- 对 VoxFlame 来说，最终要替掉的是整层 realtime execution host
- 但删除 `TEN` 只能发生在 `LiveKit server + livekit_agent + DashScope-first capability parity` 真正跑通之后

## 3.1 迁移目的不是“换新”，而是“把 execution 变得可控”

这次迁移最该记住的不是供应商名，而是目标：

1. `RTC / RTM` 执行层自主可控
2. backend control plane 保持稳定
3. 允许 `agora_ten` 与 `livekit` 在同一 session contract 下并行验证
4. 只有 execution seam 稳定后，才继续大幅加深 memory / coach

所以不推荐：

- 直接重写一套新 runtime
- 一边迁移 execution，一边重做页面主路径
- 在 execution 仍不稳定时继续把 durable memory 深绑到现役执行面细节里

## 4. `light voice surface` 的正确位置

`light voice surface` 不是：

- 新主执行面
- Agora/TEN 替换方案
- 第二套 memory 系统
- 新的页面平级产品

它是：

- `Surface Plane` 的轻量入口
- `Control Plane` 可调度的一种 `session_strategy`
- 适合 quick talk / widget / mobile companion / 训练录制器

建议的正式语言：

```text
session_strategy =
  heavy_realtime | light_voice
```

- `heavy_realtime`
  用于实时沟通、可打断回合、训练反馈主链
- `light_voice`
  用于短句启动、quick talk、轻录制、轻代理和 future companion

## 5. PWA、App、轻入口之间的关系

当前判断：

- PWA 是现役 surface，不再只是实验配置
- PWA 能承担“安装感 + 更新快 + recorder queue + 轻离线体验”
- PWA 不能替代未来原生 App / companion 的后台音频、硬件接入、系统级权限和更稳的后台同步

因此：

- 近端优先把 PWA 做顺
- 原生 App 不必抢 P0
- 但 runtime / upload / profile contract 必须从现在就按 future multi-surface 复用来设计

## 6. 对 PRD 和多端产品规划真正有用的结论

PRD 和 future multi-surface 规划真正该长期引用这份文档的地方只有这些：

1. 为什么首页、沟通、训练、档案要围绕同一条主链组织
2. 为什么近期先稳 `control / upload / profile`，而不是重写 runtime
3. 为什么 `TEN + Agora` 要被写成“过渡执行面”
4. 为什么要引入 `session_strategy = heavy_realtime | light_voice`
5. 为什么 PWA 现在重要，但原生 App 仍然保留价值
6. 为什么 future mobile / desktop 的第一原则不是“各做各的入口”，而是共用同一套 `session / transport / capability` 语言

## 7. 文档治理判断

从当前代码和文档现状看，runtime 相关文档需要收口成明确分工：

1. 本文档
   - 继续作为 `runtime / surface / multi-surface planning` 的主参考
2. [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
   - 与本文档并行
   - 负责 memory / agent / tooling contract
3. [control-plane.md](/home/ubuntu/VoxFlame-Agent/docs/control-plane.md)
   - 保留
   - 但定位收紧为 backend 控制面实现、schema 与诊断深文档
4. [capability-registry.md](/home/ubuntu/VoxFlame-Agent/docs/capability-registry.md)
   - 不再承担产品主参考角色
   - 其中的产品运行时 capability 应逐步并回本文档或其附录
   - 其中的 repo engineering capabilities 应回到 `AGENTS.md` 与协作文档体系

换句话说：

- `control-plane` 适合做实施深文档
- `capability-registry` 适合做临时治理表
- 本文档才是 CEO / PM / Eng 共同对齐“多端 surface 到底沿哪条主链扩”的主入口
- 记忆与 agent 的长期边界则由 memory/tooling 参考文档并行负责

## 8. 为多端架构准备时，runtime 最先要成立的 contract

### 8.1 Session Intent

任何 surface 发起会话前，都应先被翻译成同一类对象：

- `surface`
- `mode`
- `session_strategy`
- `scene`
- `requested_capabilities`
- `device_context`

这决定了 future mobile / desktop companion 不该直接复制 web 里的页面逻辑，而应共享控制面语言。

### 8.2 Surface Readiness

未来 web / PWA / mobile / desktop 至少要有统一的 readiness 语言：

- 麦克风是否就绪
- 网络是否允许实时主链
- 是否允许后台同步 / 轻录制
- 当前应该走 `heavy_realtime` 还是 `light_voice`

目前这层还没有正式文档化，是接下来多端准备最值得补的一层。

补充现状：

- backend `/api/rtc/session/start` 已经会返回 `readiness / resolvedStrategy / grantedCapabilities`
- frontend runtime state 里也已经携带这组字段
- 当前真正缺的，不再是 schema 本身，而是把它变成各个 surface 都能看见、都按它决策的可见状态层

### 8.3 Capability Gating

future surface 不应该自己猜“这个入口能不能做这件事”，而应由控制面明确：

- 当前 surface 可请求哪些 capability
- 当前 mode 默认开放哪些 side effects
- 哪些能力需要登录、授权或显式确认

### 8.4 Shared Recorder / Upload Contract

任何新 surface 能不能接上主链，取决于它是否共用：

- `recording envelope`
- `upload receipt`
- `manifest`
- `review signals`

也就是说，dataset 链路不是独立问题，而是 runtime / surface 扩张的地基。

## 9. 当前最可行的推进顺序

1. 先继续稳数据录入与上传 contract 的最后验证
   - `recording envelope`
   - `recorder queue`
   - `upload receipt`
   - `manifest`
2. 继续把控制面 contract 写进真实 surface
   - `session intent / session_strategy / capability gating`
   - `surface readiness`
   - surface-visible runtime status
3. 与此同时并行推进 memory/tooling contract
   - `workspace`
   - `profile bundle`
   - `expression kit`
   - `session review`
4. 再把前端巨型 hook 继续变薄
5. 最后再评估下一代 execution plane 替换节奏

一句话总结：

`VoxFlame` 现在最需要的不是新的 runtime，而是更清楚的 runtime 语言、更明确的 surface contract，以及一条能和 memory/tooling、dataset 一起支撑多端产品的 control/upload/profile 主链。`
