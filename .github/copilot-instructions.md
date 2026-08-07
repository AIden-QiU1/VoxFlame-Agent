# VoxFlame AI Coding Instructions

`AGENTS.md` 是本仓库的入口与规则源。本文件只保留 GitHub Copilot 需要的轻量入口，避免和 `AGENTS.md` 漂移。

系统级 AI 工程规则以 [docs/AI_ENGINEERING_SYSTEM.md](../docs/AI_ENGINEERING_SYSTEM.md) 为准。

## Start Here

每次任务开始前，按顺序读取：

1. `../.claude-summary.md`
2. `../.tasks/current.md`
3. `../AGENTS.md`

如果本文件与 `../AGENTS.md` 不一致，以 `../AGENTS.md` 为准。

## Core Rules

- 先读代码和现状，再提方案，不要凭记忆猜仓库状态。
- 默认先做 workflow，再考虑 runtime agent 或多 agent。
- 复杂任务先形成计划，再执行；计划结构遵循 `../docs/AI_EXECUTION_PLAN_TEMPLATE.md`。
- 迁移、统一、废弃、兼容层任务先盘点入口层 / 服务层 / 存储层 / 旁路层，明确唯一事实源，再开始改代码。
- 采用最小可运行切片，避免一次性大重构。
- 所有改动都必须带验证；纯文档改动至少运行 `bash scripts/check_ai_docs.sh`。
- 容器相关验证默认使用 `docker compose`；若当前机器权限要求更高或命令失败，可回退到 `sudo docker compose build/up -d/logs`。
- Docker 部署优先使用 `../scripts/docker-rebuild-core-fast.sh` 的最小影响模式，不默认先执行 `docker compose down`；清理先运行 `../scripts/docker_disk_maintenance.sh status`，只用 `prune-safe` 保留运行与 `pre-*` 回滚镜像。
- 任务完成后，同步更新 `../.claude-summary.md` 和 `../.tasks/current.md`。

## Tool Routing

- 仓库内能回答的问题先查本地代码和文档。
- 库、框架、API 用法不确定时，优先用 `Context7`。
- OpenAI 产品、Responses API、tools、MCP、Agents SDK 相关内容优先使用官方 OpenAI 文档。
- 前端交互、页面状态、RTC/RTM 页面行为验证，优先用 `Playwright`。
- 命中已安装的 skill 场景时，优先用对应 skill。
- 只有在需要最新外部信息或时效性事实时，才使用 `web`。
- 如果一时拿不准，按 `本地代码/文档 -> 官方文档 -> skill -> 运行态验证 -> web` 的顺序升级。

## Engineering Constraints

- 禁止显式 `any`。
- 前端遵循 Next.js App Router 和小组件分层。
- 后端保持 Service / Controller 分离。
- Agent 改动必须考虑会话隔离、打断控制、记忆上下文和容错。
- 当前运行时唯一事实源是 `Frontend RTC/RTM -> Backend /api/rtc/session/* -> TEN rtc graph`；不要恢复 websocket 主链。
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
