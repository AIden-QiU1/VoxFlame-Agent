# AI Execution Plan Template

> 用于非 trivial 任务。目标不是先开改，而是先盘点、定锚、加守卫，再进入实现。

## 1. Task

- 标题：
- 日期：
- 负责人：
- 相关需求 / Issue / 对话：

## 2. Context

- 当前现状：
- 已知约束：
- 相关文件 / 文档：

## 3. Governance Inventory

先按四层盘点，不要跳过：

- 入口层：页面、组件、Hook、路由、前端 API 调用方
- 服务层：Service、Controller、命令、Workflow、事件入口、Agent handler
- 存储层：表、DAO、Repository、缓存、文件、向量库
- 旁路层：统计、记忆、搜索、审计、报表、任务系统、导出

补充：

- 哪些路径仍在运行：
- 哪些路径只是兼容或历史残留：
- 哪些旁路系统仍依赖旧路径：

## 4. Source Of Truth And Path Classification

- 唯一事实源：
- `current`：
- `compat`：
- `deprecated`：
- `dead`：
- 本次迁移后准备封掉的旧入口：
- 删除条件 / 退出条件：

## 5. Problem

- 要解决的核心问题：
- 不在本次范围内的问题：

## 6. Success Criteria

- 用户或系统层面的验收标准：
- 明确的失败判定：
- 如何判断“治理不是只新增了一套实现”：

## 7. Guardrails

- 产品约束：
- 工程约束：
- 安全约束：
- 数据 / 权限 / 隐私约束：
- 本次至少要新增的防扩散守卫：
  - lint / CI / 脚本 / deprecated 日志 / 结构化校验 / 其他

## 8. Assumptions

1.
2.
3.

## 9. Plan

1. 盘点当前实现与依赖
2. 定唯一事实源与分类
3. 建 compat 壳或迁移适配层（若需要）
4. 先加守卫，防止旧路径继续回流
5. 按切片迁移主入口 / 高频路径 / 旁路系统
6. 验证、删除与复盘
7. 文档与状态同步

## 10. Files And Systems Expected To Change

- `frontend/...`
- `backend/...`
- `ten_agent/...`
- `docs/...`
- CI / lint / script：
- 受影响的表 / 缓存 / 事件：
- 受影响的旁路系统：

## 11. Validation

- 最低验证：
- 扩展验证：
- 如何验证旧入口已不再继续生长：
- 无法完成的验证及原因：

## 12. Risks And Rollback

- 主要风险：
- 安全风险：
- 回退方式：
- 需要重点观察的指标 / 日志：

## 13. Notes During Execution

-

## 14. Final Outcome

- 实际完成内容：
- 仍未迁移的旧路径：
- 本次新增的守卫：
- 实际删除的内容：
- 未完成内容：
- 后续建议：
