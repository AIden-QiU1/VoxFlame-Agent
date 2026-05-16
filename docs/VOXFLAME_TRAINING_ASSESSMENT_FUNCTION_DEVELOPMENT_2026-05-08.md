# VoxFlame 第一功能：训练反馈开发标准（2026-05-08）

> 第一功能不是“评估产品”，而是训练反馈系统。它的目标是让中风后构音障碍用户每天更容易被系统和身边人理解。

## 1. 本质判断

训练反馈做得好，不是因为页面上有一个 80 分，而是因为它同时做到四件事：

1. **可测量**：每次训练都留下可复现的结构化信号。
2. **可解释**：分数能回到具体材料、错配、声学特征或样本质量。
3. **可行动**：反馈直接告诉用户下一次最小可练动作。
4. **可迁移**：训练中发现的稳定错配能改善实时沟通翻译器。

VoxFlame 第一功能的产品定义：

> 用固定训练材料、系统听懂代理指标、声学特征和跨天趋势，持续学习用户的表达方式；给用户低压力反馈，并把训练结果反哺沟通翻译器。

它不是：

1. 独立临床诊断系统。
2. Frenchay 汉语版或中国康复研究中心构音障碍检查的替代。
3. 医生减负工具的第一阶段产品。
4. 通用大模型对呼吸、发声、共鸣、韵律随口打分。

第一阶段只能说：

1. “本组材料下，系统听懂分提升。”
2. “同一句最近三次更稳定。”
3. “这个词反复被系统听成另一个词。”
4. “这条训练信号可作为医生或治疗师参考材料。”

不能说：

1. “康复程度提升。”
2. “病情改善。”
3. “疗效显著。”
4. “临床严重程度变轻。”

## 2. 外部证据校准

### 2.1 评估不能简化成 ASR 对错

ASHA 将成人构音障碍放在呼吸、发声、构音、共鸣、韵律等言语子系统中理解，同时强调可懂度、可理解性、沟通效率、参与度和生活影响。ASHA 还区分 screening 与 assessment：筛查用于判断是否需要进一步评估，不提供诊断或详细严重程度描述。

Mayo Clinic 也把诊断主体放在 speech-language pathologist：治疗师会听辨言语特征，要求朗读、复述词句，并评估面部、舌和喉部肌肉控制。

对产品的约束：

1. ASR 字准率只能做系统听懂代理指标。
2. 不能把“系统听错”直接等价成“患者构音错误”。
3. 呼吸、发声、共鸣、韵律若要评分，必须先有可复现特征或人工标注。

### 2.2 中风后构音障碍 outcome 不止清晰度

2024 年 post-stroke dysarthria core outcome 相关综述把关键 outcome 域归纳为：

1. speech intelligibility。
2. conversation participation。
3. living well with dysarthria。
4. communication partner skills and knowledge。

对产品的约束：

1. 训练反馈不能只追求更高字准率。
2. 必须追问是否改善真实沟通参与。
3. 照护者、家属和沟通伙伴的理解能力也应成为后续维度。

### 2.3 普通话语料必须覆盖音系

中国康复研究中心构音障碍检查法按汉语普通话发音特点编制，通常分为构音器官检查和构音检查。Frenchay 常见介绍则包括反射、呼吸、唇、颌、软腭、喉、舌、言语等大项。

普通话中风后构音障碍声学研究还提示：

1. 可用 `/a, i, u, ɤ, y, o/` 等元音做声学分析。
2. 研究材料可设计为 CV 单音节并覆盖四声。
3. 元音空间缩小、元音类别重叠和 formant 偏差与可懂度相关。
4. 有研究用更大的普通话单音节词表做整体可懂度评分。

对产品的约束：

1. 训练评估语料必须标注 pinyin、声母、韵母、声调。
2. 必须区分低语义可预测材料和高频生活材料。
3. 声学层要从固定元音、固定声调、固定录音条件开始。

## 3. 当前 20 词审计

现有 20 词：

`爸爸 / 妈妈 / 喝水 / 吃饭 / 刷牙 / 上学 / 司机 / 医生 / 老师 / 护士 / 手机 / 地铁 / 公交 / 蓝牙 / 密码 / 开门 / 关灯 / 谢谢 / 知道 / 睡觉`

结论：只能保留为 `screening_v0_daily_onboarding`，不能叫标准评估。

它的价值：

1. 认知负担低，适合第一次进入训练页。
2. 能快速验证麦克风、ASR、上传和反馈闭环。
3. 能让用户看到“系统听到什么”。

它的问题：

1. 声母覆盖不均衡，缺少 `p / n / q / r / z / c` 等关键对照。
2. 韵母覆盖不系统，没有单韵母、复韵母、前鼻韵母、后鼻韵母分层。
3. 声调没有平衡设计。
4. 语义可预测性太高，ASR 可能靠语言模型补全。
5. 只有双字词，看不到短句、朗读、持续发声和自由表达。
6. 无法观察呼吸支持、发声稳定、韵律、停顿和沟通参与。

开发标准：

1. UI 不再显示“初步等级：重度/中度/轻度”作为用户可见医学口径。
2. 20 词结果只显示“本组字准率 / 系统听懂分 / 建议补练词”。
3. metadata 保留 `assessment_scheme=character_accuracy_v1`，但新增 `assessment_level=onboarding_20`。

## 4. 第一功能的 North Star

第一功能的 North Star 不是平均分，而是：

> 训练后，用户在真实沟通中被正确理解的概率提高。

开发指标分三层。

### 4.1 用户结果指标

1. 7 天内完成至少 3 次训练的用户比例。
2. 用户是否能说出“今天最该练什么”。
3. 用户是否因为反馈更愿意继续练。
4. 沟通页中已训练高频句的修正成功率。

### 4.2 代理技术指标

1. 同一句 `latest_score - first_score`。
2. 同一句 `best_score`。
3. 重复错配减少数量。
4. 低置信样本过滤率。
5. 训练错配进入沟通上下文后的命中率。

### 4.3 科学质量指标

1. 语料覆盖率。
2. 同一录音重复运行一致性。
3. 评分版本升级 diff 可解释性。
4. 趋势置信度校准。
5. 低样本时拒绝判断的比例。

## 5. 开发者评分标准

每个版本按 100 分评估，低于 80 不进入下一阶段。

| 维度 | 分值 | 必须做到 |
|------|------|----------|
| 语料 | 20 | 有覆盖测试；prompt 有版本；低/高语义可预测材料分开 |
| 评分 | 20 | 分数由 feature 组成；同一 fixture 重跑稳定；样本不足时拒绝趋势 |
| 反馈 | 15 | 每次只给一个核心建议；能解释为什么；不羞辱用户 |
| 趋势 | 15 | first/latest/best 可追溯；至少 3 次才判断同句趋势 |
| 沟通反哺 | 15 | 重复错配进入翻译器 context；低置信样本不能污染 context |
| 安全边界 | 10 | 不输出诊断、疗效、病情改善；医疗免责声明位置稳定 |
| 工程 | 5 | schema 版本化；离线 fixture；单测覆盖核心公式 |

一票否决项：

1. 模型直接给临床严重程度。
2. 单条录音判断进步或退步。
3. 用户可见“康复分 / 疗效 / 病情改善”。
4. 训练数据和沟通上下文没有置信过滤。
5. 没有 fixture 就调整评分公式。

## 6. 分阶段目标

### Stage 0：边界修正

目标：把现有训练页从“伪评估”收成“训练反馈”。

交付：

1. `20 词筛查` 改名为 `20 词轻量筛查`。
2. 用户可见分数改为 `字准率 / 系统听懂分`。
3. 删除用户可见的医学等级判断。
4. 文案统一为“训练参考，不替代医学评估”。

退出标准：

1. 文案扫描无 `康复分 / 疗效 / 病情改善 / 临床严重程度`。
2. `training-assessment.test.ts` 通过。
3. 旧 metadata 兼容。

### Stage 1：普通话音系核心语料

目标：从“20 个日常词”升级到“可被开发者验证覆盖的普通话训练材料”。

2026-05-12 语料长度判断：

1. 前台 supervised recording 的默认目标句控制在 `6-16` 个汉字。
2. 对音系筛查，保留单音节 / 双音节 / 持续元音任务，但不要把它们混进“功能短句”统计。
3. 对朗读和文章材料，只允许切成 `6-16` 个汉字的短单位进入训练页；长段落只留在离线构建源里。
4. 每条训练样本推荐录音窗口为 `2-8s`，硬上限先按 `12s`；超过后要提示重录或切分，不作为高质量样本直接进入训练上下文。

理由：

1. CDSD 的价值在于固定文本池、人工标注和严格质控；它不是让用户自由长录音后再事后猜转写。新版 CDSD 公开摘要已扩展到 `133h / 44 speakers`，基准 CER `16.4%`，说明中文构音障碍 ASR 的关键仍是高质量、可对齐的 dysarthric 数据。
2. AISHELL-1 的文本清洗明确删除过长句，且每个 speaker 约 `360 utterances / 26min`，折算单条平均约 `4.3s`；它适合提供规范普通话中短句来源，但不能直接把长文章塞到患者前台。
3. 普通话构音障碍声学研究常用持续元音、CV 单音节、四声、82 个单音节词表和短句，说明“短、可控、音系覆盖”比“一条长录音包含很多内容”更适合做可复现评估。
4. Qwen3-ASR / FunASR 都能处理更长音频，但官方链路仍强调短音频低延迟、长音频需要 VAD / 分段 / token 上限管理；模型能转写长音频，不等于训练采样应该长录。
5. 对脑瘫和中风后构音障碍用户，长句会放大运动疲劳、呼吸支持、停顿和注意负担；`6-16` 字能覆盖高频功能句和连续语流，又不至于把失败原因混成“句子太长 / 静音太多 / 错读太多”。`1-5` 字仍然可以保留给音系筛查、最小对立和单词复练，但不建议成为主训练语料主体。

交付：

1. `phonology_core_v1`：60-80 条词/单音节材料。
2. 每条材料标注 `pinyin / initials / finals / tones / semantic_predictability / prompt_version`。
3. 覆盖率测试脚本。
4. `functional_sentence_pool_v1`：1000-2000 条 `6-16` 字目标句，默认只从可追溯来源抽取，例如普通话测试朗读作品、Tatoeba 派生中文例句、本地 AISHELL/AISHELL-2 转写、公开经典朗读材料和其他公开数据页；不要用模板批量造句。每次刷新必须跑长度、去重、数量和抽样语义质量校验。

退出标准：

1. 主要普通话声母都有覆盖。
2. 单韵母、复韵母、前鼻韵母、后鼻韵母都有覆盖。
3. 四声和轻声有统计。
4. prompt 文本变化会触发版本变化，历史趋势不会静默断裂。

### Stage 2：可复现评分

目标：把分数从 UI heuristic 变成可测试的 feature builder。

交付：

1. `training_assessment_feature_builder`。
2. `system_intelligibility_score_v1`。
3. `score_confidence`。
4. 离线 fixture 集合。

退出标准：

1. 同一 fixture 重跑完全一致。
2. 样本数小于 3 时，不输出同句趋势。
3. 分数变化能解释到错配、覆盖率、样本质量或声学 feature。

### Stage 3：反馈质量

目标：让反馈真正帮助用户下一次练得更好。

交付：

1. 反馈模板：`观察 -> 意义 -> 下一步`。
2. 每次训练只突出一个核心建议。
3. 连续错误收敛策略。

退出标准：

1. 每条反馈不超过 2 个重点。
2. 反馈引用具体词、错配或趋势。
3. 同一错配连续出现时，建议稳定，而不是每天换花样。
4. 用户始终可选 `不收录 / 重录 / 继续下一句`。

### Stage 4：反哺沟通翻译器

目标：第一功能不孤立，必须改善第二功能。

交付：

1. `repeated_mismatch_tags`。
2. `protected_terms`。
3. `high_confidence_training_context`。
4. 沟通 agent 只读取筛选后的训练上下文。

退出标准：

1. 训练错配能在沟通 prompt 中被引用。
2. 低置信样本不会进入沟通上下文。
3. 已训练高频句在沟通页的修正成功率可被离线回放验证。

### Stage 5：声学趋势

目标：在不冒充临床评估的前提下，引入可复现声学指标。

交付：

1. 持续元音任务：`/a, i, u, ɤ, y, o/`。
2. CV 单音节四声任务。
3. 离线 acoustic feature extractor。
4. `loudness_stability / pause_ratio / speech_rate / sustained_vowel_seconds / vowel_space_proxy`。

退出标准：

1. 声学脚本重复运行稳定。
2. 每个 acoustic feature 有版本。
3. UI 只显示“声学趋势”，不显示“呼吸障碍评分 / 发声障碍评分”。

### Stage 6：治疗师参考报告

目标：整理训练证据，不替治疗师下判断。

交付：

1. 训练表现参考报告。
2. 样本链接、目标词、系统听到、趋势和错配。
3. 用户自述和场景备注。

退出标准：

1. 每个结论可追溯到样本。
2. 报告不出现诊断或疗效判断。
3. 治疗师能快速看到最近最常被误听和最稳定改善的表达。

## 7. 模型架构

正确链路：

```text
录音
  -> ASR
  -> 文本对齐
  -> 声学特征
  -> feature builder
  -> 规则/统计/专用模型算分
  -> LLM 解释和建议
  -> 高置信训练上下文反哺沟通 agent
```

模型职责：

1. `qwen-flash`：实时 ASR、沟通翻译器、轻量训练反馈解释。
2. 更强 LLM：周总结、趋势解释、参考报告摘要。
3. 专用模型：未来声学/可懂度建模，必须有固定语料和人工标注。

禁止：

1. LLM 直接看录音后给临床分。
2. LLM 直接判断呼吸、发声、共鸣、韵律障碍。
3. LLM 输出疗效或诊断。

## 8. 数据 contract

继续复用 `training_result` metadata，不新增第二套训练事实源。

当前代码现状（2026-05-12）：

1. Web 训练录音已经是 `target_text -> MediaRecorder duplicate track -> recording envelope -> upload receipt / manifest`，不是自由录音后再转写。
2. 现有 `training-sample-quality.ts` 已检查录音过短、ASR 覆盖率和 transcript latency，会建议重录；但还没有真正的 VAD、静音占比、首尾静音裁剪或“录音过长”判定。
3. Web 侧 `microphone-input-feedback.ts` 已用 RMS 风格输入电平判断 `quiet / balanced / loud`，它能提醒麦克风距离和音量，但不是样本级静音检测。
4. Mobile Workbench native recorder queue 目前记录 `durationMs / fileSizeBytes / uploadReceipt`，还没有在本地计算 speech duration、pause ratio 或 leading/trailing silence。
5. 下一步应该把样本质量从“短/覆盖率/延迟”升级成 `duration_ms / speech_duration_ms / leading_silence_ms / trailing_silence_ms / pause_ratio / input_level_peak / input_level_rms`，低质量样本默认只保留为 attempt，不进入高置信训练上下文。

新增字段：

```ts
interface TrainingAssessmentMetadataV1 {
  assessment_mode?: 'screening' | 'phonology_core' | 'functional_sentence' | 'reading' | 'sustained_vowel'
  assessment_level?: 'onboarding_20' | 'phonology_core' | 'sentence' | 'reading'
  assessment_scheme?: 'character_accuracy_v1' | 'mandarin_proxy_v1'
  assessment_prompt_id?: string
  assessment_prompt_version?: string
  expected_pinyin?: string[]
  initials?: string[]
  finals?: string[]
  tones?: number[]
  semantic_predictability?: 'low' | 'medium' | 'high'
  system_intelligibility_score?: number
  score_confidence?: 'insufficient' | 'low' | 'medium' | 'high'
  same_prompt_attempt_index?: number
  first_attempt_score?: number
  latest_attempt_score?: number
  best_attempt_score?: number
  repeated_mismatch_tags?: string[]
  protected_terms?: string[]
  acoustic_feature_version?: string
  speech_duration_ms?: number
  leading_silence_ms?: number
  trailing_silence_ms?: number
  silence_ratio?: number
  input_level_rms?: number
  input_level_peak?: number
  loudness_stability?: number
  speech_rate_syllables_per_second?: number
  pause_ratio?: number
  sustained_vowel_seconds?: number
  vowel_space_proxy?: number
}
```

## 9. 立即可执行的下一步

P0 应先做：

1. 改 UI 文案：`评估主题区` -> `20 词轻量筛查`。
2. 改用户可见结果：去掉医学化等级，保留字准率、系统听懂分、建议补练词。
3. metadata 新增 `assessment_level=onboarding_20`。
4. 新增文案扫描测试，禁止 `康复分 / 疗效 / 病情改善 / 临床严重程度`。

P1 再做：

1. 新建 `phonology-core-v1.ts`。
2. 新建覆盖率测试。
3. 新建 prompt version 策略。
4. 页面新增 `轻量筛查 / 音系核心 / 功能短句` 三类入口。
5. 给录音 envelope 增加样本级静音指标，超过 `12s` 或静音占比过高时默认提示重录。

## 10. 参考资料

1. ASHA Practice Portal: Dysarthria in Adults  
   https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/
2. Mayo Clinic: Dysarthria diagnosis and treatment  
   https://www.mayoclinic.org/diseases-conditions/dysarthria/diagnosis-treatment/drc-20371999
3. How do we measure dysarthria after stroke? A systematic review to guide the core outcome set for dysarthria  
   https://pmc.ncbi.nlm.nih.gov/articles/PMC12104885/
4. Mou et al. 2018, Scientific Reports: Acoustic properties of vowel production in Mandarin-speaking patients with post-stroke dysarthria  
   https://www.nature.com/articles/s41598-018-32429-8
5. 中国康复研究中心构音障碍检查法相关介绍  
   https://jbk.familydoctor.com.cn/info2506/diagnosis/
6. Frenchay 构音障碍评定法介绍  
   https://gddprc.org.cn/zxzx/gzdt/content/post_302994.html
7. 《瘫痪康复评定手册》：构音器官检查与构音检查  
   https://www.tsu.tw/xiyi/382986.html  
8. CDSD: Chinese Dysarthria Speech Database, Interspeech 2024  
   https://www.isca-archive.org/interspeech_2024/wan24b_interspeech.html
9. AISHELL-1 Dataset Card  
   https://huggingface.co/datasets/AISHELL/AISHELL-1
10. Qwen3-ASR official repository  
   https://github.com/QwenLM/Qwen3-ASR
11. Alibaba Cloud Model Studio: Qwen audio file recognition  
   https://www.alibabacloud.com/help/en/model-studio/qwen-speech-recognition
12. FunASR tutorial: VAD and long-audio segmentation parameters  
   https://github.com/modelscope/FunASR/blob/main/docs/tutorial/README.md
   https://www.tsu.tw/xiyi/211375.html
