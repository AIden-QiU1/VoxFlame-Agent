# CLAUDE.md

`AGENTS.md` 是本仓库的入口与规则源。开始工作时：

1. 读取 `.claude-summary.md`
2. 读取 `.tasks/current.md`
3. 读取 [AGENTS.md](AGENTS.md)
4. 需要系统规则时，读取 [docs/AI_ENGINEERING_SYSTEM.md](docs/AI_ENGINEERING_SYSTEM.md)

如果 `AGENTS.md` 与本文件不一致，以 [AGENTS.md](AGENTS.md) 为准，并在任务结束后同步修正。

补充约定：

- 工具和 skill 选择拿不准时，按 `本地代码/文档 -> 官方文档 -> skill -> 验证 -> web` 升级。
- 容器验证默认先用 `docker compose`；若当前机器权限要求更高或普通命令失败，再回退到 `sudo docker compose ...`。
