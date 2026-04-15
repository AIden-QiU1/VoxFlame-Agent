# VoxFlame Product PRD（精简版，2026-04-14）

> 这份 PRD 只保留 4 类内容：
> 1. 产品主线
> 2. 当前代码已经做到什么
> 3. 正式上线前还缺什么
> 4. 接下来只做哪几件事
>
> 不再在这里保留大段研究过程、远期架构想象或重复执行计划。

---

## 1. 产品一句话

VoxFlame 不是“纠正用户声音”的产品，而是“帮助系统更准确理解构音障碍用户意图”的沟通工作台。

当前主产品链路固定为：

`首页 -> 沟通工作台 -> 练习工作台 -> 沟通档案`

当前唯一现役执行面固定为：

`Frontend LiveKit RTC/Data -> Backend /api/rtc/session/* -> self-hosted livekit-server -> livekit_agent`

---

## 2. 基于代码的现状判断

截至 2026-04-14，VoxFlame 已经不是“还在搭框架”的阶段，而是“主链能跑，但上线前还缺最后几层治理”的阶段。

更准确地说：

1. 网站骨架已经成立，可以完成一次真实的登录、进入沟通页、进入训练页、进入记忆页的闭环。
2. 实时语音主链已经成立，LiveKit 不是 demo，而是现役运行路径。
3. 训练录音和 dataset 入口已经成立，录音不会因为一次上传失败就静默丢失。
4. `workspace snapshot` 已经开始作为共享读模型存在。
5. 真正还没收稳的，不是页面有没有，而是：
   - 记忆系统 owner 和写回边界
   - 句子级准备资产的统一 owner
   - 录音数据进入 dataset 后的 review / annotation / export 规范

一句话判断：

现在可以做小范围真实试用，但还不适合当作“已经完成正式上线准备”的产品来宣告。

---

## 3. 代码里已经做到的部分

### 3.1 首页与沟通工作台

当前代码已具备：

1. 首页已经不再是纯说明页，而是任务入口。
   - 入口代码：`frontend/src/app/page.tsx`
2. 沟通工作台已经是现役 LiveKit 会话面。
   - 主组件：`frontend/src/components/chat/ChatInterface.tsx`
   - 会话 hook：`frontend/src/hooks/useRtcAgentSession.ts`
3. backend 已经负责 RTC orchestration。
   - 入口：`backend/src/services/rtc-orchestration.service.ts`
4. `workspace snapshot.preparation` 已经会注入实时会话。
5. agent 已经能完成：
   - ASR
   - 文本纠错/改写
   - caption mode
   - TTS 可打断
   - preparation context runtime update

这说明“沟通页主链不存在”已经不是问题。

### 3.2 训练工作台

当前代码已具备：

1. 训练页已经直接走 LiveKit 训练会话。
   - 页面：`frontend/src/app/contribute/page.tsx`
   - 训练 hook：`frontend/src/hooks/useMandarinTrainingSession.ts`
2. 本地录音 envelope 已经成形。
3. 上传链已经成形：
   - recorder queue
   - signed upload
   - upload receipt
   - OSS artifact
   - `manifest.jsonl`
4. 样本会带结构化 metadata：
   - `recording_id`
   - `session_id`
   - `target_text`
   - `recognized_text`
   - `sample_quality_*`
   - `review_*`
5. 准备稿练习已经接进训练页：
   - `prepared_expression` 可拆句训练
   - 训练结果会反哺 rehearsal summary

这说明“录音数据还完全没规范化”也已经不是事实。现在缺的是把现有 contract 真正变成稳定流程。

但从产品价值看，训练页当前最重要的还不是“更多分析”，而是：

1. 让用户录音更舒服
2. 让用户有继续录下去的动力
3. 让用户清楚今天为什么录、录多少、录完得到什么

### 3.3 沟通档案 / 记忆页

当前代码已具备：

1. 记忆页已经能编辑和保存准备稿。
   - 页面：`frontend/src/app/memory/page.tsx`
   - API：`GET/PUT /api/memory/workspace/:userId/prepared-expression`
2. 重点词 hotword 已经能本地维护并同步后端。
3. `workspace snapshot` 已经会返回：
   - `profile_bundle`
   - `session_review`
   - `preparation`
   - `prepared_expression`
   - `expression_kit`
4. rehearsal summary 已经能基于训练样本生成并回流。

这说明“记忆页还是空壳”不成立。问题在于它还没有成为真正唯一、清晰、可信的 durable owner。

### 3.4 Backend / 数据层

当前 backend 已具备：

1. `workspace snapshot` 聚合接口。
2. `prepared expression` 读写与 summarize。
3. upload artifact 持久化与 manifest 写入。
4. dataset review queue 的后端接口。
5. memory growth 聚合，能把 `training_result / training_profile_summary / session_compaction` 吃进 snapshot。

这说明后端已经是控制面雏形，不再只是转发层。

---

## 4. 现在还没做到的关键部分

### 4.1 记忆系统还没有真正收稳

这是当前离正式上线最近、也是最关键的缺口。

当前真实情况是：

1. `livekit_agent/session_userdata.py` 只有最小 session-local state：
   - `PreparationContextPack`
   - `last_user_transcript`
   - `last_assistant_reply`
   - `interruption_count`
   - `barge_in_count`
   - `caption_mode_enabled`
2. 还没有更明确的 typed session working memory contract。
3. 还没有正式的 `assemble_context / after_turn / compact` 三阶段接口。
4. 还没有“哪些字段只活在 session，哪些字段允许写回 durable memory”的稳定制度。

所以当前说“记忆系统已经完成”是不准确的。

### 4.2 session-close compaction 还不是 server-side 稳态

这是另一个必须从文档里纠偏的地方。

当前代码里：

1. `frontend/src/lib/memory/memory-service.ts` 在前端 `endSession()` 时会生成 `session_compaction`。
2. backend `memory-growth` 确实会消费 `session_compaction`。
3. 但 `livekit_agent/app.py` 本身并没有真正实现：
   - turn flush
   - session-close compaction
   - durable write back

也就是说：

目前存在的是“前端本地 compaction 过渡方案”，不是“agent server-side 稳定会后写回链”。

这件事对正式上线是 blocker，因为它直接决定：

1. 会后沉淀是否可信
2. 换设备后是否一致
3. 线上长会话和异常断开时是否还能保留有效记忆

### 4.3 句子级准备资产 owner 还没有完全统一

当前已经有这些对象：

1. `prepared_expression`
2. `hotword_profiles`
3. `quick_phrases`
4. `expression_kit.personalized_phrases`

但它们还没有完全收成同一个“句子级准备资产 owner”。

当前结果是：

1. 用户已经可以准备稿、加重点词、练句子。
2. 但“重要句 / 高频句 / personalized phrase / prepared expression section” 之间仍然有轻微分裂。

这不会阻止内测，但会阻止正式上线后的长期可维护性。

### 4.4 dataset review / annotation 只完成了后端 contract，没完成运营闭环

当前代码里：

1. review queue 的 metadata 已经会写进样本。
2. backend 已有：
   - `GET /api/upload/review-queue`
   - `PATCH /api/upload/review-queue/:contributionId`
3. 样本质量、review priority、accepted_for_export 这些字段都已有后端语义。

但当前还缺：

1. 前端 review UI
2. 谁来复核、何时复核、复核后如何进入 export 的运营闭环
3. 标注硬指标
   - 覆盖率
   - 复核命中率
   - 退回复录率
   - 从录入到可用的时延

所以现在可以说“dataset contract 已经开始规范”，但不能说“数据治理已经完成”。

---

## 5. 对“离网站上线还差什么”的直接回答

如果按当前代码现实来判断，离正式上线主要还差 3 件事，而且正是你指出的这几件：

### 5.1 记忆系统

上线前必须补到：

1. 明确 session-local typed memory schema
2. 明确 `assemble_context -> after_turn -> session-close compact -> durable write`
3. 保证 `workspace` 继续是唯一 durable owner

### 5.2 录音与数据录入

上线前必须补到：

1. 录音主路径稳定
   - 开始录音
   - 停止录音
   - 上传
   - receipt
   - 后台补传
2. 同一句可多次练习，但同一条录音重传不重复写 manifest
3. 样本回流到 prepared expression summary 的节奏稳定
4. 训练页必须把“舒服录音、愿意录、知道目标”当成主功能，而不是附加体验

### 5.3 数据整理与标注规范

上线前必须补到：

1. review queue 真正进入可操作流程
2. 自动规则和人工复核的边界写清
3. export 前的 accepted / rejected 规则固定
4. 不把 dataset 直接当 memory

---

## 6. 上线前的最小执行顺序

接下来不扩 scope，只按这个顺序推进：

1. 先把 `livekit_agent` 的 typed session memory 和 context assembly 收口。
2. 再把 server-side `flush -> compact -> durable write` 做成稳定链路。
3. 再把句子级准备资产收成统一 owner。
4. 再把 dataset review / annotation / export contract 做成真正可执行流程。
5. 最后回到真实场景做长会话 smoke，确认这些沉淀真的改善沟通成功率。

---

## 7. CEO / 产品视角下的新收敛

### 7.1 我们刚刚讨论后，产品真正该长成什么样

从 CEO 视角看，VoxFlame 不该继续被理解成：

1. 一个更强的纠错页面
2. 一个更花哨的训练页
3. 一个抽象的 memory 系统

它更应该被收成：

1. 一个能让用户在重要时刻“带着准备材料进入沟通”的系统
2. 一个能在平时“陪用户练习并持续沉淀”的系统
3. 一个能把“沟通成功”和“训练反馈”收进同一份长期 workspace 的系统

一句话重定锚：

**VoxFlame 的核心产品不是聊天，也不是记忆库，而是 `沟通 loadout + 训练助手 + durable workspace`。**

### 7.2 Memory 不再抽象描述，直接变成产品对象

记忆系统在产品上不再叫“memory bucket”，而是前端可编辑、可加载、可管理的材料系统。

P0 先固定成 4 个对象区：

1. `自定义材料区`
   - 面向一次演讲、一次面试、一次陌生人自我介绍、一次医疗说明
   - 这是用户自己写、自己维护的 source docs
   - 用户在沟通前主动选择是否加载
2. `场景 / 热词模板`
   - 平台提供多套模板
   - 可按场景 / 病种 / 严重程度给出不同模板
   - 目标是提升识别率、降低第一次配置门槛
   - 用户可以加载到上下文，但默认不等于长期自定义材料
3. `用户个人画像`
   - 发音规律
   - 高频误听
   - 澄清关键词
   - 固定开场白 / 补救句
   - 这是 always-on 的核心长期资料
4. `训练总结`
   - 今日训练总结
   - 周期性训练总结
   - 当前最稳表达
   - 当前高风险误听
   - 推荐新增材料
   - 这是系统生成、用户可查看和选择吸收的 derived docs

每个文档区都必须支持：

1. 新建
2. 编辑
3. 删除
4. 保存后进入文档列表
5. 随时打开继续修改

但补充一个重要边界：

1. `场景 / 热词模板` 更像模板库，不一定都支持自由编辑
2. `训练总结` 是系统生成对象，默认以“接受 / 忽略 / 吸收入画像或材料”的方式管理，不要求像原始文档一样全文编辑

### 7.3 对话开始前，不再只是“进房间”，而是先组装 loadout

沟通页在产品上必须新增一个更明确的概念：

`Communication Loadout`

它的目标不是让用户做复杂配置，而是让用户在进入对话前知道：

1. 这次默认已经加载了什么
2. 这次还可以再挂哪些材料
3. 哪些长期资料会始终常驻

P0 的 loadout 装配规则固定为：

1. always-on
   - 用户画像摘要
   - 发音规律摘要
   - 澄清关键词
   - 固定补救句
2. scene pack
   - 当前场景 / 热词模板摘要
3. task pack
   - 用户这次手动勾选的自定义材料
4. recent compaction
   - 最近几次相关沟通的高价值沉淀

runtime 不直接吃原始文档全文；原始文档是 source docs，runtime 优先吃 derived packs。

### 7.4 沟通页拆成两种模式

沟通页建议明确拆成：

1. `紧急沟通区`
2. `长时间沟通区`

它们不只是 UI tab，而是两套不同的产品 contract。

#### 紧急沟通区

目标：

1. 少操作
2. 快进入
3. 快说出关键一句
4. 低延迟

默认只加载：

1. 长期资料
2. 紧急 / 高频场景模板
3. 保底句 / 快捷短语

界面重点：

1. 大按钮开始
2. 保底句 rail
3. 澄清关键词
4. caption / text-first
5. 不展示复杂材料面板

#### 长时间沟通区

目标：

1. 带材料进入
2. 支持结构化表达
3. 支持持续对话中的上下文承接

允许加载：

1. 自定义材料
2. 场景模板
3. 用户个人画像
4. 最近 relevant compaction

界面重点：

1. 已加载材料列表
2. 当前 session goal
3. 本次保底句和 listener guidance
4. 长时表达时的 summary / fallback 提示

### 7.5 训练页要长出“录音助手”，但先做 web-first 版本

你提的录音助手是非常值得做的，但 P0/P1 要分开。

训练页第一原则先固定：

1. 用户录音要舒服
2. 用户录音要有动力
3. 用户录音要有明确目标

也就是说，录音助手首先不是一个“会聊天的助手”，而是一个：

1. 帮用户更轻松开始录
2. 帮用户坚持完成今天目标
3. 帮用户看到今天录音的意义

的训练陪伴层。

P0 先做：

1. 录音舒适度提升
   - 录音前预检
   - 设备 / 音量提示
   - 停止后立刻重录
   - 更清楚的状态反馈：正在听、已停止、上传中、已入库、后台补传中
2. 每日训练目标
   - 今日 10 句 / 20 句
3. 每日完成后生成一次训练建议
   - 发音纠正建议
   - 新材料准备建议
   - 次日训练计划建议
4. 生成一份可编辑的“今日训练计划”
5. 这份计划可以挂到沟通区，用户可：
   - 修改
   - 勾选完成
   - 标记跳过

P1 再做：

1. 录音助手带 TTS，能直接语音和用户对话
2. 主动提醒是否完成今日计划
3. PWA / 本地提醒 / 站内提醒

也就是说，P0 先把“舒服录音 + 目标感 + 建议 + 计划 + 挂载沟通区”做成，P1 再把它变成更像“龙虾一样追着你”的主动助手。

### 7.6 训练助手的产品职责

训练助手不该只是聊天陪练，它应该有 4 个明确职责：

1. `recording companion`
   - 让录音更顺手、更低负担
2. `daily coach`
   - 每日录音后给建议
3. `plan maker`
   - 生成下一个训练计划
4. `material strategist`
   - 建议用户补哪些新材料
5. `summarizer`
   - 周期性压缩训练结果，生成精简有用文档

这个助手的输出默认不直接进入 always-on memory，而是先进：

1. plan draft
2. suggestion draft
3. compact summary draft

只有用户确认或系统通过稳定规则筛过后，才回写 durable workspace。

### 7.7 模型分层建议

当前继续以 `qwen-flash` 承担实时链路是对的。

下一步更合理的模型分工是：

1. 实时模型
   - 用于 ASR 后纠错、短回复、低延迟沟通辅助
   - 继续优先 `qwen-flash`
2. 异步总结模型
   - 用于 prepared material compaction
   - 用于 session summary
   - 用于训练归纳和计划生成
   - 可以评估接入更高容量的 Qwen 系列模型，例如 `Qwen 32B` 一类非实时总结模型
3. 批处理模型
   - 用于夜间或定期 summary / dataset distillation / material refresh

产品原则固定为：

1. 实时链只追求快、稳、够用
2. 复杂总结和计划生成交给异步链
3. 不把高时延模型直接塞进实时沟通主循环

---

## 8. 可落地的功能 / UI / 执行步骤

### 8.1 Phase 1：把记忆系统变成“材料系统”

先落地的 UI：

1. 记忆页顶部改成 4 个对象区：
   - 自定义材料区
   - 场景 / 热词模板
   - 用户个人画像
   - 训练总结
2. 每个区显示文档列表
3. 右侧或下方显示文档编辑器
4. 支持：
   - 新建
   - 打开
   - 删除
   - 编辑
   - 保存

工程步骤：

1. 设计 `workspace documents` 数据结构
2. backend 新增文档 CRUD
3. 记忆页改成文档列表 + 编辑器
4. 把现有 `prepared_expression / hotword / preferences / rehearsal summary` 迁入新对象模型

### 8.2 Phase 2：把沟通页变成 loadout 页面

先落地的 UI：

1. 进入沟通前展示：
   - 默认已加载材料
   - 可勾选材料
   - 当前模式：紧急沟通 / 长时间沟通
2. 沟通中始终可展开“本次已加载”

工程步骤：

1. 设计 `communication_loadout` 数据结构
2. `workspace snapshot` 增加可消费的 loadout view
3. 沟通页接入 mode selector
4. runtime `assemble_context` 改成按 loadout 装配，而不是按页面零散拼装

### 8.3 Phase 3：拆出紧急沟通 / 长时间沟通双模式

UI 重点：

1. 首页入口直接拆成：
   - 现在紧急沟通
   - 长时间沟通
2. 紧急沟通默认更轻
3. 长时间沟通默认展示已加载材料和 session goal

工程步骤：

1. 在现有 `sessionStrategy` 上补产品语义
2. 让 `urgent` 和 `long_form` 拥有不同 loadout policy
3. 调整沟通页组件，而不是新开另一套 runtime

### 8.4 Phase 4：训练页长出录音助手

P0 UI：

1. 录音前准备卡片
   - 当前设备
   - 音量状态
   - 今日目标
2. 今日目标卡片
3. 完成进度
4. 今日建议
5. 明日计划
6. “挂到沟通区”按钮

P1 UI：

1. 助手对话卡片
2. TTS 播报建议
3. 提醒中心

工程步骤：

1. 先补录音舒适度层
   - 预检
   - 状态反馈
   - 快速重录
2. 训练页完成 10 / 20 句后触发异步总结
3. 生成：
   - correction advice
   - material advice
   - next-day plan
4. 存成 `training coach summary`
5. 将计划挂到沟通页与记忆页
6. 再补 TTS 助手和提醒

### 8.5 Phase 5：让总结系统真正接管“精简有用文档”

要落地的文档对象：

1. 今日训练总结
2. 近 7 天训练总结
3. 当前最稳表达清单
4. 当前高风险误听清单
5. 推荐新增材料清单

工程步骤：

1. 把 prepared expression summary 扩成通用 compact summary pipeline
2. 引入异步总结模型
3. 固定 `flush -> compact -> durable write`
4. 只把确认有价值的精简文档写回 workspace

### 8.6 当前推荐执行顺序

按 CEO 视角，最有杠杆的顺序不是“先做提醒”，而是：

1. 先做 3 个文档区和文档列表
2. 再做 loadout
3. 再拆紧急沟通 / 长时间沟通
4. 再把训练页收成“舒服录音 + 明确目标 + 有动力坚持”的工作台
5. 再做训练页录音助手的建议与计划
6. 最后再做语音化助手、主动提醒和更强总结

这样做的原因是：

1. 文档和 loadout 是系统骨架
2. 双模式是用户价值放大器
3. 训练页如果录得不舒服，再好的训练助手都留不住人
4. 训练助手是增强层，不该先于骨架存在

---

## 9. 当前明确不优先

以下内容在正式上线前都不优先：

1. 多 agent / handoff
2. 通用向量记忆平台
3. 新开一套 runtime
4. 独立移动端 / 桌面端大扩张
5. 大范围 UI 翻新

---

## 10. 本文档取代关系

这份精简版 PRD 现在只承担两件事：

1. 说明当前代码现状意味着什么
2. 说明上线前只剩哪几件头等大事

更细的 memory 边界以：

- [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)

更细的短期执行状态以：

- [../.tasks/current.md](../.tasks/current.md)

为准。
