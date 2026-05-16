# Founder Collaboration Loop（2026-03-25）

> 这份文档定义 `VoxFlame` 当前的人机协作方式：怎么继续开发、怎么同步架构判断、怎么把研究沉淀成你能快速掌握的材料。

## 1. 目标

这套协作不是为了“让 agent 多做一点”，而是为了让我们两个人都更快进入同一个判断。

要同时做到：

1. 功能继续稳定推进
2. 关键技术路线你能越来越看懂
3. 产品判断不只停留在聊天里
4. 经验可以累积、自动同步、持续清理

## 2. 默认协作节奏

### 2.1 开发主线

1. 先基于代码现状和一手用户事实判断下一刀
2. 先做最小可运行切片
3. 做完就验证
4. 再把结论同步到 `PRD / current / summary`

### 2.2 技术学习主线

当我完成一轮较深的技术研究后，默认不只给你“结论”，还要补一份简短的阅读入口。

默认格式：

1. 一本最值得读的经典书或系统资料
2. 两到三篇最关键的官方文档
3. 一个最值得跟读的开源仓库
4. 一段“为什么现在读它”说明

目标不是让你一次读完，而是让你把握当前架构演进的主干。

### 2.3 产品讨论主线

当产品判断出现分叉时，默认按这 4 个问题一起讨论：

1. 它解决的是哪个真实瞬间？
2. 它会不会增加用户的社交压力？
3. 它会不会破坏当前主链路？
4. 它是否值得占用当前阶段的前 20% 资源？

## 3. 我负责的输出

### 3.1 研究后给你的“短阅读”

后续涉及以下主题时，我默认补技术阅读推荐：

1. realtime / RTC / transport
2. control plane / backend contract
3. memory / agent / tools
4. dataset / recorder / training feedback
5. frontend workspace / interaction architecture

### 3.2 研发过程中的“短结论”

每完成一轮关键探索，我默认给你：

1. 一个短结论
2. 为什么这么判断
3. 还剩什么风险
4. 你现在最值得补看的 1 到 3 个材料

## 4. 你负责的输入

你不需要把问题整理得很“标准”。

最有价值的是这几类输入：

1. 你最近一次真实沟通失败或成功的场景
2. 你觉得某个页面“别扭”的直觉反馈
3. 你对一个功能的优先级判断
4. 你最近看到的好产品、好硬件、好交互

如果你给的是原始材料，我负责把它翻成：

`场景任务 -> 产品约束 -> 技术切片 -> 文档更新`

## 5. 当前推荐的技术阅读组织方式

后续我会按这 4 条主线给你推荐材料：

### A. 产品与页面

- 你需要知道页面为什么这样分：`首页 -> 沟通工作台 -> 练习工作台 -> 沟通档案`
- 重点是任务入口、认知负担、可信度和用户主导权

### B. 控制面与后端

- 你需要知道为什么长期 contract 要逐步收口到 backend
- 重点是 `session / profile bundle / session review / expression kit`

### C. 执行面与 realtime

- 你需要知道为什么现役执行面已经收口成 `Frontend -> Backend -> self-hosted LiveKit -> livekit_agent`
- 重点是：
  - 前端负责产品交互、会话前准备和用户可见控制
  - backend 负责 durable contract、workspace owner 和数据边界
  - LiveKit 负责 realtime transport
  - `livekit_agent` 负责 session-local intelligence，而不是长期 owner

### D. 记忆与 agent

- 你需要知道为什么 `memory != dataset`
- 重点是 `frontend local fallback / backend durable workspace / livekit_agent working memory`

## 5.1 当前更推荐的学习顺序

如果你要真正把这套架构看懂，建议按这个顺序读和学：

1. 先看产品主链路
   - 为什么页面是 `首页 -> 沟通工作台 -> 训练工作台 -> 沟通档案`
   - 先知道每个页面各自解决什么真实瞬间
2. 再看 backend contract
   - 为什么 `workspace` 是 durable owner
   - 为什么 `dataset != memory`
   - 为什么很多“产品真相”最后都要收进 backend snapshot
3. 再看 realtime 执行面
   - 为什么前端不能直接承担长期记忆
   - 为什么 LiveKit 适合承载 transport / room / data channel
   - 为什么 `assistant_runtime.py` 是 session / context / correction 的运行时核心
4. 最后再看模型与 compaction
   - 哪些模型负责低时延纠错
   - 哪些模型负责总结 / 计划 / 压缩
   - 为什么 durable write 必须晚于 realtime correctness

## 5.2 本轮最值得读：从需求到应用架构

这轮已经把“面对一个需求，如何自己判断前端、后端、agent、数据和验证怎么建”沉淀成一份长期学习入口：

- [VoxFlame Full-stack Architecture Learning Guide（2026-04-29）](VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md)

它重点回答：

1. 如何把一个需求拆成 `真实场景 -> surface -> 状态生命周期 -> owner -> contract -> flow -> failure -> verification`
2. 为什么 `Frontend / Backend / LiveKit / livekit_agent / dataset` 不能互相抢 owner
3. 为什么应用架构首先是事实源和数据流判断，不只是组件、接口和模型调用
4. 该按什么顺序补 React、Next.js、Express、Supabase、LiveKit、MDN、service layer、BFF 等基础材料

## 5.3 本轮最值得读：App / Mobile Workbench 从机会到技术路线

当前 Web/PWA 已经基本具备稳定演示和录音补传基础，可以开始完整移动端工作台研发。这里的“一步到位”指产品信息架构、owner、contract 和技术路线一步到位；工程交付仍按可验证切片推进，不能用一次性重写破坏现役 Web / PWA 主链。

- [VoxFlame App / Mobile Workbench Best Practices And Opportunity（2026-05-04）](VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)

它重点回答：

1. 为什么现在可以开始完整移动端工作台，而不是继续停留在 Web/PWA。
2. 为什么主线应改成 `Expo / React Native + LiveKit React Native`。
3. 为什么 `Capacitor` 只适合 WebView 原型或过渡，不作为长期工作台主线。
4. `沟通 / 练习 / 记忆与准备 / 设备与同步` 四个一级 surface 如何围绕同一套 contract 展开。
5. `workspace snapshot / recording envelope / upload receipt / RTC session orchestration` 如何继续作为 App 的事实源。
6. iOS / Android 麦克风、后台任务、录音权限、Supabase mobile auth、LiveKit audio session 这些官方约束会怎样影响产品承诺。
7. 哪些技术方向需要你作为创始人把控，而不是让 agent 自动替你决定。

这轮你最值得先掌握：

1. `Expo / React Native` 更适合长期完整移动端工作台，因为它能正面处理 native audio session、文件系统、权限、LiveKit mobile 和后续硬件桥接。
2. `Capacitor` 是 native plugin bridge，不是自动把所有 Next.js 服务端能力变成原生 App；它可以保留为原型或过渡方案。
3. 移动端“后台录音 / 自动补传 / 麦克风常驻”都有系统级限制，产品文案不能承诺过满。
4. App 第一版的信息架构应覆盖完整工作台：沟通、练习、记忆与准备、设备与同步。
5. 硬件先做 App 承接的 BLE / USB / 外接麦桥接，不要先做硬件优先项目。

## 5.4 当前 App 开发现状与下一刀

当前 `apps/mobile-workbench` 已经不是概念壳子，而是进入“本地原生能力接入后，等待真机验证与上传链路打通”的阶段。

已完成的开发切片：

1. `Expo / React Native` skeleton 已落在 [apps/mobile-workbench](../apps/mobile-workbench)。
2. 四个一级 surface 已固定：`communication / practice / memory / device`。
3. Supabase React Native auth adapter 已接入，session storage 走 `AsyncStorage`，`SecureStore` 只保存 last email 这类提示信息。
4. 真实账号 backend smoke 已跑通：`Supabase Auth -> backend auth middleware -> workspace snapshot`。
5. App 已能只读展示 `workspace snapshot` 中的 active prepared expression、quick phrases 和 daily target。
6. Native recorder queue 已接入 `expo-audio / expo-file-system`，支持权限、录音、持久本地文件、recording envelope、本地 queue、回放、待补传标记和丢弃。
7. Native recorder queue 已接入现有 `/api/upload/sign` 和 `/api/upload/complete`，上传成功后会把 `uploadReceipt` 写回本地 queue item。
8. Communication surface 已能通过 backend `/api/rtc/session/start` 请求 quick talk session，并展示 room/readiness；participant token 不渲染。
9. LiveKit React Native 最小 room 连接代码已接入：`registerGlobals`、`AudioSession.startAudioSession`、room connect、麦克风发布和断开清理。

当前尚未完成的关键验证：

1. Android 真机录音 smoke。
2. iPhone 真机录音 smoke。
3. 断网队列 UI smoke。
4. 真实设备 upload receipt smoke 与 retry 去重细化。
5. App 与 Web 同读同一份 active prepared expression 的人工确认。
6. LiveKit quick talk：真机进入 room，并处理断网 / 中断 / 切后台状态。

因此下一刀建议不是先做硬件，也不是先做复杂移动端编辑，而是按下面顺序继续 App：

1. 先做 Android / iPhone 真机录音 smoke。
2. 再做真实设备 upload receipt smoke 和 retry 去重细化。
3. 再确认 Web / App 同读同一份 active prepared expression。
4. 再做 LiveKit React Native 真机 room smoke、断网 / 中断 / 切后台 UI。
5. 最后再接 BLE / USB / 外接麦事件。

这一轮你需要把控的不是每个 React Native API，而是 4 个产品承诺：

1. App 录音是否足够显式，用户能不能知道“正在录 / 已保存在本地 / 已上传 / 可删除”。
2. 本地未上传录音保存多久，用户能不能手动删除。
3. 移动端是否只表达“沟通辅助 / 训练记录”，不表达医学康复结论。
4. 硬件事件是否永远先进 App，再由 App 可见地映射到录音、回放、中断或上传。

## 5.5 本轮最值得读：硬件桥接不要抢 App 主线

这轮已经把硬件方向收成“App 承接的辅助入口”，而不是“先造一台完整硬件终端”：

- [VoxFlame Hardware Bridge Development Guide（2026-05-05）](VOXFLAME_HARDWARE_BRIDGE_DEVELOPMENT_GUIDE_2026-05-05.md)

它重点回答：

1. 为什么第一阶段不让 ESP32 直接承接 LiveKit 实时语音。
2. 为什么 ESP32-S3 第一版更适合做 BLE 控制桥。
3. 为什么 I2S 麦克风录音上传原型先服务训练样本，而不是实时沟通。
4. 应该买哪些开发板、按钮、I2S 麦克风和可选外设。
5. BLE GATT 协议、App 接入、LiveKit 边界、上传链路和验收清单怎么定义。

你现在只需要把控一个判断：硬件是 App 的外设入口，不是 App 的替代品。手机 App 继续承担登录、权限、LiveKit audio session、upload receipt、隐私状态和用户可见控制。

## 6. 文档沉淀规则

为了减少信息散落，默认按下面沉淀：

1. 长期产品判断进 `PRD`
2. 最近任务进 `.tasks/current.md`
3. 最近必须知道的状态进 `.claude-summary.md`
4. 专门方法论进 `docs/`

如果我给你的技术阅读建议会持续复用，就继续写进这类专门文档，而不是只留在聊天里。

## 7. 当前约定

从这份文档开始，后续当我做较深的技术研究或产品研究时，会默认补一个新的小节：

1. `本轮最值得读`
2. `为什么现在读`
3. `读完后你应该掌握什么`

这样你可以逐步建立对 `VoxFlame` 架构演进的全局把握，而不是每次都从零进入上下文。

## 8. 技术把控与学习点持续更新约定

如果后续开发中出现你不太熟悉、但会影响产品路线或长期架构的技术点，我默认不只在聊天里解释，而是把它同步沉淀到合适文档。

进入文档的触发条件：

1. 会影响产品承诺边界，例如后台录音、隐私、医疗表述、硬件能力。
2. 会影响长期技术路线，例如 `Expo / React Native`、`Capacitor fallback`、`LiveKit mobile SDK`、`Supabase mobile auth`、`BLE / USB bridge`。
3. 会影响用户信任或合规，例如 App Store 隐私说明、录音授权、训练数据删除。
4. 你明确说“这个技术栈我不太懂”或“这个方向我需要把控”。

默认沉淀格式：

1. `你需要把控什么`
2. `为什么现在要懂`
3. `不懂会带来什么风险`
4. `推荐先读哪 1 到 3 个官方资料`
5. `VoxFlame 当前采用什么默认判断`

当前已进入这个机制的主题：

1. App / Mobile Workbench 技术路线与移动端权限边界。
2. Expo / React Native 主线与 Capacitor fallback 的分工。
3. Supabase mobile auth 与本地 session 存储。
4. LiveKit React Native audio session 与 backend token orchestration。
5. 后续硬件桥接的 BLE / USB / 外接麦边界。
6. Native recorder queue、upload receipt、retry 去重与本地录音删除边界。
7. ESP32-S3 硬件控制桥与 App 主线的优先级关系。
