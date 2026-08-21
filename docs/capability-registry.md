# VoxFlame Capability Registry

> 状态：过渡治理表。
>
> - 产品运行时 capability 的长期主参考应逐步收口到 [产品 PRD](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)、[control-plane.md](/home/ubuntu/VoxFlame-Agent/docs/control-plane.md) 和具体 surface 专题文档
> - 仓库协作与 engineering capabilities 的长期入口应继续回到 `AGENTS.md` 与协作文档体系
>
> 本文档当前只保留 `repo engineering capabilities` 的盘点角色，不再维护产品运行时 capability 主表。

## 为什么现在就要建 registry

`Capability Plane` 是当前 `VoxFlame` 五层里最薄的一层。

现在仓库里已经同时存在：

- 运行时能力
- 训练相关能力
- 记忆读写能力
- 工程协作能力
- skill / MCP / smoke / diagnostics

如果没有 registry，系统很容易出现这几种问题：

- 页面一有需求就直接加按钮或事件
- backend 一有需求就直接加 API 而不定义边界
- TEN 一有需求就直接加 extension 行为
- AGENTS 里写了很多 skill，但没有明确“什么时候用、验证方式是什么”

这份文档的目标是把“有这个能力”与“这个能力可以被谁调用、依赖什么、怎么验证”区分开。

## Registry 字段

每个 capability 至少要回答下面这些问题：

- `capability_id`
- `plane`
- `owner`
- `callers`
- `mode_scope`
- `surface_scope`
- `side_effect_level`
- `dependencies`
- `source_of_truth`
- `smoke_or_verification`
- `status`

## Side Effect 分级

- `read_only`
  只读，不改外部状态
- `session_mutation`
  会改会话态，但不改长期用户数据
- `profile_mutation`
  会改用户画像、训练摘要或长期记忆
- `external_effect`
  会对设备、第三方服务或用户外部环境产生明显副作用

产品运行时 capability 现以 [产品 PRD](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 的产品边界、[control-plane.md](/home/ubuntu/VoxFlame-Agent/docs/control-plane.md) 的 backend 实现边界，以及具体 surface 专题文档为准；App / Mobile Workbench 方向见 [VoxFlame App / Mobile Workbench Best Practices And Opportunity（2026-05-04）](/home/ubuntu/VoxFlame-Agent/research/product-engineering/VOXFLAME_APP_COMPANION_BEST_PRACTICES_AND_OPPORTUNITY_2026-05-04.md)。

## 当前保留：工程协作 capability registry

这一组不是产品运行时能力，而是仓库协作 agent 能调用的工程能力。它们应该被看成 `repo engineering capabilities`，而不是随手写在 prompt 里的偏好。

| capability_id | plane | owner | callers | mode_scope | surface_scope | side_effect_level | dependencies | source_of_truth | smoke_or_verification | status |
|---|---|---|---|---|---|---|---|---|---|---|
| `official_api_lookup` | capability | repo agent | maintainer / codex session | n/a | repo collaboration | `read_only` | OpenAI docs or Context7 | [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) | official doc query succeeds | `active` |
| `ui_flow_smoke` | capability | repo agent | maintainer / codex session | n/a | repo collaboration | `read_only` | Playwright or `gstack-browse` | [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) | browser smoke | `active` |
| `plan_multidisciplinary_review` | capability | repo agent | maintainer / codex session | n/a | repo collaboration | `read_only` | `gstack-plan-*`, `gstack-autoplan` | [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) | plan review output exists | `active` |
| `root_cause_debugging` | capability | repo agent | maintainer / codex session | n/a | repo collaboration | `read_only` | `systematic-debugging`, `gstack-investigate` | [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) | investigation notes + verification | `active` |
| `frontend_design_polish` | capability | repo agent | maintainer / codex session | n/a | repo collaboration | `read_only` | `frontend-design`, `baseline-ui`, `fixing-accessibility`, `fixing-motion-performance` | [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) | visual smoke + review | `active` |
| `issue_workflow_ops` | capability | repo agent | maintainer / codex session | n/a | repo collaboration | `external_effect` | Linear MCP | [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md) | read/write issue smoke | `active` |

## 当前边界规则

### Rule 1

先定义 capability，再决定哪个 surface 暴露它。

### Rule 2

一个 capability 必须能说清：

- 谁是 owner
- 谁能调用
- 有无副作用
- 如何 smoke

### Rule 3

`可发现` 不等于 `可调用`，`可调用` 不等于 `默认暴露`。

### Rule 4

训练相关 capability 默认先按 `training-only` 处理，避免被沟通主链误调用。

### Rule 5

repo engineering capabilities 允许写在 `AGENTS.md` 里做路由，但它们仍然应该被视作 registry 中的正式能力，而不是临时技巧。

## 下一步最小治理动作

### 1. 先把 planned 项补到只读诊断

优先补：

- `provider_health_check`
- `current_mode_capability_matrix`
- `last_smoke_status`

### 2. 把高风险 mutation 能力收口

优先明确：

- `voice_profile_update`
- `memory_profile_write`

要不要走自动写入、阈值写入还是人工确认。

### 3. 让每个关键 capability 都有最小 smoke

至少保证：

- 会话可启动
- 训练反馈可回传
- 画像可更新
- Qwen ASR/TTS 可独立 live smoke

## 当前结论

`VoxFlame` 现在已经有很多工程协作能力，但还缺更清楚的入口治理语言。

这份 registry 剩下的意义不是增加流程负担，而是防止仓库协作以后继续靠：

- 页面按钮
- 零散事件名
- prompt 习惯
- 某个维护者的记忆

来决定系统到底能做什么。
