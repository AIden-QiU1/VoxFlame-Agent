# VoxFlame Agent

**燃言 - Ignite Your Voice**

*专为2000万构音障碍者打造的AI语音转换助手*

---

## 项目愿景

**VoxFlame 燃言** 是一个为构音障碍患者打造的开源AI语音助手。

**核心理念**：不是"纠正"用户的表达，而是"理解"用户的意图，让每个声音都被听见。

**核心功能**：用户说话 → ASR识别 → LLM纠正 → 清晰字幕 + TTS语音输出

---

## 系统架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  TEN Agent  │
│  Next.js    │     │   Express   │     │  ASR→LLM→TTS│
│  Port 3000  │◀────│  Port 3001  │◀────│  Port 8766  │
└─────────────┘     └─────────────┘     └─────────────┘
```

| 模块 | 技术 | 端口 |
|------|------|------|
| 前端 | Next.js 14 + TypeScript + TailwindCSS + PWA | 3000 |
| 后端 | Express + TypeScript + WebSocket Proxy | 3001 |
| Agent | TEN Framework (Go Runtime + Python Extensions) | 8766 |
| ASR | 阿里云 funasr-nano
| LLM | QWEN3 Max via DashScope | - |
| TTS | CosyVoice v3 | - |

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
```

### 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | 语音转换界面 |
| 后端 | http://localhost:3001 | API + WebSocket 代理 |
| Agent | ws://localhost:8766 | TEN Agent (内部) |

---

## 产品路线图

### v1.0 - 基础语音助手 (已完成)

| 功能 | 描述 | 状态 |
|------|------|------|
| TEN Framework 集成 | Go Runtime + Python Extensions | Done |
| 阿里云 ASR | Paraformer-realtime-v2 实时识别 | Done |
| 通义千问 LLM | Qwen3-max 对话生成 | Done |
| CosyVoice TTS | 语音合成 (longxiaochun) | Done |
| WebSocket 通信 | 实时双向通信（直连模式） | Done |
| PWA 基础支持 | Service Worker + manifest.json | Done |
| Docker 配置 | docker-compose.yml + Dockerfile | Done |

---

### v1.1 - WebSocket 代理 (已完成)

**问题**：VSCode Remote SSH 环境下，端口转发不支持 WebSocket 协议升级

**解决方案**：后端 (3001) 代理 WebSocket 请求到 TEN Agent (8766)

| 功能 | 描述 | 状态 |
|------|------|------|
| 后端代理实现 | ws 库实现双向代理 | Done |
| 前端配置更新 | agentWsUrl 改为 ws://host:3001/ws/agent | Done |
| 连接状态管理 | 消息队列处理连接延迟 | Done |
| 音频流转发 | Base64 音频正常传输 | Done |

---

### v1.2 - UI 改进 (已完成)

**目标**：Google 风格简洁界面，优化录音交互

| 功能 | 描述 | 状态 |
|------|------|------|
| Google 风格 UI | 白色简洁主题 | Done |
| 字幕显示 | LLM 纠正后的文字实时显示 | Done |
| 点击式录音 | 点击开始/结束，替代长按 | Done |
| 空格键控制 | 空格键切换录音状态 | Done |
| 页面风格统一 | ranyan/contribute 页面同步更新 | Done |

---

### v2.0 - LLM 语音纠错 (开发中)

**目标**：为构音障碍患者提供专业的实时语音纠错功能

**核心流程**：用户说话 → ASR 识别 → LLM 纠错 → 清晰文字 + 正常语音

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 0 | 技术调研（ASR/TTS/VAD/扩展生态） | Done |
| Phase 1 | 基础 LLM 纠错扩展 (dysarthric_correction) | WIP |
| Phase 2 | VAD/Turn Detection 优化（构音障碍参数调整） | Planned |
| Phase 3 | 个性化纠错（用户词库、上下文记忆） | Planned |
| Phase 4 | N-best 重排序 (Fun-ASR-Nano) | Optional |

**关键技术参数**：
- VAD 阈值: 0.3-0.4 (降低误触发)
- 静默时间: 1500-2000ms (延长等待)
- LLM Prompt: 结合医学知识与语音特征

**详细开发计划**：[docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md](docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md)

---

### v2.5 - 部署与运维 (计划中)

**目标**：从开发环境过渡到生产环境，支持 HTTPS + 负载均衡

| 任务 | 描述 | 优先级 |
|------|------|--------|
| Nginx 配置 | 反向代理 + WebSocket 升级 + SSL | P1 |
| SSL/HTTPS | Let's Encrypt 自动续期 | P1 |
| Docker Nginx 集成 | docker-compose 添加 Nginx 服务 | P1 |
| 环境配置管理 | dev/test/prod 配置分离 | P2 |
| 日志收集 | 集中日志管理 | P2 |
| 健康检查 | 服务监控与自动重启 | P3 |

**Nginx 架构**：
```
浏览器 (HTTPS 443)
    ↓
Nginx 反向代理
    ├─→ Frontend :3000 (静态文件 + SSR)
    ├─→ Backend :3001 (API 接口)
    └─→ TEN Agent :8766 (WebSocket 音频流)
```

---

### v2.6 - PWA 增强 (计划中)

**目标**：完整的 PWA 离线支持与移动端体验优化

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 离线回退页面 | 无网络时友好提示 | P1 |
| 音频数据缓存 | IndexedDB 存储音频块 | P1 |
| 更新提示组件 | Service Worker 更新检测与刷新 | P2 |
| 安装提示横幅 | 引导用户安装 PWA | P2 |
| Lighthouse 审计 | PWA 分数 > 90 | P3 |

**详细实施指南**：[docs/PWA_IMPLEMENTATION_GUIDE.md](docs/PWA_IMPLEMENTATION_GUIDE.md)

---

### v3.0 - RTC 实时通信 (计划中)

**目标**：接入 Agora RTC 实现低延迟实时音视频通信

**适用场景**：> 1000 并发用户，多人协作对话

| 功能 | 描述 |
|------|------|
| Agora RTC SDK | 实时音视频传输 (UDP + RTP) |
| 多用户房间 | 支持多人同时对话 |
| 音视频质量优化 | 弱网适配、回声消除、自适应码率 |
| 云录制 | 对话录音存档 |

**技术对比**：
| 指标 | WebSocket | Agora RTC |
|------|-----------|-----------|
| 协议 | TCP | UDP + RTP |
| 延迟 | 100-300ms | 50-150ms |
| 并发支持 | < 1000 | 10,000+ |
| 弱网适配 | 容易断连 | FEC + NACK |

---

### v4.0 - 高并发与扩展 (计划中)

**目标**：支持大规模用户同时在线，实现企业级可扩展性

| 功能 | 描述 |
|------|------|
| 负载均衡 | Nginx/K8s 负载分发 |
| Agent 集群 | 多 TEN Agent 实例 + 会话保持 |
| 消息队列 | Redis/RabbitMQ 异步处理 |
| 监控告警 | Prometheus + Grafana |
| 自动扩缩容 | K8s HPA 根据负载自动扩容 |

**架构演进**：
```
Phase 1: 单机部署（当前）
    Frontend + Backend + TEN Agent (同一台服务器)

Phase 2: 服务分离 (v2.5)
    Nginx + Frontend + Backend + TEN Agent (独立进程)

Phase 3: 集群部署 (v4.0)
    Load Balancer → Frontend/Backend/Agent Cluster

Phase 4: 容器编排 (v4.0+)
    Kubernetes + Auto-scaling + Redis + PostgreSQL
```

---

### v5.0 - 移动端与生态 (远期规划)

**目标**：构建完整的多端生态系统

| 功能 | 描述 |
|------|------|
| iOS/Android App | React Native 原生应用 |
| 智能穿戴 | Apple Watch/WearOS 支持 |
| 智能音箱 | 接入小度/天猫精灵/小爱同学 |
| 医疗机构平台 | 康复机构管理后台 |
| 多语言支持 | 方言/多语言/国际化 |

---

## 项目结构

```
VoxFlame-Agent/
├── frontend/           # Next.js 前端
│   ├── src/app/       # 页面组件
│   ├── src/hooks/     # React Hooks (useAgent)
│   └── src/lib/       # WebSocket 客户端
├── backend/           # Express 后端
│   └── src/index.ts   # API + WebSocket 代理
├── ten_agent/         # TEN Framework Agent
│   ├── extension_src/ # 自定义扩展
│   ├── manifest.json  # Agent 配置
│   └── property.json  # 运行时参数
├── docs/              # 技术文档
└── docker-compose.yml # 容器编排
```

---

## 技术文档

### 开发计划
| 文档 | 描述 |
|------|------|
| [LLM纠错开发计划](docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md) | v2.0 语音纠正扩展实现方案 |
| [记忆系统计划](docs/MEMORY_SYSTEM_PLAN.md) | PowerMem + Qdrant 技术方案 |

### 技术研究
| 文档 | 描述 |
|------|------|
| [TEN扩展分析](docs/TEN_EXTENSIONS_ANALYSIS.md) | TEN Framework 扩展生态 |
| [TEN框架分析](docs/TEN_FRAMEWORK_ANALYSIS.md) | TEN Framework 架构解析 |
| [WebSocket vs RTC](docs/WEBSOCKET_VS_RTC_GUIDE.md) | 实时通信协议对比 |
| [ASR/TTS模型研究](docs/LATEST_ASR_TTS_MODELS_REPORT.md) | 最新语音模型对比 |

### 子项目文档
| 文档 | 描述 |
|------|------|
| [前端 README](frontend/README.md) | Next.js 前端开发指南 |
| [后端 README](backend/README.md) | Express 后端开发指南 |
| [Agent README](ten_agent/README.md) | TEN Agent 配置指南 |

---

## 参考资料

### 论文
- [Bridging ASR and LLMs for Dysarthric Speech Recognition](https://arxiv.org/abs/2508.08027) - Interspeech 2025
- [Zero-shot MLLM for Dysarthric ASR](https://arxiv.org/abs/2406.00639) - Interspeech 2024
- [Generative Error Correction with LLMs](https://arxiv.org/abs/2409.09554) - 2024

### 相关项目
- [TEN-Agent](https://github.com/TEN-framework/TEN-Agent) - 实时语音 Agent 框架
- [CLEAR-VOX-MODEL](https://github.com/AIden-QiU1/CLEAR-VOX-MODEL) - 构音障碍语音研究

---

## 常见问题

### TEN Agent 启动失败: Failed to load libpython3.10.so

```bash
export TEN_PYTHON_LIB_PATH=/usr/lib/x86_64-linux-gnu/libpython3.10.so.1.0
```

### 前端无法连接 Agent

1. 确认 TEN Agent 正在运行: `sudo docker-compose ps`
2. 查看日志: `sudo docker-compose logs -f`

### 容器代码未更新

```bash
sudo docker-compose build frontend --no-cache
sudo docker-compose up -d frontend
```

---

## License

**CC BY-NC 4.0** - 禁止商业用途，详见 [LICENSE](LICENSE)

---

**让每个声音都被听见**
