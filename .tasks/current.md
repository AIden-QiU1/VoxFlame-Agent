# 当前任务状态

> 最后更新: 2026-04-29

## 当前主线

- 主任务：把当前产品主线收成 `沟通成功率 -> typed memory -> 句子级准备资产 -> 数据录入/标注 -> 四块记忆系统后台维护` 的稳态闭环，不再新增大功能。
- 当前执行面：`frontend -> backend -> self-hosted livekit-server -> livekit_agent`。
- 当前最重要的产品/工程重点：
  - 把 `session-local typed memory -> 四块记忆系统后台维护 -> workspace snapshot` 的 owner 与写回边界做扎实
  - 把 `prepared-expression / important-expression / 高频句` 的录入和复用入口统一起来
  - 把 dataset 收成最小 audio-target contract，只保留“录音和目标句是否对上”的稳定判断

## 最新收口

0. 2026-04-29 已新增“从需求到应用架构”的 full-stack 学习指南
   - 新增 [VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_FULLSTACK_ARCHITECTURE_LEARNING_GUIDE_2026-04-29.md)
   - 文档把新需求拆解固定成：
   - `真实场景 -> surface -> 状态生命周期 -> owner -> contract -> flow -> failure -> verification`
   - 结合当前 VoxFlame 主链说明：
   - `Frontend = 产品 surface + 本地兜底`
   - `Backend = durable owner + control plane`
   - `LiveKit = realtime transport`
   - `livekit_agent = session runtime intelligence`
   - `Dataset = audio-target asset system`
   - 同时补了 React / Next.js / Express / Supabase / LiveKit / MDN / Stripe / 12-Factor / Sam Newman / Martin Fowler 等学习链接
   - 已同步入口：
   - [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)
   - [FOUNDER_COLLABORATION_LOOP_2026-03-25.md](/home/ubuntu/VoxFlame-Agent/docs/FOUNDER_COLLABORATION_LOOP_2026-03-25.md)
   - [backend/README.md](/home/ubuntu/VoxFlame-Agent/backend/README.md)

0. 2026-04-29 已把 OSS 全量对象按账户下载到本地 artifacts
   - 输出目录：[artifacts/oss-by-account](/home/ubuntu/VoxFlame-Agent/artifacts/oss-by-account)
   - 当前 OSS 对象总数 `463`，总量约 `63.6 MB`
   - 本地排除 `_inventory.json / _objects.jsonl` 后文件数为 `463`
   - 账户目录：
   - `1137205964__8a533bbe`: `114` 个对象
   - `13818790456__d01b4410`: `29` 个对象
   - `2307294809__64758dee`: `286` 个对象
   - `874888410__800f7d03`: `5` 个对象
   - `legacy__v_gv7fxwrp`: `7` 个对象
   - `ltf.edgar__53649c22`: `6` 个对象
   - `unassigned`: `16` 个对象
   - 新增 [download_oss_by_account.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/download_oss_by_account.ts)，可通过 `cd backend && npm run download:oss-by-account` 重跑
   - 已验证：
   - `cd backend && ./node_modules/.bin/tsc --noEmit --skipLibCheck --esModuleInterop --module commonjs --target ES2020 --moduleResolution node scripts/download_oss_by_account.ts`
   - `cd backend && ./node_modules/.bin/ts-node scripts/download_oss_by_account.ts --dry-run`
   - `cd backend && ./node_modules/.bin/ts-node scripts/download_oss_by_account.ts`

0. 2026-04-28 已把训练页计划位改成固定练习目标和匿名昨日榜
   - 训练总结模型现在只生成 `daily_summary / weekly_summary`，不再生成或展示 `training_plan`
   - backend `workspace snapshot` 新增匿名 `training_activity`：
     - 固定口号：`每天先练 20 句`
     - 昨日 Top 3 只返回 `rank / recording_count`，不暴露邮箱、用户名或 user id
   - 训练页和记忆页都改成展示固定 20 句目标、匿名昨日训练榜、今日总结和 7 天总结
   - 训练总结取样现在按最近 7 天窗口分页读取 `voice_contributions`，不再只截最近 80 条
   - 训练录音页默认关闭 agent TTS 回声，只保留系统听到文本和用户录音回听；本次结果卡片已压缩为目标 / 系统听到 / 回听 / 重录的最小面板
   - 本次结果新增“不收录”小按钮：默认仍自动上传，用户不满意时可撤回本地队列 / 云端登记 / OSS 训练索引
   - ASR 链路改成先 VAD 再送模型，并过滤“我我我…”这类重复字噪声 transcript
   - 已验证：
   - `cd backend && npm run build`
   - `cd frontend && npm run build`
   - `python3 -m unittest livekit_agent.tests.test_session_userdata`
   - `python3 -m unittest livekit_agent.tests.test_asr_runtime livekit_agent.tests.test_session_userdata`
   - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/training/final-transcript.test.ts`
   - `bash scripts/check_ai_docs.sh`

0. 2026-04-28 已把脑卒中后持续说话练习写入 PRD
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 新增“练习工作台核心场景：脑卒中后持续说话练习”
   - 明确后续每日 / 7 天总结要支持同句或同类句子的进步评估，但只能表达“训练表现 / 系统识别代理指标改善”，不能表达医学康复结论
   - 今日总结 / 7 天总结的产品口径已收成简练规律性内容，具体字词错配留在结构化例子字段里
   - 后续实现顺序先落 backend progress feature builder，再改 daily / weekly summary prompt
   - 已验证：
   - `cd backend && npm run build`
   - `bash scripts/check_ai_docs.sh`

0. 2026-04-27 已按客户反馈补训练录音页移动端与回放体验
   - [frontend/src/app/contribute/page.tsx](/home/ubuntu/VoxFlame-Agent/frontend/src/app/contribute/page.tsx) 已调整训练录音页响应式顺序：
     - 手机窄屏先显示当前词 / 当前句与录音按钮
     - 词表与主题说明排到后面，避免 iPhone 首屏只看到 20 条筛查词而误以为“麦克风页面没出来”
     - 桌面端仍保持左边句子准备、右边录音结果的两栏结构
   - 录完一条后，本次结果区新增“回听自己的声音”，直接用浏览器原生 audio 控件播放刚录到的音频 blob
   - 这次同时确认客户截图里的 `http://111.230.35.89` + iPhone Safari / 无痕浏览会触发移动端麦克风限制风险；真实麦克风验证应使用 HTTPS 域名或 localhost secure context
   - 已验证：
   - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/training/training-assessment.test.ts src/lib/training/final-transcript.test.ts`
   - `cd frontend && npm run build`

0. 2026-04-23 已把产品 PRD 改成“上线后规划版”
   - [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 不再继续维护“上线前收口 / 最后 blocker”语气
   - 当前明确承认 Web 主产品已经具备上线基线
   - PRD 现在主要承接：
     - `App / companion` 规划
     - `硬件接入` 规划
     - `自定义语音 agent 框架` 规划
     - `记忆架构` 规划
   - 现役主链、durable owner、dataset/memory 边界继续作为下一阶段默认前提，不再重复争论
   - 已同步更新：
     - [README.md](/home/ubuntu/VoxFlame-Agent/README.md)
     - [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md)
     - [AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md)

0. 2026-04-22 已把指定账号的 OSS 训练数据导出成可人工审阅的数据集
   - 根目录 [`.gitignore`](/home/ubuntu/VoxFlame-Agent/.gitignore) 已新增 `artifacts/dataset-review/`
   - 账号 `2307294809@qq.com`（用户 `64758dee-5026-4b53-a063-1d02d0834f67`）当前 `194` 条样本已导出到：
     - [samples.jsonl](/home/ubuntu/VoxFlame-Agent/artifacts/dataset-review/2307294809/samples.jsonl)
     - [audio/](/home/ubuntu/VoxFlame-Agent/artifacts/dataset-review/2307294809/audio)
   - backend 新增 [export_dataset_review_report.ts](/home/ubuntu/VoxFlame-Agent/backend/scripts/export_dataset_review_report.ts)，现在可以按账号输出：
     - [label-review-summary.json](/home/ubuntu/VoxFlame-Agent/artifacts/dataset-review/2307294809/label-review-summary.json)
     - [label-review.csv](/home/ubuntu/VoxFlame-Agent/artifacts/dataset-review/2307294809/label-review.csv)
     - [label-review.md](/home/ubuntu/VoxFlame-Agent/artifacts/dataset-review/2307294809/label-review.md)
   - 首轮判断：
     - `metadata_incomplete = 0`
     - `likely_reasonable = 88`
     - `needs_manual_review = 106`
     - `high_risk = 5`
   - 当前更像“样本质量 / ASR 对齐信号需要人工复核”，而不是“大量监督标签字段本身填错”

0. 2026-04-21 已把开源前的入口文档收成“当前现状 + 协作方向”
   - [README.md](/home/ubuntu/VoxFlame-Agent/README.md) 已删除一批已完成但仍写成“当前重点 / 近期开发路径”的旧条目
   - README 现在把重点改成：
     - `Web 主产品继续打磨`
     - `App / companion 接入`
     - `硬件接入`
     - `自主语音 agent 架构`
   - 新增开源协作方向文档 [VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_OPEN_SOURCE_COLLABORATION_DIRECTION_2026-04-21.md)
   - [产品 PRD](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 不再继续维护已经过时的“上线前 blocker / 最后测试清单”，只保留产品边界和文档路由
   - [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md) 已把开源协作方向加入现役入口和快速查找
   - 已验证：
   - `bash scripts/check_ai_docs.sh`

0. 2026-04-21 已把核心 5 个页面往“能立刻上手的产品面”统一收口
   - 首页、手册页、记忆页、训练页、沟通页现在统一使用同一套暖色背景、卡片层级和更克制的说明密度
   - 首页已改成更直接的产品入口：保留核心能力卡，并新增“新用户先这样开始 / 录音只记 3 件事”
   - 手册页已收成真正的短手册：只保留 `先做什么 / 怎么录 / 什么时候去哪个页`
   - 记忆页已从“后台管理感”往“记忆与准备”页面收：
     - 顶部口径更简洁
     - section shell 预览更克制
     - 用户画像写法改成 5 条清晰引导
   - 训练页评估区已继续收轻：
     - 疾病种类和严重程度集中在同一块
     - 空 transcript 不再误提示成“没录到声音”
     - 空 transcript 不再自动跳下一词，也不再算进评估结果
   - 首页训练入口现在也已明确标注：至少录够 `100` 句，才开始训练模型
   - 沟通页顶部也已收成同一产品语言：首句优先、状态更短、隐私边界更清楚
   - `发音与朗读` 语料里的繁体字这轮也已统一转成简体，首页训练示例同步改成简体口径
   - 训练上传 metadata 继续直接写 `etiology / severity`
   - 旧“解析记忆页文档提取病种/严重程度”的测试残留已删除，不再沿那条路径走标签
   - 已验证：
   - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/training/training-assessment.test.ts src/lib/training/final-transcript.test.ts`
   - `cd frontend && npm run build`

0. 2026-04-21 已把训练页 TTS 和评估短词 finalize 再收紧一层
   - 训练页 final transcript 之前还会进 correction 链，所以播出来的内容可能和 ASR 转录不一样，出现“大家好”这类回复
   - 当前 [livekit_agent/app.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/app.py) 已改成：
     - `training_workspace` 不再把 final transcript 排进 correction reply queue
     - 如果训练页开启 TTS，就直接播 ASR final transcript 本身
     - 训练页发出的 assistant transcript 也与 ASR final 保持一致，不再另生成一条别的回复
   - 当前 [livekit_agent/asr_runtime.py](/home/ubuntu/VoxFlame-Agent/livekit_agent/asr_runtime.py) 也已补上评估短词专用保护：
     - 评估筛查模式会显式声明 `short_utterance_expected`
     - `manual_stop` 不再误杀 `<=2` 字的合法 final transcript
     - 短词停录后会给 final transcript 更稳的收敛窗口
   - frontend [useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts) 已同步把评估模式标记和停录等待窗口传给 agent
   - 已验证：
   - `python3 livekit_agent/tests/test_asr_runtime.py`
   - `python3 livekit_agent/tests/test_data_contract.py`
   - `python3 livekit_agent/tests/test_session_userdata.py`
   - `python3 -m py_compile livekit_agent/app.py livekit_agent/asr_runtime.py livekit_agent/data_contract.py livekit_agent/session_userdata.py`
   - `cd frontend && node --import ./test/register-runtime-test-hooks.mjs --test --experimental-strip-types src/lib/training/training-assessment.test.ts src/lib/training/final-transcript.test.ts`
   - `cd frontend && npm run build`

0. 2026-04-21 已把病因 / 严重程度从“代码里有枚举、前端没有入口”改成真正可填可存
   - backend [supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts) 的 `user_profile_memory` 现在会持久化 `etiology / severity`
   - [memory.controller.ts](/home/ubuntu/VoxFlame-Agent/backend/src/controllers/memory.controller.ts) 的 `PUT /memory/workspace/:userId/profile-memory` 已接收并写回这两个字段
   - frontend 已按用户反馈重新收轻：
     - 不再新增独立“训练标签”区
     - 用户画像只在文档编辑区里预填模板
     - 不再通过额外表单给用户增加负担
   - 训练录音上传现在优先合并 durable `user_profile_memory` 的病因 / 严重程度，并直接以 `etiology / severity` 写进样本 metadata
   - 这让后续导出 `samples.jsonl` 时，疾病种类 / 严重程度终于有稳定 durable 来源，而不是只靠前端临时态
   - 已验证：
   - `cd backend && npm run build`
   - `cd frontend && npm run build`

0. 2026-04-21 已查清“训练总结为什么还是 null”
  - 当前 `training_reports` 只汇总带 `prepared_expression_id` 的“自定义材料切句训练”，不会汇总 `日常与出行` 这类主题句库训练
  - backend summary service 的事实源目前是 `memories.kind=training_result`，不是 `voice_contributions`
  - 现场检查用户 `2307294809@qq.com`：
     - `voice_contributions` 与 OSS 里都有训练样本
     - 但 `memories` 里没有对应 `training_result`
  - 所以当前 summary 为 `null` 的主要原因不是“时间没到”，也不是目前能看到的“模型调用失败”，而是 summary 输入链没有接上

0. 2026-04-21 已把训练总结逻辑改成“全训练样本日/周总结”
   - backend [supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts) 已改成从 `voice_contributions` 读取训练样本
   - summary 不再依赖 `memories.kind=training_result`
   - summary 取样不再限制 `prepared_expression_id`
   - 当前口径改成：每天训练完后，不管来自哪个专区，只根据上传样本里的 `target_text / recognized_text` 做日总结、周总结和下一轮计划
   - [prepared-expression-summary.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/prepared-expression-summary.service.ts) 的 prompt 也已清理：
     - 输出一般性规律
     - 给 1 到 2 个代表例子
     - 不再把材料说明 / 场景标题 / 系统提示误写成训练结论
   - 已验证：
   - `cd backend && npm run build`

0. 2026-04-20 已把腾讯云中国大陆部署文档改写成正式上线步骤
   - [docs/TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md](/home/ubuntu/VoxFlame-Agent/docs/TENCENT_CLOUD_MAINLAND_DEPLOY_CHECKLIST_2026-04-07.md) 不再以“当前开了哪些端口、IP 预览怎么跑”为主线
   - 当前文档已改成一条可以顺序执行的 runbook：
     - 买域名
     - 域名实名认证
     - 等满备案要求时间
     - 腾讯云首次备案
     - 备案后正式 DNS 解析
     - 使用 `Caddy` 自动 HTTPS 切到正式域名
     - 做公网 RTC smoke
   - 文档也已明确当前仓库边界：
     - 第一阶段正式上线推荐 `app.<domain>` 单域名
     - 当前不把独立 `turn` 域名 + TURN/TLS 写成现成步骤
   - [docs/README.md](/home/ubuntu/VoxFlame-Agent/docs/README.md) 已新增导航入口
   - 已验证：
   - `bash scripts/check_ai_docs.sh`

0. 2026-04-20 已按“高质量普通话短句”重写四个训练主题，并清空该账号旧训练数据
   - 账号 `2307294809@qq.com` 对应用户 `64758dee-5026-4b53-a063-1d02d0834f67` 的旧训练样本已清空：
     - `voice_contributions: 51 -> 0`
     - OSS 相关训练对象和 `dataset/{userId}` 导出对象共删掉 `53` 个
   - frontend 新增 [curated-topics.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/mandarin-training-data/curated-topics.ts)
   - [mandarin-training-data/index.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/mandarin-training-data/index.ts) 现在优先使用四组精选语料，替换掉现役低质量旧句：
     - `日常与出行`: `88` 条
     - `看病与求助`: `67` 条
     - `人群与角色`: `89` 条
     - `设备与数字`: `160` 条
   - 全部句子限制在 `6-15` 字，并在代码层直接校验长度和重复
   - `发音与朗读` 保持原状，没有替换
   - 当前旧 [mandarin-training-real.json](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/generated/mandarin-training-real.json) 已把四组旧生成语料物理删除，只保留 `发音与朗读`
   - frontend [types.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/corpus/mandarin-training-data/types.ts) 新增显式 `MANDARIN_TRAINING_CATEGORY_ORDER`
   - 训练页分类卡、计数与录音页选择不再依赖旧 JSON key，删除旧库四类后前端 UI 仍保持一致
   - 选材依据参考了：
     - `12306` 重点旅客/出行服务说明
     - `120` 急救求助电话官方指引
     - 政务热线 / 公共服务普通话与文明用语规范
     - 常见手机操作与数字表达的高频场景
   - 已验证：
   - `cd frontend && npm run build`

0. 2026-04-20 已把训练录音上传链收成 `wav only`
   - frontend 新增 [recording-to-wav.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/audio/recording-to-wav.ts)
   - 当前训练录音在真正上传到 OSS 或进入本地补传队列前，会先统一解码并转成 `16k / mono / PCM16 WAV`
   - frontend [useVoiceUpload.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useVoiceUpload.ts) 现在不会再直接保存新的 `webm` 训练资产
   - 这样后续新录样本的 `audio_format` 会稳定收敛到 `audio/wav`
   - 已验证：
   - `cd frontend && npm run build`
