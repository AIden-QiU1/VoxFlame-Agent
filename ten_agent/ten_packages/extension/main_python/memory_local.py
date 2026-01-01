"""Local PowerMem Store with Embedded DashScope Client (TEN Framework Best Practice)"""
import os
import dashscope
from http import HTTPStatus
from typing import List, Optional, Dict

from storage.sqlite_backend import PowerMemSQLiteBackend
from storage.supabase_sync import AsyncSupabaseSync, SUPABASE_AVAILABLE
from ten_packages.extension.main_python.memory import MemoryStore


# ============================================================================
# DashScope Embedding Client (Embedded per TEN Framework Best Practices)
# ============================================================================
class DashScopeEmbeddingClient:
    """DashScope文本嵌入客户端 - 按TEN Framework最佳实践嵌入Extension内部
    
    根据TEN Framework架构分析，API客户端应直接定义在Extension内部，
    而不是分离到独立的services/目录。参考：
    - glm_llm_python/extension.py: ZhipuAI客户端在extension内部
    - funasr_asr_python/extension.py: FunASR模型在extension内部
    """
    
    def __init__(self, api_key: str, model: str = "text-embedding-v3", dimension: int = 512):
        """
        初始化DashScope Embedding客户端
        
        Args:
            api_key: DashScope API密钥
            model: 模型名称（默认text-embedding-v3）
            dimension: 嵌入维度（512, text-embedding-v3支持的维度）
        """
        dashscope.api_key = api_key
        self.model = model
        self.dimension = dimension
    
    def get_embedding(self, text: str, text_type: str = "document") -> Optional[List[float]]:
        """
        生成文本嵌入向量
        
        Args:
            text: 输入文本
            text_type: 文本类型 ("document"用于存储, "query"用于检索)
            
        Returns:
            嵌入向量（512维）或None（失败时）
        """
        try:
            resp = dashscope.TextEmbedding.call(
                model=self.model,
                input=text,
                dimension=self.dimension,
                text_type=text_type
            )
            if resp.status_code == HTTPStatus.OK:
                return resp.output["embeddings"][0]["embedding"]
            return None
        except Exception:
            return None


# ============================================================================
# LocalPowerMemStore - Local Memory Store Implementation
# ============================================================================
class LocalPowerMemStore(MemoryStore):
    """本地PowerMem存储实现（SQLite + FAISS + DashScope Embedding）
    
    按TEN Framework最佳实践重构：
    1. DashScopeEmbeddingClient直接定义在此文件内
    2. 不依赖外部services/目录
    3. 所有API调用封装在Extension内部
    """
    
    def __init__(self, config: Dict, env):
        """
        初始化本地PowerMem存储
        
        Args:
            config: 配置字典，包含db_path等
            env: TEN环境对象（AsyncTenEnv）
        """
        db_path = config.get("db_path", "data/powermem.db")
        self.backend = PowerMemSQLiteBackend(db_path)
        
        # 内部初始化embedding客户端（TEN Framework最佳实践）
        api_key = os.getenv("DASHSCOPE_API_KEY")
        if not api_key:
            raise ValueError("DASHSCOPE_API_KEY environment variable not set")
        
        self.embedding_client = DashScopeEmbeddingClient(
            api_key=api_key,
            dimension=512
        )
        
        # 云端同步客户端 (TEN Framework最佳实践: 可选功能)
        self.supabase_sync = None
        if SUPABASE_AVAILABLE:
            try:
                self.supabase_sync = AsyncSupabaseSync()
                env.log_info("[LocalPowerMemStore] Supabase sync enabled")
            except Exception as e:
                env.log_warn(f"[LocalPowerMemStore] Supabase sync disabled: {e}")
        
        env.log_info("[LocalPowerMemStore] Initialized with SQLite + FAISS + DashScope (512-dim)")
    
    async def add(self, conversation: List[Dict], user_id: str, agent_id: str):
        """
        添加对话到记忆存储
        
        Args:
            conversation: 对话列表，格式 [{"role": "user", "content": "..."}, ...]
            user_id: 用户ID
            agent_id: Agent ID
        """
        # 提取用户消息
        user_messages = [
            msg for msg in conversation
            if msg.get("role") == "user" and msg.get("content")
        ]
        
        if not user_messages:
            return
        
        # 为每条用户消息生成嵌入并存储
        session_id = f"{user_id}_{agent_id}_session"
        
        for msg in user_messages:
            text = msg["content"]
            
            # 生成嵌入（使用内嵌的DashScopeEmbeddingClient）
            embedding = self.embedding_client.get_embedding(text, "document")
            if not embedding:
                continue
            
            # 存储到SQLite + FAISS
            memory_id = self.backend.store_memory(
                user_id=user_id,
                session_id=session_id,
                text=text,
                embedding=embedding
            )
            
            # 异步同步到云端 (不阻塞主流程)
            if self.supabase_sync:
                try:
                    await self.supabase_sync.add_memory({
                        'user_id': user_id,
                        'session_id': session_id,
                        'content': text,
                        'metadata': {'local_id': memory_id}
                    })
                except Exception:
                    pass  # 云端同步失败不影响本地存储
    
    async def search(self, user_id: str, agent_id: str, query: str) -> List[Dict]:
        """
        搜索相关记忆
        
        Args:
            user_id: 用户ID
            agent_id: Agent ID
            query: 查询文本
            
        Returns:
            相关记忆列表（top-5），格式 [{"text": "...", "similarity": 0.8}, ...]
        """
        # 生成查询嵌入（使用内嵌的DashScopeEmbeddingClient）
        query_embedding = self.embedding_client.get_embedding(query, "query")
        if not query_embedding:
            return []
        
        # FAISS向量搜索
        results = self.backend.search_memory(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=5
        )
        
        return results
    
    async def get_user_profile(self, user_id: str, agent_id: str) -> str:
        """
        获取用户画像摘要
        
        Args:
            user_id: 用户ID
            agent_id: Agent ID
            
        Returns:
            用户统计摘要字符串
        """
        stats = self.backend.get_user_stats(user_id)
        
        return (
            f"User {user_id} Statistics:\n"
            f"- Total memories: {stats['total_memories']}\n"
            f"- Total sessions: {stats['total_sessions']}\n"
            f"- FAISS index size: {stats['faiss_index_size']}"
        )
    
    def close(self):
        """关闭存储，持久化FAISS索引到磁盘"""
        self.backend.close()
