# VoxFlame Memory / Context / Model / Compaction Execution Plan

> 日期：2026-04-14
> 负责人：Codex + Founder
> 相关文档：
> - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](VOXFLAME_PRODUCT_PRD_2026-03-24.md)
> - [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)
> - [.tasks/current.md](../.tasks/current.md)

---

## 1. Task

- 标题：从最重要也最困难的 `记忆页 / 上下文管理 / 模型选择 / 压缩写回` 开始推进
- 目标：把 VoxFlame 从“已有主链的产品原型”推进到“可上线的 durable workspace 系统”

---

## 2. Context

### 当前现状

当前已经成立：

1. `frontend -> backend -> self-hosted livekit-server -> livekit_agent` 主链已跑通
2. `workspace snapshot` 已经存在，并被沟通页、训练页、记忆页消费
3. `prepared_expression`、hotword、训练总结已经有最小链路
4. `qwen-flash` 已在实时沟通链中工作

当前最关键的问题不是“有没有页面”，而是：

1. 记忆页的对象模型还没真正成形
2. runtime context assembly 还没制度化
3. 总结模型和实时模型还没真正分层
4. `flush -> compact -> durable write` 还没进 server-side 稳态

### 已知约束

1. durable owner 必须继续是 backend `workspace`
2. `dataset != memory` 不能打破
3. 不能把高时延模型塞回实时沟通主循环
4. 当前不引入新的通用 agent 平台，不新开一套 runtime

### 相关文件 / 文档

- `frontend/src/app/memory/page.tsx`
- `frontend/src/components/chat/ChatInterface.tsx`
- `frontend/src/lib/memory/memory-service.ts`
- `backend/src/services/supabase.service.ts`
- `backend/src/services/prepared-expression-summary.service.ts`
- `livekit_agent/session_userdata.py`
- `livekit_agent/assistant_runtime.py`
- `livekit_agent/app.py`

---

## 3. Governance Inventory

### 入口层

1. 记忆页：`frontend/src/app/memory/page.tsx`
2. 沟通页：`frontend/src/components/chat/ChatInterface.tsx`
3. 训练页：`frontend/src/app/contribute/page.tsx`
4. `useWorkspaceMemorySnapshot`
5. `useRtcAgentSession`

### 服务层

1. `backend/src/controllers/memory.controller.ts`
2. `backend/src/services/supabase.service.ts`
3. `backend/src/services/prepared-expression-summary.service.ts`
4. `livekit_agent/app.py`
5. `livekit_agent/assistant_runtime.py`
6. `livekit_agent/session_userdata.py`

### 存储层

1. Supabase `user_profiles`
2. Supabase `memories`
3. Supabase `sessions`
4. `voice_contributions`
5. `workspace snapshot` 聚合视图
6. 前端本地 `memoryService` / local queue

### 旁路层

1. training summary
2. session compaction
3. upload receipt / manifest
4. dataset review queue

### 哪些路径仍在运行

1. `workspace snapshot` 聚合
2. `prepared_expression` 读写和 summary
3. 前端本地 `session_compaction`
4. `assistant_runtime` 的 preparation-driven correction

### 哪些路径只是过渡

1. 前端 `memoryService.endSession()` 生成 `session_compaction`
2. 页面直接拼上下文的零散逻辑
3. `prepared_expression / hotword / preferences / summary` 分散对象模型

---

## 4. Source Of Truth And Path Classification

- 唯一事实源：backend `workspace`
- `current`：
  - `workspace snapshot`
  - `prepared_expression`
  - `assistant_runtime` correction
  - upload artifact / manifest
- `compat`：
  - 前端本地 `session_compaction`
  - 前端 `memoryService` 中的过渡式长期沉淀
- `deprecated`：
  - 页面各自拼长期画像
  - 把原始 transcript 当长期 memory
- `dead`：
  - 旧 websocket / 旧执行面主链

本次推进后准备逐步封掉的旧入口：

1. 前端本地 compaction 作为长期主入口
2. 页面级上下文自由拼装

退出条件：

1. `livekit_agent` server-side 接管 flush / compact / durable write
2. 沟通页 runtime 只按 loadout/context assembly 取上下文

---

## 5. Problem

### 要解决的核心问题

1. 让记忆页真正成为 `workspace owner` 的用户界面
2. 让沟通前的上下文装配可控、可解释、可复用
3. 让模型分层清楚：实时快模型，异步总结模型
4. 让会后压缩写回从“前端过渡方案”升级为“server-side 稳态链”

### 不在本次范围内的问题

1. 多 agent
2. 通用向量平台
3. 移动端独立 App
4. 大范围 UI 翻新

---

## 6. Success Criteria

### 用户 / 系统层面的验收标准

1. 记忆页能清楚管理 4 类对象：
   - 自定义材料区
   - 场景 / 热词模板
   - 用户个人画像
   - 训练总结
2. 沟通前用户可以看到并控制这次 `loadout`
3. runtime 能按固定 contract 装配上下文，而不是零散拼接
4. 会后沉淀通过 server-side `flush -> compact -> durable write` 写回
5. 实时模型和异步总结模型明确分工

### 明确的失败判定

1. 页面仍然在各自拼长期画像
2. `session_compaction` 仍主要由前端承担
3. 实时链被更大模型拖慢
4. 训练总结和用户画像边界仍然混乱

### 如何判断“治理不是只新增了一套实现”

1. 所有页面统一消费 `workspace snapshot` / `loadout view`
2. 旧前端 compaction 逻辑只保留过渡壳，不继续长新语义

---

## 7. Guardrails

### 产品约束

1. 沟通成功率优先于抽象“智能”
2. 记忆页先做可管理对象，不做花哨知识系统
3. 训练总结默认是系统草稿，不直接等于长期画像

### 工程约束

1. durable owner 继续在 backend
2. runtime 不直接写原始 transcript 到长期 memory
3. 实时链继续优先低时延模型

### 安全 / 隐私约束

1. 用户文档、画像、训练总结必须按用户隔离
2. 模型 summary 不得越权跨用户检索
3. 原始录音继续留在 dataset，不直接进长期画像

### 本次至少要新增的防扩散守卫

1. `context assembly` 输入 schema
2. `compaction payload` 输出 schema
3. `workspace document` 类型枚举
4. server-side compaction 单元测试

---

## 8. Assumptions

1. `qwen-flash` 继续作为实时沟通主模型
2. 异步总结可以接入更高容量的 Qwen 模型
3. 用户比起“自动变聪明”，更需要“可编辑、可加载、可理解”的材料系统

---

## 9. Plan

### Step 1：记忆页对象模型收口

目标：把记忆页从“准备稿 + 热词 + summary 的拼盘”收成正式对象系统。

先固定 4 类对象：

1. `custom_material`
2. `scene_template`
3. `profile_bundle`
4. `training_summary`

产出：

1. backend 数据结构
2. workspace snapshot 新视图
3. 记忆页列表 + 编辑器

### Step 2：上下文装配 contract 收口

目标：让沟通页和 runtime 之间不再自由拼装上下文。

固定 3 个阶段：

1. `assemble_context`
2. `after_turn`
3. `compact`

产出：

1. `communication_loadout`
2. runtime assembly schema
3. 页面到 runtime 的固定装配入口

### Step 3：模型分层落地

目标：把“实时链”和“异步总结链”拆开。

建议分层：

1. 实时：`qwen-flash`
2. 异步总结：更高容量 Qwen 模型
3. 批量任务：夜间 summary / distillation

产出：

1. 模型职责矩阵
2. backend summary job 入口
3. 训练总结 / 材料总结 / compaction 的统一任务定义

### Step 4：server-side compaction 落地

目标：把会后沉淀从前端过渡逻辑迁到 server-side 稳态。

固定顺序：

1. flush session-local facts
2. compact to durable candidate
3. write to workspace

产出：

1. `livekit_agent` compaction payload
2. backend durable write API
3. 回归测试

---

## 10. Files And Systems Expected To Change

- `frontend/src/app/memory/page.tsx`
- `frontend/src/components/chat/ChatInterface.tsx`
- `frontend/src/lib/memory/workspace-client.ts`
- `backend/src/services/supabase.service.ts`
- `backend/src/controllers/memory.controller.ts`
- `backend/src/services/prepared-expression-summary.service.ts`
- `livekit_agent/session_userdata.py`
- `livekit_agent/assistant_runtime.py`
- `livekit_agent/app.py`
- `docs/...`

---

## 11. Validation

### 最低验证

1. 记忆页对象区能正常读写
2. 沟通页能看到并发送 loadout
3. runtime 按新 contract 收到上下文
4. compaction 结果能稳定写回 workspace

### 扩展验证

1. 长会话 smoke
2. 多材料加载 smoke
3. 训练总结自动回流 smoke

### 如何验证旧入口已不再继续生长

1. 前端页面不再各自拼长期画像
2. 前端本地 compaction 不再是主入口

---

## 12. Risks And Rollback

### 主要风险

1. 记忆对象过多导致用户困惑
2. 上下文装配过重导致实时链变慢
3. 总结模型输出不稳定污染长期画像

### 回退方式

1. loadout view 保留只读降级
2. compaction 先写 draft，不直接写 always-on profile
3. 保留前端本地 compaction 作为短期 fallback

---

## 13. First Slice To Build

第一个可直接开工的切片固定为：

### Slice 1：`workspace document model + memory page object zones`

为什么先做这个：

1. 这是记忆页和上下文系统的共同骨架
2. 没有统一对象模型，后面的 loadout、模型分层、compaction 都会继续发散

这个切片只做：

1. 设计 4 类对象的 backend shape
2. 调整 `workspace snapshot` 返回结构
3. 记忆页先显示 4 个对象区和列表

这个切片先不做：

1. TTS 助手
2. 主动提醒
3. server-side compaction 全量迁移

---

## 14. Final Outcome

- 当前状态：计划已建立，等待进入 `Slice 1`
- 后续建议：下一步直接按 `workspace document model + memory page object zones` 开工
