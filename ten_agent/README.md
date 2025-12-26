# TEN Agent - 燃言 VoxFlame

基于 TEN Framework 的实时语音交互 Agent，专为构音障碍用户设计。

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                     TEN Agent Graph                        │
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │ Agora    │──▶│ Silero   │──▶│ FunASR   │──▶│ GLM-4    │ │
│  │ RTC      │   │ VAD      │   │ ASR      │   │ LLM      │ │
│  └──────────┘   └──────────┘   └──────────┘   └────┬─────┘ │
│       ▲                                            │       │
│       │                                            ▼       │
│  ┌────┴─────┐                              ┌──────────────┐│
│  │ pcm_frame│◀─────────────────────────────│ CosyVoice   ││
│  └──────────┘                              │ TTS         ││
│                                            └──────────────┘│
│                              │                             │
│                              ▼                             │
│                       ┌──────────────┐                     │
│                       │ Backend      │                     │
│                       │ Webhook      │──────▶ agent-sdk    │
│                       └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Extensions

### 1. FunASR ASR Extension (`funasr_asr_python`)
- 基于阿里 FunASR/SenseVoice 的语音识别
- 支持热词增强，提升构音障碍识别准确率
- 流式识别，低延迟

### 2. GLM-4 LLM Extension (`glm_llm_python`)
- 基于智谱 GLM-4 的大语言模型
- 支持 Tool Calling（函数调用）
- 专为构音障碍用户优化的系统提示
- 内置工具：拨打电话、智能家居、紧急求助、设置提醒

### 3. CosyVoice TTS Extension (`cosyvoice_tts_python`)
- 基于阿里 CosyVoice 的语音合成
- 多种音色选择
- 流式音频输出

### 4. Backend Webhook Extension (`backend_webhook_python`)
- 桥接 TEN Agent 与 agent-sdk 业务层
- 会话记录存储
- 用户配置获取
- 后端工具执行

## 配置

### 环境变量

```bash
# GLM-4 API
export GLM_API_KEY=your_api_key

# CosyVoice TTS
export COSYVOICE_API_URL=http://localhost:50000

# agent-sdk Backend
export AGENT_SDK_URL=http://localhost:3001

# Agora RTC
export AGORA_APP_ID=your_app_id
export AGORA_APP_CERTIFICATE=your_certificate
```

### Graph 配置

编辑 `property.json` 配置 Agent Graph：

```json
{
  "graphs": [{
    "name": "voxflame_graph",
    "nodes": [
      {"type": "extension", "name": "agora_rtc", ...},
      {"type": "extension", "name": "silero_vad", ...},
      {"type": "extension", "name": "funasr_asr", ...},
      {"type": "extension", "name": "glm_llm", ...},
      {"type": "extension", "name": "cosyvoice_tts", ...},
      {"type": "extension", "name": "backend_webhook", ...}
    ],
    "connections": [...]
  }]
}
```

## 运行

### 本地开发

```bash
# 安装依赖
pip install -r requirements.txt

# 启动 Agent
ten_agent start --graph voxflame_graph
```

### Docker 部署

```bash
docker build -t voxflame-agent .
docker run -p 8080:8080 --env-file .env voxflame-agent
```

## 数据流

1. **音频输入**: Agora RTC 接收用户音频
2. **VAD**: Silero VAD 检测语音活动
3. **ASR**: FunASR 将语音转文本
4. **LLM**: GLM-4 理解意图并生成回复
5. **Tool Calling**: 如需要，执行工具调用
6. **TTS**: CosyVoice 将文本转语音
7. **音频输出**: Agora RTC 发送音频给用户
8. **日志**: Backend Webhook 记录会话到 agent-sdk

## 与 agent-sdk 集成

TEN Agent 通过 Backend Webhook Extension 与 agent-sdk 业务层集成：

- **会话存储**: 保存 ASR/LLM 交互记录
- **用户配置**: 获取用户偏好、联系人、热词
- **工具执行**: 通过后端执行实际操作（拨号、控制设备等）

## 性能指标

- VAD 延迟: < 50ms
- ASR 延迟: < 300ms
- LLM 首 Token: < 500ms
- TTS 延迟: < 200ms
- **端到端延迟: < 1.5s**

## License

MIT
