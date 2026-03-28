# VoxFlame Agent

> 让声音不仅被听见，更被理解。

**更新时间**: 2026-03-26

VoxFlame 是面向构音障碍沟通场景的主动沟通助手。当前目标不是做“通用语音助手”，而是把主链路收敛成一个真正可用的产品：先帮助用户说出第一句话，再帮助用户在实时沟通中被理解，并把练习与记忆沉淀成长期改进。

当前产品判断已经明确吸收“创始人即用户”的一手研究：真正决定成败的，不只是识别准确率，而是用户在面试、工作协作、医疗沟通、陌生人求助这些高压时刻，能不能不被打断、不被忽视、不被别人替他说话。

文档使用上也已经进一步收口：继续开发时，默认以本 README、[产品 PRD](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md) 和 [当前任务状态](/home/ubuntu/VoxFlame-Agent/.tasks/current.md) 为主入口；仓库研究结论现在优先看 [Runtime And Surface Reference](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_RUNTIME_AND_SURFACE_REFERENCE_2026-03-26.md) 和 [Agent, Memory And Tooling Reference](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_AGENT_MEMORY_AND_TOOLING_REFERENCE_2026-03-26.md) 这 2 份综合参考。

## 当前架构

当前唯一事实源：

```text
Frontend RTC/RTM
  -> Backend /api/rtc/session/*
  -> TEN rtc graph
  -> Qwen realtime ASR / TTS
```

- `Frontend`：Agora RTC 音频、Agora RTM 文本/控制、沟通页与训练页；PWA 已恢复为正式能力，默认随前端容器开启。
- `Backend`：RTC session orchestration、memory API、phrases API、upload API。
- `TEN Agent`：服务端 VAD、Qwen realtime ASR/TTS、LLM 纠错、memory layer。
- 旧运行时 `websocket` 主链已经退役，不再作为兼容路径保留。

## 当前能力

- 沟通页已跑通 `RTC audio + RTM text/control`。
- 纯文本代播会显式返回 assistant transcript，不再只靠语音回放。
- 训练页已能按需拉起 RTC worker，并通过 RTM 接收 `training_feedback` 与 `voice_profile_updated`。
- Qwen realtime ASR/TTS 已完成单元测试和真实供应商 smoke。
- memory、hotwords、confusion patterns 已能沿当前主链写回。

## 当前代码判断

- 沟通主链已经能用；沟通页首屏已经从 `chat-first` 收成 `starter kit + live session + expression kit drawer`，首页、练习页和沟通档案页的顶层信息也开始从“说明书式页面”收成“任务入口 + 资源入口 + 低压力提示”。
- 训练数据入口这轮也开始扎实起来：前端已围绕 `recording envelope -> recorder queue -> upload receipt` 收口，后端 `/api/upload/complete` 已开始按 `audio_path` 复用已有 contribution / manifest，减少补传和重试时的重复写入。
- 本地待同步录音现在不再只是“有个数量提示”，而是会带 `syncStatus / syncAttempts / lastAttemptAt / lastError` 显式展示，后续 PWA、web 和 future companion 可以围绕同一套 recorder queue contract 继续扩展。
- [useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts) 同时承担会话启动、RTM 事件路由、字幕聚合、voice profile 同步和本地 memory session 管理，已经逼近“第二控制面”。
- 长期用户状态目前分散在前端 [memory-service.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/lib/memory/memory-service.ts)、后端 [supabase.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/supabase.service.ts) 和 TEN 的 [memory_layer_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/memory_layer_python/extension.py)；方向没错，但还缺统一的 `profile bundle / session review` 读模型。
- TEN 主控 [extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/voxflame_main_python/extension.py) 已同时背负 transport relay、训练结果处理、voice profile 转发和会话状态管理，近期应该停长产品语义，而不是继续堆功能。

## 当前重点

当前不再继续做 transport 大迁移。下一阶段重点是先把已有能力收成一个可长期扩展的产品和 contract：

1. 首页与沟通工作台
- 把首页改成高压场景优先的任务入口，再把 `starter kit + personalized phrases + live session` 收成一条“先开口，再持续沟通”的主路径。

2. 数据录入与上传地基
- 继续把 `recording envelope / recorder queue / upload receipt / manifest` 收成稳定 contract，为 PWA、未来 app 和 companion 复用打地基。

3. 后端读模型
- 把 `profile bundle / session review / expression kit merge` 做成 backend 正式 contract，减少页面自己拼记忆和画像。

4. 前端变薄
- 把会话 transport、字幕 reducer、短语动作和训练同步从巨型 hook 里拆开，避免前端继续长成第二控制面。

5. 执行面去供应商化
- 继续使用 `TEN + Agora` 跑现役主链，但产品层逐步改用 vendor-neutral 的 `session / transport / capability` 语言。

## 近期开发路径

1. 先改沟通页首屏，让 `CommunicationStarterKit` 成为正式入口，并把 `QuickPhrasesPanel` 降成表达工具箱的第二层。
2. 继续把训练数据链路收口到 `recording envelope / recorder queue / upload/complete`，补 authenticated live smoke，并强化上传幂等性。
   当前 web 端已经补到“队列状态可追踪、失败可解释、重试可见”，下一步重点是把真实登录态 smoke 和队列/manifest 落盘一起跑通。
3. 在 backend 增加 `profile bundle` 和 `session review` 读写口，让沟通页、训练页、记忆页消费同一份长期画像。
4. 重构前端 session hooks：保留当前 RTC/RTM 主链，但把 transport bootstrap、消息归并、memory sync 解耦。
5. 在不替换 runtime 的前提下，收紧 TEN 主控职责，只保留 realtime orchestration，逐步把产品治理逻辑移回 backend/control plane。

## 快速开始

### 环境要求

- Docker + Docker Compose
- DashScope API Key
- Agora App ID + App Certificate
- Supabase 项目

### 环境变量

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp ten_agent/.env.example ten_agent/.env
```

关键变量：

- `DASHSCOPE_API_KEY`
- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE` 或 `AGORA_CERTIFICATE`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_API_URL`：本地开发时使用 `http://localhost:3001`
- `FRONTEND_NEXT_PUBLIC_API_URL`：Docker 部署时推荐固定为 `/api`
- `VOXFLAME_ENABLE_PWA`：默认 `1`；如需排查 `localhost` 缓存 / service worker 干扰，可临时设为 `0`

### 启动

```bash
docker compose up -d --build
docker compose ps
```

常用命令：

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f ten-agent
docker compose down
```

### 访问入口

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`
- RTC orchestration health: `http://localhost:3001/api/rtc/health`
- TEN control server: `http://localhost:8080/health`

## 目录

```text
VoxFlame-Agent/
├── frontend/
│   ├── src/app/
│   ├── src/components/
│   ├── src/hooks/
│   └── src/lib/
├── backend/
│   └── src/
├── ten_agent/
│   ├── extension_src/
│   ├── property.json
│   └── manifest.json
├── scripts/
├── docs/
└── docker-compose.yml
```

## 关键入口

- 前端沟通会话：[frontend/src/hooks/useRtcAgentSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useRtcAgentSession.ts)
- 前端训练会话：[frontend/src/hooks/useMandarinTrainingSession.ts](/home/ubuntu/VoxFlame-Agent/frontend/src/hooks/useMandarinTrainingSession.ts)
- 后端 RTC orchestration：[backend/src/services/rtc-orchestration.service.ts](/home/ubuntu/VoxFlame-Agent/backend/src/services/rtc-orchestration.service.ts)
- TEN runtime graph：[ten_agent/property.json](/home/ubuntu/VoxFlame-Agent/ten_agent/property.json)
- TEN 主控扩展：[ten_agent/extension_src/voxflame_main_python/extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/voxflame_main_python/extension.py)

## 验证脚本

- Qwen ASR live smoke: `bash scripts/qwen_asr_live_smoke.sh`
- Qwen TTS live smoke: `bash scripts/qwen_tts_live_smoke.sh`
- AI 文档校验: `bash scripts/check_ai_docs.sh`

## 协作入口

- 当前任务：[.tasks/current.md](/home/ubuntu/VoxFlame-Agent/.tasks/current.md)
- 项目摘要：[.claude-summary.md](/home/ubuntu/VoxFlame-Agent/.claude-summary.md)
- 工程规范：[AGENTS.md](/home/ubuntu/VoxFlame-Agent/AGENTS.md)
- 产品主文档：[docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)

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
