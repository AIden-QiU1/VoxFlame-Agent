# TEN Framework 核心扩展深度分析报告

> 更新时间: 2025年12月
> 分析范围: TEN Agent 核心扩展生态

---

## 一、TEN扩展生态概述

TEN Framework 提供了丰富的扩展生态，支持Voice Agent的全流程开发。本报告分析了以下核心扩展：

| 类别 | 扩展 | 功能 |
|------|------|------|
| **语音活动检测** | `ten_vad_python` | 音频帧级别的语音检测 |
| **轮次检测** | `ten_turn_detection` | 语义级别的轮次判断 |
| **消息收集** | `message_collector2` | 文本分片传输 |
| **LLM控制** | `glue_python_async` | 主控制器，LLM交互 |
| **Webhook** | `text_webhook` | 文本数据外发 |
| **流适配** | `streamid_adapter` | 音频流ID适配 |

---

## 二、核心扩展详解

### 2.1 Message Collector2 (消息收集器)

**作用**: 将大文本分片传输，避免单次传输数据过大

**源码路径**: `ten_packages/extension/message_collector2/`

**核心逻辑**:
```python
# 接收消息并分片
async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
    if name == DATA_IN_MESSAGE:
        message_id = str(uuid.uuid4())[:8]
        chunks = _text_to_base64_chunks(ten_env, message, message_id)
        for chunk in chunks:
            await self._queue_message(chunk)
    elif name == DATA_IN_FLUSH:
        # 清空队列
        while not self.queue.empty():
            await self.queue.get()
```

**分片格式**:
```
{message_id}|{part_index}|{total_parts}|{base64_content}
```

**配置**:
- `MAX_CHUNK_SIZE_BYTES = 1024` (每个分片最大1KB)
- 发送间隔: 40ms (`await asyncio.sleep(0.04)`)

**输入/输出**:
| 方向 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 输入 | message | Data | 原始文本消息 |
| 输入 | flush | Data | 清空队列命令 |
| 输出 | data | Data | 分片后的数据 |

---

### 2.2 Glue Python Async (主控制器)

**作用**: Voice Agent的核心控制器，负责LLM交互和消息路由

**源码路径**: `ten_packages/extension/glue_python_async/`

**核心架构**:
```
                    ┌─────────────────────────────────────────┐
                    │         AsyncGlueExtension              │
                    ├─────────────────────────────────────────┤
                    │                                         │
                    │  ┌─────────────┐   ┌────────────────┐  │
                    │  │ ChatMemory  │   │  Tool Handler  │  │
                    │  │ (历史管理)  │   │   (工具调用)   │  │
                    │  └─────────────┘   └────────────────┘  │
                    │                                         │
                    │  ┌─────────────┐   ┌────────────────┐  │
                    │  │  Streaming  │   │ Sentence Parse │  │
                    │  │  Chat API   │   │  (分句输出)    │  │
                    │  └─────────────┘   └────────────────┘  │
                    │                                         │
                    └─────────────────────────────────────────┘
```

**配置参数** (`GlueConfig`):
```python
@dataclass
class GlueConfig(BaseConfig):
    api_url: str = "http://localhost:8000/chat/completions"
    token: str = ""
    prompt: str = ""                  # 系统提示词
    max_history: int = 10             # 历史消息数量
    greeting: str = ""                # 开场白
    failure_info: str = ""            # 失败提示
    modalities: List[str] = ["text"]  # 支持的模态
    rtm_enabled: bool = True          # RTM统计
    ssml_enabled: bool = False        # SSML支持
    context_enabled: bool = False     # 上下文扩展
    enable_storage: bool = False      # 持久化存储
```

**关键命令**:
| 命令 | 功能 |
|------|------|
| `flush` | 清空输入队列，发送flush给下游 |
| `on_user_joined` | 用户加入，发送开场白 |
| `on_user_left` | 用户离开 |

**分句逻辑**:
```python
def is_punctuation(char):
    # 中英文标点
    if char in [",", "，", ".", "。", "?", "？", "!", "！"]:
        return True
    return False

def parse_sentences(sentence_fragment, content):
    # 遇到标点就输出一句
    sentences = []
    current_sentence = sentence_fragment
    for char in content:
        current_sentence += char
        if is_punctuation(char):
            sentences.append(current_sentence)
            current_sentence = ""
    return sentences, current_sentence  # remain
```

---

### 2.3 Text Webhook (文本外发)

**作用**: 将ASR转写结果或LLM输出发送到外部Webhook

**源码路径**: `ten_packages/extension/text_webhook/`

**配置参数** (`WebhookConfig`):
```python
@dataclass
class WebhookConfig(BaseConfig):
    url: str = ""                      # Webhook地址
    headers: str = ""                  # JSON格式的请求头
    method: str = "POST"               # HTTP方法
    timeout: int = 10                  # 超时秒数
    send_final_only: bool = True       # 仅发送最终结果
    data_type: str = "transcribe"      # 数据类型标识
    send_on_close: bool = False        # 关闭时发送
    send_on_start: bool = True         # 启动时发送
    direct_forward: bool = False       # 直接转发模式
    send_on_user_events: bool = True   # 用户事件通知
```

**发送的数据结构**:
```json
{
  "text": "用户说的话",
  "is_final": true,
  "end_of_segment": false,
  "stream_id": 12345,
  "message_id": "abc12345",
  "conversation_id": "xyz67890",
  "data_type": "transcribe",
  "text_ts": 1704067200000
}
```

**特殊事件**:
- `conversation_start`: 对话开始
- `conversation_end`: 对话结束
- `user_event: joined/left`: 用户加入/离开

---

### 2.4 StreamID Adapter (流适配器)

**作用**: 为音频帧添加session_id元数据

**源码路径**: `ten_packages/extension/streamid_adapter/`

**核心逻辑**:
```python
async def on_audio_frame(self, ten_env: AsyncTenEnv, frame: AudioFrame) -> None:
    stream_id, _ = frame.get_property_int("stream_id")
    
    frame.set_property_from_json(
        "metadata",
        json.dumps({
            "session_id": f"{stream_id}",
        }),
    )
    
    await ten_env.send_audio_frame(audio_frame=frame)
```

**用途**: 多用户场景下区分不同的音频流

---

### 2.5 Thymia Analyzer (语音健康分析)

**作用**: 通过语音分析用户的心理健康指标

**源码路径**: `ten_packages/extension/thymia_analyzer_python/`

**分析指标**:
| 指标 | 说明 |
|------|------|
| distress | 焦虑程度 |
| stress | 压力水平 |
| burnout | 倦怠程度 |
| fatigue | 疲劳程度 |
| low_self_esteem | 自尊水平 |
| depression | 抑郁概率 |
| anxiety | 焦虑概率 |

**分析流程**:
1. **Mood Phase**: 收集30秒自由对话语音
2. **Reading Phase**: 收集30秒朗读语音
3. **Hellos API**: 分析日常指标
4. **Apollo API**: 分析临床指标

**LLM工具调用**:
```json
{
  "name": "get_wellness_metrics",
  "description": "获取用户健康分析结果"
}
```

---

## 三、扩展协作关系

### 3.1 典型Voice Agent数据流

```
                                    ┌─────────────────┐
                                    │   Audio Input   │
                                    └────────┬────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                    ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
                    │ streamid_    │ │   TEN VAD   │ │   TEN VAD    │
                    │ adapter      │ │             │ │   (备用)     │
                    └──────────────┘ └─────────────┘ └──────────────┘
                              │              │
                              ▼              │
                    ┌──────────────┐         │
                    │     ASR      │         │
                    │ (aliyun_asr) │         │
                    └──────────────┘         │
                              │              │
                              ▼              │
                    ┌───────────────────┐    │
                    │  Turn Detection   │    │
                    │  (可选)           │    │
                    └───────────────────┘    │
                              │              │
                              │ text_data    │ start/end_of_sentence
                              ▼              ▼
                    ┌───────────────────────────┐
                    │      glue_python_async    │
                    │      (主控制器)           │
                    └───────────────────────────┘
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
     ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
     │     LLM      │ │ text_data   │ │   flush      │
     │   (云服务)   │ │  (TTS)      │ │  (下游)      │
     └──────────────┘ └─────────────┘ └──────────────┘
```

### 3.2 命令与数据流

| 源 | 目标 | 类型 | 名称 | 说明 |
|-----|------|------|------|------|
| ASR | Turn Detection | Data | text_data | 识别文本 |
| ASR | Glue | Data | text_data | 识别文本 |
| VAD | Glue | Cmd | start_of_sentence | 用户开始说话 |
| VAD | Glue | Cmd | end_of_sentence | 用户停止说话 |
| Turn Detection | Glue | Data | text_data | 带is_final的文本 |
| Turn Detection | Glue | Cmd | flush | 清空指令 |
| Glue | TTS | Data | text_data | LLM回复文本 |
| Glue | Webhook | Cmd | flush | 清空指令 |

---

## 四、扩展开发模式

### 4.1 基础扩展类

所有异步扩展继承自 `AsyncExtension`:

```python
from ten_runtime import AsyncExtension, AsyncTenEnv, Data, Cmd

class MyExtension(AsyncExtension):
    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """初始化"""
        pass
    
    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """启动，读取配置"""
        pass
    
    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """停止"""
        pass
    
    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """反初始化"""
        pass
    
    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理数据"""
        pass
    
    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """处理命令"""
        pass
```

### 4.2 配置管理

使用 `BaseConfig` 简化配置读取:

```python
from ten_ai_base.config import BaseConfig
from dataclasses import dataclass

@dataclass
class MyConfig(BaseConfig):
    api_key: str = ""
    timeout: int = 10

# 在on_start中读取
self.config = await MyConfig.create_async(ten_env=ten_env)
```

### 4.3 发送数据

```python
# 发送Data
data = Data.create("text_data")
data.set_property_string("text", "Hello")
data.set_property_bool("is_final", True)
await ten_env.send_data(data)

# 发送Cmd
cmd = Cmd.create("flush")
await ten_env.send_cmd(cmd)

# 返回结果
from ten_runtime import CmdResult, StatusCode
result = CmdResult.create(StatusCode.OK, cmd)
await ten_env.return_result(result)
```

---

## 五、VoxFlame-Agent 集成建议

### 5.1 LLM纠错扩展设计

基于现有扩展模式，建议创建 `dysarthric_correction` 扩展：

```python
class DysarthricCorrectionExtension(AsyncExtension):
    """构音障碍语音纠错扩展"""
    
    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        # 1. 接收ASR文本
        text = data.get_property_string("text")
        is_final = data.get_property_bool("is_final")
        
        if not is_final:
            # 非最终结果，直接转发
            await ten_env.send_data(data)
            return
        
        # 2. 调用LLM纠错
        corrected = await self._correct_with_llm(text)
        
        # 3. 发送纠正后的文本
        output = Data.create("text_data")
        output.set_property_string("text", corrected)
        output.set_property_string("original_text", text)  # 保留原文
        output.set_property_bool("is_final", True)
        output.set_property_bool("is_corrected", text != corrected)
        await ten_env.send_data(output)
```

### 5.2 Graph配置

```json
{
  "nodes": [
    {
      "name": "asr",
      "addon": "aliyun_asr"
    },
    {
      "name": "correction",
      "addon": "dysarthric_correction",
      "property": {
        "llm_api_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen3-max",
        "prompt": "你是一个构音障碍语音纠错助手..."
      }
    },
    {
      "name": "llm",
      "addon": "glue_python_async"
    }
  ],
  "connections": [
    {
      "extension": "asr",
      "data": [
        {"name": "text_data", "dest": [{"extension": "correction"}]}
      ]
    },
    {
      "extension": "correction",
      "data": [
        {"name": "text_data", "dest": [{"extension": "llm"}]}
      ]
    }
  ]
}
```

### 5.3 参考text_webhook实现外部纠错服务

如果想使用外部微服务进行纠错，可以参考 `text_webhook` 的实现模式：

```python
async def _correct_with_external_service(self, text: str) -> str:
    async with aiohttp.ClientSession() as session:
        payload = {"text": text, "task": "correct"}
        async with session.post(
            self.config.correction_api_url,
            json=payload,
            timeout=self.config.timeout
        ) as response:
            result = await response.json()
            return result.get("corrected_text", text)
```

---

## 六、总结

### 6.1 核心扩展能力

| 扩展 | 能力 | 对VoxFlame-Agent的价值 |
|------|------|------------------------|
| VAD | 音频边界检测 | 准确的语音分段 |
| Turn Detection | 语义完整性判断 | 避免打断用户 |
| Message Collector | 分片传输 | 大文本处理 |
| Glue | LLM交互控制 | 对话管理 |
| Webhook | 外部通知 | 日志记录/分析 |
| Thymia | 语音健康分析 | 可扩展健康监测 |

### 6.2 下一步开发建议

1. **创建 dysarthric_correction 扩展**
   - 继承 `AsyncExtension`
   - 实现 `on_data` 处理ASR文本
   - 调用LLM纠错后转发

2. **优化VAD配置**
   - 降低 `vad_threshold` 到0.3-0.4
   - 增加 `silence_duration_ms` 到1500-2000ms

3. **考虑Turn Detection集成**
   - 对于语速较慢的用户尤为重要
   - 延长 `force_threshold_ms` 到8000ms

4. **添加Webhook日志**
   - 记录纠错前后的文本对比
   - 用于后续模型优化

---

## 参考资源

- TEN Framework: https://github.com/TEN-framework/ten-framework
- TEN Agent: https://github.com/TEN-framework/TEN-Agent
- TEN VAD: https://github.com/TEN-framework/ten-vad
- TEN Turn Detection: https://github.com/TEN-framework/ten-turn-detection
- 扩展开发指南: https://theten.ai/docs

