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
