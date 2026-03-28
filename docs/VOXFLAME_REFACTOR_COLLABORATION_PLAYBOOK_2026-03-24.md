# VoxFlame Refactor Collaboration Playbook

## 为什么写这份手册

接下来 `VoxFlame` 会进入更明显的重构阶段。

这时候最容易出问题的，不是“不会写代码”，而是：

- 在错误的目录下协作
- 研究和实现混在一起
- 参考仓库越看越多，但没有明确回收到 `VoxFlame`
- skill 装了一堆，却没有形成稳定 workflow

这份手册的目标就是把这些问题先收口，让后续协作更像一个稳定系统，而不是每次重新发明流程。

## 一句话结论

- `研究` 默认在 `/home/ubuntu`
- `开发` 默认在 [VoxFlame-Agent](/home/ubuntu/VoxFlame-Agent)
- `参考仓库` 是材料库，不是主战场
- `gstack` 负责流程，`superpowers` 负责工程纪律，设计专项 skill 负责前端质量

## 一、到底在哪个目录下指挥开发

## 推荐做法

真正写 `VoxFlame` 代码、改架构、跑验证时，默认在：
[VoxFlame-Agent](/home/ubuntu/VoxFlame-Agent)

而不是长期停在：
`/home/ubuntu`

## 原因

### 1. `VoxFlame-Agent` 是实现主战场

这里有：

- 真正要改的代码
- 真正要跑的验证
- 真正要维护的文档
- 真正要收口的入口文件

如果开发时长期站在 `/home/ubuntu`，上下文会很容易被这些仓库冲淡：

- [explore](/home/ubuntu/explore)
- [openclaw](/home/ubuntu/openclaw)
- [openclaw-voice](/home/ubuntu/openclaw-voice)
- [agents](/home/ubuntu/agents)
- [vixio](/home/ubuntu/vixio)
- [ququ](/home/ubuntu/ququ)
- [vocotype-cli](/home/ubuntu/vocotype-cli)

### 2. 在仓库根里更容易保持“只改该改的东西”

在 [VoxFlame-Agent](/home/ubuntu/VoxFlame-Agent) 里协作时：

- 验证范围更清楚
- 改动面更容易约束
- 不容易把参考仓库误当成本仓库去修
- `AGENTS.md / .claude-summary.md / .tasks/current.md` 的入口作用更强

### 3. 研究和实现分开，脑子更清楚

最稳的模式是：

- 在 `/home/ubuntu` 层看全局材料和参考仓库
- 回到 [VoxFlame-Agent](/home/ubuntu/VoxFlame-Agent) 做实现和验证

一句话说：

`/home/ubuntu` 是研究桌面，`/home/ubuntu/VoxFlame-Agent` 是施工现场。

## 二、在 `VoxFlame` 里开发时，还能方便查参考仓库吗

可以，而且这正是推荐模式。

我在 [VoxFlame-Agent](/home/ubuntu/VoxFlame-Agent) 下开发时，仍然可以随时跨仓库读取这些参考仓库：

- [openclaw](/home/ubuntu/openclaw)
- [openclaw-voice](/home/ubuntu/openclaw-voice)
- [agents](/home/ubuntu/agents)
- [vixio](/home/ubuntu/vixio)
- [ququ](/home/ubuntu/ququ)
- [vocotype-cli](/home/ubuntu/vocotype-cli)
- [gstack](/home/ubuntu/gstack)

所以最推荐的协作句式是：

- `在 VoxFlame 里做，但参考 openclaw-voice 的 voice adapter`
- `在 VoxFlame 里改训练录音，但参考 vocotype-cli 的 dataset recorder`
- `在 VoxFlame 里做 app 草图，但参考 EVA 的 onboarding 个体化`

这会让我自动把“实现主场”和“参考来源”分开。

## 三、我会不会自动去查参考仓库

会，但有边界。

### 我会自动去查的情况

- 你明确提到某个仓库名
- 当前任务明显和已有研究结论相关
- 我判断某个参考仓库能显著降低猜错概率
- 当前是架构、adapter、训练数据、voice surface 这类已经有参照系的任务

### 我不会默认无限扩散搜索的情况

- 只是一个局部 bug
- 当前任务和参考仓库关联很弱
- 查询参考仓库会拖慢主路径，但不增加多少价值

### 最稳的说法

如果你希望我明确借某个仓库的方法，最好直接说：

- `参考 ququ`
- `按 openclaw-voice 的思路`
- `借 agents 的 session/runtime 抽象`

这样我会更稳定地走你想要的参照系。

## 四、skill 体系怎么用最顺

## 先记住一句话

`gstack` 负责工作流，`superpowers` 负责工程纪律，设计专项 skill 负责前端质量。

### A. `gstack` 最适合做什么

`gstack` 最强的不是单个工具，而是整条研发流程：

- 想法梳理
- 方案评审
- 设计评审
- 实现前 review
- QA
- ship / docs / retro

它更像你的“流程操作系统”。

### B. `superpowers` 最适合做什么

这几类最值钱：

- `systematic-debugging`
- `test-driven-development`
- `verification-before-completion`
- `subagent-driven-development`

它们更像“工程行为约束”，帮我们在实现阶段不跑偏。

### C. 设计专项 skill 最适合做什么

- `frontend-design`
- `baseline-ui`
- `fixing-accessibility`
- `fixing-motion-performance`

它们不是替代产品设计，而是让前端实现不那么容易掉进 AI slop。

## 五、按阶段怎么用 skill

## 1. 方向和产品定义阶段

适合的 skill：

- `gstack-office-hours`
- `gstack-plan-ceo-review`

适合的问题：

- 这个功能值不值得做
- 最窄切口是什么
- 我们是不是想得太小了
- 有没有更好的产品表面

推荐指令：

- `先用 gstack-office-hours 帮我想清楚这个方向`
- `用 gstack-plan-ceo-review 评一下这个功能是不是太保守`

## 2. 方案和架构阶段

适合的 skill：

- `gstack-plan-eng-review`
- `gstack-plan-design-review`
- 必要时 `gstack-autoplan`

适合的问题：

- 架构边界对不对
- 数据流是不是清楚
- mode / capability / memory / surface 有没有混
- 设计方案有没有明显问题

推荐指令：

- `先用 gstack-plan-eng-review 过一下这次重构方案`
- `用 gstack-plan-design-review 看下这个页面和交互方案`
- `把这份计划走一遍 gstack-autoplan`

## 3. 开发和调试阶段

适合的 skill：

- `test-driven-development`
- `systematic-debugging`
- `subagent-driven-development`

适合的问题：

- 做功能前先锁行为
- 遇到 bug 不要先拍脑袋修
- 一次有多个独立子任务时并行推进

推荐指令：

- `按 test-driven-development 来做这个功能`
- `先用 systematic-debugging 查根因，再修这个 bug`
- `这个重构可以按 subagent-driven-development 拆开做`

## 4. 前端实现阶段

适合的 skill：

- `frontend-design`
- `baseline-ui`
- `fixing-accessibility`
- `fixing-motion-performance`
- `gstack-design-consultation`
- `gstack-design-review`

适合的问题：

- 做新页面
- 做新组件
- 打磨视觉和交互
- 做无障碍和性能修正

推荐指令：

- `这个页面按 frontend-design 做`
- `做完后用 baseline-ui + fixing-accessibility 过一遍`
- `最后再跑一次 gstack-design-review`

## 5. 提交前验收阶段

适合的 skill：

- `gstack-review`
- `gstack-qa`
- `verification-before-completion`

适合的问题：

- 差异是否安全
- 页面有没有明显 bug
- 我们是不是在没验证前就宣布完成

推荐指令：

- `先用 gstack-review 看我的 diff`
- `再用 gstack-qa 做一轮验收`
- `最后按 verification-before-completion 收尾`

## 6. 发版和收尾阶段

适合的 skill：

- `gstack-document-release`
- `gstack-ship`

适合的问题：

- 文档是否同步
- changelog / version / PR 是否收好

推荐指令：

- `用 gstack-document-release 同步文档`
- `这轮准备好了，用 gstack-ship 收尾`

## 六、我会自动识别调用吗

会，但不要把它理解成“永远完全自动”。

### 自动触发通常发生在这些情况

- 任务和 skill 描述高度匹配
- 你直接点名某个 skill
- 当前阶段非常明确，比如你说 `review`、`qa`、`design polish`

### 仍然建议你明确点名的情况

- 你很在意流程要不要走完整
- 你希望我优先用某种评审视角
- 你不想让我自己选 workflow

最稳的方式是直接在命令里写：

- `先用 gstack-plan-eng-review`
- `按 systematic-debugging 来`
- `做完后用 gstack-review + gstack-qa`

### 一个务实判断

`自动识别` 适合提效，`明确点名` 适合控方向。

当任务重要、复杂、代价高时，最好明确点名。

## 七、最推荐的协作节奏

如果你想把 `VoxFlame` 重构协作跑顺，我建议默认使用下面这条节奏：

1. 在 [VoxFlame-Agent](/home/ubuntu/VoxFlame-Agent) 下开工
2. 先说目标和参考仓库
3. 先做计划和评审
4. 再开始实现
5. 实现后做 review / QA / verification
6. 最后同步文档和状态

一句真实可执行的话术模板：

`在 VoxFlame 里做 [某功能/某重构]，参考 [某仓库]，先用 [某个 gstack review skill] 过方案，再开始实现，最后用 review + qa 验收。`

## 八、给你的常用下指令模板

### 模板 1：产品到方案

`在 VoxFlame 里推进 [功能]，参考 [openclaw/openclaw-voice/ququ/vocotype-cli]，先用 gstack-office-hours 和 gstack-plan-eng-review 帮我锁方案。`

### 模板 2：直接开发

`在 VoxFlame 里做 [功能]，参考 [某仓库]，按 test-driven-development 开发。`

### 模板 3：前端页面

`在 VoxFlame 里做 [页面/组件]，先用 frontend-design，做完后用 baseline-ui、fixing-accessibility 和 gstack-design-review。`

### 模板 4：查 bug

`在 VoxFlame 里查 [问题]，先用 systematic-debugging，必要时参考 [某仓库] 的实现。`

### 模板 5：收尾验收

`这轮改动做完后，用 gstack-review、gstack-qa 和 verification-before-completion 走完整收尾。`

## 当前结论

后面进入 `VoxFlame` 重构时，最稳的模式不是“我在很多仓库里游走”，而是：

- 主工作目录固定在 [VoxFlame-Agent](/home/ubuntu/VoxFlame-Agent)
- 参考仓库随时可读，但只作为材料库
- skill 不靠堆数量，而靠形成稳定 workflow

如果这套方式跑顺，你后面指挥我会越来越像在带一个稳定工程团队，而不是每次重新教 AI 该怎么配合你。
