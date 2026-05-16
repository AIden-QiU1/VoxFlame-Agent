# Mandarin Corpus Builder

这套脚本的目标不是把来源暴露到前端，而是把“真实语料抓取、清洗、筛选、场景归类、覆盖度打分”放在离线构建阶段完成。

## 设计原则

- 训练页只消费筛好的标准句库。
- 句长默认控制在 `6-16` 个汉字。这个范围优先服务“看提示录一句”的 supervised recording：足够短，能降低构音障碍用户的呼吸、注意和运动负担；又比单字/双字更能覆盖连续语流、停顿和真实沟通句式。`1-5` 字材料仍可作为音系筛查和最小对立练习，但不作为主功能句池主体。
- 句库来源必须可追溯，但来源信息只保留在离线产物里，不展示给用户。
- 如果环境里有 `pypinyin`，脚本会额外按声母 / 韵母 / 声调做覆盖度打分；没有的话也能跑，只是不会做音系均衡评分。
- 网页来源会先做文章打散、子句拆分和页面噪声过滤，尽量剔除导航、按钮、面包屑等无效文本。

## 推荐来源分层

- `标准转写库`：AISHELL、ST-CMDS、MAGICDATA、WenetSpeech、Common Voice zh-CN。适合补规范转写、短命令和自然口语。
- `普通话规范材料`：普通话水平测试朗读作品、规范读音材料。适合补标准普通话音系覆盖，但需要拆句，不要整段直接上训练页。
- `真实生活文本`：Apple 支持、12306、医保/政务办事指南、医院就诊流程、急救科普等公开页面。适合补贴近日常的设备、办事、就医、求助场景。
- `特殊人群口语`：SeniorTalk、构音障碍/老年语音相关公开数据。适合做口语风格和说话负担校准。
- `音韵强化材料`：声律启蒙、笠翁对韵、木兰诗、岳阳楼记、滕王阁序等公开经典文章。适合拆成 `5-20` 字句子，补声韵调和节奏覆盖，但不建议直接当用户前台场景标题。
- `日常与出行来源`：AAC 中文沟通板、12306、Apple 信息/通话/CarPlay/驾驶帮助页。适合补 `日常与出行` 这一类高频短句。
- `人群与角色来源`：SeniorTalk、ChildMandarin、养老服务/护理标准、老年友善礼貌用语、课堂互动应用、护士礼仪、客服常用语等。适合补 `老人 / 学生 / 课堂 / 照护者 / 服务岗位` 方向的真实表达。
- `Context7 不适用`：Context7 适合查软件库和框架文档，不适合抓取语料正文或下载数据集正文；语料获取应优先用 `web/curl/本地转写文件/Hugging Face/OpenSLR/GitHub 数据页`。

## 用法

### 常规刷新前端训练语料

默认路线是“先抓公开/本地来源快照，再从来源文本切分、过滤、去重、导出”。不要用模板批量造句。当前前端扩充池来自：

- 普通话水平测试朗读作品 60 篇页面。
- Tatoeba 派生中文例句 TSV。
- 公版/公开经典朗读与音韵材料。

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
  --phonology-corpus /tmp/voxflame-phonology-corpus.json \
  --manifest /tmp/voxflame-putonghua-reading-fetch/_local_manifest.json \
  --manifest /tmp/voxflame-open-example-sentences-fetch/_local_manifest.json \
  --output frontend/src/lib/corpus/generated/mandarin-training-real.json
```

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
