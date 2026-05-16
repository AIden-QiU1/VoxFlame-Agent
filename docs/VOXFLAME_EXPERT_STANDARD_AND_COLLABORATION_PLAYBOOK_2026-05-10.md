# VoxFlame Expert Standard And Collaboration Playbook（2026-05-10）

> 目标：让 Web / App / 硬件 / 训练评估 / 评测 prompt / 沟通技巧 / 语料 / memory 都从“工程可运行”升级为“有专家框架、有材料来源、有验证门槛、可和医学 / 沟通专家协作”的产品系统。

## 1. 总判断

VoxFlame 的产品复杂度已经超过普通 App。它同时涉及：

1. 构音障碍和卒中后沟通。
2. AAC / speech-generating device / assistive technology。
3. 移动端、Web、实时语音、硬件音频桥。
4. 训练语料、评分、prompt、长期记忆和隐私治理。

因此后续开发不能再只靠“我们觉得有用”，也不能只靠“技术跑通”。默认标准必须升级为 `专家标准 / 技术验证 / 用户反馈` 三角闭环：

```text
产品假设
  -> 查官方 / 专业资料
  -> 下载或获取原始材料
  -> 转成 VoxFlame spec
  -> 找相关专家 review
  -> 工程实现和技术验证
  -> 小样本真实场景反馈
  -> 回流到 roadmap / prompt / 语料 / memory / hardware spec
```

这里的专家不只是医生，也包括：

1. 成人运动性言语障碍 / 构音障碍方向的 speech-language pathologist。
2. 康复医学医生、神经内科 / 卒中康复相关医生。
3. AAC / 辅助沟通技术专家。
4. 汉语语音学 / 普通话音系 / 言语声学研究者。
5. 无障碍 UX / cognitive accessibility 专家。
6. 硬件、音频、电池、射频和医疗合规顾问。

一句话：

```text
专家标准决定“应该怎么做”
技术验证决定“能不能稳定做”
用户反馈决定“真实场景里值不值得继续做”
```

## 2. 当前现状分析

### 2.1 已经做得对的部分

1. 产品第一原则已经正确：不是纠正用户声音，而是纠正系统对用户意图的理解。
2. 现役技术事实源清楚：Web / App / backend / LiveKit / livekit_agent 已经不再多主链并行。
3. 训练链路已经有 `recording envelope -> recorder queue -> upload receipt -> manifest -> voice_contributions`。
4. App / Mobile Workbench 已按 `沟通 / 练习 / 记忆与准备 / 设备与同步` 四 surface 设计。
5. 硬件文档已从“控制桥”升级成“发声 + 记录”的 `communication audio bridge`。
6. 训练评估文档已经明确 20 词只是低压力 onboarding，不是临床评估。
7. memory 文档已经守住 `dataset != memory`，backend workspace 是 durable owner。

### 2.2 当前缺口

1. Web / App / 硬件各自有标准，但缺一个跨 surface 的专家级总标准。
2. 评测 prompt 还没有独立的 prompt registry、专家审查、fixture 和版本治理。
3. 沟通技巧还没有稳定映射到 ASHA / AAC / ICF 框架。
4. 训练语料还没有完成普通话音系覆盖、临床评估材料对照和专家 review。
5. memory 还没有把 ICF、AAC assessment、自我报告、沟通伙伴、环境障碍和用户偏好结构化成统一 schema。
6. 现有材料多是网页链接和工程文档，缺“需要下载 / 获取原始材料”的清单和 owner。
7. 还没有定义什么时候必须找医学 / 沟通专家，什么时候工程团队可以自行推进。
8. 用户反馈还没有形成闭环：现在有创始人即用户观察、真实账号 smoke、训练样本和上传数据，但缺统一的反馈采集、标注、归因、优先级和回流机制。

## 3. 标准 / 技术 / 用户反馈闭环

### 3.1 三条输入必须同时进入开发

每个核心功能都必须明确三类输入：

| 输入 | 作用 | 例子 |
|---|---|---|
| 专家标准 | 防止方向不专业、术语越界、材料不合格 | ASHA dysarthria、AAC feature matching、WHO ICF、W3C COGA、NIST AI RMF |
| 技术验证 | 防止只停留在愿望，确保可运行、可回归、可审计 | typecheck、smoke、fixture eval、upload receipt、manifest 对账、LiveKit room smoke |
| 用户反馈 | 防止做成“专业但没人坚持用”的系统 | 创始人即用户 field notes、目标用户访谈、照护者反馈、失败瞬间、真实场景可用性测试 |

任何只满足其中一条的功能，都不能直接产品化：

1. 只有专家标准，没有用户反馈：容易变成康复教材页面。
2. 只有技术验证，没有专家标准：容易产生伪评估、伪医学和误导性 prompt。
3. 只有用户反馈，没有技术验证：容易做出不可维护的临时功能。
4. 只有用户反馈，没有专家标准：容易把个体经验误当通用医学建议。

### 3.2 用户反馈闭环现状

当前已有输入：

1. 创始人即用户的一手经历和高压沟通场景。
2. Web / PWA / mobile workbench 的真实账号 smoke。
3. Supabase / OSS 里的训练样本、上传回执和 manifest 对账。
4. 训练页、沟通页、记忆页的产品判断记录。
5. App / 硬件 / 训练评估文档里的假设。

当前缺口：

1. 没有统一的 `feedback registry`。
2. 没有把反馈区分为 bug、可用性问题、情绪成本、沟通失败、训练坚持、专家风险、商业机会。
3. 没有固定的用户访谈 / field note 模板。
4. 没有“反馈如何影响 roadmap”的规则。
5. 没有“反馈进入 memory / prompt / 语料 / UI / 硬件 spec”的审查门槛。
6. 缺少沟通伙伴和照护者反馈。
7. 缺少每周复盘节奏。

### 3.3 Feedback Registry 标准

建议新增受控反馈登记表，可以先用 Markdown / CSV / Linear，后续再产品化。

最小字段：

```text
feedback_id
date
source_type: founder_self | target_user | caregiver | communication_partner | expert | support | telemetry | dataset_review
surface: web | app | hardware | training | communication | memory | prompt | onboarding
scenario: medical | work | interview | family | travel | emergency | practice | device_setup
raw_observation
user_goal
failure_or_success
emotion_cost
frequency
severity
confidence
related_artifacts
privacy_level
proposed_action
owner
status
linked_standard
linked_expert_review
linked_technical_verification
decision
```

隐私规则：

1. 公开仓库不放可识别用户身份、原始医疗信息、完整敏感对话或未授权录音。
2. 公开文档只保留匿名化模式、产品决策和验证结果。
3. 真实用户访谈和录音必须进入受控存储，并有删除路径。

### 3.4 用户反馈分级

| 等级 | 定义 | 处理 |
|---|---|---|
| F0 | 单次想法或个人偏好 | 记录，不立即做 |
| F1 | 重复出现的摩擦 | 可进入 backlog，需要技术 owner 判断 |
| F2 | 高频沟通失败 / 训练流失原因 | 必须形成 spec 或实验计划 |
| F3 | 安全、隐私、羞辱、误导、医学越界 | 立即阻断上线或回滚 |
| F4 | 经专家和多用户确认的核心需求 | 进入 roadmap 和产品标准 |

优先级公式：

```text
priority = communication_impact + frequency + emotional_cost + reversibility + evidence_confidence
```

其中 `communication_impact` 权重大于 UI 精修。

### 3.5 用户反馈采集计划

#### 每日 / 每次使用后

1. 用户是否完成了原本想完成的沟通任务？
2. 哪一步最卡？
3. 系统有没有让用户更紧张、更尴尬或更费力？
4. 哪条识别 / 代播 / 反馈是有帮助的？
5. 哪条输出用户不愿意让别人看见或听见？

#### 每周

1. 本周最常见的 3 个沟通失败场景。
2. 本周最有用的 3 个功能。
3. 本周用户主动复用的 prepared expressions / quick phrases。
4. 训练是否更愿意坚持，为什么？
5. App / Web / 硬件哪个入口最自然？

#### 每月

1. 专家 review 一次 feedback themes。
2. 更新 prompt / 语料 / memory / hardware spec 的风险清单。
3. 做一次 roadmap triage：保留、推迟、删除、升级。

### 3.6 用户反馈如何回流

| 反馈类型 | 回流位置 | 需要验证 |
|---|---|---|
| 系统听错但用户成功修复 | `communication_repair_prompt`、confusion patterns | 低置信过滤、重复出现才写 memory |
| 用户不理解训练反馈 | `training_feedback_prompt`、UI 文案 | 专家审查 + 用户复测 |
| 用户不愿意继续练 | 语料、节奏、反馈强度 | 创始人即用户 + 目标用户 field test |
| 对方还是听不懂 | partner guidance、外放、场景准备 | 沟通伙伴反馈 |
| 录音 / 上传不可信 | recorder queue、upload receipt UI | API / OSS / manifest 对账 |
| 硬件尴尬或不自然 | form factor、按钮、音量、佩戴方式 | P0 benchmark 和可用性测试 |
| memory 让用户不舒服 | memory schema、编辑 / 删除路径 | 隐私 review + 用户确认 |

### 3.7 用户反馈闭环的交付物

近期必须补 5 个交付物：

1. `feedback_registry`：先用文档或 CSV，记录所有真实反馈。
2. `founder_self_observation_template`：创始人即用户每天/每次使用后填。
3. `target_user_interview_template`：目标用户访谈模板。
4. `communication_partner_feedback_template`：沟通伙伴 / 家属 / 同事反馈模板。
5. `weekly_feedback_triage`：每周把反馈分到 prompt、UI、语料、memory、硬件、技术 debt。

### 3.8 开发节奏标准

每个功能迭代必须写成：

```text
Standard:
  引用哪些专家框架 / 官方材料？

Technical:
  哪些代码、contract、fixture、smoke 证明它跑得稳？

Feedback:
  哪些用户 / 沟通伙伴 / 专家反馈证明它值得继续？

Decision:
  ship / iterate / hold / delete
```

没有 `Feedback` 的功能，可以做内部 alpha，但不能宣布“产品上已经验证”。

## 4. VoxFlame Expert Standard v0.1

任何涉及用户沟通、训练反馈、长期画像、硬件录音 / 发声、评测 prompt 的功能，都按 5 级证据门槛推进。

| 等级 | 名称 | 可以做什么 | 不能做什么 |
|---|---|---|---|
| L0 | 产品假设 | 写想法、低风险 UI stub、内部 demo | 对用户宣称有效、写入长期 memory、训练模型 |
| L1 | 官方 / 专业资料对齐 | 引用 ASHA / WHO / W3C / ISO / NIST / FDA / 正式教材或论文，写成 spec | 当作已验证临床结论 |
| L2 | 原始材料获取 | 下载 PDF、指南、量表说明、设备手册、语料论文，建立本地材料索引 | 直接复制受版权保护的量表全文到公开仓库 |
| L3 | 专家 review | 让对应专家审查命名、边界、语料、prompt、风险 | 跳过专家意见直接发布医学化表述 |
| L4 | 真实场景验证 | 小样本用户 / 创始人即用户 / 沟通伙伴 field test | 泛化为疗效、诊断或康复结论 |
| L5 | 产品化与合规 | 可上线、可审计、可回滚，若触达医疗声明则启动 regulatory plan | 在没有合规计划时宣称医疗设备能力 |

最低门槛：

1. 普通 UI / 工程 contract：至少 L1。
2. 训练评分 / prompt / memory 写入：至少 L2。
3. 医学术语、构音评估、康复建议：至少 L3。
4. 对外宣称疗效、诊断、临床评估、保险 / 医疗路线：必须 L5。

## 5. Web / App / 硬件统一开发标准

### 4.1 Web / App 标准

必须参考：

1. W3C WCAG 2.2：Web / App 可访问性最低按 AA 心智设计。
2. W3C Cognitive Accessibility / COGA：认知负担、可理解性、错误恢复和低压力交互。
3. ISO 9241-210：以人为中心的交互系统设计生命周期。
4. ASHA dysarthria communication strategies：沟通页和训练页不能只优化机器指标，还要支持用户和沟通伙伴。
5. FDA human factors guidance：如果未来走医疗设备或正式辅助设备路线，必须做 use-related risk 分析。

落地规则：

1. 任何核心页面必须明确目标场景：陌生人求助、医疗沟通、面试、课堂、家庭、训练。
2. 每个页面必须有“失败后怎么恢复”：没听清、没网、没权限、误触、上传失败、对方没懂。
3. 每个高风险动作必须可见、可取消、可重试。
4. App 不能把本地录音和云端上传混在一个模糊状态里。
5. 界面文案不能羞辱用户，不能暗示“用户说得不对”，只能说“系统这次没有稳定听懂”。
6. 需要面向沟通伙伴的内容时，必须区分“给用户看的提示”和“给对方看的提示”。

### 4.2 硬件标准

硬件按 [硬件桥接开发手册](VOXFLAME_HARDWARE_BRIDGE_DEVELOPMENT_GUIDE_2026-05-05.md) 的 `VoxFlame Communication Audio Bridge Standard v0.1` 执行。

统一规则：

1. 硬件第一版是 `communication audio bridge prototype`，不叫医疗设备。
2. 发声和记录都必须有物理可见状态。
3. 任意发声必须能被用户立刻停止。
4. 任意录音必须能被用户看见、保留、重试、删除。
5. 硬件不保存 Supabase token、LiveKit secret、DashScope key。
6. 所有电池、BLE / Wi-Fi 模块、外壳材料、充电路径都必须优先选已有认证资料的部件。

### 4.3 AI / runtime 标准

必须参考：

1. NIST AI Risk Management Framework。
2. NIST Generative AI Profile。
3. FDA / Health Canada / MHRA / IMDRF Good Machine Learning Practice，在未来医疗声明前作为上限参考。

落地规则：

1. prompt、model、provider、scoring formula 都必须版本化。
2. 训练评分和沟通修正必须有 offline fixtures。
3. 每次模型升级必须跑同一套沟通 / 训练 / safety eval。
4. 低置信结果不能直接污染 durable memory。
5. LLM 不做临床分型、疗效判定或严重程度判断。

## 6. 评测 Prompt 标准

### 5.1 Prompt 类型

后续必须维护独立 prompt registry，至少包含：

| Prompt | 用途 | 最低证据门槛 |
|---|---|---|
| `communication_repair_prompt` | 实时沟通纠错和澄清 | L2 + 沟通专家 review |
| `partner_guidance_prompt` | 给沟通伙伴的提示 | L3 |
| `training_feedback_prompt` | 训练反馈 | L3 |
| `daily_training_summary_prompt` | 日总结 | L2 |
| `weekly_training_summary_prompt` | 周总结 | L2 |
| `memory_compaction_prompt` | 会后 memory 压缩 | L3 |
| `safety_boundary_prompt` | 医疗和隐私边界 | L3 |
| `hardware_status_prompt` | 设备状态解释 | L1 |

### 5.2 Prompt 评测维度

每个 prompt 至少按 10 个维度评分：

1. 是否保留用户意图。
2. 是否避免羞辱或纠正用户人格。
3. 是否区分系统没听懂和用户说错。
4. 是否给出可执行下一步。
5. 是否避免医学诊断 / 疗效表述。
6. 是否尊重用户选择和取消权。
7. 是否对沟通伙伴友好。
8. 是否能在低置信时拒绝过度判断。
9. 是否能引用具体证据：target / recognized / audio quality / context。
10. 是否符合对应 surface：沟通、训练、记忆、硬件。

每个 prompt 版本都必须有：

1. `prompt_id`
2. `prompt_version`
3. `source_frameworks`
4. `expert_review_status`
5. `fixture_set`
6. `known_failure_modes`
7. `rollback_version`

### 5.3 Prompt 红线

不能输出：

1. “你的病情改善了”
2. “你恢复得很好 / 很差”
3. “临床轻度 / 中度 / 重度”
4. “你说错了”
5. “你应该这样发音才正常”
6. “这就是医生建议”
7. “系统已经记住你一定会这样说”

推荐口径：

1. “这组材料里，系统这次更稳定听懂了……”
2. “如果对方没听清，可以先告诉对方主题，再说短一点。”
3. “这条记录适合保留给你自己或治疗师参考。”
4. “样本太少，先不判断趋势。”

## 7. 沟通技巧标准

必须从 ASHA dysarthria communication strategies、AAC feature matching、ICF participation 框架中提取，而不是随手写“沟通小贴士”。

VoxFlame 的沟通技巧库至少分 5 类：

| 类别 | 用户策略 | 沟通伙伴策略 | 产品入口 |
|---|---|---|---|
| 话题预告 | 先给主题或关键词 | 等用户说完，不抢答 | quick talk 开头卡 |
| 修复策略 | 换一种说法、写关键词、指物、重放 | 复述已听懂部分，问具体问题 | 沟通页 repair actions |
| 环境调整 | 选择安静、光线好、面对面 | 降低噪声、拉近距离 | 场景准备 checklist |
| 节奏控制 | 说短句、停顿、休息 | 给等待时间 | 训练和沟通提示 |
| 多模态补充 | 手势、图片、预置短句、文字 | 看用户表情和动作 | expression kit |

开发规则：

1. 沟通技巧必须写成可操作 action，不写成道德建议。
2. 技巧要服务具体场景，不做泛泛百科。
3. 用户和沟通伙伴的提示分开维护。
4. 每条技巧都必须标注来源框架和适用场景。

## 8. 训练数据 / 语料标准

### 7.1 当前基线

当前 20 词只能作为 `screening_v0_daily_onboarding`。它可以验证：

1. 麦克风。
2. ASR。
3. 上传。
4. 反馈闭环。

它不能代表：

1. 经典中文构音评估语料。
2. Frenchay 汉语版。
3. 中国康复研究中心构音障碍检查法。
4. 临床严重程度。

### 7.2 专家级语料标准

后续语料必须至少覆盖：

1. 普通话声母。
2. 单韵母、复韵母、前鼻韵母、后鼻韵母。
3. 四声和轻声。
4. 低语义可预测材料和高频生活材料。
5. 单字 / 双字词 / 功能短句 / 朗读 / 持续发声。
6. 用户真实高频场景：就医、工作、出行、求助、家庭。

每条 prompt 必须有：

```text
prompt_id
prompt_version
text
pinyin
initials
finals
tones
semantic_predictability
scenario
task_type
expected_duration_range
source_framework
expert_review_status
```

### 7.3 必须获取的材料

必须自行搜索、下载或购买 / 获取授权：

1. ASHA Dysarthria in Adults practice portal 和 Person-Centered Focus on Function: Dysarthria PDF。
2. ASHA AAC practice portal、AAC Evidence Map、feature-matching charts / checklists。
3. ASHA Evidence-Based Practice toolkit。
4. WHO ICF 框架资料。
5. 中国康复研究中心构音障碍检查法相关正式教材 / 量表说明。
6. Frenchay Dysarthria Assessment 中文相关资料。
7. 普通话音系覆盖资料：声母、韵母、声调、普通话水平测试音系分布研究。
8. 普通话构音障碍 / 卒中后言语声学研究论文。
9. Mandarin speech audiometry / phonologically balanced Mandarin materials 相关论文。
10. 现有 AAC / SGD 设备用户手册：Tobii Dynavox、PRC-Saltillo、Lingraphica、Jabbla、AbleNet。

注意：

1. 受版权保护的量表和教材不能原样复制进公开仓库。
2. 可以在仓库里记录来源、购买状态、授权状态、使用限制和我们自己的派生 schema。
3. 临床评估材料只能用于对照和专家沟通，不能未经授权包装成 VoxFlame 自有“临床评估”。

## 9. Memory 框架标准

Memory 不是聊天记录，也不是训练数据仓库。VoxFlame memory 必须服务真实沟通参与。

### 8.1 需要吸收的专家框架

1. WHO ICF：body function、activity、participation、environmental factors、personal factors。
2. ASHA dysarthria assessment：可懂度、自然度、沟通效率、沟通参与、环境障碍、沟通伙伴。
3. ASHA AAC assessment：case history、self-report、sensory/motor status、language/cognition、symbol assessment、feature matching、contextual facilitators/barriers。
4. Evidence-Based Practice：外部证据、内部数据、用户 / 照护者价值和偏好三者同时进入决策。

### 8.2 Durable memory 结构必须覆盖

| Memory 区域 | 应保存 | 不应保存 |
|---|---|---|
| 用户自我描述 | 用户自己认同的身份、称呼、场景偏好 | 未确认的模型推测 |
| 沟通偏好 | 是否先打字、是否外放、是否让对方看提示 | 原始敏感对话全文 |
| 沟通伙伴 | 常见伙伴、对方理解方式、是否需要 partner guidance | 未授权第三方隐私 |
| 场景准备 | 医院 / 面试 / 工作 / 出行前准备材料 | 临时噪声和一次性片段 |
| 稳定错配 | 多次确认的 target -> recognized 模式 | 单条低置信误听 |
| 硬件与环境 | 输入路线、外放偏好、常见失败环境 | 高风险定位或隐私日志 |
| 训练总结 | 周期性趋势、可验证练习目标 | 每条训练录音全文 |

### 8.3 Memory 写入门槛

1. 原始 transcript 不直接进入 durable memory。
2. 单条训练样本不直接生成长期画像。
3. 低置信识别不写入稳定错配。
4. 涉及用户身份、疾病、家人、工作、医疗的信息必须可见、可编辑、可删除。
5. 任何 memory compaction prompt 必须有 expert-reviewed safety fixture。

## 10. 医学 / 沟通专家合作标准

### 9.1 什么时候必须找专家

必须找专家 review 的情况：

1. 新增训练评分、趋势分、构音相关 feedback。
2. 新增或修改训练语料，尤其是 `phonology_core`。
3. 用户可见医学 / 康复 / 构音术语。
4. 给沟通伙伴的建议。
5. memory 写入“稳定规律”“沟通能力”“训练趋势”。
6. 硬件进入真实目标用户测试。
7. 对外材料出现“评估、康复、治疗、辅助沟通设备、speech-generating device”。

工程团队可先自行推进的情况：

1. 低风险 UI 布局。
2. recorder queue、upload receipt、manifest contract。
3. 权限、登录、同步、设备连接状态。
4. 内部 demo 文案，但不能上线给真实用户。

### 9.2 要找哪些专家

| 专家 | 需要他们看什么 | 交付物 |
|---|---|---|
| 成人构音障碍 SLP | 训练反馈、语料、沟通策略、术语边界 | 红线词表、反馈模板、语料 review |
| 康复医生 / 神经科医生 | 医学声明、卒中后边界、转诊风险 | 医学边界说明、风险清单 |
| AAC 专家 / AT 专家 | App / 硬件 access method、feature matching、替代沟通 | AAC feature matching checklist |
| 汉语语音学专家 | 普通话声韵调覆盖、语料平衡、声学 feature | phonology_core 审稿意见 |
| 无障碍 UX 专家 | App / Web / 硬件可用性和认知负担 | usability findings |
| 硬件 / 合规顾问 | 电池、射频、音频安全、外壳、认证路线 | hardware risk file |
| 目标用户 / 照护者 | 真实场景、羞耻感、坚持使用、失败恢复 | field notes / acceptance signals |

### 9.3 第一次联系专家要带什么

每次专家沟通前准备一页 brief：

1. VoxFlame 一句话：帮助构音障碍用户让系统更懂其意图，不替代医生。
2. 本次要 review 的范围：语料 / prompt / 硬件 / App / memory。
3. 明确不做什么：不诊断、不声称疗效、不替代临床评估。
4. 3-5 个具体问题。
5. 需要专家产出的交付物。
6. 预计耗时和付费方式。
7. 是否涉及真实用户数据；如果涉及，先脱敏并签署必要协议。

### 9.4 专家 review 记录模板

每次 review 后写入 docs 或私有记录：

```text
review_id:
date:
expert_role:
expert_name_or_anonymized_id:
scope:
materials_reviewed:
decisions:
red_lines:
recommended_changes:
open_questions:
can_ship:
requires_follow_up:
privacy_constraints:
```

公开仓库里可以保留匿名摘要；专家姓名、合同、敏感用户材料不默认公开。

## 11. 材料库和下载规则

建议新增私有或受控目录，不把版权材料直接放公开仓库：

```text
research-materials/
  README.md
  index.csv
  asha/
  who-icf/
  mandarin-phonology/
  chinese-dysarthria-assessment/
  aac-device-manuals/
  hardware-standards/
```

`index.csv` 至少包含：

```text
material_id,title,source_url,source_type,downloaded_at,license_or_access,owner,used_for,public_summary_path,expert_review_status
```

公开仓库只保留：

1. 来源链接。
2. 摘要。
3. 我们自己的 schema。
4. 使用限制。
5. 专家 review 结论。

不直接公开：

1. 付费量表全文。
2. 受版权保护教材扫描。
3. 未授权论文全文。
4. 用户原始录音和敏感访谈。

## 12. 开发准入门槛

### 11.1 新功能 PR 必须回答

1. 这个功能属于 Web / App / 硬件 / training / prompt / memory 哪一层？
2. 引用了哪些专家框架或官方资料？
3. 有没有需要下载 / 获取授权的材料？
4. 是否需要专家 review？如果不需要，为什么？
5. 是否会写入 durable memory？
6. 是否会影响训练数据或评分？
7. 是否会让用户看到医学 / 康复表述？
8. 如何验证低置信、失败、误触、取消、删除？

### 11.2 Ship 前最低验证

| 改动类型 | 最低验证 |
|---|---|
| Web / App UI | WCAG / COGA checklist、目标场景 smoke、失败状态 |
| 沟通 prompt | fixture eval、低置信拒绝、partner guidance 审查 |
| 训练 feedback | corpus fixture、专家边界审查、旧样本兼容 |
| 训练语料 | 覆盖率脚本、语音学 review、版本化 |
| memory | 写入门槛测试、删除 / 编辑路径、低置信过滤 |
| 硬件 | 录音 / 播放 / 停止 / 状态灯 / 上传 receipt / 隐私测试 |
| 医学表述 | 专家 review，必要时 legal / regulatory review |

## 13. 近期执行顺序

1. 建 `research-materials/index.csv` 或私有等价材料索引。
2. 下载 / 收集 ASHA、WHO ICF、W3C、NIST、FDA、AAC 设备手册和中文构音评估相关材料。
3. 做 `communication_strategy_registry`，先从 ASHA dysarthria 和 AAC 框架提取 30 条可执行沟通技巧。
4. 做 `prompt_registry`，把沟通、训练、memory prompt 从代码和文档里盘出来。
5. 做 `phonology_core_v1` 语料草案和覆盖率脚本。
6. 找 1 位成人构音障碍 SLP、1 位 AAC / AT 专家、1 位汉语语音学专家做首次 review。
7. 把专家 review 结果反写到训练评估、App、硬件和 memory 文档。

## 14. 参考资料入口

专业 / 临床 / AAC：

1. ASHA Dysarthria in Adults：`https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/`
2. ASHA Dysarthria consumer page：`https://www.asha.org/public/speech/disorders/dysarthria/`
3. ASHA AAC Practice Portal：`https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/`
4. ASHA Evidence-Based Practice：`https://www.asha.org/Research/EBP/`
5. ASHA EBP process：`https://www.asha.org/research/ebp/evidence-based-practice-process/`
6. WHO ICF：`https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health`

可访问性 / 人因：

1. W3C WCAG overview：`https://www.w3.org/WAI/standards-guidelines/wcag/`
2. W3C Cognitive Accessibility：`https://www.w3.org/WAI/cognitive/`
3. ISO 9241-210 human-centred design：`https://www.iso.org/standard/77520.html`
4. FDA Human Factors and Medical Devices：`https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance/human-factors-and-medical-devices`

AI / ML 风险：

1. NIST AI RMF：`https://www.nist.gov/itl/ai-risk-management-framework`
2. NIST AI RMF 1.0 publication：`https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10`
3. NIST Generative AI Profile：`https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence`
4. FDA Good Machine Learning Practice：`https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles`

中文构音 / 普通话语料线索：

1. 中国康复研究中心构音障碍检查法相关正式教材 / 量表说明。
2. Frenchay Dysarthria Assessment 中文版相关资料。
3. 普通话声母、韵母、声调、普通话水平测试音系分布研究。
4. 普通话构音障碍声学研究。
5. Mandarin disyllabic speech audiometry materials 相关论文。

硬件 / AAC 设备：

1. Tobii Dynavox TD I-Series：`https://www.tobiidynavox.com/products/td-i-series`
2. PRC-Saltillo Via Pro：`https://documentation.prc-saltillo.com/docs/via-pro-112-specifications`
3. Lingraphica AAC devices：`https://lingraphica.com/aac-devices/`
4. Jabbla Allora 3：`https://www.jabbla.com/en/devices/allora-3-2/`
5. AbleNet BIGmack：`https://www.ablenetinc.com/bigmack/`
