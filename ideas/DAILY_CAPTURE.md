# Daily Capture

这里就是随手记。

不追求标准格式，不要求一次写完整。
一句话、一个链接、一个观察、一个突然冒出来的念头，都可以先扔进来。

---
## 2026-04-06
https://openai.com/zh-Hans-CN/index/harness-engineering/



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
