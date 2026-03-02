# VoxFlame 记忆系统架构设计 v3.0

> **特色定位**: "理解声音背后的个性"
>
> 为构音障碍者打造的智能记忆系统，不仅记住说了什么，更理解怎么说。

---

## 一、 设计理念

### 1.1 核心差异化

| 对标产品 | 记忆重点 | VoxFlame 特色 |
|---------|---------|--------------|
| OpenClaw | 本地化助手，任务记忆 | **语音画像记忆** - 理解发音模式 |
| PowerMem | 对话上下文，用户画像 | **纠错学习记忆** - 从错误中进化 |
| memU | 分类知识库 | **场景沟通记忆** - 上下文感知的代播 |
| EverMemOS | 多代理隔离 | **康复进度记忆** - 可视化进步轨迹 |

### 1.2 四层记忆架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VOXFLAME MEMORY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Layer 4: REHABILITATION MEMORY (康复记忆层)                         │
│  ├── 清晰度趋势追踪                                                  │
│  ├── 发音进步可视化                                                  │
│  └── 训练建议生成                                                    │
│                                                                      │
│  Layer 3: VOICE-PROFILE MEMORY (语音画像层) ⭐ VoxFlame 独有          │
│  ├── 发音混淆模式 (z/zh, l/n, 前后鼻音)                              │
│  ├── 个人热词库 (高频词、人名、地名)                                  │
│  ├── 语速/停顿特征                                                   │
│  └── ASR 个性化参数                                                  │
│                                                                      │
│  Layer 2: CONVERSATION MEMORY (对话记忆层)                           │
│  ├── 会话上下文 (TEN PowerMem)                                       │
│  ├── 纠错历史 (原始→纠正→确认)                                       │
│  └── 场景模板匹配                                                    │
│                                                                      │
│  Layer 1: EPISODIC MEMORY (情景记忆层)                               │
│  ├── 每日对话日志 (Markdown)                                         │
│  ├── 重要事件标记                                                    │
│  └── 音频片段引用                                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、 VoxFlame 特色：语音画像记忆

### 2.1 发音混淆模式学习

系统自动学习用户的发音特点，持续优化 ASR 和纠错模型：

```python
class ConfusionPattern:
    """发音混淆模式"""
    pattern_id: str          # 唯一标识
    source: str              # 混淆音素组 ["z", "zh"]
    target: str              # 实际发音倾向 "zh"
    confidence: float        # 置信度 0.0-1.0
    examples: list[str]      # 示例词 ["知道", "准备"]
    correction_count: int    # 纠错次数
    last_updated: datetime
```

**学习流程**：
1. 用户说 "吃饭" → ASR 识别 "次饭"
2. LLM 纠正为 "吃饭" → 用户确认
3. 系统记录：c/ch 混淆 +1
4. 累积 5 次后，模式置信度 > 0.7
5. 下次识别 "次" 自动倾向于 "吃"

### 2.2 个人热词库

```python
class Hotword:
    """个人热词"""
    word: str                # 词汇
    phonetic: str            # 拼音 "zhang1_wei3"
    category: str            # person/place/medical/daily/custom
    frequency: int           # 使用频率
    last_used: datetime
    audio_sample_uri: str    # 音频样本（可选）
    variants: list[str]      # ASR 常见误识别
```

**自动学习规则**：
- 同一词被纠错 3 次以上 → 自动加入热词
- 频率 > 10/周 → 优先级提升
- 人名首次出现 → 提示添加

### 2.3 清晰度评分模型

```python
class ClarityScore:
    """清晰度评分"""
    timestamp: datetime
    score: float             # 0.0-1.0
    factors: {
        "asr_confidence": float,     # ASR 原始置信度
        "correction_rate": float,    # 纠错比例
        "repeat_count": int,         # 重复次数
        "pause_pattern": float,      # 停顿规范性
    }
    session_id: str
```

**评分公式**：
```
clarity = 0.4 * asr_confidence
        + 0.3 * (1 - correction_rate)
        + 0.2 * pause_score
        - 0.1 * repeat_penalty
```

---

## 三、 TEN Framework 集成

### 3.1 记忆层扩展架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TEN AGENT MEMORY INTEGRATION                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │     STT      │───▶│  Corrector   │───▶│     TTS      │          │
│  │  (ASR+VAD)   │    │    (LLM)     │    │   (CosyTTS)  │          │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘          │
│         │                   │                                       │
│         ▼                   ▼                                       │
│  ┌──────────────────────────────────────────────────────┐          │
│  │              memory_layer_python                      │          │
│  │  ┌────────────────────────────────────────────────┐  │          │
│  │  │  MemoryStore (Abstract Base)                   │  │          │
│  │  │  ├── add(conversation, user_id, agent_id)      │  │          │
│  │  │  ├── search(user_id, agent_id, query)          │  │          │
│  │  │  ├── get_user_profile(user_id, agent_id)       │  │          │
│  │  │  └── update_voice_profile(user_id, patterns)   │  │          │
│  │  └────────────────────────────────────────────────┘  │          │
│  │                        │                             │          │
│  │         ┌──────────────┼──────────────┐             │          │
│  │         ▼              ▼              ▼             │          │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │          │
│  │  │ PowerMem  │  │ LocalStore│  │ VoiceProfile  │   │          │
│  │  │ (Cloud)   │  │ (SQLite)  │  │ (Supabase)    │   │          │
│  │  └───────────┘  └───────────┘  └───────────────┘   │          │
│  └──────────────────────────────────────────────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流设计

```
用户语音 ──▶ ASR 识别 ──▶ [记忆层注入热词/混淆模式]
                              │
                              ▼
                         原始文本
                              │
                              ▼
                    LLM 纠错 ◀── [记忆层提供上下文]
                              │
                              ▼
                        纠正后文本
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           TTS 播放      存储纠错历史    更新混淆模式
                              │               │
                              ▼               ▼
                        [记忆层持久化]   [语音画像更新]
```

---

## 四、 本地存储结构

### 4.1 目录布局

```
~/.voxflame/
├── MEMORY.md                    # 长期记忆（用户画像）
├── VOICE_PROFILE.md             # 语音画像（混淆模式、热词）
├── memory.db                    # SQLite 索引数据库
├── sessions/
│   ├── 2026-03-02/
│   │   ├── session_abc123.md    # 会话详情
│   │   └── audio/
│   │       └── utt_001.webm     # 音频片段（可选）
│   └── 2026-03-01/
├── analytics/
│   ├── clarity_trend.json       # 清晰度趋势
│   └── weekly_report.md         # 周报
└── cache/
    └── embeddings/              # 本地向量缓存
```

### 4.2 SQLite Schema

```sql
-- 会话索引
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    mode TEXT,
    clarity_avg REAL,
    turn_count INTEGER
);

-- 话语索引
CREATE TABLE utterances (
    utt_id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(session_id),
    speaker_role TEXT,
    raw_asr TEXT,
    corrected_text TEXT,
    final_text TEXT,
    clarity_score REAL,
    created_at TIMESTAMP
);

-- 纠错历史（用于学习）
CREATE TABLE corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_text TEXT,
    corrected_text TEXT,
    pattern_hint TEXT,
    created_at TIMESTAMP
);

-- 热词
CREATE TABLE hotwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE,
    phonetic TEXT,
    category TEXT,
    frequency INTEGER DEFAULT 1,
    last_used TIMESTAMP
);

-- 混淆模式
CREATE TABLE confusion_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_phonemes TEXT,
    target_phoneme TEXT,
    confidence REAL,
    examples TEXT,
    correction_count INTEGER DEFAULT 1,
    last_updated TIMESTAMP
);

-- 清晰度评分
CREATE TABLE clarity_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    score REAL,
    asr_confidence REAL,
    correction_rate REAL,
    pause_score REAL,
    created_at TIMESTAMP
);
```

---

## 五、 实施计划

### Phase 1: 基础记忆层 (Week 1)

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 创建 memory_layer_python 扩展 | TEN 扩展骨架 | P0 |
| 实现 LocalStore | SQLite + Markdown | P0 |
| 集成到 main_control | 数据流连接 | P0 |
| 热词注入到 ASR | 个性化识别 | P1 |

### Phase 2: 语音画像 (Week 2)

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 混淆模式检测算法 | 从纠错历史学习 | P0 |
| 清晰度评分模型 | 实时计算 | P0 |
| VOICE_PROFILE.md 生成 | 自动更新 | P1 |
| Backend API 实现 | Supabase 集成 | P1 |

### Phase 3: 高级功能 (Week 3-4)

| 任务 | 描述 | 优先级 |
|------|------|--------|
| PowerMem 云端集成 | 对话上下文 | P1 |
| 康复趋势可视化 | 前端图表 | P2 |
| 训练建议生成 | LLM 生成 | P2 |
| 音频向量检索 | Qdrant 集成 | P3 |

---

**版本**: v3.0
**创建日期**: 2026-03-02
**负责人**: VoxFlame Dev Team
