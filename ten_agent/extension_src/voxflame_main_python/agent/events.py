#
# VoxFlame Agent Events
# Defines semantic events for the main control extension
#

from pydantic import BaseModel
from typing import Literal, Optional, Union, Dict, Any


# ==== Base Event ====

class AgentEventBase(BaseModel):
    """Base class for all agent-level events."""
    type: Literal["cmd", "data"]
    name: str


# ==== CMD Events ====

class UserConnectedEvent(AgentEventBase):
    """Event triggered when a user connects via WebSocket."""
    type: Literal["cmd"] = "cmd"
    name: Literal["on_user_connected"] = "on_user_connected"


class UserDisconnectedEvent(AgentEventBase):
    """Event triggered when a user disconnects."""
    type: Literal["cmd"] = "cmd"
    name: Literal["on_user_disconnected"] = "on_user_disconnected"


# ==== DATA Events ====

class ASRResultEvent(AgentEventBase):
    """Event triggered when ASR result is received."""
    type: Literal["data"] = "data"
    name: Literal["asr_result"] = "asr_result"
    text: str
    is_final: bool
    start_ms: int = 0
    duration_ms: int = 0
    language: str = ""
    metadata: Dict[str, Any] = {}


class CorrectedTextEvent(AgentEventBase):
    """Event triggered when LLM correction is complete."""
    type: Literal["data"] = "data"
    name: Literal["corrected_text"] = "corrected_text"
    original_text: str
    corrected_text: str
    metadata: Dict[str, Any] = {}


class TTSStartEvent(AgentEventBase):
    """Event triggered when TTS starts playing."""
    type: Literal["data"] = "data"
    name: Literal["tts_start"] = "tts_start"
    request_id: str = ""


class TTSEndEvent(AgentEventBase):
    """Event triggered when TTS finishes playing."""
    type: Literal["data"] = "data"
    name: Literal["tts_end"] = "tts_end"
    request_id: str = ""


class InterruptEvent(AgentEventBase):
    """Event triggered when user speech interrupts TTS."""
    type: Literal["data"] = "data"
    name: Literal["interrupt"] = "interrupt"
    reason: str = "user_speech"


# ==== Unified Event Union ====

AgentEvent = Union[
    UserConnectedEvent,
    UserDisconnectedEvent,
    ASRResultEvent,
    CorrectedTextEvent,
    TTSStartEvent,
    TTSEndEvent,
    InterruptEvent,
]
