# VoxFlame AI Copilot Instructions

> **"让声音不仅被听见，更被理解。"**
> 
> VoxFlame 是为构音障碍者（Dysarthric Speech）打造的开源 AI 语音助手。
> 我们不仅仅是在编写代码，更是在构建连接世界的桥梁。

---

## 一、 核心交互准则 (The Core Loop)

在本项目中，你必须严格遵守以下 **Interactive MCP Loop**：

### 1. 反馈驱动 (Feedback Driven) - **AI Forever**
*   **工具**: `mcp_mcp-ai-foreve_interactive_feedback`
*   **规则**:
    *   **必须调用**: 在每一次交互中（包括第一次对话、任务理解、计划、执行后）都必须调用此工具。
    *   **超时设置**: 调用时必须显式设置 `timeout` 参数为 `86400` (24小时)，防止用户思考时会话中断。
    *   **中文反馈**: 工具调用时的 `summary` 字段内容必须使用 **中文**。
    *   **禁止假定**: 不要假定用户满意，必须显式通过工具询问。
    *   **总结上下文**: 每次调用时，清晰总结 *"已完成工作"* 和 *"下一步计划"*。

### 2. 知识溯源 (Knowledge Sourcing) - **Context7**
*   **工具**: `mcp_context7`
*   **规则**:
    *   **拒绝猜测**: 遇到不熟悉的库（如 TEN Framework, Next.js 最新特性），**必须**先查文档。
    *   **官方优先**: 使用 `/org/project` 解析官方库 ID，获取最准确的 API 说明。

### 3. 信息增强 (Information Retrieval) - **Playwright**
*   **工具**: `mcp_microsoft_pla`
*   **规则**:
    *   **外部验证**: 当需要验证技术方案的可行性、查找最新的 Bug 修复或寻找最佳实践时，**必须** 使用 Playwright (`browser_navigate` + 搜索引擎) 进行检索。
    *   **完整数据**: 如果需要爬取网页内容进行分析，使用 Playwright 的 `browser_snapshot`。

---

## 二、 编程哲学 (Philosophy)

### 1. 实践是检验真理的唯一标准
*   **代码 > 理论**: 不要长篇大论的分析，先写出最小可运行的代码（MVP）。
*   **测试驱动**: 每一个功能模块都应有对应的验证步骤或测试代码。

### 2. 辩证开发 (Dialectical Development)
*   **矛盾论**: 抓住主要矛盾（识别率与延迟的平衡），暂时忽略次要矛盾（UI 的完美像素）。
*   **量变质变**: 先实现功能（可用），再优化性能（好用），最后打磨体验（优秀）。

### 3. 工具伦理
*   **不炫技**: 选择最简单、最稳健的工具解决问题。
*   **主动性**: 发现文档缺失或环境问题时，主动提出修复方案，而不是被动报错。

---

## 三、 项目架构与技术栈

| 模块 | 技术栈 | 端口 | 核心职责 |
|------|--------|------|----------|
| **Frontend** | Next.js 14, PWA, Tailwind | 3000 | 极简交互，WebSocket 客户端 |
| **Backend** | Express.js, WS Proxy | 3001 | 协议转换，鉴权代理 |
| **Agent** | TEN Framework (Go/Python) | 8766 | ASR -> LLM (Correction) -> TTS 流水线 |
| **Data** | Qdrant, PostgreSQL | 6333 | 向量记忆，用户配置 |
| **Storage** | 阿里云 OSS | - | 用户音频存储 (`{user_id}/...`) |

### 关键路径
1.  **用户语音** -> 前端 (Microphone)
2.  -> WebSocket -> 后端 Proxy
3.  -> **TEN Agent** (ASR 识别 -> LLM 意图理解/纠错 -> TTS 生成)
4.  -> 前端 (播放音频 + 显示字幕)

---

## 四、 开发工作流 (Workflow)

1.  **初始化 (Init)**:
    *   读取 `.tasks/current.md` 确认当前进度。
    *   调用 `mcp-ai-forever` 确认今日目标。

2.  **调研 (Research)**:
    *   不确定 API？ -> `Context7`
    *   不确定方案？ -> `Playwright` 搜索方案

3.  **编码 (Code)**:
    *   遵循上述技术栈规范。
    *   保持代码简洁（KISS 原则）。

4.  **验证 (Verify)**:
    *   使用 `playwright` 进行 UI 测试（如适用）。
    *   或者编写简单的集成测试脚本。

5.  **反馈 (Feedback)**:
    *   再次调用 `mcp-ai-forever` 汇报结果，等待下一步指示。

---

## 五、 当前任务上下文 (Current Context)

> 同步 `.tasks/current.md`



**Remember: We are correcting the AI's understanding, not the user's voice.**

---

## 五、 代码质量与架构规范 (Code Quality Standards)

为了保持代码的高质量和可维护性，请严格遵守以下规范（详见 [docs/BEST_PRACTICES_AND_ARCHITECTURE.md](../docs/BEST_PRACTICES_AND_ARCHITECTURE.md)）：

### 1. 强类型原则 (Strict Typing)
*   **No Explicit Any**: 严禁使用 `any`。必须为所有 Props、API 响应、状态定义 Interface 或 Type。
*   **Interface Schema**: 所有后端接口必须有对应的 `interface` 定义（如 `CorpusSentence`），并在前后端复用（或保持同步）。

### 2. 现代技术栈 (Modern Stack)
*   **前端**: 遵循 Taxonomy / T3 Stack 架构。
    *   UI 组件使用 `shadcn/ui`。
    *   图标使用 `lucide-react`。
    *   路由使用 Next.js App Router。
*   **后端**: 业务逻辑与控制器分离 (Service / Controller 模式)。

### 3. AI 友好性 (AI Friendliness)
*   **注释**: 关键函数必须添加 JSDoc，明确参数意义，帮助 Copilot 理解上下文。
*   **增量生成**: 不要一次性生成巨型文件，而是分模块、分步骤生成。

---

## 六、 文档导航 (Documentation Map)

在回答问题或规划任务时，参考以下核心文档，但是不需要一开始就读取相关文档，遇到开发相关问题再查阅：

### 0. 架构与规范 (New!)
    **文档导航** : [../docs/README.md](../docs/README.md)
*   **架构必读**: [../docs/BEST_PRACTICES_AND_ARCHITECTURE.md](../docs/BEST_PRACTICES_AND_ARCHITECTURE.md) - **编写代码前必读**


请确保所有新生成的代码或文档更新都与上述文件的最新状态保持一致。



遇到问题一定要找到切入点，全力解决， 直到筋疲力尽，用完我给你的所有工具，多次尝试相关想法， 再反馈给我你做了什么，学到了什么，卡在哪里了，下一步准备怎么做。
