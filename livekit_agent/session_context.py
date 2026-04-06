from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class VoxFlameSessionContext:
    request_id: str | None
    room_name: str
    participant_identity: str
    participant_name: str | None
    mode: str
    surface: str
    scene: str | None
    session_strategy: str
    requested_capabilities: list[str] = field(default_factory=list)
    granted_capabilities: list[str] = field(default_factory=list)
    raw_participant_metadata: str | None = None
    raw_job_metadata: str | None = None
    raw_attributes: dict[str, str] = field(default_factory=dict)
    participant_payload: dict[str, Any] = field(default_factory=dict)
    dispatch_payload: dict[str, Any] = field(default_factory=dict)


def _safe_json_loads(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}

    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    return value if isinstance(value, dict) else {}


def build_session_context(
    room_name: str,
    participant_identity: str,
    participant_name: str | None,
    metadata: str | None = None,
    job_metadata: str | None = None,
    attributes: dict[str, str] | None = None,
) -> VoxFlameSessionContext:
    participant_payload = _safe_json_loads(metadata)
    dispatch_payload = _safe_json_loads(job_metadata)

    participant_intent = _read_payload(participant_payload, "session_intent")
    dispatch_intent = _read_payload(dispatch_payload, "session_intent")
    intent = {
        **participant_intent,
        **dispatch_intent,
    }

    capabilities = _merge_string_lists(
        participant_payload.get("granted_capabilities"),
        dispatch_payload.get("granted_capabilities"),
    )

    requested_capabilities = _merge_string_lists(
        participant_intent.get("requestedCapabilities"),
        dispatch_intent.get("requestedCapabilities"),
    )

    resolved_participant_identity = _read_optional_string(
        dispatch_payload,
        "participant_identity",
    ) or participant_identity

    request_id = _read_optional_string(dispatch_payload, "request_id") or _read_optional_string(
        participant_payload,
        "request_id",
    )

    return VoxFlameSessionContext(
        request_id=request_id,
        room_name=room_name,
        participant_identity=resolved_participant_identity,
        participant_name=participant_name,
        mode=_read_string(intent, "mode", "communication"),
        surface=_read_string(intent, "surface", "communication_workspace"),
        scene=_read_optional_string(intent, "scene"),
        session_strategy=_read_string(intent, "sessionStrategy", "heavy_realtime"),
        requested_capabilities=requested_capabilities,
        granted_capabilities=capabilities,
        raw_participant_metadata=metadata,
        raw_job_metadata=job_metadata,
        raw_attributes=attributes or {},
        participant_payload=participant_payload,
        dispatch_payload=dispatch_payload,
    )


def _read_payload(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    return value if isinstance(value, dict) else {}


def _merge_string_lists(*values: Any) -> list[str]:
    merged: list[str] = []
    for value in values:
        if not isinstance(value, list):
            continue

        for item in value:
            if isinstance(item, str) and item not in merged:
                merged.append(item)
    return merged


def _read_string(payload: dict[str, Any], key: str, fallback: str) -> str:
    value = payload.get(key)
    return value if isinstance(value, str) and value.strip() else fallback


def _read_optional_string(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    return value if isinstance(value, str) and value.strip() else None
