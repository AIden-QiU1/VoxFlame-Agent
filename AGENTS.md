# VoxFlame Agent Guide

> 让声音不仅被听见，更被理解。

VoxFlame 是为构音障碍者打造的开源 AI 语音助手。第一原则不是“纠正用户的声音”，而是“纠正系统对用户意图的理解”。

本文件是仓库级 agent 入口，不是百科全书。默认只提供：
- 启动上下文
- 工作流与工具路由
- 架构与安全边界
- 指向更深层文档的入口

详细方法论与维护规则以 [docs/AI_ENGINEERING_SYSTEM.md](docs/AI_ENGINEERING_SYSTEM.md) 为准。

## Session Start

每次会话开始时，按顺序读取：

1. `.claude-summary.md`
2. `.tasks/current.md`
3. 本文件

其他文档按任务触发，不要一上来把整个 `docs/`、`ideas/` 或 `frontend/` 全量载入。

## AGENTS File System

### Root AGENTS Scope

- 根 `AGENTS.md` 只放仓库级规则、工作流路由、架构边界和高频文档入口。
- 不把长步骤手册、排障实录、产品调研或临时决策长期堆在这里。
- 如果一段说明更像“操作流程”而不是“仓库级规则”，应拆到 `docs/` 专门文档，根入口只保留索引。
- 具体组织方式见 [docs/aiprompts/AGENTS_FILE_SYSTEM_GUIDE.md](docs/aiprompts/AGENTS_FILE_SYSTEM_GUIDE.md)。

### Subtree AGENTS

- 只有某个目录树存在长期稳定、只对该子树生效的规则时，才新增子目录 `AGENTS.md`。
- 临时排障说明、一次性迁移备注或短期策略，不要通过新增子树 `AGENTS.md` 来承载。

### Runtime Instruction Boundary

- 根 `AGENTS.md` 只服务“仓库协作 agent”。
- 产品运行时 agent、未来 app companion、light voice surface 或训练场景的运行时指令，不应直接写进根 `AGENTS.md`。
- 运行时指令应单独维护在明确的 runtime 文档或配置体系里，并与仓库协作规则分开。

## Operating Model

### Workflow First

- 默认先做 `workflow`，再考虑 runtime agent 或多 agent。
- 先把单链路做稳定：`Frontend -> Backend -> TEN Agent`。
- 只有当单 agent 已经稳定失败在上下文负担、工具选择或任务拆分上，才考虑 handoff / 多 agent。
- 涉及 side effects 的动作，优先通过显式 tools、结构化参数、清晰退出条件来驱动，不要靠模糊自然语言隐式执行。


## UI 全局指导

1. **界面改动先看视觉规范** - 涉及配色、渐变、卡片布局、设置页重排、工作台改版时，先读 `docs/aiprompts/design-language.md`
2. **宽度按页面类型选** - 表单页保持窄阅读宽度，卡片/工作台页面使用更宽的自适应内容区，不要整仓统一 `max-width`
3. **中文排版优先** - 避免过大英文 tracking、重复标题和挤压式统计卡文案
4. **渐变只做氛围层** - 禁止用互相打架的多层渐变制造分割感，背景存在感必须弱于内容
5. **默认禁用半透明主表面** - 弹窗、浮层、工作台容器、主卡片默认使用实体底色，避免 `bg-white/80`、`backdrop-blur` 一类设计造成层级混乱与内容遮挡错觉


### Core Loop

1. 先看代码和现状，再提方案，不要凭记忆猜仓库状态。
2. 复杂任务先写计划，再改代码；计划优先使用 [docs/AI_EXECUTION_PLAN_TEMPLATE.md](docs/AI_EXECUTION_PLAN_TEMPLATE.md)。
3. 涉及迁移、统一、兼容层、废弃路径、新旧并存时，先盘点入口层 / 服务层 / 存储层 / 旁路层，明确唯一事实源，再开始改代码。
4. 以最小可运行切片推进，避免一次性横扫式重构。
5. 每次改动都要给出对应验证，验证范围要覆盖实际改动面。
6. 完成后同步更新 `.claude-summary.md` 和 `.tasks/current.md`。
7. 当某类坑点、命令、验证方式或路由判断连续重复出现时，主动把它吸收到系统文档、脚本或模板里；同时清理已经失效的旧说明。

## Tool And Skill Routing

- 本地代码、配置、文档能回答的问题，先查仓库，再考虑外部工具。
- 专业文档检索默认走 `Context7`，OpenAI 专项默认走 `openai-docs`，浏览器验证默认走 `Playwright` 或 `gstack-browse`。
- 需要最新时效性事实时再用 `web`；需要 issue / project 管理时用 `linear`。
- 如果一时拿不准：默认按 `本地代码/文档 -> 官方文档(Context7/OpenAI docs) -> skill -> Playwright/脚本验证 -> web` 的顺序升级。
- 多个 skill 都“好像能用”时，优先最小必要 skill；核心 feature、关键 bug 和边界判断默认留在主线程本地完成。
- 具体 skill 与工具路由见 [docs/aiprompts/SKILL_ROUTING_GUIDE.md](docs/aiprompts/SKILL_ROUTING_GUIDE.md)。
- `Context7` 工作流见 [docs/aiprompts/CONTEXT7_RESEARCH_GUIDE.md](docs/aiprompts/CONTEXT7_RESEARCH_GUIDE.md)。
- `Playwright` 工作流见 [docs/aiprompts/PLAYWRIGHT_VERIFICATION_GUIDE.md](docs/aiprompts/PLAYWRIGHT_VERIFICATION_GUIDE.md)。
- 完整协作方式见 [docs/VOXFLAME_REFACTOR_COLLABORATION_PLAYBOOK_2026-03-24.md](docs/VOXFLAME_REFACTOR_COLLABORATION_PLAYBOOK_2026-03-24.md)。

## Product Guardrails

- 核心目标：提升陌生人沟通成功率，而不是追求抽象的“模型更强”。
- 优先级排序：可理解性 > 低延迟 > 可打断 > UI 精修。
- 默认假设：local-first、最小必要存储、清晰的授权边界。
- 任何新功能都不能破坏主链路：`Frontend -> Backend -> TEN Agent`。
- 如果某项能力不能改善真实沟通成功率、训练反馈质量或部署可靠性，默认不优先。
- 涉及“用户怎么理解、怎么感受、怎么坚持使用、怎么信任系统”的功能时，默认先做心理学 / 设计学 / 用户需求研究，再决定功能形态；没有研究输入时，只能做低风险、可回退、显式标注假设的最小实现。
- 这类用户研究输入可以由用户提供；agent 的职责是把原始访谈、观察、问卷、日记、可用性反馈整理成 `用户画像 / 场景任务 / 痛点 / 设计约束 / 验收信号`，再进入开发。
- 如果仓库拥有者本人就是目标用户，默认优先做“创始人即用户”研究：先研究他自己真实经历过的高频场景、失败瞬间、情绪成本、补救动作和成功沟通样本，再把这些材料外推成更广泛的人群假设。
- 涉及固定功能、稳定工程能力、第三方 SDK / API / transport / schema / auth / 存储集成时，默认先查官方技术文档；优先 `Context7` 或官方文档，再进入实现。

## Runtime Agent Guardrails

- `AGENTS.md` 管的是仓库协作 agent，不直接等于产品运行时 prompt。
- 运行时 agent 设计必须显式区分：
  - 用户输入上下文
  - tool 调用边界
  - memory 写入边界
  - side effect 审批边界
- 运行时链路里的高风险动作必须可审计、可关闭、可验证。
- handoff 只在 specialist 真有边界价值时引入；否则优先把 specialist 能力做成可调用 tool 或 skill。
- 不要让不可信输入直接驱动命令、SQL、文件写入、系统调用或高权限工具。
- 对工具输出、结构化响应和 memory 写入，优先使用显式 schema，而不是靠 prompt 猜格式。

## Engineering Guardrails

- 严禁显式 `any`，为 Props、接口响应、状态定义明确类型。
- 前端使用 Next.js App Router，组件和状态设计保持小而清晰。
- 后端坚持 Service / Controller 分层，避免把业务逻辑堆进路由。
- Agent 侧改动必须考虑会话隔离、打断、内存上下文和容错。
- 已有唯一事实源时，不再新增平级实现；优先封旧入口，而不是继续长新入口。
- 当前运行时唯一事实源是 `Frontend RTC/RTM -> Backend /api/rtc/session/* -> TEN rtc graph`；不要恢复 websocket 主链。
- `compat` 只做迁移适配，不承接新业务逻辑，并且必须带退出条件。
- 安全默认值前置：最小权限、显式审批副作用操作、结构化输出驱动工具、Secrets 不进入 prompt / 日志 / 前端。
- 非显而易见的函数或协议，补简短 JSDoc，而不是写大段空洞注释。
- 不要把易变状态、历史结论、临时方案长期堆进入口文件。

## Verification Minimums

- 前端交互改动：至少做目标页面 smoke test；涉及 UI 状态、跳转、可见文本、console、网络行为时优先用 Playwright。
- 后端接口改动：至少验证受影响的 API、RTC orchestration 或 RTM 控制路径。
- TEN Agent / 纠错链路改动：至少验证消息流、日志或针对性脚本。
- 迁移 / 重构 / 收口任务：至少验证唯一事实源、旧入口封口情况和旁路系统依赖。
- Docker / 部署改动：至少验证相关 compose 命令或构建步骤。
- 在这个仓库里，容器验证默认先按文档使用 `docker compose`；如果当前机器的 Docker 需要 root 权限或普通命令失败，明确回退到 `sudo docker compose build ...`、`sudo docker compose up -d ...`、`sudo docker compose logs ...`，并在结论里说明使用了 sudo 路径。
- 麦克风 / 语音权限验证时，优先使用 VSCode/SSH 端口转发后的 `http://localhost:3000`；`localhost` 属于 secure context，不要长期依赖 `--unsafely-treat-insecure-origin-as-secure=...` 之类浏览器 flag。若必须从公网地址验证麦克风权限，应提供 HTTPS 与证书。
- 纯文档改动：运行 `bash scripts/check_ai_docs.sh`。

## Reference Map

下面这些是按任务读取的权威参考，不是每次默认必读：

- [docs/AI_ENGINEERING_SYSTEM.md](docs/AI_ENGINEERING_SYSTEM.md)：AI 编程与 agent 工程系统规则。
- [docs/AI_EXECUTION_PLAN_TEMPLATE.md](docs/AI_EXECUTION_PLAN_TEMPLATE.md)：复杂任务执行计划模板。
- [docs/aiprompts/README.md](docs/aiprompts/README.md)：任务型 AI workflow 文档入口。
- [docs/aiprompts/AGENTS_FILE_SYSTEM_GUIDE.md](docs/aiprompts/AGENTS_FILE_SYSTEM_GUIDE.md)：根 AGENTS、下沉文档和运行时指令边界的组织方式。
- [docs/aiprompts/CONTEXT7_RESEARCH_GUIDE.md](docs/aiprompts/CONTEXT7_RESEARCH_GUIDE.md)：专业文档检索默认 workflow。
- [docs/aiprompts/USER_RESEARCH_HANDOFF_TEMPLATE.md](docs/aiprompts/USER_RESEARCH_HANDOFF_TEMPLATE.md)：当用户提供访谈、观察、问卷或 field notes 时，如何整理成可直接进入 PRD / 设计 / 开发的输入。
- [docs/aiprompts/PLAYWRIGHT_VERIFICATION_GUIDE.md](docs/aiprompts/PLAYWRIGHT_VERIFICATION_GUIDE.md)：浏览器验证默认 workflow。
- [docs/aiprompts/SKILL_ROUTING_GUIDE.md](docs/aiprompts/SKILL_ROUTING_GUIDE.md)：`gstack / 工程纪律 skill / 设计专项 skill / Context7 / Playwright / Linear` 的默认路由。
- [docs/aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md](docs/aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md)：迁移 / 统一 / 废弃 / 兼容层任务模板。
- [docs/README.md](docs/README.md)：文档导航。
- [docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md](docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)：当前产品设计、页面系统、能力对象、UI 方向与架构蓝图的权威主文档。
- [docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)：吸收 `TEN ceiling / 五层映射 / Agora 替换 / light voice surface` 后的统一 runtime 与 surface 参考文档。
- [docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)：吸收 `memory mechanisms / voice-agent-tooling` 后的统一 agent、memory、tooling 参考文档。
- [frontend/README.md](frontend/README.md)：当前前端页面系统、共享 `workspace` contract、训练资产链路与 PWA 边界。
- [docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md](docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md)：纠错链路设计。
- [docs/VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md](docs/VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md)：记忆系统统一方案。
- [docs/control-plane.md](docs/control-plane.md)：控制面的职责、边界、现有实现映射与后续收口方向。
- [docs/capability-registry.md](docs/capability-registry.md)：产品运行时能力与工程协作能力的 registry，明确 owner、调用边界、副作用和 smoke。
- [docs/VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md](docs/VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md)：基于 `ququ + vocotype-cli` 的实施文档，定义训练数据 schema、recorder pipeline、manifest 与本地 recorder queue 的收口方向。
- [docs/VOXFLAME_REFACTOR_COLLABORATION_PLAYBOOK_2026-03-24.md](docs/VOXFLAME_REFACTOR_COLLABORATION_PLAYBOOK_2026-03-24.md)：重构协作手册，明确在哪个目录下开发、何时引用参考仓库、如何使用 `gstack / superpowers / 设计专项 skill` 跑完整流程。
- [docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md](docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md)：定义当前“继续开发 + 给创始人补短阅读 + 同步产品/技术判断”的协作节奏。

## Anti-Patterns

- 不要把 `AGENTS.md` 当产品百科、任务日志或调研报告。
- 不要依赖超长 prompt 取代仓库内的结构化文档。
- 不要把“又新增一套统一实现”误认为“完成治理”。
- 不要让 `compat` / `deprecated` 路径继续长业务逻辑。
- 不要把多 agent 当默认答案。
- 不要让不可信输入直接驱动工具、命令、SQL 或高权限写操作。
- 不要跳过验证直接宣布完成。
- 不要在没收敛问题边界前做大范围风格清洗或目录搬迁。
- 不要让 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md` 与 [docs/AI_ENGINEERING_SYSTEM.md](docs/AI_ENGINEERING_SYSTEM.md) 长期漂移。

## Update Rule

当项目架构、协作流程或 agent 工程规范发生实质变化时：

1. 先更新 [docs/AI_ENGINEERING_SYSTEM.md](docs/AI_ENGINEERING_SYSTEM.md)。
2. 再同步本文件、`CLAUDE.md`、`.github/copilot-instructions.md` 的入口描述。
3. 最后更新 `.claude-summary.md` 和 `.tasks/current.md` 中的状态摘要。
