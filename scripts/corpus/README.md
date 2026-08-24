# Mandarin Corpus Builder

这套脚本的目标不是把来源暴露到前端，而是把“真实语料抓取、清洗、筛选、场景归类、覆盖度打分”放在离线构建阶段完成。

## 设计原则

- 训练页只消费筛好的标准句库。
- 句长默认控制在 `7-18` 个汉字。这个范围优先服务“看提示录一句”的 supervised recording：足够短，能降低构音障碍用户的呼吸、注意和运动负担；又比单字/双字更能覆盖连续语流、停顿和真实沟通句式。`1-6` 字材料仍可作为音系筛查和最小对立练习，但不作为主功能句池主体。
- 句库来源必须可追溯，但来源信息只保留在离线产物里，不展示给用户。
- 如果环境里有 `pypinyin`，脚本会额外按声母 / 韵母 / 声调做覆盖度打分；没有的话也能跑，只是不会做音系均衡评分。
- 网页来源会先做文章打散、子句拆分和页面噪声过滤，尽量剔除导航、按钮、面包屑等无效文本。
- 前端训练目标句必须统一简体中文。推荐在导出环境安装 `opencc-python-reimplemented`，`export_frontend_source_corpus.py` 会优先使用 OpenCC `t2s` 做繁转简；未安装时才使用脚本内置兜底表。
- 严重污染按句子清理，不按来源或固定数量清理。明确色情、直接暴力、广告导流、确定的 ASR 重复 / 填充 / 拼接残片退出；普通新闻、财经、影视对话和有效医疗表达不因题材退出。
- “学习包 / 课程包 / 培训包 / 资料包”以及考试课程推广标题视为商业/课程营销噪声，逐句移除；不要把它们当成现代文章朗读或音系强化材料。原始来源只留作可追溯审计，不进入前端题库。

## 推荐来源分层

- `标准转写库`：AISHELL、ST-CMDS、MAGICDATA、WenetSpeech、Common Voice zh-CN。适合补规范转写、短命令和自然口语。
- `普通话规范材料`：普通话水平测试朗读作品、规范读音材料。适合补标准普通话音系覆盖，但需要拆句，不要整段直接上训练页。
- `真实生活文本`：Apple 支持、12306、医保/政务办事指南、医院就诊流程、急救科普等公开页面。适合补贴近日常的设备、办事、就医、求助场景。
- `特殊人群口语`：SeniorTalk、构音障碍/老年语音相关公开数据。适合做口语风格和说话负担校准。
- `现代文章朗读`：普通话水平测试朗读作品这类现代白话短文优先。适合补连续语流、停连、轻重音和现代汉语自然语序，是朗读训练默认入口。
- `音系强化`：从 AISHELL / WenetSpeech / 普通话现代朗读等真实现代中文候选中二次挑选，补声母、韵母、声调、连续语流和短句节奏覆盖。不使用古文分区，不用模板造句。
- `日常与出行来源`：AAC 中文沟通板、12306、Apple 信息/通话/CarPlay/驾驶帮助页。适合补 `日常与出行` 这一类高频短句。
- `人群与角色来源`：SeniorTalk、ChildMandarin、养老服务/护理标准、老年友善礼貌用语、课堂互动应用、护士礼仪、客服常用语等。适合补 `老人 / 学生 / 课堂 / 照护者 / 服务岗位` 方向的真实表达。
- `专业精选短句`：对高风险或高价值场景，不直接把网页正文全量灌进前端；先从官方 / 高可信来源抽象成短、清楚、可录音的 curated 目标句。当前覆盖急救与康复就医、重点旅客与无障碍出行、窗口 / 照护 / 课堂角色、实时语音 / 字幕 / 辅助功能设备操作。
- `Context7 不适用`：Context7 适合查软件库和框架文档，不适合抓取语料正文或下载数据集正文；语料获取应优先用 `web/curl/本地转写文件/Hugging Face/OpenSLR/GitHub 数据页`。

## 用法

### 常规刷新前端训练语料

默认路线是“先抓公开/本地来源快照，再从来源文本切分、过滤、去重、导出”。不要用模板批量造句。当前前端扩充池来自：

- 普通话水平测试朗读作品 60 篇页面。
- AISHELL-1 / AISHELL-3 转写文本、AISHELL-4 TextGrid 会议转写。
- WenetSpeech 修正版文本可用片段；脚本按行流式解析，完整 `text.fix` 到位后可直接重刷。

先抓取公开网页或文本来源：

```bash
python3 scripts/corpus/fetch_public_corpus_sources.py \
  --manifest scripts/corpus/source_inventory_putonghua_reading_2026.json \
  --output-dir /tmp/voxflame-putonghua-reading-fetch

python3 scripts/corpus/fetch_public_corpus_sources.py \
  --manifest scripts/corpus/source_inventory_phonology_2026.json \
  --output-dir /tmp/voxflame-phonology-fetch
```

大 TSV / 大 transcript 如果 `fetch_public_corpus_sources.py` 下载不稳，可以用 `curl -L` 落成本地文件，再写一个 `_local_manifest.json` 指向本地路径。

然后构建音韵池并导出前端 JSON：

```bash
python3 scripts/corpus/build_phonology_article_corpus.py \
  --manifest /tmp/voxflame-phonology-fetch/_local_manifest.json \
  --output /tmp/voxflame-phonology-corpus.json

python3 scripts/corpus/export_frontend_source_corpus.py \
  --manifest scripts/corpus/seed_modern_scene_sentences_2026.json \
  --manifest /tmp/voxflame-corpus-20260714/native-corpus-manifest.json \
  --manifest /tmp/voxflame-corpus-20260714/putonghua-reading/_local_manifest.json \
  --manifest /tmp/voxflame-corpus-20260714/daily-outing/_local_manifest.json \
  --output frontend/src/lib/corpus/generated/mandarin-training-real.json \
  --per-source-cap 14000 \
  --signature-cap 4 \
  --cap 日常与出行=0 \
  --cap 看病与求助=0 \
  --cap 人群与角色=0 \
  --cap 设备与数字=0 \
  --cap 现代文章朗读=5000 \
  --cap 会议与协作=900 \
  --cap 车载与导航=80 \
  --cap 音系强化=3000

python3 scripts/corpus/clean_generated_training_corpus.py \
  --input frontend/src/lib/corpus/generated/mandarin-training-real.json \
  --output frontend/src/lib/corpus/generated/mandarin-training-real.json \
  --audit-output frontend/src/lib/corpus/generated/mandarin-training-real.cleanup-audit.json
```

第二条命令是最终的逐句严重污染门。审计文件会保存每条退出句、原分类和退出原因；重复执行时会追加新发现并按文本去重。不要为达到一个预设数字扩大删除范围，也不要用某个来源的低质量比例整源退出。

清理或重新导出音系强化语料后，需要重建并验证前端使用的离线音系索引：

```bash
cd frontend
npm run build:phonology-index
npm run test:phonology-index
```

索引产物为 `frontend/src/lib/corpus/generated/mandarin-phonology-index.json`。它在构建期使用 `pinyin-pro` 计算声母、韵母、声调和变调，前端运行时只读取索引，不调用外部拼音服务。声母 / 韵母专项至少命中两个目标音节；声调专项只收四声覆盖、三声连读或“一 / 不”变调；每句最多进入三个最相关专项，未命中专项的句子仍保留在“全部音系句”。

如果本机已经下载了 AISHELL-1 / AISHELL-2 / 其他转写文本，不要把大数据集提交进仓库，直接把本地 transcript 放进 manifest，再交给 `build_mandarin_scene_corpus.py` 或 `export_frontend_source_corpus.py` 抽取。

导出脚本只抽取符合长度与清洗规则的中文目标句；录音流程仍然是 `target_text -> supervised recording -> upload receipt / manifest`，不是先自由录音再事后转写。

```bash
python3 scripts/corpus/build_mandarin_scene_corpus.py \
  --source /path/to/transcript.txt \
  --source https://example.com/source.html \
  --output /tmp/mandarin-scene-corpus.json
```

也可以传一个 manifest：

```json
{
  "sources": [
    {
      "id": "aishell_transcript",
      "source": "/data/aishell/transcript/aishell_transcript_v0.8.txt",
      "priority": 0.9,
      "usage_weight": 0.7
    },
    {
      "id": "apple_calls",
      "source": "https://support.apple.com/zh-cn/guide/ipad/-ipadf97892b2/ipados",
      "scene_hint": "手机设备",
      "priority": 1.1,
      "usage_weight": 1.2
    }
  ]
}
```

然后：

```bash
python3 scripts/corpus/build_mandarin_scene_corpus.py \
  --manifest scripts/corpus/source_inventory_2026.json \
  --output /tmp/mandarin-scene-corpus.json
```

如果希望按场景直接落成多个句库文件：

```bash
python3 scripts/corpus/build_mandarin_scene_corpus.py \
  --manifest scripts/corpus/source_inventory_2026.json \
  --output /tmp/mandarin-scene-corpus/all.json \
  --output-dir /tmp/mandarin-scene-corpus/scenes
```

如果希望先抓取公开网页再离线复跑：

```bash
python3 scripts/corpus/fetch_public_corpus_sources.py \
  --manifest scripts/corpus/source_inventory_2026.json \
  --output-dir /tmp/voxflame-corpus-fetch
```

然后把抓下来的 `_local_manifest.json` 直接喂给场景构建器。

如果要优先补 `日常与出行`：

```bash
python3 scripts/corpus/fetch_public_corpus_sources.py \
  --manifest scripts/corpus/source_inventory_daily_outing_2026.json \
  --output-dir /tmp/voxflame-daily-outing-fetch
```

如果要优先补 `学生 / 老人 / 课堂 / 照护者 / 服务岗位`：

```bash
python3 scripts/corpus/fetch_public_corpus_sources.py \
  --manifest scripts/corpus/source_inventory_people_roles_2026.json \
  --output-dir /tmp/voxflame-people-roles-fetch
```

如果要单独构建“音韵强化句库”：

```bash
python3 scripts/corpus/fetch_public_corpus_sources.py \
  --manifest scripts/corpus/source_inventory_phonology_2026.json \
  --output-dir /tmp/voxflame-phonology-fetch

python3 scripts/corpus/build_phonology_article_corpus.py \
  --manifest /tmp/voxflame-phonology-fetch/_local_manifest.json \
  --output /tmp/voxflame-phonology-corpus.json
```

## 输出格式

输出 JSON 会包含：

- `stats.raw_candidates`
- `stats.deduped_candidates`
- `stats.scene_counts`
- `scenes.<scene>[]`

每条句子至少有：

- `id`
- `text`
- `length`
- `scene`
- `source_id`
- `source_ref`
- `coverage_score`

注意：

- 这里不会把拼音写进最终句库产物。
- `coverage_score` 只是离线筛选用的内部指标，不应该直接给用户看。
- 如果某个来源抓取失败，脚本会打印 `[warn]` 并跳过，不会让整批构建中断。

## 语言学覆盖审计

题库数量、主题数量或“声母/韵母各出现一次”都不能证明覆盖充分。当前统一审计入口会分别报告核心音系库存、常用规范字读音涉及的无调音节、音节—声调、声调组合、连续语流现象和任务分区；`present` 与达到最小重复次数的 `robust` 分开统计。

先固定参考集合。参考源必须是本地已核验文件，命令显式记录来源 URL 和 commit：

```bash
node frontend/scripts/generate-mandarin-reference.mjs \
  --input /path/to/kMandarin_8105.txt \
  --output frontend/src/lib/corpus/generated/mandarin-common-syllable-reference.json \
  --source-url https://raw.githubusercontent.com/mozillazg/pinyin-data/<commit>/kMandarin_8105.txt \
  --source-commit <commit>
```

导出现役前端题库并审计：

```bash
cd frontend
npm run export:training-corpus -- --output .tmp/mandarin-training-prompts.json
cd ..

node frontend/scripts/audit-mandarin-coverage.mjs \
  --reference frontend/src/lib/corpus/generated/mandarin-common-syllable-reference.json \
  --corpus frontend/.tmp/mandarin-training-prompts.json \
  --minimum-hits 20 \
  --output /tmp/voxflame-prompt-coverage.json
```

审计应用采集 manifest 时可重复传入 `--manifest`；审计 CLEAR-VOX-MODEL 训练/验证/评测 JSONL 时重复传入 `--model-manifest`。输出只应保存聚合统计，不应提交用户 ID、逐条转写、设备标识或原始音频。

```bash
node frontend/scripts/audit-mandarin-coverage.mjs \
  --reference frontend/src/lib/corpus/generated/mandarin-common-syllable-reference.json \
  --manifest /path/to/app-manifest.jsonl \
  --model-manifest /path/to/train.jsonl \
  --minimum-hits 20 \
  --output /tmp/voxflame-collected-and-model-coverage.json
```

覆盖报告只能决定“下一批优先补什么”，不能单独证明微调有效。新增语料进入录音区只要求可执行题面具备非空 `target`；录音覆盖只按有效音频、非空 `target`、授权与上传契约计数。录音后的错读、漏读、空白过长和不可用音频进入质量诊断；`spoken_text`/audio-text 对齐是可选诊断，不是录音或覆盖前置条件。模型训练导入仍需独立的 speaker-disjoint 固定评测和目标用户完成率/疲劳验证。

录音就绪题面另行审计时，必须同时报告普通字形注音和题面自带的明确 `coverage_targets`：

```bash
node frontend/scripts/audit-mandarin-coverage.mjs \
  --reference frontend/src/lib/corpus/generated/mandarin-common-syllable-reference.json \
  --recording-corpus frontend/src/lib/corpus/generated/mandarin-recording-core-gap-corpus.json \
  --recording-corpus frontend/src/lib/corpus/generated/mandarin-recording-reinforcement-corpus.json \
  --recording-corpus frontend/src/lib/corpus/generated/mandarin-recording-open-research-corpus.json \
  --minimum-hits 20 \
  --output /tmp/voxflame-recording-ready-coverage.json
```

`recording_ready_corpus.coverage.common_syllable_tones` 是通用字形注音结果；`explicit_recording_targets` 是来源已提供整词/整句读音证据的目标结果。多音字不得用通用注音覆盖替代明确目标，也不得把录音就绪题面当成真实录音。

应用录音的实际 `spoken_text` 可以走独立人工诊断旁路。先从 manifest 生成队列（不会改写原 manifest 或音频）：

```bash
node frontend/scripts/build-mandarin-spoken-text-review-queue.mjs \
  --manifest /path/to/app-manifest.jsonl \
  --output /tmp/mandarin-spoken-text-review.json
node frontend/scripts/validate-mandarin-spoken-text-review.mjs \
  --input /tmp/mandarin-spoken-text-review.json
```

诊断员只在需要时填写 `spoken_text`、`spoken_text_status`、`audio_text_alignment`、`reviewed_by` 和 `reviewed_at`。ASR 只作为 `asr_hint`，不能直接升级为实际转写；这些字段只用于质量分层与复录提示，不改变录音覆盖资格：

```bash
node frontend/scripts/audit-mandarin-coverage.mjs \
  --reference frontend/src/lib/corpus/generated/mandarin-common-syllable-reference.json \
  --spoken-review /tmp/mandarin-spoken-text-review.json \
  --minimum-hits 20 \
  --output /tmp/voxflame-human-spoken-coverage.json
```

外部开放文本只能生成待审核候选。例如 Tatoeba detailed export 必须先校验压缩包、SHA-256、许可与逐句署名，再用缺口筛选器生成 review queue：

```bash
node frontend/scripts/select-mandarin-gap-candidates.mjs \
  --input /path/to/cmn_sentences_detailed.simplified.tsv \
  --audit research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/baseline-audit.json \
  --corpus frontend/.tmp/mandarin-training-prompts.json \
  --output /tmp/mandarin-gap-candidates.json \
  --source-url https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences_detailed.tsv.bz2 \
  --source-sha256 <verified-sha256> \
  --license "CC BY 2.0 FR"
```

输出中的任务类型只是候选召回标签，五类 review 必须全部由审核人完成。不得把 `human_review_required_not_for_production` 文件导入现役题库。

## 全音系列目标台账与核心补音发布

1242 项核心音节—声调要逐项建立 `当前命中 -> 规范汉字 -> 现代词语 -> 自然短句` 承载链。CC-CEDICT 和 Tatoeba 只能生成待审候选；词典条目存在不等于适合默认用户，字形出现也不等于多音字实际读到目标音。

当前数量口径必须分清：`mandarin-training-real.json` 是 8771 条外部生成子池，前端再合并 336 条人工策划/固定评估项，形成 9107 条现役唯一题目。相对历史 9112 条，只退出 5 条明确“学习包”商业污染；不能把 8771 误读为又删除了 336 条。217 个完全缺失目标仍全部保留在 1242 项台账中，产品路由为 `88 core / 121 edge / 8 disputed`；另有 1 个已出现但不足 20 次的 disputed 目标，所以全台账 tier 总数会显示 9 disputed。

```bash
cd frontend
npm run build:mandarin-coverage-ledger -- \
  --reference src/lib/corpus/generated/mandarin-common-syllable-reference.json \
  --audit ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/baseline-audit.json \
  --corpus .tmp/mandarin-training-prompts.json \
  --characters /path/to/kMandarin_8105.txt \
  --cedict /path/to/cedict_1_0_ts_utf-8_mdbg.txt.gz \
  --tatoeba /path/to/cmn_sentences_detailed.simplified.tsv \
  --output src/lib/corpus/generated/mandarin-coverage-target-ledger.json \
  --candidate-output ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-gap-prompt-candidates.json

npm run select:mandarin-core-gap-phase1 -- \
  --input src/lib/corpus/generated/mandarin-coverage-target-ledger.json \
  --authored ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-authored-gap-candidates.json \
  --output ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-core-gap-phase1-review.json \
  --examples-per-target 3

npm run validate:mandarin-core-gap-review -- \
  --input ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-core-gap-phase1-review.json \
  --approved-output src/lib/corpus/generated/mandarin-approved-core-gap-corpus.json

npm run export:mandarin-core-gap-review-sheet -- \
  --input ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-core-gap-phase1-review.json \
  --output ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-core-gap-phase1-review.tsv \
  --batch-size 30

npm run build:mandarin-core-gap-review-workspace -- \
  --input ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-core-gap-phase1-review.json \
  --output src/lib/corpus/generated/mandarin-core-gap-review-workspace.json \
  --batch-size 30
```

核心候选必须完成 `linguistic / naturalness / user_burden / safety / license / product` 六项审核并填写审核人、时间，才会进入批准导出。当前 88 个默认核心目标各保持 `1 个整词锚点 + 2 个短句句境`，共 263 条唯一候选（88 词、175 短句，其中 1 句同时覆盖两个目标），分成 9 批。词锚点优先中性现代承载词；高频但高负担的“歹徒、懒惰、醉醺醺、挣扎”等不得仅因词频较高成为默认锚点。TSV 便于语言学和目标用户逐行复核；它是审核工作表，不是生产导入文件。边缘音单独生成 specialist review pack，争议读音不生成用户任务。`学习包 / 课程包 / 培训包 / 资料包` 在候选入口和发布门双重拦截。正常题库、历史录音和 manifest 不因补音建设被删除。

站内 `/corpus-review` 是同一审核包的产品化入口。页面和 `/api/corpus-review/core-gap` 均需登录，且服务端环境变量 `VOXFLAME_CORPUS_REVIEWER_EMAILS` 必须显式列出审核者邮箱；空白名单默认拒绝。浏览器只把草稿保存在本机并导出 decision JSON，不能直接写仓库、现役题库或生产语料。

导出的 decision JSON 必须经 CLI 校验来源快照、候选 ID、六项状态与改写/拒绝说明，再合并回审核包：

```bash
cd frontend
npm run merge:mandarin-core-gap-review-decisions -- \
  --review ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/mandarin-core-gap-phase1-review.json \
  --decisions /path/to/mandarin-core-gap-decisions.json \
  --output /tmp/mandarin-core-gap-phase1-reviewed.json \
  --summary /tmp/mandarin-core-gap-decision-validation.json

npm run validate:mandarin-core-gap-review -- \
  --input /tmp/mandarin-core-gap-phase1-reviewed.json \
  --summary /tmp/mandarin-core-gap-review-validation.json \
  --approved-output /tmp/mandarin-approved-core-gap-corpus.json
```

只有第二步输出中的六项全批准条目才具备进入正式 `mandarin-approved-core-gap-corpus.json` 的资格。审核者仍需核对目标用户可读性和疲劳，不能用网页的一键通过替代语言学判断。

题库的任务分区与语言学标签通过旁路索引生成，原题目文本和原类别保持不变：

```bash
cd frontend
npm run build:mandarin-linguistic-index
npm run test:mandarin-linguistic-index
```

索引中的 `task_id` 只有一个，供用户任务导航使用；`initials`、`finals`、`tones`、`syllable_tones`、`tone_pairs`、音节位置和连续语流标记可以同时存在，供缺口推荐、审计和人工复核使用。索引不是医疗判断，也不代表方言或构音障碍人群的完整覆盖。

人工复核门禁：

```bash
cd frontend
npm run test:mandarin-review-queue
node scripts/validate-mandarin-review-queue.mjs \
  --input ../research/speech-health/evidence/mandarin-collection-coverage-2026-08-22/tatoeba-gap-candidates.json \
  --output /tmp/mandarin-review-queue-validation.json
```

五项审核（语言学、自然度、安全、许可、任务）必须逐条填写。`pending`、`rewrite`、`rejected` 都不能进入题库；即使五项都是 `approved`，还必须补 `reviewed_by` 和 `reviewed_at`，并经过目标用户可读性/疲劳测试与固定评测后才允许另行导入。校验器不会修改候选队列，也不会删除原题库。

实验评测门禁：

```bash
cd frontend
npm run test:mandarin-evaluation-gate
node scripts/validate-mandarin-evaluation-report.mjs --input /path/to/evaluation-report.json
```

评测报告必须提供固定 speaker-disjoint split、冻结测试集、总体 CER、最差说话人 CER、短句 CER、严重度和长度分层、P95 延迟、用户任务成功/跳过/疲劳指标，以及可验证回退动作。只有 `validate`/`hold`/`reject` 可以在证据不足时保留；`adopt` 还必须有实测用户收益和已验证回退路径。
