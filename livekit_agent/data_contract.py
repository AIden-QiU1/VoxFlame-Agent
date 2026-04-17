from __future__ import annotations

import json
from typing import Any

from session_context import VoxFlameSessionContext
from session_userdata import (
    PreparationContextPack,
    SessionWorkingMemory,
    build_session_compaction_candidate,
)


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
    session_memory: SessionWorkingMemory | None = None,
    *,
    caption_mode_enabled: bool = False,
) -> dict[str, Any]:
    compaction_candidate = None
    if session_memory is not None:
        compaction_candidate = build_session_compaction_candidate(
            preparation,
            session_memory,
            session_kind="training" if ctx.mode == "training" else "communication",
        )

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
            "hotwords": preparation.hotwords,
            "risky_terms": preparation.risky_terms,
            "document_summary": preparation.document_summary,
            "document_content": preparation.document_content,
            "reference_lines": preparation.reference_lines,
            "training_pairs": preparation.training_pairs,
            "loadout_mode": preparation.loadout_mode,
            "loadout_reason": preparation.loadout_reason,
            "loadout_items": preparation.loadout_items,
        },
        "session_memory": {
            "current_turn_state": session_memory.current_turn_state,
            "turn_count": session_memory.turn_count,
            "context_revision": session_memory.context_revision,
            "last_preparation_source": session_memory.last_preparation_source,
            "interruption_count": session_memory.interruption_count,
            "barge_in_count": session_memory.barge_in_count,
            "caption_mode_enabled": caption_mode_enabled,
        } if session_memory is not None else None,
        "compaction_candidate": {
            "session_kind": compaction_candidate.session_kind,
            "summary": compaction_candidate.summary,
            "fallback_phrases": compaction_candidate.fallback_phrases,
            "risky_terms": compaction_candidate.risky_terms,
            "support_strategies": compaction_candidate.support_strategies,
            "hotwords": compaction_candidate.hotwords,
            "recent_user_intents": compaction_candidate.recent_user_intents,
            "recent_confirmed_phrases": compaction_candidate.recent_confirmed_phrases,
            "loadout_mode": compaction_candidate.loadout_mode,
            "context_revision": compaction_candidate.context_revision,
            "turn_count": compaction_candidate.turn_count,
            "interruption_count": compaction_candidate.interruption_count,
            "barge_in_count": compaction_candidate.barge_in_count,
        } if compaction_candidate is not None else None,
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


def extract_preparation_context_update(
    message: dict[str, Any],
) -> dict[str, Any] | None:
    if message.get("type") != "preparation_context_update":
        return None

    preparation = message.get("preparation")
    return preparation if isinstance(preparation, dict) else None
