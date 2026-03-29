# VoxFlame 技术文档导航

> 默认先看主文档，再按需看综合参考，不要先扎进旧研究稿。

## 现役入口

1. [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md)
   当前产品设计、页面系统、能力对象、UI 方向与架构蓝图的权威主文档。
2. [当前任务状态](../.tasks/current.md)
   当前现役任务、最近 3 天有效结论、下一步优先级与验证基线。
3. [主项目 README](../README.md)
   当前代码现状、启动方式、近期开发路径和验证入口。
4. [前端 README](../frontend/README.md)
   当前页面系统、共享 `workspace` contract、训练资产链路与 PWA 边界。
5. [训练数据 schema 与 recorder pipeline 实施文档（2026-03-23）](VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md)
   当前数据录入、上传、manifest 和 recorder queue 的权威 contract。

## 综合参考

这两份文档吸收了之前多份仓库研究结论，是 PRD 的长期参考层：

1. [Runtime And Surface Reference（2026-03-26）](VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)
   吸收 `TEN ceiling / 五层映射 / Agora 替换 / light voice surface` 后的统一 runtime 与 surface 参考。
2. [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
   吸收 `memory mechanisms / voice-agent-tooling` 后的统一 agent、memory、tooling 参考。

## 分类导航

### AI 工程与协作

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [AI 编程指导体系](AI_ENGINEERING_SYSTEM.md) | AI 工程规范、协作分层、治理和默认门槛 | ⭐⭐⭐ |
| [AI 工作流提示文档入口](aiprompts/README.md) | `docs/aiprompts/` 的总入口 | ⭐⭐⭐ |
| [Skill 路由指南](aiprompts/SKILL_ROUTING_GUIDE.md) | `Context7 / Playwright / Linear / gstack` 的默认配合方式 | ⭐⭐⭐ |
| [AI 执行计划模板](AI_EXECUTION_PLAN_TEMPLATE.md) | 非 trivial 任务的统一计划模板 | ⭐⭐ |
| [治理 Prompt 模板](aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md) | 迁移 / 统一 / 废弃 / 兼容层任务模板 | ⭐⭐ |
| [重构协作手册（2026-03-24）](VOXFLAME_REFACTOR_COLLABORATION_PLAYBOOK_2026-03-24.md) | 工作目录、参考仓库调用和整套协作流程 | ⭐⭐⭐ |

### 产品与架构

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md) | 当前产品设计与架构蓝图主文档 | ⭐⭐⭐ |
| [Runtime And Surface Reference（2026-03-26）](VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md) | runtime、surface、迁移与 `session_strategy` 的综合参考 | ⭐⭐⭐ |
| [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md) | agent、memory、tooling 与 dataset/memory 边界的综合参考 | ⭐⭐⭐ |
| [control-plane.md](control-plane.md) | backend 控制面实现、schema 与诊断深文档 | ⭐⭐ |
| [capability-registry.md](capability-registry.md) | 仓库协作 capability registry 盘点表 | ⭐⭐ |

### 训练数据与纠错

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [训练数据 schema 与 recorder pipeline 实施文档（2026-03-23）](VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md) | `recording schema / recorder queue / manifest / upload` 的权威 contract | ⭐⭐⭐ |
| [LLM 纠错开发计划](LLM_CORRECTION_DEVELOPMENT_PLAN.md) | 纠错扩展实现计划与评估指标 | ⭐⭐⭐ |

### Memory

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [统一记忆系统报告（2026-03-05）](VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md) | 记忆系统统一方案 | ⭐⭐⭐ |
| [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md) | 本地事实源、typed profile bundle、context service 的长期参考 | ⭐⭐⭐ |

### 前端与体验面

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [前端 README](../frontend/README.md) | 当前页面系统、训练资产链路与 PWA 边界 | ⭐⭐⭐ |

### ideas / 长期讨论

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [ideas 目录说明](../ideas/README.md) | ideas 目录使用说明 | ⭐⭐ |
| [日常随手记](../ideas/DAILY_CAPTURE.md) | 产品灵感、观察、仓库线索 | ⭐⭐ |
| [长期讨论 / 调研](../ideas/LONG_TERM_TOPICS.md) | 暂无结论但值得持续跟进的问题 | ⭐⭐ |

### 数据与部署

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [数据库设计](database/) | 数据库 schema 与迁移说明 | ⭐ |
| [Docker 部署说明（根目录）](../DOCKER_DEPLOY.md) | 容器部署与启动说明 | ⭐⭐ |

## 快速查找

**继续开发应该先看什么**
1. [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md)
2. [当前任务状态](../.tasks/current.md)
3. [主项目 README](../README.md)

**要判断 runtime / surface / PWA / App 方向**
1. [Runtime And Surface Reference（2026-03-26）](VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)
2. [前端 README](../frontend/README.md)

**要判断 agent / memory / tooling 边界**
1. [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
2. [统一记忆系统报告（2026-03-05）](VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md)

**要继续做录音、上传和训练资产**
1. [训练数据 schema 与 recorder pipeline 实施文档（2026-03-23）](VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md)
2. [前端 README](../frontend/README.md)

## 优先级说明

- ⭐⭐⭐ 直接影响当前开发路线
- ⭐⭐ 按需查阅
- ⭐ 纯参考
