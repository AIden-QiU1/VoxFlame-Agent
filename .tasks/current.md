# 当前任务状态

> 最后更新: 2026-04-12

## 当前主线

- 主任务：把当前产品主线收成 `沟通成功率 -> typed memory -> 句子级准备资产 -> 数据录入/标注 -> 会后压缩写回` 的稳态闭环，不再新增大功能。
- 当前执行面：`frontend -> backend -> self-hosted livekit-server -> livekit_agent`。
- 当前最重要的产品/工程重点：
  - 把 `session-local typed memory -> session-close compaction -> workspace snapshot` 的 owner 与写回边界做扎实
  - 把 `prepared-expression / important-expression / 高频句` 的录入和复用入口统一起来
  - 把 dataset review queue、annotation 流程和质量指标收成明确 contract，而不是只看“收了多少条”

## 最新收口

0. 2026-04-14 已开始按 PRD 落第一刀代码：`workspace document model + memory page object zones`
   - backend `workspace snapshot` 已新增 `object_zones`
   - 当前先把现有数据正式收成 4 个对象区：
     - `自定义材料区`
     - `场景 / 热词模板`
     - `用户个人画像`
     - `训练总结`
   - 记忆页顶部已改成对象区视图，但底下仍继续复用现有准备稿 / 热词 / 训练总结编辑与展示能力
   - 这一刀的目标不是一次性做完新对象存储，而是先把后续 `loadout / context assembly / compaction` 需要依赖的前端与 snapshot 骨架立起来
   - 已验证：
     - `cd frontend && npm run build`
     - `cd backend && npm run build`

0. 2026-04-14 已把主文档口径重新压缩并对齐代码现状
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 已改成短版现状 PRD
   - [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md) 已改成短版边界文档
   - 最新统一判断：
     - 网站主骨架已成立，可以做真实试用
     - 正式上线前最关键的 3 个 blocker 仍是：
       - `livekit_agent` 侧 typed session memory / context assembly
       - server-side `flush -> compact -> durable write`
       - dataset review / annotation / export 的真实闭环

0. `speech mode` 的 5 天专项执行计划已经完成阶段使命
   - 独立执行文档已从 `docs/` 删除
   - 仍然有效的判断已经并回：
     - `PRD`
     - `.tasks/current.md`
     - `dataset schema`
     - `LiveKit memory best practices`
   - 后续不再单独维护 `speech mode execution plan` 入口

0. 训练页“通用句库没结果”这轮已经查清并修掉
   - 根因不在后端，也不是通用句库数据为空
   - 真正问题是前端 `contribute/page.tsx` 里有一个自动切换 effect：
     - 只要检测到账号存在 prepared content，就会再次把 `practiceMode` 强制切回 `prepared_content`
     - 所以用户手动点“通用句库”后，页面会立刻被抢回，看起来像“没有结果”
   - 当前已改成：
     - 只在 prepared content 第一次可用时默认切过去一次
     - 后续手动切换到“通用句库”时不再自动回退
   - 已完成：
     - `cd frontend && npm run build`
     - `sudo docker compose build frontend`
     - `sudo docker compose up -d --force-recreate frontend`
     - Playwright 复测训练页：切到“通用句库”后，分类卡、搜索占位符和句子列表都会稳定停留在通用句库
   - 当前状态：
     - `frontend` 容器已恢复 `healthy`

1. 字幕辅助页这轮把“整理超时红字”和“停录后环境音尾巴”一起收了
   - 用户明确指出问题发生在沟通工作台的全屏字幕辅助页
   - 这次根因已经确认成两层：
     - `livekit-agent` 确实有真实 `correction_timeout`，日志里出现了 `latency_ms=15198`，而容器当前 `DASHSCOPE_TIMEOUT_SECONDS=15`
     - 手动停录后，ASR 会偶发给出 `嗯。/。/空串` 这类短尾音 final transcript，符合“设备继续收进环境音”的现象
   - 当前已直接修成运行时兜底：
     - `caption_mode` 下，只要 correction 超时、失败、空回复或模型未配置，就直接回退显示当前 ASR
     - 所以前屏字幕辅助页不再弹 `本句整理超时，请再说一次完整句子。`
     - `manual_stop` 后首个 `1-2` 字的短尾音 final transcript 会被 agent 忽略，不再进入整理链
     - fallback 场景也不再写 `voice_profile_updated`
   - 已完成：
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`
     - `python3 -m unittest livekit_agent.tests.test_asr_runtime -v`
     - `python3 -m unittest discover livekit_agent/tests -v`
     - `sudo docker compose build livekit-agent`
     - `sudo docker compose up -d --force-recreate livekit-agent`
     - 新 worker：`AW_6nesnP7edfK8`

2. correction history 这轮又把“嗯 / 啊”边界收准了一次
   - 用户最后明确要求：recent history 里只要规范化后长度是 `1-2` 个字，就直接跳过
   - 当前 `assistant_runtime` 已改成：
     - recent history 只过滤规范化后长度为 `1-2` 字的旧 reply
     - `不是不知道该怎么过，嗯。` 这种正常句子会原样保留
     - `嗯。/啊/你好/好的。` 这类短句都不会再占用 history 窗口
     - 继续维持“过滤短句后取最近 5 条有信息量的唯一 correction history”
   - prompt 也继续明确：
     - 长度只有 `1-2` 个字的历史不算有效上下文
     - 最近纠错历史只用于语义承接和防重复，不可直接复述
   - 同时已经确认：
     - 沟通档案页的参考文档编辑保存能力现有链路已支持，不需要重复造后端能力
     - 当前前端直接编辑后会走 `PUT /memory/workspace/:userId/prepared-expression`
     - backend 会沿用现有 draft `id` 覆盖保存，不需要删掉旧稿再重传
   - 记忆页这轮只补了最主要交互：
     - 明确提示“这里就是当前参考文档的编辑区”
     - 主按钮按状态显示 `保存第一份参考文档 / 更新参考文档`
     - 不额外增加复杂编辑控件
   - 已完成：
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`
     - `python3 -m unittest discover livekit_agent/tests -v`
     - `cd frontend && npm run build`
     - `sudo docker compose build livekit-agent`
     - `sudo docker compose up -d --force-recreate livekit-agent`
     - `sudo docker compose build frontend`
     - `sudo docker compose up -d --force-recreate frontend`
     - 新 worker：`AW_DqEJatisfBvj`

3. correction history 这轮按用户反馈又重新定义了
   - 用户明确要求：前几轮更该保留的是 `LLM correction`，不是旧 `ASR`
   - 当前 `assistant_runtime` 已改成：
     - 不再把前几轮原始 `ASR(user)` 当作 history 回灌
     - 只保留最近几轮 `assistant/LLM` 已确认纠错结果
     - 这些旧 reply 不再作为原始 `assistant role` 消息直接展开到 `messages`
     - 改成以结构化 prompt 形式注入当前轮：
       - 旧 reply 比旧 ASR 更可信
       - 只用于理解语义承接、代词和省略
       - 不允许直接复述
       - 如果候选与最近历史高度相同、但当前 ASR 没明确再次说同一句，则视为 `history echo`
   - recent history 当前也做了去重：
     - 只保留最近 `5` 条唯一 correction reply
     - 避免相同旧输出在 prompt 中被重复强化
   - 这轮没有重新引入本地 deterministic rule，仍然是 prompt-only 纠错
   - 已完成：
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`
     - `python3 -m unittest discover livekit_agent/tests -v`
     - `sudo docker compose build livekit-agent`
     - `sudo docker compose up -d --force-recreate livekit-agent`
     - 新 worker：`AW_JViK7B2q9hxR`

4. 沟通页 TTS 这轮已按“实时辅助优先文字结果”继续减法
   - `livekit_agent` 现在默认对 `communication_workspace` 跳过 TTS
   - 沟通页仍会保留：
     - 最终 assistant transcript / correction 文本
     - `isThinking / currentResponseText / 历史消息` 文字反馈
   - 沟通页不再默认播报 assistant 音频，避免把实时辅助场景又拉回语音代播
   - `caption_mode` 仍继续强制跳过 TTS
   - 训练页等其他 surface 仍可保留原有语音回复能力
   - 已完成：
     - `python3 -m unittest discover livekit_agent/tests -v`
     - `sudo docker compose build livekit-agent`
     - `sudo docker compose up -d --force-recreate livekit-agent`
     - 新 worker 已重新注册

5. correction runtime 这轮把“短句近似原文优先”收回到纯 prompt 约束
   - 用户明确要求不要走本地规则，所以 `assistant_runtime` 没有保留 reference match / 直返逻辑
   - 当前只在 prompt 里更明确约束：
     - 最终输出长度尽量贴近本轮 ASR
     - 优先控制在前后不超过 `2` 个字
     - 如果明显更长或更短，默认视为改写过度，应回到更贴近 ASR 的版本
     - 只有参考原文里有非常明确且更准确的对应原句时才允许放宽
   - 当前仍然保留：
     - 最近 `5` 轮上下文
     - `document_content`
     - `training_pairs`
     - 专名 / 机构名 / 术语优先按参考原文写法保留
   - `reference_lines` 这轮仍然不参与文章原句匹配；唯一文章事实源继续是 `document_content`
   - 顺手保留了一个工程修正：
     - 真实 `DashScopeChatClient` 继续走 `asyncio.to_thread(...)`
     - fake client 改回同步调用，避免测试卡住
   - 已完成：
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`
     - `python3 -m unittest discover livekit_agent/tests -v`
     - `sudo docker compose build livekit-agent`
     - `sudo docker compose up -d --force-recreate livekit-agent`
     - 新 worker：`AW_64HjkZfiGcFE`

5. correction runtime 这轮已按“ASR + 上下文 + 训练句对 + 文章原句”继续收口
   - 当前 `assistant_runtime` 不再把 `training_pairs` 当成可直接脱离文章输出的“替代原句”
   - 现在的优先级已经改成：
     - 当前 ASR
     - 最近上下文
     - `training_pairs(target/heard)` alias 线索
     - `document_content` 里的文章原句匹配
   - 当前已明确：
     - `document_content` 才是文章全文，可用于精确原句恢复
     - `reference_lines` 在 backend 里混有 `fallback_phrases / personalized_phrases / quick_phrases`，不能继续拿来做文章精确命中
   - 当前 runtime 行为：
     - 高置信命中 `pair + article sentence` 时，可直接返回文章原句
     - 只有 pair 命中但没文章原句时，只把 pair 当当前轮 prompt hint
     - 稳定 `system + scene + preparation` prompt 已恢复 `build_cacheable_content(...)`，继续服务 prompt cache
   - 按最新用户反馈，runtime 又继续做了一次减法：
     - 不再在本地做 anchor 直返或重点词硬匹配，纠错判断交给 LLM
     - 现在只保证把 `ASR + 最近 5 轮上下文 + document_content + training_pairs` 完整送进模型
     - `reference_lines` 不再作为文章原句来源参与纠错
     - prompt 里固定加入：
       - `邱生峰 / 燃言 / 上海生声不息科技 / 生声不息科技 / 智能体 / AI / LLM / VoxFlame`
   - 这轮又继续按“参考文章优先、不要 prompt cache”收了一层：
     - correction 不再使用 prompt/session cache
     - stable prompt 现在更聚焦：
       - 参考原文全文
       - 从参考原文和训练句对里提取的 `人名 / 地名 / 公司名 / 术语`
       - 最近 `5` 轮上下文
       - `training_pairs`
     - 最终 correction 输出不允许带：
       - `纠正后：`
       - `参考原文：`
       - `最终答案：`
       - `字幕：`
     - 如果模型漏出这些提示词，agent 会在发布前清掉
   - `build_preparation_context_pack_from_payload(...)` 现在即使只有 `document_content + training_pairs` 也会接受，不会静默丢掉 runtime update
   - 已验证：
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`
     - `python3 -m unittest discover livekit_agent/tests -v`

6. 这轮现场还查清了一个线上根因
   - 最新 `livekit-agent` 日志显示，某次失败会话里实际是：
     - `document_chars=0`
     - `training_pairs=0`
     - 且没有收到 `preparation_context_update`
   - 所以那次不是“模型看了原文也没纠对”，而是模型根本没看到参考文章和训练句对
   - 同时又定位到一个前端同步坑：
     - `preparation_context_update` 之前只要第一次发送失败，就会因为 `syncKey` 被锁住，不再重试

7. frontend / backend / livekit-agent 这轮已全部重新部署到新代码
   - 之前线上 `frontend` 和 `backend` 都还是约 `10` 小时前的旧容器，所以 preparation sync 相关改动没有真正上线
   - 当前已完成：
     - `backend/Dockerfile` 改成 multi-stage，修掉容器内 `tsc` 缺失导致的构建失败
     - `sudo docker compose build backend frontend livekit-agent`
     - `sudo docker compose up -d --force-recreate backend frontend livekit-agent`
   - 最新实例时间：
     - `backend`: `2026-04-09T11:39:28Z`
     - `frontend`: `2026-04-09T11:39:28Z`
     - `livekit-agent`: `2026-04-09T11:39:28Z`
   - 最新 worker 已注册：
     - `AW_ASbV5xh9KMWF`
     - `sudo docker compose build livekit-agent`
     - `sudo docker compose up -d --force-recreate livekit-agent`

8. 演讲稿识别提升这轮已经切到“全文准备稿 + 训练句对”主链
   - 当前不再把 `qwen3-asr` 热词能力当成现役前提
   - prepared-expression / workspace snapshot / LiveKit metadata / livekit_agent prompt 现在都已开始正式携带：
     - `document_content`
     - `reference_lines`
     - `training_pairs`
   - 当前 correction runtime 的稳定前缀已改成：
     - 系统约束
     - 场景
     - 准备稿全文
     - 已训练的 `目标句 -> 系统听到` 句对
   - 当前也已按 DashScope explicit context cache 方式把这个稳定前缀做成单条 cacheable system message
   - 现在真正需要控制的是最近几轮 history window，而不是把 6000 字级准备稿过度摘要
   - 记忆页 / 训练页可见 summary 卡片也已从“热词 / ASR 热词包”切成“训练句对 / 高频误听 / 下一轮重点”

9. `speech mode` 的 prepared-expression 主链已经继续打通
   - backend 已新增 prepared-expression asset 的读写/总结接口
   - 记忆页现在已有“重要表达 owner”区：
     - 支持上传/粘贴 `.md/.txt`
     - 支持保存准备稿
     - 支持一键总结热词/规律/保底句
   - 训练页在 `prepared_expression` 模式下，达到周期门槛后会自动触发 `periodic_auto` summary
   - 当前链路已经开始形成：
     - `prepared expression -> rehearsal -> summary -> workspace snapshot -> LiveKit preparation context`

10. 训练页 / 记忆页 / 后台训练反馈链路已经按“只服务 correction”继续收口
   - 训练页已改成最小闭环：
     - `准备内容`
     - `拆句列表`
     - `录音`
     - `标签 / 目标句 / 系统听到 / 保存状态`
     - `每 50 句更新一次的纠错总结`
   - 记忆页已改成最小闭环：
     - `准备内容`
     - `自定义重点词`
     - `训练总结 / 高频误听 / 训练句对`
   - 逐句 `training coach` 链路已退出现役主线：
     - 前端不再请求逐句大模型点评
     - RTC capability 不再声明 `training_feedback_request`
     - `livekit_agent` 不再消费 `training_coach_request`
     - `livekit_agent` 配置、测试和 README 中的旧 training extension 残留也已删除
   - `prepared expression` 自动总结节奏已改成 `50` 句
   - 前端训练拆句现在已明确改成“全文准备稿优先”：
     - `buildPreparedExpressionPracticeExercises(...)` 会先从 `document_content` 生成练习句
     - 不再只依赖 `sections[].anchor_line + practice_lines`，避免文章句子漏进训练页
   - 当前拆句规则：
     - 优先依据标点切分
     - 目标长度控制在 `5-15` 字
     - 保持文章原文顺序与全文覆盖
   - `sections` 现在主要负责 metadata：
     - 命中已有 section 时继续复用原 section metadata
     - 没命中的段落走 synthetic section metadata，不再直接丢失
   - 训练页“当前段落锚点”也已改成优先读取 exercise 自带 anchor，避免 synthetic section 时 UI 掉锚点
   - 已验证：
     - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types "src/lib/training/prepared-expression-practice.test.ts"`
     - `cd frontend && npm run build`
     - `python3 -m unittest livekit_agent.tests.test_assistant_runtime -v`

10. LiveKit correction context 已进一步收口
   - backend `rtc-orchestration` 现在会把准备稿全文和训练句对注入 `LiveKitPreparationContext`
   - `livekit_agent` 现役 correction prompt 现在优先读取：
     - `document_content`
     - `reference_lines`
     - `training_pairs`
   - `CommunicationAssistantRuntime` 现在已经改成：
     - 单条 cacheable 稳定前缀
     - 小窗口 recent history
     - 当前轮独立 prompt
     - 如果当前 ASR 和准备稿 / 训练目标句明显接近，优先恢复到对应原句
   - 同时已收掉 `timeout -> raw ASR` 伪成功路径：
     - 只有真正拿到 correction 时才发布 assistant transcript
     - DashScope 超时/失败时改发 `error` envelope，前端会退出 `isThinking`
     - 真实 HTTP 超时现在由 `DASHSCOPE_TIMEOUT_SECONDS` 控制，agent 日志会记录 `latency_ms / prompt_tokens / cached_tokens`

11. PWA 已重新开启并补了一轮本地行为治理
   - frontend 生产 build 现在默认启用 PWA，已经重新生成 `public/sw.js`
   - 新增 `VOXFLAME_ENABLE_PWA_DEV=1`：
     - 需要时可显式允许 localhost 保留 service worker / install prompt
   - 默认 localhost 仍会清 runtime cache，避免开发时被旧 PWA 缓存污染

12. 最新验证已通过
  - `cd frontend && npm run build`
  - `cd backend && npm run build`
  - `python3 -m unittest discover livekit_agent/tests -v`
   - `sudo docker compose --profile https build --no-cache frontend backend livekit-agent`
   - `sudo docker compose --profile https up -d --force-recreate livekit-server backend frontend livekit-agent caddy`
   - 同时已补一轮 Docker 提速治理：
     - 根 `.env` 已去掉 `LIVEKIT_AGENT_BASE_IMAGE=voxflame-agent-livekit-agent:latest` 这种自引用配置
   - `frontend/.dockerignore`、`backend/.dockerignore` 已补齐
   - `livekit_agent/.dockerignore` 也已加严

12. 训练数据导出现在多了一个最小入口
   - backend 已新增：
     - `npm run export:audio-target -- --email <email> --include-pending --output-dir <dir>`
   - 当前导出产物会落到服务器本地目录，结构为：
     - `audio/*.webm`
     - `samples.jsonl`
   - `samples.jsonl` 每行只保留：
     - `audio`
     - `target`
   - 已对账号 `2307294809@qq.com` 做 smoke：
     - `/tmp/voxflame-audio-target-smoke/audio/...`
     - `/tmp/voxflame-audio-target-smoke/samples.jsonl`
   - 同时修掉了导出脚本的 `.env` 载入顺序问题，避免错误导出 `0` 条

13. 腾讯云公网 HTTPS 预览入口已成立
   - 当前已新增 `https` profile 下的 `Caddy` 入口
   - 当前公网 HTTPS 预览地址：`https://111.230.35.89`
   - 浏览器级访问已通过；首页可正常打开
   - 同域 `https://111.230.35.89/api/rtc/health` 已命中 backend，并按预期返回 `401 Unauthorized`
   - backend 当前已对浏览器侧返回：
     - `LIVEKIT_BROWSER_URL=wss://111.230.35.89`
     - `VOXFLAME_PUBLIC_BASE_URL=https://111.230.35.89`
   - 已新增部署清单文档：
     - [docs/TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md](/home/ubuntu/VoxFlame-Agent/docs/TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md)

13. 大陆正式上线边界已查清
   - `sslip.io` 这类未备案临时域名在腾讯云大陆机上会撞备案拦截，不适合继续作为正式路线
   - 这台机器已经成功签到 `Let's Encrypt` 的公网 IP 证书
   - 正式品牌入口仍然建议使用自有备案域名，而不是长期停留在 IP 入口

14. LiveKit 部署配置已补一层稳定性
   - 已新增 `infra/livekit/start-livekit.sh`
   - `docker-compose.yml` 现在会把 `LIVEKIT_SERVER_DEV_MODE` 传进 `livekit-server`
   - 当前公网预览配置来源于 `infra/livekit/livekit.public.yaml`

15. 沟通页展示已收口
   - 已移除 `表达对照`
   - 已从前端状态树中删除 `currentDualLine / DualLineSubtitle` 残留
   - 当前用户界面不再单独展示“机器听到的”
   - fallback 文案不再输出“现在先按当前沟通场景继续 / 我先帮你把这句话往前推进”这类铺垫

13. LiveKit 连接主链已成立
   - 沟通页现在已经可以连接助手
   - 之前的前端自断连问题已通过稳定 `disconnect` callback 修复

14. 当前慢的主要根因已经查清
   - 慢点仍主要在 `ASR final -> DashScope correction/reply -> TTS`，不是 LiveKit 建链本身
   - 现在已不再用“超时后回退成 raw ASR”掩盖真实延迟
   - 当前线上试运行模型已临时切到 `qwen3.5-flash`
     - 目标是先压掉 `qwen3.6-plus` 的 correction timeout
     - 等拿到新一轮 `latency_ms` / 体感结果后，再决定是否做 `flash 预处理 + plus 最终纠错`
   - 接下来可以直接从 `livekit-agent` 日志读取真实 `latency_ms`，判断是否要再做：
     - 只保留字幕模式下的 correction
     - 先显示 interim/final ASR，再用 correction 最终替换
     - 或继续压 `max_tokens / history window / TTS` 节奏
     - 更长表达仍保留较宽容的等待窗口

15. turn/audio 主线现状
   - 已有：
     - RMS VAD
     - barge-in 门槛
     - LiveKit Python RTC APM
     - server-side audio telemetry
   - 仍待继续：
     - `room_options.audio_input`
     - 更稳的 endpointing / interruption policy
     - 会话内 `speaker differentiation`
16. 现场字幕主链已进一步收口
   - 继续复用现有 `字幕辅助 / 全屏字幕模式`
   - 沟通页启动时已显式申请 `1800s` 长会话
   - 前端进入字幕模式时会发送 `caption_mode_update`
   - `livekit_agent` 现在会：
     - 感知字幕模式
     - 字幕模式下跳过 TTS
     - 以异步入队、单 worker 串行方式处理最终 transcript
   - 全屏字幕模式现已支持：
     - 当前字幕
     - 最近字幕
     - `识别中 / 正在整理本句...`
   - 前端消息列表已加上限裁剪，减少长时会话状态膨胀
17. 公网登录跳转与新账号 smoke 已补齐
   - 未登录访问 `/contribute` / `/memory` 现在会正确跳到：
     - `https://111.230.35.89/login?next=%2Fcontribute`
     - `https://111.230.35.89/login?next=%2Fmemory`
   - 已直接注册新账号完成真实公网验证：
     - `voxflame.e2e.20260408152550@example.com`
   - 这个新账号下：
     - 训练页已是新布局
     - 记忆页已是新布局
     - 不会再自动带出默认 `speech.md` prepared-expression
18. HTTPS RTC 运行态根因已继续收口
   - 已确认并修掉两个 livekit-server 级问题：
     - `docker-compose` 直传 `LIVEKIT_TURN_TLS_PORT` 会让 `livekit-server v1.10.1` 即使在“脚本逻辑关闭 TURN/TLS”时仍报 `TURN domain required`
     - `livekit.public.yaml` 在当前腾讯云单公网 IP 预览形态下继续使用 `rtc.use_external_ip: true`，会诱发 `listen udp ...:7882: bind: address already in use`
   - 当前已落地：
     - `docker-compose.yml` 与 `infra/livekit/start-livekit.sh` 已改成 `VOXFLAME_LIVEKIT_TURN_*` 变量
     - `infra/livekit/livekit.public.yaml` 已改成显式 `rtc.node_ip: 111.230.35.89`
     - `.env` / `.env.example` 已同步切到新变量名
   - 当前 livekit-server 已稳定监听：
     - `7880/tcp`
     - `7881/tcp`
     - `7882/udp`
     - `3478/udp`
   - 浏览器公网 HTTPS smoke 已确认：
     - ICE server 现在只收到 `turn:111.230.35.89:3478?transport=udp`
     - 不再收到错误的 `turns:...:443`
     - 但连接仍停在 `checking / connecting`
   - 当前剩余 blocker 更像网络面：
     - 本机 `ufw` 未启用，`iptables INPUT ACCEPT`
     - 更像腾讯云安全组或用户上游网络还没放通 `3478/udp + 7882/udp + 7881/tcp`
19. HTTPS 公网 RTC 已补到可用态
   - 腾讯云防火墙已确认放开：
     - `80/tcp`
     - `443/tcp`
     - `7881/tcp`
     - `7882/udp`
     - `3478/udp`
   - 又定位到第二个 runtime 问题：
     - `livekit-agent` 在 `livekit-server` 不稳定时启动失败，worker 没有重新注册
   - 已执行：
     - `sudo docker compose restart livekit-agent`
   - 最新日志已确认：
     - `livekit-agent` 出现 `registered worker`
     - `livekit-server` 出现 `participant active`
     - `livekit-server` 出现 `mediaTrack published`
   - 当前判断：
     - HTTPS 公网主链已从“无法连通”推进到“可建立真实 UDP RTC + 发布音轨”
20. “录音后没有转录”这条假成功链已继续收口
   - backend 现在会在发 session token 前先探测：
     - `LIVEKIT_AGENT_HEALTH_URL`
     - 默认值：`http://livekit-agent:8081/`
   - frontend 现在会显式等待 `session_init_ack`
     - 没等到就不再显示“已连接”
     - 会直接报错，并阻止进入“空房间 + 无转录”的假成功状态
   - 当前还补了一次自动重试
     - 第一轮如果正好撞上 worker 恢复窗口，前端会自动重拉一轮会话再试一次
   - 同时把 profile/control bootstrap 消息放到了 init ack 之后
     - 避免 agent 尚未真正进房时控制消息先丢掉
   - `useRtcAgentSession` 失败路径也已清理 refs
     - 避免失败后 hook 误判“已经连着”

## 下一步

1. 先把 `livekit_agent` 的 typed session memory 和 context assembly 制度化
   - 明确 `session.userdata / PreparationContextPack / room runtime state` 的 owner 边界
   - 明确哪些字段只活在 session，哪些字段允许进入 durable memory

2. 把会后 compaction 稳定写回 `workspace snapshot`
   - 优先提炼高频误听 / 热词 / listener guidance / 当前最稳表达
   - 避免把 transcript 流水原样灌进长期记忆

3. 把句子级准备资产的录入入口统一起来
   - 收口 `prepared-expression / important-expression / 高频句 / personalized phrase`
   - 让沟通页、训练页、记忆页消费同一份句子级 owner，而不是各自维护

4. 把数据录入和标注流程收成可执行 contract
   - review queue、失败重试、人工修订、canonical label 边界要继续写清
   - 句子录入后默认自动跑“一句一音是否对应目标句”的校验，不先造独立 annotation UI
   - 先补“哪些样本必须进复核队列、哪些标签允许覆盖、哪些字段只做诊断不做监督”的规则

5. 为标注补一轮硬指标调查
   - 至少明确样本覆盖率、复核命中率、标注一致性、退回复录率、从录入到可用的时延
   - 当前默认先不做独立 annotation UI；只有自动校验命中风险的样本才进入轻量复核流

6. 在以上边界收稳后，再回到 10 分钟级别和公网条件下的真实沟通 smoke
   - 验证这些沉淀是否真实改善现场 correction，而不是只让后台数据更复杂
