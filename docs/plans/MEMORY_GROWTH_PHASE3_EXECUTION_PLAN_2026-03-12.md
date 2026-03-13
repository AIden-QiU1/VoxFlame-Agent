# Memory Growth + Mandarin Phase 3 Execution Plan

> 日期：2026-03-12
> 负责人：Codex
> 相关对话：统一 `/memory` 背后的 stats/session/trend 事实源；推进 `/contribute` Phase 3；扩治理守卫

## 1. Task

- 标题：Memory 成长档案与中文语训 Phase 3 收口
- 目标：
  - 把 `/memory` 从页面内临时聚合改成消费统一 growth profile
  - 让远端 `sessions` 事实源真正开始落库
  - 把 `/contribute` 的反馈升级到声母 / 韵母 / 声调差异和趋势写回
  - 把更多 deprecated API 与平级页面入口纳入治理守卫

## 2. Context

- 当前现状：
  - `/memory` 页面直接分别请求 `/memory/user`、`/memory/hotwords`，再和本地 memory 即时聚合
  - backend `memory/add` 不会创建 `sessions` 记录，远端 session/stats 事实源不完整
  - `/contribute` 目前只写回拼音对照、重点音节和动作提示
  - guard 脚本只拦 compat API 和 `/chat`
- 已知约束：
  - 主链路不能破坏：`Frontend -> Backend -> TEN Agent`
  - 匿名态继续 local-first；远端同步只对登录态生效
  - 训练反馈仍以文本 + 拼音规则为主，不引入新的声学模型

## 3. Governance Inventory

- 入口层：
  - `frontend/src/app/memory/page.tsx`
  - `frontend/src/app/contribute/page.tsx`
  - `frontend/src/hooks/useMandarinTrainingSession.ts`
  - `frontend/src/hooks/useAgent.ts`
- 服务层：
  - `frontend/src/lib/memory/memory-service.ts`
  - `backend/src/controllers/memory.controller.ts`
  - `backend/src/services/supabase.service.ts`
  - `ten_agent/extension_src/voxflame_main_python/extension.py`
- 存储层：
  - localStorage memory/session/sync queue
  - Supabase `sessions` / `memories`
  - TEN memory layer local store
- 旁路层：
  - `/memory` 页面 stats / trends / hotwords 展示
  - guard 脚本与 CI

补充：

- 仍在运行的主路径：
  - 本地记忆：`memoryService`
  - 远端同步：`POST /api/memory/add`
  - 页面读取：`/memory` + local memory 聚合
- 兼容或碎片路径：
  - `/api/memory/user/:userId`
  - `/api/memory/hotwords/:userId`
  - `/api/memory/stats/:userId`
  - `/ranyan`
- 旁路系统依赖：
  - memory page 直接依赖碎片 API
  - growth/trend 统计目前没有单一聚合层

## 4. Source Of Truth And Path Classification

- 唯一事实源：
  - 前端：`memory-growth` 聚合层
  - 后端：`/api/memory/profile/:userId`
- `current`：
  - `memoryService` 本地 session/memory 数据
  - `/api/memory/profile/:userId`
  - `/memory`
- `compat`：
  - `/api/memory/user/:userId`
  - `/api/memory/hotwords/:userId`
  - `/api/memory/stats/:userId`
  - `/ranyan`
- `deprecated`：
  - 前端直接拼装 memory stats/trends 的页面内逻辑
- `dead`：
  - 无

## 5. Success Criteria

- `/memory` 页面使用统一 profile 数据展示 stats / sessions / trends / 高频反馈点
- 训练记录会写回声母 / 韵母 / 声调差异 metadata
- 登录态 memory sync 会确保远端 session 行存在
- guard 能阻止旧 memory 碎片 API 与 `/ranyan` 再被新代码引用

## 6. Guardrails

- 产品约束：记忆页要强调“成长档案”，不夸张承诺“越来越懂你”
- 工程约束：不再让页面自己拼 stats/trend 事实源
- 安全约束：继续复用 auth/ownership 边界；不放宽 user-scoped 检查
- 最少新增守卫：
  - `scripts/check_ai_governance.sh` 扫描 `/api/memory/user`、`/api/memory/hotwords`、`/api/memory/stats`、`/ranyan`

## 7. Plan

1. 建立统一 growth profile 结构与本地聚合逻辑
2. backend 增加 `/api/memory/profile/:userId`，并在 `memory/add` 时 ensure session
3. `/memory` 页面切到 growth profile 并展示 sessions / trends / 发音趋势
4. `/contribute` 扩展到声母 / 韵母 / 声调差异与趋势 metadata
5. 扩 guard，封住旧 memory 碎片 API 与 `/ranyan`
6. 验证并同步状态文件
