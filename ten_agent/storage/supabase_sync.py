"""
Supabase Sync Module for VoxFlame Agent

将本地SQLite/FAISS存储同步到云端Supabase PostgreSQL。
支持：
- 用户画像同步
- 会话记录同步  
- 记忆数据同步（含向量嵌入）

架构设计：
本地存储 (SQLite + FAISS) ←→ 云端存储 (Supabase + pgvector)
- 本地优先：快速响应
- 异步同步：后台上传
- 冲突解决：云端为准
"""

import os
import logging
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

# Supabase client
try:
    from supabase import create_client, Client
    from supabase.lib.client_options import ClientOptions
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class SupabaseSync:
    """
    Supabase同步客户端
    
    按TEN Framework最佳实践，此类嵌入在存储模块内部使用。
    提供与云端Supabase的双向同步能力。
    """
    
    def __init__(self, url: str = None, key: str = None):
        """
        初始化Supabase同步客户端
        
        Args:
            url: Supabase项目URL（默认从环境变量读取）
            key: Supabase API Key（默认从环境变量读取）
        """
        if not SUPABASE_AVAILABLE:
            raise ImportError("supabase package not installed. Run: pip install supabase")
        
        self.url = url or os.getenv("SUPABASE_URL")
        self.key = key or os.getenv("SUPABASE_ANON_KEY")
        
        if not self.url or not self.key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY required")
        
        self.client: Client = create_client(self.url, self.key)
        self._sync_queue: List[Dict] = []
        self._is_syncing = False
        
        logger.info(f"[SupabaseSync] Initialized: {self.url[:30]}...")
    
    # =========================================================================
    # User Profiles
    # =========================================================================
    
    def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """获取用户画像"""
        try:
            response = self.client.table('user_profiles').select("*").eq('id', user_id).single().execute()
            return response.data
        except Exception as e:
            logger.error(f"[SupabaseSync] Get profile error: {e}")
            return None
    
    def create_user_profile(self, profile: Dict) -> Optional[Dict]:
        """创建用户画像"""
        try:
            # 确保有ID
            if 'id' not in profile:
                profile['id'] = str(uuid.uuid4())
            
            response = self.client.table('user_profiles').insert(profile).execute()
            logger.info(f"[SupabaseSync] Created profile: {profile['id']}")
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"[SupabaseSync] Create profile error: {e}")
            return None
    
    def update_user_profile(self, user_id: str, updates: Dict) -> Optional[Dict]:
        """更新用户画像"""
        try:
            updates['updated_at'] = datetime.now().isoformat()
            response = self.client.table('user_profiles').update(updates).eq('id', user_id).execute()
            logger.info(f"[SupabaseSync] Updated profile: {user_id}")
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"[SupabaseSync] Update profile error: {e}")
            return None
    
    def upsert_user_profile(self, profile: Dict) -> Optional[Dict]:
        """插入或更新用户画像"""
        try:
            if 'id' not in profile:
                profile['id'] = str(uuid.uuid4())
            
            response = self.client.table('user_profiles').upsert(profile).execute()
            logger.info(f"[SupabaseSync] Upserted profile: {profile['id']}")
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"[SupabaseSync] Upsert profile error: {e}")
            return None
    
    # =========================================================================
    # Sessions
    # =========================================================================
    
    def create_session(self, session: Dict) -> Optional[Dict]:
        """创建会话记录"""
        try:
            if 'id' not in session:
                session['id'] = str(uuid.uuid4())
            if 'start_time' not in session:
                session['start_time'] = datetime.now().isoformat()
            
            response = self.client.table('sessions').insert(session).execute()
            logger.info(f"[SupabaseSync] Created session: {session['id']}")
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"[SupabaseSync] Create session error: {e}")
            return None
    
    def end_session(self, session_id: str, transcript: str = None) -> Optional[Dict]:
        """结束会话"""
        try:
            updates = {
                'end_time': datetime.now().isoformat(),
            }
            if transcript:
                updates['transcript'] = transcript
            
            # 计算持续时间
            session = self.get_session(session_id)
            if session and session.get('start_time'):
                start = datetime.fromisoformat(session['start_time'].replace('Z', '+00:00'))
                from datetime import timezone
                end = datetime.now(timezone.utc)
                updates['duration'] = int((end - start).total_seconds())
            
            response = self.client.table('sessions').update(updates).eq('id', session_id).execute()
            logger.info(f"[SupabaseSync] Ended session: {session_id}")
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"[SupabaseSync] End session error: {e}")
            return None
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """获取会话"""
        try:
            response = self.client.table('sessions').select("*").eq('id', session_id).single().execute()
            return response.data
        except Exception as e:
            logger.error(f"[SupabaseSync] Get session error: {e}")
            return None
    
    def get_user_sessions(self, user_id: str, limit: int = 10) -> List[Dict]:
        """获取用户的会话列表"""
        try:
            response = self.client.table('sessions').select("*").eq('user_id', user_id).order('start_time', desc=True).limit(limit).execute()
            return response.data or []
        except Exception as e:
            logger.error(f"[SupabaseSync] Get user sessions error: {e}")
            return []
    
    # =========================================================================
    # Memories
    # =========================================================================
    
    def add_memory(self, memory: Dict) -> Optional[Dict]:
        """添加记忆"""
        try:
            if 'id' not in memory:
                memory['id'] = str(uuid.uuid4())
            
            # 处理embedding维度（本地512 → 云端1536需要padding或调整schema）
            # 暂时不上传embedding，后续可以统一维度
            if 'embedding' in memory and len(memory['embedding']) != 1536:
                logger.warning(f"[SupabaseSync] Embedding dimension mismatch: {len(memory['embedding'])} != 1536, skipping embedding")
                del memory['embedding']
            
            response = self.client.table('memories').insert(memory).execute()
            logger.info(f"[SupabaseSync] Added memory: {memory['id']}")
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"[SupabaseSync] Add memory error: {e}")
            return None
    
    def get_memories(self, user_id: str, limit: int = 50) -> List[Dict]:
        """获取用户的记忆列表"""
        try:
            response = self.client.table('memories').select("*").eq('user_id', user_id).order('created_at', desc=True).limit(limit).execute()
            return response.data or []
        except Exception as e:
            logger.error(f"[SupabaseSync] Get memories error: {e}")
            return []
    
    def search_memories_text(self, user_id: str, query: str, limit: int = 10) -> List[Dict]:
        """文本搜索记忆（使用PostgreSQL全文搜索）"""
        try:
            response = self.client.table('memories').select("*").eq('user_id', user_id).ilike('content', f'%{query}%').execute()
            return response.data or []
        except Exception as e:
            logger.error(f"[SupabaseSync] Search memories error: {e}")
            return []
    
    # =========================================================================
    # Batch Sync
    # =========================================================================
    
    def batch_sync_memories(self, memories: List[Dict]) -> int:
        """批量同步记忆到云端"""
        success_count = 0
        for memory in memories:
            if self.add_memory(memory):
                success_count += 1
        logger.info(f"[SupabaseSync] Batch synced {success_count}/{len(memories)} memories")
        return success_count
    
    def sync_local_to_cloud(self, local_memories: List[Dict], user_id: str) -> Dict:
        """
        将本地记忆同步到云端
        
        Args:
            local_memories: 本地记忆列表
            user_id: 用户ID
            
        Returns:
            同步结果统计
        """
        # 获取云端已有记忆
        cloud_memories = self.get_memories(user_id, limit=1000)
        cloud_contents = {m['content'] for m in cloud_memories}
        
        # 找出需要同步的新记忆
        new_memories = [
            m for m in local_memories 
            if m.get('content') not in cloud_contents
        ]
        
        # 批量同步
        synced = self.batch_sync_memories(new_memories)
        
        result = {
            'total_local': len(local_memories),
            'already_synced': len(cloud_memories),
            'newly_synced': synced,
            'failed': len(new_memories) - synced
        }
        
        logger.info(f"[SupabaseSync] Sync result: {result}")
        return result
    
    # =========================================================================
    # Stats
    # =========================================================================
    
    def get_user_stats(self, user_id: str) -> Dict:
        """获取用户统计信息"""
        try:
            sessions = self.get_user_sessions(user_id, limit=100)
            memories = self.get_memories(user_id, limit=1000)
            
            total_duration = sum(s.get('duration', 0) or 0 for s in sessions)
            
            return {
                'total_sessions': len(sessions),
                'total_memories': len(memories),
                'total_duration_seconds': total_duration,
                'avg_session_duration': total_duration / len(sessions) if sessions else 0,
                'last_session': sessions[0]['start_time'] if sessions else None
            }
        except Exception as e:
            logger.error(f"[SupabaseSync] Get stats error: {e}")
            return {}


# =========================================================================
# Async Wrapper for TEN Framework
# =========================================================================

class AsyncSupabaseSync:
    """
    异步Supabase同步包装器
    
    TEN Framework使用async/await，此类提供异步接口。
    """
    
    def __init__(self, url: str = None, key: str = None):
        self._sync = SupabaseSync(url, key)
    
    async def add_memory(self, memory: Dict) -> Optional[Dict]:
        """异步添加记忆"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync.add_memory, memory)
    
    async def get_memories(self, user_id: str, limit: int = 50) -> List[Dict]:
        """异步获取记忆"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync.get_memories, user_id, limit)
    
    async def create_session(self, session: Dict) -> Optional[Dict]:
        """异步创建会话"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync.create_session, session)
    
    async def end_session(self, session_id: str, transcript: str = None) -> Optional[Dict]:
        """异步结束会话"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync.end_session, session_id, transcript)
    
    async def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """异步获取用户画像"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync.get_user_profile, user_id)
    
    async def upsert_user_profile(self, profile: Dict) -> Optional[Dict]:
        """异步插入或更新用户画像"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync.upsert_user_profile, profile)
    
    async def sync_local_to_cloud(self, local_memories: List[Dict], user_id: str) -> Dict:
        """异步同步本地到云端"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync.sync_local_to_cloud, local_memories, user_id)
    
    async def get_user_stats(self, user_id: str) -> Dict:
        """异步获取用户统计"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync.get_user_stats, user_id)
