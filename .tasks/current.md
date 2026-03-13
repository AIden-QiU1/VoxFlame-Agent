# 当前任务状态

> 最后更新: 2026-03-12

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

6. AI 代码治理与安全 guardrails 升级
- 基于用户提供文章《用 AI 写了 80 万行代码之后，我开始重新理解 AI 代码“治理”》，把“盘点四层 -> 定唯一事实源 -> 分类 `current/compat/deprecated/dead` -> 加守卫 -> 分片迁移 -> 删除复盘”收敛进 `docs/AI_ENGINEERING_SYSTEM.md`。
- 重写 `docs/AI_EXECUTION_PLAN_TEMPLATE.md`，让迁移 / 统一 / 兼容层任务默认先做系统盘点和收口计划，而不是直接开改。
- 新增 `docs/aiprompts/GOVERNANCE_PROMPT_TEMPLATE.md`，把治理型任务的最小 Prompt 模板写成仓库工件。
- 在 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md` 中补入 AI 代码治理和安全应用的最小门禁：唯一事实源、compat 退出条件、最小权限、副作用审批、结构化输出和 secrets 边界。

7. 想法池与孵化入口
- 重构 `ideas/` 目录为两份简洁文件：`DAILY_CAPTURE.md`（随手记）和 `LONG_TERM_TOPICS.md`（长期讨论 / 调研）。
- 新增 `ideas/README.md`，明确 ideas 目录只在讨论新想法、长期调研或外部参考时按需查阅。
- 立即要做的想法不留在 ideas，直接进入 `.tasks/current.md` 和执行计划。
- 在 `AGENTS.md`、`CLAUDE.md`、Copilot 指令、`docs/README.md` 与项目 `README.md` 中补上新的边界和入口。

8. 产品优先级重排
- 基于 `ideas/` 与外部资料复盘，确认“全屏字幕”降为辅助能力，不再作为近期主线。
- 新增 `docs/COMMUNICATION_FIRST_PRODUCT_RESET_2026-03-09.md`，收敛主动沟通、训练反馈、个体记忆、场景声音提醒与硬件通信的近期判断。
- 同步更新 `README.md`、执行路线图与状态摘要，让近期目标重新对齐“少功能，但必须解决问题”。

9. 中文语训方案收敛
- 新增 `docs/MANDARIN_PRONUNCIATION_FEEDBACK_PLAN_2026-03-09.md`，明确中文普通话训练页应围绕汉字、拼音、声母 / 韵母 / 声调与混淆模式反馈来设计。
- 确认仓库内已有可复用基础：训练语料的 `pinyin` 字段、memory layer 的 `pypinyin` 依赖与 `ConfusionPattern` 结构。
- 同步把近期任务里的“拼音提示”细化为中文语训目标，避免后续实现再次滑向英文场景的发音训练逻辑。

10. 中文训练页第一阶段落地
- 新增 `docs/plans/MANDARIN_TRAINING_EXECUTION_PLAN_2026-03-09.md` 与 `docs/MANDARIN_TRAINING_SOURCES_2026-03-09.md`，把训练句来源、上传边界与验证要求写实。
- `/contribute` 已重构为中文语训与录音上传页：目标句、拼音、focus tags、实时转写、录后反馈与匿名上传进入同一闭环。
- 新增小规模高质量训练语料与规则反馈层：`mandarin-training.ts`、`mandarin-feedback.ts`、`useMandarinTrainingSession.ts`。
- `useVoiceUpload` 已支持训练页结构化 metadata，上传不再只是裸音频。

11. 中文训练页第二阶段：语料扩充与记忆写回
- 阶段性计划已移入 `docs/plans/`，`docs/` 顶层开始收敛为长期文档；当前 `docs` 顶层主要保留长期设计/来源说明，阶段计划统一进入 `docs/plans/`。
- 高价值训练语料已继续扩充到四类中文场景，并为每条训练句补上 `keywords`，用于 hotword 和记忆写回。
- `/contribute` 在录后反馈后会把训练结果写入前端 `memoryService`；有登录态时继续走后端 memory API，同步保持 local-first。
- 训练页会把 `training_result` 通过 WebSocket 发给 TEN 主控；TEN 已验证会写入 `save_conversation`，并更新 `voice_profile.hotwords` 给纠错链路使用。

12. 治理收口与机械守卫落地
- backend 遗留 `/api/session/*` 已从“看起来还能工作的 HTTP 会话 API”改为明确的 compat 壳，统一返回 `501` 并指向 `'/ws/agent' + persisted APIs` 的现役主路径。
- backend `/api/agent/session/*` 与 `/api/agent/tool/*` compat 响应已统一为带分类、移除目标和 guidance 的结构化返回，不再只是裸 `501`。
- 删除无消费者的 `backend/src/services/ten-agent-client.service.ts`，并移除仅服务这条旧 HTTP 路径的 `axios` 依赖链。
- 新增 `scripts/check_ai_governance.sh`，并接入 `.github/workflows/ai-doc-guard.yml`，把 compat 路径和旧 `/chat` 页面入口的回流变成 CI 可阻断项。

13. 成长档案事实源下沉与 Phase 3 写回闭环
- backend `/api/memory/profile/:userId` 现在直接生成 `growth_profile`：长期趋势、session 摘要、训练 streak、近 7 次清晰度、改善斜率、易混模式累计、热词与下一步建议都在 backend `memory-growth.service.ts` 聚合，不再让登录态页面长期自己拼 stats / session / trend。
- `/memory` 已切到“登录态优先消费 backend growth profile，未登录保留 local-first fallback”的结构；成长档案页现在展示 current/best streak、rolling clarity、improvement slope、frequent confusions 和按天趋势均值。
- `/contribute` 的 Phase 3 结果现在写入显式 `clarity_score`，并继续把目标拼音、系统听到的拼音、重点音节、声母 / 韵母 / 声调差异、发音差异摘要和动作提示写回前端记忆、后端 memory API 与 TEN `training_result`。
- TEN `main_control -> memory_layer -> corrector` 现已接通 Phase 3 差异：`training_result` 会生成 `confusion_patterns + clarity_score + hotwords`，memory layer 会累计并持久化到 `voice_profile/clarity_scores`，corrector 会把 `confusion_rules` 加入纠错 prompt。
- `LocalStore` 已补真实 clarity trend 持久化、混淆模式重写去重，并修复 SQLite 连接的跨线程初始化问题；匿名训练链路下 `init_memory` 不再因为 `check_same_thread` 报错。
- `memoryService` 现在除 memory queue 外，额外维护 session sync queue，并通过新的 `POST /api/memory/session` 把训练 / 沟通 session 的结束时间、时长、turn 数独立写回后端，不再让 growth profile 只有 memory 没有完整 session。
- backend `GET /api/memory/user/:userId`、`/hotwords/:userId`、`/stats/:userId` 已被明确标成 compat slice；新前端守卫已禁止继续从页面侧直接依赖这些碎片接口。
- 平级页面入口进一步收口：`/ranyan` 保留 compat redirect，首页和沟通页入口已改为 `"/"`、`"/contribute"`、`"/memory"` 三条现役主路径。

## 当前状态

- 系统主链路可运行：`Frontend -> Backend -> TEN Agent`。
- 首页已经能清楚表达“现在沟通 / 练习表达 / 查看进展与记忆”，并支持未登录用户先进入沟通模式试用；首页首屏文案和记忆入口已进一步收紧，不再把“查看进展与记忆”停留在首页承诺。
- 沟通模式中的匿名短语板已改为友好降级，不再把“未登录”直接暴露成错误态。
- “第一句话 / 主动沟通”第一版已闭环：starter kit 已接入陌生人 / 就医 / 家人照护 / 紧急四类中文场景，纯文本 `user_input` 已直达 TTS，不再报 `Missing "audio" field`。
- 匿名用户点击 starter phrase 时，页面会自动连接助手并抑制默认问候语，优先代播用户选择的第一句话。
- 全屏字幕首版保留，但已降级为辅助显示能力，不再作为近期主任务。
- AI 协作入口、深文档和最小校验已形成一套可维护的仓库内工作环境。
- AI 辅助编程体系已从“短入口 + 深文档 + 最小校验”进一步升级为“短入口 + 深文档 + 治理模板 + 安全 guardrails + 机械守卫”，开始明确约束 AI 不得继续放大旧路径和不安全默认值。
- `/contribute` 已进入中文训练页 Phase 3：可展示扩充后的高价值中文训练句、拼音、难点标签、来源说明、录后反馈、匿名上传，并把训练结果写回前端 / backend / TEN；写回内容现在包含显式 `clarity_score`、拼音差异和声母 / 韵母 / 声调混淆模式。
- `/memory` 已成为统一 growth profile 页面，可直接查看训练记录、最近会话、活跃天数、按天趋势、高频表达、重点音节、训练重点、易混声母 / 韵母 / 声调、热词和动作提示回顾；登录态优先消费 backend 聚合后的 growth profile，页面端只保留本地 fallback 计算。
- TEN memory layer 与前端本地记忆都已做一轮深修：匿名用户唯一化、按 `user_id` 检索、`VOICE_PROFILE`/日志分用户分区、query 级 `memory_context`、本地 sync queue 持久化、文本输入写入记忆、断线会话落盘与后端 ownership 校验已补齐。
- TEN memory layer 与纠错链路现在已进一步闭环：`voice_profile` 会累计混淆模式与 clarity trend，`corrector` 会实时接收 `confusion_rules`，合成训练结果验证里已看到 `merged_patterns=3`、`Clarity score=0.42`、`3 confusion rules`。
- backend 里最误导的遗留开放口已经收紧：`/api/session/*` 现为 compat-only，`ten-agent-client.service.ts` 已删除，runtime session 的唯一事实源重新明确为 `frontend -> backend /ws/agent -> TEN agent`。
- backend memory 写侧也已补齐：`/api/memory/session` 负责同步会话结束态，`/api/memory/profile/:userId` 成为 stats / session / trend 的统一读口，旧 slice API 仅作为 compat 存在。
- 当前仍未完成的重点，已经收缩到真实麦克风端到端记忆回放、更长时间尺度的 trend/report 沉淀，以及硬件联动方案。

## 2026-03-12 架构复盘结论

- 首页方向已经从“聊天入口”拉回“主动沟通 / 训练 / 记忆”，这轮修复进一步收紧了首屏和主入口区块；后续仍可继续压缩“设计依据”露出，但主信息架构已经回到行动导向。
- `/contribute` 的即时回报已经从字符差异推进到 Phase 3：目标拼音、系统听到的拼音、重点音节、声母 / 韵母 / 声调差异、发音差异摘要和动作提示都已落到页面与记忆写回链路里；这轮又把它继续接到了 TEN `voice_profile / confusion_rules / clarity_trend`，不再只停在页面展示。
- 前端“个体记忆”现在已有真实 growth profile 消费数据，`memoryService`、本地存储、后端 memory API 和 TEN memory layer 也完成了 stats / session / trend 的统一事实源对齐；登录态下聚合已经沉到 backend，TEN 侧也开始累计 confusion pattern 与 clarity trend，页面端只保留本地 fallback 计算。
- backend `/api/agent/*` 与 `/api/session/*` 现在都已显式归类为 compat / current：运行时 agent 交互边界重新明确为 `frontend -> backend ws proxy -> TEN agent`，遗留 HTTP session 入口不再伪装成现役实现。
- TEN memory layer 的关键边界已修：匿名用户唯一化、按 `user_id` 检索、`VOICE_PROFILE`/日志分用户分区，以及按 query 动态广播 `memory_context`；现在前端 session 结束态也能独立回写，给 TEN / backend 的长期趋势沉淀留出了稳定写口。

## 后续重点（按优先级）

1. 做真实麦克风端到端验证与记忆回放核验，补当前 Playwright 无麦克风环境下缺失的录音上传、session 结束态回写、训练结果落库和成长档案展示链路实测。
2. 继续把 growth profile 从“日级摘要”推进到更长期的周 / 月趋势、康复报告切片和改善阶段判断，尽量继续放在 backend / TEN 侧产出，而不是回到页面端临时算。
3. 把 TEN `voice_profile` 里的 confusion patterns、clarity trend 进一步用于个体化建议生成，例如把高频混淆点直接映射到训练推荐和下一句训练选择。
4. 继续扩大治理守卫覆盖面：把更多 compat / deprecated 路径收进静态扫描、lint 或 CI，尤其是 fragmented memory slice、旧 API 调用、`/chat` / `/ranyan` 之外的平级页面入口和后续新增 compat 壳。
5. 在上面四项稳定后，再继续扩充中文训练语料、场景模板与硬件 / App / Web 通信原型，避免再次出现“能力没收口，数据先膨胀”。

## 验证备注

- `python3 -m py_compile ten_agent/extension_src/memory_layer_python/extension.py ten_agent/extension_src/memory_layer_python/stores/local_store.py ten_agent/extension_src/voxflame_main_python/extension.py` 通过。
- `sudo docker compose build frontend backend ten-agent` 通过。
- 训练页修正后再次执行 `sudo docker compose build frontend` 通过。
- `sudo docker compose up -d frontend backend ten-agent` 与 `sudo docker compose ps frontend backend ten-agent` 通过，三项服务均已启动，`frontend` / `backend` 健康检查正常。
- `curl -I http://localhost:3000` 与 `curl -I http://localhost:3001/health` 通过。
- `npx tsc --noEmit`（frontend）通过。
- `npx tsc --noEmit`（backend）通过。
- `npx next lint` 当前仍受 `frontend/.eslintrc.json` 循环引用影响失败。
- Playwright 已验证真实页面：未连接状态进入 `/?mode=communicate` 后，点击 starter phrase 会自动连接助手并直接生成用户消息，不会插入默认问候语气泡。
- Playwright 已验证 `/contribute`：目标句、拼音、来源说明、上传授权区与分类切换均正常；在当前无麦克风设备环境下点击“开始录音”会给出错误提示，并保持页面状态回退到“已就绪”，不会假停留在“正在录音”。
- Playwright 已再次验证 `/contribute` 第二阶段页面：扩充后的“紧急求助”等分类句已可见，分类切换和翻句正常。
- Playwright 已验证最新首页：首屏价值主张、`/memory` 入口和训练价值文案均已按新信息架构呈现。
- Playwright 已验证 `/memory`：页面可直接加载；注入匿名本地记忆样本后，训练记录、高频表达、重点音节、热词和动作提示会按预期聚合显示。
- 当前 Playwright 环境没有可用麦克风设备，因此未能完成录音后上传链路的端到端实测。
- 容器日志已验证 `backend -> ten-agent` 会透传 `suppress_greeting=1`，`main_control` 明确记录 `Skipping greeting`，随后只把用户选中的中文短语送入 TTS。
- 本轮再次执行 `npx tsc --noEmit`（frontend/backend）、`bash scripts/check_ai_governance.sh`、`bash scripts/check_ai_docs.sh` 全部通过。
- 本轮再次执行 `sudo docker compose build frontend backend` 与 `sudo docker compose up -d frontend backend` 通过；运行态已切换到最新镜像。
- Playwright 已再次验证最新 `/memory`：页面以 growth profile 话术和结构渲染，显示训练记录、会话数、活跃天数、最近趋势、最近会话与易混声母 / 韵母 / 声调等区块。
- Playwright 已再次验证最新 `/contribute`：页面文案已升级到“拼音 + 声母 / 韵母 / 声调差异”，分类、练习卡和录音区正常渲染。
- `/contribute` 在匿名 contributor 拉取时仍会出现 Supabase `contributors` 查询报错，但页面已按既有策略降级到本地模式；这不是本轮改动引入的新问题。
- 容器日志已验证 `training_result` 路径：`websocket_server` 收到命令后转发到 `main_control`，随后 `memory_layer` 完成 `save_conversation`，并把 3 个关键词写入 `voice_profile.hotwords`，`corrector` 成功收到更新后的词表。
- `bash scripts/check_ai_docs.sh` 通过。
- 本轮 AI 编程体系升级后再次执行 `bash scripts/check_ai_docs.sh` 通过。
- 本轮治理收口后再次执行 `npx tsc --noEmit`（backend）通过。
- 本轮新增 `bash scripts/check_ai_governance.sh` 通过。
- 本轮再次执行 `python3 -m py_compile ten_agent/extension_src/memory_layer_python/extension.py ten_agent/extension_src/memory_layer_python/stores/base.py ten_agent/extension_src/memory_layer_python/stores/local_store.py ten_agent/extension_src/voxflame_main_python/extension.py ten_agent/extension_src/llm_correction_python/extension.py ten_agent/extension_src/llm_correction_python/corrector.py` 通过。
- 本轮再次执行 `sudo docker compose build frontend backend ten-agent` 与 `sudo docker compose up -d frontend backend ten-agent` 通过；三项容器已切到最新镜像。
- Playwright 已再次验证最新 `/memory` 与 `/contribute`；`/contribute` 在无麦克风环境下点击“开始录音”仍会给出错误提示并回退到“已就绪”。
- 浏览器上下文已合成发送一条 `training_result` 到 `ws://localhost:3001/ws/agent`；容器日志确认 `main_control` 收到 `confusions=3`，`memory_layer` 完成 `merged_patterns=3` 与 `clarity_score=0.42` 写回，`corrector` 收到 `3 confusion rules`。
- `LocalStore` 的 SQLite 跨线程初始化错误已修复；合成训练链路里 `init_memory` 对匿名用户 `anon:phase3-integration` 不再出现 `check_same_thread` 报错。
