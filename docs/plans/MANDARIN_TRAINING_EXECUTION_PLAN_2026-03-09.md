# 中文语训与录音上传页执行计划（2026-03-09）

> 目标：把 `/contribute` 从旧的数据采集页，重构成“中文语训 + 录后反馈 + 匿名上传”的最小可用页面。

## 1. Task

- 标题：中文语训与录音上传页第一阶段
- 日期：2026-03-09
- 负责人：Codex
- 相关对话：2026-03-09 当前阶段推进

## 2. Context

- 当前 `/contribute` 仍是旧的 `chat / guided / free` 数据采集页。
- 现有录音链路可用：`AudioProcessor` 负责采集 PCM 与 WAV，`useVoiceUpload` 负责上传或本地降级。
- 现有问题不在底层能力，而在语料来源、页面结构、授权边界和反馈内容。
- 产品主线已切到“主动沟通 / 训练反馈 / 个体记忆”，训练页不能继续停留在“上传成功”。

## 3. Problem

- 要解决的核心问题：
  - 用户需要一个面向中文场景的训练页，能看见目标句、拼音、练习重点、录后结果和上传状态。
  - 训练语料和上传数据必须可追溯，不能用拍脑袋的句子或无来源样本。
  - 数据上传必须是显式授权，而不是隐式默认。
- 不在本次范围内的问题：
  - 医学级发音诊断
  - 长期趋势统计页
  - 个体记忆写回与训练历史聚合
  - 硬件 / App 通信

## 4. Success Criteria

- 用户可以在 `/contribute` 上完成一条完整闭环：
  - 选择中文训练句
  - 看到拼音和本次练习重点
  - 开始录音并看到实时转写
  - 录音结束后看到目标句 vs 系统听到的结果
  - 明确知道这次是否匿名上传、上传成功与否，失败时能本地降级
- 页面中的练习句都能追溯到权威资料或已核验的功能沟通来源。
- 反馈只做文本 / 拼音 / 标签级判断，不伪装成医学诊断。

## 5. Guardrails

- 产品约束：
  - 训练页优先服务真实沟通，而不是做考试型大而全语料库。
  - 上传必须有清晰授权说明，默认以最小必要存储为边界。
- 工程约束：
  - 不破坏现有上传链路和 `Frontend -> Backend -> TEN Agent` 主链路。
  - 先做小规模高质量语料，不在这一轮重构整个旧 `sentences.ts`。
- 数据 / 权限 / 隐私约束：
  - 上传采用匿名贡献者 ID。
  - 勾选授权后才上传；未授权时仍允许本地录音和页面内反馈。
  - 上传失败时继续使用现有本地降级逻辑。

## 6. Assumptions

1. TEN Agent 当前 WebSocket 链路可以提供足够稳定的实时中文转写，用于训练页第一阶段。
2. 第一阶段允许用文本差异和训练标签生成建议，不需要精确到声学级诊断。
3. 训练页第一版只维护一小组高质量句子，比维护一大份无来源语料更有价值。

## 7. Plan

1. 补充中文语训执行计划和来源文档，把“录音上传”明确写入闭环。
2. 新建一组带 `拼音 / focus_tags / 来源 / 上传元数据` 的高质量训练句。
3. 改造前端录音链路，保留实时转写、录后反馈、匿名上传和本地降级。
4. 用最小规则层输出中文建议，不承诺医学诊断。
5. 运行类型检查、文档检查、Docker 构建，并用 Playwright 检查真实页面。

## 8. Files Expected To Change

- `frontend/src/app/contribute/page.tsx`
- `frontend/src/hooks/useVoiceUpload.ts`
- `frontend/src/lib/websocket/asr-client.ts`
- `frontend/src/lib/corpus/...`
- `frontend/src/lib/training/...`
- `docs/...`

## 9. Validation

- 最低验证：
  - `cd frontend && npx tsc --noEmit`
  - `bash scripts/check_ai_docs.sh`
  - `sudo docker compose build frontend backend ten-agent`
  - `sudo docker compose up -d frontend backend ten-agent`
  - Playwright 打开 `/contribute`，验证练习句、录音、上传状态和页面交互
- 扩展验证：
  - 浏览器控制台无明显报错
  - 后端日志可见上传请求
- 无法完成的验证及原因：
  - 真实 ASR 质量评估仍受环境噪声和麦克风条件影响

## 10. Risks And Rollback

- 主要风险：
  - TEN Agent 会继续产出非训练页需要的消息，前端需主动忽略。
  - 如果录音后 final transcript 到达较慢，停止录音后的反馈可能需要短暂等待。
  - 数据上传若设计成默认自动上传，会与现有隐私边界冲突。
- 回退方式：
  - 保留现有上传接口和本地降级逻辑，只替换页面组织与元数据。
- 需要重点观察的指标：
  - 录音开始成功率
  - 录音结束到结果出现的延迟
  - 上传成功率 / 本地降级率

## 11. Notes During Execution

- 第一版训练句优先选用高价值场景表达句，再用官方普通话测试难点标签做标注。
- 不在本轮尝试自动补齐旧 `sentences.ts` 全量拼音。

## 12. Final Outcome

- 实际完成内容：
- 未完成内容：
- 后续建议：

