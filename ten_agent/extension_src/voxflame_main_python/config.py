#
# VoxFlame Main Control Configuration
#

from pydantic import BaseModel
from typing import Optional, List


class VoxFlameMainConfig(BaseModel):
    """Configuration for VoxFlame Main Control Extension"""

    # Greeting message when user connects
    greeting: str = "您好，我是燃言语音助手，请说话"

    # Enable greeting on connect
    enable_greeting: bool = True

    # LLM correction settings
    enable_correction: bool = True

    # Interrupt settings - interrupt TTS when user speaks
    enable_interrupt: bool = True
    interrupt_threshold_ms: int = 200  # Min speech duration to trigger interrupt

    # User profile for personalization
    user_id: str = ""
    user_name: str = ""

    # Hotwords for ASR enhancement
    hotwords: List[str] = []

    # Supabase integration
    supabase_url: str = ""
    supabase_key: str = ""
    enable_memory: bool = False
