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

| 环境 | 前端地址 | 后端 API | 说明 |
|------|----------|----------|------|
| 本地开发 | http://localhost:3000 | http://localhost:3001/api | localhost 无需 HTTPS |
| 生产环境 | https://your-server-ip | https://your-server-ip/api | **必须使用 HTTPS** |

**重要提示**：
- 浏览器安全政策要求 `getUserMedia` API 必须在 HTTPS 环境下运行
- 只有 `localhost` 和 `file://` 协议例外，允许使用 HTTP
- 如果通过服务器 IP (如 `http://xxx.xxx.xxx.xxx:3000`) 访问，录音功能将无法使用
- 生产环境必须配置 HTTPS，详见下方 [HTTPS 部署](#https-部署) 章节

---

## 产品进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| **v1.x 基础版** | TEN Agent + ASR/LLM/TTS + WebSocket + PWA + UI | ✅ 完成 |
| **v2.x 生产版** | Nginx + HTTPS + Docker Compose + 环境配置修复 | ✅ 完成 |
| **v3.x 认证系统** | Supabase Auth + 用户上下文感知 | ✅ 完成 |
| **v4.0 核心优化** | Agent 细节调优 + 构音障碍适配 | 🚧 进行中 |

### 已验证功能 (2026-01-30)

| 功能模块 | 状态 | 说明 |
|----------|------|------|
| 用户注册 | ✅ 正常 | 注册后自动登录 |
| 用户登录 | ✅ 正常 | JWT Token 认证 |
| WebSocket 连接 | ✅ 正常 | Frontend → Backend → TEN Agent |
| TTS 语音输出 | ✅ 正常 | 问候语播放成功 |
| 字幕显示 | ✅ 正常 | ASR 文本实时显示 |
| 音频录音 | ⚠️ 需 HTTPS | 浏览器安全限制 |

### 待上线准备：域名 + HTTPS

| 步骤 | 操作 | 时间 |
|------|------|------|
| 购买域名 | 选择注册商、支付、DNS 配置 | 10-30 分钟 |
| DNS 生效 | 域名解析到服务器 IP | 10 分钟 - 48 小时 |
| 申请 SSL | Let's Encrypt 自动申请 | 5 分钟 |
| 配置 Nginx | 更新配置、重启服务 | 10 分钟 |

**总计**：最快 30 分钟，最长 2 天（等待 DNS）

**一键配置命令**（等有域名后）:
```bash
# 1. 安装 certbot
sudo apt-get install certbot

# 2. 申请证书
sudo certbot certonly --standalone -d your-domain.com

# 3. 更新 nginx/nginx.conf 中的域名和证书路径
# 4. 重启服务
sudo docker-compose restart nginx
```

**域名推荐**：
- 国内：阿里云/腾讯云 `.com` 约 50-70 元/年，DNS 生效快
- 国外：Namecheap/GoDaddy 约 $10-15/年

### 当前重点：构音障碍适配

| 任务 | 优先级 | 预计工期 |
|------|--------|----------|
| **快捷指令面板** | P0 | 1-2 天 |
| **常用短语收藏** | P0 | 1 天 |
| VAD 参数调优 | P1 | 0.5 天 |
| LLM 纠错 Prompt 优化 | P1 | 0.5 天 |
| 音频流稳定性提升 | P2 | 1 天 |

### 后续计划

| 版本 | 内容 |
|------|------|
| **PWA 增强** | 离线支持、IndexedDB 缓存、安装提示 |
| **RTC 通信** | Agora SDK 接入，低延迟多人对话 |
| **高并发** | 负载均衡、Agent 集群、消息队列 |

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

## HTTPS 部署

### 为什么需要 HTTPS？

浏览器出于安全考虑，**仅在以下环境允许使用 `getUserMedia` API**（用于录音）：
- `https://` 协议
- `localhost` 或 `127.0.0.1`
- `file://` 协议

如果你通过服务器 IP 地址（如 `http://xxx.xxx.xxx.xxx:3000`）访问，会遇到以下错误：
```
当前浏览器不支持 mediaDevices API，请确保使用 HTTPS 或 localhost 访问
```

### 快速配置 HTTPS（开发环境）

项目已包含自签名 SSL 证书生成脚本：

```bash
# 1. 生成自签名证书
bash nginx/generate-ssl.sh

# 2. 启动所有服务（包含 Nginx）
sudo docker-compose up -d

# 3. 访问 HTTPS
# 浏览器访问 https://your-server-ip
# 首次访问会提示证书不安全，点击"继续访问"即可
```

### 服务架构

```
┌─────────────────────────────────────────────────────┐
│                 Nginx (443/80)                      │
│  ┌─────────────┬─────────────┬─────────────┐        │
│  │  HTTPS:443  │  HTTP:80    │  WS Proxy   │        │
│  │  → 转发到   │  → 重定向   │  /ws/agent  │        │
│  └──────┬──────┴──────┬──────┴──────┬──────┘        │
└─────────┼──────────────┼─────────────┼───────────────┘
          │              │             │
    ┌─────▼─────┐  ┌────▼────┐  ┌────▼────┐
    │ Frontend  │  │ Backend │  │Ten-Agent│
    │   :3000   │  │  :3001  │  │  :8766  │
    └───────────┘  └─────────┘  └─────────┘
```

### Nginx 配置说明

- **HTTP (80)**: 自动重定向到 HTTPS
- **HTTPS (443)**: 主服务端口
  - `/` → Frontend (Next.js)
  - `/api/` → Backend API
  - `/ws/agent` → WebSocket (到 TEN Agent)
  - `/health` → 健康检查

### 生产环境 SSL 证书

开发环境的自签名证书仅用于测试，生产环境建议使用：

**Let's Encrypt (免费)**:
```bash
# 安装 certbot
sudo apt-get install certbot

# 生成证书
sudo certbot certonly --standalone -d your-domain.com

# 证书路径
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# 更新 nginx/nginx.conf 中的证书路径
```

**或使用云服务商提供的 SSL 证书**：阿里云、腾讯云、AWS ACM 等

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
- 生产环境：必须配置 HTTPS（见上方章节）

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
