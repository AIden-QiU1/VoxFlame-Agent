# Memory/RAG Systems Research for VoxFlame Voice AI

> **Research Date**: January 13, 2026  
> **Context**: VoxFlame-Agent - Voice assistant for dysarthric patients  
> **Current Stack**: Aliyun ASR + Qwen3 LLM + CosyVoice TTS + Supabase pgvector (512-dim)

---

## Executive Summary

1. **TEN Framework offers two memory integration options**: MemU (cloud-based SaaS) and PowerMem (self-hosted with Qwen/OceanBase), both providing conversation memory, semantic search, and personalized greetings for voice assistants.

2. **Supabase pgvector with HNSW indexing is sufficient for VoxFlame's scale** (expected <100K memories per user) with proper tuning - no dedicated vector database needed for MVP.

3. **Qdrant outperforms pgvector by 15x in throughput and 10x in latency** for million-scale datasets, but this advantage only matters for enterprise-scale deployments.

4. **Recommended approach**: **Option D (Hybrid)** - Start with enhanced pgvector implementation, integrate TEN Framework PowerMem for conversation memory, and reserve Qdrant for future WavRAG audio embedding search.

5. **Critical for dysarthric patients**: Memory systems should prioritize hot-word vocabulary enhancement, personalized speech patterns, and session-based context correction over generic RAG patterns.

---

## 1. TEN Framework Memory System Integration

### 1.1 MemU Integration (Cloud SaaS)

**Source**: TEN Framework \`voice-assistant-with-memU\` example

MemU is a cloud-based memory service that provides:

#### API Methods
\`\`\`python
# Initialize MemU client
self._initialize_memory_client()

# Core memory operations
self._retrieve_memory()          # Load historical summaries
self._memorize_conversation()    # Save conversation at turn end
self._load_memory_to_context()   # Inject memory into LLM context
self._update_llm_context()       # Synchronize with conversation

# LLMExec Context Management
llm_exec.get_context()           # Get current conversation
llm_exec.clear_context()         # Clear conversation
llm_exec.write_context(role, content)  # Append message
\`\`\`

#### Configuration
\`\`\`json
{
  "memu_base_url": "https://api.memu.so",
  "memu_api_key": "\${env:MEMU_API_KEY}",
  "enable_memorization": true,
  "agent_id": "voice_assistant_agent",
  "user_id": "user"
}
\`\`\`

#### Features
- **Automatic Memory**: Saves when \`LLMResponseEvent.is_final = true\`
- **Context Loading**: Retrieves historical summaries on startup
- **User Isolation**: Separate memories per \`user_id\` + \`agent_id\`
- **Async Operations**: Non-blocking memory saves

#### Limitations
- Requires internet connectivity
- External API dependency (SaaS model)
- Less control over data storage location

---

### 1.2 PowerMem Integration (Self-Hosted)

**Source**: TEN Framework \`voice-assistant-with-PowerMem\` example

PowerMem is a self-hosted memory solution using OceanBase/SeekDB:

#### Architecture
\`\`\`
┌─────────────────────────────────────────────────┐
│  PowerMem SDK                                    │
├─────────────────────────────────────────────────┤
│  Vector Store    │  LLM Provider  │  Embedder   │
│  (OceanBase)     │  (Qwen)        │  (Qwen)     │
└─────────────────────────────────────────────────┘
\`\`\`

#### Configuration
\`\`\`json
{
  "enable_memorization": true,
  "enable_user_memory": true,
  "memory_save_interval_turns": 5,
  "memory_idle_timeout_seconds": 30.0,
  "powermem_config": {
    "vector_store": {
      "provider": "oceanbase",
      "config": {
        "collection_name": "memories",
        "host": "\${env:OCEANBASE_HOST}",
        "embedding_model_dims": "512"
      }
    },
    "llm": {
      "provider": "qwen",
      "config": {
        "api_key": "\${env:LLM_API_KEY}",
        "model": "qwen-plus"
      }
    },
    "embedder": {
      "provider": "qwen",
      "config": {
        "model": "text-embedding-v4",
        "embedding_dims": 1536
      }
    }
  }
}
\`\`\`

#### Advanced Features
1. **UserMemory Client**: Enhanced user profile via \`client.profile()\`
2. **Turn-based Saving**: Auto-save every N conversation turns
3. **Idle Timeout Saving**: Auto-save after N seconds of inactivity
4. **Personalized Greetings**: LLM-generated greetings from memory
5. **Semantic Search**: Query-based memory retrieval

#### Memory Store Classes
\`\`\`python
# Standard Memory Client
class PowerMemSdkMemoryStore:
    def add(conversation, user_id, agent_id)
    def search(user_id, agent_id, query)
    def get_user_profile(user_id, agent_id)  # via semantic search

# Enhanced User Memory Client  
class PowerMemSdkUserMemoryStore:
    def get_user_profile(user_id, agent_id)  # via client.profile()
\`\`\`

#### Advantages for VoxFlame
- **Self-hosted**: Data stays in your infrastructure
- **Qwen Integration**: Already using Qwen LLM, consistent ecosystem
- **Configurable Save Rules**: Balance between memory freshness and API calls
- **User Profiles**: Track dysarthric patient speech patterns over time

---

### 1.3 TEN Framework Memory Comparison

| Feature | MemU (SaaS) | PowerMem (Self-Hosted) |
|---------|-------------|------------------------|
| Deployment | Cloud API | Docker/OceanBase |
| Data Control | External | Full control |
| Setup Complexity | Low | Medium |
| Cost | Usage-based | Infrastructure only |
| Qwen Integration | ✗ | ✓ Native |
| User Profiles | Basic | Enhanced |
| Offline Mode | ✗ | ✓ Possible |
| **VoxFlame Fit** | MVP only | **Recommended** |

---

## 2. Supabase pgvector Analysis

### 2.1 Current VoxFlame Schema

\`\`\`sql
-- Memories Table with pgvector
CREATE TABLE memories (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  session_id UUID REFERENCES sessions(id),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(512),  -- DashScope text-embedding-v3
  created_at TIMESTAMP WITH TIME ZONE
);

-- HNSW Index for semantic search
CREATE INDEX idx_memories_embedding_hnsw 
ON memories USING hnsw (embedding vector_cosine_ops);

-- Full Text Search Index
CREATE INDEX idx_memories_content_fts 
ON memories USING GIN (to_tsvector('simple', content));
\`\`\`

### 2.2 HNSW vs IVFFlat Index Comparison

| Characteristic | HNSW | IVFFlat |
|----------------|------|---------|
| **Build Speed** | Slower | 3x faster |
| **Query Speed** | Faster | Slower |
| **Memory Usage** | Higher | Lower |
| **Recall @ 95%** | Better | Good |
| **Best For** | Real-time queries | Large datasets, batch |
| **Tuning Params** | \`m\`, \`ef_construction\`, \`ef_search\` | \`lists\`, \`probes\` |

#### HNSW Tuning for Voice AI
\`\`\`sql
-- Create optimized HNSW index
CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query-time tuning for better recall
SET hnsw.ef_search = 100;  -- Default: 40

-- Filtered query optimization
SET hnsw.iterative_scan = relaxed_order;
SELECT * FROM memories 
WHERE user_id = \$1 
ORDER BY embedding <-> \$2 
LIMIT 10;
\`\`\`

#### IVFFlat Configuration
\`\`\`sql
-- For 10K-100K memories per user
CREATE INDEX ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- Rule: rows/1000

-- Query tuning
SET ivfflat.probes = 10;  -- Rule: sqrt(lists)
\`\`\`

### 2.3 pgvector Performance Characteristics

**Strengths for VoxFlame**:
1. **ACID Compliance**: Consistent with user profiles, sessions
2. **Hybrid Search**: Combine vector + metadata filtering
3. **No Additional Infrastructure**: Already using Supabase
4. **Small Dataset**: <100K memories/user = optimal pgvector range

**Performance Benchmarks** (from pgvector documentation):
- **Build**: ~1M vectors in minutes with parallel workers
- **Query**: <50ms for 100K vectors with HNSW
- **Memory**: ~1GB for 1M 512-dim vectors

**Optimization SQL**:
\`\`\`sql
-- Optimize for index build
SET maintenance_work_mem = '2GB';
SET max_parallel_maintenance_workers = 4;

-- Optimize for query
SET max_parallel_workers_per_gather = 2;
SET hnsw.ef_search = 100;

-- Store vectors inline (avoid TOAST)
ALTER TABLE memories ALTER COLUMN embedding SET STORAGE PLAIN;
\`\`\`

---

## 3. Qdrant Vector Database Analysis

### 3.1 Core Features

| Feature | Description | Voice AI Benefit |
|---------|-------------|------------------|
| **HNSW Algorithm** | Graph-based ANN | Sub-millisecond search |
| **Payload Filtering** | Pre/post filtering | User/session isolation |
| **Scalar Quantization** | int8 compression | 4x memory reduction |
| **On-Disk Storage** | Vector offloading | Cost-effective scaling |
| **Multitenancy** | Collection-level | Per-user isolation |
| **gRPC + REST** | Dual protocols | Flexible integration |

### 3.2 Performance Benchmarks (1M OpenAI Dataset)

| Metric | pgvector | Qdrant | Qdrant Advantage |
|--------|----------|--------|------------------|
| **Throughput** | 1x | 15x | 1500% faster |
| **p95 Latency** | 4.02-45.46s | 2.85s | 10-15x lower |
| **Recall@10** | Good | Better | Higher accuracy |

**Key Insight**: Qdrant's advantage is most pronounced at scale (>1M vectors) and under concurrent load.

### 3.3 Qdrant Configuration for Voice AI

\`\`\`python
from qdrant_client import QdrantClient, models

client = QdrantClient(url="http://localhost:6333")

# Create collection with quantization
client.create_collection(
    collection_name="voice_memories",
    vectors_config=models.VectorParams(
        size=512,  # DashScope embedding dim
        distance=models.Distance.COSINE,
        on_disk=True  # Optimize memory
    ),
    quantization_config=models.ScalarQuantization(
        scalar=models.ScalarQuantizationConfig(
            type=models.ScalarType.INT8,
            always_ram=True  # Fast search
        ),
    ),
)

# Filtered search example
results = client.search(
    collection_name="voice_memories",
    query_vector=embedding,
    filter=models.Filter(
        must=[
            models.FieldCondition(
                key="user_id",
                match=models.MatchValue(value=user_id)
            )
        ]
    ),
    limit=10,
    with_payload=True
)
\`\`\`

### 3.4 When to Use Qdrant over pgvector

| Use Case | pgvector | Qdrant | Winner |
|----------|----------|--------|--------|
| <100K vectors/user | ✓ Sufficient | Overkill | pgvector |
| >1M vectors total | Slow | Fast | Qdrant |
| ACID with relations | Native | Separate | pgvector |
| Sub-10ms latency | ~50ms | <10ms | Qdrant |
| **WavRAG audio embeddings** | Possible | **Better** | Qdrant |
| Simple deployment | Supabase | Docker | pgvector |

---

## 4. Memory System Design for Voice AI

### 4.1 Short-term vs Long-term Memory Architecture

\`\`\`
┌──────────────────────────────────────────────────────────────┐
│                    MEMORY ARCHITECTURE                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐    ┌─────────────────┐                  │
│  │  SHORT-TERM     │    │  LONG-TERM      │                  │
│  │  (Session)      │    │  (Persistent)   │                  │
│  ├─────────────────┤    ├─────────────────┤                  │
│  │ • Current turn  │    │ • User profile  │                  │
│  │ • Last 5 turns  │    │ • Hot words     │                  │
│  │ • ASR context   │    │ • Speech patterns│                 │
│  │ • Corrections   │    │ • Preferences   │                  │
│  │                 │    │ • Memories      │                  │
│  └────────┬────────┘    └────────┬────────┘                  │
│           │                      │                            │
│           └──────────┬───────────┘                            │
│                      ▼                                        │
│           ┌─────────────────────┐                            │
│           │   LLM CONTEXT       │                            │
│           │   (System + Memory) │                            │
│           └─────────────────────┘                            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
\`\`\`

#### Short-term Memory (Session-based)
- **Scope**: Current conversation session
- **Storage**: In-memory (LLMExec context)
- **Contents**:
  - Current turn ASR result
  - Last 5-10 conversation turns
  - Session-specific corrections
  - Pending confirmations

#### Long-term Memory (Persistent)
- **Scope**: User lifetime
- **Storage**: pgvector / Qdrant
- **Contents**:
  - User profile (condition, preferences)
  - Personalized hot words
  - Historical speech patterns
  - Successful corrections history
  - Semantic memories

### 4.2 Context Window Management for Speech Correction

\`\`\`python
# Dysarthric-specific context management
class DysarthricContextManager:
    def __init__(self):
        self.correction_history = []  # Recent corrections
        self.hot_words = []           # User-specific vocabulary
        self.speech_patterns = {}      # Common misrecognitions
    
    def build_llm_context(self, asr_result: str, user_profile: dict) -> str:
        """Build LLM context optimized for speech correction."""
        
        context_parts = [
            # System instruction
            f"你是{user_profile['name']}的语音助手，他/她患有{user_profile['condition']}。",
            
            # Hot words
            f"重要热词：{', '.join(self.hot_words[:20])}",
            
            # Recent corrections
            f"最近的语音纠正记录：\\n" + self._format_corrections(),
            
            # Speech patterns
            f"常见误识别模式：\\n" + self._format_patterns(),
            
            # Current ASR result
            f"用户说（可能有误识别）：{asr_result}"
        ]
        
        return "\\n\\n".join(context_parts)
    
    def record_correction(self, original: str, corrected: str):
        """Record a successful speech correction for learning."""
        self.correction_history.append({
            "original": original,
            "corrected": corrected,
            "timestamp": datetime.now()
        })
        
        # Update speech patterns
        self._update_patterns(original, corrected)
\`\`\`

### 4.3 Hot-word/Vocabulary Enhancement Strategies

#### Strategy 1: Static Hot-word List
\`\`\`python
# User profile hot words
hotwords = [
    "燃言", "帮我", "喝水", "吃饭", "打电话",
    "开灯", "关灯", "空调", "电视", "窗帘",
    # Medical terms
    "帕金森", "左氧氟沙星", "血压计", "胰岛素"
]
\`\`\`

#### Strategy 2: Contextual Hot-word Boosting
\`\`\`python
# Inject hot words into ASR context
segments, info = model.transcribe(
    audio,
    hotwords=" ".join(user_profile.hotwords),
    initial_prompt=f"这是一位{user_profile.condition}患者在与语音助手交流",
    condition_on_previous_text=True
)
\`\`\`

#### Strategy 3: Memory-based Hot-word Retrieval
\`\`\`sql
-- Retrieve frequently used words from memories
SELECT word, count(*) as frequency
FROM (
    SELECT unnest(regexp_split_to_array(content, '\\s+')) as word
    FROM memories
    WHERE user_id = \$1
) words
GROUP BY word
ORDER BY frequency DESC
LIMIT 50;
\`\`\`

### 4.4 Session-based vs Global User Memory

| Aspect | Session Memory | Global Memory |
|--------|----------------|---------------|
| **Lifetime** | Session duration | Permanent |
| **Storage** | RAM / Redis | pgvector / Qdrant |
| **Latency** | <1ms | 10-50ms |
| **Use Case** | Turn context | Personalization |
| **Example** | "刚才我说的是..." | "我妈妈叫王芳" |

---

## 5. Option Analysis & Recommendation

### Option A: Supabase pgvector Only

#### Technical Benefits
- ✓ Already integrated with existing schema
- ✓ ACID compliance with user profiles and sessions
- ✓ No additional infrastructure
- ✓ Hybrid search (vector + FTS + metadata)
- ✓ Simple backup/restore with Supabase

#### Implementation Complexity: **Low**
#### Cost: **\$25/month** (existing Supabase Pro)
#### Best Fit: MVP phase, <10K active users

---

### Option B: Add Qdrant Alongside Supabase

#### Technical Benefits
- ✓ 15x throughput improvement at scale
- ✓ Sub-10ms latency for vector search
- ✓ Better for audio embeddings (WavRAG)
- ✓ Scalar quantization reduces memory 4x

#### Implementation Complexity: **Medium-High**
#### Cost: **\$25-100/month** additional
#### Best Fit: Post-MVP, WavRAG, >100K vectors/user

---

### Option C: Integrate TEN Framework MemU/PowerMem

#### Technical Benefits
- ✓ Native TEN Framework integration
- ✓ Designed for voice assistant use cases
- ✓ User profiles and personalized greetings
- ✓ Qwen ecosystem compatibility (PowerMem)

#### Implementation Complexity: **Low-Medium**
#### Cost: **Infrastructure costs** (PowerMem) or **Usage-based** (MemU)
#### Best Fit: Voice assistant conversation memory

---

### Option D: Hybrid Approach (RECOMMENDED)

#### Architecture
\`\`\`
┌────────────────────────────────────────────────────────────┐
│                    VOXFLAME MEMORY STACK                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               TEN Framework Agent                     │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │           PowerMem Integration                  │   │   │
│  │  │  • Conversation Memory                          │   │   │
│  │  │  • User Profiles                                │   │   │
│  │  │  • Personalized Greetings                       │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Supabase pgvector (Primary)             │   │
│  │  • User profiles, sessions, memories                 │   │
│  │  • Text embeddings (512-dim)                         │   │
│  │  • HNSW index for semantic search                    │   │
│  │  • Full-text search for hot words                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼ (Future: Phase 3)           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Qdrant (Optional - WavRAG)              │   │
│  │  • Audio embeddings (1024-dim Whisper)               │   │
│  │  • High-speed vector search                          │   │
│  │  • Phoneme shortcut matching                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
\`\`\`

---

## 6. Implementation Roadmap

### Phase 1: pgvector Enhancement (Week 1-2)
\`\`\`sql
-- Optimize existing HNSW index
DROP INDEX IF EXISTS idx_memories_embedding_hnsw;
CREATE INDEX idx_memories_embedding_hnsw 
ON memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add speech correction tracking
CREATE TABLE speech_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  embedding vector(512),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hot words frequency tracking
CREATE TABLE hotword_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  word TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, word)
);
\`\`\`

### Phase 2: PowerMem Integration (Week 3-4)
- Create TEN extension wrapper for PowerMem
- Configure Supabase as vector store backend
- Implement personalized greeting generation
- Add turn-based memory saving

### Phase 3: WavRAG with Qdrant (Week 5-8, Future)
\`\`\`yaml
# docker-compose.yml addition
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./data/qdrant:/qdrant/storage
\`\`\`

---

## 7. Quick Reference

### pgvector HNSW Tuning
\`\`\`sql
-- Index creation
CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query tuning
SET hnsw.ef_search = 100;
SET hnsw.iterative_scan = relaxed_order;
\`\`\`

### PowerMem Environment Variables
\`\`\`bash
DASHSCOPE_API_KEY=xxx
LLM_MODEL=qwen3-max
EMBEDDING_MODEL=text-embedding-v3
EMBEDDING_DIMS=512
\`\`\`

---

## 8. Conclusion

For VoxFlame-Agent, the **Hybrid Approach (Option D)** provides the optimal balance:

1. **Immediate Value**: Enhanced pgvector leverages existing infrastructure
2. **Conversation Memory**: PowerMem integration fits TEN Framework architecture
3. **Future Scalability**: Qdrant pathway for WavRAG and audio embeddings
4. **Cost Efficiency**: Minimal additional costs until scale demands it

The key insight is that **dysarthric speech assistance requires personalized, session-aware memory** more than raw vector search performance.

---

**Document Author**: VoxFlame Research Team  
**Last Updated**: January 13, 2026
