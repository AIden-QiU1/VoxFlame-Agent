# 中文训练页 Phase 2 执行计划（2026-03-09）

> 目标：在第一阶段训练页基础上，继续扩充高价值中文语料，并把训练结果写回真正可复用的记忆系统。

## 1. Task

- 标题：中文训练页第二阶段：语料扩充与记忆写回
- 日期：2026-03-09
- 负责人：Codex
- 相关对话：2026-03-09 当前阶段推进

## 2. Context

- `/contribute` 第一阶段已经完成：目标句、拼音、实时转写、录后反馈和匿名上传已闭环。
- 现有训练句规模仍然偏小，覆盖不到更多真实场景。
- 训练结果目前主要停留在页面反馈和上传 metadata，还没有正式进入长期记忆与 agent 热词。

## 3. Problem

- 要解决的核心问题：
  - 高价值中文训练句还不够，场景覆盖偏薄。
  - 训练结果没有稳定进入 agent 可用的记忆层，后续无法形成“越练越懂你”的飞轮。
- 不在本次范围内的问题：
  - 医学级声学诊断
  - 趋势图 UI
  - 康复师报告页

## 4. Success Criteria

- 高价值中文训练句数量明显增加，并保留来源可追溯、拼音、focus tags 和关键词。
- 每次训练结果都会：
  - 写入前端 / 后端 memory 体系，便于后续页面趋势与复盘
  - 写入 TEN memory layer，形成训练摘要与热词更新
- 至少能通过日志验证 TEN 收到了训练结果并更新 memory layer。

## 5. Guardrails

- 产品约束：
  - 继续坚持“高价值场景优先”，不做无来源大语料库。
  - 训练记忆只记录最小必要结果，不夸大结论。
- 工程约束：
  - 不破坏现有沟通链路和录音上传闭环。
  - TEN 侧只新增最小命令入口，不做大范围 memory 重构。
- 数据 / 权限 / 隐私约束：
  - 匿名用户允许本地记忆与 TEN 本地 memory 记录。
  - 有登录态时才尝试同步后端 memory API。

## 6. Plan

1. 收敛 `docs/` 顶层结构，把阶段性计划移入 `docs/plans/`。
2. 扩充高价值中文训练句，并补 `keywords` 等面向记忆的元数据。
3. 在前端训练页中把训练结果写入 memory service。
4. 通过 WebSocket 把训练结果命令发送给 TEN 主控，再由主控写入 memory layer。
5. 做类型检查、Python 校验、Docker 构建、Playwright 和日志验证。

## 7. Validation

- `cd frontend && npx tsc --noEmit`
- `python3 -m py_compile ...`
- `bash scripts/check_ai_docs.sh`
- `sudo docker compose build frontend ten-agent`
- `sudo docker compose up -d frontend backend ten-agent`
- Playwright 打开 `/contribute` 验证新语料和基本交互
- 日志验证 TEN 收到 `training_result`

## 8. Risks

- TEN 训练结果命令如果没有被正确路由，记忆写回会停留在前端 / 后端层。
- 热词写回过度会污染 voice profile，因此只写入关键词，不直接写整句。

## 9. Final Outcome

- 实际完成内容：
  - `docs/` 顶层开始收敛，阶段性计划统一进入 `docs/plans/`。
  - 中文训练语料继续沿陌生人开口、就医沟通、家人照护、紧急求助四类高价值场景扩充，并补齐 `keywords`。
  - `/contribute` 在录后反馈后会把训练摘要写入前端 `memoryService`，登录态时继续尝试同步后端 memory API。
  - 训练页会通过 WebSocket 发送 `training_result` 给 TEN；`main_control` 已把结果写入 `save_conversation`，并把关键词更新到 `voice_profile.hotwords`。
  - 真实验证已经覆盖：`npx tsc --noEmit`、`python3 -m py_compile`、`bash scripts/check_ai_docs.sh`、`sudo docker compose build frontend ten-agent`、`sudo docker compose up -d frontend backend ten-agent`、Playwright 页面检查、TEN 日志检查。
- 未完成内容：
  - 训练历史趋势页和更细的拼音 / 音节级反馈还未落地。
  - 由于当前 Playwright 环境没有可用麦克风设备，仍未完成“真实录音 -> 页面反馈 -> 前端本地记忆”整条浏览器端到端回放。
- 后续建议：
  - 下一切片先做训练历史趋势和个体练习统计，直接消费现有 `feedback_status / focus_tags / keywords`。
  - 再进入更细的拼音 / 音节级规则层，避免先做大 UI 再补底层结构。
