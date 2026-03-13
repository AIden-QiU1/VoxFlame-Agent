# VoxFlame 技术文档导航

> 当前文档已按“单主题单主文档”收敛，减少计划类与调研类重复维护。

---

## 文档分类

### AI 工程与协作

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [AI 编程指导体系](AI_ENGINEERING_SYSTEM.md) | 基于 Harness Engineering、AI 代码治理与安全 guardrails 收敛出的协作分层、收口方法、计划标准与维护规则，并约定最小机械守卫脚本与 CI | ⭐⭐⭐ |
| [AI 执行计划模板](AI_EXECUTION_PLAN_TEMPLATE.md) | 非 trivial 任务的统一计划模板，明确目标、边界、验证与回退 | ⭐⭐ |
| [治理 Prompt 模板](aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md) | 面向迁移 / 统一 / 废弃 / 兼容层任务的 AI 治理提示词模板 | ⭐⭐ |
| [执行计划归档](plans/README.md) | 阶段性执行计划统一放在 `docs/plans/`，避免顶层继续膨胀 | ⭐⭐ |

### 想法与孵化

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [ideas 目录说明](../ideas/README.md) | 说明 ideas 目录只在讨论新想法、长期调研或外部参考时按需查阅 | ⭐⭐ |
| [日常随手记](../ideas/DAILY_CAPTURE.md) | 记录每天随手看到的产品灵感、仓库链接、交互观察与半成品念头 | ⭐⭐ |
| [长期讨论 / 调研](../ideas/LONG_TERM_TOPICS.md) | 沉淀需要反复讨论、长期调研、暂时没有结论的问题与资料 | ⭐⭐ |

### TEN 与实时架构

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [TEN 框架能力与上限评估（2026-03-05）](TEN_FRAMEWORK_CAPABILITY_CEILING_REPORT_2026-03-05.md) | TEN 能力边界、性能上限、WebSocket/RTC 决策（内容已按当前代码更新） | ⭐⭐⭐ |

### 产品战略与执行

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [产品方向重排（2026-03-09）](COMMUNICATION_FIRST_PRODUCT_RESET_2026-03-09.md) | 重新评估“全屏字幕 / 主动沟通 / 训练反馈 / 记忆 / 硬件联动”的近期优先级 | ⭐⭐⭐ |
| [主动沟通 Starter Kit 数据来源（2026-03-09）](COMMUNICATION_STARTER_KIT_SOURCES_2026-03-09.md) | 说明第一句话场景模板引用了哪些 AAC / 医疗 / 应急资料，以及如何改写成中文页面文案 | ⭐⭐⭐ |
| [产品战略与用户研究统一报告（2026-03-05）](VOXFLAME_PRODUCT_STRATEGY_AND_USER_RESEARCH_2026-03-05.md) | 定位、人群、场景优先级、指标框架、技术边界核验 | ⭐⭐⭐ |
| [执行路线图（2026-03-05）](VOXFLAME_EXECUTION_ROADMAP_2026-03-05.md) | 90/180/365 天执行计划、验收标准、风险控制（状态已并入对应章节） | ⭐⭐⭐ |

### Memory 与 RAG

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [统一记忆系统报告（2026-03-05）](VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md) | 本地记忆 + 服务化记忆 + 音频多模态记忆统一方案（状态已并入对应章节） | ⭐⭐⭐ |

### 语音与纠错

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [LLM 纠错开发计划](LLM_CORRECTION_DEVELOPMENT_PLAN.md) | 纠错扩展实现计划与评估指标 | ⭐⭐⭐ |
| [中文语训反馈方案（2026-03-09）](MANDARIN_PRONUNCIATION_FEEDBACK_PLAN_2026-03-09.md) | 面向中文普通话场景的拼音、音节、声母/韵母/声调反馈设计 | ⭐⭐⭐ |
| [中文语训与录音上传页来源说明（2026-03-09）](MANDARIN_TRAINING_SOURCES_2026-03-09.md) | 训练句、难点标签、匿名上传元数据所依据的官方与权威资料 | ⭐⭐⭐ |
| [ASR/TTS 模型报告](LATEST_ASR_TTS_MODELS_REPORT.md) | 语音模型与生态调研（需持续更新） | ⭐⭐ |

### 阶段计划

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [Starter Kit 执行计划（2026-03-09）](plans/COMMUNICATION_STARTER_KIT_EXECUTION_PLAN_2026-03-09.md) | 第一句话 / 主动沟通闭环的执行记录 | ⭐ |
| [中文语训页第一阶段执行计划（2026-03-09）](plans/MANDARIN_TRAINING_EXECUTION_PLAN_2026-03-09.md) | `/contribute` 第一阶段页面闭环与上传边界 | ⭐ |
| [中文训练页 Phase 2 执行计划（2026-03-09）](plans/MANDARIN_MEMORY_PHASE2_EXECUTION_PLAN_2026-03-09.md) | 语料扩充、训练结果写回记忆与验证路径 | ⭐⭐ |

### 前端与 PWA

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [前端架构指南](FRONTEND_ARCHITECTURE.md) | 页面结构、交互流、前端技术分层 | ⭐⭐ |
| [PWA 实现指南](PWA_IMPLEMENTATION_GUIDE.md) | Service Worker、缓存策略、离线能力 | ⭐⭐ |

### 数据与部署

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [数据库设计](database/) | 数据库 schema 与迁移说明 | ⭐ |
| [Docker 部署说明（根目录）](../DOCKER_DEPLOY.md) | 容器部署与启动说明 | ⭐⭐ |

---

## 快速查找

**要评估 TEN 是否继续作为核心底座**
1. [TEN 框架能力与上限评估（2026-03-05）](TEN_FRAMEWORK_CAPABILITY_CEILING_REPORT_2026-03-05.md)

**要推进 AI 编程协作体系**
1. [AI 编程指导体系](AI_ENGINEERING_SYSTEM.md)
2. [AI 执行计划模板](AI_EXECUTION_PLAN_TEMPLATE.md)
3. [治理 Prompt 模板](aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md)
4. [执行计划归档](plans/README.md)

**要记录或筛选外部灵感**
1. [ideas 目录说明](../ideas/README.md)
2. [日常随手记](../ideas/DAILY_CAPTURE.md)
3. [长期讨论 / 调研](../ideas/LONG_TERM_TOPICS.md)

**要排执行优先级与里程碑**
1. [产品方向重排（2026-03-09）](COMMUNICATION_FIRST_PRODUCT_RESET_2026-03-09.md)
2. [主动沟通 Starter Kit 数据来源（2026-03-09）](COMMUNICATION_STARTER_KIT_SOURCES_2026-03-09.md)
3. [执行路线图（2026-03-05）](VOXFLAME_EXECUTION_ROADMAP_2026-03-05.md)

**要讨论首页、训练页、记忆和硬件联动应该先做什么**
1. [执行路线图（2026-03-05）](VOXFLAME_EXECUTION_ROADMAP_2026-03-05.md)
2. [产品方向重排（2026-03-09）](COMMUNICATION_FIRST_PRODUCT_RESET_2026-03-09.md)
3. [产品战略与用户研究统一报告（2026-03-05）](VOXFLAME_PRODUCT_STRATEGY_AND_USER_RESEARCH_2026-03-05.md)

**要推进记忆系统**
1. [统一记忆系统报告（2026-03-05）](VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md)

**要推进纠错能力**
1. [LLM 纠错开发计划](LLM_CORRECTION_DEVELOPMENT_PLAN.md)
2. [中文语训反馈方案（2026-03-09）](MANDARIN_PRONUNCIATION_FEEDBACK_PLAN_2026-03-09.md)
3. [中文训练页 Phase 2 执行计划（2026-03-09）](plans/MANDARIN_MEMORY_PHASE2_EXECUTION_PLAN_2026-03-09.md)
4. [中文语训与录音上传页来源说明（2026-03-09）](MANDARIN_TRAINING_SOURCES_2026-03-09.md)
5. [ASR/TTS 模型报告](LATEST_ASR_TTS_MODELS_REPORT.md)

**要做前端/PWA**
1. [前端架构指南](FRONTEND_ARCHITECTURE.md)
2. [PWA 实现指南](PWA_IMPLEMENTATION_GUIDE.md)

---

## 优先级说明

- ⭐⭐⭐ 必读：直接影响架构与路线
- ⭐⭐ 推荐：影响实现质量与迭代效率
- ⭐ 参考：按需查阅

---

## 相关资源

- [项目主文档](../CLAUDE.md)
- [当前任务](../.tasks/current.md)
- [Docker 编排](../docker-compose.yml)
