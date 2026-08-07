# VoxFlame AI Engineering System

> 更新日期：2026-03-24
>
> 本文档基于三类输入收敛：
> 1. OpenAI《Harness Engineering》
> 2. 用户提供文章《用 AI 写了 80 万行代码之后，我开始重新理解 AI 代码“治理”》
> 3. OpenAI / OWASP 关于 agent guardrails 与 Agentic Security 的官方最佳实践
> 4. https://zhuanlan.zhihu.com/p/2015575496742679437 这篇文章把harness engineering说得比较清楚
> 5. GitHub Copilot 官方 best practices / CLI best practices
> 6. Anthropic Claude Code 官方 common workflows
> 7. OpenAI Codex 官方关于 Docs MCP、agent internet access 与 coding workflow 的文档

## 1. 本轮升级要解决什么

过去我们已经完成了第一轮 `Harness Engineering` 化：把入口文件缩短、把深规则移到 `docs/`、把最小验证和状态同步纳入仓库。

但这只解决了“不要把 prompt 写成百科全书”。

随着 AI 生成代码比例持续升高，第二个问题会迅速变成主问题：

- 代码生成越来越便宜
- 新抽象越来越容易长出来
- 旧入口不会自动消失
- 兼容层很容易被 AI 误当成正式层
- 安全边界如果不前置，AI 会把可调用路径继续扩散

所以这一轮升级的目标不是“让 AI 写得更多”，而是让系统更容易收敛、更难失控、更安全。

一句话概括：

**AI 编程时代，稀缺的不是生成能力，而是系统收口能力。**

## 2. 关键原则

### 2.1 环境优于提示词

稳定知识应落在仓库环境里，而不是依赖某一轮对话记忆。

VoxFlame 落地：

- 入口文件继续保持短规则和地图。
- 深层规则进入 `docs/`。
- 守卫优先放进模板、脚本、lint、CI 和验证流程。

### 2.2 治理不是重写，而是收口

大多数失控不是因为“没有新方案”，而是“旧路径没有被关掉”。

VoxFlame 落地：

- 不把“新增统一实现”误认为“完成治理”。
- 每次迁移都要回答：旧入口是否真的被封住。
- 优先减少合法入口数量，而不是继续叠加平级抽象。

### 2.3 AI 偏局部最优，人要负责全局收敛

AI 会沿着可见上下文继续生长代码；只要旧实现仍可被引用，AI 就会继续复制旧模式。

VoxFlame 落地：

- 迁移任务先盘点旧路径，再改代码。
- 明确唯一事实源后，禁止继续在旧路径上长新逻辑。
- compat / deprecated 路径不能只靠口头约定存在。

### 2.4 过渡态必须显式标记

兼容层不是问题；没有退出条件的兼容层才是问题。

VoxFlame 落地：

- 所有过渡层都要明确角色和退出条件。
- 迁移做不完时，先建立“防扩散机制”。
- 删除成为正式流程，不是“有空再说”。

### 2.5 安全不是补丁，而是默认门禁

AI 让代码和工具调用更容易扩散，所以安全规则必须前置成默认值。

VoxFlame 落地：

- 最小权限默认开启。
- 任何副作用工具都需要白名单、显式授权或人工确认。
- 不可信输入不能直接驱动工具调用、命令执行或状态写入。

### 2.6 人机协作的最小可靠模式

这轮补充的官方资料给出了一个很一致的结论：

- AI 更擅长加速局部分析、实现和验证
- 人更应该负责目标对齐、边界收口、风险审批和结果验收

VoxFlame 默认采用下面这个协作顺序：

1. 先广后窄
- 先让 agent 用最小上下文理解代码库和目标，再逐步缩到具体模块，不要一上来塞满所有文档和目录。

2. 先计划，再改代码
- 多文件改动、重构、架构收口、边界不清任务，默认先进入 plan / review / research，再进入实现。

3. 会话保持聚焦
- 一个会话只追一个主任务；问题域变了，就压缩结论、切新任务，而不是把所有上下文硬串在一起。

4. 并行只给旁路任务
- 可并行、可验收、不会阻塞当前关键路径的子任务才适合 delegation；核心 feature、关键 bug、边界判断优先在主线程本地完成。

5. 验证比生成更重要
- AI 生成速度快不等于任务完成；任何输出都要经类型检查、测试、日志、浏览器或脚本验证后才算收口。

6. 仓库说明文件必须足够具体
- 仓库级 instructions 不能只写“遵循最佳实践”；至少要包含 build/test 命令、关键架构判断、何时 plan、何时 delegate、何时必须人工复核。

7. 主线程只吃结论，不吃探索噪音
- 复杂任务里，探索、试错、大范围搜索和备选方案比较可以发生在旁路上下文。
- 但回到主线程时，默认只带回 `结论 / 风险 / 下一步 / 证据`，不把整段垃圾上下文重新灌回主任务。
- 如果必须 delegate，多 agent 返回值应优先是 synthesis，而不是原始探索流水。

### 2.7 用户功能与固定功能的研究门槛

不是所有开发都该先看同一种资料。

VoxFlame 默认把任务分成两类：

1. 用户 / 人的功能
- 例如：沟通首句设计、训练反馈措辞、激励机制、陪练体验、解释性 UI、信任建立、照护者协作、认知负担控制。
- 这类任务优先需要：
  - 用户访谈 / 观察 / diary study / usability feedback
  - 心理学、康复、交互设计、无障碍设计相关资料
  - 用户提供的真实 field notes、需求清单、访谈摘要
- 如果缺这些输入，agent 只能做：
  - 可回退的最小实现
  - 明确写出假设
  - 不把“猜的用户需求”直接写死成长期产品结构

如果产品创建者本人就是目标用户，默认优先级更高的是：

- 先做“创始人即用户”研究，而不是先抽象 persona
- 先抓他真实经历过的沟通任务、失败瞬间、身体疲劳、情绪代价、补救动作和成功样本
- 再把这些一手材料外推成更广的人群假设

2. 固定 / 稳定功能
- 例如：SDK 接入、API schema、transport、auth、存储、部署、容器、数据库、realtime 协议。
- 这类任务优先需要：
  - 官方技术文档
  - SDK / framework / API 参考
  - 真实代码实现和运行日志
- 默认顺序：
  - 先本地代码
  - 再官方文档 / Context7
  - 再实现
  - 最后用脚本 / 浏览器 / 容器验证

一句话：

**跟“人”有关的功能先研究人，跟“系统”有关的功能先研究技术。**

## 3. 治理型任务的统一模型

当任务涉及迁移、统一、兼容层、废弃路径、双轨实现或主链路收敛时，默认按下面三个概念来判断。

### 3.1 四层盘点

先盘点该能力在四层里的真实分布：

1. 入口层：页面、组件、Hook、路由、前端 API 调用方
2. 服务层：Service、Controller、命令、Workflow、事件入口、Agent cmd/data handler
3. 存储层：表、DAO、Repository、缓存、文件存储、向量库索引
4. 旁路层：统计、记忆、搜索、审计、报表、后台任务、埋点、导出

只改入口层不等于完成治理；如果旁路层还读旧数据，旧路径就删不掉。

### 3.2 唯一事实源

每一项核心能力，都必须明确：

- 当前唯一应该继续演进的事实源是什么
- 其余实现为什么还存在
- 谁负责最终替换和删除旧路径

事实源可以是：

- 一个 Hook
- 一个 Service
- 一套命令组
- 一个 Repository
- 一组表 / 事件模型

但同一能力不能长期并存多个“同级现役入口”。

### 3.3 路径分类

所有实现默认归类为以下四种之一：

- `current`：现役主路径，只允许继续演进这里
- `compat`：兼容壳，只允许做迁移适配，不允许承接新业务逻辑
- `deprecated`：禁止新增依赖，只允许迁移和删除准备
- `dead`：已无实际入口，进入删除流程

这四类不能只存在于脑子里，至少要通过目录、注释、文档、日志、lint 或脚本表达出来。

## 4. 治理型任务的默认执行闭环

### 4.1 盘点

不要一上来就重构。先确认：

- 现在有哪些真实入口
- 哪些入口仍在运行
- 哪些旁路系统还依赖旧路径
- 哪些旧实现其实已经是残留

### 4.2 定锚

在开始迁移前，先定唯一事实源。

必须有一句明确的话：

**从这次开始，这项能力以后只允许往这里收。**

### 4.3 建收口层

如果一次性替换风险过高，可以加 compat 壳或适配层，但 compat 的目标只有一个：迁移。

compat 层必须同时具备：

- 明确命名
- 明确注释
- 明确删除条件

### 4.4 加守卫

治理不是“鼓励走新路”，而是“封死老路”。

优先考虑的守卫包括：

- lint 禁止 import 旧 Hook / 模块
- CI 禁止新代码引用 deprecated 路径
- 静态扫描脚本检测重复实现或旧命令调用
- deprecated 命令 / API 打日志告警
- 审查规则要求说明 compat 的删除条件

### 4.5 分片迁移

不追求一次性切干净，按切片推进：

1. 主入口
2. 高频路径
3. 旁路系统
4. 长尾依赖

### 4.6 删除与复盘

完成迁移后必须继续做两件事：

- 删除旧入口、旧依赖、旧表、旧事件消费
- 复盘这次为什么会出现双轨和回流

删除不是扫尾，而是治理完成的核心标志。

## 5. 安全应用默认门禁

下面这些规则默认适用于所有 AI 参与的实现，不因任务大小而省略。

### 5.1 最小权限

- 工具、命令、数据库、第三方 API、文件系统访问都按最小权限暴露。
- 默认使用白名单能力，不给“泛化执行权限”。
- 高风险能力必须具备单独开关和撤销路径。

### 5.2 副作用审批

- 任何会发送消息、写数据库、调用外部系统、控制设备、暴露隐私数据的动作，都要有显式审批、用户确认或硬编码白名单。
- 不允许让模型自由拼接命令后直接执行。

### 5.3 不可信数据隔离

- 用户输入、网页内容、检索结果、外部文件都按不可信数据处理。
- 不可信内容不能直接驱动工具参数、SQL、Shell、系统 prompt 或权限边界。
- 优先使用结构化输出和严格 schema，再进入下游执行层。

### 5.4 身份、租户与数据边界

- 所有 user-scoped 数据都要显式校验 authn/authz 和 tenant boundary。
- 匿名态、登录态、本地态、云端态必须分别定义权限边界。
- 不允许因为 AI 辅助开发而默认放宽 ownership 校验。

### 5.5 Secret 与敏感数据治理

- Secret 不进入 prompt、日志、前端 bundle、测试快照或文档示例。
- 调试输出默认打码。
- 录音、转写、记忆和用户画像只保留最小必要范围，并保留删除路径。

### 5.6 供应链与执行环境

- 依赖尽量锁版本；高风险依赖和运行时工具要有来源说明。
- 能在 sandbox / mock / stub 验证的逻辑，不直接上真实副作用环境。
- 对生成代码优先做类型检查、测试、日志验证和最小 smoke，再谈合并。

### 5.7 观测与熔断

- 高风险链路要有审计日志、失败告警和可关闭开关。
- Agent 侧需要考虑 prompt injection、memory poisoning、excessive agency 和跨租户数据泄漏。
- 当链路可信度不足时，默认降级到“建议模式”，而不是继续自动执行。

### 5.8 外部资料与联网默认值

- 技术文档优先使用官方文档源，不先依赖社区二手总结。
- OpenAI 专项默认走官方文档 / Docs MCP；其他库、框架、SDK 默认优先走 `Context7`。
- 只有当问题具有明显时效性、官方文档不足、或需要外部事实核验时，才升级到 `web`。
- 对外部网页、issue、README、博客和搜索结果，一律按不可信输入处理。
- 允许联网时，优先最小域名白名单、最小 HTTP 方法和最小必要数据暴露。

### 5.9 用户研究输入的默认处理方式

当用户提供一手调研数据时，默认按下面顺序吸收：

1. 原始材料先压成结构化摘要
- 用户是谁
- 在什么场景下
- 想完成什么任务
- 卡在什么地方
- 当前替代方案是什么
- 哪句话最能代表真实痛点
- 什么结果算“真的有帮助”

如果提供材料的人本身就是目标用户，还要额外补两组信息：

- 哪些困难是身体 / 发音 / 疲劳本身带来的
- 哪些困难是社会互动、误解、催促、羞耻感或环境设计带来的

2. 再翻译成产品输入
- JTBD
- 关键情绪与阻力
- UI / 文案 / 交互约束
- 不该做什么
- 可验证的 acceptance signal

3. 最后才进入开发
- 改 PRD
- 改页面 / API / contract
- 改验证标准

如果用户愿意自己做研究，agent 不替代研究本身；agent 负责把用户给的数据整理、对齐并落成产品与工程输入。

## 6. 必须进仓库的工件

治理规则如果只存在于人脑里，AI 下一轮就会继续回流。

所以至少要落到下面几个位置：

- 项目级规则：`AGENTS.md` / `CLAUDE.md` / `.github/copilot-instructions.md`
- 体系文档：本文档
- 任务模板：`docs/AI_EXECUTION_PLAN_TEMPLATE.md`
- 治理 Prompt 模板：`docs/aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md`
- 守卫：lint / CI / 脚本 / deprecated 日志

当前仓库中的最小机械守卫已经落到：

- `scripts/check_ai_docs.sh`：校验入口规则和深文档没有漂移
- `scripts/check_ai_governance.sh`：阻止 compat 路径和旧页面入口重新被新代码引用
- `.github/workflows/ai-doc-guard.yml`：在 CI 中同时执行文档 harness 与治理守卫
- `scripts/docker-rebuild-core-fast.sh`：生产 Docker 部署 harness；环境变量更新使用 `env-backend` 只重建 backend，单服务代码改动使用 `backend` / `frontend`，只有核心链路共同变化才使用默认 `core`，不先执行 `docker compose down`
- `scripts/docker_disk_maintenance.sh`：Docker 磁盘维护 harness；`status` 先盘点，`prune-safe` 只清理 7 天前的 dangling images 与 build cache，保留运行容器、卷、`latest` 和 `pre-*` 回滚镜像

另外，仓库级 instructions 至少要明确：

- 当前环境常用 build / test / smoke 命令
- 如果 `docker compose` 在当前机器权限不足，何时回退到 `sudo docker compose`
- Docker 部署遵循最小影响面：环境变量更新只 recreate 目标服务，单服务代码更新只 build/up 目标服务，不把 `docker compose down` 作为默认前置步骤
- Docker 清理先保留运行镜像与显式回滚标签；默认禁止用 `docker system prune -af` 代替精确的 dangling image / 过期 build cache 清理
- 哪些验证必须在浏览器、哪些验证必须在容器、哪些验证必须在脚本
- 哪些工具 / skill / MCP 是默认入口，哪些只在特定条件下启用

### 6.1 协作系统的自演进机制

这套体系不是静态手册，而应随着协作自动优化。

默认触发下面三类动作：

1. 自动吸收经验
- 同一类判断、坑点、命令或验证方式在 2 次以上任务中重复出现时，应上升为仓库规则、模板、脚本或路由文档，而不是继续只存在于聊天记录里。

2. 自动清理失效内容
- 当旧计划、旧排障记录、旧兼容说明已经被主文档或新事实源吸收后，应及时从入口文件、导航和状态文件中清走，避免 AI 继续把历史内容当现役事实。

3. 自动同步关键状态
- 任务完成后，稳定结论至少同步到 `.claude-summary.md` 和 `.tasks/current.md`；如果是协作规则变化，还要继续同步到 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md` 和相关 workflow 文档。

### 6.2 需要继续补强的协作基础设施

结合 2026-04-06 的新增工程观察，这套协作系统后续最值得继续补的，不是“让 agent 拿到更多自由”，而是让上下文、并发和审批更可控。

1. `context assembly` 文档化
- 协作系统应明确区分：
  - 静态可缓存规则
  - 本轮动态任务边界
  - 附件化的大对象或低频状态
- 目标不是写更长 prompt，而是减少 prompt 漂移和缓存穿透。

2. 工具并发安全元数据化
- 除了人工判断“是否适合并行”，后续应尽量把工具或脚本补成更显式的并发安全分级。
- 例如：
  - 只读搜索 / 读文件 / 文档检索：默认可并行
  - 写同一文件、改同一模块、带副作用命令：默认串行

3. synthesis-only delegation contract
- 如果使用子 agent，默认要求其回传：
  - 关键发现
  - 风险
  - 结论
  - 需要主线程接手的阻塞点
- 不默认回传完整探索流水，避免主线程上下文被污染。

4. 拒绝追踪与优雅降级
- 高风险命令或工具如果在同一任务中反复被拒绝，应考虑触发更保守的人工确认模式。
- 目标不是继续碰运气，而是主动收紧自动化边界。

5. 短期日志与长期规则分层
- `.tasks/current.md`、临时计划和任务记录继续承接短期工作记忆。
- 重复出现的坑点、命令套路、验证路径和收口原则，应异步蒸馏进：
  - 系统文档
  - 模板
  - 守卫脚本
  - CI / lint
- 一句话：日志追加和长期规则不能混写在一个层里。

## 7. VoxFlame 的默认判断

### 7.1 产品判断

- 任何治理动作都不能破坏主链路：`Frontend LiveKit RTC/Data -> Backend /api/rtc/session/* -> self-hosted livekit-server -> livekit_agent`
- 对构音障碍用户来说，可理解性和授权边界优先于“更自动”
- local-first、最小必要存储、会话可打断保持不变

### 7.2 工程判断

- 前端：优先统一页面入口、Hook 和状态模型，避免多套平级页面逻辑
- 后端：Controller 处理边界，Service 处理业务；不要把 compat 当新主路径
- Agent：命令、记忆、广播、纠错链路都要明确唯一事实源和回退路径
- 数据：主链路和旁路系统一起盘点，不只看页面能不能跑

### 7.3 VoxFlame 的工具选择升级梯度

当 agent 不确定该用什么资料或什么工具时，默认按下面顺序升级：

1. 代码与仓库文档
- 先读代码、`AGENTS.md`、`.tasks/current.md`、`docs/README.md` 和相关权威主文。

2. 专业官方文档
- 库、框架、SDK、浏览器 / 平台 API 不确定时，优先 `Context7`。
- OpenAI 产品问题优先官方 OpenAI 文档 / Docs MCP。

3. 仓库内 workflow / skill
- 任务命中明确方法论时，再激活最小必要 skill；不要为了“用 skill”而硬叠流程。

4. 运行态验证
- 页面和交互问题优先 `Playwright`；容器和后端问题优先脚本、日志和 compose 验证。

5. 外部联网检索
- 只有在需要最新事实、对比外部产品、查询法规 / 新闻 / 价格 / 社区状态时，才升级到 `web`。

一句话规则：

**先本地，后官方；先文档，后联网；先验证，后结论。**

## 8. 默认反模式

以下做法默认视为退化：

1. 新方案出来后，旧入口继续开放且没有删除条件
2. 在 compat 或 deprecated 路径上继续堆新业务逻辑
3. 只改主链路，不改统计 / 记忆 / 搜索 / 审计等旁路系统
4. 把“又新增一套统一实现”误认为“已经完成治理”
5. 用推荐、约定、自觉代替 lint / CI / 脚本守卫
6. 让不可信输入直接驱动工具、命令或数据写入
7. 让 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md` 与本文长期漂移

## 9. 维护顺序

当 AI 协作机制、治理规则或安全默认值发生实质变化时，按下面顺序更新：

1. 本文档
2. `docs/AI_EXECUTION_PLAN_TEMPLATE.md`
3. `docs/aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md`
4. `docs/aiprompts/SKILL_ROUTING_GUIDE.md`
5. `docs/README.md`
6. `AGENTS.md`
7. `CLAUDE.md`
8. `.github/copilot-instructions.md`
9. `.claude-summary.md`
10. `.tasks/current.md`

最后运行：

```bash
bash scripts/check_ai_docs.sh
```

## 10. 参考

- OpenAI, Harness Engineering: https://openai.com/zh-Hans-CN/index/harness-engineering/
- OpenAI, A practical guide to building agents: https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- OpenAI, Building guardrails for agents: https://openai.github.io/openai-agents-js/guides/guardrails
- OpenAI, Docs MCP: https://developers.openai.com/learn/docs-mcp
- OpenAI, Codex internet access: https://developers.openai.com/codex/cloud/internet-access
- OWASP Agentic Security Initiative: https://owasp.org/www-project-agentic-security-initiative/
- OWASP Top 10 for LLM Applications / Agentic AI: https://genai.owasp.org/
- Anthropic, Claude Code common workflows: https://code.claude.com/docs/en/tutorials
- GitHub, Repository custom instructions for Copilot coding agent: https://docs.github.com/en/copilot/how-tos/agents/copilot-coding-agent/customizing-the-development-environment-for-copilot-coding-agent
- GitHub, MCP and Copilot coding agent best practices: https://docs.github.com/en/copilot/concepts/coding-agent/mcp-and-coding-agent
