# VoxFlame Product And Expansion Plan（上线后规划版，2026-04-23）

> 前提：当前 Web 主产品已具备上线基线。
>
> 这份主文档只回答 5 件事：
> 1. 当前已固定的产品基线
> 2. App / companion 怎么接
> 3. 硬件怎么接
> 4. 自定义语音 agent 框架怎么演进
> 5. 记忆架构怎么长期收口

## 1. 产品定义

VoxFlame 不是“纠正用户声音”的产品，而是“帮助系统更准确理解构音障碍用户意图”的沟通工作台。

当前主文档的重点不再是“上线前还差什么”，而是上线后 4 条长期主线：

1. `App / companion`
2. `硬件接入`
3. `自定义语音 agent 框架`
4. `记忆架构`

## 2. 当前已固定的产品基线

默认成立，不再作为下一阶段主争论点：

1. 现役唯一主链：

```text
Frontend LiveKit RTC/Data
  -> Backend /api/rtc/session/*
  -> self-hosted livekit-server
  -> livekit_agent
  -> ASR / TTS / correction provider adapters
```

2. 当前正式产品闭环：
   - 沟通工作台
   - 练习工作台
   - 沟通档案 / workspace
3. `workspace snapshot` 是 durable owner，`LiveKit` 只承接 session-local runtime。
4. 训练数据最小 contract 是 `audio + target_text + optional labels`。
5. `dataset != memory` 继续是硬边界。
6. PWA 是正式产品面之一，但不等于未来原生 App。
7. 下一阶段默认是稳态扩展，不再重开第二套主链或第二套 demo。

## 3. 这份文档的职责

负责：

1. 定义当前产品边界。
2. 定义 4 条长期扩展主线。
3. 给后续 owner 和贡献者提供统一锚点。

不负责：

1. 维护上线前 blocker 清单。
2. 记录最近 3 天开发状态。
3. 代替 `.tasks/current.md` 管短期优先级。
4. 代替 runtime / memory 深参考承接历史迁移细节。

## 4. App / Companion 规划

目标：

1. 更稳定的后台录音与补传。
2. 更稳定的权限、蓝牙和系统入口。
3. 更低摩擦的快捷沟通入口。
4. 更适合高频日常沟通的 companion 形态。

接入时必须复用现役 contract：

1. `workspace snapshot`
2. `recording envelope`
3. `upload receipt`
4. `preparation_context_update`
5. `voice_contributions metadata`
6. `RTC session orchestration`

不应该做的事：

1. 再长第二套 durable owner。
2. 再长第二套训练样本 schema。
3. 绕开 backend 与 runtime 自己形成私有主链。

建议分层：

1. `PWA`
   - 安装、轻离线、录音补传、低摩擦入口
2. `mobile companion`
   - 后台同步、快捷短句、通知、设备权限
3. `desktop companion`
   - 固定工位、外接麦克风、外接扬声器、设备桥接

第一阶段最值得做：

1. 一键开口
2. 最近准备材料直达
3. 紧急求助模式
4. 原生 recorder queue 与后台补传
5. 登录态和 `workspace snapshot` 轻同步

## 5. 硬件规划

目标：

1. 提升收音质量
2. 降低控制负担
3. 提供更合适的输出形态
4. 让设备状态和环境质量可观测

推荐顺序：

1. `输入硬件`
   - 领夹麦、指向性麦克风、USB 声卡 / 外接麦、手机蓝牙麦
2. `控制硬件`
   - BLE 按钮、脚踏、一键重播 / 一键打断
3. `输出硬件`
   - 便携扬声器、骨传导耳机、外放设备
4. `环境感知`
   - 噪声监测、clipping / 输入音量、连接状态

必须保持 4 个接口清晰：

1. `capture control`
2. `transport bridge`
3. `device metadata`
4. `telemetry`

第一阶段最小原型：

1. BLE / USB 最小设备控制桥
2. 现成外设支持清单
3. 设备状态与收音质量面板
4. companion 与硬件之间的桥接协议

## 6. 自定义语音 Agent 框架规划

目标：

1. 可替换 provider
2. 可解释 runtime state
3. 可验证回归质量

下一阶段不直接重写 `livekit_agent`，按层继续收口：

1. `provider-neutral adapters`
2. `owned turn controller`
3. `context assembler`
4. `policy / capability router`
5. `session memory`
6. `durable maintenance`
7. `evaluation harness`

建议分层：

```text
transport/session layer
  -> audio turn controller
  -> ASR / TTS / correction adapters
  -> context assembler
  -> policy + capability router
  -> session memory
  -> durable memory maintenance
  -> dataset / evaluation pipeline
```

第一阶段最值得做：

1. 抽清 provider adapter
2. 把 turn state machine 收成显式状态机
3. 把 `context assembler` 做成独立可测层
4. 把沟通页 / 训练页策略显式化
5. 给 runtime 增加离线回放和回归集

不建议：

1. 一次性重写整套 runtime
2. 没有稳定评测前大改主执行链
3. 一上来做复杂多 agent / handoff
4. 先做通用工具平台化

## 7. 记忆架构规划

目标：

1. 收清长期 owner 和运行时 owner
2. 保持 runtime / dataset / durable memory 的边界
3. 让多端接入不再打散记忆体系

固定边界：

1. `backend workspace` 是 durable owner
2. `livekit_agent` 只拥有 session-local working memory
3. `dataset` 是录音资产、review、export 体系，不是长期记忆
4. 页面不再各自拼 durable profile

建议中的长期架构：

```text
surface state
  -> session intent
  -> session-local runtime memory
  -> backend workspace snapshot
  -> dataset / review / export layer
  -> future semantic recall layer (Qdrant)
  -> future coordination/cache layer (Redis only when necessary)
```

durable memory 继续只保留这些 owner：

1. `prepared_expression`
2. `hotword / scene templates`
3. `user_profile_memory`
4. `training reports`

不应直接进入 durable memory：

1. 原始 transcript 流水
2. 单条训练录音
3. review 未稳定的 heuristic
4. 临时 UI 状态
5. 新增的平级长期对象

中期最值得推进：

1. `typed session memory`
2. `context assembly`
3. `maintenance pipeline`
4. `dataset-safe recall`
5. `memory observability`

## 8. 推荐路线

建议顺序：

1. 继续把 Web 主链打磨到稳定可演示、稳定可部署
2. 先补 `evaluation + dataset tooling + observability`
3. 再做 `mobile companion` 最小试点
4. 再做 `硬件控制桥` 最小试点
5. 最后逐步把 `livekit_agent` 演进成更自主、provider-neutral 的语音 agent runtime

每一阶段都必须满足：

1. 不破坏现役 Web 主链
2. 不新增平级 durable owner
3. 不让 runtime / dataset / memory 再次混线
4. 每条新能力都能被 smoke、回放或回归集验证

## 9. 配套文档

短期执行状态：

- [../.tasks/current.md](../.tasks/current.md)

开源协作拆线：

- [VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md](VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md)

runtime / surface 深参考：

- [VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)

agent / memory 边界：

- [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)

录音、上传与训练资产 contract：

- [VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md](VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md)
