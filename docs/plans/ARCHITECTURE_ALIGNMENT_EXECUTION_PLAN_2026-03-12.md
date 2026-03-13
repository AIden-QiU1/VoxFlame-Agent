# Architecture Alignment Execution Plan

> 用于修复首页、训练反馈、agent 对齐和记忆系统的结构性偏差。

## 1. Task

- 标题：前后端 / Agent / 记忆系统对齐修复
- 日期：2026-03-12
- 负责人：Codex
- 相关需求 / Issue / 对话：用户要求“逐个修复观察到的问题，深度修复”

## 2. Context

- 当前现状：`Frontend -> Backend WS Proxy -> TEN Agent` 主链路可运行，首页与训练页已成型，但产品叙事与真实能力仍有偏差。
- 已知约束：
  - 不能破坏主链路。
  - 训练反馈不能伪装成医学诊断。
  - 记忆必须保持 local-first 和最小必要存储。
- 相关文件 / 文档：
  - `frontend/src/components/home/HomeDashboard.tsx`
  - `frontend/src/app/contribute/page.tsx`
  - `frontend/src/lib/training/mandarin-feedback.ts`
  - `frontend/src/lib/memory/memory-service.ts`
  - `backend/src/index.ts`
  - `backend/src/controllers/agent.controller.ts`
  - `ten_agent/extension_src/voxflame_main_python/extension.py`
  - `ten_agent/extension_src/memory_layer_python/*`

## 3. Problem

- 要解决的核心问题：
  - 首页信息过载，`查看进展与记忆` 没有真实落地页。
  - 训练页录音激励不够强，反馈深度不足，缺少拼音 / 音节 / 发声动作层的信息。
  - backend `/api/agent/*` 与真实主链路脱节。
  - TEN memory layer 的匿名隔离、检索边界和事实源结构不够稳。
- 不在本次范围内的问题：
  - 全量语义向量检索落地。
  - 硬件联动和环境声音提醒原型。
  - 医疗级声学诊断。

## 4. Success Criteria

- 用户或系统层面的验收标准：
  - 首页首屏显著收缩，三大入口更直接。
  - 新增真实的进展 / 记忆页面，能消费已有训练和沟通数据。
  - `/contribute` 能展示更细的拼音和发声动作反馈。
  - 匿名用户不再共享同一个 TEN memory 用户身份。
  - final ASR 进入纠错前可触发动态记忆检索。
  - backend 不再保留误导性的示例 agent 行为。
- 明确的失败判定：
  - 训练 / 沟通链路无法连接。
  - 匿名用户仍写入共享 `anonymous` 记忆。
  - 页面只改文案，未增加真实记忆消费或反馈深度。

## 5. Guardrails

- 产品约束：
  - 可理解性优先于炫技。
  - 录音价值要先落到用户反馈，再谈上传。
- 工程约束：
  - 不引入显式 `any`。
  - 保持前端 App Router 和 backend / TEN 分层清晰。
- 数据 / 权限 / 隐私约束：
  - 匿名身份只做本地可持续标识，不与真实账号混淆。
  - 未授权上传不自动出站。

## 6. Assumptions

1. 当前无麦克风真实设备时，仍可通过页面结构和无录音退化流程验证。
2. 训练反馈的首阶段深化可以依赖现有训练语料的拼音元数据完成，不强依赖新增第三方拼音库。
3. `/api/agent/*` 当前无前端关键依赖，可以安全收紧或显式降级。

## 7. Plan

1. 修复匿名身份和 TEN memory 隔离。
2. 接入动态记忆检索，补齐 memory context 真正消费链路。
3. 重构首页信息架构并新增真实记忆页。
4. 升级训练页反馈层和用户录音激励。
5. 收紧 backend 示例 agent 接口并完成验证。

## 8. Files Expected To Change

- `frontend/src/components/home/...`
- `frontend/src/app/contribute/...`
- `frontend/src/app/memory/...`
- `frontend/src/lib/training/...`
- `frontend/src/lib/memory/...`
- `frontend/src/lib/identity/...`
- `backend/src/index.ts`
- `backend/src/controllers/agent.controller.ts`
- `ten_agent/extension_src/voxflame_main_python/...`
- `ten_agent/extension_src/memory_layer_python/...`

## 9. Validation

- 最低验证：
  - `npx tsc --noEmit`（frontend / backend）
  - `bash scripts/check_ai_docs.sh`
  - 首页、训练页、记忆页 smoke test
- 扩展验证：
  - Playwright 真实浏览器检查首页入口、训练页反馈区、记忆页渲染
  - 训练链路与匿名身份在日志中的基本检查
- 无法完成的验证及原因：
  - 无真实麦克风设备时，无法完成录音采集端到端声学验证

## 10. Risks And Rollback

- 主要风险：
  - TEN memory 路径调整后出现历史数据读取兼容问题。
  - 首页重构影响现有导航习惯。
  - backend agent 接口收紧影响未发现的外部依赖。
- 回退方式：
  - 逐文件回退本次改动。
- 需要重点观察的指标：
  - WebSocket 连接稳定性
  - 匿名 session 的 memory 写入隔离
  - 训练页页面状态回退

## 11. Notes During Execution

- 先修记忆隔离和真实入口，再处理训练反馈细化。

## 12. Final Outcome

- 实际完成内容：
- 未完成内容：
- 后续建议：
