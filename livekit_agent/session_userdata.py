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
    hotwords: list[str] = field(default_factory=list)
    risky_terms: list[str] = field(default_factory=list)
    document_summary: str = ""
    document_content: str = ""
    reference_lines: list[str] = field(default_factory=list)
    training_pairs: list[dict[str, Any]] = field(default_factory=list)
    loadout_mode: str = ""
    loadout_reason: str = ""
    loadout_items: list[str] = field(default_factory=list)


@dataclass(slots=True)
class SessionTurnRecord:
    user_text: str
    assistant_text: str
    source: str = "unknown"


@dataclass(slots=True)
class SessionWorkingMemory:
    current_turn_state: str = "idle"
    current_user_transcript: str | None = None
    current_assistant_reply: str | None = None
    recent_turns: list[SessionTurnRecord] = field(default_factory=list)
    turn_count: int = 0
    context_revision: int = 1
    last_preparation_source: str = "derived_minimal_v1"
    interruption_count: int = 0
    barge_in_count: int = 0


@dataclass(slots=True)
class SessionCompactionCandidate:
    session_kind: str
    summary: str
    fallback_phrases: list[str] = field(default_factory=list)
    risky_terms: list[str] = field(default_factory=list)
    support_strategies: list[str] = field(default_factory=list)
    hotwords: list[str] = field(default_factory=list)
    recent_user_intents: list[str] = field(default_factory=list)
    recent_confirmed_phrases: list[str] = field(default_factory=list)
    loadout_mode: str = ""
    context_revision: int = 1
    turn_count: int = 0
    interruption_count: int = 0
    barge_in_count: int = 0


@dataclass(slots=True)
class VoxFlameSessionUserData:
    preparation: PreparationContextPack
    session_memory: SessionWorkingMemory
    voice_reply_enabled: bool = True
    caption_mode_enabled: bool = False

    def note_user_transcript(self, transcript: str) -> None:
        normalized = transcript.strip()
        if not normalized:
            return
        self.session_memory.current_user_transcript = normalized
        self.session_memory.current_assistant_reply = None

    def note_assistant_reply(self, reply: str, *, source: str = "unknown") -> None:
        normalized = reply.strip()
        if normalized:
            self.session_memory.current_assistant_reply = normalized
            if self.session_memory.current_user_transcript:
                self.session_memory.turn_count += 1
                self.session_memory.recent_turns.append(
                    SessionTurnRecord(
                        user_text=self.session_memory.current_user_transcript,
                        assistant_text=normalized,
                        source=source,
                    ),
                )
                self.session_memory.recent_turns = self.session_memory.recent_turns[-6:]

    def note_speech_activity(self, state: str, interruption_requested: bool) -> None:
        self.session_memory.current_turn_state = state.strip() or self.session_memory.current_turn_state
        if interruption_requested:
            self.session_memory.interruption_count += 1
        if state == "barge_in_triggered":
            self.session_memory.barge_in_count += 1

    def set_caption_mode(self, enabled: bool) -> None:
        self.caption_mode_enabled = enabled

    def should_skip_tts(self) -> bool:
        return self.caption_mode_enabled or not self.voice_reply_enabled

    def replace_preparation(self, preparation: PreparationContextPack) -> None:
        self.preparation = preparation
        self.session_memory.context_revision += 1
        self.session_memory.last_preparation_source = preparation.source


def build_session_compaction_candidate(
    preparation: PreparationContextPack,
    session_memory: SessionWorkingMemory,
    *,
    session_kind: str,
) -> SessionCompactionCandidate | None:
    recent_turns = session_memory.recent_turns[-3:]
    recent_user_intents = _dedupe_strings([turn.user_text for turn in recent_turns], limit=3)
    recent_confirmed_phrases = _dedupe_strings(
        [turn.assistant_text for turn in recent_turns],
        limit=2 if session_kind == "training" else 3,
    )
    support_strategies = _dedupe_strings(
        [
            *preparation.support_strategies,
            *preparation.listener_guidance,
        ],
        limit=2 if session_kind == "training" else 3,
    )
    hotwords = _dedupe_strings(
        [
            *preparation.hotwords,
            *[
                pair.get("target")
                for pair in preparation.training_pairs
                if isinstance(pair.get("target"), str)
            ],
            *preparation.reference_lines,
        ],
        limit=1 if session_kind == "training" else 3,
    )

    latest_risky_term: str | None = None
    latest_fallback_phrase: str | None = None
    for turn in reversed(recent_turns):
        normalized_user = turn.user_text.strip()
        normalized_assistant = turn.assistant_text.strip()
        if not normalized_user or not normalized_assistant:
            continue
        if normalized_user != normalized_assistant:
            latest_risky_term = normalized_user
            latest_fallback_phrase = normalized_assistant
            break

    risky_terms = _dedupe_strings(
        [*preparation.risky_terms, latest_risky_term],
        limit=1 if session_kind == "training" else 2,
    )
    fallback_phrases = _dedupe_strings(
        [latest_fallback_phrase, *recent_confirmed_phrases],
        limit=2 if session_kind == "training" else 3,
    )

    summary = _build_compaction_summary(
        session_kind=session_kind,
        loadout_mode=preparation.loadout_mode,
        loadout_items=preparation.loadout_items,
        risky_terms=risky_terms,
        fallback_phrases=fallback_phrases,
        support_strategies=support_strategies,
    )
    if not summary:
        return None

    return SessionCompactionCandidate(
        session_kind=session_kind,
        summary=summary,
        fallback_phrases=fallback_phrases,
        risky_terms=risky_terms,
        support_strategies=support_strategies,
        hotwords=hotwords,
        recent_user_intents=recent_user_intents,
        recent_confirmed_phrases=recent_confirmed_phrases,
        loadout_mode=preparation.loadout_mode,
        context_revision=session_memory.context_revision,
        turn_count=session_memory.turn_count,
        interruption_count=session_memory.interruption_count,
        barge_in_count=session_memory.barge_in_count,
    )


def build_session_userdata(ctx: VoxFlameSessionContext) -> VoxFlameSessionUserData:
    preparation = build_preparation_context_pack(ctx)
    return VoxFlameSessionUserData(
        preparation=preparation,
        session_memory=SessionWorkingMemory(
            context_revision=1,
            last_preparation_source=preparation.source,
        ),
        voice_reply_enabled=(
            ctx.surface not in {"communication_workspace", "training_workspace"}
            and ctx.mode != "training"
        ),
    )


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
        hotwords=[],
        risky_terms=[],
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

        preparation = build_preparation_context_pack_from_payload(
            payload,
            fallback_scene=ctx.scene,
            source="metadata",
        )
        if preparation is not None:
            return preparation

    return None


def build_preparation_context_pack_from_payload(
    payload: dict[str, Any],
    *,
    fallback_scene: str | None = None,
    source: str = "runtime_update",
) -> PreparationContextPack | None:
    immediate_goal = _read_string(payload, "immediate_goal")
    profile_summary = _read_string(payload, "profile_summary")
    listener_guidance = _read_string_list(payload.get("listener_guidance"))
    support_strategies = _read_string_list(payload.get("support_strategies"))
    hotwords = _read_string_list(payload.get("hotwords"))
    risky_terms = _read_string_list(payload.get("risky_terms"))
    document_summary = _read_string(payload, "document_summary")
    document_content = _read_string(payload, "document_content")
    training_pairs = _read_training_pairs(payload.get("training_pairs"))
    reference_lines = _read_string_list(payload.get("reference_lines"))
    loadout_mode = _read_string(payload, "loadout_mode")
    loadout_reason = _read_string(payload, "loadout_reason")
    loadout_items = _read_string_list(payload.get("loadout_items"))

    if not any(
        (
            immediate_goal,
            profile_summary,
            listener_guidance,
            support_strategies,
            hotwords,
            risky_terms,
            document_summary,
            document_content,
            reference_lines,
            training_pairs,
            loadout_mode,
            loadout_reason,
            loadout_items,
        )
    ):
        return None

    return PreparationContextPack(
        source=source,
        scene=_read_optional_string(payload, "scene") or fallback_scene,
        immediate_goal=immediate_goal or "当前优先先准备最关键的一句表达。",
        profile_summary=profile_summary
        or "当前准备上下文已载入，请优先参考这些准备信息帮助用户表达。",
        listener_guidance=listener_guidance,
        support_strategies=support_strategies,
        hotwords=hotwords,
        risky_terms=risky_terms,
        document_summary=document_summary,
        document_content=document_content,
        reference_lines=reference_lines,
        training_pairs=training_pairs,
        loadout_mode=loadout_mode,
        loadout_reason=loadout_reason,
        loadout_items=loadout_items,
    )


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


def _dedupe_strings(values: list[str | None], *, limit: int) -> list[str]:
    deduped: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        normalized = value.strip()
        if normalized and normalized not in deduped:
            deduped.append(normalized)
        if len(deduped) >= limit:
            break
    return deduped


def _build_compaction_summary(
    *,
    session_kind: str,
    loadout_mode: str,
    loadout_items: list[str],
    risky_terms: list[str],
    fallback_phrases: list[str],
    support_strategies: list[str],
) -> str:
    if risky_terms and fallback_phrases:
        return (
            f"最近一轮里，系统更容易把“{risky_terms[0]}”听偏。"
            f"当前更稳的表达是“{fallback_phrases[0]}”。"
        )

    if fallback_phrases:
        return f"最近确认过的更稳表达是“{fallback_phrases[0]}”。"

    if support_strategies:
        return f"当前最值得继续保持的是：{support_strategies[0]}"

    if loadout_mode and loadout_items:
        mode_label = "长时间沟通" if loadout_mode == "long_form" else "紧急沟通"
        return f"当前会话按“{mode_label}”模式装配，上下文重点是“{loadout_items[0]}”。"

    if session_kind == "training":
        return "当前训练会话已经形成最小 compaction 候选，可用于后续每日或 7 天总结。"

    return ""

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
