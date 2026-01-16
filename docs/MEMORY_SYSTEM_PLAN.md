# VoxFlame Agent 记忆系统实施计划

## 🎯 目标

为构音障碍患者提供智能记忆能力，实现：
1. **上下文感知**：多轮对话理解
2. **个性化学习**：热词库、纠错历史
3. **音频记忆**（未来）：语音模式库

## 📊 技术方案对比

### 放弃方案：Supabase pgvector 自研

**原因：**
- ❌ 需要自研会话管理逻辑
- ❌ 缺少对话 AI 专用优化
- ❌ 维护成本高
- ❌ 缺少官方支持和社区案例

**现状：**
- 已创建 pgvector 扩展和表结构
- `searchMemories()` 函数仅有 TODO 注释
- 20KB FAISS 索引文件未使用

### 采用方案：TEN Framework PowerMem + Qdrant

**Phase 1: PowerMem (OceanBase)**
```
短期记忆 = 对话上下文 + 热词 + 纠错历史
```

**Phase 2: 热词与纠错增强**
```
个性化 = 用户词库 + ASR 纠错模式学习
```

**Phase 3: Qdrant (未来)**
```
音频记忆 = Wav2Vec 2.0 embedding + 语音相似度检索
```

## 🗂️ 架构设计

### 三层记忆架构

```
┌─────────────────────────────────────────┐
│        Frontend (React Hooks)          │
│   - useAgent (WebSocket 连接)          │
│   - 对话历史显示                         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Backend (Express Memory API)          │
│   - /api/memory/add                     │
│   - /api/memory/search                  │
│   - /api/memory/hotwords                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│          TEN Agent (PowerMem Extension)             │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   ASR       │─▶│ PowerMem    │─▶│    LLM     │ │
│  │ (Aliyun)    │  │ (对话记忆)   │  │  (Qwen3)   │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
│                           │                         │
│                           ▼                         │
│                   ┌──────────────┐                 │
│                   │  OceanBase   │                 │
│                   │  SeekDB      │                 │
│                   └──────────────┘                 │
└─────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    Supabase PostgreSQL (长期存储)       │
│   - user_profiles (用户档案)             │
│   - sessions (会话记录)                  │
│   - user_hotwords (热词库)               │
│   - speech_corrections (纠错历史)        │
└─────────────────────────────────────────┘
               │
               ▼ (Phase 3 未来)
┌─────────────────────────────────────────┐
│     Qdrant (音频向量库)                  │
│   - 语音 embedding (Wav2Vec 2.0)        │
│   - 语音模式相似度检索                    │
│   - WavRAG 音频增强                     │
└─────────────────────────────────────────┘
```

### 数据流

#### 1. 对话记忆（PowerMem）

```python
# TEN Agent Extension
class VoiceAssistantExtension:
    def on_start(self, ten_env):
        # 初始化 PowerMem
        self._initialize_memory_client()
    
    def on_asr_result(self, ten_env, asr_text):
        # 检索相关记忆
        memories = self._retrieve_memory(asr_text)
        
        # 构建 LLM 上下文
        context = self._build_llm_context(asr_text, memories)
        
        # 调用 LLM
        llm_response = self.call_llm(context)
        
        # 保存对话到记忆库
        self._memorize_conversation(asr_text, llm_response)
```

#### 2. 热词增强（Supabase）

```sql
-- 查询用户热词（注入到 ASR）
SELECT word, phonetic 
FROM user_hotwords 
WHERE user_id = $1 
ORDER BY frequency DESC 
LIMIT 100;

-- 查询纠错历史（注入到 LLM prompt）
SELECT asr_text, corrected_text 
FROM speech_corrections 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 20;
```

#### 3. LLM Prompt 构建

```python
def build_correction_prompt(user_id, asr_text, memories, hotwords, corrections):
    return f"""
你是一个专为构音障碍患者设计的语音助手。

【用户热词库】
{', '.join(hotwords)}

【常见纠错模式】
{format_corrections(corrections)}

【上下文记忆】
{format_memories(memories)}

【当前识别】
ASR: {asr_text}

请根据上下文、热词和纠错历史，输出正确的文本。
"""
```

## 📅 实施计划

### Phase 1: PowerMem 集成（2周）

#### Week 1: OceanBase + PowerMem

**任务清单：**
- [ ] 启动 OceanBase 容器（docker-compose.yml 已有）
- [ ] 安装 PowerMem Extension 到 `ten_agent/ten_packages/extension/`
- [ ] 配置 PowerMem 连接 OceanBase
- [ ] 测试记忆存储和检索

**技术细节：**
```bash
# 1. 启动 OceanBase
docker compose up -d oceanbase

# 2. 下载 PowerMem Extension
cd ten_agent/ten_packages/extension/
git clone https://github.com/ten-framework/powermem-extension.git

# 3. 配置 property.json
{
  "extensions": [
    {
      "name": "powermem",
      "database": {
        "type": "oceanbase",
        "host": "oceanbase",
        "port": 2881,
        "user": "root",
        "password": "root",
        "database": "voxflame"
      }
    }
  ]
}
```

#### Week 2: Memory API 更新

**任务清单：**
- [ ] Backend Memory API 对接 PowerMem
- [ ] 实现 `/api/memory/retrieve` 端点
- [ ] 实现 `/api/memory/save` 端点
- [ ] 前端 useAgent hook 集成记忆显示
- [ ] 测试多轮对话记忆

**Backend API 示例：**
```typescript
// backend/src/services/powermem.service.ts
export class PowerMemService {
  async retrieve(userId: string, query: string) {
    // 调用 TEN Agent PowerMem API
    const response = await fetch(`http://ten-agent:8080/memory/retrieve`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, query })
    });
    return response.json();
  }
  
  async save(userId: string, conversation: string) {
    await fetch(`http://ten-agent:8080/memory/save`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, content: conversation })
    });
  }
}
```

### Phase 2: 热词与纠错增强（2周）

#### Week 3: 数据库表与热词管理

**任务清单：**
- [ ] Supabase 迁移：创建 `user_hotwords` 表
- [ ] Supabase 迁移：创建 `speech_corrections` 表
- [ ] Backend API: `/api/hotwords/add`
- [ ] Backend API: `/api/hotwords/list`
- [ ] 前端：热词管理界面
- [ ] ASR 热词注入逻辑

**数据库迁移：**
```sql
-- supabase/migrations/20260102_memory_system.sql

-- 用户热词表
CREATE TABLE IF NOT EXISTS user_hotwords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  frequency INT DEFAULT 1,
  category VARCHAR(50) DEFAULT 'custom', -- person/place/medical/custom
  phonetic TEXT,  -- 拼音：zhang1_wei3 (张伟)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, word)
);

CREATE INDEX idx_hotwords_user_id ON user_hotwords(user_id);
CREATE INDEX idx_hotwords_frequency ON user_hotwords(user_id, frequency DESC);

-- 语音纠错历史表
CREATE TABLE IF NOT EXISTS speech_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  asr_text TEXT NOT NULL,        -- ASR 原始识别
  corrected_text TEXT NOT NULL,  -- LLM 纠正后
  confidence FLOAT DEFAULT 0.0,  -- 纠正置信度 (0-1)
  context JSONB DEFAULT '{}',    -- 上下文信息
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_corrections_user_id ON speech_corrections(user_id, created_at DESC);
CREATE INDEX idx_corrections_session_id ON speech_corrections(session_id);
```

#### Week 4: LLM Prompt 注入与测试

**任务清单：**
- [ ] 修改 LLM Extension: 注入热词到 prompt
- [ ] 修改 LLM Extension: 注入纠错历史到 prompt
- [ ] 纠错结果自动保存到 `speech_corrections`
- [ ] 测试热词识别准确率提升
- [ ] 测试纠错模式学习效果

**LLM Extension 修改：**
```python
# ten_agent/ten_packages/extension/openai_llm2_python/extension.py

def build_prompt_with_memory(self, user_id, asr_text):
    # 1. 获取热词
    hotwords = self.backend_api.get_hotwords(user_id)
    
    # 2. 获取纠错历史
    corrections = self.backend_api.get_corrections(user_id, limit=20)
    
    # 3. 获取对话记忆（PowerMem）
    memories = self._retrieve_memory(asr_text)
    
    # 4. 构建 prompt
    return f"""
【用户热词】{', '.join(hotwords)}
【纠错模式】{format_corrections(corrections)}
【对话记忆】{format_memories(memories)}
【识别文本】{asr_text}

输出纠正后的文本：
"""
```

### Phase 3: Qdrant 音频向量库（未来规划）

**触发条件：**
- 用户量 > 1000
- 需要音频相似度检索
- WavRAG 音频增强需求

**任务清单（P3）：**
- [ ] Docker Compose 添加 Qdrant 服务
- [ ] 集成 Wav2Vec 2.0 模型（音频 embedding）
- [ ] 构建用户语音模式库
- [ ] 实现音频相似度检索
- [ ] ASR 结果基于音频相似度纠错

## 🧪 测试计划

### 单元测试

```bash
# PowerMem 连接测试
pytest tests/test_powermem_connection.py

# Memory API 测试
npm run test backend/src/services/powermem.service.test.ts

# 热词注入测试
pytest tests/test_hotword_injection.py
```

### 集成测试

```bash
# 多轮对话记忆测试
./tests/integration/test_multi_turn_memory.sh

# 纠错历史学习测试
./tests/integration/test_correction_learning.sh
```

### 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|----------|
| 记忆检索延迟 | < 100ms | Apache Bench |
| OceanBase 查询延迟 | < 50ms | pgbench |
| LLM 上下文构建 | < 50ms | Python profiler |
| 端到端响应时间 | < 2s | E2E 测试 |

## 📈 成功指标

### Phase 1 (PowerMem)
- ✅ 多轮对话上下文保持 > 5 轮
- ✅ 记忆检索准确率 > 85%
- ✅ 端到端延迟 < 2s

### Phase 2 (热词增强)
- ✅ 热词识别准确率提升 > 20%
- ✅ ASR 纠错成功率 > 75%
- ✅ 用户满意度提升 > 30%

### Phase 3 (Qdrant - 未来)
- ⏳ 音频相似度检索准确率 > 80%
- ⏳ 语音模式学习收敛 < 100 样本

## 🚨 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| OceanBase 性能瓶颈 | 高 | 使用 Redis 缓存热数据 |
| PowerMem 文档不足 | 中 | 参考官方示例代码 |
| 热词注入影响 ASR | 中 | A/B 测试验证效果 |
| 记忆隐私泄露 | 高 | 用户级数据隔离 + 加密 |

## 📚 参考资源

### TEN Framework 官方文档
- [PowerMem Architecture](https://docs.ten.ai/powermem)
- [Memory Extension Examples](https://github.com/ten-framework/ten-framework/tree/main/ai_agents/agents/examples/voice-assistant-with-memU)
- [TEN Agent API Reference](https://docs.ten.ai/api)

### 数据库文档
- [OceanBase SeekDB](https://www.oceanbase.com/docs/seekdb)
- [Qdrant Documentation](https://qdrant.tech/documentation/)

### 音频处理
- [Wav2Vec 2.0 Paper](https://arxiv.org/abs/2006.11477)
- [WavRAG for Audio Retrieval](https://arxiv.org/abs/2401.12345)

## 🎯 交付物

### Phase 1
- [ ] PowerMem Extension 配置文件
- [ ] OceanBase 数据库 schema
- [ ] Backend Memory API 代码
- [ ] 测试报告

### Phase 2
- [ ] Supabase 数据库迁移脚本
- [ ] 热词管理 API
- [ ] 纠错历史 API
- [ ] 前端热词管理界面
- [ ] 性能测试报告

### Phase 3 (未来)
- [ ] Qdrant 部署配置
- [ ] Wav2Vec 2.0 集成代码
- [ ] WavRAG 检索 API
- [ ] 音频相似度测试报告

---

**版本：** v1.0  
**最后更新：** 2025-01-03  
**负责人：** VoxFlame Dev Team
