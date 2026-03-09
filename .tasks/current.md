# 当前任务状态

> 最后更新: 2026-03-09

## 过去主要完成

1. 构建与部署链路稳定化
- 修复 `ten-agent` 构建失败（`tman install --locked` 与旧 lock 不兼容）。
- 对齐 `manifest.json` 依赖版本并优化 `ten_agent/Dockerfile`。
- 清理 `docker-compose.yml` 过时 `version` 字段，`docker compose build` 可通过。

2. TEN 主链路关键能力落地
- 多客户端会话隔离、打断阈值生效、`save_conversation` 与 memory 广播链路闭环。
- `voice_profile / memory_context` 已进入纠错链路。

3. 首页信息架构与入口重构
- 首页 `/` 改为公开产品首页，明确“现在沟通 / 练习表达 / 查看进展与记忆”三类入口。
- `/?mode=communicate` 进入沟通模式，`/chat` 兼容重定向到该模式，不再让首页直接暴露底层对话界面。
- 首页文案与场景排序已接入 AAC、成人构音障碍与普通话训练的外部依据，不再靠拍脑袋命名。

4. 文档收敛与同步
- TEN / Memory / 执行路线图改为“对应章节就地更新现状”。
- 更新 `README.md` 与 `docs/README.md`，统一当前状态与下一步计划。

5. AI 编程指导体系重构
- 基于 `Harness Engineering` 思路，将 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md` 收敛为短入口。
- 新增 `docs/AI_ENGINEERING_SYSTEM.md`、`docs/AI_EXECUTION_PLAN_TEMPLATE.md`。
- 新增 `scripts/check_ai_docs.sh` 与 `.github/workflows/ai-doc-guard.yml` 作为最小门禁。
- 补充入口文件中的 `Tool Routing` 规则，明确 `Context7`、`Playwright`、`web` 与 skill 的使用边界。
- 明确入口上下文分层：默认启动上下文只有状态文件，`docs/*` 属于按任务读取的权威参考，`ideas/*` 属于可选灵感上下文。

6. 想法池与孵化入口
- 重构 `ideas/` 目录为两份简洁文件：`DAILY_CAPTURE.md`（随手记）和 `LONG_TERM_TOPICS.md`（长期讨论 / 调研）。
- 新增 `ideas/README.md`，明确 ideas 目录只在讨论新想法、长期调研或外部参考时按需查阅。
- 立即要做的想法不留在 ideas，直接进入 `.tasks/current.md` 和执行计划。
- 在 `AGENTS.md`、`CLAUDE.md`、Copilot 指令、`docs/README.md` 与项目 `README.md` 中补上新的边界和入口。

7. 产品优先级重排
- 基于 `ideas/` 与外部资料复盘，确认“全屏字幕”降为辅助能力，不再作为近期主线。
- 新增 `docs/COMMUNICATION_FIRST_PRODUCT_RESET_2026-03-09.md`，收敛主动沟通、训练反馈、个体记忆、场景声音提醒与硬件通信的近期判断。
- 同步更新 `README.md`、执行路线图与状态摘要，让近期目标重新对齐“少功能，但必须解决问题”。

8. 中文语训方案收敛
- 新增 `docs/MANDARIN_PRONUNCIATION_FEEDBACK_PLAN_2026-03-09.md`，明确中文普通话训练页应围绕汉字、拼音、声母 / 韵母 / 声调与混淆模式反馈来设计。
- 确认仓库内已有可复用基础：训练语料的 `pinyin` 字段、memory layer 的 `pypinyin` 依赖与 `ConfusionPattern` 结构。
- 同步把近期任务里的“拼音提示”细化为中文语训目标，避免后续实现再次滑向英文场景的发音训练逻辑。

9. 中文训练页第一阶段落地
- 新增 `docs/plans/MANDARIN_TRAINING_EXECUTION_PLAN_2026-03-09.md` 与 `docs/MANDARIN_TRAINING_SOURCES_2026-03-09.md`，把训练句来源、上传边界与验证要求写实。
- `/contribute` 已重构为中文语训与录音上传页：目标句、拼音、focus tags、实时转写、录后反馈与匿名上传进入同一闭环。
- 新增小规模高质量训练语料与规则反馈层：`mandarin-training.ts`、`mandarin-feedback.ts`、`useMandarinTrainingSession.ts`。
- `useVoiceUpload` 已支持训练页结构化 metadata，上传不再只是裸音频。

10. 中文训练页第二阶段：语料扩充与记忆写回
- 阶段性计划已移入 `docs/plans/`，`docs/` 顶层开始收敛为长期文档；当前 `docs` 顶层主要保留长期设计/来源说明，阶段计划统一进入 `docs/plans/`。
- 高价值训练语料已继续扩充到四类中文场景，并为每条训练句补上 `keywords`，用于 hotword 和记忆写回。
- `/contribute` 在录后反馈后会把训练结果写入前端 `memoryService`；有登录态时继续走后端 memory API，同步保持 local-first。
- 训练页会把 `training_result` 通过 WebSocket 发给 TEN 主控；TEN 已验证会写入 `save_conversation`，并更新 `voice_profile.hotwords` 给纠错链路使用。

## 当前状态

- 系统主链路可运行：`Frontend -> Backend -> TEN Agent`。
- 首页已经能清楚表达“现在沟通 / 练习表达 / 查看进展与记忆”，并支持未登录用户先进入沟通模式试用。
- 沟通模式中的匿名短语板已改为友好降级，不再把“未登录”直接暴露成错误态。
- “第一句话 / 主动沟通”第一版已闭环：starter kit 已接入陌生人 / 就医 / 家人照护 / 紧急四类中文场景，纯文本 `user_input` 已直达 TTS，不再报 `Missing "audio" field`。
- 匿名用户点击 starter phrase 时，页面会自动连接助手并抑制默认问候语，优先代播用户选择的第一句话。
- 全屏字幕首版保留，但已降级为辅助显示能力，不再作为近期主任务。
- AI 协作入口、深文档和最小校验已形成一套可维护的仓库内工作环境。
- `/contribute` 已进入中文训练页第二阶段：可展示扩充后的高价值中文训练句、拼音、难点标签、来源说明、录后反馈、匿名上传，并把训练结果写回前端 / TEN 记忆层。
- 当前训练页仍未完成趋势统计、更细的拼音 / 音节级分析和真实麦克风端到端记忆回放；硬件联动也还停留在方案阶段。

## 后续重点（按优先级）

1. 继续做中文训练页下一切片：训练历史趋势、更细的拼音 / 音节反馈，以及围绕现有训练结果结构做可视化复盘。
2. 继续扩充高质量中文训练语料：在现有四类场景基础上补更多高价值医疗 / 家人 / 紧急表达，同时保持来源可追溯。
3. 定义个体沟通记忆最小模型，并把高频表达、混淆词、场景偏好、训练历史稳定送入 agent context。
4. 产出硬件 / App / Web 通信方案，并先做“场景声音提醒”原型设计，不直接绑定浏览器硬件 API。
5. 继续补稳定性观测与回归门禁，把时延、打断、重连作为以上功能的上线前提。

## 验证备注

- `sudo docker compose build frontend backend ten-agent` 通过。
- 训练页修正后再次执行 `sudo docker compose build frontend` 通过。
- `sudo docker compose up -d frontend backend ten-agent` 与 `sudo docker compose ps frontend backend ten-agent` 通过，三项服务均已启动，`frontend` / `backend` 健康检查正常。
- `npx tsc --noEmit`（frontend）通过。
- `npx next lint` 当前仍受 `frontend/.eslintrc.json` 循环引用影响失败。
- Playwright 已验证真实页面：未连接状态进入 `/?mode=communicate` 后，点击 starter phrase 会自动连接助手并直接生成用户消息，不会插入默认问候语气泡。
- Playwright 已验证 `/contribute`：目标句、拼音、来源说明、上传授权区与分类切换均正常；在当前无麦克风设备环境下点击“开始录音”会给出错误提示，并保持页面状态回退到“已就绪”，不会假停留在“正在录音”。
- Playwright 已再次验证 `/contribute` 第二阶段页面：扩充后的“紧急求助”等分类句已可见，分类切换和翻句正常。
- 当前 Playwright 环境没有可用麦克风设备，因此未能完成录音后上传链路的端到端实测。
- 容器日志已验证 `backend -> ten-agent` 会透传 `suppress_greeting=1`，`main_control` 明确记录 `Skipping greeting`，随后只把用户选中的中文短语送入 TTS。
- 容器日志已验证 `training_result` 路径：`websocket_server` 收到命令后转发到 `main_control`，随后 `memory_layer` 完成 `save_conversation`，并把 3 个关键词写入 `voice_profile.hotwords`，`corrector` 成功收到更新后的词表。
- `bash scripts/check_ai_docs.sh` 通过。
