# VoxFlame 燃言 - 技术概览文档

> **文档版本**: 2025年1月  
> **整合来源**: my_research.md + PRD.md + agent.md + Context7 技术调研  
> **架构版本**: V2.0 单Agent架构

---

## 1. 项目定位

### 使命
让每个声音都被听见

### 愿景
VoxFlame成为构音障碍患者的AI语音伴侣，让沟通不再是障碍

### 产品定位
- **For** 构音障碍患者及其家庭
- **Who** 因言语障碍无法正常使用语音助手
- **VoxFlame is** 专业的AI语音助手
- **That** 能够理解不清晰的语音并提供帮助
- **Unlike** 传统AAC设备或通用语音助手
- **Our product** 结合热词增强+上下文记忆+个性化适配

### 核心价值主张
**用户价值 = 识别准确率 × 响应速度 × 情感关怀 × 价格可及**

---

## 2. 市场背景

### 2.1 目标用户群体

中国约 **2000万** 构音障碍患者

| 疾病类型 | 估计人数(万) | 言语障碍特点 |
|------|------|----------|
| 脑卒中后遗症 | 600+ | 失语症、构音障碍 |
| 帕金森病 | 300+ | 音量小、语速慢 |
| 渐冻症(ALS) | 20+ | 进行性恶化 |
| 脑瘫 | 80+ | 运动性构音障碍 |
| 其他(创伤等) | 100+ | 多样化表现 |

### 2.2 核心痛点

1. **识别困难**: 普通ASR对构音障碍语音识别率<30%，需重复5-10遍
2. **家庭负担**: 照护者每天需2-3小时"翻译"患者需求
3. **社交退缩**: 68%患者减少外出，62%有抑郁倾向
4. **紧急求助难**: 无法有效拨打急救电话或描述症状
5. **设备昂贵**: 专业AAC设备价格高昂

---

## 3. 技术架构

### 3.1 技术栈

```
Frontend:  Next.js 14 + TypeScript + TailwindCSS + PWA
Backend:   Express + TypeScript + Supabase
AI Agent:  TEN Framework (Go Runtime) + Python Extensions
存储:      SQLite + FAISS + Mem0
ASR:       Paraformer-realtime-v2 / Faster-Whisper (备选)
LLM:       DashScope QWEN3 Max
TTS:       CosyVoice v3 (支持声音克隆)
```

### 3.2 Voice Agent 框架选型

选择 **TEN Framework** 作为Agent运行时

| 框架 | 架构特点 | 硬件支持 | 生态成熟度 | 选择原因 |
|------|------|----------|----------|--------|
| **TEN Framework** | Go Runtime + Python Extensions | ESP32-S3/P4 | 活跃 | 最佳平衡 |
| LiveKit Agents | WebRTC | ESP32 SDK | 成熟 | 较重 |
| Pipecat | Python | 有限 | 新兴 | 性能一般 |

**TEN Framework 优势**:
- 高性能 Go 运行时 + 灵活 Python 扩展
- 支持多模态扩展
- 内置 MemU 记忆系统
- 丰富的ASR/TTS/LLM扩展

### 3.3 ASR技术选型

**构音障碍专用ASR研究进展**:

| 技术方案 | 来源 | 效果改进 | 核心思路 |
|------|------|---------|------|
| **Whisper-Vicuna LLM** | Interspeech 2025 | WER 38%→21% | Bridge Network + LLM纠错 |
| **PB-DSR 个性化** | Interspeech 2024 | 准确率81.6% | 个性化适配 |
| **AdaLoRA 微调** | Interspeech 2025 | ALS降低27.7% | 0.1%参数微调 |
| **RnV 重新表达** | Interspeech 2025 | 显著提升 | 转换为健康语音 |

**Faster-Whisper 热词增强**:
```python
# 热词增强示例
segments, info = model.transcribe(
    "audio.mp3",
    hotwords="帕金森 左氧氟沙星 血压计",
    initial_prompt="这是一位老年患者在描述身体状况",
    condition_on_previous_text=True,
    language="zh"
)
```

---

## 4. 创新特性

### 4.1 语音快捷指令 (Phoneme Shortcuts)

**研究背景** (来自用户调研):
研究显示，即使是严重构音障碍患者也能稳定发出某些简单音节（如"啊"、"嗯"），
可以将这些音节映射为常用指令。

**功能设计**:
- 支持5-10个自定义快捷指令
- 示例: "啊" → "我要喝水", "嗯嗯" → "帮我叫人"
- 通过ASR识别简单音节，触发预设指令
- 降低沟通门槛

**实现方案**:
- 用户自定义5-10个快捷音节
- 每个音节需3-5次录音训练
- 系统学习用户发音特征

### 4.2 WavRAG 音频检索增强

**研究背景** (来自agent.md):
传统RAG流程: ASR→文本→检索→生成
问题: ASR错误会传播到检索阶段

WavRAG方案: 直接使用原始音频embedding进行检索，绕过ASR错误
效果: 理论上可提升约10%的最终准确率

**Whisper Embedding 提取**:
```python
import whisper
model = whisper.load_model("base")

# 提取音频embedding
audio = whisper.load_audio("user_speech.mp3")
mel = whisper.log_mel_spectrogram(whisper.pad_or_trim(audio), n_mels=model.dims.n_mels)
audio_features = model.encoder(mel.unsqueeze(0))

# 用于FAISS检索
embeddings = audio_features.squeeze(0)
```

**应用场景**:
- 患者说"喝水"（ASR可能识别为"河水"）
- WavRAG通过音频相似度匹配到"喝水"的历史记录
- 正确理解用户意图

### 4.3 个性化语音克隆

**场景**: 部分患者（如ALS）可能失去说话能力
**方案**: 使用CosyVoice v3在病情恶化前采集语音样本，合成个性化TTS音色
**价值**: 保留患者"声音记忆"，提供情感慰藉

---

## 5. 开发路线

### Phase 1: MVP (已完成)
- 基础语音识别和对话
- TEN Agent 集成
- 基础UI

### Phase 2: 增强功能 (进行中)
- 热词增强
- 记忆系统
- 工具调用

### Phase 3: 核心技术 (规划中)
- WavRAG
- 语音快捷指令
- 个性化TTS

### Phase 4: 规模化 (远期)
- 多终端支持
- 离线模式
- 云端部署

---

## 参考资料

- TEN Framework 官方文档
- Faster-Whisper 热词增强
- CosyVoice 语音克隆
- Interspeech 2024/2025 构音障碍ASR论文

---

**文档维护**: VoxFlame 开发团队
