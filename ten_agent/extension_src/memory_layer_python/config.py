#
# Memory Layer Configuration
#

from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class StorageBackendConfig(BaseModel):
    """Configuration for a storage backend"""
    enabled: bool = True
    config: Dict[str, Any] = {}


class LearningConfig(BaseModel):
    """Configuration for learning algorithms"""
    auto_hotword_threshold: int = 3  # Times a word is corrected before becoming hotword
    confusion_pattern_threshold: int = 5  # Times pattern seen before learning
    clarity_score_window: int = 100  # Number of utterances for rolling average


class SyncConfig(BaseModel):
    """Configuration for cloud sync"""
    interval_seconds: int = 30
    on_session_end: bool = True


class MemoryLayerConfig(BaseModel):
    """Configuration for Memory Layer Extension"""

    # Storage backend selection: "local", "powermem", "hybrid"
    storage_backend: str = "local"

    # Local storage configuration
    local_base_path: str = "~/.voxflame"
    local_sqlite_db: str = "memory.db"

    # PowerMem configuration (optional)
    powermem_api_key: str = ""
    powermem_collection: str = "voxflame_memories"

    # Supabase configuration for voice profile
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Learning configuration
    learning: LearningConfig = LearningConfig()

    # Sync configuration
    sync: SyncConfig = SyncConfig()

    # User context
    user_id: str = ""
    agent_id: str = "voxflame_voice_assistant"
