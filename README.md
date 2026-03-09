# VoxFlame Agent

> 让声音不仅被听见，更被理解。  
> A real-time communication system for people with dysarthric speech.

**更新时间**: 2026-03-09

---

## 项目目标

VoxFlame 不是“通用语音助手”，而是一个**软硬件一体的实时沟通解决方案**，优先服务：
- 构音障碍、发音不清用户（首要）
- 在突发、陌生人、高压场景下需要快速表达的人

目标不是“把用户改造成标准发音”，而是：
- 在关键场景里，先帮助用户更容易主动开口
- 在需要沟通时，快速把“难懂语音”转成“可理解表达”
- 尽量保持用户自己的表达风格与声纹特征
- 持续复盘，帮助用户长期提升沟通效果

## 项目协作特色

除了代码、任务和架构文档，仓库里还保留了一个给产品想法使用的 `ideas/` 目录：

- `ideas/DAILY_CAPTURE.md`
  用来随手记下外部看到的好产品、好交互、好仓库、半成品念头
- `ideas/LONG_TERM_TOPICS.md`
  用来沉淀那些需要长期讨论、持续调研、暂时没有结论的问题

它不是默认启动上下文，也不替代当前任务列表。只有当我们在讨论新想法、产品方向或长期调研时，才会按需读取。

---

## 核心判断（先把方向讲清楚）

### 1) TEN 是数据驱动流，不是意图驱动流

当前项目主链路是 TEN graph 编排：`音频 -> ASR -> 纠错 -> TTS -> WebSocket`。  
它擅长低延迟、确定性管线；不擅长复杂的“LLM 自主规划 + 动态多工具编排”。

### 2) Voice Agent 是实时系统，A2UI/Skill 不是第一优先级

对实时语音场景，核心是：
- 低延迟
- 打断与抢话稳定性
- 错误兜底
- 连续可用性

A2UI/Skill 更适合桌面辅助、复盘、训练阶段，在“实时对话主回路”里当前价值有限。

### 3) 产品路线应是三阶段

1. **实时沟通助手（当前主线）**: 能在真实场景里稳定帮用户说清楚
2. **半智能助手（下一阶段）**: 会准备、会兜底、会复盘
3. **全智能助手（远期）**: 在授权边界内主动参与对话与任务执行

---

## 技术难点与深度调研结论

### A. 你构想中的关键技术难点

1. **低延迟 vs 高准确率冲突**
- 构音障碍语音纠错通常需要上下文与个性化信息，但这会增加时延。

2. **全双工交互 vs 稳定中断控制**
- 用户和系统同时说话时，必须可靠实现 barge-in（用户打断系统）、重入、去抖。

3. **实时沟通 vs 长时记忆治理**
- “记录什么、何时记录、记录多久、如何遗忘”是产品和合规双重难题。

4. **语音翻译/重表达 vs 工具调用并行**
- 同一会话内兼顾语音对话、翻译、工具调用，容易出现状态竞争、上下文错配。

5. **个性化语音模型训练数据稀缺**
- 每位用户的发音模式差异极大，小样本个体化是硬问题。

6. **软硬件协同难题**
- 类 PLAUD + 翻译耳机形态涉及：收音阵列、降噪、回声消除、蓝牙链路、续航、端云协同。

### B. 对“最先进语音多模态/全双工模型”的调研结论

> 结论（截至 2026-03-04）：**没有单一模型可以在生产级同时完美覆盖“低延迟全双工对话 + 高质量语音翻译 + 稳定工具调用 + 个体化长期记忆”**。  
> 可行方案仍然是“分层架构 + 能力解耦”。

| 方案 | 实时语音 | 工具调用 | 关键限制（与你场景相关） |
|---|---|---|---|
| OpenAI Realtime API | 支持语音到语音 | 支持（含异步函数调用） | 长会话与上下文治理复杂；需要额外状态编排 |
| Gemini Live API | 支持实时音频交互 | 支持函数调用 | 官方文档说明同一回复通常只输出一种模态（音频或文本） |
| Qwen Realtime API | 支持实时语音，支持 text+audio 同回包 | Qwen 文档中工具调用主要走 Chat Completions；Realtime 工具链需额外验证 | 需自行做会话编排、工具状态同步 |
| Kyutai Moshi/Hibiki（研究/开源） | 全双工低延迟很强 | 非工具调用导向 | 任务边界窄（如 Hibiki 当前是法英同传），不直接等于产品级 Agent |

### C. 对 VoxFlame 的技术策略含义

1. **短期**: TEN 保持实时主回路，避免把复杂 Agent 决策塞进回路里。
2. **中期**: 在 TEN 旁路增加“策略层/编排层”（计划、记忆检索、工具仲裁）。
3. **长期**: 再评估统一端到端语音多模态模型是否可替代部分分层组件。

---

## 项目使用 / 部署

### 1. 环境要求

- Docker + Docker Compose
- 可用的 Supabase 项目（Auth + DB）
- 阿里云 DashScope API Key（ASR/LLM/TTS）

### 2. 环境变量

至少确认以下文件已配置：

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp ten_agent/.env.example ten_agent/.env
```

关键变量：
- `DASHSCOPE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`（建议 `ws://localhost:3001/ws/agent`）

### 3. Docker 启动（推荐）

```bash
docker compose up -d --build
docker compose ps
```

常用运维命令：

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f ten-agent

docker compose restart frontend
docker compose restart backend
docker compose restart ten-agent

docker compose down
```

### 4. 访问入口

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`
- WS proxy: `ws://localhost:3001/ws/agent`
- TEN Agent WS: `ws://localhost:8766`

---

## 基本结构

```text
VoxFlame-Agent/
├── frontend/                    # Next.js 14 前端
│   └── src/app/
│       ├── page.tsx             # 公共首页 + 沟通模式切换
│       ├── chat/page.tsx        # 兼容路由（重定向到 /?mode=communicate）
│       ├── contribute/page.tsx  # 中文语训 + 录后反馈 + 匿名上传页
│       ├── ranyan/page.tsx      # 项目介绍页
│       ├── (auth)/login/page.tsx
│       └── auth/callback/route.ts
├── backend/                     # Express + WS Proxy + API
│   └── src/index.ts
├── ten_agent/                   # TEN Runtime + Python extensions
│   ├── property.json            # 图编排（数据流）
│   └── extension_src/
│       ├── websocket_server/
│       ├── voxflame_main_python/
│       ├── llm_correction_python/
│       └── memory_layer_python/
├── supabase/                    # 迁移脚本
├── docs/                        # 架构与研究文档
└── docker-compose.yml
```

---

## 项目现有进度（按代码现状）

### 已可用

- `Frontend -> Backend -> TEN Agent` WebSocket 代理链路
- Supabase 登录鉴权（前后端均已接入）
- TEN 实时链路：ASR -> LLM 纠错 -> TTS
- 首页已切换为公开产品首页：明确“现在沟通 / 练习表达 / 查看进展与记忆”，`/?mode=communicate` 进入沟通模式，`/chat` 保留兼容跳转
- 多客户端会话隔离（`client_id` 维度）与定向消息回传
- 纠错事件 + 会话 turn 写入 memory layer（local-first）
- `voice_profile / memory_context` 已进入纠错链路
- 常用短语 CRUD API（后端）
- 主动沟通 Starter Kit 第一版：基于 AAC / 医疗 / 应急资料整理的中文场景卡片与第一句话代播
- WebSocket 纯文本 `user_input -> TEN Agent -> TTS` 已打通，匿名 starter phrase 会自动连接并跳过默认问候
- `/contribute` 已进入中文语训页第二阶段：高价值场景句、拼音、实时转写、录后反馈、匿名上传和训练结果写回已形成最小闭环
- Docker 构建链路稳定（`docker compose build` 已验证通过）

### 部分可用 / 需实测

- 真实麦克风端到端延迟、误打断率、弱网重连表现
- Memory 检索质量与日级复盘效果（跨会话）
- 用户身份上下文注入后的个性化纠错收益量化

### 仍是占位/原型的能力

- 工具执行接口（电话/设备/提醒）当前以模拟逻辑为主
- 半智能复盘与训练教练流程尚未闭环


---

## 下步计划（与你的产品构想对齐）

### Phase 1: 实时沟通助手（P0）

目标：先把“帮助用户主动开口并被理解”做到可用。

- ✅ 首页信息架构已完成第一轮重构：公开首页先讲“现在沟通 / 练习表达 / 查看进展与记忆”，并保留 `/?mode=communicate` 沟通入口
- ✅ 第一话 / 场景模板 / 快捷短语 / 一键代播闭环（第一版）
- 🚧 中文训练页第二阶段已落地：目标句、拼音、录后反馈、匿名上传、训练结果写回已接通；趋势页与更细的拼音 / 音节反馈待补
- 打断策略与时延治理（p95、误打断率、重连恢复）作为所有主功能的上线门槛
- 全屏字幕保留，但降级为辅助显示能力，不再作为近期主叙事


### Phase 2: 半智能助手（P1）

目标：会准备、会复盘、会逐渐理解这个用户。

- 会话前准备建议（基于历史习惯 + 场景）
- 会话中兜底表达建议（用户确认后执行）
- 个体沟通记忆（高频表达、混淆词、场景偏好、训练历史）
- 每日复盘（遗漏信息、沟通风险点、改进建议）

### Phase 3: 全智能助手（P2）

目标：在强授权下主动参与对话，并开始连接外部场景。

- 可控代理模式（白名单对象 + 白名单工具 + 可审计）
- 多轮任务级沟通目标追踪
- 用户成长模型（鼓励、训练计划、自适应难度）
- 场景声音提醒与用户定义设备 / App 联动

---

## 技术特点

- **TEN 数据流核心**: 适合实时音频处理链路
- **本地优先记忆**: 为长期个体化提供基础
- **后端 WS 代理**: 解决前端到 Agent 的工程接入问题
- **可演进架构**: 先实时稳定，再叠加半智能与全智能层

---

## QA

### Q1: 为什么不直接做“全能 Agent + A2UI + Skill”?

因为实时语音场景的第一约束是**时延和稳定性**。先把核心沟通链路做稳，再增加智能层，风险更低。

### Q2: TEN 能不能直接做意图驱动的工具调度？

能做，但不自然。TEN 原生更偏图式数据流。复杂工具仲裁建议放在旁路编排层。

### Q3: 这个项目是“语音翻译器”还是“沟通助手”？

短期就应该是“主动沟通助手”，不是只会展示字幕的翻译器；中长期再长成“训练教练 + 成长系统 + 场景感知助手”。

### Q4: 为什么强调记录与复盘？

单次纠错解决“当下可说”；复盘与训练解决“长期变好”。两者缺一不可。

### Q5: 听障辅助为什么放后面？

它很有价值，但工程边界和主沟通链路不同。近期更适合先做“场景声音提醒 + 硬件 / App / Web 通信”的原型验证，而不是直接挤占构音障碍主线的 P0 资源。

---

## 项目号召

我们正在寻找以下方向的贡献者：

- 语音算法（ASR 个体化、语音重表达、TTS 声纹保真）
- 实时系统工程（WebSocket/RTC、低延迟音频链路）
- 康复与沟通科学（评估指标、训练方案、伦理边界）
- 硬件工程（麦克风阵列、耳机形态、低功耗端侧）
- 临床与用户研究（构音障碍真实场景数据与反馈）

如果你认同“沟通权”是基本权利，欢迎一起把它做成可用产品。

---

## 参考资料 / 致谢

### 官方文档与模型能力

- OpenAI Realtime API 介绍与更新  
  https://openai.com/index/introducing-the-realtime-api/  
  https://developers.openai.com/blog/realtime-api

- Google Gemini Live API（能力、限制、工具调用）  
  https://ai.google.dev/gemini-api/docs/live-guide  
  https://ai.google.dev/gemini-api/docs/live-tools

- Alibaba Cloud Model Studio（Qwen Realtime / Function Calling）  
  https://www.alibabacloud.com/help/en/model-studio/realtime-model  
  https://www.alibabacloud.com/help/en/model-studio/function-calling

- Kyutai 全双工语音项目  
  https://github.com/kyutai-labs/moshi  
  https://github.com/kyutai-labs/hibiki

### 构音障碍语音研究

- Interspeech 2025 Dysarthric Speech Recognition Challenge  
  https://www.isca-archive.org/interspeech_2025/plumley25_interspeech.html

- DyPCL: Personalized Dysarthric Speech Recognition with Prompt-based Contrastive Learning (NAACL 2025)  
  https://aclanthology.org/2025.findings-naacl.388/

- Hypernetworks for Personalized, Cross-Lingual Dysarthria and Stuttering Speech Recognition (Apple, Interspeech 2025)  
  https://machinelearning.apple.com/research/hypernetworks-personalized-cross-lingual-dysarthria-stuttering

- Latent Phrase Matching for Dysarthric Speech Recognition (Apple, Interspeech 2023)  
  https://machinelearning.apple.com/research/latent-phrase-matching

### 开源社区与框架

- TEN Framework 官方文档  
  https://theten.ai/docs/ten_framework/extension/

- 本项目文档导航  
  [docs/README.md](docs/README.md)

---

## License

本项目协议保持不变，详见 [LICENSE](LICENSE)。
