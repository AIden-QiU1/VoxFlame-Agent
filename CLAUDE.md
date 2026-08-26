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
- Docker 部署优先使用 `scripts/docker-rebuild-core-fast.sh` 的 `env-backend` / `backend` / `frontend` / `core` 最小影响模式，不默认先执行 `docker compose down`；磁盘清理使用 `scripts/docker_disk_maintenance.sh status|prune-safe` 并保留回滚镜像。
- 研究先看 `research/README.md` 与 `research/APPLICATION_FEEDBACK_REGISTRY.md`；模型实验原始事实看 `references/clear-vox-model`，不能把上游候选直接当成应用已采用能力。
- 硬件/辅助器具/重大采购先把供应商稿、竞品功能和 AI 草案当待验证假设；先做 COTS/ODM 真实任务 A/B，再用用户价值、支付方、完全落地成本、工程与责任 Gate 冻结架构/BOM。
- 硬件方案按内部决策、原供应商反馈、中性供应商征询分层；原供应商稿保留熟悉的章节骨架和表格入口，中性外发稿独立保留完整产品/路线/验收/报价，两者均隔离不需要的对照、研究过程、角色阅读分工、预算毛利和签批底牌。具体参数逐项区分原厂事实、候选配置、测试目标和未知，并验证品牌禁词、无装饰图、DOCX 元数据/媒体、A4/PDF 无裁切。
- 外部 PDF/规格书必须核验实际文件类型、标题/页数、来源和哈希；网页壳、无关文件或不可访问原文要记录失败与替代，不能写成“已读”。
