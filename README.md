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

### Phase 1-4: 后端核心 (已完成 ✅)

**集成测试结果**:
```
✅ PASS - Health Checks (Backend + TEN Agent)
✅ PASS - Session Lifecycle (Start → Stop)
✅ PASS - Hotwords Reload (动态更新)
```

**已实现组件**:

1. **SQLite Backend存储层** ✅
   - 文件: `ten_agent/storage/sqlite_backend.py`
   - 功能: SQLite + FAISS向量索引
   - 性能: 插入<0.1秒, 检索<1ms
   - 并发: WAL模式支持多读单写

2. **TEN Agent HTTP API Server** ✅
   - 目录: `ten_agent/ten_packages/extension/http_api_server_python/`
   - 端点: /start, /stop, /reload-hotwords, /health
   - 框架: aiohttp

3. **Backend Session API** ✅
   - 文件: `backend/src/controllers/session.controller.ts`
   - 端点: POST /start, POST /stop, GET /:sessionId, POST /reload-hotwords
   - 集成: axios → TEN Agent HTTP Client

4. **集成测试** ✅
   - 文件: `test_integration.py`
   - 覆盖: 健康检查、会话生命周期、热词更新

### Phase 5-8: AI能力集成 (进行中 ⏳)

5. **ASR集成** ⏳ (预计2小时)
   - API模式: DashScope Paraformer API
   - 本地模式: FunASR模型 (预留接口)
   - 实时流式识别

6. **PowerMem集成** ⏳ (预计1.5小时)
   - DashScope text-embedding-v1 (384维向量)
   - 上下文召回 (Top-K=5)
   - 实时记忆更新

7. **Supabase持久化** ⏳ (预计1小时)
   - Sessions表 (会话元数据)
   - Users表 (用户配置、热词)
   - Memories表 (可选，分析用)

8. **前端WebSocket** ⏳ (预计2小时)
   - Audio录制 (MediaRecorder API)
   - WebSocket双向流
   - 实时转写显示

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
- [x] 集成测试脚本

**进行中** ⏳:
- [ ] Supabase Sessions表CRUD
- [ ] Supabase Users表CRUD
- [ ] WebSocket连接管理
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

**进行中** ⏳:
- [ ] Audio录制组件 (MediaRecorder API)
- [ ] WebSocket Hook (`useVoiceChat`)
- [ ] 实时转写显示UI
- [ ] 会话管理页面
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

**示例代码** (useVoiceChat Hook):
```typescript
// frontend/src/hooks/useVoiceChat.ts
export const useVoiceChat = (sessionId: string) => {
  const [transcript, setTranscript] = useState('');
  const ws = useRef<WebSocket>();
  
  useEffect(() => {
    // 1. 创建会话
    const startSession = async () => {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_001', hotwords: [] })
      });
      const { websocketUrl } = await res.json();
      
      // 2. 建立WebSocket连接
      ws.current = new WebSocket(websocketUrl);
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'asr_result') {
          setTranscript(prev => prev + data.text);
        }
      };
    };
    
    startSession();
    
    return () => ws.current?.close();
  }, [sessionId]);
  
  const sendAudio = (audioBlob: Blob) => {
    ws.current?.send(audioBlob);
  };
  
  return { sendAudio, transcript };
};
```

---

### AI工程师任务

**已完成** ✅:
- [x] SQLite Backend存储层 (PowerMemSQLiteBackend)
- [x] FAISS向量索引集成
- [x] TEN Agent HTTP API Server
- [x] 会话管理逻辑

**进行中** ⏳:
- [ ] DashScope ASR API集成
- [ ] DashScope Embedding API集成
- [ ] PowerMem上下文召回逻辑
- [ ] FunASR本地模型接口 (预留)
- [ ] GLM LLM集成
- [ ] CosyVoice TTS集成

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

**示例代码** (ASR API Client):
```python
# ten_agent/services/asr_api_client.py
import dashscope

class DashScopeASRClient:
    def __init__(self, api_key: str):
        dashscope.api_key = api_key
    
    async def transcribe_audio(self, audio_bytes: bytes) -> str:
        """
        调用DashScope Paraformer API进行语音识别
        """
        response = await dashscope.audio.asr.AsyncTranscription.call(
            model='paraformer-realtime-v1',
            format='pcm',
            sample_rate=16000,
            audio=audio_bytes
        )
        return response.output.text
```

---

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
- [ ] ASR/LLM/TTS API集成 (Phase 5-8)
- [ ] 前端基础UI + WebSocket
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
