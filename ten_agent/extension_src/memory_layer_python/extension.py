#
# Memory Layer Extension
# Main extension implementation for TEN Framework
#

import asyncio
import json
import time
from typing import Optional, Dict, Any, List

from ten_runtime import (
    AsyncExtension,
    AsyncTenEnv,
    Cmd,
    CmdResult,
    Data,
    StatusCode,
)

from .config import MemoryLayerConfig
from .stores.base import ConversationTurn, VoiceProfile
from .stores.local_store import LocalStore


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

        # Storage backend
        self.store: Optional[LocalStore] = None

        # Session state
        self.user_id: str = ""
        self.agent_id: str = "voxflame_voice_assistant"
        self.session_turns: List[ConversationTurn] = []
        self.pending_corrections: List[Dict[str, Any]] = []

        # Learning state
        self.correction_counts: Dict[str, int] = {}  # word -> count

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """Initialize the extension."""
        self.ten_env = ten_env
        ten_env.log_info("[MemoryLayer] Initializing...")

        try:
            # Load configuration
            config_json, _ = await ten_env.get_property_to_json(None)
            self.config = MemoryLayerConfig.model_validate_json(config_json)
            ten_env.log_info(f"[MemoryLayer] Config loaded: backend={self.config.storage_backend}")
        except Exception as e:
            ten_env.log_warn(f"[MemoryLayer] Failed to load config, using defaults: {e}")
            self.config = MemoryLayerConfig()

    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """Called when extension starts."""
        ten_env.log_info("[MemoryLayer] Started")

        # Initialize storage backend
        await self._init_store()

    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """Called when extension stops."""
        ten_env.log_info("[MemoryLayer] Stopping...")
        self.stopped = True

        # Flush pending data
        await self._flush_session()

        # Close store
        if self.store:
            await self.store.close()

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """Cleanup resources."""
        ten_env.log_info("[MemoryLayer] Deinitialized")

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Handle incoming commands."""
        cmd_name = cmd.get_name()
        ten_env.log_info(f"[MemoryLayer] Received cmd: {cmd_name}")

        try:
            if cmd_name == "init_memory":
                await self._handle_init_memory(ten_env, cmd)
            elif cmd_name == "save_conversation":
                await self._handle_save_conversation(ten_env, cmd)
            elif cmd_name == "search_memory":
                await self._handle_search_memory(ten_env, cmd)
            elif cmd_name == "get_voice_profile":
                await self._handle_get_voice_profile(ten_env, cmd)
            elif cmd_name == "update_voice_profile":
                await self._handle_update_voice_profile(ten_env, cmd)
            elif cmd_name == "flush":
                await self._handle_flush(ten_env, cmd)
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

    async def _handle_init_memory(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Initialize memory for a user session."""
        try:
            # Get user info from command
            cmd_json, _ = cmd.get_property_to_json(None)
            cmd_data = json.loads(cmd_json) if cmd_json else {}

            self.user_id = cmd_data.get("user_id", "")
            self.agent_id = cmd_data.get("agent_id", self.agent_id)

            if not self.user_id:
                ten_env.log_warn("[MemoryLayer] No user_id provided, using anonymous")
                self.user_id = "anonymous"

            # Initialize store for this user
            if self.store:
                await self.store.initialize(self.user_id, self.agent_id)
                ten_env.log_info(f"[MemoryLayer] Memory initialized for user: {self.user_id}")

                # Get voice profile and broadcast
                profile = await self.store.get_voice_profile()
                await self._broadcast_voice_profile(ten_env, profile)

            await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error initializing memory: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_save_conversation(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Save a conversation turn to memory."""
        try:
            cmd_json, _ = cmd.get_property_to_json(None)
            turn_data = json.loads(cmd_json) if cmd_json else {}

            turn = ConversationTurn(
                role=turn_data.get("role", "user"),
                content=turn_data.get("content", ""),
                raw_asr=turn_data.get("raw_asr", ""),
                corrected_text=turn_data.get("corrected_text", ""),
                clarity_score=turn_data.get("clarity_score", 0.0)
            )

            self.session_turns.append(turn)

            # Persist to store
            if self.store:
                await self.store.add_conversation([turn])

            ten_env.log_info(f"[MemoryLayer] Saved conversation turn: {turn.role}")

            await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error saving conversation: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_search_memory(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Search memory for relevant context."""
        try:
            cmd_json, _ = cmd.get_property_to_json(None)
            search_data = json.loads(cmd_json) if cmd_json else {}

            query = search_data.get("query", "")
            limit = search_data.get("limit", 10)

            results = []
            if self.store:
                results = await self.store.search(query, limit)

            # Return results
            result = CmdResult.create(StatusCode.OK, cmd)
            result.set_property_from_json(None, json.dumps({"results": results}))
            await ten_env.return_result(result)

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error searching memory: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_get_voice_profile(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Get user voice profile."""
        try:
            profile = None
            if self.store:
                profile = await self.store.get_voice_profile()

            result = CmdResult.create(StatusCode.OK, cmd)
            if profile:
                result.set_property_from_json(None, json.dumps(profile.to_dict()))
            await ten_env.return_result(result)

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error getting voice profile: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_update_voice_profile(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Update voice profile with new data."""
        try:
            cmd_json, _ = cmd.get_property_to_json(None)
            update_data = json.loads(cmd_json) if cmd_json else {}

            if self.store:
                profile = await self.store.get_voice_profile()

                # Update fields
                if "hotwords" in update_data:
                    for hw in update_data["hotwords"]:
                        await self.store.add_hotword(hw["word"], hw.get("category", "custom"))

                if "preferences" in update_data:
                    profile.preferences.update(update_data["preferences"])

                await self.store.update_voice_profile(profile)

            await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error updating voice profile: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def _handle_flush(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Flush pending data to storage."""
        await self._flush_session()
        await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

    # ========================================
    # Data Handlers
    # ========================================

    async def _handle_correction_event(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle correction event for learning."""
        try:
            data_json, _ = data.get_property_to_json(None)
            correction = json.loads(data_json) if data_json else {}

            raw_text = correction.get("raw_text", "")
            corrected_text = correction.get("corrected_text", "")

            if not raw_text or not corrected_text or raw_text == corrected_text:
                return

            ten_env.log_info(f"[MemoryLayer] Correction: '{raw_text}' -> '{corrected_text}'")

            # Record correction
            if self.store:
                await self.store.record_correction(raw_text, corrected_text)

            # Track for potential hotword learning
            key = corrected_text.lower()
            self.correction_counts[key] = self.correction_counts.get(key, 0) + 1

            # Auto-learn hotword if threshold reached
            if self.correction_counts[key] >= self.config.learning.auto_hotword_threshold:
                ten_env.log_info(f"[MemoryLayer] Auto-learning hotword: {corrected_text}")
                if self.store:
                    await self.store.add_hotword(corrected_text, "auto_learned")
                    # Reset count
                    self.correction_counts[key] = 0

                    # Broadcast updated profile
                    profile = await self.store.get_voice_profile()
                    await self._broadcast_voice_profile(ten_env, profile)

            # Broadcast clarity score update
            if self.store:
                score = await self.store.get_clarity_score()
                await self._broadcast_clarity_score(ten_env, score)

        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error handling correction: {e}")

    async def _handle_session_start(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle session start event."""
        ten_env.log_info("[MemoryLayer] Session started")
        self.session_turns = []
        self.pending_corrections = []

    async def _handle_session_end(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle session end event."""
        ten_env.log_info("[MemoryLayer] Session ended")

        # Learn from this session's corrections
        if self.store:
            await self.store.learn_from_corrections(
                threshold=self.config.learning.confusion_pattern_threshold
            )

        # Flush all pending data
        await self._flush_session()

    # ========================================
    # Helper Methods
    # ========================================

    async def _init_store(self) -> None:
        """Initialize storage backend."""
        try:
            if self.config.storage_backend == "local":
                self.store = LocalStore(
                    base_path=self.config.local_base_path,
                    db_name=self.config.local_sqlite_db
                )
                self.ten_env.log_info(f"[MemoryLayer] LocalStore initialized at {self.config.local_base_path}")
            else:
                # Default to local store
                self.store = LocalStore()
                self.ten_env.log_info("[MemoryLayer] Using default LocalStore")

        except Exception as e:
            self.ten_env.log_error(f"[MemoryLayer] Failed to initialize store: {e}")
            self.store = None

    async def _flush_session(self) -> None:
        """Flush pending session data."""
        if self.session_turns and self.store:
            await self.store.add_conversation(self.session_turns)
            self.ten_env.log_info(f"[MemoryLayer] Flushed {len(self.session_turns)} turns")

        self.session_turns = []
        self.pending_corrections = []

    async def _broadcast_voice_profile(self, ten_env: AsyncTenEnv, profile: VoiceProfile) -> None:
        """Broadcast voice profile for ASR enhancement."""
        try:
            data = Data.create("voice_profile")
            data.set_property_from_json(None, json.dumps({
                "hotwords": profile.get_hotwords_for_asr(),
                "confusion_rules": profile.get_confusion_rules(),
                "speech_rate": profile.speech_rate,
                "dysarthria_type": profile.dysarthria_type
            }))
            # Note: In TEN, we need to send via proper channel
            # This would be configured in property.json connections
            ten_env.log_info(f"[MemoryLayer] Voice profile updated: {len(profile.hotwords)} hotwords")
        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error broadcasting profile: {e}")

    async def _broadcast_clarity_score(self, ten_env: AsyncTenEnv, score: float) -> None:
        """Broadcast clarity score update."""
        try:
            data = Data.create("clarity_score")
            data.set_property_from_json(None, json.dumps({
                "score": score,
                "timestamp": int(time.time() * 1000)
            }))
            ten_env.log_debug(f"[MemoryLayer] Clarity score: {score:.2f}")
        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error broadcasting score: {e}")

    async def _broadcast_memory_context(self, ten_env: AsyncTenEnv, context: str) -> None:
        """Broadcast memory context for LLM."""
        try:
            data = Data.create("memory_context")
            data.set_property_from_json(None, json.dumps({
                "context": context,
                "timestamp": int(time.time() * 1000)
            }))
        except Exception as e:
            ten_env.log_error(f"[MemoryLayer] Error broadcasting context: {e}")
