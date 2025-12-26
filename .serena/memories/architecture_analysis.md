# 燃言 VoxFlame 架构分析

## 1. 现有组件关系

```
┌─────────────────────────────────────────────────────────────────┐
│                      用户交互层                                  │
│   PWA (Next.js) ←──WebSocket──→ Backend (Express)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     agent-sdk 调度层                             │
│                                                                 │
│  Redis Stream: tasks:asr, tasks:agent                           │
│  - AgentSDK: 客户端入口 (transcribe, chat)                       │
│  - TaskDispatcher: 任务路由到正确的 Worker Stream                │
│  - StreamManager: Redis Stream 消息发布/订阅/消费                │
│  - WorkerPool: Worker 健康检查和负载均衡                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ai-workers 执行层                           │
│                                                                 │
│  BaseWorker → ASRWorkerBase / AgentWorkerBase                   │
│  - FunASR ASR Worker (已实现)                                    │
│  - GLM Agent Worker (需实现)                                     │
│  - CosyVoice TTS Worker (需实现)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 关键文件

### agent-sdk (基础设施层)
- `client.py`: AgentSDK 客户端入口
- `worker_base.py`: BaseWorker, ASRWorkerBase, AgentWorkerBase 基类
- `stream/stream_manager.py`: Redis Stream 管理
- `dispatcher/task_dispatcher.py`: 任务调度器

### ai-workers (执行层)
- `asr/funasr_worker.py`: FunASR 语音识别 (保留)
- `agent/qwen_agent.py`: 通义千问 Agent (删除，改用 GLM)
- `agent/glm_agent.py`: GLM-4.7 Agent + Tool Calling (需创建)
- `tts/cosyvoice_worker.py`: CosyVoice TTS (需创建)

### shared/models (数据模型)
- `agent.py`: AgentTask, AgentResult, ToolCall, ToolDefinition
- `asr.py`: ASRTask, ASRResult

### backend (WebSocket 网关)
- 当前直接调用云 ASR 服务
- 应修改为通过 agent-sdk 调度

## 3. 技术栈确认

| 组件 | 技术选型 |
|------|----------|
| LLM | GLM-4.7 (智谱) |
| ASR | FunASR/SenseVoice (本地) |
| TTS | CosyVoice (本地) |
| 消息队列 | Redis Stream |
| 后端 | Express + WebSocket |
| 前端 | Next.js PWA |

## 4. TEN Framework 决策

- 当前阶段不引入 TEN Framework
- agent-sdk 已提供足够的任务调度能力
- TEN Framework 作为未来 ESP32 集成的备选方案

## 5. 核心接口

### Frontend ↔ Backend
```
WebSocket: /ws/asr
- 客户端发送: Binary PCM 音频 或 JSON {"type": "end"}
- 服务端返回: {"type": "result", "data": {text, confidence}}
```

### agent-sdk 调用
```python
sdk = AgentSDK(config)
await sdk.connect()
result = await sdk.chat(input_data, user_id, context, options)
```

### Redis Stream 消息
```
tasks:asr → ASR Worker
tasks:agent → Agent Worker
results:{task_id} → 结果返回
```
