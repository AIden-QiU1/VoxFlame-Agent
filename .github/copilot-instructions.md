# VoxFlame AI Coding Instructions

VoxFlame 服务构音障碍用户。默认目标不是“修正用户声音”，而是“帮助系统正确理解用户意图”。

## Start Here

每次任务开始前，先读取：

1. `../.claude-summary.md`
2. `../.tasks/current.md`

这两个文件是默认启动上下文。

## Task References

只有在任务命中对应主题时，再查：

- `../docs/AI_ENGINEERING_SYSTEM.md`
- `../docs/AI_EXECUTION_PLAN_TEMPLATE.md`
- `../docs/aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md`
- `../docs/README.md`

## Optional Ideation Context

只有在讨论新想法、长期调研或外部参考时，才查：

- `../ideas/README.md`

## Working Rules

- 先读代码，再改代码；不要假设当前实现仍与旧文档一致。
- 复杂任务先形成计划，再执行；计划结构遵循 `../docs/AI_EXECUTION_PLAN_TEMPLATE.md`。
- 迁移、统一、废弃、兼容层任务先盘点入口层 / 服务层 / 存储层 / 旁路层，明确唯一事实源，再开始改代码。
- 保持入口文件短，把稳定规则写进 `docs/`，不要把易变状态堆进本文件。
- 采用最小可运行切片，避免一次性大重构。
- 所有改动都必须带验证；纯文档改动至少运行 `bash scripts/check_ai_docs.sh`。
- 任务完成后，同步更新 `../.claude-summary.md` 和 `../.tasks/current.md`。

## Tool Routing

- 仓库内能回答的问题先查本地代码和文档。
- 库、框架、API 用法不确定时，优先用 `Context7`。
- 前端交互、页面状态、WebSocket 页面行为验证，优先用 `Playwright`。
- 任务命中已安装的 skill 场景时，先用对应 skill。
- 只有在需要最新外部信息或时效性事实时，才使用 `web`。

## Engineering Constraints

- 禁止显式 `any`。
- 前端遵循 Next.js App Router 和小组件分层。
- 后端保持 Service / Controller 分离。
- Agent 改动要考虑会话隔离、打断控制、记忆上下文和容错。
- 已有唯一事实源时，不再新增平级实现；优先封旧入口，而不是继续加一套新入口。
- `compat` 只做迁移适配，不承接新业务逻辑，并且必须写退出条件。
- 安全默认值前置：最小权限、显式审批副作用操作、结构化输出驱动工具、Secrets 不进入 prompt / 日志 / 前端。
- 优先级始终是：可理解性 > 低延迟 > 可打断 > UI 精修。

## Avoid

- 用超长 prompt 代替文档系统。
- 把“新增一套统一实现”当成“完成治理”。
- 让 `compat` / `deprecated` 路径继续扩散。
- 让不可信输入直接驱动工具、命令、SQL 或高权限写操作。
- 跳过验证直接提交结论。
- 在未收敛边界前做大范围清理式改动。
- 让 `AGENTS.md`、`CLAUDE.md`、本文件长期漂移。
