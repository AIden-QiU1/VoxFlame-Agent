# VoxFlame Agent, Memory And Tooling Reference（2026-03-26）

> 这份文档吸收并取代了以下几类仓库研究文档的核心结论：
> - `VOXFLAME_MEMORY_MECHANISMS_RESEARCH_2026-03-24.md`
> - `voice-agent-tooling-architecture.md`
>
> 目标不是保留研究过程，而是把对 `openclaw / supermemory / memU / deerflow` 的判断翻成对 `VoxFlame` 真正可执行的 agent、memory、tooling 边界。

## 1. 结论先行

对 `VoxFlame` 来说，长期最重要的 6 个判断是：

1. 实时能力优先做成 typed runtime capabilities，而不是 prompt 技巧。
2. `tool`、`skill`、`workflow`、`MCP` 必须分层，不要混写。
3. 记忆不是一个“向量库桶”，而是 `本地事实源 + typed profile bundle + 可调用 context service` 的组合。
4. `dataset` 和 `memory` 必须持续分层：录音资产进 dataset，摘要与画像进 memory。
5. backend 应成为 durable profile / session review / expression kit 的 owner。
6. TEN runtime 只保留低延迟 working memory，不继续长成长期画像治理层。

## 2. Tool / Skill / Workflow / MCP 的边界

### 2.1 Tool

在 `VoxFlame` 里，tool 更适合指：

- expression kit 取用
- starter context 组装
- upload asset persistence
- training feedback emit
- session review read/write
- future device actions

原则：

- typed
- side effect 可审计
- 明确输入输出 schema
- 不把工具能力藏在 prompt 或页面胶水里

### 2.2 Skill

skill 更适合承载：

- 什么时候用哪类表达
- 什么时候该先补救、再继续说
- 训练页的提示逻辑
- 外环工程/研究 workflow

原则：

- skill 主要负责方法，不负责低延迟 runtime 执行

### 2.3 Workflow

workflow 更适合：

- 长任务研究
- 复杂报告生成
- 数据治理和异步整理
- 后续训练资产抽样、评测、导出

原则：

- workflow 不要侵入主实时回合

### 2.4 MCP

MCP 更适合：

- 跨系统接入
- 外部知识、issue、design、docs 等开发协作能力
- future companion / external tools / therapist console 对接

原则：

- MCP 是外部接入层，不是实时主循环的默认内核

## 3. Memory 的正确结构

### 3.1 L1 本地事实源

适合保存：

- 本地 recorder queue
- 本地草稿
- 本地最近沟通痕迹
- future companion 的本地 durable state

价值：

- 可审计
- 可导出
- 可离线
- 可人工修改

### 3.2 L2 Typed Profile Bundle

适合保存：

- hotword profiles
- confusion patterns
- recent wins
- communication preferences
- training focus
- session review summary
- expression kit merge inputs

当前最适合的 owner 是 backend。

### 3.3 L3 Context Service

适合做：

- 每次会话前按 scene 拉取 profile bundle
- 每次训练前补当前 focus / recent review
- future cross-device profile injection

原则：

- context service 不是事实源本身
- 它是把 durable profile 组装成可供 runtime 使用的 bundle

## 4. `dataset != memory`

这条规则对 `VoxFlame` 尤其重要。

应该进入 dataset 的：

- 原始录音
- `recording_id / session_id / audio_path`
- raw/final transcript
- manifest
- 评测和质检 artifact

应该进入 memory 的：

- 高频表达
- 热词与混淆模式
- session review
- 周期趋势
- 当前最值得记住的训练重点

不该直接进入长期 memory 的：

- 单句原始 transcript
- 原始音频路径
- 每句完整训练反馈文本

## 5. 当前代码里的 owner 建议

### Frontend

负责：

- local cache
- recorder queue
- optimistic UI
- current session reducer

不负责：

- durable profile merge
- 长期画像真相层
- runtime capability 的最终定义

### Backend

负责：

- `workspace`
- `profile bundle`
- `session review`
- `expression kit`
- upload receipt / manifest persistence

### TEN Runtime

负责：

- 低延迟 working state
- realtime turn handling
- training feedback emit
- correction / ASR / TTS loop

不负责：

- durable profile governance
- 产品级表达策略治理
- 页面级文案与交互判断

## 6. 对 PRD 和真正有用的产品真正有帮助的地方

PRD 和后续开发真正该引用这份文档的地方是：

1. 为什么 personalized phrase rail 要来自 typed `expression kit`，而不是页面自己拼
2. 为什么训练页、沟通页、沟通档案要共享同一份 `workspace`
3. 为什么 dataset / memory 必须分开
4. 为什么 backend 应拥有 durable `profile bundle / session review`
5. 为什么 future mobile / desktop companion 也应该沿同一套 memory/tooling 边界扩展
6. 为什么“产品真的有用”不只靠 runtime 通了，还要靠：
   - 当前该说什么
   - 最近哪类场景更常用
   - 哪些表达适合先给用户
   - 哪些训练结果值得沉淀成下一次准备

## 7. memory / agent 框架现在要推进到什么程度

对当前 `VoxFlame` 来说，memory / agent 框架不需要先做成“万能智能体平台”，但至少要做到下面 4 层：

1. durable workspace
   - `profile bundle`
   - `session review`
   - `expression kit`
   - `communication preferences`
2. write boundary
   - 哪些训练结果自动进画像
   - 哪些只保留为 dataset artifact
   - 哪些需要阈值、抽样或人工确认
3. runtime context service
   - 每次沟通前按 scene 取 bundle
   - 每次训练前按 focus 取 bundle
4. tool / workflow boundary
   - runtime tool 负责低延迟执行
   - workflow 负责复核、导出、异步整理

做到这一步，memory / agent 才足以支撑“真正有用的产品”；再往上做更复杂的自治 agent、多层 planner 或通用知识系统，都不该抢当前主线。

## 8. 当前最该继续做的下一步

1. 继续把 `workspace` 真正变成 backend owner 的 durable contract
2. 补清 `expression kit / session review / profile bundle` 的写入边界
3. 继续让前端只消费 `workspace` 和 upload receipt，而不是再长临时画像逻辑
4. 继续限制 TEN 主控的职责增长
5. 让 dataset -> profile summary 的沉淀路径更显式，而不是靠页面级胶水逻辑

一句话总结：

`VoxFlame` 的长期能力不该长成“一个万能 agent”，而应该长成“typed runtime capabilities + durable profile bundle + clear workflow boundary”的系统；而这套系统必须先服务一个真正有用的多端产品。`
