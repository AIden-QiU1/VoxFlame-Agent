# TEN VAD 深度分析报告

> 更新时间: 2025年12月
> GitHub: https://github.com/TEN-framework/ten-vad
> Star: 1.9K

---

## 一、TEN VAD 概述

TEN VAD (Voice Activity Detection) 是一个基于深度学习的轻量级、流式语音活动检测模型，专为实时对话式AI场景设计。

### 1.1 核心定位

作为对话式AI的**原子能力**，TEN VAD负责:
- 识别音频帧中是否有人声
- 判断一句话的开始和结束位置
- 过滤背景噪音、沉默等非语音信号

### 1.2 设计目标

- **低延迟**: 快速检测语音与非语音的切换
- **轻量级**: 低计算复杂度和内存占用
- **高准确率**: 超越WebRTC VAD和Silero VAD

---

## 二、性能对比

### 2.1 与主流VAD对比

| 指标 | TEN VAD | Silero VAD | WebRTC VAD |
|------|---------|------------|------------|
| 精确率 | 最高 | 中等 | 较低 |
| 延迟 | 最低 | 较高(数百ms延迟) | 中等 |
| 模型大小 | 306KB | 2.16MB(JIT)/2.22MB(ONNX) | 较小 |
| 检测粒度 | 帧级精准 | 段落级 | 基于音高 |

### 2.2 RTF性能 (Real-Time Factor)

| 平台 | CPU | TEN VAD RTF | 库大小 |
|------|-----|-------------|--------|
| Linux | AMD Ryzen 9 5900X | 0.0150 | 306KB |
| Linux | Intel Xeon Platinum 8253 | 0.0136 | 306KB |
| Linux | Intel Xeon Gold 6348 | 0.0086 | 306KB |
| Windows | Intel i7-10710U | 0.0150 | 464-508KB |
| macOS | M1 | 0.0160 | 731KB |
| Web | macOS M1 | 0.010 | 277KB |
| Android | Galaxy J6+ | 0.0570 | 373-532KB |
| iOS | iPhone8 A11 | 0.0050 | 320KB |

### 2.3 关键优势

**Agent-Friendly特性**:
- TEN VAD快速检测speech-to-non-speech过渡
- Silero VAD存在数百毫秒延迟
- 可识别短静默间隔（如6.5s-7.0s间的短沉默）

---

## 三、技术架构

### 3.1 音频处理参数

```python
SAMPLE_RATE = 16000  # 16kHz采样率
BYTES_PER_SAMPLE = 2  # 16-bit
hop_size_ms = 16      # 帧长16ms (或10ms)
hop_size = 256        # 256 samples (16ms @ 16kHz)
```

### 3.2 VAD状态机

```
┌──────────────────────────────────────────────────────────────┐
│                         TEN VAD 状态机                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌─────────┐                         ┌─────────────┐       │
│    │  IDLE   │ ───────────────────────►│  SPEAKING   │       │
│    │ (静默)  │  prefix连续高于阈值       │   (说话)    │       │
│    └─────────┘ ◄─────────────────────── └─────────────┘       │
│                  silence连续低于阈值                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 核心算法

```python
# VAD探测
probe, flag = self.vad.process(np.frombuffer(audio_buf, dtype=np.int16))

# 滑动窗口
self.probe_window.append(probe)  # [0.0, 1.0]
if len(self.probe_window) > self.window_size:
    self.probe_window.pop(0)

# 状态转换检测
if state == IDLE:
    # 检查最近prefix_window个探测值是否都高于阈值
    if all(p >= threshold for p in prefix_probes):
        state = SPEAKING
        send_cmd("start_of_sentence")

elif state == SPEAKING:
    # 检查最近silence_window个探测值是否都低于阈值
    if all(p < threshold for p in silence_probes):
        state = IDLE
        send_cmd("end_of_sentence")
```

---

## 四、TEN VAD 配置参数

```python
class TENVADConfig(BaseModel):
    prefix_padding_ms: int = 120      # 开始说话判定窗口(ms)
    silence_duration_ms: int = 1000   # 静默判定窗口(ms) 
    vad_threshold: float = 0.5        # VAD阈值 [0.0, 1.0]
    hop_size_ms: int = 16             # 帧长(ms)，支持10/16
    dump: bool = False                # 是否dump音频
    dump_path: str = ""               # dump路径
```

### 4.1 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `prefix_padding_ms` | 120ms | 连续多长时间高于阈值判定为开始说话 |
| `silence_duration_ms` | 1000ms | 连续多长时间低于阈值判定为停止说话 |
| `vad_threshold` | 0.5 | VAD概率阈值，需根据场景调整 |
| `hop_size_ms` | 16ms | 帧长，影响延迟和准确率 |

### 4.2 构音障碍场景建议

对于构音障碍(dysarthric)语音:
- `vad_threshold`: 降低到0.3-0.4（构音障碍语音可能概率偏低）
- `silence_duration_ms`: 增加到1500-2000ms（说话可能有更长停顿）
- `prefix_padding_ms`: 增加到200-300ms（说话启动可能更慢）

---

## 五、在TEN Framework中的集成

### 5.1 Graph配置

```json
{
  "nodes": [
    {
      "type": "extension",
      "name": "vad",
      "addon": "ten_vad_python"
    }
  ],
  "connections": [
    {
      "extension": "streamid_adapter",
      "audio_frame": [
        {
          "name": "pcm_frame",
          "dest": [
            {"extension": "stt"},
            {"extension": "vad"}  // 音频同时发给ASR和VAD
          ]
        }
      ]
    },
    {
      "extension": "main_control",
      "cmd": [
        {
          "names": ["start_of_sentence", "end_of_sentence"],
          "source": [{"extension": "vad"}]  // main_control接收VAD事件
        }
      ]
    }
  ]
}
```

### 5.2 数据流

```
Audio Input
    │
    ▼
┌───────────────┐
│ streamid_     │
│ adapter       │
└───────────────┘
    │
    ├──────────────────┐
    ▼                  ▼
┌─────────┐      ┌──────────┐
│   STT   │      │   VAD    │
│  (ASR)  │      │          │
└─────────┘      └──────────┘
    │                  │
    ▼                  ▼
asr_result         start_of_sentence
    │              end_of_sentence
    └───────┬──────────┘
            ▼
    ┌───────────────┐
    │ main_control  │
    └───────────────┘
```

### 5.3 关键输出命令

| 命令 | 触发条件 | 用途 |
|------|----------|------|
| `start_of_sentence` | 连续prefix_padding_ms高于阈值 | 用户开始说话 |
| `end_of_sentence` | 连续silence_duration_ms低于阈值 | 用户停止说话 |

---

## 六、跨平台支持

### 6.1 支持的语言和平台

| 平台 | 动态库 | 接口语言 |
|------|--------|----------|
| Linux | libten_vad.so | Python, C, Java, Go |
| Windows | ten_vad.dll | C, Java, Go |
| macOS | ten_vad.framework | C, Java, Go |
| Web | ten_vad.wasm | JavaScript |
| Android | libten_vad.so | C, Java |
| iOS | ten_vad.framework | C |

### 6.2 Python使用示例

```python
from ten_vad import TenVad
import numpy as np

# 创建VAD实例 (hop_size = 256 samples = 16ms)
vad = TenVad(256)

# 处理音频帧 (16kHz, 16-bit, mono)
audio_frame = np.frombuffer(audio_bytes, dtype=np.int16)
probability, flag = vad.process(audio_frame)

print(f"概率: {probability}")  # [0.0, 1.0]
print(f"检测结果: {flag}")      # 0 或 1
```

### 6.3 ONNX部署

TEN VAD支持ONNX模型部署，可在任意平台和硬件架构上运行:
- ONNX模型位置: `src/onnx_model/`
- 需要onnxruntime >= 1.17.1

---

## 七、与Turn Detection的配合

TEN Turn Detection是TEN VAD的上层模块，用于全双工对话:

```
TEN VAD          →  帧级语音检测  →  start/end_of_sentence
        ↓
TEN Turn         →  对话轮次判断  →  user_turn / agent_turn
Detection
```

### 7.1 全双工对话支持

- VAD检测用户是否在说话
- Turn Detection判断是否应该打断
- 支持用户和Agent同时说话的场景

---

## 八、VoxFlame-Agent集成建议

### 8.1 当前架构

```
WebSocket → Aliyun ASR → LLM → TTS
```

### 8.2 添加VAD后的架构

```
WebSocket → VAD ──────────────────────────┐
              ↓                           │
          Aliyun ASR → LLM纠错 → 输出     │
              ↑                           │
              └───────────────────────────┘
                  (start/end_of_sentence控制)
```

### 8.3 集成步骤

1. **安装TEN VAD**:
   ```bash
   pip install -U --force-reinstall git+https://github.com/TEN-framework/ten-vad.git
   ```

2. **添加VAD扩展到Graph**:
   ```json
   {
     "type": "extension",
     "name": "vad",
     "addon": "ten_vad_python",
     "property": {
       "vad_threshold": 0.4,        // 构音障碍降低阈值
       "silence_duration_ms": 1500  // 增加静默判定时间
     }
   }
   ```

3. **配置数据流**:
   - 音频同时发送给ASR和VAD
   - main_control接收VAD的start/end事件
   - 使用end_of_sentence触发LLM纠错

### 8.4 预期效果

- 更精准的语音边界检测
- 减少ASR处理无效音频
- 支持用户打断Agent
- 改善构音障碍场景的交互体验

---

## 九、开发者评价

> "我们选择TEN VAD是因为它在日语中提供了比其他VAD更快、更准确的句末检测，同时足够轻量快速，可用于实时场景。" - LiveCap, Hakase shojo

> "TEN VAD的整体性能优于Silero VAD。其高准确率和低资源消耗帮助我们提高了效率并显著降低了成本。" - Rustpbx

---

## 参考资源

- GitHub仓库: https://github.com/TEN-framework/ten-vad
- HuggingFace: https://huggingface.co/TEN-framework/ten-vad
- sherpa-onnx集成: https://k2-fsa.github.io/sherpa/onnx/vad/ten-vad.html
- 在线体验: https://huggingface.co/spaces/TEN-framework/ten-agent-demo

