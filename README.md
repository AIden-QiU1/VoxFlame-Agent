# 🔥 燃言 VoxFlame Agent

<p align="center">
  <strong>🎤 点燃你的声音 · Ignite Your Voice</strong><br>
  <em>为2000万构音障碍患者打造的AI实时会话支持人</em>
</p>

---

## 📖 产品概述

**VoxFlame** 是一款AI驱动的实时会话助手，专为构音障碍患者设计。

### 核心价值
> 不是"纠正"你的发音，而是**理解**你的意图，帮你清晰表达

- **实时理解**: ASR识别 → LLM智能纠错 → 意图理解
- **记忆学习**: PowerMem学习你的发音模式，越用越懂
- **代理模式**: AI帮你生成清晰语音，让对方听懂你

### 目标用户
中国2000万构音障碍患者（脑卒中、帕金森、脑瘫、老年退化）

**核心痛点**:
- 普通ASR识别准确率<30%
- 家人需要"翻译"，每天额外2-3小时负担
- 68%患者因沟通困难减少外出

**详细介绍**: 查看 [产品需求文档 (PRD)](docs/PRD.md)

---

## 🏗️ 系统架构 (MVP V0.1)

### 技术栈
```
Frontend:  Next.js 14 + TypeScript + TailwindCSS
Backend:   Express + TypeScript + Supabase
AI Agent:  TEN Framework + Python
存储:      SQLite + FAISS (向量检索)
ASR/LLM:   DashScope API (阿里云灵积)
```

### 架构图
```
┌─────────────────────────────────────────────────┐
│  Frontend (Next.js) - Port 3000                │
│  - PWA离线支持                                  │
│  - WebSocket实时通信                             │
│  - Audio录制 (MediaRecorder)                    │
└──────────────┬──────────────────────────────────┘
               │ HTTP REST API
               │
┌──────────────▼──────────────────────────────────┐
│  Backend (Express) - Port 3001                 │
│  ✅ Session API (/api/session/*)               │
│  ✅ Memory API (/api/memory/*)                 │
│  ✅ Agent API (/api/agent/*)                   │
└──────────────┬──────────────────────────────────┘
               │ HTTP (axios)
               │
┌──────────────▼──────────────────────────────────┐
│  TEN Agent HTTP API Server - Port 8080         │
│  ✅ POST /start - 创建会话                      │
│  ✅ POST /stop - 停止会话 + 持久化              │
│  ✅ POST /reload-hotwords - 动态热词            │
│  ✅ GET /health - 健康检查                      │
└──────────────┬──────────────────────────────────┘
               │
     ┌─────────┴──────────────┐
     │                         │
┌────▼────────┐    ┌──────────▼───────────────┐
│  TEN Agent   │    │  SQLite Backend          │
│              │    │  ✅ PowerMemSQLiteBackend│
│  ⏳ FunASR  │◄──►│  ✅ FAISS向量索引 (384维)│
│  ⏳ GLM LLM │    │  ✅ WAL模式 (并发读写)   │
│  ⏳ CosyVoice│    │  ✅ <50ms检索            │
└──────────────┘    └──────────────────────────┘
       │ WebSocket :8765
       │
┌──────▼──────┐
│  Frontend    │
│  Audio Stream│
└──────────────┘
```

### 数据流
```
用户说话 → Frontend录音 → WebSocket推送
         → TEN Agent ASR识别
         → PowerMem检索历史上下文 (SQLite + FAISS)
         → LLM理解 + 纠错
         → TTS生成清晰语音
         → WebSocket返回 → Frontend播放
```

---

## ✅ 当前进度

### 已完成 ✅

| Phase | 功能 | 描述 |
|-------|------|------|
| 1-4 | 后端核心 | Express API + TEN Agent + SQLite + FAISS |
| 5 | ASR集成 | DashScope paraformer-realtime-v2 |
| 6 | DashScope扩展 | dashscope_asr_python + dashscope_tts_python |
| 7 | Supabase同步 | 云端 sessions, memories, profiles 同步 |
| 8 | 前端WebSocket | /chat 对话页面 + useAgent Hook |

### 下一步 ⏳

- [ ] **Phase 9**: 端到端集成测试
- [ ] **Phase 10**: 部署优化与文档完善

### 技术亮点

- **DashScope全栈**: ASR (paraformer) + TTS (cosyvoice) + Embedding (text-embedding-v3)
- **本地+云端混合**: SQLite+FAISS 本地存储 + Supabase 云端同步
- **PWA支持**: 离线可用，支持安装到桌面
- **无障碍设计**: 大字体、高对比度、键盘快捷键

---

## 🛠️ 开发指南

### 环境安装

#### 系统要求
- Ubuntu 22.04+
- Python 3.10+
- Node.js 18+
- 磁盘空间: ~2GB

#### 1. 克隆项目
```bash
git clone https://github.com/yourusername/VoxFlame-Agent.git
cd VoxFlame-Agent
```

#### 2. Backend安装
```bash
cd backend
npm install
cp .env.example .env  # 配置环境变量
npm run dev  # 启动开发服务器 (Port 3001)
```

#### 3. TEN Agent安装
```bash
cd ../
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install faiss-cpu==1.9.0 numpy aiohttp pydantic python-dotenv

# 配置DashScope API Key
echo "DASHSCOPE_API_KEY=your_api_key" > ten_agent/.env

# 启动TEN Agent HTTP API Server
cd ten_agent/ten_packages/extension/http_api_server_python
python -c "
import asyncio, sys
sys.path.insert(0, '.')
from extension import HttpApiServerExtension

async def run():
    server = HttpApiServerExtension('voxflame')
    await server.start()
    await asyncio.Event().wait()

asyncio.run(run())
"
```

#### 4. Frontend安装
```bash
cd frontend
npm install
cp .env.local.example .env.local  # 配置环境变量
npm run dev  # 启动开发服务器 (Port 3000)
```

#### 5. 运行集成测试
```bash
cd /root/VoxFlame-Agent
source venv/bin/activate
python test_integration.py
```

**预期输出**:
```
✅ PASS - Health Checks
✅ PASS - Session Lifecycle
✅ PASS - Hotwords Reload
🎉 All tests passed!
```

---

## 👥 团队协作

### 后端工程师任务

**已完成** ✅:
- [x] Express服务器搭建
- [x] Session API实现 (4个端点)
- [x] Memory API实现
- [x] Agent API实现
- [x] Supabase Service集成
- [x] Supabase Sessions/Memories/Profiles CRUD
- [x] 集成测试脚本

**进行中** ⏳:
- [ ] WebSocket连接管理优化
- [ ] 错误处理优化
- [ ] API文档生成 (Swagger)

**技术栈**:
- Express + TypeScript
- Supabase Client
- axios (HTTP Client)
- WebSocket

**关键文件**:
- `backend/src/controllers/session.controller.ts`
- `backend/src/services/supabase.service.ts`
- `backend/src/index.ts`

---

### 前端工程师任务

**已完成** ✅:
- [x] Next.js 14项目搭建
- [x] TailwindCSS配置
- [x] PWA配置 (Service Worker)
- [x] 基础UI组件
- [x] Audio录制组件 (MediaRecorder API)
- [x] WebSocket Hook (`useAgent`)
- [x] /chat 对话页面
- [x] ChatInterface 对话组件

**进行中** ⏳:
- [ ] 会话历史页面
- [ ] 用户设置页面 (热词管理)

**技术栈**:
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- React Hooks

**关键文件**:
- `frontend/src/hooks/useVoiceChat.ts` (待实现)
- `frontend/src/components/AudioRecorder.tsx` (待实现)
- `frontend/src/app/chat/page.tsx`

---

### AI工程师任务

**已完成** ✅:
- [x] SQLite Backend存储层 (PowerMemSQLiteBackend)
- [x] FAISS向量索引集成 (512维)
- [x] TEN Agent HTTP API Server
- [x] 会话管理逻辑
- [x] DashScope ASR API集成 (paraformer-realtime-v2)
- [x] DashScope TTS API集成 (cosyvoice-v3-flash)
- [x] DashScope Embedding API集成 (text-embedding-v3, 512维)
- [x] PowerMem上下文召回逻辑
- [x] Supabase云端同步模块

**进行中** ⏳:
- [ ] FunASR本地模型接口 (预留)
- [ ] GLM LLM集成
- [ ] 端到端调试

**技术栈**:
- TEN Framework (Python)
- DashScope SDK
- FAISS (faiss-cpu)
- SQLite3
- aiohttp

**关键文件**:
- `ten_agent/storage/sqlite_backend.py`
- `ten_agent/ten_packages/extension/http_api_server_python/extension.py`
- `ten_agent/ten_packages/extension/main_python/extension.py` (待扩展)
- `ten_agent/ten_packages/extension/funasr_asr_python/extension.py` (待实现)

## 📊 技术亮点

### 1. 无Docker依赖方案

| 特性 | OceanBase (原计划) | SQLite (实际) |
|------|-------------------|--------------|
| 部署方式 | Docker容器 | 嵌入式 |
| 磁盘占用 | ~10GB | ~100MB |
| 内存占用 | ~1GB | ~10MB |
| 并发能力 | 1000+ | 5-10 (MVP足够) |
| 启动时间 | 30-60秒 | <1秒 |

**为什么不用OceanBase？**
AutoDL容器环境不支持Docker嵌套，SQLite方案功能等价且更轻量。

### 2. FAISS向量检索性能

```python
# 基准测试 (10K向量)
index_size = 10,000
query_time = 0.8ms  # L2距离计算
top_k = 5
total_latency = <1ms  # 包含SQLite元数据查询
```

### 3. WAL模式并发优化

```sql
PRAGMA journal_mode=WAL;      -- Write-Ahead Logging
PRAGMA synchronous=NORMAL;    -- 平衡安全与性能
-- 结果: 并发读 + 串行写，无锁阻塞
```

---

## ��️ 路线图

### V0.1 - MVP (当前, Week 1-6)
- [x] 后端核心架构 (Phase 1-4)
- [x] ASR/TTS/Embedding API集成 (Phase 5-6)
- [x] Supabase云端同步 (Phase 7)
- [x] 前端WebSocket对话 (Phase 8)
- [ ] 端到端集成测试 (Phase 9)
- [ ] 5用户内测

### V0.2 - 动态热词 (Week 7-12)
- [ ] 用户自定义热词管理
- [ ] 热词动态生效 (无需重启)
- [ ] 热词学习推荐

### V1.0 - 本地部署 (Q3 2025)
- [ ] FunASR本地模型
- [ ] GLM本地推理
- [ ] 离线PWA功能
- [ ] 100用户公测

### V2.0 - 多模态交互 (Q4 2025)
- [ ] 视觉辅助 (唇语识别)
- [ ] 手势识别
- [ ] 表情建议

---

## 📄 文档

- [产品需求文档 (PRD)](docs/PRD.md)
- [API规范文档](docs/API_SPECIFICATION.md)
- [用户调研报告](docs/USER_RESEARCH_DYSARTHRIC_ELDERLY_CN.md)
- [TEN Framework架构](backend/src/ARCHITECTURE.md)

---

## 🤝 贡献

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

---

## 📞 联系我们

- 项目维护: [GitHub Issues](https://github.com/yourusername/VoxFlame-Agent/issues)
- 商务合作: contact@voxflame.ai

---

<p align="center">
  <strong>让每个声音都被听见 🔥</strong>
</p>
