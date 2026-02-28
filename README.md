# VoxFlame Agent

**燃言 - Ignite Your Voice**

*让每个声音都被听见，让每种表达都被理解*

---

## 项目愿景

**VoxFlame 燃言** 是为构音障碍者（Dysarthria）打造的 **Agentic Voice 应用**。

### 核心理念

> **"不是纠正用户的声音，而是理解用户的意图"**
> **"Agent 是大脑，记忆是灵魂，UI 只是手脚"**

构音障碍患者面临的核心问题：
1. **认知差异**：患者觉得自己说的是正常的，但他人听到的是不同的声音
2. **沟通障碍**：陌生人无法快速理解其表达意图
3. **长期康复**：需要持续的训练和反馈

### 产品定位：Agent + 记忆驱动的智能语音助理

```
┌─────────────────────────────────────────────────────────────────┐
│              VoxFlame Agentic Voice (2026架构)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Agentic UI (A2UI)                         │ │
│  │   双行字幕镜 │ 声音反馈 │ 意图面板 │ 数字名片              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                TEN Framework + Agent Core                   │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │           Memory Layer (三层记忆)                      │  │ │
│  │  │  • 感知记忆: 当前对话上下文                           │  │ │
│  │  │  • 工作记忆: 交流主题 + 对方身份                      │  │ │
│  │  │  • 长期记忆: 用户画像 + 成功模式                      │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │         Skills & Tools Layer (可扩展)                 │  │ │
│  │  │  • SpeechClaritySkill    (语音澄清)                  │  │ │
│  │  │  • IntentPredictionSkill (意图预测)                  │  │ │
│  │  │  • ContextSharingSkill   (上下文分享)                │  │ │
│  │  │  • QuickPhraseSkill      (常用短语)                  │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  Mic → ASR → [Raw] → LLM → [Corrected] → TTS             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            Supabase + Qdrant (记忆存储)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 核心公式 (2026 Agentic AI)

```
AI Agent = LLM (Brain) + Memory (Soul) + Planning + Tool Use
```

**参考**：[MemBrain 1.0](https://blog.csdn.net/cf2SudS8x8F0v/article/details/157816826) (2026年2月发布，SOTA记忆系统)

---

## 系统架构

### 当前架构（基于 TEN Framework + Agent Memory）

```
┌───────────────────────────────────────────────────────────────┐
│                       用户设备 (Web/PWA)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  录音输入    │  │  双行字幕    │  │  TTS播放     │         │
│  │  AudioWorklet│  │  Raw+Correct │  │  CosyVoice   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │ WebSocket (base64 audio)              │              │
└─────────┼───────────────────────────────────────┼──────────────┘
          │                                       │
┌─────────▼───────────────────────────────────────▼──────────────┐
│                      Backend (Express)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Supabase    │  │  WebSocket   │  │  Memory Svc  │         │
│  │  Auth        │  │  Proxy       │  │  (NEW!)      │         │
│  └──────────────┘  └──────┬───────┘  └──────────────┘         │
└────────────────────────────┼───────────────────────────────────┘
                               │ WebSocket
┌──────────────────────────────▼──────────────────────────────────┐
│                    TEN Agent (Python Extensions)                 │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │websocket│→│  ASR   │→│  LLM   │→│  Main  │→│  TTS   │  │
│  │ _server│  │(阿里云) │  │+Memory │  │Control │  │(Cosy)  │  │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  │
│                                                         │       │
│              TEN 数据流图 (property.json)                     │
│         websocket → stt → llm_memory → main_control → tts     │
│                                                                  │
│  扩展路线图：                                                    │
│  ✅ websocket_server  WebSocket 服务器                            │
│  ✅ llm_correction     LLM 纠错                                   │
│  ✅ voxflame_main     主控制器                                    │
│  🚧 memory_layer      记忆层 (开发中)                             │
│  📝 speech_clarity    语音清晰度评估 (规划中)                     │
│  📝 intent_predict    意图预测 (规划中)                           │
│  📝 context_share     上下文分享 (规划中)                         │
└─────────────────────────────────────────────────────────────────┘
```

### TEN Framework 能力评估

| 能力 | 描述 | 应用场景 | 评估 |
|------|------|---------|------|
| **数据流图** | 可视化配置扩展连接 | 灵活组装处理流程 | ✅ 强大 |
| **多语言扩展** | Python/Go/C++/JS/TS | 选择最适合的语言开发 | ✅ 灵活 |
| **音频帧处理** | PCM 帧输入/输出 | 低延迟音频流处理 | ✅ 高效 |
| **系统扩展** | ASR/TTS/LLM/VAD 等 | 即插即用能力模块 | ✅ 丰富 |
| **实时通信** | WebSocket/内置流式 | 端到端实时交互 | ✅ 稳定 |
| **热更新** | 动态加载/卸载扩展 | 无需重启服务 | ✅ 便捷 |

**结论**：TEN Framework 仍有很大开发空间，暂不需要自研框架。

---

## 技术栈与升级计划

| 模块 | 当前技术 | 2026 升级选项 | 状态 |
|------|---------|---------------|------|
| **前端** | Next.js 14 + PWA | - | ✅ 稳定 |
| **实时通信** | WebSocket | - | ✅ 工作中 |
| **后端** | Express + WS Proxy | - | ✅ 稳定 |
| **Agent框架** | TEN Framework | - | ✅ 当前核心 |
| **ASR** | 阿里云 funasr-nano | → **Qwen3-ASR** (52 种方言) | 📝 计划升级 |
| **LLM** | QWEN3 Max | → **Qwen3.5** (思考模式、长上下文) | 📝 计划升级 |
| **TTS** | CosyVoice v3 | → **Qwen3-TTS** (3秒克隆、情感控制) | 📝 计划升级 |
| **认证** | Supabase Auth | - | ✅ 完成 |
| **记忆系统** | (待开发) | PostgreSQL + Qdrant + IndexedDB | 🚧 开发中 |

### 2026 模型评估

**Qwen3-ASR** [了解更多](https://qwen-ai.com/)：
- 52 种语言/方言支持（22 种中文方言）
- 4.97% 普通话识别错误率（超越 GPT-4o Transcribe）
- 极端噪声环境：16.17% WER（Whisper 为 63.17%）
- 混合方言：15.94% WER（Whisper 为 44.55%）
- 支持流式识别和离线部署
- Apache 2.0 开源许可

**Qwen3-TTS** [了解更多](https://qwen-ai.com/)：
- 3 秒声音克隆
- 情感、音调、节奏控制
- 17 种表达音色
- 97ms 超低延迟
- 中韩跨语言生成：错误率比 CosyVoice3 降低 66%

**Qwen3.5** [了解更多](https://github.com/QwenLM/Qwen3.5/)：
- 397B MoE 架构（每前向传播仅激活 17B 参数）
- 原生 262K 上下文，可扩展至 1M tokens
- 思考模式 (`/think`) 用于复杂逻辑推理
- 支持 201 种语言和方言
- 本地部署仅需 4 张 H20 GPU（比 R1 少 1/3）

---

## 模型精度对比

### ASR 语音识别对比

| 模型 | 普通话 CER | 极端噪声 WER | 混合方言 WER | 延迟 |
|------|-----------|-------------|-------------|------|
| **Qwen3-ASR** | **4.97%** | **16.17%** | **15.94%** | 160ms |
| FunASR (Paraformer) | ~7% | - | - | 低 |
| Whisper-large-v3 | - | 63.17% | 44.55% | - |
| GPT-4o Transcribe | - | - | - | - |
| Doubao-ASR | - | - | 19.85% | - |

**结论**：Qwen3-ASR 在中文场景下全面领先，特别是在噪声和方言环境中表现突出。

### TTS 语音合成对比

| 模型 | 音色质量 | 情感控制 | 延迟 | 声音克隆 |
|------|---------|---------|------|---------|
| **Qwen3-TTS** | **真人级** | **优秀** | **97ms** | **3秒** |
| CosyVoice v3 | 高 | 良好 | 低 | 支持 |
| 跨语言生成 | - | 错误率 14.4% | - | - |
| **Qwen3-TTS (跨语言)** | - | **4.82% (-66%)** | - | - |

**结论**：Qwen3-TTS 在音质、情感控制和跨语言生成方面均优于 CosyVoice。

### 模型选择建议

| 场景 | ASR 选择 | TTS 选择 | LLM 选择 |
|------|---------|---------|---------|
| 实时对话 | Qwen3-ASR-0.6B | Qwen3-TTS-0.6B | Qwen3.5-NonThink |
| 高质量输出 | Qwen3-ASR-1.7B | Qwen3-TTS-1.7B | Qwen3.5-Think |
| 离线部署 | Qwen3-ASR 本地 | Qwen3-TTS 本地 | Qwen3.5 本地 |
| 成本优先 | FunASR + Qwen3-TTS 混合 | - | - |

---

## 产品进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| **v1.x 基础版** | TEN Agent + ASR/LLM/TTS + WebSocket + PWA + UI | ✅ 完成 |
| **v2.x 生产版** | Nginx + HTTPS + Docker Compose + 环境配置修复 | ✅ 完成 |
| **v3.x 认证系统** | Supabase Auth + 用户上下文感知 | ✅ 完成 |
| **v4.0 核心功能** | 常用短语板 + RLS修复 | ✅ 完成 |
| **v5.0 Agent+记忆** | 双行字幕镜 + 记忆系统 + Agent Skills | 🚧 **进行中** |

### 今日工作总结 (2026-02-28)

**已完成**:
- ✅ 双行字幕镜功能（Raw ASR + LLM 纠正显示）
- ✅ 记忆系统深度调研（EverMemOS/Qdrant/Supabase pgvector 对比）
- ✅ TEN Framework 记忆架构研究（PowerMem/EverMemOS/memU 示例分析）

**关键发现**:
- **EverMemOS**: 93% LoCoMo 准确率，但需内测申请或复杂部署（4个Docker + LLM API）
- **Qdrant**: <10ms 延迟，最轻量，只需 1 个 Docker
- **pgvector**: 已集成 Supabase，但 >200ms 延迟，性能瓶颈

**下次优先级**:
1. **验证**: 登录系统、用户管理、各功能模块是否真正可运行
2. **选择**: 最适合 Voice Agent 的记忆系统，设计创新点
3. **部署**: 应用上线（域名 + HTTPS 配置）

### 开发优先级 (2026 Q1)

> 基于 **Agent + 记忆驱动** 架构，聚焦核心能力

| Phase | 任务 | 描述 | 预计时间 |
|-------|------|------|---------|
| **P1** | 双行字幕镜 | Raw ASR + LLM纠正 + 清晰度评分 | 1周 |
| **P1** | TEN记忆层Extension | 用户画像 + 对话历史存储 | 2周 |
| **P1** | Agent Skills | 意图预测 + 短语建议 + 上下文分享 | 1周 |
| **P2** | 数字名片 | 陌生人快速理解 + 场景预设 | 1周 |
| **P2** | A2UI优化 | Agent主动推送 + 意图面板 | 1周 |
| **P3** | 评估收集模块 | 独立页面 + 数据导入记忆 | 1周 |

### 已验证功能

| 功能模块 | 状态 | 说明 |
|----------|------|------|
| 用户注册/登录 | ✅ 正常 | JWT Token 认证 |
| WebSocket 连接 | ✅ 正常 | Frontend → Backend → TEN Agent |
| TTS 语音输出 | ✅ 正常 | 问候语播放成功 |
| 字幕显示 | ✅ 正常 | ASR 文本实时显示 |
| 音频录音 | ⚠️ 需 HTTPS | 浏览器安全限制 |

### 代码规模

| 模块 | 文件数 | 代码行数 |
|------|--------|---------|
| Frontend (TSX/TS) | 40 | ~3,500 |
| Backend (TS) | 9 | ~1,500 |
| TEN Extensions | 3 | ~1,200 |
| **总计** | **52** | **~6,200** |

---

## 开发路线图

> **策略：基于 TEN + PWA 做到极致，自研框架延后**

### 立即执行（本周）

| 功能 | 描述 | 优先级 | 预计工作量 |
|------|------|--------|-----------|
| **双行字幕镜** | Raw ASR + LLM纠正 + 最终文本 三行对照 | P0 | 2-3天 |
| **常用短语板** | 点击即播 + 自定义添加 + TTS 预缓存 | P0 | 1-2天 |
| **场景模板** | 就医/购物/点餐/打车 预设短语 | P0 | 1天 |
| **Qwen3-ASR 评估** | 评估升级到 Qwen3-ASR 的可行性 | P0 | 1天 |

### 短期（2-4 周）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| **PWA 完善** | Service Worker + IndexedDB 本地存储 | P1 |
| **全屏对外字幕** | 给对方看的超大字显示 | P1 |
| **历史记录调用** | 最近消息 + 收藏 + 重播 | P1 |
| **记忆系统基础** | PostgreSQL + 基础 API | P1 |

### 中期（1-2 月）

| 功能 | 描述 | 状态 |
|------|------|------|
| **感知差镜子** | Listener Simulation + 断裂点高亮 | 📝 设计中 |
| **声音可视化** | 波形 + 梅尔频谱 + 对比 | 📝 设计中 |
| **模型升级** | Qwen3-ASR/TTS + Qwen3.5 | 📝 计划中 |
| **伙伴模式** | 对方"懂/不懂"按钮 + 自动修复 | 📝 设计中 |

### 长期（3-6 月）

| 功能 | 描述 | 状态 |
|------|------|------|
| **TEN 扩展** | memory、phrase_manager、tool_calling | 📝 规划中 |
| **声音教练** | 节拍训练 + 游戏化练习 | 📝 设计中 |
| **生活代理** | 智能家居集成 + 确认式执行 | 📝 设计中 |

### 极长期（6 月+）

| 功能 | 描述 | 触发条件 |
|------|------|---------|
| **自研框架评估** | 当 TEN 达到上限时再开发 | 需要评估 |
| **边缘计算** | 本地 ASR/TTS 部署 | 性能需求 |
| **多模态** | 视频、手势辅助 | 用户需求 |

---

## TEN 扩展开发计划

### 现有扩展

```
ten_agent/extension_src/
├── websocket_server/     # WebSocket 服务器
├── voxflame_main_python/ # 主控制器
└── llm_correction_python/# LLM 纠错
```

### 计划扩展（Agent + 记忆驱动）

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEN Agent 扩展架构                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: 记忆层 (Memory Layer) - P0                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  memory_layer_python                                        │ │
│  │  ├── 功能: 三层记忆管理（感知/工作/长期）                    │ │
│  │  ├── 输入: 对话数据、用户行为                                │ │
│  │  ├── 输出: 记忆检索、上下文注入                              │ │
│  │  └── 存储: Supabase (结构化) + Qdrant (向量)                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Phase 2: Agent Skills - P0                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  speech_clarity_python                                      │ │
│  │  ├── 功能: 实时语音清晰度评估                               │ │
│  │  ├── 输入: ASR置信度 + 音频特征                             │ │
│  │  └── 输出: 清晰度评分 (0-100) + 颜色编码                    │ │
│  │                                                              │ │
│  │  intent_prediction_python                                   │ │
│  │  ├── 功能: 增强型意图识别                                    │ │
│  │  ├── 输入: ASR结果 + 用户画像                                │ │
│  │  └── 输出: 预测意图 + 建议表达                                │ │
│  │                                                              │ │
│  │  phrase_suggestion_python                                   │ │
│  │  ├── 功能: 基于上下文的短语建议                              │ │
│  │  ├── 输入: 当前场景 + 用户历史                               │ │
│  │  └── 输出: 推荐短语列表                                      │ │
│  │                                                              │ │
│  │  context_sharing_python                                     │ │
│  │  ├── 功能: 陌生人快速理解                                    │ │
│  │  ├── 输入: 场景触发                                          │ │
│  │  └── 输出: 数字名片 + 预设开场白                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Phase 3: 高级扩展 - P1                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  visualization_python  # 语音可视化（波形/频谱）            │ │
│  │  tool_calling_python      # 工具调用与执行                 │ │
│  │  voice_coach_python       # 声音教练（节拍训练）            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## PWA 能力评估

### 当前 PWA 功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 可安装 | ✅ | 可添加到主屏幕 |
| manifest.json | ✅ | 完整配置 |
| usePWA Hook | ✅ | 已实现 |
| InstallPrompt | ✅ | 安装提示组件 |
| Service Worker | ⚠️ | 部分实现，待完善 |
| IndexedDB | ❌ | 未实现 |
| 离线模式 | ❌ | 待开发 |

### PWA vs 原生对比

| 能力 | PWA | 原生 | 选择 |
|------|-----|------|------|
| 开发成本 | 低 | 高 | PWA |
| 跨平台 | ✅ | ❌ | PWA |
| 性能 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | PWA 够用 |
| 硬件访问 | 有限 | 完整 | PWA 够用 |
| 审核上架 | 无 | 需要 | PWA |

**结论**：当前阶段 PWA 完全够用，无需开发原生应用。

---

## 记忆系统设计

### 混合架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     VoxFlame 混合记忆架构                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  层 1: Supabase PostgreSQL (核心存储)                            │
│  ├── user_profiles (用户画像)                                    │
│  ├── sessions (会话记录)                                         │
│  ├── memories (长期记忆)                                         │
│  └── phrase_library (短语库)                                     │
│                                                                  │
│  层 2: Qdrant 向量数据库 (语义检索)                               │
│  └── conversation_embeddings (对话嵌入)                         │
│                                                                  │
│  层 3: IndexedDB (本地缓存 - 离线可用)                           │
│  ├── 常用短语                                                   │
│  ├── TTS 音频缓存                                                │
│  └── 最近会话                                                    │
│                                                                  │
│  层 4: Markdown 导出 (用户可读)                                   │
│  └── 用户可导出记忆为 Markdown 文件                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 音频 RAG 方案

对于 Voice Agent，需要特殊的记忆结构：

```typescript
interface AudioMemory {
  id: string;
  user_id: string;
  
  // 原始音频
  audio_url: string;  // OSS 存储
  
  // ASR 结果
  raw_asr: string;
  asr_confidence: number;
  
  // LLM 纠错
  corrected_text: string;
  
  // 语义嵌入（用于检索）
  text_embedding: number[];  // OpenAI/Qwen Embeddings
  
  // 元数据
  timestamp: Date;
  context: string;  // 场景（就医/购物/家庭）
  emotional_tone: string;  // 情绪（急切/平静/开心）
}
```

---

## 参考项目与灵感

### 核心参考架构

| 项目 | 描述 | 可借鉴点 |
|------|------|---------|
| [TEN Framework](https://github.com/TEN-framework/ten-framework) | 实时语音 Agent 框架 | **当前核心**，数据流图、多语言扩展 |
| [OpenClaw](https://github.com/AIden-QiU1/openclaw) | AI Agent 框架 | Gateway 架构、Markdown 记忆、插件系统 |
| [QuQu](https://github.com/yan5xu/ququ) | 开源语音输入工具 | 本地 FunASR、过滤口头禅 |
| [VocoType](https://github.com/233stone/vocotype-cli) | 离线语音输入法 | 隐私优先 |

### 技术参考

| 技术 | 用途 |
|------|------|
| [Qwen3-ASR](https://qwen-ai.com/) | 52 种方言 ASR，升级首选 |
| [Qwen3-TTS](https://qwen-ai.com/) | 3 秒声音克隆，情感控制 |
| [Qwen3.5](https://github.com/QwenLM/Qwen3.5) | 思考模式 LLM，长上下文 |
| [FunASR](https://github.com/alibaba-damo-academy/FunASR) | 工业级 ASR 工具包 |

---

## 快速开始

### Docker 部署 (推荐)

```bash
# 1. 克隆项目
git clone https://github.com/AIden-QiU1/VoxFlame-Agent.git
cd VoxFlame-Agent

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DASHSCOPE_API_KEY

# 3. 启动服务
sudo docker-compose up -d --build

# 4. 查看状态
sudo docker-compose ps

# 5. 查看日志
sudo docker-compose logs -f ten-agent
```

### 访问地址

| 环境 | 前端地址 | 说明 |
|------|----------|------|
| 本地开发 | http://localhost:3000 | localhost 无需 HTTPS |
| 生产环境 | https://your-domain.com | **必须使用 HTTPS** |

**重要**：浏览器 `getUserMedia` API 要求 HTTPS 环境（localhost 例外）。

---

## 项目结构

```
VoxFlame-Agent/
├── frontend/              # Next.js 前端
│   ├── src/app/          # 页面组件
│   ├── src/hooks/        # useAgent, usePhrases, useScenarios
│   ├── src/lib/          # WebSocket, AudioProcessor
│   └── src/components/
│       ├── chat/         # ChatInterface
│       ├── quick-phrases/  # 常用短语 (新增)
│       └── scenarios/     # 场景模板 (新增)
├── backend/              # Express 后端
│   └── src/
│       ├── index.ts      # WebSocket Proxy
│       ├── controllers/
│       └── services/
├── ten_agent/            # TEN Framework Agent
│   ├── extension_src/    # Python 扩展
│   │   ├── websocket_server/
│   │   ├── voxflame_main_python/
│   │   └── llm_correction_python/
│   ├── manifest.json     # Agent 配置
│   └── property.json     # 数据流图配置
├── docs/
│   ├── product/          # 产品规划
│   │   ├── feature-roadmap.md
│   │   ├── ai-plan.md
│   │   ├── my-image.md
│   │   └── repo-refer.md
│   ├── DEVELOPMENT_ROADMAP.md  # 开发路线图
│   └── COMPREHENSIVE_DEVELOPMENT_PLAN.md  # 全面开发计划
└── docker-compose.yml
```

---

## 技术文档

| 文档 | 描述 |
|------|------|
| [全面开发计划](docs/COMPREHENSIVE_DEVELOPMENT_PLAN.md) | 代码现状评估 + 2026 技术选型 |
| [开发路线图](docs/DEVELOPMENT_ROADMAP.md) | 五阶段开发计划 |
| [LLM纠错开发计划](docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md) | v2.0 语音纠正扩展 |
| [记忆系统计划](docs/MEMORY_SYSTEM_PLAN.md) | PowerMem + Qdrant |
| [TEN扩展分析](docs/TEN_EXTENSIONS_ANALYSIS.md) | TEN Framework 生态 |
| [WebSocket vs RTC](docs/WEBSOCKET_VS_RTC_GUIDE.md) | 实时通信协议对比 |

---

## 常见问题

### HTTPS 访问提示证书不安全

自签名证书不受浏览器信任，这是正常的：
1. Chrome/Edge: 点击"高级" → "继续访问"
2. Firefox: 点击"高级" → "接受风险并继续"

### 通过服务器 IP 访问无法录音

**症状**：`navigator.mediaDevices` 为 `undefined`

**原因**：浏览器安全政策阻止 HTTP 非本地访问

**解决**：
- 开发测试：使用 `localhost:3000` 或配置 HTTPS
- 生产环境：必须配置 HTTPS

### TEN Agent 启动失败

```bash
export TEN_PYTHON_LIB_PATH=/usr/lib/x86_64-linux-gnu/libpython3.10.so.1.0
```

---

## 贡献指南

我们欢迎任何形式的贡献：

1. **代码贡献**：提交 PR，修复 Bug 或实现新功能
2. **TEN 扩展**：开发新的 Python 扩展
3. **数据贡献**：构音障碍语音数据标注
4. **场景模板**：分享常用场景短语模板
5. **反馈建议**：提出产品改进建议

---

## License

**CC BY-NC 4.0** - 非商业用途

> 注：作者声明可随时商用，许可证文本待更新以与商业计划对齐。

---

## 致谢

- [TEN Framework](https://github.com/TEN-framework/ten-framework) - 实时语音 Agent 框架
- [OpenClaw](https://github.com/AIden-QiU1/openclaw) - AI Agent 架构参考
- [Qwen3 系列](https://qwen-ai.com/) - ASR/TTS/LLM 模型
- [FunASR](https://github.com/alibaba-damo-academy/FunASR) - 中文 ASR 模型
- [CosyVoice](https://github.com/FisherAudio/CosyVoice) - 开源 TTS 模型

---

**让每个声音都被听见，让每种表达都被理解。**

**让声音不仅被听见，更被理解。**
