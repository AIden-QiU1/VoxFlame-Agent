# VoxFlame Agent

**燃言 - Ignite Your Voice**

*专为2000万构音障碍者打造的AI语音助手*

---

## 重要提示 (非商业许可)

**本项目采用 CC BY-NC 4.0 许可证** - 禁止商业使用

详见 [LICENSE](LICENSE)

---

## 项目简介

**VoxFlame 燃言** 是一个为构音障碍患者打造的开源AI语音助手。通过热词增强、上下文记忆、个性化AI助手三大技术，让每个声音都被听见。

---

## 系统架构

| 模块 | 技术 | 端口 |
|------|------|------|
| 前端 | Next.js 14 + TypeScript + TailwindCSS + PWA | 3000 |
| 后端 | Express + TypeScript | 3001 |
| Agent | TEN Framework (Go Runtime + Python Extensions) | 8766 |
| ASR | 阿里云 Paraformer-realtime-v2 | - |
| LLM | QWEN3 Max via DashScope | - |
| TTS | CosyVoice v3 | - |

---

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+ (需要创建 venv 环境)
- Go 1.21+
- 阿里云 DashScope API Key

### 环境准备

```bash
# 1. 创建 Python 虚拟环境 (TEN Agent 需要)
python3 -m venv venv
source venv/bin/activate

# 2. 安装前后端依赖
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 3. 配置环境变量
# - ten_agent/.env      (DashScope API Key)
# - backend/.env        (Supabase 配置)
# - frontend/.env.local (前端配置)
```

---

## 启动服务

### 方式一: 一键启动 (推荐)

```bash
# 启动所有服务 (后台运行，日志输出到 logs 目录)
./start_services.sh

# 重启所有服务
./start_services.sh --restart

# 停止所有服务
./start_services.sh --stop

# 查看服务状态
./start_services.sh --status
```

日志文件:
- logs/ten_agent_*.log - TEN Agent
- logs/backend_*.log - 后端
- logs/frontend_*.log - 前端

### 方式二: 手动逐个启动 (调试用)

在三个独立的终端中分别执行:

**终端 1 - TEN Agent:**
```bash
./scripts/start_agent.sh
```

**终端 2 - 后端服务:**
```bash
./scripts/start_backend.sh
```

**终端 3 - 前端服务:**
```bash
./scripts/start_frontend.sh
```

**停止所有服务:**
```bash
./scripts/stop_services.sh
```

---

## TEN Agent 启动说明

TEN Agent 需要特定的环境配置，`ten_agent/scripts/start.sh` 已配置好:

```bash
# 激活 venv
source /root/VoxFlame-Agent/venv/bin/activate

# 设置 Python 库路径
export TEN_PYTHON_LIB_PATH=/usr/lib/x86_64-linux-gnu/libpython3.10.so.1.0

# 设置环境变量
export PYTHONPATH=$(pwd)/ten_packages/system/ten_ai_base/interface:$PYTHONPATH
export LD_LIBRARY_PATH=$(pwd)/ten_packages/system/ten_runtime_go/lib:...

# 启动
exec bin/main "$@"
```

---

## 访问地址

### 本地访问
- 前端: http://localhost:3000
- 后端: http://localhost:3001
- Agent WebSocket: ws://localhost:8766

### VSCode Remote SSH 用户

1. 打开 VSCode 端口面板: View -> Terminal -> Ports
2. 添加端口转发: 3000, 3001, 8766
3. 浏览器访问: http://localhost:3000

### SSH 手动端口转发

```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 -L 8766:localhost:8766 user@server
```

---

## 常见问题

### TEN Agent 启动失败: Failed to load libpython3.10.so

```bash
# 查找 Python 库位置
find /usr -name "libpython*.so*"

# 设置环境变量
export TEN_PYTHON_LIB_PATH=/usr/lib/x86_64-linux-gnu/libpython3.10.so.1.0
```

### venv 不存在

```bash
python3 -m venv /root/VoxFlame-Agent/venv
source /root/VoxFlame-Agent/venv/bin/activate
```

### 前端无法连接 Agent

1. 确认 TEN Agent 正在运行: `ss -tlnp | grep 8766`
2. 确认端口转发已配置 (VSCode 用户)

---

## License

**CC BY-NC 4.0** - 禁止商业用途

---

**让每个声音都被听见**

---

## 产品路线图

### v1.0 - 基础语音助手 (已完成) ✅

| 功能 | 描述 | 状态 |
|------|------|------|
| TEN Framework集成 | Go Runtime + Python Extensions | ✅ 完成 |
| 阿里云ASR | Paraformer-realtime-v2 实时识别 | ✅ 完成 |
| 通义千问LLM | Qwen3-max 对话生成 | ✅ 完成 |
| CosyVoice TTS | 语音合成 (longxiaochun) | ✅ 完成 |
| WebSocket通信 | 实时双向通信（直连模式） | ✅ 完成 |
| PWA基础支持 | Service Worker + manifest.json | ✅ 完成 |
| Docker配置 | docker-compose.yml + Dockerfile | ✅ 完成 |

**当前运行状态：**
- Frontend: Port 3000 ✅
- Backend: Port 3001 ✅
- TEN Agent: Port 8766 ✅

---

### v1.1 - WebSocket 代理修复 (进行中) 🔧

**问题：** VSCode Remote SSH 环境下，端口转发不支持 WebSocket 协议升级，导致前端无法直连 TEN Agent (8766)

**解决方案：** 通过后端 (3001) 代理 WebSocket 请求到 TEN Agent (8766)

| 任务 | 描述 | 状态 | 优先级 |
|------|------|------|--------|
| 后端代理实现 | http-proxy-middleware 代理 /ws 路径 | ❌ 待实施 | P0 |
| 前端配置更新 | agentWsUrl 改为 ws://host:3001/ws | ❌ 待实施 | P0 |
| 连接测试 | 验证音频流正常传输 | ❌ 待测试 | P0 |
| 文档更新 | 更新连接说明文档 | ❌ 待完成 | P1 |

**实施计划：**
```typescript
// backend/src/index.ts
import { createProxyMiddleware } from 'http-proxy-middleware';

app.use('/ws', createProxyMiddleware({
  target: 'ws://localhost:8766',
  ws: true,
  changeOrigin: true,
  logLevel: 'debug',
}));

// frontend/src/lib/config.ts
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const agentWsUrl = `${protocol}//${window.location.host}/ws`;
```

**预计完成时间：** 1 小时

---

### v1.2 - PWA 功能增强 (短期规划) 🚀

**目标：** 实现完整的 PWA 离线支持与性能优化

| 任务 | 描述 | 状态 | 优先级 | 工作量 |
|------|------|------|--------|--------|
| 音频数据缓存 | IndexedDB 存储音频块 | ❌ 待实施 | P1 | 2h |
| 离线回退页面 | pages/_offline.tsx 友好提示 | ❌ 待实施 | P1 | 1h |
| 更新提示组件 | Service Worker 更新检测与刷新 | ❌ 待实施 | P2 | 1h |
| 自定义缓存策略 | API Network-First, 图片 Cache-First | ❌ 待实施 | P2 | 2h |
| 安装提示横幅 | 引导用户安装 PWA | ❌ 待实施 | P3 | 1h |
| Lighthouse 审计 | PWA 分数 > 90 | ❌ 待测试 | P3 | 1h |

**当前状态：**
- ✅ @ducanh2912/next-pwa 已安装
- ✅ Service Worker 自动生成 (sw.js, workbox.js)
- ✅ manifest.json 已配置
- ⚠️ 缺少高级功能（音频缓存、离线页面、更新提示）

**详细实施指南：** [docs/PWA_IMPLEMENTATION_GUIDE.md](docs/PWA_IMPLEMENTATION_GUIDE.md)

**预计完成时间：** 1 周

---

### v2.0 - LLM 语音纠错 (开发中) 📝

**目标：** 为构音障碍患者提供实时语音纠错功能

**核心流程：** 用户说话 → ASR 识别 → LLM 纠错 → 清晰文字 + 正常语音

| Phase | 内容 | 状态 | 预计时间 |
|-------|------|------|----------|
| Phase 0 | 技术调研（ASR/TTS/VAD/扩展生态） | ✅ 完成 | - |
| Phase 1 | 基础 LLM 纠错扩展 (dysarthric_correction) | ❌ 待开始 | 2 周 |
| Phase 2 | VAD/Turn Detection 优化（构音障碍参数调整） | ❌ 计划中 | 1 周 |
| Phase 3 | 个性化纠错（用户词库、上下文记忆） | ❌ 计划中 | 2 周 |
| Phase 4 | N-best 重排序 (Fun-ASR-Nano) | ❌ 可选 | 1 周 |

**关键技术洞察：**
- VAD 阈值: 0.3-0.4 (降低误触发)
- 静默时间: 1500-2000ms (延长等待)
- LLM Prompt: 结合医学知识与语音特征

**详细开发计划：** [docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md](docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md)

**预计完成时间：** v2.0 Beta - 1.5 个月

---

### v2.5 - 部署与运维 (短期规划) 🌐

**目标：** 从开发环境过渡到生产环境，支持 HTTPS + 负载均衡

| 任务 | 描述 | 状态 | 优先级 | 工作量 |
|------|------|------|--------|--------|
| Nginx 配置文件 | 反向代理 + WebSocket 升级 + SSL | ❌ 待创建 | P1 | 2h |
| SSL/HTTPS 支持 | Let's Encrypt 自动续期 | ❌ 待配置 | P1 | 1h |
| Docker Nginx 集成 | docker-compose 添加 Nginx 服务 | ❌ 待实施 | P1 | 2h |
| 环境配置管理 | dev/test/prod 配置分离 | ❌ 待实施 | P2 | 2h |
| 日志收集 | 集中日志管理（文件 + 数据库） | ❌ 待实施 | P2 | 2h |
| 部署脚本 | 一键部署脚本（启动/停止/重启） | ✅ 已完成 | - | - |
| 健康检查 | 服务监控与自动重启 | ❌ 待实施 | P3 | 2h |

**Nginx 架构：**
```
浏览器 (HTTPS 443)
    ↓
Nginx 反向代理
    ├─→ Frontend :3000 (静态文件 + SSR)
    ├─→ Backend :3001 (API 接口)
    └─→ TEN Agent :8766 (WebSocket 音频流)
```

**详细技术指南：** [docs/WEBSOCKET_VS_RTC_GUIDE.md](docs/WEBSOCKET_VS_RTC_GUIDE.md)

**预计完成时间：** 1 周

---

### v3.0 - RTC 实时通信 (中期规划) 📡

**目标：** 接入 Agora RTC 实现低延迟实时音视频通信

**适用场景：** > 1000 并发用户，多人协作对话

| 功能 | 描述 | 状态 | 预计时间 |
|------|------|------|----------|
| Agora RTC SDK | 实时音视频传输 (UDP + RTP) | ❌ 规划中 | 1 周 |
| 多用户房间 | 支持多人同时对话 | ❌ 规划中 | 1 周 |
| 音视频质量优化 | 弱网适配、回声消除、自适应码率 | ❌ 规划中 | 2 周 |
| 屏幕共享 | 支持屏幕内容分享 | ❌ 规划中 | 1 周 |
| 云录制 | 对话录音存档 | ❌ 规划中 | 1 周 |

**成本估算：**
- 免费额度: 0-100 用户/月
- 100 用户: ~$35/月
- 1000 用户: ~$350/月

**技术对比：**
| 指标 | WebSocket | Agora RTC |
|------|-----------|-----------|
| 协议 | TCP | UDP + RTP |
| 延迟 | 100-300ms | 50-150ms |
| 并发支持 | < 1000 | 10,000+ |
| 弱网适配 | ❌ 容易断连 | ✅ FEC + NACK |
| 开发时间 | 已完成 | 4-6 小时 |

**预计完成时间：** v3.0 - 2 个月

---

### v4.0 - 高并发与扩展 (长期规划) ⚡

**目标：** 支持大规模用户同时在线，实现企业级可扩展性

| 功能 | 描述 | 状态 | 预计时间 |
|------|------|------|----------|
| 负载均衡 | Nginx/K8s 负载分发 | ❌ 规划中 | 2 周 |
| Agent 集群 | 多 TEN Agent 实例 + 会话保持 | ❌ 规划中 | 2 周 |
| 消息队列 | Redis/RabbitMQ 异步处理 | ❌ 规划中 | 1 周 |
| 数据库优化 | Supabase 连接池、读写分离 | ❌ 规划中 | 1 周 |
| 监控告警 | Prometheus + Grafana + Alertmanager | ❌ 规划中 | 2 周 |
| 自动扩缩容 | K8s HPA 根据负载自动扩容 | ❌ 规划中 | 1 周 |

**架构演进：**
```
Phase 1: 单机部署（当前）
    Frontend + Backend + TEN Agent (同一台服务器)

Phase 2: 服务分离 (v2.5)
    Nginx + Frontend + Backend + TEN Agent (独立进程)

Phase 3: 集群部署 (v4.0)
    Load Balancer
        ├─→ Frontend Cluster (3+ 实例)
        ├─→ Backend Cluster (3+ 实例)
        └─→ TEN Agent Cluster (5+ 实例)

Phase 4: 容器编排 (v4.0+)
    Kubernetes
        ├─→ Ingress (Nginx)
        ├─→ Frontend Deployment (Auto-scaling)
        ├─→ Backend Deployment (Auto-scaling)
        ├─→ TEN Agent StatefulSet (Session Affinity)
        ├─→ Redis (Message Queue)
        └─→ Supabase (PostgreSQL)
```

**预计完成时间：** v4.0 - 3 个月

---

### v5.0 - 移动端与生态 (远期规划) 📱

**目标：** 构建完整的多端生态系统

| 功能 | 描述 | 状态 | 预计时间 |
|------|------|------|----------|
| iOS/Android App | React Native 原生应用 | ❌ 远期 | 2 个月 |
| 智能穿戴 | Apple Watch/WearOS 支持 | ❌ 远期 | 1 个月 |
| 智能音箱 | 接入小度/天猫精灵/小爱同学 | ❌ 远期 | 1 个月 |
| 医疗机构平台 | 康复机构管理后台 | ❌ 远期 | 2 个月 |
| 多语言支持 | 方言/多语言/国际化 | ❌ 远期 | 1 个月 |

**预计完成时间：** v5.0 - 6 个月+

---

## 技术文档

### 核心文档

| 文档 | 描述 | 路径 |
|------|------|------|
| API规范 | 后端API接口文档 | [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md) |
| 产品设计文档 | VoxFlame产品定位与功能规划 | [docs/VoxFlame.md](docs/VoxFlame.md) |
| 用户研究报告 | 构音障碍老年患者用户研究 | [docs/USER_RESEARCH_DYSARTHRIC_ELDERLY_CN.md](docs/USER_RESEARCH_DYSARTHRIC_ELDERLY_CN.md) |

### 开发计划

| 文档 | 描述 | 路径 |
|------|------|------|
| LLM纠错开发计划 | v2.0 LLM语音纠错扩展实现方案 | [docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md](docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md) |

### 技术研究报告

| 报告 | 描述 | 路径 |
|------|------|------|
| 2025 ASR/TTS模型研究 | 最新语音识别与合成模型对比分析 | [docs/LATEST_ASR_TTS_MODELS_REPORT.md](docs/LATEST_ASR_TTS_MODELS_REPORT.md) |
| TEN VAD深度分析 | 语音活动检测技术与参数优化 | [docs/TEN_VAD_ANALYSIS.md](docs/TEN_VAD_ANALYSIS.md) |
| TEN Turn Detection分析 | 对话轮次检测机制详解 | [docs/TEN_TURN_DETECTION_ANALYSIS.md](docs/TEN_TURN_DETECTION_ANALYSIS.md) |
| TEN扩展生态分析 | TEN Framework扩展系统全面解析 | [docs/TEN_EXTENSIONS_ANALYSIS.md](docs/TEN_EXTENSIONS_ANALYSIS.md) |

### 架构与部署

| 文档 | 描述 | 路径 |
|------|------|------|
| WebSocket vs RTC指南 | 网络底层原理与实时通信技术对比 | [docs/WEBSOCKET_VS_RTC_GUIDE.md](docs/WEBSOCKET_VS_RTC_GUIDE.md) |
| PWA实现指南 | 渐进式Web应用离线支持与性能优化 | [docs/PWA_IMPLEMENTATION_GUIDE.md](docs/PWA_IMPLEMENTATION_GUIDE.md) |

### 关键技术洞察

**Voice Agent 2025趋势:**
- 端到端S2S模型 (Moshi 200ms延迟、全双工对话)
- 开源多模态模型崛起 (Qwen2-Audio、VITA)
- 流式处理成为标配 (Fun-ASR-Nano 0.8B参数)

**构音障碍优化:**
- VAD阈值: 0.3-0.4 (降低误触发)
- 静默时间: 1500-2000ms (延长等待)
- N-best重排序: 提升识别准确率

**网络架构选择:**
- 开发阶段: WebSocket直连 (简单高效)
- 生产环境: Nginx反向代理 (SSL + 负载均衡)
- 高并发场景: Agora RTC (UDP + 自适应码率)

**PWA离线支持:**
- Service Worker + Workbox缓存策略
- IndexedDB音频数据缓存
- 离线回退页面与更新提示

---

## 参考资料
### 论文
- [Bridging ASR and LLMs for Dysarthric Speech Recognition](https://arxiv.org/abs/2508.08027) - Interspeech 2025
- [Zero-shot MLLM for Dysarthric ASR](https://arxiv.org/abs/2406.00639) - Interspeech 2024
- [Generative Error Correction with LLMs](https://arxiv.org/abs/2409.09554) - 2024

### 相关项目
- [CLEAR-VOX-MODEL](https://github.com/AIden-QiU1/CLEAR-VOX-MODEL) - 构音障碍语音研究
- [TEN-Agent](https://github.com/TEN-framework/TEN-Agent) - 实时语音 Agent 框架
