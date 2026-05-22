# VoxFlame 技术文档导航

> 默认先看主文档，再按需看综合参考，不要先扎进旧研究稿。

## 现役入口

1. [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md)
   当前产品边界与上线后 `App / 硬件 / 自定义语音 agent / 记忆架构` 规划的权威主文档。
2. [当前任务状态](../.tasks/current.md)
   当前现役任务、最近 3 天有效结论、下一步优先级与验证基线。
3. [主项目 README](../README.md)
   当前代码现状、启动方式、开源协作入口和验证入口。
4. [开源协作方向（2026-04-21）](VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md)
   准备开源后，如何组织 `Web / App / 硬件 / 自主语音 agent` 这 4 条协作主线。
5. [前端 README](../frontend/README.md)
   当前页面系统、共享 `workspace` contract、训练资产链路与 PWA 边界。
6. [Full-stack 架构学习指南（2026-04-29）](VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md)
   把“面对一个需求，如何拆 surface / state / owner / contract / runtime / verification”沉淀成可复用的方法，并附官方文档与经典工程文章阅读路线。
7. [Expert Standard And Collaboration Playbook（2026-05-10）](VOXFLAME_EXPERT_STANDARD_AND_COLLABORATION_PLAYBOOK_2026-05-10.md)
   统一 `标准 / 技术 / 用户反馈` 三角闭环，定义专家材料、评测 prompt、沟通技巧、训练语料、memory、用户反馈登记和医学 / 沟通专家合作门槛。
8. [App / Mobile Workbench 最佳实践与机会文档（2026-05-04）](VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)
   判断当前为什么适合启动完整移动端工作台、为什么主线推荐 `Expo / React Native + LiveKit React Native`、如何复用现有 `workspace snapshot / recording envelope / upload receipt / RTC session orchestration`。
9. [Mobile Workbench Phase 0 RFC（2026-05-04）](VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md)
   当前 `apps/mobile-workbench` skeleton、四个一级 surface、移动端 contract boundary 和下一步实现顺序。
10. [Mobile Workbench 真机验证手册（2026-05-05）](VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md)
   明确 App 验证梯度：代码级检查、真机 development build、业务 smoke、小范围内测和正式上架；当前不需要先上架应用商店。
11. [硬件桥接开发手册（2026-05-05）](VOXFLAME_HARDWARE_BRIDGE_DEVELOPMENT_GUIDE_2026-05-05.md)
   ESP32-S3 / BLE 控制桥 / I2S 录音上传原型的硬件购买、官方文档、软硬件协议和验收手册。
12. [restsend Rust 通信栈与硬件音频桥研究（2026-05-16）](VOXFLAME_RESTSEND_RUST_STACK_AND_HARDWARE_AUDIO_BRIDGE_RESEARCH_2026-05-16.md)
   分析 restsend 作者的 `rustpbx / rsipstack / rustrtc / audio-codec` 对 VoxFlame 未来电话 / SIP / WebRTC / 音频网关和硬件音频桥的合作价值，并明确 ESP32-S3、手机 App、挂脖扬声器盒与耳挂麦克风的分工。
13. [第一功能：训练评估开发文档（2026-05-08）](VOXFLAME_TRAINING_ASSESSMENT_FUNCTION_DEVELOPMENT_2026-05-08.md)
   定义“训练表现分 / 系统听懂分”的产品边界、20 词筛查局限、普通话评估语料升级、模型职责和阶段路线。
14. [构音障碍病因差异参考（2026-05-15）](VOXFLAME_DYSARTHRIA_ETIOLOGY_DIFFERENCE_REFERENCE_2026-05-15.md)
   分析 CP、TBI、DS、Stroke、MS、ALS/MND、ASD、Parkinson、听力损失等不同病因导致沟通困难的本质差异，以及对 VoxFlame 训练、识别、音频设置和 profile schema 的启发。
15. [分病因言语康复与沟通产品化深度文档（2026-05-15）](VOXFLAME_REHAB_THERAPY_PRODUCT_MAPPING_BY_ETIOLOGY_2026-05-15.md)
   以 ReTalk / 复言的中风康复产品化样板为参照，逐病因拆解成熟疗法、科学原理、AI 自动化方式、专家边界和产品功能映射。
16. [Voiceitt 功能设置深度分析与 VoxFlame 启发（2026-05-15）](VOICEITT_FEATURE_SETTINGS_ANALYSIS_AND_VOXFLAME_INSPIRATION_2026-05-15.md)
   拆解 Voiceitt 的 Speak / Dictate / Integrations、训练、麦克风、停顿、短语、字幕、展示和账号数据设置，分析哪些值得 VoxFlame 吸收，哪些不应照搬。
17. [训练数据 schema 与 recorder pipeline 实施文档（2026-03-23）](VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md)
   当前数据录入、上传、manifest 和 recorder queue 的权威 contract。
18. [LiveKit 记忆最佳实践研究（2026-04-05）](VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md)
   把 LiveKit 官方的 session/state/data 原语翻成 VoxFlame 可执行的 memory 分层判断，明确 `LiveKit != durable memory owner`，以及 `Qdrant / Redis` 应分别放在哪一层。

## 综合参考

下面这些文档保留为概念参考、历史设计判断或按主题查阅入口；当前代码现状与下一步开发，不再以旧迁移文档为主入口。

1. [control-plane.md](control-plane.md)
   backend 控制面实现、session orchestration、surface contract 与诊断深文档。
2. [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
   吸收 `memory mechanisms / voice-agent-tooling` 后的统一 agent、memory、tooling 参考。
3. [LiveKit 记忆最佳实践研究（2026-04-05）](VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md)
   说明 LiveKit 的 `userdata / chat_ctx / participant attributes / session report` 各自适合承接什么，以及它和 `workspace snapshot / Qdrant / Redis` 的正确分工。

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
| [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md) | 当前产品边界与上线后扩展规划主文档 | ⭐⭐⭐ |
| [Expert Standard And Collaboration Playbook（2026-05-10）](VOXFLAME_EXPERT_STANDARD_AND_COLLABORATION_PLAYBOOK_2026-05-10.md) | `标准 / 技术 / 用户反馈` 三角闭环、专家材料、用户反馈 registry、医学 / 沟通专家合作和开发准入门槛 | ⭐⭐⭐ |
| [开源协作方向（2026-04-21）](VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md) | 开源后 `Web / App / 硬件 / 自主语音 agent` 的协作主线 | ⭐⭐⭐ |
| [App / Mobile Workbench 最佳实践与机会文档（2026-05-04）](VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md) | 完整移动端工作台的技术路线、官方约束、机会点、阶段计划和创始人需要把控的技术方向 | ⭐⭐⭐ |
| [Mobile Workbench Phase 0 RFC（2026-05-04）](VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md) | `apps/mobile-workbench` 的 skeleton、surface、contract boundary 和实现顺序 | ⭐⭐⭐ |
| [Mobile Workbench 真机验证手册（2026-05-05）](VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md) | App 从代码检查到真机 smoke、内测分发和正式上架的验证梯度 | ⭐⭐⭐ |
| [硬件桥接开发手册（2026-05-05）](VOXFLAME_HARDWARE_BRIDGE_DEVELOPMENT_GUIDE_2026-05-05.md) | ESP32-S3、BLE 控制桥、I2S 录音上传原型的购买、开发、协议和验收指南 | ⭐⭐⭐ |
| [restsend Rust 通信栈与硬件音频桥研究（2026-05-16）](VOXFLAME_RESTSEND_RUST_STACK_AND_HARDWARE_AUDIO_BRIDGE_RESEARCH_2026-05-16.md) | 判断 restsend 作者作为通信栈 / 音频网关合作者的价值，以及 ESP32-S3、手机 App、耳挂麦克风、挂脖扬声器盒和未来 SIP/WebRTC 网关的分工 | ⭐⭐⭐ |
| [第一功能：训练评估开发文档（2026-05-08）](VOXFLAME_TRAINING_ASSESSMENT_FUNCTION_DEVELOPMENT_2026-05-08.md) | `训练表现分 / 系统听懂分` 的产品边界、语料升级、评分 contract 和模型职责 | ⭐⭐⭐ |
| [构音障碍病因差异参考（2026-05-15）](VOXFLAME_DYSARTHRIA_ETIOLOGY_DIFFERENCE_REFERENCE_2026-05-15.md) | CP、TBI、DS、Stroke、MS、ALS/MND、ASD、Parkinson、听力损失等 diagnosis label 背后的言语机制差异和产品启发 | ⭐⭐⭐ |
| [分病因言语康复与沟通产品化深度文档（2026-05-15）](VOXFLAME_REHAB_THERAPY_PRODUCT_MAPPING_BY_ETIOLOGY_2026-05-15.md) | 逐病因映射成熟疗法、医院常用训练原则、AI 自动化边界、专家复核边界和 VoxFlame 可落地功能 | ⭐⭐⭐ |
| [Voiceitt 功能设置深度分析与 VoxFlame 启发（2026-05-15）](VOICEITT_FEATURE_SETTINGS_ANALYSIS_AND_VOXFLAME_INSPIRATION_2026-05-15.md) | 竞品模式、设置项、训练闭环、跨平台输出和 VoxFlame 短中期吸收路线 | ⭐⭐⭐ |
| [Full-stack 架构学习指南（2026-04-29）](VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md) | 从真实需求拆到 surface、state 生命周期、owner、contract、runtime、failure 和 verification 的学习与实践路线 | ⭐⭐⭐ |
| [LiveKit 记忆最佳实践研究（2026-04-05）](VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md) | 把 LiveKit 官方 session/state/data 原语翻成 VoxFlame 的 memory 分层、context assembly 和 recall 判断 | ⭐⭐⭐ |
| [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md) | agent、memory、tooling 与 dataset/memory 边界的综合参考 | ⭐⭐⭐ |
| [control-plane.md](control-plane.md) | backend 控制面实现、schema 与诊断深文档 | ⭐⭐ |
| [capability-registry.md](capability-registry.md) | 仓库协作 capability registry 盘点表 | ⭐⭐ |

### 训练数据与纠错

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [第一功能：训练评估开发文档（2026-05-08）](VOXFLAME_TRAINING_ASSESSMENT_FUNCTION_DEVELOPMENT_2026-05-08.md) | 当前 20 词筛查的局限、普通话音系评估语料升级和训练表现分路线 | ⭐⭐⭐ |
| [构音障碍病因差异参考（2026-05-15）](VOXFLAME_DYSARTHRIA_ETIOLOGY_DIFFERENCE_REFERENCE_2026-05-15.md) | 不同疾病标签背后的 dysarthria / apraxia / aphasia / hearing feedback / prosody / progression 差异，指导 profile、训练和沟通策略 | ⭐⭐⭐ |
| [分病因言语康复与沟通产品化深度文档（2026-05-15）](VOXFLAME_REHAB_THERAPY_PRODUCT_MAPPING_BY_ETIOLOGY_2026-05-15.md) | 从 ReTalk 中风样板出发，为每类病因定义最适合的训练 / 沟通功能、AI 接轨方式和专家边界 | ⭐⭐⭐ |
| [Voiceitt 功能设置深度分析与 VoxFlame 启发（2026-05-15）](VOICEITT_FEATURE_SETTINGS_ANALYSIS_AND_VOXFLAME_INSPIRATION_2026-05-15.md) | Voiceitt 训练、Speak、Dictate、Integrations 和设置项拆解，指导 VoxFlame 训练、沟通和设置收口 | ⭐⭐⭐ |
| [训练数据 schema 与 recorder pipeline 实施文档（2026-03-23）](VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md) | `recording schema / recorder queue / manifest / upload` 的权威 contract | ⭐⭐⭐ |
| [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md) | 当前上线基线，以及 `App / 硬件 / 自定义语音 agent / 记忆架构` 的主规划 | ⭐⭐⭐ |

### Memory

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md) | 统一后的 memory 主文档：本地事实源、typed profile bundle、context service、context-engine 分层与上线前稳态要求 | ⭐⭐⭐ |
| [LiveKit 记忆最佳实践研究（2026-04-05）](VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md) | 当前 LiveKit memory/session 官方 best practices 与 VoxFlame 的具体映射 | ⭐⭐⭐ |

### 前端与体验面

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [前端 README](../frontend/README.md) | 当前页面系统、训练资产链路与 PWA 边界 | ⭐⭐⭐ |
| [UI / 前端页面设计与实践报告（2026-04-19）](UI_FRONTEND_PAGE_DESIGN_REPORT_VIBE_CODING_2026-04-19.md) | 从经典设计原则出发，重写成 vibe coding 时代依然能落地的页面方法论、实践路径与检查清单 | ⭐⭐ |

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
| [腾讯云中国大陆正式上线步骤（2026-04-20）](TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md) | 当前仓库在腾讯云中国大陆从“已开端口、可预览”推进到“正式域名、备案完成、HTTPS 正式上线”的执行手册 | ⭐⭐⭐ |

## 快速查找

**继续开发应该先看什么**
1. [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md)
2. [当前任务状态](../.tasks/current.md)
3. [主项目 README](../README.md)
4. [Expert Standard And Collaboration Playbook（2026-05-10）](VOXFLAME_EXPERT_STANDARD_AND_COLLABORATION_PLAYBOOK_2026-05-10.md)
5. [Full-stack 架构学习指南（2026-04-29）](VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md)
6. [训练数据 schema 与 recorder pipeline 实施文档（2026-03-23）](VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md)
7. [第一功能：训练评估开发文档（2026-05-08）](VOXFLAME_TRAINING_ASSESSMENT_FUNCTION_DEVELOPMENT_2026-05-08.md)
8. [构音障碍病因差异参考（2026-05-15）](VOXFLAME_DYSARTHRIA_ETIOLOGY_DIFFERENCE_REFERENCE_2026-05-15.md)
9. [分病因言语康复与沟通产品化深度文档（2026-05-15）](VOXFLAME_REHAB_THERAPY_PRODUCT_MAPPING_BY_ETIOLOGY_2026-05-15.md)
10. [Voiceitt 功能设置深度分析与 VoxFlame 启发（2026-05-15）](VOICEITT_FEATURE_SETTINGS_ANALYSIS_AND_VOXFLAME_INSPIRATION_2026-05-15.md)
11. [LiveKit 记忆最佳实践研究（2026-04-05）](VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md)

**要判断 runtime / surface / PWA / App 方向**
1. [App / Mobile Workbench 最佳实践与机会文档（2026-05-04）](VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)
2. [Mobile Workbench Phase 0 RFC（2026-05-04）](VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md)
3. [Mobile Workbench 真机验证手册（2026-05-05）](VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md)
4. [control-plane.md](control-plane.md)
5. [前端 README](../frontend/README.md)
6. [开源协作方向（2026-04-21）](VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md)
7. 当前代码现状以 [产品 PRD（2026-03-24）](VOXFLAME_PRODUCT_PRD_2026-03-24.md) 和 [当前任务状态](../.tasks/current.md) 为准

**要判断开源协作 / App / 硬件 / 自主语音 agent 架构**
1. [开源协作方向（2026-04-21）](VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md)
2. [App / Mobile Workbench 最佳实践与机会文档（2026-05-04）](VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)
3. [Mobile Workbench Phase 0 RFC（2026-05-04）](VOXFLAME_MOBILE_WORKBENCH_PHASE0_RFC_2026-05-04.md)
4. [Mobile Workbench 真机验证手册（2026-05-05）](VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md)
5. [硬件桥接开发手册（2026-05-05）](VOXFLAME_HARDWARE_BRIDGE_DEVELOPMENT_GUIDE_2026-05-05.md)
6. [restsend Rust 通信栈与硬件音频桥研究（2026-05-16）](VOXFLAME_RESTSEND_RUST_STACK_AND_HARDWARE_AUDIO_BRIDGE_RESEARCH_2026-05-16.md)
7. [主项目 README](../README.md)
8. [前端 README](../frontend/README.md)

**要判断 agent / memory / tooling 边界**
1. [Agent, Memory And Tooling Reference（2026-03-26）](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
2. [LiveKit 记忆最佳实践研究（2026-04-05）](VOXFLAME_LIVEKIT_MEMORY_BEST_PRACTICES_2026-04-05.md)

**要继续做录音、上传和训练资产**
1. [第一功能：训练评估开发文档（2026-05-08）](VOXFLAME_TRAINING_ASSESSMENT_FUNCTION_DEVELOPMENT_2026-05-08.md)
2. [训练数据 schema 与 recorder pipeline 实施文档（2026-03-23）](VOXFLAME_DATASET_SCHEMA_AND_RECORDER_PIPELINE_IMPLEMENTATION_2026-03-23.md)
3. [前端 README](../frontend/README.md)

## 优先级说明

- ⭐⭐⭐ 直接影响当前开发路线
- ⭐⭐ 按需查阅
- ⭐ 纯参考
