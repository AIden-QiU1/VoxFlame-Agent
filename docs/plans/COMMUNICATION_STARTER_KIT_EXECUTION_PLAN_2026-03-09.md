# 主动沟通 Starter Kit 执行计划（2026-03-09）

## 1. Task

- 标题：第一句话 / 主动沟通闭环
- 日期：2026-03-09
- 负责人：Codex
- 相关需求 / 对话：`current.md` P0 第一优先级；用户明确要求场景模板与语料必须基于高质量来源整理

## 2. Context

- 当前现状：
  - 首页已重构为公开产品首页，但沟通模式内部还没有真正的 starter kit 入口。
  - `QuickPhrasesPanel` 已有分类和 CRUD，但预设短语内容偏原型，且通过 WebSocket 发送纯文本会收到 `Missing "audio" field`。
  - `ChatInterface` 目前仍以聊天区为主，不符合“先帮用户说第一句话”的目标。
- 已知约束：
  - 不能靠拍脑袋新增场景模板和短语。
  - 近期要优先支持中文场景，且要兼容未登录用户试用。
  - 不能破坏 `Frontend -> Backend -> TEN Agent` 主链路。
- 相关文件 / 文档：
  - `frontend/src/components/chat/ChatInterface.tsx`
  - `frontend/src/components/phrases/*`
  - `frontend/src/hooks/usePhrases.ts`
  - `frontend/src/lib/types/phrases.ts`
  - `backend/src/scripts/run-migration.ts`
  - `ten_agent/extension_src/websocket_server/*`
  - `ten_agent/extension_src/voxflame_main_python/extension.py`
  - [产品方向重排](../COMMUNICATION_FIRST_PRODUCT_RESET_2026-03-09.md)

## 3. Problem

- 要解决的核心问题：
  - 用户进入沟通模式后，仍然太像“聊天系统”，缺少可立即表达第一句话的场景化入口。
  - 短语点击和文本输入没有形成稳定的“一键代播”路径。
- 不在本次范围内的问题：
  - 中文训练页重构
  - 长期记忆产品化页面
  - 硬件 / App / Web 联动

## 4. Success Criteria

- 用户或系统层面的验收标准：
  - 用户进入沟通模式后，能在 1 到 2 步内触发高价值场景的第一句话。
  - 预设场景和短语来源可追溯到 AAC / 医疗沟通等高质量资料。
  - 一键代播、文本输入代播、打断 / 返回路径都可运行。
- 明确的失败判定：
  - 场景模板仍然是任意拼凑。
  - 文本或短语仍然走不通真实 TTS 回路。
  - 新入口让匿名试用退化为错误态。

## 5. Guardrails

- 产品约束：
  - 先做补偿沟通，不把用户丢进自由聊天框。
  - 主入口优先覆盖医疗、家庭、陌生人、紧急这类高价值场景。
- 工程约束：
  - 最小切片推进，先打通 starter kit 和代播协议，再扩展模板规模。
  - 场景模板和短语结构要可扩展到后续个体记忆。
- 数据 / 权限 / 隐私约束：
  - 未登录用户只试用，不写入个体化数据。
  - 登录后再允许保存自定义短语和使用历史。

## 6. Assumptions

1. 主动沟通 starter kit 的第一版可以先用高价值固定场景和短语，不要求一次覆盖所有生活场景。
2. 对 typed text / 快捷短语，第一阶段可以直接代播文本，不强行再走 LLM 纠错。
3. 更复杂的场景脚本和记忆排序可以在文本代播路径稳定后再接入。

## 7. Plan

1. 调研 AAC / 医疗 / 应急沟通资料，收敛首批场景和短语结构。
2. 补齐 WebSocket `user_input` 直达 TTS 的最小链路。
3. 在沟通模式中加入场景 starter kit 入口，而不是只暴露聊天区。
4. 用真实浏览器验证：首页 -> 沟通模式 -> 场景短语 / 文本输入 -> 代播 -> 返回。
5. 同步更新状态文档与 README。

## 8. Files Expected To Change

- `frontend/src/components/chat/...`
- `frontend/src/components/phrases/...`
- `frontend/src/lib/types/phrases.ts`
- `backend/src/scripts/run-migration.ts`
- `ten_agent/extension_src/websocket_server/...`
- `ten_agent/extension_src/voxflame_main_python/extension.py`

## 9. Validation

- 最低验证：
  - `npx tsc --noEmit`（frontend）
  - `sudo docker compose build ten-agent frontend backend`
  - Playwright 走通 starter kit 的关键路径
- 扩展验证：
  - 观察 `backend` / `ten-agent` 日志，确认文本代播不再报 `Missing "audio" field`
- 无法完成的验证及原因：
  - 医疗或康复真实用户验证不在本地开发阶段内

## 10. Risks And Rollback

- 主要风险：
  - 新的 WebSocket command 路径与现有音频路径冲突
  - 预设模板扩张过快，重新变回“功能列表”
- 回退方式：
  - 保留现有聊天模式入口；若 starter kit 回归失败，可先回退到仅修复文本代播链路
- 需要重点观察的指标：
  - 文本代播成功率
  - 首页进入沟通模式后的首个有效动作完成率
  - 代播触发后的控制台 / agent 错误率

## 11. Notes During Execution

- 外部依据：
  - ASHA AAC: https://www.asha.org/public/speech/disorders/aac/
  - ASHA dysarthria in adults: https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/
  - Tobii Dynavox emergency preparedness / communication boards: https://www.tobiidynavox.com/blogs/the-buzz/10-things-to-know-about-aac-and-emergency-preparedness/
  - Aphasia Institute hospital communication resources: https://www.aphasia.ca/health-care-providers/resources-and-downloads/
  - CommunicationFIRST emergency toolkit: https://communicationfirst.org/emergency-preparedness/

## 12. Final Outcome

- 实际完成内容：
  - 基于 AAC、医疗沟通与应急沟通资料，产出 starter kit 的四类中文场景模板与通用兜底短语。
  - 补齐 WebSocket 纯文本 `user_input` 路径，点击场景短语或直接输入文字都能直达 TTS。
  - 匿名 starter auto-connect 新增 `suppress_greeting` 链路：前端、后端代理、TEN websocket_server 与 main_control 都已透传并生效，点击第一句话时不再先播放系统问候。
  - Docker 构建、前端类型检查、真实浏览器回归与容器日志核验均已完成。
- 未完成内容：
  - 个体化场景排序和 starter kit 与长期记忆的联动还未接入。
  - 中文训练 / 录音页的官方语料与拼音反馈体系仍未开始实现。
- 后续建议：
  - 立即转入中文训练页，先把官方普通话语料、`pinyin` 与 `focus_tags` 的标注规范收敛清楚。
  - 保持“资料来源 -> 中文改写 -> 浏览器实测 -> 日志核验”的同一工作流，避免后续功能再次滑向拍脑袋设计。

