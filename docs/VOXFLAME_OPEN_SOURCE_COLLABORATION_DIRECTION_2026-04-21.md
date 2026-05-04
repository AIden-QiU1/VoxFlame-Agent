# VoxFlame 开源协作方向（2026-04-21）

> 这份文档回答 4 个问题：
> 1. 仓库准备开源后，什么已经稳定，不需要再重复争论
> 2. 贡献者应该优先往哪些方向协作
> 3. App / 硬件应该怎么接，不和主链打架
> 4. 自主语音 agent 架构应该怎么演进，而不是一上来整套重写

---

## 1. 当前稳定基线

开源后的协作默认建立在这条主链上：

```text
Frontend LiveKit RTC/Data
  -> Backend /api/rtc/session/*
  -> self-hosted livekit-server
  -> livekit_agent
  -> ASR / TTS / correction provider adapters
```

这几件事已经固定，不再作为开源初期的主争论点：

1. `workspace` 是 durable owner，`LiveKit` 只承接 session-local runtime。
2. 沟通、训练、记忆已经是同一产品闭环，不再拆成互相平行的小 demo。
3. 训练样本的最小 contract 已收成 `audio + target_text + optional labels`。
4. PWA 是当前正式产品面之一，但不等于未来原生 App。
5. 开源初期优先做可验证的稳定演进，不做“推翻现有主链的大迁移”。

---

## 2. 开源协作主线

### 2.1 主线 A：产品稳态与真实可用性

这是最适合当前贡献者直接进入的方向。

目标：

1. 继续提升陌生人沟通成功率。
2. 继续降低训练页录音、上传、总结的摩擦。
3. 继续把记忆页收成真正有用的沟通准备区。

适合的贡献：

1. 前端页面与交互收口。
2. 训练录音、上传、回执和补传稳定性。
3. 沟通页实时 transcript / TTS / correction 体验。
4. 训练总结、评估区和标签链的可解释性。
5. QA、可观测性、Docker/部署验证。

### 2.2 主线 B：App / Mobile Workbench 接入

原则不是“为了有 App 而有 App”，而是把移动端做成高频沟通、练习、准备、补传和设备管理的完整工作台，并让 Web 之外的入口复用同一套 contract。

推荐顺序：

1. `PWA`
   继续承担安装、基础离线、录音补传、低摩擦入口。
2. `Mobile workbench`
   适合承接 `沟通 / 练习 / 记忆与准备 / 设备与同步` 四个一级 surface，以及原生录音、LiveKit mobile、通知、设备权限和系统级入口。
3. `Desktop companion`
   适合承接固定工作场景、外接麦克风、外接扬声器、硬件桥接。

App 接入时，不要新造第二套业务协议，优先复用：

1. `workspace snapshot`
2. `recording envelope`
3. `upload receipt`
4. `preparation_context_update`
5. `voice_contributions metadata`

当前 App / Mobile Workbench 的更细技术路线与官方约束见 [VoxFlame App / Mobile Workbench Best Practices And Opportunity（2026-05-04）](VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)。默认主线推荐 `Expo / React Native + LiveKit React Native`；`Capacitor` 只保留为 WebView 原型或过渡方案。

推荐的开源切题：

1. `Expo / React Native` 版录音与上传 bridge。
2. 原生后台同步与 recorder queue 落盘。
3. 登录态与 `workspace snapshot` 的移动端同步。
4. App 侧辅助入口：
   - 一键开口
   - 快捷短句
   - 最近沟通准备
   - 紧急求助模式

### 2.3 主线 C：硬件接入

硬件方向不应该直接把仓库带成“硬件优先项目”，而应该先做可插拔接入层。

优先级建议：

1. `输入硬件`
   - 领夹麦 / 指向性麦克风
   - USB 声卡 / 外接麦克风
   - 手机蓝牙麦
2. `控制硬件`
   - 一键开始录音
   - 一键重播 / 一键中断
   - BLE 脚踏 / 按钮
3. `输出硬件`
   - 骨传导耳机
   - 便携扬声器
   - 面向陌生人沟通的外放设备
4. `环境感知`
   - 场景噪声监测
   - 收音质量监测
   - 设备连接状态监测

硬件接入时，仓库最好保持这 4 个接口清晰：

1. `capture control`
   设备如何开始/停止录音。
2. `transport bridge`
   设备数据如何进入现有 RTC / upload 链。
3. `device metadata`
   样本是否记录设备类型、麦克风位置、采样能力。
4. `telemetry`
   如何记录 clipping、输入音量、连接状态。

开源初期最值得做的不是自研整机，而是：

1. 明确支持哪些现成外设。
2. 定义 BLE / USB companion 协议。
3. 做一个最小“设备控制桥”原型。

### 2.4 主线 D：自主语音 agent 架构

这条线应该做，但不该以“一次性重写 livekit_agent”为前提。

更稳的演进顺序是：

1. `provider-neutral runtime`
   先把 ASR / TTS / correction 的 provider adapter 再抽清楚。
2. `owned turn controller`
   把 barge-in、VAD、commit、finalize、interrupt 继续收成 VoxFlame 自己的 turn state machine。
3. `context assembler`
   把 session intent、workspace preparation、runtime memory、training labels 收成独立可测试层。
4. `policy / capability layer`
   把“训练页如何处理 transcript”“沟通页何时允许 correction / TTS”写成显式策略，而不是散在入口里。
5. `memory maintenance pipeline`
   把会后小幅维护、训练总结、画像更新真正变成独立后台链。
6. `evaluation harness`
   补上沟通页和训练页的离线评测、回放、回归集。

建议中的自主语音 agent 分层：

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

这条线的核心不是“摆脱某个模型名”，而是获得 3 种能力：

1. 可替换 provider
2. 可解释 runtime state
3. 可验证回归质量

---

## 3. 开源后最适合拆给贡献者的模块

### 3.1 适合 `good first issue`

1. 训练语料清洗与简繁统一。
2. 首页 / 手册 / 记忆页文案与视觉一致性。
3. 训练页上传回执、状态文案和错误提示。
4. 训练总结与评估区的小型前后端修正。

### 3.2 适合中等深度贡献

1. recorder queue 可观测性和断网补传。
2. `useRtcAgentSession` / `useMandarinTrainingSession` 继续拆薄。
3. `workspace snapshot` 与 preparation contract 的 typed read model。
4. 训练数据导出、评测脚本与数据检查工具。

### 3.3 适合长期 owner

1. 移动端工作台。
2. 硬件桥接层。
3. livekit_agent runtime 重构。
4. 个体化语音模型训练与评测。

---

## 4. 开源协作建议

### 4.1 issue 分类建议

建议开源时预设这些标签：

1. `surface:communication`
2. `surface:training`
3. `surface:memory`
4. `area:frontend`
5. `area:backend`
6. `area:livekit-agent`
7. `area:dataset`
8. `area:mobile-workbench`
9. `area:hardware`
10. `area:eval`
11. `good-first-issue`
12. `needs-rfc`

### 4.2 RFC 适用范围

这些改动建议先 RFC 再做：

1. 新 transport 主链
2. 新 durable memory owner
3. 新原生 App 主技术栈
4. 新硬件协议
5. 自主 agent state machine 大改

### 4.3 不建议的开源协作方向

1. 一上来重写整套 runtime。
2. 一上来加多 agent / handoff。
3. 在没有真实用户验证前先做大而全硬件。
4. 为了“看起来像 AI 产品”新增与主沟通链无关的能力。

---

## 5. 下一阶段推荐路线

如果按开源后 8-12 周来排，建议顺序是：

1. 先继续把 Web 主链打磨到可稳定演示、可稳定部署。
2. 再补 `evaluation + dataset tooling`，让外部贡献者知道怎么验证好坏。
3. 再开 `App / Mobile Workbench` Phase 0 / Phase 1 试点。
4. 再做 `硬件控制桥` 最小试点。
5. 最后逐步把 `livekit_agent` 演进成更自主、provider-neutral 的语音 agent runtime。

---

## 6. 这份文档和其他入口的关系

1. [README](../README.md)
   面向仓库访问者，讲“项目是什么、现在能跑什么、怎么参与”。
2. [产品 PRD](VOXFLAME_PRODUCT_PRD_2026-03-24.md)
   继续定义产品边界、agent 上下文和 memory/write 原则。
3. [当前任务状态](../.tasks/current.md)
   继续描述最近 3 天有效结论和实际开发优先级。
4. 本文档
   专门回答“开源后往哪协作、怎么拆主线、哪些方向值得投长期 owner”。 
