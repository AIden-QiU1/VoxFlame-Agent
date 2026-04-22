# 当前任务状态

> 最后更新: 2026-04-21

## 当前主线

- 主任务：把当前产品主线收成 `沟通成功率 -> typed memory -> 句子级准备资产 -> 数据录入/标注 -> 四块记忆系统后台维护` 的稳态闭环，不再新增大功能。
- 当前执行面：`frontend -> backend -> self-hosted livekit-server -> livekit_agent`。
- 当前最重要的产品/工程重点：
  - 把 `session-local typed memory -> 四块记忆系统后台维护 -> workspace snapshot` 的 owner 与写回边界做扎实
  - 把 `prepared-expression / important-expression / 高频句` 的录入和复用入口统一起来
  - 把 dataset 收成最小 audio-target contract，只保留“录音和目标句是否对上”的稳定判断

## 最新收口

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
