# VoxFlame Agent 记忆系统实施计划 v2.0

> **更新日期**: 2026-03-02
> **基于**: PRD 深研交付物 B（语音产品记忆系统前沿研究）
> **参考架构**: [OpenClaw Memory](https://blog.csdn.net/tianyuanwo/article/details/158428045)

---

## 🎯 设计目标

为构音障碍患者提供智能记忆能力，核心原则：

| 目标 | 描述 | 对标 |
|------|------|------|
| **可控** | 默认本地保存，用户决定上传与分享 | Looki "默认不连续录制" |
| **可检索** | 语义 + 关键词 + 时间 + 场景检索 | Weaviate Hybrid Search |
| **可遗忘** | 选择性遗忘与自动 compaction | OpenClaw memoryFlush |
| **可审计** | 写入/检索/导出/删除可追踪 | GDPR/BIPA/CCPA 合规 |

---

## 📊 技术方案对比

### 放弃方案：Supabase pgvector 自研

**原因：**
- ❌ 需要自研会话管理逻辑
- ❌ 缺少对话 AI 专用优化
- ❌ >200ms 延迟，超过 100 万向量时性能瓶颈
- ❌ 维护成本高

### 采用方案：Local-first + Hybrid 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    VOXFLAME MEMORY STACK                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           TEN Framework Agent (PowerMem)                 │    │
│  │  • 对话记忆（短期上下文）                                  │    │
│  │  • 用户画像注入                                          │    │
│  │  • 个性化问候                                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Local Store (本地优先)                       │    │
│  │  • MEMORY.md - 长期记忆（用户画像、发音特点、偏好）        │    │
│  │  • memory/YYYY-MM-DD.md - 每日日志（工作记忆）            │    │
│  │  • SQLite - 元数据索引                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼ (可选云端同步)                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Supabase PostgreSQL (元数据)                 │    │
│  │  • sessions, utterances, hotwords, corrections           │    │
│  │  • pgvector HNSW 索引（小规模语义检索）                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼ (Phase 3: 音频向量)               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Qdrant (音频向量库)                          │    │
│  │  • text_episodic - 文本 embedding                        │    │
│  │  • audio_content - Wav2Vec/HuBERT/Whisper embedding      │    │
│  │  • speaker_voiceprint - 说话人 embedding                 │    │
│  │  • 量化压缩：Product Quantization（91%内存节省）          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ 四种记忆类型

参考 2024-2026 记忆代理研究（检索、学习、长程理解、选择性遗忘）：

| 类型 | 描述 | 存储位置 | 示例 |
|------|------|---------|------|
| **Episodic（情景）** | 对话片段、当天事件 | SQLite + 每日日志 | "今天下午和医生说了..." |
| **Semantic（语义）** | 长期事实（偏好、身份） | MEMORY.md | "我妈妈叫王芳"、"不喜欢绕弯子" |
| **Skill（技能）** | 短语模板、场景脚本 | Supabase | 就医场景模板、常用短语 |
| **Voice-profile（语音画像）** | 热词、混淆模式、清晰度趋势 | Qdrant + Supabase | "z/zh 混淆"、"喝水 高频" |

---

## 📁 本地文件结构（参考 OpenClaw）

```
~/.voxflame/
├── MEMORY.md              # 长期记忆（用户画像 + 稳定信息）
├── SOUL.md                # 核心身份和偏好（可选）
└── memory/
    ├── 2026-03-02.md     # 每日日志（工作记忆）
    ├── 2026-03-01.md
    └── archives/         # 会话归档
        └── session-xxx.md
```

### MEMORY.md 示例

```markdown
# MEMORY.md

## 用户画像

- 姓名：张三
- 障碍类型：痉挛型构音障碍
- 发音特点：舌尖音不清、语速快、停顿少

## 常用词汇

- 喝水 (高频)
- 帮忙 (每日)
- 谢谢 (每日)

## 发音混淆模式

- z/zh 混淆
- l/n 混淆
- 前后鼻音

## 康复进度

- 2026-02-01：清晰度评分 45
- 2026-02-15：清晰度评分 52 (+7)
- 2026-03-01：清晰度评分 58 (+6)

## 沟通偏好

- 喜欢直接表达，不喜欢绕弯子
- 需要对方耐心等待
- 用手势辅助表达
```

---

## 🗄️ 数据库 Schema

### PostgreSQL（Supabase）元数据

```sql
-- 会话表
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  mode VARCHAR(50) DEFAULT 'communication', -- communication/training/review
  consent_level VARCHAR(50) DEFAULT 'assist', -- assist/relay/delegate
  partner_present BOOLEAN DEFAULT FALSE
);

-- 话语表（DualLineSubtitle 的数据映射）
CREATE TABLE utterances (
  utt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(session_id),
  speaker_role VARCHAR(50) DEFAULT 'user', -- user/partner/agent
  raw_asr TEXT NOT NULL,           -- ASR 原始识别
  corrected_text TEXT,             -- LLM 纠正后
  final_text TEXT,                 -- 用户确认的最终文本
  clarity_score FLOAT DEFAULT 0.0, -- 清晰度评分 (0-1)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 音频对象表（只存引用）
CREATE TABLE audio_objects (
  obj_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  session_id UUID REFERENCES sessions(session_id),
  storage_uri TEXT NOT NULL,       -- OSS/本地路径
  codec VARCHAR(20) DEFAULT 'opus', -- opus/aac/flac
  sample_rate INT DEFAULT 16000,
  duration_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 热词表
CREATE TABLE hotwords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  word TEXT NOT NULL,
  phonetic TEXT,                   -- 拼音：zhang1_wei3
  frequency INT DEFAULT 1,
  category VARCHAR(50) DEFAULT 'custom', -- person/place/medical/custom
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, word)
);

CREATE INDEX idx_hotwords_frequency ON hotwords(user_id, frequency DESC);

-- 纠错历史表
CREATE TABLE corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  session_id UUID REFERENCES sessions(session_id),
  asr_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  context_hash VARCHAR(64),        -- 上下文指纹
  confidence FLOAT DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_corrections_user ON corrections(user_id, created_at DESC);
```

### Qdrant 集合设计

```python
from qdrant_client import QdrantClient, models

client = QdrantClient(url="http://localhost:6333")

# 文本情景向量
client.create_collection(
    collection_name="text_episodic",
    vectors_config=models.VectorParams(
        size=512,  # DashScope text-embedding-v3
        distance=models.Distance.COSINE,
        on_disk=True
    ),
    quantization_config=models.ScalarQuantization(
        scalar=models.ScalarQuantizationConfig(
            type=models.ScalarType.INT8,
            always_ram=True
        )
    )
)

# 音频内容向量
client.create_collection(
    collection_name="audio_content",
    vectors_config=models.VectorParams(
        size=768,  # Wav2Vec2/HuBERT
        distance=models.Distance.COSINE,
        on_disk=True
    )
)

# 说话人向量
client.create_collection(
    collection_name="speaker_voiceprint",
    vectors_config=models.VectorParams(
        size=512,  # ECAPA-TDNN
        distance=models.Distance.COSINE
    )
)
```

---

## 🔌 API 设计

### Memory Service API（v1）

```typescript
// 写入事件
POST /v1/memory/ingest
{
  "type": "episodic" | "semantic" | "skill" | "voice-profile",
  "content": string,
  "audio_ref"?: string,      // 音频引用 URI
  "embedding"?: number[],    // 可选，服务端生成
  "tags"?: string[],
  "metadata"?: Record<string, any>
}

// 混合检索
POST /v1/memory/search
{
  "query": string,
  "types"?: string[],        // 记忆类型过滤
  "filters"?: {
    "date_range"?: { "from": string, "to": string },
    "tags"?: string[],
    "min_clarity_score"?: number
  },
  "hybrid"?: {
    "alpha": 0.5,            // 向量 vs BM25 权重
    "top_k": 10
  }
}

// 触发压缩
POST /v1/memory/compact
{
  "scope": "session" | "daily" | "all",
  "session_id"?: string
}

// 删除（满足删除权）
DELETE /v1/memory/items/:id
DELETE /v1/memory/sessions/:session_id

// 导出
GET /v1/memory/export?format=markdown|jsonl|csv

// 策略查询（合规透明）
GET /v1/memory/policy
```

---

## 🚀 实施计划

### Phase 1: Local-first 基础（Week 1-2）

**目标**：建立本地存储基础

| 任务 | 状态 |
|------|------|
| 设计 ~/.voxflame/ 目录结构 | 待开始 |
| 实现 MEMORY.md 读写服务 | 待开始 |
| 实现每日日志（memory/YYYY-MM-DD.md） | 待开始 |
| SQLite 元数据索引 | 待开始 |
| 本地检索（BM25） | 待开始 |

**技术栈**：
- 前端：IndexedDB + File System Access API
- 后端：better-sqlite3 + gray-matter

### Phase 2: 云端同步 + PowerMem（Week 3-4）

**目标**：集成 TEN Framework PowerMem

| 任务 | 状态 |
|------|------|
| Supabase 迁移脚本（sessions/utterances/hotwords/corrections） | 待开始 |
| Backend Memory API 实现 | 待开始 |
| PowerMem Extension 配置 | 待开始 |
| 对话记忆自动保存 | 待开始 |
| 热词注入到 ASR | 待开始 |

**PowerMem 配置**：
```json
{
  "enable_memorization": true,
  "enable_user_memory": true,
  "memory_save_interval_turns": 5,
  "memory_idle_timeout_seconds": 30.0,
  "powermem_config": {
    "vector_store": {
      "provider": "oceanbase",
      "config": {
        "collection_name": "voxflame_memories",
        "host": "${env:OCEANBASE_HOST}",
        "embedding_model_dims": "512"
      }
    },
    "llm": {
      "provider": "qwen",
      "config": {
        "api_key": "${env:DASHSCOPE_API_KEY}",
        "model": "qwen-plus"
      }
    }
  }
}
```

### Phase 3: Qdrant 音频向量（Week 5-8，未来）

**触发条件**：
- 用户量 > 1000
- 需要音频相似度检索
- WavRAG 音频增强需求

| 任务 | 状态 |
|------|------|
| Docker Compose 添加 Qdrant | 待开始 |
| Wav2Vec 2.0 embedding 提取 | 待开始 |
| 音频相似度检索 API | 待开始 |
| 量化配置（Product Quantization） | 待开始 |
| 召回评估（recall@k） | 待开始 |

---

## 🧪 测试计划

### 单元测试

```bash
# 本地存储测试
npm run test backend/src/services/memory/local-store.test.ts

# PowerMem 连接测试
pytest tests/test_powermem_connection.py

# 热词注入测试
pytest tests/test_hotword_injection.py
```

### 集成测试

```bash
# 多轮对话记忆测试
./tests/integration/test_multi_turn_memory.sh

# 纠错历史学习测试
./tests/integration/test_correction_learning.sh

# 本地→云端同步测试
./tests/integration/test_sync.sh
```

### 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|----------|
| 本地检索延迟 | < 50ms | SQLite benchmark |
| 云端检索延迟 p95 | < 150ms | Apache Bench |
| Qdrant 检索延迟 p95 | < 30ms | Qdrant benchmark |
| 端到端响应时间 | < 2s | E2E 测试 |

---

## 📈 成功指标

### Phase 1 (Local-first)
- ✅ 本地日志自动生成
- ✅ MEMORY.md 可人工编辑
- ✅ 本地检索可用

### Phase 2 (PowerMem)
- ✅ 多轮对话上下文保持 > 5 轮
- ✅ 热词识别准确率提升 > 20%
- ✅ 纠错历史有效注入

### Phase 3 (Qdrant)
- ⏳ 音频相似度检索准确率 > 80%
- ⏳ 语音模式学习收敛 < 100 样本
- ⏳ 内存占用降低 > 80%（量化）

---

## 🚨 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 本地存储空间不足 | 中 | 自动清理策略 + 云端归档 |
| PowerMem 文档不足 | 中 | 参考 TEN 官方示例代码 |
| 音频 embedding 成本高 | 中 | 缓存 + 按需生成 |
| 记忆隐私泄露 | 高 | 用户级数据隔离 + 加密 + 同意机制 |

---

## 📚 参考资源

### 架构参考
- [OpenClaw Memory Architecture](https://blog.csdn.net/tianyuanwo/article/details/158428045) - 四层记忆架构
- [OpenClaw 会话机制与记忆系统](https://www.cnblogs.com/YzpJason/p/19631621) - 深度剖析

### 向量数据库
- [Qdrant vs pgvector](https://zilliz.com.cn/comparison/qdrant-vs-pgvector) - 性能对比
- [Qdrant 量化指南](https://m.blog.csdn.net/gitblog_01016/article/details/151207687) - 压缩优化

### 记忆系统研究
- 2024 记忆机制综述（定义、设计与评估）
- 2025 记忆代理能力框架（检索、学习、长程理解、选择性遗忘）

### 音频处理
- [Wav2Vec 2.0 Paper](https://arxiv.org/abs/2006.11477)
- [RFC 6716 - Opus Codec](https://tools.ietf.org/html/rfc6716)
- [RFC 9639 - FLAC Format](https://tools.ietf.org/html/rfc9639)

---

**版本：** v2.0
**最后更新：** 2026-03-02
**负责人：** VoxFlame Dev Team
