# VoxFlame Frontend

**燃言前端 - 语音转换助手界面**

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI**: React 18 + Tailwind CSS
- **PWA**: @ducanh2912/next-pwa
- **音频**: Web Audio API + AudioWorklet

## 当前功能 (v1.2)

- Google 风格简洁 UI
- 点击式录音交互
- 实时字幕显示 (LLM 纠正后)
- TTS 音频播放
- WebSocket 连接 (通过后端代理)

## 目录结构

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx           # 主页 - 语音转换
│   │   ├── ranyan/            # 关于燃言
│   │   └── contribute/        # 贡献声音
│   ├── hooks/
│   │   └── useAgent.ts        # Agent 连接 Hook
│   ├── lib/
│   │   ├── websocket/
│   │   │   └── agent-client.ts # WebSocket 客户端
│   │   ├── audio/
│   │   │   └── audio-processor.ts # 音频处理
│   │   └── config.ts          # 配置
│   └── components/
│       └── pwa/               # PWA 组件
├── public/
│   ├── manifest.json          # PWA 配置
│   └── sw.js                  # Service Worker
└── Dockerfile
```

## 快速开始

### Docker (推荐)

```bash
# 从项目根目录
sudo docker-compose up -d frontend
```

### 本地开发

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

## 核心组件

### useAgent Hook

管理 WebSocket 连接和录音状态：

```typescript
const {
  isConnected,      // 连接状态
  isRecording,      // 录音状态
  currentResponseText, // 当前响应文字
  messages,         // 消息历史
  toggleRecording,  // 切换录音
} = useAgent({ enableTTS: true, autoConnect: true })
```

### AgentClient

WebSocket 客户端，处理：
- 音频发送 (PCM 16kHz Base64)
- 消息接收 (ASR/LLM/TTS)
- 音频播放 (AudioContext)

```typescript
// 连接到后端代理
const client = new AgentClient()
await client.connect(callbacks)

// 发送音频
client.sendAudio(pcmData)
```

## 音频格式

| 参数 | 值 |
|------|-----|
| 格式 | PCM |
| 采样率 | 16000 Hz |
| 位深 | 16-bit |
| 声道 | Mono |

## 环境变量

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AGENT_WS_URL=ws://localhost:3001/ws/agent
```

## 开发经验

### 浏览器自动播放策略

AudioContext 必须在用户交互后初始化：

```typescript
// 在用户点击后调用
await client.initAudio()
```

### WebSocket 代理

前端通过后端代理连接 TEN Agent：

```
Frontend (3000) → Backend (3001/ws/agent) → TEN Agent (8766)
```

### Docker 缓存问题

代码更新后需要重新构建：

```bash
sudo docker-compose build frontend --no-cache
sudo docker-compose up -d frontend
```

## 相关文档

- [主项目 README](../README.md)
- [后端 README](../backend/README.md)
- [Agent README](../ten_agent/README.md)
