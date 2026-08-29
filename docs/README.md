# VoxFlame 技术文档导航

> `docs/` 只承接产品、运行时、工程规则、执行计划和运维文档。研究统一进入 [`research/`](../research/)，模型实验原始记录进入 [`references/clear-vox-model/`](../references/clear-vox-model/)。

## 现役事实源

1. [产品 PRD](VOXFLAME_PRODUCT_PRD_2026-03-24.md)：产品边界、页面职责和当前路线。
2. [当前任务](../.tasks/current.md)：短期执行顺序、验证和阻塞。
3. [主项目 README](../README.md)：架构、启动和协作入口。
4. [AI 工程系统](AI_ENGINEERING_SYSTEM.md)：仓库治理、安全与 AI 协作规则。
5. [AI 执行计划模板](AI_EXECUTION_PLAN_TEMPLATE.md)：复杂任务计划与验证模板。
6. [Harness 入口契约](aiprompts/HARNESS_ENTRY_CONTRACT.md)：从 AGENTS.md 分流到研究、实施、验证和人工确认。

## 研究入口

- [研究总入口](../research/README.md)：五大主题、证据边界和工作流。
- [研究到应用回流登记](../research/APPLICATION_FEEDBACK_REGISTRY.md)：`adopt / validate / hold / reject` 决策唯一登记。
- [Voice agent](../research/voice-agent/README.md)
- [通用 Agent 系统](../research/agent-systems/README.md)
- [语音底层与医疗/健康](../research/speech-health/README.md)
- [产品与用户心理](../research/product-psychology/README.md)
- [应用/全栈与商业化质量](../research/product-engineering/README.md)
- [CLEAR-VOX-MODEL 上游实验仓库](../references/clear-vox-model/README.md)

研究结论不会自动改变产品或运行时。只有进入回流登记、指定现役 owner、完成最小实现与验证后，才能同步到 PRD、任务和代码。

## 产品、运行时与架构

- [App / Mobile Workbench V1 实施计划](VOXFLAME_MOBILE_V1_IMPLEMENTATION_PLAN_2026-07-23.md)
- [Mobile Workbench 真机验证手册](VOXFLAME_MOBILE_WORKBENCH_DEVICE_VERIFICATION_RUNBOOK_2026-05-05.md)
- [硬件桥接开发手册](VOXFLAME_HARDWARE_BRIDGE_DEVELOPMENT_GUIDE_2026-05-05.md)
- [Backend control plane](control-plane.md)
- [Capability registry](capability-registry.md)
- [前端 README](../frontend/README.md)
- [后端 README](../backend/README.md)
- [LiveKit Agent README](../livekit_agent/README.md)

## 安全、数据与部署

- [网络安全整改记录](NETWORK_SECURITY_REMEDIATION_2026_267.md)
- [WAIC 安全清单](WAIC_SECURITY_CHECKLIST_2026-07-08.md)
- [数据库 schema](database/supabase-schema.sql)

## AI workflow

- [Workflow 入口](aiprompts/README.md)
- [Skill 路由](aiprompts/SKILL_ROUTING_GUIDE.md)
- [Context7 研究指南](aiprompts/CONTEXT7_RESEARCH_GUIDE.md)
- [Playwright 验证指南](aiprompts/PLAYWRIGHT_VERIFICATION_GUIDE.md)
- [用户研究 handoff 模板](aiprompts/USER_RESEARCH_HANDOFF_TEMPLATE.md)
- [AGENTS 文件系统指南](aiprompts/AGENTS_FILE_SYSTEM_GUIDE.md)
- [治理任务模板](aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md)
- [设计语言](aiprompts/design-language.md)

## 归档原则

- 已被综合文档吸收的研究稿从现役树删除，由 Git 历史保留。
- 失效或不存在的历史文档不继续挂在导航中。
- `docs/` 不再新增五大主题的平级研究稿；新增研究从 `research/templates/` 开始。
- 模型实验结果不复制进应用仓库；只记录固定 commit、原始路径、应用结论和验证门槛。
