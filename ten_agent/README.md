# VoxFlame TEN Agent

**燃言 Agent - 基于 TEN Framework 的语音处理管道**

## 技术栈

- **运行时**: TEN Framework (Go Runtime + Python Extensions)
- **包管理**: tman (TEN Manager)
- **扩展**: ASR + LLM + TTS

## 当前功能 (v1.2)

- 阿里云 ASR (Paraformer-realtime-v2)
- 通义千问 LLM (Qwen3-max) 语音纠正
- CosyVoice TTS 语音合成
- WebSocket 服务 (端口 8766)

## 目录结构

```
ten_agent/
├── extension_src/           # 自定义扩展源码
│   ├── voxflame_main_python/   # 主控制扩展
│   └── websocket_server/       # WebSocket 服务
├── manifest.json            # 远程依赖声明
├── property.json            # 运行时配置 (Graph)
├── Dockerfile               # Docker 构建配置
└── scripts/
    └── start.sh             # 启动脚本
```

## 快速开始

### Docker (推荐)

```bash
# 从项目根目录
sudo docker-compose up -d ten-agent
```

### 查看日志

```bash
sudo docker-compose logs -f ten-agent
```

## 核心配置

### manifest.json

声明远程扩展依赖：

```json
{
  "dependencies": [
    { "type": "extension", "name": "aliyun_asr_bigmodel_python", "version": "0.1.0" },
    { "type": "extension", "name": "openai_llm2_python", "version": "0.1.0" },
    { "type": "extension", "name": "cosy_tts_python", "version": "0.1.0" }
  ]
}
```

### property.json

定义扩展连接图 (Graph)：

```
websocket_server → aliyun_asr → voxflame_main → openai_llm → cosy_tts
                                     ↓
                              websocket_server (字幕 + 音频)
```

## 扩展说明

### websocket_server

WebSocket 服务，处理：
- 接收前端音频流 (PCM 16kHz Base64)
- 发送 ASR/LLM 文本结果
- 发送 TTS 音频 (Base64)

### voxflame_main_python

主控制扩展，负责：
- 协调 ASR → LLM → TTS 数据流
- 用户打断检测 (flush TTS)
- 发送字幕到前端

### aliyun_asr_bigmodel_python

阿里云 ASR 扩展：
- 模型: Paraformer-realtime-v2
- 实时流式识别
- 支持中文

### openai_llm2_python

LLM 扩展 (使用 DashScope API)：
- 模型: Qwen3-max
- 语音纠正 Prompt
- 流式输出

### cosy_tts_python

CosyVoice TTS 扩展：
- 模型: CosyVoice v3
- 音色: longxiaochun
- 16kHz PCM 输出

## 环境变量

```bash
# ten_agent/.env
DASHSCOPE_API_KEY=sk-xxx
```

## 开发经验

### Pure Tman 模式

使用 `tman install` 安装远程扩展，本地扩展手动复制：

```dockerfile
# Dockerfile
RUN tman install
COPY extension_src/ ten_packages/extension/
```

### 扩展注册机制

TEN Runtime 通过 Python import 发现扩展：

```python
from ten_runtime import register_addon_as_extension

@register_addon_as_extension("websocket_server")
class WebSocketServerExtension(AsyncExtension):
    ...
```

### 消息类型

TEN Framework 消息格式：

```json
// 文本数据
{ "type": "data", "name": "corrected_text", "data": { "text": "..." } }

// 音频数据
{ "type": "audio", "audio": "base64...", "metadata": { "sample_rate": 16000 } }

// 错误
{ "type": "error", "error": "..." }
```

### 常见问题

**1. 扩展未找到**
- 检查 `PYTHONPATH` 是否包含 `ten_packages`
- 检查扩展目录结构是否正确

**2. ASR 无响应**
- 检查 `DASHSCOPE_API_KEY` 是否配置
- 检查音频格式是否为 PCM 16kHz

**3. TTS 无声音**
- 检查 LLM 是否返回了文本
- 检查前端 AudioContext 是否初始化

## 相关文档

- [主项目 README](../README.md)
- [前端 README](../frontend/README.md)
- [后端 README](../backend/README.md)
- [TEN Framework 文档](https://docs.ten.ai)
