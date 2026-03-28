# VoxFlame Runtime And Surface Reference（2026-03-26）

> 这份文档吸收并取代了以下几类仓库分析文档的核心结论：
> - `TEN_FRAMEWORK_CAPABILITY_CEILING_REPORT_2026-03-05.md`
> - `VOXFLAME_ARCHITECTURE_LESSONS_FROM_OPENCLAW_2026-03-23.md`
> - `VOXFLAME_FIVE_PLANE_ARCHITECTURE_AND_CURRENT_MAP_2026-03-23.md`
> - `VOXFLAME_AGORA_REPLACEMENT_RESEARCH_2026-03-23.md`
> - `light-voice-surface.md`
>
> 它不是新的 PRD，而是给 PRD 和工程决策提供 runtime / surface / 迁移边界的统一参考。

## 1. 结论先行

当前最重要的 runtime 判断只有 6 条：

1. 现役唯一事实源仍然是  
   `Frontend RTC/RTM -> Backend /api/rtc/session/* -> TEN rtc graph`
2. `TEN + Agora` 是现役执行面，但必须被视作过渡实现，而不是长期不可替代底座。
3. 架构讨论统一按五层进行：`Control / Execution / Memory / Capability / Surface`。
4. 近期不要为了“更先进的 runtime”重写主链，先把控制面、上传链路、画像 contract 和页面任务流收稳。
5. 中期所有新能力都要逐步改用供应商无关语言：`session / transport / capability / session_strategy`。
6. `light voice surface` 要作为主执行面之外的轻入口策略存在，而不是第二套主产品。

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

### 2.2 Execution Plane

当前 owner：

- [property.json](/home/ubuntu/VoxFlame-Agent/ten_agent/property.json)
- [voxflame_main_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/voxflame_main_python/extension.py)
- [qwen_asr_realtime_python](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/qwen_asr_realtime_python)
- [qwen_tts_realtime_python](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/qwen_tts_realtime_python)
- [llm_correction_python](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/llm_correction_python)

当前判断：

- 现役主链已经能支撑 P0/P1 的沟通与训练
- 近期更该停长产品语义，而不是继续把 governance、profile merge、表达策略塞回 TEN 主控

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
- 但 runtime / upload / profile contract 必须从现在就按 future app 复用来设计

## 6. 对 PRD 和开发计划真正有用的结论

PRD 应长期引用这份文档的地方只有这些：

1. 为什么首页、沟通、训练、档案要围绕同一条主链组织
2. 为什么近期先稳 `control / upload / profile`，而不是重写 runtime
3. 为什么 `TEN + Agora` 要被写成“过渡执行面”
4. 为什么要引入 `session_strategy = heavy_realtime | light_voice`
5. 为什么 PWA 现在重要，但原生 App 仍然保留价值

## 7. 当前最可行的推进顺序

1. 先继续稳数据录入与上传 contract
   - `recording envelope`
   - `recorder queue`
   - `upload receipt`
   - `manifest`
2. 继续收口 backend `workspace / profile bundle / session review`
3. 再把前端巨型 hook 变薄
4. 再给控制面补正式 `session_strategy`
5. 最后再评估下一代 execution plane 替换节奏

一句话总结：

`VoxFlame` 现在最需要的不是新的 runtime，而是更清楚的 runtime 语言和更稳的 surface / control / upload / profile contract。`
