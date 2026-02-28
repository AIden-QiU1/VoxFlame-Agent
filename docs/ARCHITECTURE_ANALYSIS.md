# VoxFlame 架构分析与任务优先级重排

> **分析日期**: 2026-02-28
> **分析目的**: 基于 TEN Framework 架构特点，重新评估产品开发优先级

---

## 一、TEN Framework 深度分析

### 1.1 核心架构模式

TEN Framework 是一个**实时多模态对话 AI 框架**，其核心特点：

| 特性 | 描述 | 与 OpenAI Agent 的对比 |
|------|------|------------------------|
| **Extension 模型** | 所有功能模块都是 Extension（C++/Go/Python/Node.js） | OpenAI 用 Tools/Functions |
| **数据流图** | 通过 `property.json` 配置 Extension 之间的数据流动 | OpenAI 用 LLM 控制工具调用 |
| **生命周期管理** | on_init → on_start → on_cmd/on_data → on_stop | OpenAI 没有明确的生命周期 |
| **通信机制** | 扩展间通过 Data/AudioFrame/VideoFrame 通信 | OpenAI 通过函数参数/返回值 |

### 1.2 TEN 是否支持 Agent Skills？

**关键发现**：TEN **没有**类似 OpenAI 的 "Skill" 或 "Function Calling" 原生概念。

- TEN 的 Extension 是**数据流处理节点**，不是 LLM 可调用的工具
- TEN 的控制逻辑在 **main_control** 中硬编码，不是 LLM 动态决策
- 要实现 "Agent Skills"，需要在 `main_control` Extension 中实现类似 OpenAI 的工具调用逻辑

**结论**：TEN 是**数据流驱动**架构，不是**意图驱动**架构。

### 1.3 A2UI（Agentic UI）在 TEN 中的适用性

您说得对！在 TEN 这种语音 Agent 框架下，A2UI 确实不太适用：

1. TEN 是**数据流驱动**，前端 WebSocket 只是数据流的输入/输出端点
2. "Agent 主动推送" 在 TEN 中相当于某个 Extension 主动发送 Data
3. 真正的 "Agentic" 应该体现在 **main_control 的智能决策**，而不是前端 UI

**调整**：将 A2UI 的优先级降到最低，聚焦于 TEN 内部的智能能力。

---

## 二、语音评估与收集体系分析

### 2.1 现有收集页面功能

当前 `/contribute` 页面已实现：
- ✅ AI 对话引导（可选）
- ✅ 引导式录音 - 跟读句子
- ✅ 自由录音 - 说自己想说的话
- ✅ 录音上传到 OSS
- ✅ 数据存储到 `voice_contributions` 表

### 2.2 现有问题

**缺失的评估能力**：
1. ❌ 没有语音清晰度评估
2. ❌ 没有发音质量反馈
3. ❌ 没有与 ASR 识别结果对比
4. ❌ 没有科学的评估指标体系

### 2.3 科学的语音评估体系设计

#### 评估维度

```
┌─────────────────────────────────────────────────────────────┐
│                    语音评估体系架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              实时评估层 (TEN Extension)                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ AudioFeature │  │ ASRQuality   │  │ Pronunciation│ │ │
│  │  │ _Extractor   │  │ _Analyzer    │  │ _Scorer      │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  │         ↓                  ↓                  ↓         │ │
│  │  音频特征           识别置信度          发音准确性        │ │
│  │  • 音高            • CER/WER          • 音素对比        │
│  │  • 音量            • 置信度分数        • 相似度评分      │
│  │  • 语速            • N-best 结果      • 错误定位        │
│  └────────────────────────────────────────────────────────┘ │
│                              ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               综合评估层 (Evaluation Engine)            │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  • 清晰度评分 (Clarity Score: 0-100)             │  │ │
│  │  │  • 可理解度评分 (Intelligibility Score)          │  │ │
│  │  │  • 流畅度评分 (Fluency Score)                    │  │ │
│  │  │  • 整体质量等级 (Poor/Fair/Good/Excellent)      │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                              ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               反馈与建议层 (Feedback Layer)             │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  • 可视化反馈 (波形图 + 频谱图)                   │  │ │
│  │  │  • 问题定位 (哪个音节/词语有问题)                 │  │ │
│  │  │  • 改进建议 (语速调整、发音练习)                  │  │ │
│  │  │  • 进度追踪 (历史对比)                            │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                              ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            数据存储层 (Supabase + Qdrant)               │ │
│  │  • voice_evaluations (结构化评估数据)                  │ │
│  │  • voice_features (音频特征向量)                       │ │
│  │  • user_progress (用户进度追踪)                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

#### 评估指标定义

| 指标 | 计算方式 | 权重 | 说明 |
|------|---------|------|------|
| **ASR 清晰度** | `100 - CER × 100` | 40% | 基于 ASR 识别错误率 |
| **音频质量** | SNR + 音量标准化程度 | 20% | 信噪比和音量稳定性 |
| **发音准确性** | 与标准发音的相似度 | 25% | 需要参考发音模型 |
| **流畅度** | 语速变化 + 停顿频率 | 15% | 语速适中、停顿自然 |

### 2.4 数据库表设计

```sql
-- 语音评估结果表
CREATE TABLE voice_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contribution_id UUID REFERENCES voice_contributions(id),

  -- 评估分数
  clarity_score INTEGER,              -- 清晰度评分 (0-100)
  intelligibility_score INTEGER,      -- 可理解度评分 (0-100)
  fluency_score INTEGER,             -- 流畅度评分 (0-100)
  overall_score INTEGER,             -- 整体评分 (0-100)

  -- ASR 分析
  asr_transcript TEXT,               -- ASR 识别结果
  cer FLOAT,                         -- 字符错误率
  wer FLOAT,                         -- 词错误率
  confidence_score FLOAT,            -- ASR 置信度

  -- 音频特征
  snr FLOAT,                         -- 信噪比
  rms_energy FLOAT,                  -- 能量
  duration_seconds FLOAT,

  -- 问题定位
  problem_regions JSONB,             -- 问题区域定位 [{start, end, issue_type, severity}]

  -- 改进建议
  suggestions JSONB,                 -- 改进建议 [{type, description, priority}]

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户进度追踪表
CREATE TABLE user_voice_progress (
  user_id TEXT PRIMARY KEY,
  total_recordings INTEGER DEFAULT 0,
  avg_clarity_score FLOAT,
  avg_fluency_score FLOAT,
  latest_evaluation_at TIMESTAMP,
  improvement_streak INTEGER DEFAULT 0,
  milestones JSONB DEFAULT '{}',      -- 里程碑达成记录
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 三、更新后的任务优先级

### Phase 1: 核心评估能力（P0 - 立即开始）

| 任务 | 描述 | 预计时间 | 价值 |
|------|------|---------|------|
| **1.1 语音评估 TEN Extension** | 实现 AudioFeatureExtractor + ASRQualityAnalyzer | 1周 | 🔥🔥🔥 |
| **1.2 评估结果存储** | 创建 voice_evaluations 表 + API | 2天 | 🔥🔥 |
| **1.3 评估页面 UI** | 在 /contribute 页面显示评估结果 | 2天 | 🔥🔥🔥 |

### Phase 2: 反馈与改进（P1）

| 任务 | 描述 | 预计时间 | 价值 |
|------|------|---------|------|
| **2.1 可视化反馈** | 波形图 + 频谱图 + 问题高亮 | 3天 | 🔥🔥 |
| **2.2 改进建议系统** | 基于评估结果生成练习建议 | 2天 | 🔥 |
| **2.3 进度追踪** | 用户历史对比 + 成就系统 | 2天 | 🔥🔥 |

### Phase 3: TEN 记忆系统（P2）

| 任务 | 描述 | 预计时间 | 价值 |
|------|------|---------|------|
| **3.1 记忆层设计** | 三层记忆架构设计文档 | 2天 | 🔥🔥 |
| **3.2 记忆层 TEN Extension** | 实现 MemoryLayer Extension | 1周 | 🔥🔥🔥 |

### Phase 4: Agent Skills（P3 - 低优先级）

| 任务 | 描述 | 预计时间 | 价值 |
|------|------|---------|------|
| **4.1 意图预测** | 基于 ASR 结果 + 用户画像预测意图 | 3天 | 🔥 |
| **4.2 短语建议** | 基于上下文推荐常用短语 | 2天 | 🔥 |
| **4.3 上下文分享** | 数字名片 + 场景预设 | 2天 | 🔥🔥 |

---

## 四、技术决策总结

### 4.1 关于 TEN Agent + Skills

**结论**：TEN 不原生支持 OpenAI 风格的 Skills。

**建议路径**：
1. 在 `voxflame_main_python` Extension 中实现智能路由逻辑
2. 使用 LLM 决定调用哪个子模块（纠错、记忆、评估等）
3. "Skills" 本质上是可复用的 TEN Extension 组合

### 4.2 关于 A2UI

**结论**：在 TEN 架构下，A2UI 不是首要任务。

**原因**：
- TEN 是数据流驱动，前端只是 I/O 端点
- 真正的 "Agentic" 体现在 TEN 内部决策
- 前端 UI 应保持简洁，专注于数据展示

### 4.3 关于语音评估

**结论**：这是当前最有价值的功能。

**原因**：
1. 直接帮助用户了解自己的语音质量
2. 为后续的个性化训练提供数据基础
3. 可与双行字幕镜形成闭环（ASR → 评估 → 反馈 → 改进）

---

## 五、下一步行动

### 立即开始：语音评估 TEN Extension

```python
# ten_agent/extension_src/voice_evaluation_python/extension.py

class VoiceEvaluationExtension(AsyncExtension):
    """
    语音评估 Extension

    输入: pcm_frame (音频流)
    输出: evaluation_result (评估结果 Data)
    """

    async def on_audio_frame(self, ten_env: AsyncTenEnv, frame: AudioFrame):
        # 1. 提取音频特征
        features = self.extract_features(frame)

        # 2. 调用 ASR 获取识别结果和置信度
        asr_result = await self.get_asr_result(frame)

        # 3. 计算评估分数
        evaluation = self.calculate_score(features, asr_result)

        # 4. 发送评估结果
        await self.send_evaluation(ten_env, evaluation)
```

需要创建吗？
