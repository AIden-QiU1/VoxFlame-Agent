# Daily Capture

这里就是随手记。

不追求标准格式，不要求一次写完整。
一句话、一个链接、一个观察、一个突然冒出来的念头，都可以先扔进来。

---
## 2026-04-06




app端：react native with expo + typescriptweb端：react.js + typescriptapi端：trpc 导出类型给app和web用，或者nest.js + 手动编写类型声明然后复制到app和web端用(也可以单独抽出一个名为datasource的monorepo，这样三个项目都可以共用这一个类型声明，这也是很多大厂以及我目前在用的方式)以上三个项目全部放在同一个git repo下做monorepo(用pnpm的workspace即可)这是目前性价比最高并且社区支持最完善的方案，之所以说性价比高是因为只需要学习react和nest.js这两个框架即可。稳定性好指的是typescript可以保证类型安全确保多个项目之间对接API不会有问题。社区支持完善就不用说了，react.js和nest.js都是node.js技术栈中在前后端领域各自都最火的框架，这也是很多大厂在用的相关框架（不信你可以去npm官网查一下这几个库的star，更新频率以及每周下载量等数据，还有react.js和nest.js的生态环境，google在medium和stackoverflow等网站查一下这些框架的名称调研一下使用情况，然后再去招聘网站评估一下给这些技术栈找接盘侠的难度，和其他那几个回答提到的什么flutter，uniapp，weex，fastapi，rails之类的和他们相比根本就不是一个等级，flutter目前除了闲鱼好像基本没有大厂在用，rn的话有airbnb，ctrip携程，wix以及expo官方在支持，minor version也在持续升级追随react的升级脚步，最近几个版本把js引擎也升级到了facebook的hermes，性能又更上一个台阶（react native性能问题已经是老黄历了，2023年末我拿个8年前的高通800系的手机都能跑最新版rn开发的app）你选个flutter就不说学习dart的成本了，招人也困难，单独招flutter很难找，但是招个写react前端的人转rn是很快的，uniapp这种国产框架不予置评，自己百度一下看看就知道多少坑，其他什么乱七八糟的框架的社区支持都不如rn和nest，最直观的就是看招聘jd，教程文章数量，stackoverflow的提问解答率就知道了）我目前已经有多个生产环境项目在用这套架构，配合 github actions做CI，sentry做监控，react native编译直接用expo的eas云端编译服务甚至可以做到本地不需要搭建安卓和ios开发环境，只需要装一个expo app即可真机开发并且自带热更新这套方案我已经使用有三年之久没有出现任何严重问题，无论是公司项目还是学校项目还是自己外包接单的项目用这套方案都非常顺手，找人接手和培训也很方便，基本上只要会写js和ts即可，这两个语言的上手难度和环境搭建难度也不是很高，node环境可以直接用nvm安装，多版本切换很方便，某个版本搞坏了也可以用nvm卸载后再重装，不污染系统也无需设置环境变量。至于npm registry，即使在国内，也有淘宝cnpm提供完整的第三方依赖包镜像支持。送礼物
nextjs + react native + graphQL + prisma + nestjs

懂行的都知道这套技术栈 性价比最高的，投入最小，收益极大，不仅全栈，大公司也可以用

从Claude Code刚泄漏的源码，看当前第一梯队 AI Agent 的工程架构

今天（2026年3月31日），Anthropic 再次因为打包流程的低级失误，将其最新版 Claude Code（v2.1.88）的完整前端与客户端源码暴露在了 npm 仓库中。

网友发布了一个未被剔除的 cli.js.map 文件，直接还原出了约 1900 个文件、超过 51 万行的原生 TypeScript 代码。

对于 Anthropic 而言，这是继前几天 Mythos 模型文档外泄后的又一次严重 OpSec事故。

但对于整个大模型应用层的开发者和行业研究者来说，这份源码却是一份毫无保留的、价值极高的前沿 AI Agent 工程架构白皮书。

抛开合规与泄露事件的争议，我花了一些时间在本地对这份源码进行了深度梳理。

如果不把它看作一个八卦，而是看作一个生产级 AI 编程助手架构案例，里面有大量突破常规思维的工程决策。

以下是我以客观视角，对 Claude Code 底层架构、调度机制、记忆系统及安全策略的详细技术拆解。

文章较长，适合从事 AI Infra、Agent 开发以及对大模型应用层架构感兴趣的从业者阅读。

PART.01
不仅仅是一个 CLI 工具

THUMB
STOPPING
从目录结构（src/ 下约 40 个一级模块）可以看出，Claude Code 的复杂度远超目前市面上开源的常规单体 Agent。

Image
它的技术栈选型非常务实且注重终端交互体验：

语言为 TypeScript，运行时选择了性能更激进的 Bun，CLI 框架使用 Commander，而终端渲染层则出人意料地使用了 React + Ink。

为什么一个命令行工具要用 React？

源码中的 screens/REPL.tsx（高达 5005 行）给出了答案。

在大模型流式输出（Streaming）和多工具并发执行的场景下，终端 UI 的状态管理变得极其复杂（例如同时渲染思考过程、工具调用进度条、代码 Diff 预览等）。

采用声明式的 React 配合极简的 Zustand 风格自定义 Store（state/store.ts），是应对这种高频局部刷新的最佳工程实践。

在运行模式上，系统被严密地划分为两种形态：

交互式 REPL 模式：通过 Ink 驱动前端终端 UI，主要面向人类开发者。

无头/SDK 模式（QueryEngine 类）：完全剥离 UI，支持 JSON 流式输出。这为后续将其作为底层引擎嵌入 IDE（如类似 Cursor 的形态）或 CI/CD 流程中埋下了伏笔。

系统启动流程也做了极致的并发优化。

在 main.tsx 中，配置读取（MDM Settings）和 Keychain 密钥预取等 I/O 密集型操作被放在子进程中，与主模块 ~135ms 的加载过程并行执行，这种对启动延迟的毫秒级苛求，贯穿了整个代码库。

PART.02
Prompt Cache（提示词缓存）工程学

THUMB
STOPPING
这是整份源码中最具技术含量的部分，也是拉开 Claude Code 与普通套壳应用体验差距的核心壁垒。

目前 Agent 工具在处理长上下文时，往往还在简单粗暴地拼接 System Prompt 和历史对话。

而在 Claude Code 的 services/api/claude.ts（长达 3419 行的核心交互模块）中，提示词组装被做到了字节级的精打细算。

众所周知，Anthropic 的 Prompt Cache 机制采用前缀匹配（Prefix Matching）。

为了最大化缓存命中率，Claude Code 设计了严密的分段缓存架构：

静态段（全局可缓存）：通过 systemPromptSection() 生成，包含模型身份介绍（"You are Claude Code..."）、系统级安全规则、代码风格限制、工具使用基础指南等。这部分在整个会话生命周期内几乎不变。

动态分界线：源码中硬编码了一个特殊标记 SYSTEM_PROMPT_DYNAMIC_BOUNDARY。

动态段（会话级缓存/不缓存）：包含当前工作目录信息（CWD）、Git 状态、MCP（Model Context Protocol）指令、用户配置等高频变化的数据。

Image
并且为了防止 Prompt 发生微小变化导致缓存穿透，系统做了大量看似繁琐的兜底工作：

确定性排序：传给大模型的工具描述（Tools Description）被严格按照内置工具前缀 + MCP 工具后缀进行字母表排序。
哈希路径映射：配置文件的路径不使用随机 UUID，而是使用基于内容的哈希值，避免每次注入路径不同破坏缓存。
状态外置：甚至连当前可用的 Agent 列表，也被从工具描述中剥离，转移到了消息附件（Attachments）中。据源码注释透露，仅这一项改动就减少了约 10.2% 的 Cache Creation Tokens 消耗。
这一切都在说明一个行业现状：现阶段优秀的 AI 应用层开发，本质上就是在贪婪且精细地压榨 API 缓存系统的价值。

PART.03
Tools与流式并发执行


THUMB
STOPPING
Claude Code 内置了超过 40 种工具（涵盖文件读写、Bash 执行、网络抓取等），其工具系统架构采用了高度模块化的工厂模式（Factory Pattern）。

每个工具继承自基础的 Tool 接口，必须实现诸如 checkPermissions()、validateInput() 和 isConcurrencySafe()（是否并发安全）等方法。

按需加载的 ToolSearch 机制：当工具数量超过某个阈值时，如果把所有工具的描述都塞进 Prompt，Token 成本将不可接受。

源码中展示了一种名为 ToolSearch 的优雅策略：非核心工具（如某些特定的分析插件）被标记为 defer_loading: true。

Image
模型在当前 Prompt 中看不到这些工具的具体定义，只知道有一个 ToolSearch 工具。当模型认为自己需要额外能力时，必须先调用 ToolSearch 去动态加载对应的工具配置。

StreamingToolExecutor（流式工具执行器）：为了提升执行效率，系统支持工具的并发调用。

协调器（toolOrchestration.ts）会将大模型返回的工具调用请求分区为并发批次和串行批次。

并发安全的工具（如同时读取多个不相关的文件、并发发起网络搜索）会被并行触发，而非并发安全的工具（如先后修改同一个代码文件）则严格串行。

大结果集的工具（如全盘 Grep 搜索）设有 maxResultSizeChars 预算，超过预算的内容会被直接截断并持久化到本地临时文件中，只给 LLM 返回一个预览摘要，防止超大结果撑爆上下文窗口。

PART.04
解决上下文污染的Fork机制



THUMB
STOPPING
目前的单体 Agent 存在一个致命缺陷：

在执行复杂任务（例如跨文件排查 Bug）时，模型可能会反复读取错误的文件、尝试错误的命令，这些试错过程会产生大量的垃圾上下文，迅速污染主对话，导致模型在后续推理中精神分裂或遗忘初始目标。

Claude Code 引入了复杂的 协调器模式（Coordinator Mode） 和 Fork Subagent（派生子代理） 机制来解决这一问题。

Image
在环境变量启用协调器模式后，系统会被重构为 Coordinator-Workers 架构：

Coordinator（协调者）：被剥夺了直接操作文件的权限，只保留 Agent（派生子代理）、SendMessage 和 TaskStop 三个工具。它的唯一工作是规划工作流（Research → Synthesis → Implementation → Verification）。
Workers（执行者）：携带具体的工具描述被派生出来。
最值得称道的是其 Fork 继承机制。

当需要进行大范围代码探索时，Coordinator 会 Fork 出一个 Explore Agent。

这个子 Agent 会继承父对话的缓存（共享 Prompt Cache 以节约成本），但其后续的探索动作、读取的垃圾文件，完全在其隔离的上下文中进行。

探索结束后，子 Agent 只需要通过特定的 XML 格式 <task-notification>，将提炼好的关键结论（Synthesis）传回给 Coordinator 的主上下文即可。

这种用完即毁，只留结论的设计，是目前业界处理复杂多 Agent 长文本协同的最佳实践之一。

PART.05
突破单体的 Agent Swarm并发机制

THUMB
STOPPING
除了用于解决上下文污染的串行 Fork 机制，源码还展示了更具野心的并发多 Agent 架构——Swarm（Teammate）集群。

这部分逻辑主要隐藏在 utils/swarm/ 和 tasks/ 目录中。

系统支持一种名为 in_process_teammate 的任务类型。

在这种架构下，主进程可以平行唤醒多个 Agent（被称为 Teammate）同时执行不同的任务。

但在终端 CLI 环境中搞多 Agent 并发，会面临两个致命的工程挑战：权限弹窗冲突和 UI 渲染混乱。

Anthropic 的解法极为优雅：

Leader 权限桥接（permissionSync.ts）：所有的 Teammate 子进程都不允许直接向用户弹窗请求权限。它们会将权限请求通过内部通道“桥接”给主进程的 Leader Agent，由 Leader 统一在主终端进行安全拦截和用户确认。
终端布局自动化：为了让用户能清晰地监控多个并行 Agent 的工作状态，源码直接集成了 iTerm2 和 Terminal.app 的 AppleScript 控制指令。当派生新的 Teammate 时，系统会自动在终端中切分窗格（Split Pane），为每个子 Agent 分配独立的输出视窗。
这标志着 AI 正在从“单体思考”正式向“集群并发协作”演进。

PART.06
Dream（梦境）记忆架构

THUMB
STOPPING
在 RAG（检索增强生成）大行其道的今天，几乎所有的 AI 产品都在集成向量数据库（Vector DB）。

但令人意外的是，Claude Code 的记忆系统（memdir/ 模块）极其复古且务实，它完全基于本地文件系统。

其架构由一个核心的 MEMORY.md（作为高层索引，被限制在最多 200 行/25KB 以内）和多个基于 Frontmatter 格式的主题文件组成。

记忆被精细划分为 User、Feedback、Project、Reference 四大类。

更有趣的是隐藏在源码中的 KAIROS 助手模式。

这是一个尚未正式发布的长期运行（Daemon）模式。

在 KAIROS 模式下，记忆系统不再是简单的索引更新，而是采用了类似人类日志的追加模式（写入 logs/YYYY/MM/YYYY-MM-DD.md）。

到了夜间或闲置时间，后台会唤醒一个名为 Dream（做梦） 的离线任务 Agent。

Image
这个 Agent 的职责是对白天的流水账日志进行总结、蒸馏，然后将其提取固化到结构化的长期主题文件中。

这种从短期日志到长期记忆的异步整合机制，不仅绕开了向量检索的召回率痛点，还代表了端侧 AI 助理向永远在线、持续学习演进的明确方向。

PART.07
权限收敛与安全

THUMB
STOPPING
赋予 AI 执行本地 Shell 命令和修改文件的权限，是一把双刃剑。

频繁弹窗要求用户确认会彻底破坏自动化体验，而不加限制的自动执行则可能导致系统崩溃（如误执行 rm -rf）。

Claude Code 采用了一套多层权限收敛架构：

从底层的基于 @anthropic-ai/sandbox-runtime 的文件/网络沙箱，到特定危险操作（如 git push --force）的硬编码拦截，再到工具级别的校验。

Image
但最引人注目的是其名为 Auto Mode Classifier (yoloClassifier.ts) 的组件。

当用户开启自动模式时，系统并没有使用死板的正则表达式来评估命令的危险性，而是使用了一个 侧查询（Side Query）机制。

系统会在后台静默调用一个更小、更便宜的 LLM，将当前对话的精简转录（Transcript）和即将执行的 Bash 命令抛给它，让这个侧边模型输出 Allow 或 Deny 的决策。
此外，系统内部还有一个基于阈值的Denial Tracking（拒绝追踪），当自动工具被频繁拒绝时，系统会优雅降级，退回到 Prompting 模式请求人类介入。

这种用小 AI 监管大 AI的动态权限系统，比传统的静态静态拦截规则要灵活得多。

PART.08
一些小彩蛋


THUMB
STOPPING
最后，源码中大量存在的 Feature Flags（如 VOICE_MODE、SSH_REMOTE 等）和 process.env.USER_TYPE === 'ant' 的环境变量判断，向我们展示了大厂在内部测试和外部发布时的双重标准。

对于 Anthropic 内部员工（Ant-only），系统注入的代码规范极其严厉甚至偏执：

不要擅自添加功能、如果要求没提就不要重构、三行相似的代码比过早的抽象更好、默认不写任何注释，除非 WHY 极不明显、测试失败了必须如实报告。

而对于外部公开构建，系统提示词则温和得多：直接切入主题，尝试最简单的方法，尽量简明扼要。

这种反差，说明大模型的行为边界很大程度上取决于硬编码的指令倾向。

值得注意的是代码里包含了两个有意思的模块。

卧底模式（Undercover Mode）：
这是一个备受安全社区争议的功能。

针对员工在开源或公共仓库工作的场景，系统默认开启且无法强制关闭该模式。该模式会在 Prompt 中明确要求模型Do not blow your cover（不要暴露身份），并强制剥离所有由 AI 生成的免责声明或代号痕迹。

从公关角度这或许显得缺乏透明度，但从侧面印证了厂商对模型角色扮演和输出干预的绝对控制力。

Buddy System（电子宠物）彩蛋：
源码中包含了一个隐藏的电子宠物系统（生成鸭子、猫头鹰等）。

Image
为了保证宠物生成的随机性与确定性，工程师使用了用户的 ID 配合 Mulberry32 伪随机数生成算法。

typescript

// 18 种物种: duck, goose, blob, cat, dragon, octopus, owl, penguin, ...

// 5 种稀有度: common(60%), uncommon(25%), rare(10%), epic(4%), legendary(1%)

// 属性: DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK

// 配件: crown, tophat, propeller, halo, wizard, beanie, tinyduck

// 特殊: 1% 概率 shiny

最搞笑的一个细节是，由于某个动物物种的英文名称恰好与 Anthropic 极其机密的内部模型代号重名（也许是前两天泄露的最强Claude卡皮巴拉）。

Image
为了绕过合规代码扫描仪的违禁词检测，工程师竟然使用了 String.fromCharCode() 来动态拼装这个单词。

这种充满幽默感的极客做法，在极其严肃的基础设施代码中显得别具一格。

PART.09
我们能学到什么？

THUMB
STOPPING
在短时间内连续遭遇核心模型技术文档和核心应用源码的泄露，Anthropic 在内部流程管控上的确需要做深刻检讨。但技术无罪，这份 51 万行的代码对于行业而言是一份极好的教材。

从 Claude Code 的底层设计可以看出，大模型应用层创业，单纯依靠拼凑 Prompt、堆砌向量数据库、套一个简单循环外壳的时代已经结束了。

真正的壁垒，建立在对 Token 成本的极致抠门（Prompt Cache 优化）、对多状态机协同的流式调度调度（Coordinator 与 Fork 机制）、对用户意图容错与安全干预的平衡（YOLO Classifier），以及对宿主操作系统深度的文件流集成上。

目前 GitHub 上 Fork 这些源码的仓库正面临随时被 DMCA 请求下架的风险。

但无论如何，Claude Code 展示出的工程化水平，已经为 2026 年的 AI 助理产品树立了一个全新的技术标杆。

从业者们应当趁此机会，认真审视并吸纳其中的工程化最佳实践。

https://openai.com/zh-Hans-CN/index/harness-engineering/

真正让一个团队快速迭代且不容易出错的，通常不是“大家更厉害”，而是他们把工程经验提前写进了仓库。

这两天我专门翻了一遍 Codex 的开源仓库。

一开始我也是从一个很显眼的入口进去的：

codex-rs/app-server/README.md

这个文件写得很细，已经不只是普通 README，更像一份对外协议说明书。

但继续往下看我很快发现：

如果你真的想知道 Codex 团队为什么能快速开发，光看 README 远远不够。

因为他们真正的开发方法，并不是只写在某一篇文档里，而是分散沉淀在这些地方：

• AGENTS.md
• justfile
• .github/workflows/*.yml
• docs/contributing.md
• app-server 的 schema 生成和 fixture 测试
• 大量 snapshot 测试目录
• issue / PR 模板
• Git tag 和最近提交历史
看完之后我最大的感受不是：

“OpenAI 工程师果然很强。”

而是：

他们把“如何开发”这件事，做成了一套能被仓库自动执行的系统。

也就是说，他们快，不是因为少做步骤；
而是因为很多本该靠人记住的步骤，已经被提前产品化了。

一、真正重要的不是某篇 README，而是“仓库级操作系统”
很多团队也会写文档，但问题往往是：

• 文档是文档
• 开发是开发
• CI 是 CI
• 发布是发布
这几件事彼此分离。

于是最后就会出现一个很典型的问题：

大家都知道“应该这样做”，
但实际工作里总有人忘。

Codex 仓库给我的一个很强烈的感觉是：

他们在把仓库本身做成团队的开发操作系统。

比如我看到的几个关键入口：

codex/
  AGENTS.md
  justfile
  docs/contributing.md
  .github/workflows/rust-ci.yml
  .github/workflows/rust-release.yml
  codex-rs/app-server/README.md
  codex-rs/app-server-protocol/tests/schema_fixtures.rs
  codex-rs/.config/nextest.toml
这些文件不是平级信息，而是分工非常清楚：

• README 负责解释产品和模块
• AGENTS.md 负责规定工程行为
• justfile 负责统一本地动作入口
• workflow 负责把规则变成门禁
• 测试和 schema fixture 负责验证协议与行为
• tag / release workflow 负责把交付路径标准化
这背后其实是一种非常强的工程观：

文档不是为了“看起来专业”，而是为了让下一次修改更不容易出错。

二、他们不是靠“高手自觉”，而是先把规则写死
我这次最推荐大家看的，其实不是 app-server/README.md，而是仓库根目录的 AGENTS.md。

这个文件非常像团队内部的工程宪法。

里面不是泛泛地说“注意代码质量”，而是直接写到足够可执行的粒度，比如：

• 新 API 开发优先放在 app-server v2，不要继续给 v1 扩展新表面
• Rust 模块尽量控制在 500 LoC 以下
• 文件接近 800 LoC 时，新功能优先拆新模块
• 改动用户可见 UI 时必须补 insta snapshot
• 改协议要同步更新 app-server/README.md
• 改配置结构要重新生成 schema
• 改依赖要同步更新 Bazel lockfile
• 先跑受影响 crate 的测试，再决定要不要跑全量
注意，这类规则的价值不只是“规范”。

它真正的意义在于：

团队把很多本来容易在 review 里反复讨论的问题，前移成了默认约束。

这会直接带来两个结果：

1. 讨论成本下降
如果一个团队没有明确约束，那每次改代码都要重新争论：

• 要不要拆文件？
• 这个兼容层要保留多久？
• UI 变化要不要补测试？
• API 变了要不要补文档？
这些讨论当然重要，但如果每个 PR 都重新吵一遍，迭代速度一定慢。

Codex 团队的做法很清楚：

能沉淀成仓库规则的，就不要每次临场发挥。

2. 工程风格更稳定
一个仓库真正难维护的，不是某次大改；
而是半年之后，里面同时存在五种不同的写法、三套不同的验证方式、两代没清完的兼容逻辑。

而 Codex 仓库里你能明显看到一种倾向：

他们不想让旧规则和新规则长期并存。

最近提交里就能看到很多这种标题：

• Remove legacy auth and notification handling from tui_app_server
• Remove legacy app-server notification handling from tui_app_server
• Remove smart_approvals alias migration
这说明他们不是只会“加新东西”，而是会在合适的时候主动删旧路径。

这点非常关键。

很多团队不是做不出新功能，而是旧逻辑越堆越多，最后开发越来越慢。

Codex 这套节奏更像是：

先兼容，后收口，再删除。

三、他们把“本地开发动作”做成了统一入口
很多仓库的问题不是没有工具，而是入口太散。

你问三个人怎么跑验证，可能得到三种答案：

• 有人直接 cargo test
• 有人手动跑几个 crate
• 有人只跑 lint
• 有人根本忘了 format
Codex 用 justfile 把这些动作统一了。

我看到的核心入口包括：

• just fmt
• just fix
• just clippy
• just test
• just write-config-schema
• just write-app-server-schema
• just argument-comment-lint
这里有两个很值得学的点。

1. 命令不是为了省打字，而是为了统一认知
just test 在他们仓库里并不是随便包一层，而是明确指定走：

cargo nextest run --no-fail-fast

这意味着团队已经对“默认测试执行方式”达成一致。

以后你只要说：

“本地按标准流程跑一遍。”

大家基本知道是什么意思。

2. 生成类动作被正式纳入开发流程
这点很容易被忽略。

很多团队也有 schema、fixture、generated file，但总把它们当附属品。

Codex 不是。

像下面这些动作，在他们仓库里都属于正式流程的一部分：

• 改配置 -> 写回 config.schema.json
• 改 app-server 协议 -> 重新生成 schema fixtures
• 改依赖 -> 更新 Bazel lock
这其实是在表达一件事：

生成物不是边角料，而是软件交付的一部分。

四、他们的 CI 不是“跑一堆检查”，而是按风险分层
我后来越看越觉得，Codex 这套工程方法最强的地方，不是检查多，而是检查分层非常清楚。

他们的 CI 大概可以拆成几层：

第一层：便宜、快速、广覆盖的基础门禁
比如：

• cargo fmt --check
• cargo shear
• codespell
• README ToC 检查
• ASCII/文档规范检查
• blob size policy
这些检查很快，但能挡掉很多低级问题。

第二层：静态质量与风格强约束
他们不是只跑 clippy，还做了自定义的 argument-comment-lint。

这说明一件事：

当团队发现某类问题足够高频，就不再只靠 code review 提醒，而是直接做成专门 lint。

这个习惯非常值钱。

因为很多团队 review 最耗时间的，恰恰是那些“大家都知道不太好，但又总有人写出来”的东西。

如果能把这类问题自动化，review 会轻很多。

第三层：真实测试矩阵
rust-ci.yml 里不只做 lint/build，还单独有 tests job。

而且不是随便跑一次：

• macOS
• Linux
• Windows
• x64
• arm64
• 还有一部分 Linux remote env 测试
主测试执行器走的是：

cargo nextest run --all-features --no-fail-fast

也就是说，他们追求的不是“第一个失败立刻停”，而是一次尽量收集完整信号。

第四层：改动范围感知
这一层很容易被低估，但我觉得它直接影响迭代速度。

他们在 CI 里先做 changed-path detection，然后根据改动范围决定后续 job 是否需要跑。

这背后的思路不是省机器钱这么简单，而是：

不要让每一次小改动都承担全仓库的验证成本。

这对高频提交非常关键。

五、他们真正厉害的地方，是把“契约”变成了可测试对象
很多团队也会写 API 文档。

但真正难的是：

文档、代码、生成物、客户端认知，怎么保持长期一致？

Codex 在 app-server 这块给了一个很好的答案。

我看到的链路大概是这样的：

协议类型定义
  -> 生成 TypeScript Schema
  -> 生成 JSON Schema
  -> fixture 落盘
  -> 测试校验 fixture 与生成结果一致
  -> README 同步说明行为变化
这比“写了一份 API 文档”要强很多。

因为一旦协议改了：

• 不是只改 Rust 类型
• 不是只改 README
• 不是只改客户端生成代码
而是整条链路都要一起动。

这会强迫团队面对一个现实：

接口演进从来不是单点修改，而是契约修改。

这也是为什么我现在越来越觉得，很多团队之所以越做越慢，不是因为人不够强，而是因为：

他们没有把“哪些东西必须一起变”这件事工程化。

Codex 在这里做得非常彻底。

六、他们对 UI 风险的处理方式，也很值得抄
另一个很明显的信号，是仓库里大量的 snapshots/ 目录。

尤其在 tui 和 tui_app_server 下，insta::assert_snapshot! 用得非常广。

这件事背后其实不是“喜欢 snapshot 测试”这么简单。

它背后真正的工程思想是：

只要一个改动会影响用户看到的东西，它就应该留下一个便于 review 的证据。

这点特别适合界面、终端渲染、提示文案、结构化文本输出。

因为很多 UI 回归并不是逻辑错了，而是：

• 排版变了
• 提示语变了
• 某个状态少了一行
• 某个交互覆盖了边界情况
这类问题用纯逻辑断言很难防。

而 snapshot 最大的价值就是：

它让“肉眼可见的变化”进入可比较、可 review、可回归的工程流程。

七、他们的发布，不像“打个 tag”，更像一条生产线
如果只看 README，你会以为 Codex 的交付很简单：

• npm 安装
• Homebrew 安装
• GitHub Release 下载二进制
但我把 release workflow 看完之后，感觉完全不是那么回事。

他们真正的发布链路大概是：

版本 tag 校验
  -> 多平台多架构构建
  -> 签名 / notarization / trusted signing
  -> 打包成 tar.gz / zst / dmg / zip
  -> 上传 GitHub Release
  -> 发布 npm 包
  -> 发布 WinGet
  -> 更新 latest-alpha-cli 分支
而且这里面有几个细节非常说明问题。

1. 他们有非常明显的 alpha 节奏
从本地 tag 看：

• 0.115.0 有 28 个 alpha tag
• 0.116.0 有 12 个 alpha tag
• 0.117.0 当前已有 14 个 alpha tag
这说明他们不是把所有风险都压到正式版前一刻。

相反，他们更像是在持续通过 alpha 释放变化，把真实问题前移暴露。

也就是说，他们快，不是因为“不谨慎”。

而是因为：

他们把风险分摊到了很多次小发布里。

2. 正式发布前有非常强的版本一致性校验
rust-release.yml 里会先检查：

• tag 是否满足格式
• tag version 是否等于 Cargo.toml version
这类校验看起来朴素，但能挡掉很多“最后一步翻车”的问题。

3. 交付不是单平台成功就算完
他们会构建和签名：

• macOS
• Linux
• Windows
• x64 / arm64
并且不同平台走不同的签名体系：

• Linux 走 sigstore
• macOS 做 code sign + notarization
• Windows 走 Azure Trusted Signing
这意味着他们把“能发布”定义成：

目标用户的平台真的能安装、能校验、能分发。

而不是“我本机能跑”。

八、为什么他们能快，而且不会快成一团乱麻？
我觉得答案可以浓缩成一句话：

他们把“经验”尽可能沉淀成了“默认流程”。

你会发现，Codex 仓库里有很多东西其实都在做同一件事：

• AGENTS.md：把经验写成规则
• justfile：把规则写成命令
• workflow：把命令写成门禁
• schema fixture：把契约写成测试
• snapshot：把可见变化写成证据
• alpha tag：把风险写进预发布节奏
所以他们的快，不是“大家冲得更猛”。

而是：

每次修改只需要解决这次修改本身的问题，而不用反复重新发明流程。

这对任何 AI 产品团队都很重要。

因为 AI 产品的一个典型特点就是：

• 表面变化快
• 接口变化快
• 提示和行为变化快
• 多端联动多
• 很容易一边加新能力，一边欠下兼容债
如果没有很强的工程治理，迭代速度越快，系统就越容易失控。

Codex 这套仓库给我的启发是：

真正支撑快速创新的，往往不是更松，而是更清楚。

九、如果你也在做 AI 产品，我觉得最值得抄的是这六件事
最后我不想只停留在“分析别人很厉害”。

如果把这次翻仓库的结论压缩成可执行建议，我觉得最值得抄的是下面六件事：

1. 先写仓库级规则，不要全靠 review 口头提醒
把这些问题写清楚：

• 哪些改动必须补测试
• 哪些文件不能无限长大
• 哪些协议改动必须同步更新文档和生成物
• 兼容层保留到什么阶段要删除
2. 给团队一个统一的本地入口
哪怕只是：

• fmt
• lint
• test
• write-schema
也值得做。

统一入口的价值远大于省几次键盘。

3. 能写成 lint 的问题，就别一直靠人工 review
重复出现的问题，最适合自动化。

4. UI 和协议都要做“可比较”的测试
别只测逻辑。

用户真正感知到的变化，也要被工程系统看见。

5. CI 要按风险分层，不要一上来全量轰炸
先跑便宜的，再跑重的；
先看改了哪里，再决定要跑什么。

6. 早点建立 alpha / prerelease 节奏
很多问题不是不能发现，而是发现得太晚。

预发布不是面子工程，而是风险管理工具。

十、写在最后
我本来只是想看看 Codex 的 app-server/README.md 写得为什么这么细。

结果看完一圈，真正打动我的反而不是某篇文档，而是整个仓库透露出来的一种感觉：

他们不是在“写代码”，而是在持续维护一条软件生产线。

这条生产线里，文档、命令、测试、CI、发布都不是孤立存在的。

它们共同服务于一件事：

让团队可以持续地快，同时把错误尽量挡在更靠前的位置。

所以如果你问我，这次从 Codex 仓库里学到的最重要一课是什么？

我的答案会是：

不是“怎么写出更复杂的系统”，
而是“怎么让系统在持续变化里，仍然保持可控”。

这可能才是 AI 时代最稀缺的工程能力。

单说模型的话没那么强，至少体感上Opus 4.6并没有显著强于GPT-5.4 High，但A社的产品从设计角度看很有前瞻性。

在那个还是RAG为王的背景下，Claude Code + Sonnet 3.7最先具有相对完备的agent特征，尤其在25年上半年，A社在编程自主性这一块可以说是遥遥领先。

Claude Code的出现很大程度上改变了AI编程的可用性，是第一家在产品上体现了“好马配好鞍”并且获得成功的公司。在CC出来之前，大多数人还只是听说过Cursor这类的AI编程IDE，少数人用过。用过的感受基本是小型项目还行，大型项目根本hold不住，无论是性能还是token消耗上都hold不住。

彼时围绕VS Code生态搭建的一系列插件以及另起炉灶的变种们，面临一个很重要的问题：你如何让一个大模型能精准地在一个本地代码库里去做搜索定位，并且基于定位去做增删改。

传统的RAG是条死路，撇开向量化大型代码库需要耗费的漫长时间，光是把原本代码库的层级结构切片，就很难去重构一个高效的搜索空间（因为就算你匹配到了片段，往往它也并不能解决问题，代码库里的文件大多不是独立存在的，而是还有依赖关系）。但同时你又不可能把整个代码库全都灌进当时普遍在64k-128k之间的上下文窗口里，然后指望大模型每次都能完美地执行大海捞针。

那么其中一种解决思路是索引+深度定制的RAG架构。比如Cursor背后的团队没有选择死磕本地算力，而是基于团队代码库高度同源的特点（平均92%相似度），设计了一套基于云端的安全索引复用机制。

在日常编码的增删改查中，Cursor摒弃了全局刷新。它通过默克尔树进行精准的增量比对，每次同步只传输和更新哈希值产生变化的分支，极大减少了数据传输的负担。同时，发生变更的代码会被切分为“语法分块”并在后台异步转化为向量；而未修改的代码块则直接命中缓存，免去了重复的推理计算开销。这套创新的底层架构，成功让AI大模型终于拥有了在复杂企业级代码海洋中精准“捞针”的能力。（对，Cursor虽然不是传统RAG但本质上还在死磕大海捞针）


图源：https://cursor.com/blog/secure-codebase-indexing
当开发者在大型项目中启动Cursor时，客户端会通过计算代码库的默克尔树（Merkle tree）生成一个“相似度哈希（simhash）”。服务器端利用这个特征向量，匹配并直接复用团队内部已存在的最佳索引，同时允许客户端在这个后台拷贝的过程中立刻发起语义搜索。

为了解决复用别人索引可能带来的代码泄露与越权访问风险，Cursor创造性地引入了内容访问证明（Proving access）机制：客户端必须上传完整的哈希树，服务器在返回搜索结果前会进行严格的比对校验；如果客户端无法通过哈希值证明本地实际拥有该文件，包含该文件的搜索结果就会被直接拦截并丢弃。


图源：https://cursor.com/blog/secure-codebase-indexing
这一套打法确实从某种程度上让AI编程工具达到了可用的标准，在工程实践上也很有巧思，但它更像是一套严谨的工作流框架，而非依靠大模型本身的自主和智能。当时我用Cursor的体验就是模型只是在既定的框架下做有限的动作，而驾驭这辆马车不跑偏不翻车还需要高强度的人机交互，我需要看diff，要review和approve，并且每次都是这样，在心力消耗上并不小。

相比之下，A社推出的 Claude Code 则走了一条截然不同的道路。它放弃了在 IDE 里做重度定制的“微操”与“死磕”，而是选择回归开发者最初始、也最硬核的形态——命令行（CLI），从而真正将大模型的能力推向了“agent”的完全体。


图源：https://www.anthropic.com/news/claude-3-7-sonnet
形态上的差异，直接带来了自主性的云泥之别。

在 Cursor 里，出于对大模型胡乱改代码的担忧，开发者往往不敢轻易开启完全放任的模式，只能手动逐一审查并批准每一个动作。 Claude Code 极其聪明地设计了“渐进式授权”机制。当它提出要执行命令或修改时，不只有“是”和“否”，还有一个极其关键的选项——“是，并且下次执行此类操作时不再询问”。


图源：https://www.anthropic.com/engineering/claude-code-sandboxing
这种设计让大模型像一个真实的人类实习生一样：刚开始你盯着它做，随着它一次次展示出正确的操作，它就在“赚取”你的信任 。最终，你可以彻底放权，让它真正实现完全的自主运行，而不是让你持续充当一个微观管理者。

在跑测试和进行版本控制时，Claude Code 的终端原生属性让它如鱼得水。它能极度自然地运行终端命令来执行测试，并根据测试反馈毫无摩擦地自主迭代修复代码。

除了写代码，Claude Code 的设计格局远超传统编码工具——它允许使用者将 AI 从“一问一答的问答机”变成“可复用的系统”。用户可以用极其轻量的 Markdown 文件为它设定上下文和指令，并自定义专属的斜杠命令。

至于后面更新版本里的sub-agents多路并行更是又往前了一大步。每个 agent 都有独立的上下文窗口，互不干扰且同速推进。这直接将原本线性的开发时间降维压缩，实现了效率的成倍增长。

agentic coding的成功不能只归功于模型的进步，它背后是运行环境、工具调用、权限管理等多个因素叠加带来的胜利。


图源：https://russellluo.com/2025/09/demystifying-claude-code-agentic-coding
今天A社能在编程领域拥有如此出众的声誉成为诸多友商的对标竞品，离不开它的产品背后的设计思维一直在尝试推动模型之外的边界，Claude Code是这样，Claude Cowork上也有类似的影子。




你现在看到的，是《Agent编程：从原理到生产级实践》公众号连载的第 03 篇。前两篇我们讲了编程范式的迁移，以及 Claude Code 的工程架构。这篇我们要进入一个更本质的问题：Agent 编程和传统编程到底有什么不同？需要建立什么样的新思维模型？如果你还在用"把 Prompt 写得更精致"的思路做 Agent，可能会发现天花板很快就到了。真正的问题不是 Prompt 不够好，而是思维方式没有转变。正文编程思想要点：Agent 编程不是"用 AI 写代码"，而是一种全新的编程范式——你不再编写执行步骤，而是定义能力边界和意图空间。很多团队做 Agent 时，最大的误区是用传统编程的思维写 Prompt。他们试图把每一个步骤都写清楚，把每一个边界条件都预设好，把每一个错误处理都考虑周全。结果 Prompt 越来越长，系统越来越复杂，但效果却没有线性提升。问题出在哪？Agent 编程的本质变化是：决策权开始从程序员转移到 AI。这意味着你需要建立新的思维模型——目标如何表达、上下文如何设计、工具如何编排、人机如何协作。3.1 工具即接口：传统 API vs Agent 工具在传统编程中，接口（Interface）是程序员之间的契约。在 Agent 编程中，工具（Tool）是人与 AI 之间的契约。这个看似微小的转变，实际上是一场认知革命。3.1.1 传统 API 的设计哲学传统 API 设计遵循几个核心原则：// 传统 API 设计interface FileService {  read(path: string): Promise<string>;  write(path: string, content: string): Promise<void>;  edit(path: string, oldText: string, newText: string): Promise<void>;  delete(path: string): Promise<void>;  list(dir: string, pattern?: string): Promise<string[]>;}核心假设：调用者知道要做什么：程序员预先决定调用哪个方法、传什么参数接口是稳定的：方法签名不应该频繁变化错误是异常的：预期路径上不应该出错粒度是固定的：每个方法做一件事这是一种命令式接口——你告诉系统确切地做什么。3.1.2 Agent 工具的设计哲学现在看看 Claude Code 如何定义同样的文件操作工具：// Claude Code 的 Agent 工具定义interface FileEditInput {  /** The absolute path to the file to modify */  file_path: string;
  /** The text to replace */  old_string: string;
  /** The text to replace it with (must be different from old_string) */  new_string: string;
  /** Replace all occurrences of old_string (default false) */  replace_all?: boolean;}interface FileReadInput {  /** The absolute path to the file to read */  file_path: string;
  /** The line number to start reading from */  offset?: number;
  /** The number of lines to read */  limit?: number;
  /** Page range for PDF files (e.g., "1-5", "3", "10-20") */  pages?: string;}表面上看，这与传统 API 没有太大区别。但关键的差异在于谁决定使用这些工具：传统 API：程序员在代码中调用 fileService.edit(path, old, new)Agent 工具：AI 根据用户意图自主决定调用 FileEdit，并自己构造参数源码透视：工具描述的重要性在 Agent 编程中，工具的文档描述比类型签名更重要。因为 AI（而不是程序员）是工具的使用者，它通过阅读描述来理解何时、如何使用工具。从 sdk-tools.d.ts 中可以看到，每个字段都有详细的 JSDoc 注释：interface BashInput {  /** The command to execute */  command: string;
  /**   * Clear, concise description of what this command does in active voice.   *   * For simple commands (git, npm, standard CLI tools), keep it brief:   * - ls → "List files in current directory"   * - git status → "Show working tree status"   *   * For commands that are harder to parse at a glance:   * - find . -name "*.tmp" -exec rm {} \; → "Find and delete all .tmp files"   */  description?: string;
  /** Set to true to run this command in the background */  run_in_background?: boolean;
  /**   * Set this to true to dangerously override sandbox mode   * and run commands without sandboxing.   */  dangerouslyDisableSandbox?: boolean;}注意 description 字段的注释——它不仅说明了字段的作用，还给出了使用示例和最佳实践。这是因为 AI 需要足够的上下文来正确使用这个工具。再注意 dangerouslyDisableSandbox 字段的命名——使用了 "dangerously" 前缀。这不是随意的命名，而是对 AI 的一种软约束。当 AI 看到这个名字时，它会倾向于不使用这个选项，除非用户明确要求。FileEdit 工具是最le.write(path, content)——完全覆盖文件。它是一个差异编辑器：interface FileEditInput {  file_path: string;    // 绝对路径  old_string: string;   // 要替换的原始文本  new_string: string;   // 替换后的新文本  replace_all?: boolean; // 是否替换所有匹配}为什么是差异编辑而不是全文件覆盖？三个原因：精确性：AI 只修改它确定需要修改的部分，而不是重写整个文件安全性：如果 old_string 不匹配，操作会失败，防止意外覆盖可审计性：每次修改都有明确的 before/after，便于审查这是一种微创手术式的设计哲学——最小化每次变更的影响范围。对于 AI Agent 来说，这尤为重要，因为它的操作需要人类的信任。源码透视：子 Agent (AgentInput) 的设计最令人惊叹的工具设计是 AgentInput：interface AgentInput {  /** A short (3-5 word) description of the task */  description: string;
  /** The task for the agent to perform */  prompt: string;
  /** The type of specialized agent to use */  subagent_type?: string;
  /** Model override: "sonnet" | "opus" | "haiku" */  model?: string;
  /** Run in background */  run_in_background?: boolean;
  /** Name for the spawned agent */  name?: string;
  /** Team name */  team_name?: string;
  /** Permission mode */  mode?: "acceptEdits" | "bypassPermissions" | "default" | "dontAsk" | "plan";
  /** Isolation mode */  isolation?: "worktree";}这是一个嵌套 Agent 的接口——Agent 可以创建子 Agent 来执行子任务。这种递归的设计体现了 Agent 编程的核心思想：分解与委托。特别注意几个设计亮点：isolation?: "worktree"：子 Agent 在独立的 Git worktree 中工作。这意味着它可以自由修改文件，而不会影响主分支。这是一种沙盒隔离——AI 版本的"影子构建"。mode 参数的五种权限级别："acceptEdits"：自动接受文件编辑"bypassPermissions"：绕过所有权限检查"default"：默认权限模式"dontAsk"：不询问用户"plan"：只生成计划，不执行model 参数：允许为不同任务选择不同能力的模型。简单任务用 haiku（快且便宜），复杂任务用 opus（慢但能力强）。3.2 推理即执行：Extended Thinking 与自适应计算传统程序的计算量是可预测的——排序 O(n log n)，搜索 O(n)，矩阵乘法 O(n³)。Agent 编程的计算量是自适应的——简单问题快速回答，复杂问题深度思考。3.2.1 Extended Thinking：让 AI "想一想"Anthropic 的 Extended Thinking（扩展思考）功能是 Claude Code 的重要基础。它允许模型在生成最终答案之前进行内部推理。从 Claude Code 的源码中可以看到与 thinking 相关的多个字段：// Vj7() 状态中的 thinking 相关字段{  thinkingClearLatched: null,      // Thinking 清除状态  systemPromptSectionCache: new Map() // 缓存 thinking 结果}以及 MessageStream 中对 thinking 事件的处理：// MessageStream 事件类型case "thinking_delta":  // 接收增量思考内容  if (block.type === "thinking")    message.content[index] = { ...block,      thinking: block.thinking + delta.thinking };  break;
case "signature_delta":  // 接收思考签名（完整性校验）  if (block.type === "thinking")    message.content[index] = { ...block, signature };  break;Extended Thinking 的工作原理：用户提问 → Claude 开始"思考"（不可见） →思考完成（thinking 块） → 生成最终答案 →调用工具 → 获取结果 → 可能再次"思考" → ...每个 thinking 块都有一个 signature（签名），用于验证思考过程的完整性。这是一种链式完整性保证——确保思考内容没有被篡改。3.2.2 自适应思考：thinking_budgetClaude Code 支持自适应思考预算——根据任务复杂度动态调整思考深度。从 Vj7() 状态中可以看到：{  promptCache1hEligible: null,      // 1小时缓存资格  promptCache1hAllowlist: null,     // 缓存白名单  afkModeHeaderLatched: null,       // AFK 模式标记  fastModeHeaderLatched: null,      // 快速模式标记}fastModeHeaderLatched 字段特别有趣——它指示 Claude Code 是否应该使用"快速模式"。在快速模式下，Claude 可能会减少思考时间、使用更小的模型、或跳过某些验证步骤。这是一种计算预算管理——类似于游戏引擎中的 LOD（Level of Detail）系统，根据场景复杂度动态调整渲染精度。Claude Code 根据当前模式（快速/正常/深度）来调整计算精度（思考时间/模型大小/验证级别）。3.2.3 Prompt Cache：1小时窗口Anthropic 的 Prompt Cache 是一个性能优化特性——它允许缓存 System Prompt 和对话历史，避免每次 API 调用都重新发送。Claude Code 的实现：{  promptCache1hEligible: null,    // 当前请求是否符合 1h 缓存条件  promptCache1hAllowlist: null,   // 允许使用 1h 缓存的内容白名单}promptCache1hAllowlist 是一个精心维护的列表——只有被列入白名单的 System Prompt 段才能享受 1 小时缓存。这是因为缓存需要内容完全匹配，任何变化都会导致缓存失效。Claude Code 的 System Prompt 是动态构建的（如我们在第2章所见），但某些部分是稳定的——比如工具定义、代码规范、安全规则。这些稳定部分被列入缓存白名单，而动态部分（如 MCP 服务器指令、项目特定信息）则不缓存。这种选择性缓存策略是在性能和灵活性之间的精妙平衡：缓存的内容（稳定）          不缓存的内容（动态）├── 工具定义               ├── MCP 服务器指令├── 代码规范               ├── 项目结构信息├── 安全规则               ├── 用户偏好└── 基础上下文             └── 会话状态设计思想：推理即执行Extended Thinking 和 Prompt Cache 共同体现了一个核心设计哲学：推理即执行。在传统编程中，"推理"和"执行"是分开的：编译器推理类型，运行时执行代码优化器推理性能，CPU 执行指令测试框架推理正确性，部署系统执行发布在 Agent 编程中，"推理"和"执行"融为一体：AI 的思考过程就是它的执行过程工具调用是思考的延续，而不是独立步骤上下文管理既是推理策略，也是执行优化这意味着你不能将推理和执行分开优化。提高思考质量会直接提高执行质量，提高执行效率会释放更多计算资源给推理。3.3 反馈即控制：权限模式与交互设计在传统编程中，控制流由代码决定。在 Agent 编程中，控制流由人机交互决定。Claude Code 提供了一套精密的权限和交互系统。3.3.1 六种权限模式从 AgentInput 的 mode 字段中，我们已经看到了五种权限级别。加上默认的交互模式，Cla Code 实际上支持六种权限模式：模式描述适用场景default默认交互模式，每步询问用户首次使用、敏感操作acceptEdits自动接受文件编辑信任度高的批量重构bypassPermissions绕过所有权限检查CI/CD、自动化流水线dontAsk不询问用户，自动执行非交互式（SDK 模式）plan只生成计划，不执行需要预审的场景auto自动模式，平衡安全与效率日常开发从 Vj7() 状态中可以看到相关的控制字段：{  sessionBypassPermissionsMode: false,   // 会话级权限绕过  hasExitedPlanMode: false,              // 是否已退出计划模式  needsPlanModeExitAttachment: false,    // 是否需要计划模式退出附件  needsAutoModeExitAttachment: false,    // 是否需要自动模式退出附件}源码透视：模式切换的状态机模式之间的切换不是简单的标志位翻转，而是一个状态机：// 计划模式转换处理function handlePlanModeTransition(currentMode, newMode) {  if (newMode === "plan" && currentMode !== "plan") {    G8.needsPlanModeExitAttachment = false;  }  if (currentMode === "plan" && newMode !== "plan") {    G8.needsPlanModeExitAttachment = true;  }}
// 自动模式转换处理function handleAutoModeTransition(currentMode, newMode) {  if (currentMode === "auto" && newMode === "plan" ||      currentMode === "plan" && newMode === "auto") {    return; // plan ↔ auto 是直接切换  }
  let wasAuto = currentMode === "auto";  let isAuto = newMode === "auto";
  if (isAuto && !wasAuto) {    G8.needsAutoModeExitAttachment = false;  }  if (wasAuto && !isAuto) {    G8.needsAutoModeExitAttachment = true;  }}这些状态转换确保了：从计划模式退出时，计划内容会被正确附加从自动模式退出时，操作历史会被保留模式切换的"附件"（attachment）机制确保信息不丢失3.3.2 计划模式（Plan Mode）计划模式是 Claude Code 最独特的设计之一。在这种模式下，AI 只生成计划而不执行——它分析问题、分解任务、规划步骤，但不会触碰任何文件或运行任何命令。计划模式的价值：信任建立：在执行前让用户审查 AI 的思路成本控制：规划比执行便宜（不需要工具调用）并行规划：可以同时让 AI 规划多个方案从 ExitPlanModeInput 的定义中可以看到计划模式的退出机制：interface ExitPlanModeInput {  /**   * Prompt-based permissions for plan execution.   * These describe categories of actions rather than specific commands.   */  allowedPrompts?: {    /** The tool this prompt applies to */    tool: "Bash";    /** Semantic description, e.g. "run tests", "install dependencies" */    prompt: string;  }[];}注意 allowedPrompts 的设计——它不是列出具体的命令（如 npm test），而是语义描述（如 "run tests"）。这是 Agent 编程特有的设计：你描述意图，AI 理解意图。3.3.3 用户交互工具：AskUserQuestionClaude Code 提供了一个专门的工具来与用户交互：interface AskUserQuestionInput {  questions: [    {      question: string;       // 问题文本      header: string;         // 短标签（最多12字符）      options: [              // 2-4个选项        {          label: string;           // 选项标签          description: string;     // 选项描述          preview?: string;        // 可选的预览内容        }      ];      multiSelect: boolean;   // 是否多选    }  ];}这个工具的设计有几个值得注意的细节：结构化输入：不是自由文本问答，而是结构化的选择题。这确保了 AI 能正确解析用户的回答。preview 字段：选项可以附带预览内容。例如，当选择不同的重构方案时，可以预览重构后的代码。multiSelect 支持：允许多选，适用于"你想要启用哪些功能？"这类问题。1-4 个问题限制：一次最多问 4 个问题，避免信息过载。2-4 个选项限制：每个问题 2-4 个选项，加上自动提供的"Other"选项。设计思想：人机协同的控制论Claude Code 的权限系统体现了人机协同控制论的核心理念：控制不是二元的：不是"人类控制一切"或"AI 自主一切"，而是连续的权限光谱信任是渐进的：从 plan（不执行）到 default（逐步确认）到 auto（自动执行）干预是精确的：通过 allowedPrompts 可以精确控制 AI 在执行阶段能做什么可审计性：每个决策都有记录（modelUsage, totalCostUSD 等）3.4 编写 Agent 代码的思维模型理解了 Claude Code 的架构和工具设计之后，我们最后来探讨一个更深层的问题：编写 Agent 系统需要什么样的思维模型？3.4.1 从"写步骤"到"描述意图"传统程序员习惯于写步骤：# 传统思维：我需要告诉计算机每一步做什么def deploy_service():    # 1. 检查环境    if not os.path.exists("Dockerfile"):        raise FileNotFoundError("Dockerfile not found")
    # 2. 构建镜像    subprocess.run(["docker", "build", "-t", "myapp", "."])
    # 3. 停止旧容器    subprocess.run(["docker", "stop", "myapp-container"])
    # 4. 启动新容器    subprocess.run(["docker", "run", "-d", "--name", "myapp-container", "myapp"])
    # 5. 健康检查    for i in range(30):        response = requests.get("http://localhost:8080/health")        if response.status_code == 200:            break        time.sleep(1)    else:        raise TimeoutError("Health check failed")Agent 编程者写意图：# Agent 思维：我需要告诉 AI 我想要什么结果claude "帮我部署这个应用到 Docker，确保新容器启动后健康检查通过再停止旧容器"这个转变不只是在语言层面的——从 Python 到自然语言。更根本的是思维方式的转变：维度步骤思维意图思维关注点怎么做做什么错误处理预定义所有错误路径让 AI 自适应处理边界条件显式检查上下文推断抽象层级固定（一个函数做一件事）动态（AI 根据任务调整）验证单元测试人工审查 + AI 自检3.4.2 从"防御性编程"到"信任性编程"传统编程强调防御性编程——假设一切都会出错：# 防御性编程def parse_config(path):    if not isinstance(path, str):        raise TypeError("path must be a string")    if not os.path.exists(path):        raise FileNotFoundError(f"Config file not found: {path}")    if not os.access(path, os.R_OK):        raise PermissionError(f"Cannot read config file: {path}")
    content = open(path).read()    if not content.strip():        raise ValueError("Config file is empty")
    config = json.loads(content)    if "version" not in config:        raise KeyError("Config missing 'version' field")    # ...Agent 编程更接近"信任性编程"——假设 Agent 有基本的判断能力：# 信任性编程claude "读取 config.json 并根据配置初始化应用，如果配置有问题就告诉我"这不是放弃验证，而是转移验证的责任——从程序代码转移到 Agent 的推理过程。Agent 会检查文件是否存在、内容是否合法、配置是否完整，因为它被训练为这样做。3.4.3 从"确定性"到"概率性"思维也许这是最难适应的转变：传统程序员期望确定性——相同的输入总是产生相同的输出。Agent 编程本质上是概率性的——即使相同的输入，AI 也可能做出不同的决策。这并不意味着 Agent 编程是不可控的。Claude Code 通过多个机制来管理不确定性：工具约束：工具的输入输出类型是确定的，AI 只能在工具提供的接口内操作权限模式：通过权限级别控制 AI 的自主程度成本追踪：通过 token 和费用追踪来监控 AI 的行为会话审计：所有操作都有日志，可以事后审查源码透视：不确定性管理从 Vj7() 的状态设计中可以看到不确定性管理的多个层次：{  // 第一层：操作审计  totalLinesAdded: 0,           // 追踪所有变更  totalLinesRemoved: 0,  totalToolDuration: 0,
  // 第二层：成本控制  totalCostUSD: 0,              // 花费上限  modelUsage: {},               // 按模型追踪
  // 第三层：行为监控  inMemoryErrorLog: [],         // 错误日志  slowOperations: [],           // 慢操作检测  lastAPIRequest: null,         // 最后一次 API 请求
  // 第四层：用户控制  isInteractive: false,         // 交互/非交互模式  sessionBypassPermissionsMode: false,  // 权限绕过  hasExitedPlanMode: false,     // 计划模式控制}每一层都是对不确定性的一个约束——操作审计告诉你"发生了什么"，成本控制告诉你"花了多少"，行为监控告诉你"是否异常"，用户控制让你"可以干预"。3.4.4 一个完整的思维模型转换案例让我们通过一个完整的案例来感受思维模型的转变。任务：为一个 Express.js 项目添加 rate limiting 中间件。传统思维（步骤化）：// 1. 安装依赖// npm install express-rate-limit
// 2. 创建中间件const rateLimit = require('express-rate-limit');
const limiter = rateLimit({  windowMs: 15 * 60 * 1000, // 15 分钟  max: 100, // 每个 IP 限制 100 次请求  message: 'Too many requests from this IP'});
// 3. 应用到路由app.use('/api/', limiter);
// 4. 添加错误处理app.use((err, req, res, next) => {  if (err.type === 'entity.too.large') {    return res.status(413).json({ error: 'Request body too large' });  }  next(err);});
// 5. 编写测试// test/rate-limit.test.js// ...Agent 思维（意图化）：claude "为这个 Express.js API 项目添加 rate limiting，要求：- 每个 IP 每15分钟最多100次请求- 对 /api/ 路径生效- 添加适当的错误处理- 更新 README 说明这个新功能"注意区别：传统思维需要知道：express-rate-limit 的 API、中间件的顺序、错误处理的最佳实践Agent 思维只需要知道：业务需求（100次/15分钟）、适用范围（/api/）、期望输出（README 更新）传统思维的验证方式：编写单元测试Agent 思维的验证方式：AI 自动测试 + 人工审查代码变更传统思维的修改方式：找到相关代码，手动修改Agent 思维的修改方式：告诉 AI "把限制改成 200 次"，AI 自动找到并修改相关代码3.4.5 Agent 编程的"四象限"思维最后，我提出一个 Agent 编程的"四象限"思维模型：              明确意图                │    ┌───────────┼───────────┐    │  象限 I    │  象限 II   │    │  脚本化    │  委托化    │    │           │           │    │  传统编程  │  Agent编程 │    │  的最佳区  │  的最佳区  │    │  域        │  域        │隐 │           │           │含 │───────────┼───────────│知 │  象限 III  │  象限 IV   │识 │  探索化    │  协同化    │    │           │           │    │  Agent    │  人类+Agent    │  独立探索 │  深度协作  │    │           │           │    └───────────┼───────────┘                │              模糊意图象限 I（明确+隐性）：传统编程的最佳领域。明确的步骤，隐含的细节。比如实现一个排序算法。象限 II（明确+显性）：Agent 编程的最佳领域。明确的意图，显式的约束。比如"重构认证模块为 JWT"。象限 III（模糊+隐性）：Agent 独立探索的领域。模糊的目标，隐含的需求。比如"优化这个项目的性能"。象限 IV（模糊+显性）：人类+Agent 深度协作的领域。模糊的愿景，但需要精确执行。比如"设计一个新功能"——愿景模糊，但最终代码需要精确。优秀的 Agent 编程者知道什么时候用哪个象限的思维：确定性逻辑 → 象限 I（直接写代码）明确需求 → 象限 II（委托给 Agent）探索性问题 → 象限 III（让 Agent 先探索，再审查）复杂设计 → 象限 IV（与 Agent 协同完成）本篇你可以带走的三个判断Agent 编程的核心是"目标驱动"而非"步骤驱动"你不是在写步骤，而是在描述意图、约束和验收标准。Agent 会自己规划路径。上下文工程比 Prompt 工程更重要给 Agent 什么上下文、什么工具、什么权限，比 Prompt 怎么写更决定成败。Agent 系统的设计要从"函数调用"转向"协作协议"你不是在调用一个函数，而是在和一个数字同事协作。需要设计的是协作机制，而不仅仅是接口。下一篇预告下一篇我会继续拆一个更基础的问题：什么才是真正的 AI Agent？一篇讲清定义、特征与边界我们将讲清楚 Agent 的五个核心要素、四大核心能力，以及它与 Chatbot、自动化脚本、工作流的本质区别。如果你准备系统追这套连载，建议关注这些后续主题：构建一个 Agent 到底需要哪些核心组件Function Calling 为什么是 Agent 爆发的关键一跃Agent 为什么总是"失忆"ReAct、ToT、规划式 Agent 有什么区别如果这篇对你有启发，欢迎把它转给正在做 Agent、AI 应用或者开发工具的朋友。来源说明《Agent编程：从原理到生产级实践》原作者：Hertz
 公众号编辑、整理、校对：社恐患者杨老师如果你想系统阅读整套教程，可以直接访问：


## 2026-03-24

### 观察到一些做产品好的workflow
用画面化的语言把产品说清楚：https://www.xiaohongshu.com/explore/68fce73400000000050309b3?xsec_token=AB3KSRlbLkhfqEUgqtdRiZAenwBoovgPwpL9aKayzRx58=&xsec_source=pc_user
做语音产品重要的是eval，但是eval重要的是指标，什么样的指标有效， 不一定是CER， 但是一定要最符合产品方向，比如下面这篇文章的标注规则是asr输出加用户修改的diff，这是针对桌面语音输入这类产品，针对我们产品，我们不同的功能呢？
产品提升闭环: diff->llm生成改进建议/实施代码改进---》验证是否提升--->>应用 
https://www.xiaohongshu.com/explore/69bfce9c0000000023013f54?xsec_token=ABz2C3Hd9O7N3LIWCL0wxAhXfNFOqkAeKXZcqJoRrwT24=&xsec_source=pc_collect

稍微好一些的产品 开源的代码 一般不包括服务端是吗（网页/app/桌面/web app）大部分是终端是吗？
关系化， 人性， 实际问题
agent页/小社交页  记忆/个性化编辑页 训练反馈页
这是我昨天记录的， 但是这是更偏底层的一些逻辑
### 先列我观察到产品的一些优点和问题吧。
 这就涉及到了这个产品的目的和设计理念，我们最终希望做一个帮助用户能够主动发声的产品，用户的发音不清是客观存在的， 我们的产品一定要解决用户的实际问题， 让用户感觉到被支持。 但是肯定不能出现用户使用了这个产品， 反而有了更多的社交压力。所以我们希望做一个不起眼的可以真正支持到用户的一个产品， 一个用户的助手/老朋友
 这是整个产品的核心目标， 现在前端页面分为沟通， 记忆， 数据收集/训练反馈，这样似乎也无可厚非
优点应该是前端页面划分还比较准确 训练语料比较充足
缺点是前端页面根本不像真正的产品，而是说明书，用户根本不好用， 就是没有重点 也没有设计， 需要按照我们的目标，借助设计学，心理学， 工程学真正做成一个产品，解决用户实时沟通问题， 最终让用户可以主动发声，享受沟通乐趣的文章
如果这个产品最终形态是web加app加硬件， 现在开始该怎么设计，留下口子，硬件大概率就是录音和扬声器功能  web和app是否要做得差不多，因为我们是先做web，再做app。 那三个页面的终局是什么？
实时沟通--->能够检测到对话，并且随时插话， 那么就需要把用户的不清晰语音变成清晰语音，或者针对某个场景表达出更合适的说法，那么就需要用户能够提前定义场景，一起规划练习----->最简单的就是帮助用户开口第一句话，或者紧急的情况。 喔喔对了这个页面前端的场景模板是不能用的， 这个问题需要修复。但是现在前端这个页面的几个双行语境， 场景模板这些功能根本就不能真正解决用户问题， 或者没有好好想想到底怎么做好这个实时沟通，翻译页面（因为有可能失聪也需要这个产品，听不到也就说不清楚， 但是要分清主次）那么怎么能够真正帮助到用户实时沟通， 怎么让用户感受到，怎么模型精度变好，我们前端效果就可以变得更好， 充分发挥各种模型的能力。 其实应该还有一个复盘功能， 我们的用户在和外界聊了一天， 我们能不能主动发现用户的需要情绪支持或者沟通复盘的需求，并且基于这些需求，以类似的角色和用户进行语音沟通， 实时练习反馈， 但是这个应该放在记忆页还是沟通页，应该还是沟通页，需要讨论一下。 还有克隆保留用户语音或者编辑用户语音，这个应该放在记忆页或者沟通页，类似的功能。  那么怎么处理长视频， 或者什么多人对话，对话轮次能不能处理好

然后数据录入页训练页，这也是我们初期的重点，要能够收集高质量数据， 高质量标注，存储，才能进行模型迭代， 我看oss里面存的是webm， 好像没有看到标注，需要检查这种数据是否能真的参与模型训练。 然后就是用户愿意提供数据， 为什么愿意提供，让用户感到这些数据是有用的，读起来是不累的。 然后是每录入一个数据的反馈， 让用户尽量可以及时看到自己的录得数据究竟是怎么样的， 有让用户容易操作的建议， 当然还可以想想围绕这个目的需要的其他功能。   这个页面的终局是什么呢， 或者本质是什么呢？是获得有标注的数据，并且给用户反馈， 那么是不是这些结合起来， 让用户可以自主录取数据，主动标注，主动检查质量 

第三个就是记忆页， 他的作用是什么？ 可以通过记忆让对话agent提高用户个性化识别率，或者满足用户需求成功率。可以通过记忆分析训练结果，动态更新训练目标，训练语料
训练计划， 提高数据录入的代表性，效率和趣味性。那么这个页面要怎么设计， 要给与用户多高的权限，应该主动让用户编辑什么，甚至设计一些典型场景经验 甚至设计skill。都可以探索。 
然后主动性agent，主动询问好就做，怎么做，或者接入openclaw类似的接口，通过梳理用户的一天的对话，主动配合用户计划，制定， 完成一些需求
然后记忆系统， agent架构替换， 工具已经在其他文档通过。
以上哪些优先级别最高，哪些根本不值得做，那些功能没有想到

### 下面是一些竞争产品的描述和想法， 我并不是希望照抄他们的功能，我只是希望明确我们产品的核心功能，边界和迭代方向， 作为CEO, 产品总监， 技术总监三位一体怎么把这个产品做成一个好产品， 分析他们的核心,他们的优势劣势，看看他们是怎么长成一个比较成熟的产品的。
小南听说， 雀说语训康复方法研究 ---- 功能交付---》结果交付。 ADHD， 社交困难的本质，听和说的关系， 产品的边界
https://www.nanstech.com/yanyuyuyanpingguyuxunlianxitong.html 上面是小南听说的网页

随着AI技术的广泛应用，催生了很多新型智能设备，AI录音卡即是其中之一。其采用了卡片式设计，体积轻薄，便于随身携带，还支持磁吸功能，能够吸附到手机上采集手机音频。搭配AI大模型，该设备能够实现录音实时转文字、重点摘要总结以及翻译等功能，为用户高效办公提供强大助力。
DingTalk A1钉钉AI办公小助理即是一款AI录音卡设备，同时也是钉钉首款AI硬件。在功能配置方面，该产品搭载6麦克风阵列（5颗全向麦+1颗骨传导麦），支持多通道AI语音增强技术，带来360°全方位清晰拾音。还支持自动切换环境/通话录制，使用更加方便快捷。
DingTalk A1搭载DingTalk AI小助理，可把语音内容转换成文字，并进行总结分析，实现快速提炼要点、生成纪要、列出行动清单等；还支持实时翻译和多语种互译，跨语言沟通更方便。此外，产品内置30多种AI场景化分析模板，可以对语音进行针对性的分析总结；能够与钉钉功能协同，快速生成日程、待办甚至AI表格等。下面就来看看这款产品的详细拆解报告吧~

这是钉钉talk的产品构想


plaud结合web, app， webAPP  把多端都打通了， 这个充满意义

https://www.plaud.ai/blogs/news/plaud-intelligence-3-0-launch
很多做 AI 的人，恨不得让机器接管一切，让机器成为主角。但作为一个真正经历过沟通困境的人，我的期望恰恰相反
2023年：Plaud.ai 创立与 Plaud Note 首次亮相
2023年，Plaud.ai 在美国特拉华州注册成立，总部设在旧金山，并陆续在新加坡、东京、深圳、西雅图和北京等地设立办公室，围绕“Amplify human intelligence（放大人类智能）”这一使命，专注通过硬件与软件结合的方式，把人们在会议、访谈与日常交流中的对话转化为可行动的洞见。
同年 6 月，Plaud 发布首款旗舰产品 Plaud Note，这款接近信用卡尺寸的 AI 录音与记要设备，主打“一键录音、自动转写与智能总结”，帮助专业人士在开会时专注于交流本身，把记录和整理的工作交给 AI；短时间内便取得超过千万美元的销售额，为品牌后续发展打下了坚实基础。
2024年：Plaud Web 上线，多终端协同管理对话资产
进入 2024 年，Plaud 在移动应用的基础上正式推出桌面端入口 Plaud Web，让用户在电脑浏览器中即可查看录音、编辑转写文本、整理会议纪要和行动项，实现手机与 PC 之间的无缝切换，大幅提升跨设备的知识管理效率。
借助 Plaud Web 与 App 的联动，越来越多团队开始把 Plaud 作为会议后的“默认工作流”：线下或线上交流结束后，录音会自动被上传、转写并摘要，团队成员可以快速统一认知、分配任务，使对话真正沉淀为长期可检索、可复用的知识资产。
2024年前后：可穿戴 NotePin 拓展更多使用场景
在 Plaud Note 获得广泛认可之后，Plaud 推出可穿戴形态的 NotePin，把 AI 录音与转写能力做成可以夹在衣物上、或佩戴在腕带上的小型设备，让用户在课堂、研讨会甚至走路思考时，都可以自然地记录下关键想法与对话细节。
NotePin 的出现，使 Plaud 从“会议录音器”扩展为覆盖日常生活与工作全场景的语音采集入口，用户只需佩戴设备即可安心地参与交流，事后通过 App 或 Web 端回顾、检索与重组信息，极大释放了人的注意力与创造力。
2025年：Plaud Note Pro 发布，硬件与 AI 全面升级
2025 年，Plaud 面向专业用户发布新一代旗舰设备 Plaud Note Pro，在保持卡片式轻薄设计的同时，引入 1 英寸屏幕与四颗高精度麦克风，能够在大约 5 米范围内稳定拾音，并更好地区分环境噪声与人声，让会议与课堂录音更加清晰可靠。
Note Pro 支持在电话和面对面会议之间自动识别和切换录音模式，省去了早期产品需要手动拨动实体开关的步骤；同时加入“按键高亮”功能，用户在关键片段轻按设备即可做标记，之后由大模型在转写与总结时优先关注这些重点内容，大幅提升长时会议的整理效率。
2025年：全球化加速，与 AWS 建立战略合作
随着产品线的丰富与口碑扩散，截至 2025 年中，Plaud 系列设备累计在全球部署超过一百五十万台，服务的专业人士遍布北美、欧洲与亚洲等地区，官网也以“全球第一的 AI 记要品牌”为定位，显示出其在细分领域内快速跃升为头部玩家的雄心与信心。
同年 12 月，亚马逊云科技在 re:Invent 大会上正式宣布 Plaud 成为其在 AI 会议智能方向的战略合作伙伴。借助 AWS 的全球云基础设施与 Amazon Bedrock 等服务，Plaud 将跨区域访问延迟显著降低，同时在数据加密与合规性方面获得更强保障，使企业级用户在享受实时转写与智能总结时也能放心地托付敏感会议信息。
2025年：接入新一代多模态大模型，深化“智能工作拍档”定位
在软件与算法层面，Plaud 持续在 App 与 Web 中引入新一代多模态大模型能力，陆续支持包括 Gemini 3 Pro 与 GPT-5.1 在内的主流模型，让会议纪要不仅转写更准确、摘要更紧凑，也能更好地理解上下文与图文信息，实现对话、文档甚至图片线索的统一整理与分析。
凭借多模型编排与模板化工作流，Plaud 已逐步从“录音与转写工具”进化为真正的 AI 工作拍档：它可以根据不同行业与角色自动应用合适的总结模板，提炼谈判要点、医疗沟通记录或销售跟进清单，让用户在复杂信息面前依然能够一目了然、快速决策。
面向 2030 的愿景：为五千万专业人士放大对话价值
展望未来，Plaud 提出在 2030 年前成为全球最值得信赖的 AI 工作伙伴之一，为 5,000 万专业人士提供稳定、安全且高效的对话智能服务。围绕这一目标，团队在旧金山、新加坡、东京、深圳、西雅图、北京等多地协同研发，在语音识别、自然语言理解、数据安全与产品设计上不断打磨细节。
依托“P-L-A-U-D”五大价值观——追求技术前沿、成就他人、坚持第一性原理、用好 AI、敢于改变——Plaud 正在用一代又一代产品，持续搭建“对话即数据、数据即洞见”的智能基础设施，让每一次交流都能被看见、被记住，并最终转化为推动个人与组织成长的长期资产


## 2026-03-20
关系化， 人性， 实际问题
agent页/小社交页  记忆/个性化编辑页 训练反馈页

## 2026-03-12

- 想法：VoxFlame 也许不该只被定义成“帮助用户说清楚”，而应该被定义成“把用户重新接回世界、他人和自己”。
  对应的真实场景不是抽象训练，而是：
  1. 我现在要跟外界发生连接
  2. 我现在要让别人理解我
  3. 我现在要在一次失败沟通后被接住

- 观察：好的节奏不是把人关起来训练，而是“主动接触 + 主动筛选 + 主动回收”。
  对 VoxFlame 的翻译可能是：
  1. 主动接触：去真实沟通场景里帮用户开口
  2. 主动筛选：帮用户过滤噪声、减少负担、保留最重要的话
  3. 主动回收：会后给用户一个轻量复盘，而不是只留下冷冰冰的转写

- 想法：VoxFlame 的场景入口可以借鉴“感受世界 / 感受他人 / 感受自我”的节奏逻辑。
  可能不是直接这样命名，但可以转成：
  1. 我要和陌生人/机构沟通
  2. 我要和熟人/家人沟通
  3. 我想自己练习和回看

- 观察：用户最脆弱的时候，往往不是“我要长期训练”的时候，而是“我现在就要完成这一次沟通”。
  这再次说明：
  1. 第一话开口
  2. 快捷短语
  3. 一键代播
  4. 关键场景模板
  比很多大而全功能更值得先做。

- 想法：产品里也许应该有“战役模式”，而不是默认所有时间都高强度。
  比如：
  1. 医疗沟通模式
  2. 紧急求助模式
  3. 面对陌生人模式
  进入后界面更极简、反馈更确定、功能更少但更硬。

## 2026-03-09

- 想法：仓库里应该有一个地方，专门记我在外面看到的好产品、好交互、好仓库，不然飞书里记完就散了。
  为什么现在要记：VoxFlame 的想法来源很分散，很多不是当前任务，但以后可能突然有用。

- 观察：很多好点子一开始其实只有半句话，如果要求我立刻补全“价值、假设、下一步”，记录成本就太高了，最后反而不记。

- Speechify 解决了“想读书，但自己无法稳定专注阅读”的困境。
  方式：text-to-speech
  链接：https://app.speechify.com/

- Earzz 是一个软硬件一体的系统，并且可以选择一些场景的声音主动发到听障硬件上。
  这点对燃言很值得借鉴。
  关键页面：https://www.earzz.com/deaf
  连带问题：长时间录音 VS 实时录音反馈，中国地区录音/数据隐私政策怎么处理。

- Canary Speech 通过语音识别结合声音技术，帮助老年人/健康人群诊断身体情况。
  链接：https://canaryspeech.com/news-2/

- 慕言基于专业系统做了针对小孩子/语音不清人群的发音检测，并给出训练计划。
  链接：https://mysw.moocsw.com/
  借鉴难点：
  1. 科学的判断体系
  2. 科学的训练/诊断建议

- 雀说语训提出了“让声音被看见”。
  用户说一句话，系统给出 1-2 个字的拼音和纠正建议。
  感觉技术上未必难，可能是普通大模型加知识库也能先做出第一版。

- 对我们当前项目的疑问：
  感觉现在做的很多功能都没有什么真正作用，包括双行字幕、大字屏幕，以及一些正在规划的能力。
  我们究竟要解决什么问题？
