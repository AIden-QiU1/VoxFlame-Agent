#
# Memory Layer Extension
# Main extension implementation for TEN Framework
#

import json
import time
import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any

from ten_runtime import (
    AsyncExtension,
    AsyncTenEnv,
    Cmd,
    CmdResult,
    Data,
    StatusCode,
)

from .config import MemoryLayerConfig
from .stores.base import ConversationTurn, VoiceProfile, ConfusionPattern
from .stores.local_store import LocalStore


DEFAULT_CLIENT_ID = "default"


@dataclass
class MemorySessionContext:
    """Per-client memory session context."""

    client_id: str
    user_id: str = ""
    agent_id: str = "voxflame_voice_assistant"
    store: Optional[LocalStore] = None
    pending_corrections: list[dict[str, Any]] = field(default_factory=list)
    correction_counts: Dict[str, int] = field(default_factory=dict)


class MemoryLayerExtension(AsyncExtension):
    """
    Memory Layer Extension for VoxFlame

    Responsibilities:
    1. Store conversation turns for context
    2. Learn pronunciation patterns from corrections
    3. Manage user voice profile (hotwords, confusion patterns)
    4. Calculate and track clarity scores
    5. Provide memory context for LLM correction
    """

    def __init__(self, name: str):
        super().__init__(name)
        self.ten_env: AsyncTenEnv = None
        self.config: MemoryLayerConfig = None
        self.stopped: bool = False

        # client_id -> session context.
        self.sessions: Dict[str, MemorySessionContext] = {}

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """Initialize the extension."""
        self.ten_env = ten_env
        ten_env.log_info("[MemoryLayer] Initializing...")

        try:
            config_json, _ = await ten_env.get_property_to_json(None)
            self.config = MemoryLayerConfig.model_validate_json(config_json)
            ten_env.log_info(
                f"[MemoryLayer] Config loaded: backend={self.config.storage_backend}"
            )
        except Exception as e:
            ten_env.log_warn(f"[MemoryLayer] Failed to load config, using defaults: {e}")
            self.config = MemoryLayerConfig()

    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """Called when extension starts."""
        ten_env.log_info("[MemoryLayer] Started")

    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """Called when extension stops."""
        ten_env.log_info("[MemoryLayer] Stopping...")
        self.stopped = True

        for client_id, session in list(self.sessions.items()):
            await self._flush_session(session)
            if session.store:
                await session.store.close()
            self.sessions.pop(client_id, None)

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """Cleanup resources."""
        ten_env.log_info("[MemoryLayer] Deinitialized")

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Handle incoming commands."""
        cmd_name = cmd.get_name()
        ten_env.log_info(f"[MemoryLayer] Received cmd: {cmd_name}")

        cmd_data = self._load_json_from_cmd(cmd)
        client_id = self._resolve_client_id_from_cmd(cmd, cmd_data)

        try:
            if cmd_name == "init_memory":
                await self._handle_init_memory(ten_env, cmd, client_id, cmd_data)
            elif cmd_name == "save_conversation":
                await self._handle_save_conversation(ten_env, cmd, client_id, cmd_data)
            elif cmd_name == "search_memory":
                await self._handle_search_memory(ten_env, cmd, client_id, cmd_data)
            elif cmd_name == "get_voice_profile":
                await self._handle_get_voice_profile(ten_env, cmd, client_id)
            elif cmd_name == "update_voice_profile":
                await self._handle_update_voice_profile(ten_env, cmd, client_id, cmd_data)
            elif cmd_name == "system_init":
                await self._handle_system_init(ten_env, cmd, client_id, cmd_data)
            elif cmd_name == "flush":
                await self._handle_flush(ten_env, cmd, client_id, cmd_data)
            else:
                ten_env.log_warn(f"[MemoryLayer] Unknown cmd: {cmd_name}")
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error handling cmd {cmd_name}: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle incoming data."""
        data_name = data.get_name()

        try:
            if data_name == "correction_event":
                await self._handle_correction_event(ten_env, data)
            elif data_name == "session_start":
                await self._handle_session_start(ten_env, data)
            elif data_name == "session_end":
                await self._handle_session_end(ten_env, data)
            else:
                ten_env.log_debug(f"[MemoryLayer] Unhandled data: {data_name}")

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error handling data {data_name}: {e}")

    # ========================================
    # Command Handlers
    # ========================================

    async def _handle_system_init(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
        cmd_data: Dict[str, Any],
    ) -> None:
        """Handle system_init command directly from websocket server."""
        user = cmd_data.get("user", {})
        if not isinstance(user, dict):
            await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))
            return

        init_payload = {
            "user_id": user.get("id", self._build_anonymous_user_id(client_id)),
            "user_name": user.get("name", ""),
            "user_email": user.get("email", ""),
            "agent_id": self.config.agent_id,
        }
        await self._handle_init_memory(ten_env, cmd, client_id, init_payload)

    async def _handle_init_memory(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
        cmd_data: Dict[str, Any],
    ) -> None:
        """Initialize memory for one client session."""
        try:
            user_id = (
                str(cmd_data.get("user_id", "") or "").strip()
                or self._build_anonymous_user_id(client_id)
            )
            agent_id = str(cmd_data.get("agent_id", "") or "").strip() or self.config.agent_id

            session = self._get_or_create_session(client_id)
            await self._initialize_session_store(session, user_id, agent_id)

            ten_env.log_info(
                f"[MemoryLayer] Memory initialized for client_id={client_id}, user_id={session.user_id}"
            )

            profile = await session.store.get_voice_profile()
            await self._broadcast_voice_profile(ten_env, client_id, profile)

            recent_turns = await session.store.search("", limit=5)
            if recent_turns:
                context_lines: list[str] = []
                for item in recent_turns:
                    text = item.get("content", "") if isinstance(item, dict) else ""
                    if text:
                        context_lines.append(f"- {text}")
                if context_lines:
                    await self._broadcast_memory_context(
                        ten_env,
                        client_id,
                        "\n".join(context_lines[:5]),
                    )

            await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error initializing memory: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_save_conversation(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
        turn_data: Dict[str, Any],
    ) -> None:
        """Save a conversation turn to client-scoped memory."""
        try:
            session = self._get_or_create_session(client_id)
            if not session.store:
                await self._initialize_session_store(session, session.user_id, session.agent_id)

            turn = ConversationTurn(
                role=turn_data.get("role", "user"),
                content=turn_data.get("content", ""),
                raw_asr=turn_data.get("raw_asr", ""),
                corrected_text=turn_data.get("corrected_text", ""),
                clarity_score=turn_data.get("clarity_score", 0.0),
                metadata={"client_id": client_id},
            )

            await session.store.add_conversation([turn])

            ten_env.log_info(
                f"[MemoryLayer] Saved conversation turn: client_id={client_id}, role={turn.role}"
            )
            await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error saving conversation: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_search_memory(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
        search_data: Dict[str, Any],
    ) -> None:
        """Search memory for relevant context."""
        try:
            query = search_data.get("query", "")
            limit = int(search_data.get("limit", 10))

            results = []
            session = self.sessions.get(client_id)
            if session and session.store:
                results = await session.store.search(query, limit)

            result = CmdResult.create(StatusCode.OK, cmd)
            result.set_property_from_json(
                None,
                json.dumps({"client_id": client_id, "results": results}),
            )
            await ten_env.return_result(result)

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error searching memory: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_get_voice_profile(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
    ) -> None:
        """Get user voice profile for one client."""
        try:
            profile = None
            session = self.sessions.get(client_id)
            if session and session.store:
                profile = await session.store.get_voice_profile()

            result = CmdResult.create(StatusCode.OK, cmd)
            if profile:
                payload = profile.to_dict()
                payload["client_id"] = client_id
                result.set_property_from_json(None, json.dumps(payload))
            await ten_env.return_result(result)

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error getting voice profile: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_update_voice_profile(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
        update_data: Dict[str, Any],
    ) -> None:
        """Update voice profile with new data."""
        try:
            session = self._get_or_create_session(client_id)
            if not session.store:
                await self._initialize_session_store(session, session.user_id, session.agent_id)

            profile = await session.store.get_voice_profile()

            if "hotwords" in update_data:
                for hw in update_data["hotwords"]:
                    if isinstance(hw, dict) and "word" in hw:
                        await session.store.add_hotword(hw["word"], hw.get("category", "custom"))

            if "preferences" in update_data and isinstance(update_data["preferences"], dict):
                profile.preferences.update(update_data["preferences"])

            merged_patterns = 0
            if isinstance(update_data.get("confusion_patterns"), list):
                merged_patterns = self._merge_confusion_patterns(
                    profile,
                    update_data["confusion_patterns"],
                )

            clarity_score = self._read_float(update_data.get("clarity_score"))
            if clarity_score is not None:
                await session.store.add_clarity_score(
                    clarity_score,
                    correction_rate=max(0.0, 1.0 - clarity_score),
                    session_id=str(update_data.get("session_id", "") or ""),
                )

            await session.store.update_voice_profile(profile)
            await self._broadcast_voice_profile(ten_env, client_id, profile)
            if clarity_score is not None:
                score = await session.store.get_clarity_score()
                await self._broadcast_clarity_score(ten_env, client_id, score)

            ten_env.log_info(
                f"[MemoryLayer] Voice profile updated: client_id={client_id}, "
                f"merged_patterns={merged_patterns}, clarity={'yes' if clarity_score is not None else 'no'}"
            )

            await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error updating voice profile: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_flush(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
        cmd_data: Dict[str, Any],
    ) -> None:
        """Flush pending data to storage."""
        explicit_client_id = self._extract_client_id(cmd_data)
        if explicit_client_id:
            target = self.sessions.get(explicit_client_id)
            if target:
                await self._flush_session(target)
        else:
            for session in self.sessions.values():
                await self._flush_session(session)

        await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

    # ========================================
    # Data Handlers
    # ========================================

    async def _handle_correction_event(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle correction event for learning."""
        try:
            data_json, _ = data.get_property_to_json(None)
            correction = json.loads(data_json) if data_json else {}

            client_id = self._extract_client_id(correction) or DEFAULT_CLIENT_ID
            session = self.sessions.get(client_id)
            if not session or not session.store:
                ten_env.log_debug(
                    f"[MemoryLayer] Skip correction_event for uninitialized client_id={client_id}"
                )
                return

            raw_text = correction.get("raw_text", "")
            corrected_text = correction.get("corrected_text", "")

            if not raw_text or not corrected_text or raw_text == corrected_text:
                return

            ten_env.log_info(
                f"[MemoryLayer] Correction client_id={client_id}: '{raw_text}' -> '{corrected_text}'"
            )

            await session.store.record_correction(raw_text, corrected_text)

            key = corrected_text.lower()
            session.correction_counts[key] = session.correction_counts.get(key, 0) + 1

            if session.correction_counts[key] >= self.config.learning.auto_hotword_threshold:
                ten_env.log_info(
                    f"[MemoryLayer] Auto-learning hotword for client_id={client_id}: {corrected_text}"
                )
                await session.store.add_hotword(corrected_text, "auto_learned")
                session.correction_counts[key] = 0

                profile = await session.store.get_voice_profile()
                await self._broadcast_voice_profile(ten_env, client_id, profile)

            score = await session.store.get_clarity_score()
            await self._broadcast_clarity_score(ten_env, client_id, score)

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error handling correction: {e}")

    async def _handle_session_start(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle session start event."""
        payload = self._load_json_from_data(data)
        client_id = self._extract_client_id(payload) or DEFAULT_CLIENT_ID
        session = self._get_or_create_session(client_id)

        session.pending_corrections = []
        ten_env.log_info(f"[MemoryLayer] Session started: client_id={client_id}")

    async def _handle_session_end(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle session end event."""
        payload = self._load_json_from_data(data)
        client_id = self._extract_client_id(payload) or DEFAULT_CLIENT_ID
        session = self.sessions.get(client_id)

        ten_env.log_info(f"[MemoryLayer] Session ended: client_id={client_id}")

        if not session or not session.store:
            return

        await session.store.learn_from_corrections(
            threshold=self.config.learning.confusion_pattern_threshold
        )
        profile = await session.store.get_voice_profile()
        await self._broadcast_voice_profile(ten_env, client_id, profile)
        score = await session.store.get_clarity_score()
        await self._broadcast_clarity_score(ten_env, client_id, score)
        await self._flush_session(session)

    # ========================================
    # Helper Methods
    # ========================================

    async def _initialize_session_store(
        self,
        session: MemorySessionContext,
        user_id: str,
        agent_id: str,
    ) -> None:
        """Initialize or re-initialize LocalStore for one session."""
        if (
            session.store
            and session.user_id == user_id
            and session.agent_id == agent_id
        ):
            return

        if session.store:
            await session.store.close()
            session.store = None

        if self.config.storage_backend != "local":
            self.ten_env.log_warn(
                "[MemoryLayer] Non-local backend not implemented, falling back to LocalStore"
            )

        session.store = LocalStore(
            base_path=self.config.local_base_path,
            db_name=self.config.local_sqlite_db,
        )
        await session.store.initialize(user_id, agent_id)

        session.user_id = user_id
        session.agent_id = agent_id

    async def _flush_session(self, session: MemorySessionContext) -> None:
        """Flush pending in-memory state for one session."""
        session.pending_corrections = []

    async def _broadcast_voice_profile(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        profile: VoiceProfile,
    ) -> None:
        """Broadcast voice profile for ASR enhancement."""
        try:
            data = Data.create("voice_profile")
            data.set_property_from_json(
                None,
                json.dumps(
                    {
                        "client_id": client_id,
                        "hotwords": profile.get_hotwords_for_asr(),
                        "confusion_rules": profile.get_confusion_rules(),
                        "confusion_patterns": [
                            pattern.to_dict() for pattern in profile.confusion_patterns[:12]
                        ],
                        "speech_rate": profile.speech_rate,
                        "dysarthria_type": profile.dysarthria_type,
                        "rolling_clarity": (
                            sum(item.score for item in profile.clarity_trend[-7:]) / len(profile.clarity_trend[-7:])
                            if profile.clarity_trend[-7:]
                            else 0.0
                        ),
                    }
                ),
            )
            await ten_env.send_data(data)
            ten_env.log_info(
                f"[MemoryLayer] Voice profile updated: client_id={client_id}, {len(profile.hotwords)} hotwords"
            )
        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error broadcasting profile: {e}")

    async def _broadcast_clarity_score(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        score: float,
    ) -> None:
        """Broadcast clarity score update."""
        try:
            data = Data.create("clarity_score")
            data.set_property_from_json(
                None,
                json.dumps(
                    {
                        "client_id": client_id,
                        "score": score,
                        "timestamp": int(time.time() * 1000),
                    }
                ),
            )
            await ten_env.send_data(data)
            ten_env.log_debug(
                f"[MemoryLayer] Clarity score client_id={client_id}: {score:.2f}"
            )
        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error broadcasting score: {e}")

    async def _broadcast_memory_context(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        context: str,
    ) -> None:
        """Broadcast memory context for LLM."""
        try:
            data = Data.create("memory_context")
            data.set_property_from_json(
                None,
                json.dumps(
                    {
                        "client_id": client_id,
                        "context": context,
                        "timestamp": int(time.time() * 1000),
                    }
                ),
            )
            await ten_env.send_data(data)
        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error broadcasting context: {e}")

    def _get_or_create_session(self, client_id: str) -> MemorySessionContext:
        """Get client memory session, create if missing."""
        normalized = client_id.strip() if client_id and client_id.strip() else DEFAULT_CLIENT_ID
        session = self.sessions.get(normalized)
        if session is None:
            session = MemorySessionContext(
                client_id=normalized,
                user_id=self._build_anonymous_user_id(normalized),
            )
            self.sessions[normalized] = session
        return session

    def _build_anonymous_user_id(self, client_id: str) -> str:
        normalized = client_id.strip() if client_id and client_id.strip() else DEFAULT_CLIENT_ID
        return f"anonymous::{normalized.replace(':', '_')}"

    def _resolve_client_id_from_cmd(
        self,
        cmd: Cmd,
        cmd_data: Dict[str, Any],
    ) -> str:
        """Resolve client_id from command properties and payload."""
        try:
            from_property = cmd.get_property_string("client_id")
            if isinstance(from_property, str) and from_property.strip():
                return from_property.strip()
        except Exception:
            pass

        from_payload = self._extract_client_id(cmd_data)
        if from_payload:
            return from_payload

        return DEFAULT_CLIENT_ID

    def _extract_client_id(self, payload: Any) -> Optional[str]:
        """Extract client_id from payload and nested metadata."""
        if not isinstance(payload, dict):
            return None

        raw = payload.get("client_id")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()

        metadata = payload.get("metadata")
        if isinstance(metadata, dict):
            nested = metadata.get("client_id")
            if isinstance(nested, str) and nested.strip():
                return nested.strip()

        return None

    def _read_float(self, value: Any) -> Optional[float]:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None

        return max(0.0, min(1.0, parsed))

    def _normalize_confusion_pattern(
        self,
        payload: Dict[str, Any],
    ) -> Optional[ConfusionPattern]:
        raw_sources = payload.get("source_phonemes", [])
        if not isinstance(raw_sources, list):
            return None

        source_phonemes: list[str] = []
        for item in raw_sources:
            if not isinstance(item, str):
                continue
            normalized = item.strip()
            if normalized and normalized not in source_phonemes:
                source_phonemes.append(normalized)

        target_phoneme = str(payload.get("target_phoneme", "") or "").strip()
        if not source_phonemes or not target_phoneme:
            return None

        confidence = self._read_float(payload.get("confidence"))
        if confidence is None:
            confidence = 0.0

        examples: list[str] = []
        if isinstance(payload.get("examples"), list):
            for item in payload["examples"]:
                if not isinstance(item, str):
                    continue
                normalized = item.strip()
                if normalized and normalized not in examples:
                    examples.append(normalized)

        try:
            correction_count = max(1, int(payload.get("correction_count", 1)))
        except (TypeError, ValueError):
            correction_count = 1

        last_updated = payload.get("last_updated")
        if isinstance(last_updated, str):
            try:
                last_updated_value = datetime.fromisoformat(last_updated)
            except ValueError:
                last_updated_value = datetime.now()
        else:
            last_updated_value = datetime.now()

        digest = hashlib.md5(
            f"{'/'.join(source_phonemes)}->{target_phoneme}".encode("utf-8")
        ).hexdigest()[:12]

        return ConfusionPattern(
            pattern_id=str(payload.get("pattern_id", "") or digest),
            source_phonemes=source_phonemes,
            target_phoneme=target_phoneme,
            confidence=confidence,
            examples=examples[:6],
            correction_count=correction_count,
            last_updated=last_updated_value,
        )

    def _merge_confusion_patterns(
        self,
        profile: VoiceProfile,
        payloads: list[Any],
    ) -> int:
        existing = {
            (tuple(pattern.source_phonemes), pattern.target_phoneme): pattern
            for pattern in profile.confusion_patterns
        }
        merged = 0

        for item in payloads:
            if not isinstance(item, dict):
                continue

            normalized = self._normalize_confusion_pattern(item)
            if not normalized:
                continue

            key = (tuple(normalized.source_phonemes), normalized.target_phoneme)
            current = existing.get(key)
            if current:
                total_count = max(1, current.correction_count) + max(1, normalized.correction_count)
                weighted_confidence = (
                    current.confidence * max(1, current.correction_count)
                    + normalized.confidence * max(1, normalized.correction_count)
                ) / total_count
                current.confidence = min(1.0, weighted_confidence)
                current.correction_count = total_count
                current.examples = list(dict.fromkeys((current.examples + normalized.examples)))[:6]
                current.last_updated = datetime.now()
            else:
                profile.confusion_patterns.append(normalized)
                existing[key] = normalized
            merged += 1

        return merged

    def _load_json_from_cmd(self, cmd: Cmd) -> dict:
        """Best-effort command payload parser."""
        try:
            cmd_json, _ = cmd.get_property_to_json(None)
            return json.loads(cmd_json) if cmd_json else {}
        except Exception:
            return {}

    def _load_json_from_data(self, data: Data) -> dict:
        """Best-effort data payload parser."""
        try:
            data_json, _ = data.get_property_to_json(None)
            return json.loads(data_json) if data_json else {}
        except Exception:
            return {}
