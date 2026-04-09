from __future__ import annotations

import json
from typing import Any

from session_context import VoxFlameSessionContext
from session_userdata import PreparationContextPack


def decode_data_packet(payload: bytes | bytearray | memoryview | str) -> dict[str, Any] | None:
    if isinstance(payload, str):
        raw_text = payload
    else:
        try:
            raw_text = bytes(payload).decode("utf-8")
        except UnicodeDecodeError:
            return None

    try:
        decoded = json.loads(raw_text)
    except json.JSONDecodeError:
        return None

    return decoded if isinstance(decoded, dict) else None


def build_session_init_ack(ctx: VoxFlameSessionContext) -> dict[str, Any]:
    return {
        "type": "session_init_ack",
        "message": "livekit_agent minimal communication loop is connected.",
        "metadata": {
            "request_id": ctx.request_id,
            "surface": ctx.surface,
            "mode": ctx.mode,
            "scene": ctx.scene,
            "session_strategy": ctx.session_strategy,
            "granted_capabilities": ctx.granted_capabilities,
        },
    }


def build_session_userdata_ack(
    ctx: VoxFlameSessionContext,
    preparation: PreparationContextPack,
) -> dict[str, Any]:
    return {
        "type": "session_userdata_ack",
        "metadata": {
            "request_id": ctx.request_id,
            "surface": ctx.surface,
            "mode": ctx.mode,
            "scene": ctx.scene,
            "source": preparation.source,
        },
        "preparation": {
            "immediate_goal": preparation.immediate_goal,
            "profile_summary": preparation.profile_summary,
            "listener_guidance": preparation.listener_guidance,
            "support_strategies": preparation.support_strategies,
            "document_summary": preparation.document_summary,
            "document_content": preparation.document_content,
            "reference_lines": preparation.reference_lines,
            "training_pairs": preparation.training_pairs,
        },
    }


def build_error_output(message: str) -> dict[str, Any]:
    return {
        "type": "error",
        "message": message.strip() or "LiveKit worker error",
    }


def build_assistant_text_output(
    ctx: VoxFlameSessionContext,
    user_text: str,
    *,
    source: str = "livekit_agent_stub",
    metadata_type: str = "assistant_text_output",
    original_text: str | None = None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "type": metadata_type,
        "source": source,
        "request_id": ctx.request_id,
    }
    if original_text and original_text.strip():
        metadata["original"] = original_text.strip()

    return {
        "type": "transcript",
        "role": "assistant",
        "text": user_text.strip(),
        "is_final": True,
        "metadata": metadata,
    }


def build_user_transcript_output(
    ctx: VoxFlameSessionContext,
    user_text: str,
    *,
    is_final: bool,
    source: str = "dashscope_realtime_asr",
) -> dict[str, Any]:
    return {
        "type": "transcript",
        "role": "user",
        "text": user_text.strip(),
        "is_final": is_final,
        "metadata": {
            "type": "user_transcript_output",
            "source": source,
            "request_id": ctx.request_id,
        },
    }


def build_voice_profile_updated_output(
    ctx: VoxFlameSessionContext,
    *,
    source: str,
    clarity_score: float,
    confusion_patterns_count: int,
    scene: str | None = None,
    exercise_id: str | None = None,
    hotword_count: int = 0,
    last_training_category: str | None = None,
) -> dict[str, Any]:
    return {
        "type": "voice_profile_updated",
        "source": source,
        "exercise_id": (exercise_id or ctx.request_id or "").strip(),
        "exercise_category": (scene or ctx.scene or "communication").strip(),
        "hotword_count": max(0, hotword_count),
        "confusion_patterns_count": max(0, confusion_patterns_count),
        "clarity_score": max(0.0, min(1.0, clarity_score)),
        "last_training_category": (
            last_training_category or scene or ctx.scene or "沟通工作台"
        ).strip(),
    }


def build_speech_activity_output(
    ctx: VoxFlameSessionContext,
    *,
    state: str,
    auto_finalize: bool,
    source: str = "server_vad",
    interruption_requested: bool = False,
    speech_duration_ms: int = 0,
) -> dict[str, Any]:
    return {
        "type": "speech_activity",
        "state": state,
        "source": source,
        "auto_finalize": auto_finalize,
        "interruption_requested": interruption_requested,
        "speech_duration_ms": max(0, speech_duration_ms),
        "metadata": {
            "request_id": ctx.request_id,
            "surface": ctx.surface,
            "mode": ctx.mode,
            "scene": ctx.scene,
        },
    }


def build_audio_input_telemetry_output(
    ctx: VoxFlameSessionContext,
    *,
    normalized_level: float,
    peak_level: float,
    clipping_detected: bool,
    apm_enabled: bool,
    reason: str,
    source: str = "server_audio_analysis",
) -> dict[str, Any]:
    return {
        "type": "audio_input_telemetry",
        "source": source,
        "reason": reason.strip() or "unspecified",
        "normalized_level": max(0.0, min(1.0, normalized_level)),
        "peak_level": max(0.0, min(1.0, peak_level)),
        "clipping_detected": clipping_detected,
        "apm_enabled": apm_enabled,
        "metadata": {
            "request_id": ctx.request_id,
            "surface": ctx.surface,
            "mode": ctx.mode,
            "scene": ctx.scene,
        },
    }


def extract_user_text_input(message: dict[str, Any]) -> str | None:
    if message.get("type") != "user_input":
        return None
    if message.get("input_type") != "text":
        return None

    text = message.get("text")
    return text.strip() if isinstance(text, str) and text.strip() else None


def extract_end_audio_reason(message: dict[str, Any]) -> str | None:
    if message.get("type") != "end_audio":
        return None

    reason = message.get("reason")
    return reason.strip() if isinstance(reason, str) and reason.strip() else "unknown"


def extract_caption_mode_update(message: dict[str, Any]) -> bool | None:
    if message.get("type") != "caption_mode_update":
        return None

    enabled = message.get("enabled")
    return enabled if isinstance(enabled, bool) else None
