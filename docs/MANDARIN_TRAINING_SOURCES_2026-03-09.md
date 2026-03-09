# 中文语训与录音上传页来源说明（2026-03-09）

这份文档说明两件事：

1. `/contribute` 第一阶段的训练句和标签来自哪里。
2. 为什么页面允许“录后反馈 + 匿名上传”，但仍要保留明确授权和本地降级。

## 1. 来源分层

训练页的数据来源分成两层：

### A. 中文普通话训练标准层

用于决定训练页的结构、标签和反馈边界。

1. 教育部新闻发布会（2021）
   https://www.moe.gov.cn/fbh/live/2021/53544/mtbd/202103/t20210331_523740.html
   用途：确认普通话水平测试的四类核心测试项为单音节字词、多音节词语、朗读短文、命题说话。训练页的“目标句 + 跟读 + 结果反馈”结构需服从中文普通话场景，而不是英文 phonics 模式。

2. 中国政府网，《普通话水平测试实施纲要》
   https://www.gov.cn/fwxx/bw/zwgk/jyb/content_598014/content_598014_2.htm
   用途：确认普通话测试在单音节、多音节、朗读、说话等部分关注的典型难点，包括平翘舌、边鼻音、前后鼻音、轻声、儿化等。训练页的 `focus_tags` 以这些难点为主。

### B. 高价值中文沟通句层

用于决定第一阶段训练页到底练什么句子。第一版不做大而全语料库，而是优先做真实沟通高价值句。

1. ASHA AAC
   https://www.asha.org/public/speech/disorders/aac/
   用途：确认 AAC 的目标是表达 thoughts / wants / needs / feelings / ideas，而不是单纯“聊天”。

2. ASHA Dysarthria In Adults
   https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/
   用途：确认构音障碍沟通中的补偿策略，例如预先说明、请求对方给时间、必要时换一种表达方式。

3. Patient Provider Communication - Chinese Simplified Tools
   https://patientprovidercommunication.org/languages/chinese-simplified/
   用途：确认医疗沟通板中最重要的是 yes/no、疼痛、一般需求、医疗决策等高价值表达。

4. Patient Provider Communication - Healthcare Visit Planning Tools
   https://patientprovidercommunication.org/healthcare-visit-planning-tools/
   用途：确认医疗沟通应强调直接对患者沟通、给足时间、保留患者本人决策权。

5. Tobii Dynavox Emergency Response Resources
   https://us.tobiidynavox.com/blogs/news/emergency-response-resources-for-people-with-communication-disabilities
   用途：确认应急沟通应优先覆盖求助、安全、医疗和联系支持者。

## 2. 第一阶段训练句的来源规则

- 训练句不是从无来源大语料里随机抽取。
- 第一阶段优先采用已核验的中文沟通句，并在项目内补齐拼音与训练标签。
- 页面里出现的中文句子属于“基于权威资料的中文改写”，不是直接摘抄英文原句。
- `focus_tags` 的来源是普通话测试关注的典型难点，而不是拍脑袋定义。
- 当前训练语料继续沿四个高价值场景扩充：陌生人开口、就医沟通、家人照护、紧急求助。
- 每条训练句除 `text / pinyin / focus_tags` 外，还补 `keywords`，用于后续 hotword 和记忆写回；`keywords` 必须来自句中真正高价值的词，而不是任意拆词。

## 3. 为什么训练页必须包含数据上传

训练页如果只有本地反馈，没有上传能力，就无法形成后续的：

- 个体混淆模式沉淀
- 语料扩充与标注回流
- 个体记忆和训练建议

但上传也不能默认隐式发生，所以第一阶段采用：

- 先录音与反馈
- 用户显式勾选匿名上传
- 上传失败时本地降级

这样既保留训练页的产品价值，也不会破坏 local-first 和最小必要存储原则。

## 4. 第一阶段数据上传最小元数据

每条训练录音至少带上以下上下文：

- `exercise_id`
- `exercise_text`
- `exercise_category`
- `focus_tags`
- `recognized_text`
- `upload_consent`
- `source_label`
- `source_url`
- `training_mode=mandarin_practice`

这些元数据的目的不是增加用户负担，而是让后续训练分析、来源追溯和记忆沉淀有最小可用结构。
