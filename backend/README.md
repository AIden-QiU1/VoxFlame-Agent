# VoxFlame Backend

**燃言后端 - API 服务 + WebSocket 代理 + 记忆系统**

## 技术栈

- **框架**: Express.js + TypeScript
- **WebSocket**: ws 库
- **数据库**: Supabase PostgreSQL (记忆元数据)
- **向量检索**: FAISS (本地) / Qdrant (未来)
- **功能**: REST API + WebSocket 代理 + 记忆管理

## 当前功能 (v2.1)

- WebSocket 代理 (前端 ↔ TEN Agent) + 用户认证
- 健康检查 API
- CORS 支持
- **记忆系统 API** (v2.1 新增)
- **常用短语 API** (v2.0 新增)

## 目录结构

```
backend/
├── src/
│   └── index.ts          # 主入口 (API + WebSocket 代理)
├── package.json
├── tsconfig.json
└── Dockerfile
```

## 快速开始

### Docker (推荐)

```bash
# 从项目根目录
sudo docker-compose up -d backend
```

### 本地开发

```bash
cd backend
npm install
npm run dev
```

服务运行在 http://localhost:3001

## 核心功能

### WebSocket 代理

解决 VSCode Remote SSH 不支持 WebSocket 端口转发的问题：

```
Frontend (3000) → Backend (3001/ws/agent) → TEN Agent (8766)
```

**关键代码** (`src/index.ts`):

```typescript
// WebSocket 代理
wss.on('connection', (clientWs, req) => {
  if (req.url === '/ws/agent') {
    const agentWs = new WebSocket('ws://ten-agent:8766')

    // 转发 Agent → Client
    agentWs.on('message', (data) => {
      clientWs.send(data.toString())
    })

    // 转发 Client → Agent
    clientWs.on('message', (data) => {
      agentWs.send(data.toString())
    })
  }
})
```

### API 端点

### 核心 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/ws/agent` | WS | WebSocket 代理 |

### 记忆系统 API (v2.1 新增)

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/memory/add` | POST | 添加记忆 | ✅ |
| `/api/memory/search` | GET | 语义检索记忆 | ✅ |
| `/api/memory/user/:userId` | GET | 获取用户所有记忆 | ✅ |
| `/api/memory/:memoryId` | PUT | 更新记忆 | ✅ |
| `/api/memory/:memoryId` | DELETE | 删除记忆 | ✅ |
| `/api/memory/hotwords/:userId` | GET | 获取用户热词 | ✅ |
| `/api/memory/stats/:userId` | GET | 获取记忆统计 | ✅ |

**添加记忆请求示例**:
```json
{
  "user_id": "uuid",
  "content": "用户喜欢用简短句子表达",
  "memory_type": "preference",
  "metadata": { "source": "conversation" }
}
```

**检索记忆请求示例**:
```
GET /api/memory/search?user_id=xxx&query=用户偏好&limit=10
```

### 常用短语 API (v2.0)

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/phrases` | POST | 创建短语 | ✅ |
| `/api/phrases/user/:userId` | GET | 获取用户短语 | ✅ |
| `/api/phrases/:phraseId` | PUT | 更新短语 | ✅ |
| `/api/phrases/:phraseId` | DELETE | 删除短语 | ✅ |
| `/api/phrases/:phraseId/use` | POST | 增加使用次数 | ✅ |
| `/api/phrases/reorder` | POST | 重排序短语 | ✅ |
| `/api/phrases/presets/initialize` | POST | 初始化预设 | ✅ |

## 环境变量

```bash
# .env
PORT=3001
TEN_AGENT_URL=ws://ten-agent:8766

# Supabase (认证 + 数据库)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # 后端管理操作

# 记忆系统 (可选)
QDRANT_URL=http://qdrant:6333  # Phase 3
```

## 开发经验

### WebSocket 消息转发

TEN Agent 发送的消息类型：
- `data`: ASR/LLM 文本结果
- `audio`: TTS 音频 (Base64)
- `error`: 错误信息

```typescript
agentWs.on('message', (data) => {
  const msg = JSON.parse(data.toString())

  if (msg.type === 'audio') {
    console.log(`Audio: ${msg.audio?.length} chars`)
  } else if (msg.type === 'data') {
    console.log(`Data: ${msg.name}`)
  }

  // 转发到客户端
  clientWs.send(data.toString())
})
```

### 连接状态管理

处理 Agent 连接延迟：

```typescript
let isAgentConnected = false
const pendingMessages: string[] = []

agentWs.on('open', () => {
  isAgentConnected = true
  // 发送排队的消息
  pendingMessages.forEach(msg => agentWs.send(msg))
  pendingMessages.length = 0
})

clientWs.on('message', (data) => {
  if (isAgentConnected) {
    agentWs.send(data.toString())
  } else {
    pendingMessages.push(data.toString())
  }
})
```

### Docker 网络

容器间通信使用服务名：

```typescript
// 在 Docker 中
const agentUrl = 'ws://ten-agent:8766'

// 本地开发
const agentUrl = 'ws://localhost:8766'
```

## 日志

查看后端日志：

```bash
sudo docker-compose logs -f backend
```

典型日志输出：

```
[WS Proxy] 新客户端连接
[WS Proxy] Agent 连接成功
[WS Proxy] <- Agent: data/corrected_text
[WS Proxy] <- Agent: audio (10668 chars)
[WS Proxy] 客户端断开连接: 1000
```

## 相关文档

- [主项目 README](../README.md)
- [前端 README](../frontend/README.md)
- [Agent README](../ten_agent/README.md)
- [统一记忆系统报告](../docs/VOXFLAME_UNIFIED_MEMORY_REPORT_2026-03-05.md)

---

## 记忆系统架构 (v2.1)

### 双层存储架构

```
┌──────────────────────────────────────────────────────────────┐
│                    VoxFlame Memory Stack                     │
├──────────────────────────────────────────────────────────────┤
│  TEN Agent (memory_layer_python)                             │
│  • 实时语音画像 (混淆模式、热词、清晰度)                        │
│  • 会话事件处理                                               │
│  • SQLite 本地存储                                            │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Backend (Node.js)                                           │
│  • REST API (CRUD)                                           │
│  • FAISS 语义检索                                             │
│  • Supabase 元数据同步                                        │
└──────────────────────────────────────────────────────────────┘
```

### 记忆类型

| 类型 | 描述 | 存储位置 |
|------|------|---------|
| **preference** | 用户偏好 | Supabase |
| **fact** | 个人事实 | Supabase + 本地 |
| **correction** | ASR 纠错记录 | 本地 SQLite |
| **hotword** | 个人热词 | 本地 + Supabase |
| **session** | 会话摘要 | Supabase |

### 文件结构

```
~/.voxflame/
├── memory.db          # SQLite 数据库
├── MEMORY.md          # 长期记忆 (用户画像)
├── faiss_index/       # FAISS 向量索引
└── daily/
    └── 2026-03-02.md  # 每日日志
```

### 热词学习机制

当用户说话被 ASR 识别后，经过 LLM 纠错：
1. 原始文本 ≠ 纠错文本 → 产生纠错事件
2. 记忆层分析混淆模式 (拼音相似性)
3. 累计 3 次以上 → 自动加入热词表
4. 下次 ASR 调用时注入热词
