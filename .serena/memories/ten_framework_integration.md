# TEN Framework 集成方案

## 1. 架构变更

根据用户指示 "先A再B"，采用分层架构：

### Phase A: TEN Framework (实时音频层)
```
用户 (PWA/ESP32)
      │ Agora RTC
      ▼
TEN Agent Graph
  ┌──────────────────────────────────────────────────┐
  │ agora_rtc → silero_vad → funasr_asr → glm_llm   │
  │                                         │        │
  │           backend_webhook ←─────────────┘        │
  │                 │                                │
  │           cosyvoice_tts ←───────────────┘        │
  │                 │                                │
  │           agora_rtc (playback) ←────────┘        │
  └──────────────────────────────────────────────────┘
```

### Phase B: agent-sdk (业务层)
```
TEN Agent
    │ Webhook
    ▼
agent-sdk Backend
    │
    ├── 用户配置 (Profile API)
    ├── 会话记录 (Session API)
    ├── 工具执行 (Tool API)
    └── 热词管理 (Hotwords API)
```

## 2. TEN Extensions 实现

### 2.1 FunASR ASR Extension
位置: `ten_agent/ten_packages/extension/funasr_asr_python/`

功能:
- 接收 VAD 分段的音频
- 调用 FunASR/SenseVoice 进行识别
- 支持热词增强
- 输出识别文本

### 2.2 GLM-4 LLM Extension
位置: `ten_agent/ten_packages/extension/glm_llm_python/`

功能:
- 接收 ASR 文本
- 调用 GLM-4 API (OpenAI 兼容)
- 支持 Tool Calling
- 内置工具定义:
  - make_phone_call
  - control_smart_device
  - send_emergency_alert
  - set_reminder
- 专为构音障碍用户优化的系统提示

### 2.3 CosyVoice TTS Extension
位置: `ten_agent/ten_packages/extension/cosyvoice_tts_python/`

功能:
- 接收 LLM 文本
- 调用 CosyVoice API 合成语音
- 流式输出 PCM 音频
- 支持句子级分段合成

### 2.4 Backend Webhook Extension
位置: `ten_agent/ten_packages/extension/backend_webhook_python/`

功能:
- 桥接 TEN Agent 和 agent-sdk
- 记录会话日志
- 获取用户配置
- 转发工具执行请求

## 3. Backend Agent API

新增 `/api/agent` 路由:

| 端点 | 方法 | 描述 |
|------|------|------|
| /profile/:userId | GET | 获取用户配置 |
| /profile/:userId | PUT | 更新用户配置 |
| /session/log | POST | 记录会话 |
| /session/:userId/:sessionId | GET | 获取会话历史 |
| /tool/log | POST | 记录工具执行 |
| /tool/execute | POST | 执行工具 |
| /hotwords/:userId | GET | 获取热词列表 |

## 4. 数据模型

### UserProfile
```typescript
interface UserProfile {
  userId: string
  name: string
  language: string
  preferences: {
    voiceId: string
    speechRate: number
    hotwords: string[]
  }
  contacts: Contact[]
  devices: SmartDevice[]
  emergencyContacts: Contact[]
}
```

### Tool 定义
- make_phone_call: 拨打联系人电话
- control_smart_device: 控制智能家居
- send_emergency_alert: 发送紧急求助
- set_reminder: 设置提醒

## 5. 性能目标

- VAD 延迟: < 50ms
- ASR 延迟: < 300ms  
- LLM 首 Token: < 500ms
- TTS 延迟: < 200ms
- **端到端延迟: < 1.5s**

## 6. 文件清单

创建的文件:
- `ten_agent/manifest.json`
- `ten_agent/property.json`
- `ten_agent/requirements.txt`
- `ten_agent/README.md`
- `ten_agent/ten_packages/extension/funasr_asr_python/manifest.json`
- `ten_agent/ten_packages/extension/funasr_asr_python/extension.py`
- `ten_agent/ten_packages/extension/glm_llm_python/manifest.json`
- `ten_agent/ten_packages/extension/glm_llm_python/extension.py`
- `ten_agent/ten_packages/extension/cosyvoice_tts_python/manifest.json`
- `ten_agent/ten_packages/extension/cosyvoice_tts_python/extension.py`
- `ten_agent/ten_packages/extension/backend_webhook_python/manifest.json`
- `ten_agent/ten_packages/extension/backend_webhook_python/extension.py`
- `backend/src/controllers/agent.controller.ts`

修改的文件:
- `backend/src/index.ts` - 添加 Agent 路由
