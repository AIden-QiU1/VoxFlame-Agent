# 来源与获取记录

| 来源 | 获取结果 | 实际类型 / 页数 | 访问时间 | SHA-256 | 用途与限制 |
| --- | --- | --- | --- | --- | --- |
| Cambridge University Press, Lee & Zee 2003, DOI `10.1017/S0025100303001208` | 成功读取出版社 PDF | PDF 1.3，4 页 | 2026-08-22 | `fbfca75de9c066825c6b94fffa5718b63976cdcb760fea62c1650971fb0edddf` | 锚定北京普通话音系描述；不代表全部地区/年龄/病因 |
| `mozillazg/pinyin-data/kMandarin_8105.txt` | 成功读取 commit 固定原文 | UTF-8 文本，8105 行有效读音 | 2026-08-22 | `1b1546f6e190c0f1cbf23e3bb436b41c3ace16f852be4daebc2c7295636628a4` | 生成常用规范字单一常用读音的音节基线；410 行上游标记待复核/争议 |
| `mozillazg/pinyin-data/LICENSE` | 成功读取 | UTF-8 文本，MIT | 2026-08-22 | `9c048697be2502a16e8bcb282d5d465a07295b2def0ffb05a269c5d39dbe1586` | 许可核验 |
| MDBG CC-CEDICT | 成功下载并通过 `gzip -t` | gzip 文本；124,918 行，元数据声明 124,889 条；快照日期 2026-08-22 | 2026-08-23 | `f552a8f4e3beddd2fcf2b5ad670cff24668ee8c60da839489492722e361f8dc5` | 构建字到现代词承载候选并发现核心参考外词音；CC BY-SA 4.0。含专名、方言、古语、拟声和轻声，不定义普通话完整库存，不直接上线 |
| Tatoeba `cmn_sentences_detailed.tsv.bz2` | 成功下载并通过 `bzip2 -t` | bzip2 压缩 TSV，1,715,869 bytes；解压 88,821 行 | 2026-08-22 | `51b284e29bac908df33600fa3db5a9a74b26dd38eb3c22f04519e434d34cbe31` | 只作缺口候选发现；逐句保留 sentence ID、贡献者和署名。默认文本许可为 CC BY 2.0 France；社区句子未经专业事实核验，不能直接上线 |
| Tatoeba 普通 sentences export 首次下载 | 文件损坏，未使用 | 不完整压缩文件 | 2026-08-22 | N/A | 已放弃，不能当作已读取语料；改用 detailed export 并完整校验 |
| 教育部门旧“汉语拼音方案”候选链接 | HTTP 404 | 未取得原文 | 2026-08-22 | N/A | 失败，不作为已读证据；后续寻找现行官方入口 |
| 教育部门旧普通话纲要候选链接 | HTTP 404 | 未取得原文 | 2026-08-22 | N/A | 失败，不作为已读证据 |
| `sawcordwell/HSK-Vocab` GitHub repository | GitHub API metadata and repository files successfully read; default branch `master`; repository license `CC0-1.0`; README and `hsk_1.csv` read | README SHA-256 `451a3d408dcebe4ab7a56b213f2334aa7ba3e297324ed531b96a4fd5bff1cdae`; `hsk_1.csv` SHA-256 `c7b6cdaaec8b122804af2fd410422dc4faa99a34f7f291c560e6964627efcbc5`; accessed 2026-08-24 | 词汇/等级参考，不能作为教材短句或朗读作品来源 | README states lists were generated from third-party PDFs and may contain unchecked errors; no sentence-level material; not imported into production |
| `gigacool/hanyu-shuiping-kaoshi` GitHub repository | GitHub API metadata and `LICENSE`/`README.md`/sample `hsk.json` content successfully read; default branch `master`; repository license `MIT` | LICENSE SHA-256 `d5256d24ce5c976038cf80c49962d448b0733fc86ae789f12a4a8e156ac725f7`; README SHA-256 `b8b2bdec115c7de5125a89a8d0512c0d26e43507570acf08f5f238e400775b30`; accessed 2026-08-24 | 词汇/等级参考，不能作为教材短句或朗读作品来源 | README says translations derive from CEDICT and declares a separate CC BY-NC distribution note; repository MIT does not by itself clear all embedded data rights; no production import |
| 本机 CDSD 路径 `/qiu/data/dysarthria-dataset-train-val-infer-jsonl/cdsd` | 当前机器不可访问 | N/A | 2026-08-22 | N/A | 只能读取固定 EXP 事实，不能声称逐条审计主微调集 |
| `Chen-xi111/Making-Mandarin-Sentences-from-syllables-bci` | GitHub 仓库、README 与 `corpus_sentences.csv` 成功读取；仓库 MIT | README SHA-256 `2438b1a0b9d8bceed48a02add80c6739e75bc2ea98a82cb032583997f7fbe849`; `corpus_sentences.csv` SHA-256 `6acb1e6584d3b9f1b8b7120a9a7ca9a54584450975b0dbe83204662f0086965c`; 访问 2026-08-24 | 开放研究朗读语料参考；195 句中仅 14 句通过本项目机器 gate，覆盖 15 个目标；不是教材，不直接代表训练导入批准 |

基线报告只保存聚合覆盖和质量统计，不复制用户 ID、逐条转写、设备标识或原始音频。

Tatoeba 首轮候选经过字符简体化、长度/字符/敏感词/专名过滤、现有题库去重和语言学缺口匹配后，从约 16,544 条机器可用候选中选出 300 条 review queue，覆盖 302 个当前缺失或低于 20 次的音节—声调目标。机器只提出 `functional_speech / connected_reading` 候选标签；全部条目的语言学、自然度、安全、许可和任务审核均初始化为 `pending`。抽查已确认仍有翻译腔、地区词、低场景价值和敏感内容，因此该文件状态固定为 `human_review_required_not_for_production`，不得直接并入题库。

2026-08-23 的全音系列构建继续使用同一份已核验 Tatoeba detailed export，并按整句实际拼音复核目标读音，避免用多音字字形误报覆盖。CC-CEDICT 只提供词语承载和整词读音候选；最终核心包仍需语言学、自然度、用户负担、安全、许可、产品六项审核。
