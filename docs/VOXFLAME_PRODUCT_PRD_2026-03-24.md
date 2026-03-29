# VoxFlame Product PRD（2026-03-24）

> 这份文档是当前产品设计、前端体验和技术架构的单一主文档。它不是品牌宣言，而是后续产品判断、UI 设计和工程拆解的权威入口。
>
> 本文档基于三类输入重写：
> - 2026-03-24 的产品笔记与外部产品观察
> - 当前代码现状：`frontend -> backend -> TEN`
> - 既有路线文档中的仍然有效部分

---

## 1. 重新定锚

### 1.1 产品一句话

**VoxFlame 是面向构音障碍用户的主动沟通助手。它先帮助用户开口并被理解，再把练习、记忆和复盘慢慢收回到一个长期变好的系统里。**

### 1.2 当前最重要的判断

现在仓库最大的问题，不是底层链路不存在，而是：

1. 已经有一条可运行的实时主链，但产品入口仍然像“功能说明书”。
2. 沟通、训练、记忆三页方向大体正确，但还没有被组织成一个连贯产品。
3. 用户最需要的不是“我们模型很强”，而是“我现在能不能顺利说出这句话并被理解”。

### 1.3 创始人即用户的一手研究结论

这轮 PRD 不再只基于抽象用户画像，也直接吸收了创始人本人作为目标用户的一手材料。

最重要的结论不是“语音识别还不够准”，而是：

1. 沟通失败常常发生在高压场景，而不是低压试用场景。
2. 最伤人的时刻往往不是某个字识别错，而是被打断、被催促、被忽视、被别人替你回答。
3. 面试、工作协作、医疗问诊、陌生人求助这类时刻，比“了解产品功能”更值得首页优先服务。
4. 产品不能增加用户的社交压力，必须低存在感、可随时打断、像助手或老朋友，而不是抢戏的机器。
5. 对构音障碍人群而言，长期训练当然重要，但第一价值始终是“这一次沟通先成功”。

### 1.4 这次重排后的优先级

1. 可理解性
2. 开口速度
3. 沟通兜底
4. 训练反馈
5. 记忆沉淀
6. 更远期的硬件、轻入口、主动复盘

### 1.5 这次重排吸收的文档结论

本 PRD 已吸收并统一了以下几类判断：

1. 五层架构：`Control / Execution / Memory / Capability / Surface`
2. `TEN + Agora` 只是现役执行面，不应被误写成长期不可替代底座
3. memory 需要 `本地事实源 + typed memory + profile bundle` 三层组合，而不是一个“万能记忆桶”
4. 语音 agent 的长期方向应该是 `runtime tools + skills + workflow + MCP` 分层，而不是把一切塞回 prompt 或页面按钮

这些仓库分析文档已经在 2026-03-26 被进一步收口成 2 份综合参考：

- [VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md)
- [VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md)

后续继续开发时，应优先以本 PRD、根 `README.md` 和 `.tasks/current.md` 为主入口，而不是让多份研究稿继续平级竞争。

---

## 2. 基于代码的现状评估

## 2.1 已经具备的基础

### A. 实时主链已经成立

当前唯一事实源仍然是：

`Frontend RTC/RTM -> Backend /api/rtc/session/* -> TEN rtc graph`

这意味着项目并不是“还停留在想法阶段”，而是已经有明确执行面。

### B. 三个核心页面已经成形

- 首页：`/`，有公开首页和沟通入口切换
- 沟通页：`/?mode=communicate`
- 训练页：`/contribute`
- 记忆页：`/memory`

### C. 训练页是当前最接近产品闭环的部分

从代码看，训练页已经具备：

1. 真实录音开始/停止
2. RTC 实时转写
3. 本地反馈分析
4. 登录页前置授权后的自动样本保存
5. 训练画像累计与 voice profile 同步

这说明“训练不是空概念”，而是已有可深化的工作台。

### D. 记忆与画像已经有骨架

记忆页已经能处理：

1. 本地和远端画像聚合
2. hotword profile
3. 训练趋势与增长统计

这说明后续不是从零做记忆，而是要把“展示什么”和“允许用户编辑什么”重新设计清楚。

## 2.2 当前最明显的产品漂移

### A. 沟通页主路径已经成立，但首页到沟通页的“带任务进入”还没做透

现在的沟通页已经不再是旧的 chat-first 形态：

1. `CommunicationStarterKit` 已进入主首屏
2. `QuickPhrasesPanel` 已退到表达工具箱第二层
3. `workspace` 已开始为 personalized phrase rail 和 session review 提供统一读模型

当前真正还没收住的，是首页如何把用户直接送进正确的 starter context：

1. 首页高压场景还缺“点进去就带 scene / starter intent”
2. personalized phrase rail 还没充分吸收 recent wins / hotwords / session review
3. 沟通首屏还要继续削弱旧聊天壳，强化“先开口、再补救”

### B. 训练页 UI 主线已经收口，但产品可靠性还没到 multi-surface-ready

训练页这轮已经不是旧采集页：

1. 主叙事已收口到 `选句 -> 录音 -> 反馈`
2. 反馈区已经贴近录音区
3. 登录授权已前置，停录后已按主路径自动保存

当前更关键的问题已经从“页面像不像练习工作台”，变成：

1. `recording envelope -> upload receipt -> manifest` 是否对 web / PWA / future mobile / desktop companion 都成立
2. 录完后的云端登记是否足够稳定，不再让用户背“手动同步”心智
3. dataset review / sample quality / export contract 是否已经足够支撑训练、复核、画像和跨端复用

### C. 沟通档案已经开始吃同一份 `workspace`，但还没有成为真正的 owner 入口

当前记忆页已经不只是统计页：

1. `profile_bundle / session_review / expression_kit` 已有统一读模型
2. 沟通页、训练页、记忆页已经开始消费同一份 snapshot

但接下来还缺：

1. expression kit 的正式编辑边界
2. session review 的持续沉淀策略
3. durable profile 的 owner 与写入规则

### D. 文档与架构治理出现了新的漂移

当前不是功能缺文档，而是：

1. `PRD`
2. `Runtime And Surface Reference`
3. `control-plane`
4. `capability-registry`

这几份文档对同一层问题有重叠叙述。

尤其 `capability-registry` 现在把“产品运行时能力”和“repo engineering capabilities”混写在一起，这对工程协作有帮助，但对产品和多端规划反而会制造噪音。

### E. 多端准备的最大风险不是单点能力不够，而是三层基础还没一起成立

从 CEO 视角看，下一阶段最大的风险不是某一层单独不够强，而是：

1. web、PWA、future mobile、future desktop 会不会各长一套会话启动协议
2. recorder queue、upload receipt、manifest 会不会只停留在 web 端心智
3. `workspace / profile bundle / expression kit / agent tooling boundary` 会不会仍然只停留在研究稿里

所以现在优先级应该是三件事一起收口：

1. runtime / surface / control contract
2. memory / agent tooling contract
3. dataset / review / export contract

## 2.3 架构层的现状判断

### A. Backend 已是控制面雏形

`rtc-orchestration.service.ts` 和 `/api/rtc/session/*` 已经承担控制面职责。

这条路径应该继续加固，而不是让前端 hook 或 TEN 主控继续长产品治理逻辑。

### B. 前端 hook 还承担了过多编排责任

`useRtcAgentSession` 现在同时在做：

1. 会话拉起
2. 事件路由
3. transcript 聚合
4. feedback / voice profile sync

它是必要的，但已经靠近“第二控制面”的边界。

### C. TEN 图已经足够承载当前 P0/P1

TEN graph 内已经有：

1. VAD
2. Qwen realtime ASR/TTS
3. correction
4. training feedback
5. memory layer

所以近期不应该把主精力放在“再换一套 runtime”，而应该把产品能力吃干榨尽。

### D. 当前数据流已经开始收口成产品 contract，但 owner 还没完全制度化

现在长期用户状态主要落在三处：

1. 前端 [memory-service.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/memory/memory-service.ts)
2. backend [supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts)
3. TEN [memory_layer_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/memory_layer_python/extension.py)

这已经不再是纯粹“混乱状态”，因为 backend 已经开始向 `workspace / profile bundle / session review / expression kit` 收口。

但它还不是一个完全制度化的 owner 模型。

当前真正缺的不是更多存储点，而是更明确的所有权：

1. frontend local store 负责本地缓存、离线兜底和最近会话草稿
2. backend 负责共享的 `profile bundle / session review / hotword profile`
3. TEN memory 负责低延迟运行时 working memory 和适配状态

在这些 ownership 没写清之前，继续长页面功能，只会让每一层都开始拼自己的“长期画像”。

### E. TEN 主控已经过胖，近期不该继续长产品语义

从 [voxflame_main_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/voxflame_main_python/extension.py) 现状看，它已经同时处理：

1. transport relay
2. `system_init / user_input`
3. training result 汇总
4. voice profile 转发
5. session history 和 transport state

这对当前阶段是可接受的，但下一步应该做的是“停长”，而不是继续把 `expression kit / session review / profile governance` 也放进去。

---

## 3. CEO / Design / Eng 三视角收敛结论

## 3.1 CEO 视角

### 要坚持什么

1. 不做泛化“全能语音 Agent”
2. 不让硬件、听障辅助、复盘陪伴抢走构音障碍主线
3. 不把模型能力叙事放在用户问题前面

### 真正的产品承诺

1. 我现在要说一句很重要的话，VoxFlame 帮我说出去
2. 别人没听懂我，VoxFlame 帮我更快补救
3. 我想长期变好，VoxFlame 帮我看见进步并准备下一次沟通

### CEO 对下一阶段基础设施的判断

1. `Runtime And Surface Reference` 和 `Agent Memory And Tooling Reference` 都应该进入现役主线
2. 前者负责回答：
   - 多端 surface 如何共用一条 runtime / control 语言
   - 会话怎么启动
   - capability 怎么按 surface / mode 暴露
3. 后者负责回答：
   - 真正有用的产品上下文从哪里来
   - `workspace / profile bundle / expression kit / session review` 谁来拥有
   - agent / tool / workflow / MCP 的边界怎么定
4. dataset 文档则负责回答：
   - 样本怎么可靠保存
   - 怎么复核、导出、沉淀成画像
   - 数据面做到哪一层就够支撑产品，而不无限膨胀

### CEO 对文档治理的决策

1. `PRD` 继续是产品主文档
2. `Runtime And Surface Reference` 升级为 multi-surface / control contract 的主参考
3. `Agent Memory And Tooling Reference` 升级为 memory / agent / tooling contract 的主参考
4. `control-plane.md` 继续保留，但定位收紧为 backend 控制面实现与 schema 深文档
5. `capability-registry.md` 不再继续承担产品主参考角色
   - 其中的产品运行时 capability 应逐步并回 `Runtime And Surface Reference`
   - 其中的 repo engineering capabilities 应回到 `AGENTS.md` 与协作文档体系

## 3.2 Design 视角

### 当前设计问题

1. 页面更像文档，不像工作台
2. 主任务不够强，二级信息太多
3. 沟通页默认是聊天界面，缺少“先开口”的仪式感和安全感
4. 记忆页偏统计展示，还没有形成“个人表达档案”

### 设计方向

1. 首页是任务分发页，不是产品介绍页
2. 沟通页是“沟通工作台”，不是聊天 App
3. 训练页是“练一句今天真会用的话”，不是采集控制台
4. 记忆页是“沟通档案 + 下次准备页”，不是数据仓库

## 3.3 Eng 视角

### 不该做的事

1. 不恢复 websocket 主链
2. 不并行再造一套 runtime
3. 不让 `compat` 长新逻辑
4. 不把 dataset 和 memory 混成一套存储心智

### 该做的事

1. 明确 control plane contract
2. 统一 starter kit、quick phrase、memory recommendation 的边界
3. 把 communication / training / memory 的数据对象做成明确 bundle
4. 为未来轻入口预留 `session_strategy`，但不抢当前主线

---

## 4. 产品对象模型

## 4.1 三个主工作台

### A. 沟通工作台

用户目标：

1. 快速开口
2. 在沟通失败时迅速补救
3. 在高压场景里保持可控

### B. 练习工作台

用户目标：

1. 练今天真会说的话
2. 立刻知道系统听成了什么
3. 获得下一步练法

### C. 沟通档案

用户目标：

1. 看高频表达和热词
2. 看最近卡住的点
3. 为下一次沟通做准备

## 4.2 一个延后但重要的能力

### D. 沟通复盘 / 陪练教练

这是未来重要方向，但不是现在的首页主入口。

它更适合建立在：

1. 正式沟通记录
2. 训练画像
3. 用户明确同意的复盘上下文

之后再逐步形成“会后复盘”和“主动陪练”。

---

## 5. PRD：核心需求定义

## 5.1 首页

### 目标

用 10 秒告诉用户：

1. 现在就能做什么
2. 应该点哪个入口
3. 这次不需要先理解复杂系统
4. 在高压场景里，燃言会先帮助我完成一次沟通，而不是要求我先阅读说明书

### 首页必须只有三个一级入口

1. `现在沟通`
2. `练今天要说的话`
3. `查看我的沟通档案`

### 首页 P0 信息架构

1. 首屏直接露出高压场景：`求职 / 面试`、`工作协作`、`医疗沟通`、`陌生人求助`
2. 首屏直接解释燃言先帮什么：`开场`、`补救`、`准备`
3. 首屏明确说明：`机器不是主角，用户始终可以打断、覆盖和改写`
4. 三个一级入口只服务三件事：`先开口`、`练今天要说的话`、`为下次准备`

### 首页不该成为重点的信息

1. 模型栈
2. 实时架构
3. 字幕展示
4. 宏大愿景

## 5.2 沟通工作台

### P0 功能

1. 先选场景：医疗 / 家庭 / 陌生人 / 紧急
2. 首屏展示 starter kit，而不是先展示空聊天区
3. 可直接点击第一句话代播
4. personalized quick phrases 作为第二层入口
5. 支持语音、文字、代播三种输入
6. 支持打断、重试、确认没听清
7. 保留双行对照，只在真正不同的时候显示

### P1 功能

1. 会话结束后生成轻量复盘卡
2. 自动建议把本次高频句加入表达工具箱
3. 根据记忆推荐下次更常用的 starter

### 明确不做

1. 把沟通页做成“万能社交 feed”
2. 让用户先配置大量参数再开始沟通
3. 让全屏字幕继续主导整个页面叙事

## 5.3 练习工作台

### P0 功能

1. 按真实场景句组织练习，而不是按抽象音素入口组织
2. 每次录音后立刻给出：
   - 目标句
   - 系统听到的内容
   - 本次最该先改的点
   - 下一次建议
3. 上传必须是明确授权
4. 数据进入 dataset，不自动等于长期记忆
5. 累积到门槛后再生成训练画像摘要

### P1 功能

1. 根据沟通档案生成今日训练任务
2. 把训练页从“句库浏览”升级为“练习任务流”
3. 支持用户标注“这句话对我特别重要”

### 明确不做

1. 医学诊断式表达
2. 复杂但不可解释的评分系统
3. 以采集量替代用户价值

## 5.4 沟通档案

### P0 功能

1. 高频表达
2. 热词和场景词
3. 易混淆模式
4. 最近训练趋势
5. 可编辑的个人偏好和重要词

### P1 功能

1. 今日建议练习
2. 下次沟通准备包
3. 会话复盘摘要

### 明确不做

1. 把所有历史细节直接堆给用户
2. 用大量图表替代行动建议
3. 把原始训练数据当作记忆页主内容

---

## 6. 统一的信息架构

## 6.1 Surface Map

```text
Home
  -> 现在沟通
       -> 场景选择
       -> Starter Kit
       -> Personalized Phrase Rail
       -> Live Session
       -> 轻量复盘
  -> 练今天要说的话
       -> 今日任务 / 句类
       -> 录音
       -> 即时反馈
       -> 授权上传
       -> 画像更新
  -> 查看我的沟通档案
       -> 高频表达
       -> 热词
       -> 易混淆点
       -> 训练趋势
       -> 下次准备
```

## 6.2 统一对象

### A. Expression Kit

把以下内容统一看成一个对象，而不是三个散模块：

1. 策展式 starter phrases
2. 用户自定义 quick phrases
3. memory 推荐的高频表达

其中：

- `starter kit` 负责高风险场景开口
- `quick phrases` 负责个人常用表达
- `memory recommendation` 负责动态排序和补充

### B. Profile Bundle

对运行时真正有用的长期画像只保留：

1. hotwords
2. common confusions
3. dominant scenes
4. expression preferences
5. recent training focus

### C. Session Review

会话结束后只沉淀最有用的摘要：

1. 本次最常用表达
2. 被误解点
3. 推荐补入的短语
4. 是否值得转成训练任务

### D. Dataset Recorder

只负责：

1. 用户授权
2. 录音与监督标签元数据
3. 质量控制
4. 训练集 manifest

它不等于 memory。

---

## 7. UI / UX 设计方向

## 7.1 设计原则

1. 中文优先，减少英文式产品噪声
2. 让用户感觉“被接住”，不是“被系统评估”
3. 先突出一个动作，再展示状态和解释
4. 主表面尽量实体底色，不靠大面积半透明营造高级感
5. 页面根据任务切换宽度，而不是一套 `max-width`

## 7.2 页面视觉语言

### 首页

- 任务卡片清晰、层级少、标题短
- 更像“今天做什么”，不像“阅读品牌页”
- 首屏优先承接高压沟通场景，而不是先做品牌宣言
- 要把“被接住”和“用户仍主导”明确传达出来

### 沟通工作台

- 首屏先给场景和第一句话，不先给消息气泡墙
- 把录音、代播、重试、确认做成低认知负担的大动作区
- 实时区域要像工作台，不像社交聊天

### 练习工作台

- 目标句和反馈是主角
- 录完后如果登录授权已确认，目标句和录音应自动进入训练样本链路
- ASR 识别句子只服务即时反馈，不应混成监督样本标签
- 同一句允许保留多次练习样本；系统只对同一条录音的重试与补传做安全去重
- 上传和系统解释是次级信息
- 让用户读完一屏就知道自己下一步做什么

### 沟通档案

- 以“准备下一次沟通”为目标组织内容
- 先给建议和高频表达，再给趋势

## 7.3 具体前端指引

1. 沟通页使用更宽工作台宽度
2. 表单与编辑页维持较窄阅读宽度
3. 标题减少营销化修辞，更多用任务化短句
4. 颜色以温暖中性色 + 一个清晰强调色为主
5. 动效只服务状态转换，不做浮夸反馈

## 7.4 Google-like UI 目标

这里说的“更像 Google”，不是参考已经失效的某个单产品，而是借鉴 Google 当前产品语言里真正有价值的部分：

1. `glanceable`
   - 重要信息先被看到，不需要先阅读长说明
2. `fluid`
   - 状态切换轻、顺、快，不靠重动画炫技
3. `personal`
   - 个体偏好、热词、表达工具箱能自然露出
4. `editable`
   - transcript、短语、标签、热词都应允许用户修订
5. `opt-in sync`
   - 记录、同步、分享、上传都默认可控，而不是偷偷发生

对 VoxFlame 的直接翻译：

1. 沟通页首屏要像一个可信赖的沟通工具，而不是聊天演示页
2. 训练页要像一个轻、清楚、可回看的练习工作台
3. 记忆页要像个人表达档案，而不是复杂报表中心
4. 首页要有 Google 式“干净、明确、低噪音”的任务入口感
5. Google-like 不等于冷冰冰；对 VoxFlame 来说，它还必须传达“低压力、可信赖、不会替你夺走话语权”

---

## 8. 技术架构蓝图

## 8.1 保持不变的唯一事实源

正式沟通与训练主链继续基于：

`Frontend RTC/RTM -> Backend /api/rtc/session/* -> TEN rtc graph`

但这只是**当前现役执行面**，不是未来必须永久绑定的底座。

### 8.1.1 长期执行面判断

从现有替换研究和代码耦合看：

1. `TEN + Agora` 应被视作过渡执行面
2. 产品 contract 不能继续写死在 `channel_name / user_uid / rtcToken / rtmToken`
3. 未来应逐步切到 vendor-neutral 的 `session / transport / participant / capability` 语言

这意味着：

- 近期继续吃透当前主链
- 中期开始为执行面替换做 contract 收口
- 不把当前供应商语义继续抬升为产品语义

## 8.2 新的控制面 contract

后续控制面统一围绕下列请求对象展开：

```ts
type SessionIntent = {
  surface: 'home_main' | 'communication_workspace' | 'training_workspace' | 'memory_workspace' | 'pwa_quick_talk' | 'mobile_companion'
  mode: 'communication' | 'training' | 'quick_talk'
  session_strategy: 'heavy_realtime' | 'light_voice'
  user_id?: string
  requested_capabilities?: string[]
  scene?: 'medical' | 'family' | 'stranger' | 'emergency'
}
```

控制面不应只返回 transport 凭证；它还应逐步成为三类对象的统一出口：

1. `session bootstrap`
   - transport session handle
   - requested capabilities
   - diagnostics
2. `profile bundle`
   - hotwords
   - common confusions
   - dominant scenes
   - recent training focus
3. `expression kit`
   - starter kit
   - personalized quick phrases
   - memory-ranked recommendations

一句话说，后续页面不该再“自己去不同层凑上下文”，而应该向 backend/control plane 领取一份面向当前任务的工作包。

## 8.3 Heavy / Light 双策略

### Heavy Realtime

适用：

1. 正式沟通
2. 训练页实时反馈
3. 需要打断与低延迟状态同步的场景

### Light Voice

保留给未来：

1. quick talk
2. widget
3. mobile companion
4. 轻训练录制器

现在只做 contract 预留，不抢当前主线资源。

## 8.4 执行面替换路线

### 当前判断

1. 不继续在 `TEN + Agora` 上深度平台化
2. 先把 `Agora` 降级成兼容层语义
3. 先抽 `transport adapter + vendor-neutral session contract`
4. 再评估新的 room/session runtime

### 当前最合理的中期方向

1. control plane 保持在 backend
2. frontend 先抽 transport adapter
3. execution plane 的长期候选以 room/session 型 runtime 为主
4. runtime 替换时优先保证 capability contract 不变，而不是追求一次性大迁移

### 替换时不能破坏的能力 contract

1. `session_start / session_stop / session_ping`
2. `transport_send_control`
3. `training_feedback_request`
4. `voice_profile_update`
5. `memory_profile_read / write`
6. `session_review_build`

## 8.5 五层架构下的职责

### Surface

- 首页、沟通工作台、练习工作台、沟通档案、未来轻入口

### Control

- session lifecycle
- mode routing
- capability gating
- diagnostics

### Execution

- TEN realtime graph
- ASR / correction / TTS / training feedback

### Memory

- profile bundle
- session review
- hotword profiles

### Capability

- expression kit
- training feedback
- voice profile sync
- future review coach

## 8.6 记忆系统深设计

### L0 实时工作记忆

- 当前 turn
- 打断恢复
- 临时 transcript buffer

### L1 本地事实源

- 本地 store
- 可读摘要
- 可审计用户事实

目标：

- 可解释
- 可导出
- 可人工修订

### L2 typed memory 层

第一版建议至少拆成：

1. `communication_profile`
2. `training_event`
3. `confusion_pattern`
4. `hotword_group`
5. `scenario_preference`
6. `guidance_preference`
7. `session_review`

### L3 profile bundle 上下文层

对运行时只输出统一 bundle：

```json
{
  "static": [],
  "dynamic": [],
  "relevant": []
}
```

沟通页、训练页、未来 app 都消费这同一份 bundle，而不是各自拼自己的 memory context。

### L4 选择性多模态索引

只针对高价值音频片段做异步索引，不进入默认实时主链。

### 记忆写入边界

1. `dataset` 不是 `memory`
2. `transcript` 不是天然长期记忆
3. `voice_profile` 必须是结构化字段 + 少量摘要
4. 长期记忆默认“提炼后写入”，不是原文直灌

## 8.7 Agent 系统深设计

VoxFlame 不该把 agent 系统理解成“一个更复杂的 prompt”。

后续应明确四层：

### Realtime Core Tools

- `session_start`
- `transport_send_control`
- `interrupt_control`
- `tts_speak`
- `transcript_finalize`

### Memory & Profile Tools

- `memory_bundle_get`
- `voice_profile_read`
- `voice_profile_update`
- `session_review_write`

### Training & Dataset Tools

- `training_feedback_request`
- `recorder_enqueue`
- `dataset_manifest_append`
- `sample_quality_score`

### Async Workflow / MCP

- `provider_health_check`
- `report_generate`
- `issue_workflow_ops`
- 未来外部知识库 / 设备状态 / CRM / 康复机构接入

一句话原则：

`实时能力做 tool，长期方法做 skill，重任务编排做 workflow，跨系统接入做 MCP。`

## 8.8 关键工程边界

1. dataset != memory
2. frontend hook != control plane
3. TEN main control != product governance layer
4. starter kit != quick phrase CRUD
5. light voice != new primary runtime
6. transport vendor != product language
7. docs current task != historical execution archive
8. frontend local cache != shared durable profile
9. runtime working memory != user-facing communication archive

---

## 9. 指标框架

## 9.1 北极星指标

- 陌生人沟通成功率

## 9.2 P0 核心指标

1. 第一话发起成功率
2. 沟通失败后的兜底完成率
3. p95 从点击到首次可播出响应时间
4. 双行对照触发后的用户纠偏成功率

## 9.3 P1 成长指标

1. 训练后 7 天再次使用率
2. 训练样本到训练画像形成率
3. 高频表达命中率
4. 训练任务完成率

---

## 10. 分阶段路线图

## Phase 0：产品语言与主路径收口

当前状态：大部分已完成

1. 首页、README、docs、AGENTS 已基本统一到“主动沟通助手 + 练习工作台 + 沟通档案”
2. 沟通页首屏已接入 starter kit
3. expression kit / profile bundle / dataset recorder 边界已初步成立
4. 旧 roadmap / reset / strategy 主文已退出现役维护

## Phase 1：沟通工作台继续变强

当前状态：进行中

1. 首页高压场景直接带 starter intent 进入沟通页
2. personalized phrase rail 继续吸收 `workspace` 与 recent review
3. live session 区继续减弱聊天壳，强化“先开口 + 补救”

## Phase 2：练习工作台升级为 multi-surface-ready 训练入口

当前状态：进行中，优先级最高

1. 稳定 `recording envelope -> upload receipt -> manifest`
2. 把样本质量、review queue、云端登记做成可信主链
3. 让训练页继续服务用户练习，而不是暴露采集心智

## Phase 3：控制面与 surface contract 收口

当前状态：下一阶段主任务

1. 正式化 `session / transport / capability / session_strategy`
2. 为 web / PWA / future mobile / future desktop 统一 surface 语言
3. 把 `Runtime And Surface Reference` 升级成多端规划的主参考

## Phase 4：沟通档案与 memory/tooling 深化

当前状态：排在 runtime/surface 之后

1. 让 `workspace` 真正成为 durable profile owner 入口
2. 支持 expression kit 编辑与更清楚的 session review 治理
3. 再继续深化 memory / tooling / future coach

## 10.1 按现状代码的最可行开发路径

在当前仓库里，最可行的顺序不是“先换 runtime”，而是：

1. 先把训练数据链路做成 multi-surface-ready 基线
   - `recording envelope`
   - `upload receipt`
   - `manifest`
   - `review queue`
2. 再把 runtime / surface / control contract 写实
   - `session intent`
   - `session strategy`
   - `capability gating`
   - `surface readiness`
3. 再继续加固 backend `workspace`
   - `profile bundle`
   - `session review`
   - `expression kit merge`
4. 再把前端 session hooks 变薄
   - transport bootstrap
   - transcript reducer
   - memory sync
   - training feedback sync
5. 然后才评估轻入口与 future multi-surface 扩展
   - `light voice`
   - `mobile companion`
   - `desktop companion`

---

## 11. 当前不优先

1. 再造一套 runtime
2. 用硬件叙事替代主产品闭环
3. 把听障辅助并入当前首页主线
4. 复杂社交页 / feed 页
5. 医学诊断式训练报告

---

## 12. 本文档取代关系

本文档取代并合并以下文档中的产品主结论：

- `docs/COMMUNICATION_FIRST_PRODUCT_RESET_2026-03-09.md`
- `docs/VOXFLAME_PRODUCT_STRATEGY_AND_USER_RESEARCH_2026-03-05.md`
- `docs/VOXFLAME_EXECUTION_ROADMAP_2026-03-05.md`

这些旧文档中的部分研究结论已被吸收；后续不再作为产品主文继续维护。
