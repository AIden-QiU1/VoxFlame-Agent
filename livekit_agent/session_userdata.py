from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from session_context import VoxFlameSessionContext


@dataclass(slots=True)
class PreparationContextPack:
    source: str
    scene: str | None
    immediate_goal: str
    profile_summary: str
    listener_guidance: list[str] = field(default_factory=list)
    support_strategies: list[str] = field(default_factory=list)
    document_summary: str = ""
    document_content: str = ""
    reference_lines: list[str] = field(default_factory=list)
    training_pairs: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class VoxFlameSessionUserData:
    preparation: PreparationContextPack
    current_turn_state: str = "idle"
    last_user_transcript: str | None = None
    last_assistant_reply: str | None = None
    interruption_count: int = 0
    barge_in_count: int = 0
    caption_mode_enabled: bool = False

    def note_user_transcript(self, transcript: str) -> None:
        normalized = transcript.strip()
        if not normalized:
            return
        self.last_user_transcript = normalized

    def note_assistant_reply(self, reply: str) -> None:
        normalized = reply.strip()
        if normalized:
            self.last_assistant_reply = normalized

    def note_speech_activity(self, state: str, interruption_requested: bool) -> None:
        self.current_turn_state = state.strip() or self.current_turn_state
        if interruption_requested:
            self.interruption_count += 1
        if state == "barge_in_triggered":
            self.barge_in_count += 1

    def set_caption_mode(self, enabled: bool) -> None:
        self.caption_mode_enabled = enabled


def build_session_userdata(ctx: VoxFlameSessionContext) -> VoxFlameSessionUserData:
    return VoxFlameSessionUserData(preparation=build_preparation_context_pack(ctx))


def build_preparation_context_pack(
    ctx: VoxFlameSessionContext,
) -> PreparationContextPack:
    explicit_pack = _read_preparation_payload(ctx)
    if explicit_pack:
        return explicit_pack

    scene = (ctx.scene or "").strip() or None
    immediate_goal = (
        f"当前优先先准备“{scene}”场景下最关键的一句表达。"
        if scene
        else "当前优先先准备最关键的一句表达。"
    )
    profile_summary = (
        f"当前会话处于{scene}场景，agent 需要优先保真、少扩写、帮助用户把一句关键表达说清楚。"
        if scene
        else "当前会话以保真、少扩写、帮助用户把一句关键表达说清楚为优先。"
    )
    listener_guidance = [
        "如果系统没有听清，应优先给出更稳的直白表达，而不是自由发挥。",
        "如果用户重新开口，优先让出话权，避免抢话。",
    ]
    support_strategies = [
        "优先保留用户原意，只在必要时做更顺的重述。",
        "优先突出关键词、专有词和场景中的关键信息。",
    ]

    return PreparationContextPack(
        source="derived_minimal_v1",
        scene=scene,
        immediate_goal=immediate_goal,
        profile_summary=profile_summary,
        listener_guidance=listener_guidance,
        support_strategies=support_strategies,
    )


def _read_preparation_payload(ctx: VoxFlameSessionContext) -> PreparationContextPack | None:
    for payload in (
        ctx.participant_payload.get("preparation_context"),
        ctx.dispatch_payload.get("preparation_context"),
        ctx.participant_payload.get("workspace_preparation"),
        ctx.dispatch_payload.get("workspace_preparation"),
    ):
        if not isinstance(payload, dict):
            continue

        immediate_goal = _read_string(payload, "immediate_goal")
        profile_summary = _read_string(payload, "profile_summary")
        if not immediate_goal and not profile_summary:
            continue

        return PreparationContextPack(
            source="metadata",
            scene=_read_optional_string(payload, "scene") or ctx.scene,
            immediate_goal=immediate_goal or "当前优先先准备最关键的一句表达。",
            profile_summary=profile_summary
            or "当前准备上下文已载入，请优先参考这些准备信息帮助用户表达。",
            listener_guidance=_read_string_list(payload.get("listener_guidance")),
            support_strategies=_read_string_list(payload.get("support_strategies")),
            document_summary=_read_string(payload, "document_summary"),
            document_content=_read_string(payload, "document_content"),
            reference_lines=_read_string_list(payload.get("reference_lines")),
            training_pairs=_read_training_pairs(payload.get("training_pairs")),
        )

    return None


def _read_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else ""


def _read_optional_string(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


def _read_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    deduped: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        normalized = item.strip()
        if normalized and normalized not in deduped:
            deduped.append(normalized)
    return deduped[:80]

def _read_training_pairs(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    entries: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        target = item.get("target")
        heard = item.get("heard")
        if not isinstance(target, str) or not target.strip():
            continue
        if not isinstance(heard, str) or not heard.strip():
            continue
        raw_occurrence = item.get("occurrence_count")
        occurrence_count = (
            int(raw_occurrence)
            if isinstance(raw_occurrence, (int, float)) and int(raw_occurrence) > 0
            else 1
        )
        entries.append(
            {
                "target": target.strip(),
                "heard": heard.strip(),
                "occurrence_count": occurrence_count,
            }
        )
    return entries[:80]
