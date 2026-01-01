# VoxFlame Agent 架构说明

## 目录结构与职责

```
/root/VoxFlame-Agent/ten_agent/
├── services/                    # ★ 业务逻辑层 (我们创建的)
│   ├── asr_api_client.py       # DashScope ASR API封装
│   ├── embedding_api_client.py # DashScope Embedding API封装
│   └── tts_api_client.py       # DashScope TTS API封装
│
├── storage/                     # ★ 数据持久层
│   └── sqlite_backend.py       # PowerMem SQLite + FAISS存储
│
└── ten_packages/extension/      # ★ TEN Framework扩展层
    ├── http_api_server_python/  # HTTP API Server (Session管理)
    ├── funasr_asr_python/       # FunASR本地ASR扩展 (未使用)
    ├── glm_llm_python/          # GLM-4 LLM扩展 (未使用)
    ├── cosyvoice_tts_python/    # CosyVoice本地TTS扩展 (未使用)
    └── main_python/             # 主Extension (下一步要实现)
```

## 架构关系

### 1. **services/** - 纯Python业务逻辑层
**职责**: 封装第三方API调用逻辑, 提供简洁接口
**特点**:
- 不依赖TEN Framework
- 可被任何Python代码import使用
- 纯函数式, 无状态
- 类似设计模式中的"Service Layer"

**示例使用**:
```python
from ten_agent.services.asr_api_client import DashScopeASRClient
client = DashScopeASRClient()
transcript = client.transcribe_file("audio.wav")
```

### 2. **ten_packages/extension/** - TEN Framework插件层
**职责**: TEN Framework的Extension插件, 处理音频流/WebSocket/会话管理
**特点**:
- 依赖TEN Framework (AsyncExtension基类)
- 处理实时数据流 (音频/文本)
- 有生命周期方法 (on_init, on_start, on_stop, on_data)
- **可以调用services/中的API Client**

**关系图**:
```
WebSocket Client (Frontend)
       ↓
ten_packages/extension/http_api_server_python
       ↓ 调用
services/asr_api_client.py → DashScope API
       ↓ 返回
storage/sqlite_backend.py (存储记忆)
```

### 3. **实际架构流程** (当前 + Phase 6.2目标)

**当前 (Phase 5-6完成)**:
```
Frontend → Backend Session API → TEN Agent HTTP API
                                        ↓
                                  http_api_server_python/
                                  (仅Session管理, 无ASR/PowerMem)
```

**Phase 6.2目标**:
```
Frontend → Backend Session API → TEN Agent HTTP API
                                        ↓
                                  http_api_server_python/
                                  (接收音频WebSocket)
                                        ↓
                                  main_python/ Extension:
                                    - 调用 services/asr_api_client
                                    - 调用 services/embedding_api_client
                                    - 调用 storage/sqlite_backend
                                    - 构建上下文
                                    - 调用 services/tts_api_client
                                        ↓
                                  WebSocket返回音频
```

## 设计优点

1. **分层清晰**:
   - services/: 业务逻辑 (API调用)
   - ten_packages/: TEN Framework集成 (数据流处理)
   - storage/: 数据持久化

2. **复用性强**:
   - services/可被任何Python代码使用 (不限于TEN Framework)
   - 未来可替换TEN Framework, services/代码无需修改

3. **测试友好**:
   - services/每个Client可独立单元测试
   - ten_packages/可做集成测试

4. **符合最佳实践**:
   - 类似Django的"apps + models + services"架构
   - 类似Clean Architecture的"Domain Layer + Infrastructure Layer"

---
**总结**: services/是纯业务逻辑, ten_packages/是TEN Framework插件容器, 后者调用前者。
