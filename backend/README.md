# VoxFlame Backend

**燃言后端 - API 服务 + WebSocket 代理**

## 技术栈

- **框架**: Express.js + TypeScript
- **WebSocket**: ws 库
- **功能**: REST API + WebSocket 代理

## 当前功能 (v1.2)

- WebSocket 代理 (前端 ↔ TEN Agent)
- 健康检查 API
- CORS 支持

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

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/ws/agent` | WS | WebSocket 代理 |

## 环境变量

```bash
# .env
PORT=3001
TEN_AGENT_URL=ws://ten-agent:8766
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
