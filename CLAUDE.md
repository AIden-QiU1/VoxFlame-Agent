# VoxFlame AI Engineering Guide

> 让声音不仅被听见，更被理解。

VoxFlame 是为构音障碍者打造的开源 AI 语音助手。项目的第一原则不是“纠正用户的声音”，而是“纠正系统对用户意图的理解”。

## Session Start

每次会话开始时，先读取以下文件：

1. `.claude-summary.md`：项目概况、当前阶段、关键约束。
2. `.tasks/current.md`：当前任务状态、验证结论、下一步。

这两个文件是默认启动上下文。其他文档都按任务触发，不要一上来把整个 `docs/` 或 `ideas/` 全部载入。

## Core Loop

1. 先看代码和现状，再提出方案，不要凭记忆猜仓库状态。
2. 复杂任务先写计划，再改代码；计划优先使用 [docs/AI_EXECUTION_PLAN_TEMPLATE.md](docs/AI_EXECUTION_PLAN_TEMPLATE.md)。
3. 涉及迁移、统一、兼容层、废弃路径、新旧并存时，先盘点入口层 / 服务层 / 存储层 / 旁路层，明确唯一事实源，再开始改代码。
4. 以最小可运行切片推进，避免一次性横扫式重构。
5. 每次改动都要给出对应验证，验证范围要覆盖实际改动面。
6. 任务完成后，必须同步更新 `.claude-summary.md` 和 `.tasks/current.md`。

## Tool Routing

- 本地代码、配置、文档能回答的问题，先查仓库，再考虑外部工具。
- 不确定库、框架或 API 用法时，优先用 `Context7` 查官方文档。
- 前端交互、页面状态、WebSocket 页面行为或回归验证，优先用 `Playwright`。
- 用户明确提到某个 skill，或任务明显命中该 skill 场景时，必须先用对应 skill。
- 需要最新外部信息、官方文章、产品变化或时效性事实时，再用 `web`。
- 高风险改动、跨层改动或边界不清的任务，先写计划，再决定工具组合。

## Product Guardrails

- 核心目标：提升陌生人沟通成功率，而不是追求抽象的“模型更强”。
- 优先级排序：可理解性 > 低延迟 > 可打断 > UI 精修。
- 默认假设：local-first、最小必要存储、清晰的授权边界。
- 任何新功能都不能破坏主链路：`Frontend -> Backend -> TEN Agent`。

## Engineering Guardrails

- 严禁显式 `any`，为 Props、接口响应、状态定义明确类型。
- 前端使用 Next.js App Router，组件和状态设计保持小而清晰。
- 后端坚持 Service / Controller 分层，避免把业务逻辑堆进路由。
- Agent 侧改动必须考虑会话隔离、打断、内存上下文和容错。
- 已有唯一事实源时，不再新增平级实现；优先封旧入口，而不是继续长新入口。
- `compat` 只做迁移适配，不承接新业务逻辑，并且必须带退出条件。
- 安全默认值前置：最小权限、显式审批副作用操作、结构化输出驱动工具、Secrets 不进入 prompt / 日志 / 前端。
- 非显而易见的函数或协议，补简短 JSDoc，而不是写大段空洞注释。
- 不要把易变状态、历史结论、临时方案长期堆进入口文件。

## Verification Minimums

- 前端交互改动：至少做目标页面 smoke test；涉及 UI 状态时优先用 Playwright。
- 后端接口改动：至少验证受影响的 API 或 WebSocket 路径。
- TEN Agent / 纠错链路改动：至少验证消息流、日志或针对性脚本。
- 迁移 / 重构 / 收口任务：至少验证唯一事实源、旧入口封口情况和旁路系统依赖。
- Docker / 部署改动：至少验证相关 compose 命令或构建步骤。
- 纯文档改动：运行 `bash scripts/check_ai_docs.sh`。

## Task References

下面这些是按任务读取的权威参考，不是每次默认必读：

- [docs/AI_ENGINEERING_SYSTEM.md](docs/AI_ENGINEERING_SYSTEM.md)：AI 编程指导体系的设计原则、分层结构、维护规则。
- [docs/AI_EXECUTION_PLAN_TEMPLATE.md](docs/AI_EXECUTION_PLAN_TEMPLATE.md)：复杂任务执行计划模板。
- [docs/aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md](docs/aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md)：迁移 / 统一 / 废弃 / 兼容层任务的治理 Prompt 模板。
- [docs/README.md](docs/README.md)：项目文档导航。
- [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md)：前端结构与交互流。
- [docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md](docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md)：纠错链路设计。
- [docs/TEN_FRAMEWORK_CAPABILITY_CEILING_REPORT_2026-03-05.md](docs/TEN_FRAMEWORK_CAPABILITY_CEILING_REPORT_2026-03-05.md)：TEN 能力边界与架构判断。
- [docs/VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md](docs/VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md)：记忆系统统一方案。

## Optional Ideation Context

- [ideas/README.md](ideas/README.md)：仅在讨论新想法、长期调研或外部参考时查阅，不作为默认启动上下文。

## Anti-Patterns

- 不要把 `CLAUDE.md` 当产品百科、任务日志或调研报告。
- 不要依赖超长 prompt 取代仓库内的结构化文档。
- 不要把“又新增一套统一实现”误认为“完成治理”。
- 不要让 `compat` / `deprecated` 路径继续长业务逻辑。
- 不要让不可信输入直接驱动工具、命令、SQL 或高权限写操作。
- 不要跳过验证直接宣布完成。
- 不要在没收敛问题边界前做大范围风格清洗或目录搬迁。
- 不要让 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md` 三套规则长期漂移。

## Update Rule

当项目架构、协作流程或 AI 编程规范发生实质变化时：

1. 先更新 [docs/AI_ENGINEERING_SYSTEM.md](docs/AI_ENGINEERING_SYSTEM.md)。
2. 再同步 `AGENTS.md`、本文件、`.github/copilot-instructions.md` 的入口描述。
3. 最后更新 `.claude-summary.md` 和 `.tasks/current.md` 中的状态摘要。
