#
# VoxFlame Main Control Extension
# Central coordinator for voice assistant with speech correction
#

import base64
import time
import json
import uuid
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List

from ten_runtime import (
    AsyncExtension,
    AsyncTenEnv,
    Cmd,
    CmdResult,
    Data,
    StatusCode,
)

from .config import VoxFlameMainConfig
from .helper import send_cmd, send_data, send_rtm_publish


DEFAULT_CLIENT_ID = "default"
AGORA_TRANSPORT_EVENTS = {
    "on_connected",
    "on_connection_failure",
    "on_connection_error",
    "on_token_expired",
    "on_token_will_expire",
    "on_first_remote_video_frame",
    "on_first_remote_video_decoded",
    "on_first_remote_audio_frame",
    "on_first_remote_audio_decoded",
    "on_datastream_error",
    "on_subscribed_remote_users_changed",
    "onVideoPublishStateChanged",
    "onAudioPublishStateChanged",
    "onAudioSubscribeStateChanged",
    "onVideoSubscribeStateChanged",
    "on_user_audio_track_state_changed",
    "on_user_track_state_unsubscribed",
    "on_user_info_updated",
    "on_user_state_changed",
}


@dataclass
class SessionContext:
    """Per-client conversation state."""

    client_id: str
    is_tts_playing: bool = False
    current_tts_request_id: Optional[str] = None
    last_user_speech_time: int = 0
    user_connected: bool = False
    conversation_history: List[Dict[str, Any]] = field(default_factory=list)
    user_profile: Optional[Dict[str, Any]] = None
    last_asr_text: str = ""
    transport_state: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    runtime_metrics: Dict[str, Dict[str, Any]] = field(default_factory=dict)


class VoxFlameMainExtension(AsyncExtension):
    """
    VoxFlame Main Control Extension

    Responsibilities:
    1. Coordinate data flow between ASR -> Corrector -> TTS
    2. Handle user speech interruption (flush TTS when user speaks)
    3. Fan out transcripts through the configured realtime transport
    4. Manage conversation state and history
    5. Send correction events to memory layer for learning
    """

    def __init__(self, name: str):
        super().__init__(name)
        self.ten_env: AsyncTenEnv = None
        self.config: VoxFlameMainConfig = None
        self.stopped: bool = False

        # Per-client session contexts.
        self.sessions: Dict[str, SessionContext] = {}
        self.default_client_id: str = DEFAULT_CLIENT_ID

        # request_id -> client_id mapping for TTS state reconciliation.
        self.tts_request_to_client: Dict[str, str] = {}

        self.max_history_length: int = 10

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """Initialize the extension."""
        self.ten_env = ten_env
        ten_env.log_info("[VoxFlameMain] Initializing...")

        try:
            config_json, _ = await ten_env.get_property_to_json(None)
            self.config = VoxFlameMainConfig.model_validate_json(config_json)
            ten_env.log_info(
                "[VoxFlameMain] Config loaded: "
                f"greeting={self.config.greeting}, "
                f"enable_interrupt={self.config.enable_interrupt}, "
                f"enable_memory={getattr(self.config, 'enable_memory', False)}"
            )
        except Exception as e:
            ten_env.log_warn(f"[VoxFlameMain] Failed to load config, using defaults: {e}")
            self.config = VoxFlameMainConfig()

    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """Called when extension starts."""
        ten_env.log_info("[VoxFlameMain] Started")

    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """Called when extension stops."""
        ten_env.log_info("[VoxFlameMain] Stopping...")
        self.stopped = True
        self.sessions.clear()
        self.tts_request_to_client.clear()

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """Cleanup resources."""
        ten_env.log_info("[VoxFlameMain] Deinitialized")

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """
        Handle incoming commands.

        Supported commands:
        - on_user_connected / on_user_joined: User connected to the active transport
        - on_user_disconnected / on_user_left: User disconnected
        - system_init: User context from backend proxy
        - user_input: Text input from frontend for direct playback
        - training_result: Structured training feedback from /contribute
        - speech_activity: Client-side speech activity notification for early barge-in
        - start_of_sentence: Server-side VAD speech-start event
        - end_of_sentence: Server-side VAD speech-end event
        - end_audio: Explicit end-of-utterance signal to flush ASR tail latency
        - flush: Interrupt current TTS playback
        """
        cmd_name = cmd.get_name()
        client_id_raw = self._read_client_id_from_cmd(cmd)
        client_id = self._normalize_client_id(client_id_raw)

        ten_env.log_info(f"[VoxFlameMain] Received cmd: {cmd_name}, client_id={client_id}")

        try:
            if cmd_name in ("on_user_connected", "on_user_joined"):
                await self._handle_user_connected(
                    ten_env,
                    client_id,
                    self._read_cmd_payload(cmd),
                )
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name in ("on_user_disconnected", "on_user_left"):
                await self._handle_user_disconnected(ten_env, client_id)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "system_init":
                await self._handle_system_init_cmd(ten_env, cmd, client_id)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "user_input":
                await self._handle_user_input_cmd(ten_env, cmd, client_id)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "training_result":
                await self._handle_training_result_cmd(ten_env, cmd, client_id)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "speech_activity":
                await self._handle_speech_activity_cmd(ten_env, cmd, client_id)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "start_of_sentence":
                await self._handle_server_vad_start_cmd(ten_env, client_id)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "end_of_sentence":
                await self._handle_server_vad_end_cmd(ten_env, client_id)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "end_audio":
                await self._handle_end_audio_cmd(ten_env, cmd, client_id)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "flush":
                # If client_id is missing, flush globally.
                if client_id_raw:
                    await self._handle_flush(ten_env, client_id)
                else:
                    await self._handle_flush_all(ten_env)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name in AGORA_TRANSPORT_EVENTS:
                await self._handle_transport_event_cmd(ten_env, cmd_name, cmd)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            else:
                ten_env.log_warn(f"[VoxFlameMain] Unknown cmd: {cmd_name}")
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling cmd {cmd_name}: {e}")
            await ten_env.return_result(CmdResult.create(StatusCode.ERROR, cmd))

    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """
        Handle incoming data.

        Data flow:
        1. asr_result from STT -> Check for interrupt -> Forward to corrector
        2. corrected_text from corrector -> Forward to TTS and transcript transport
        3. tts_audio_start/end -> Track TTS state for interruption
        """
        data_name = data.get_name()

        try:
            if data_name == "asr_result":
                await self._handle_asr_result(ten_env, data)

            elif data_name == "corrected_text":
                await self._handle_corrected_text(ten_env, data)

            elif data_name == "interim_text":
                await self._handle_interim_text(ten_env, data)

            elif data_name == "tts_audio_start":
                await self._handle_tts_start(ten_env, data)

            elif data_name == "tts_audio_end":
                await self._handle_tts_end(ten_env, data)

            elif data_name == "speech_activity":
                await self._handle_speech_activity_data(ten_env, data)

            elif data_name == "training_feedback_result":
                await self._handle_training_feedback_result(ten_env, data)

            elif data_name == "client_connection":
                await self._handle_client_connection_data(ten_env, data)

            elif data_name == "metrics":
                await self._handle_runtime_metrics(ten_env, data)

            elif data_name == "error":
                await self._handle_module_error(ten_env, data)

            elif data_name == "system_init":
                # Backward compatibility: some runtimes may still deliver this as Data.
                await self._handle_system_init_data(ten_env, data)

            elif data_name == "data":
                await self._handle_transport_data(ten_env, data)

            elif data_name == "rtm_message_event":
                await self._handle_transport_data(ten_env, data)

            else:
                ten_env.log_debug(f"[VoxFlameMain] Unhandled data: {data_name}")

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling data {data_name}: {e}")

    # ========================================
    # Command Handlers
    # ========================================

    async def _handle_user_connected(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Handle user connection."""
        payload = payload or {}
        suppress_greeting = bool(payload.get("suppress_greeting"))
        if client_id == DEFAULT_CLIENT_ID and not self._payload_has_session_reference(payload):
            ten_env.log_info(
                "[VoxFlameMain] Deferring unbound transport connect until a "
                "session-scoped payload arrives"
            )
            return

        await self._ensure_session_connected(
            ten_env,
            client_id,
            suppress_greeting=suppress_greeting,
        )

    async def _ensure_session_connected(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        *,
        suppress_greeting: bool,
    ) -> SessionContext:
        """Create/bind a session exactly once before realtime work starts."""
        session = self._get_or_create_session(client_id)
        if session.user_connected:
            return session

        session.user_connected = True
        session.conversation_history = []
        session.last_asr_text = ""
        session.is_tts_playing = False
        session.current_tts_request_id = None

        ten_env.log_info(
            f"[VoxFlameMain] User connected, client_id={client_id}, "
            f"suppress_greeting={suppress_greeting}"
        )

        # Send greeting if enabled
        if suppress_greeting:
            ten_env.log_info(
                f"[VoxFlameMain] Skipping greeting for client_id={client_id}"
            )
        elif self.config.enable_greeting and self.config.greeting:
            ten_env.log_info(
                f"[VoxFlameMain] Sending greeting to {client_id}: {self.config.greeting}"
            )
            await self._send_text_to_tts(ten_env, self.config.greeting, client_id)
            await self._send_transcript_event(
                ten_env,
                role="assistant",
                text=self.config.greeting,
                client_id=client_id,
                is_final=True,
            )

        if getattr(self.config, "enable_memory", False):
            await self._send_session_event(ten_env, "session_start", client_id)

        return session

    async def _handle_user_disconnected(self, ten_env: AsyncTenEnv, client_id: str) -> None:
        """Handle user disconnection."""
        session = self.sessions.get(client_id)
        if not session:
            ten_env.log_warn(
                f"[VoxFlameMain] Disconnection received for unknown client_id={client_id}"
            )
            return

        ten_env.log_info(f"[VoxFlameMain] User disconnected, client_id={client_id}")
        session.user_connected = False

        if getattr(self.config, "enable_memory", False):
            await self._send_session_event(ten_env, "session_end", client_id)

        # Try to flush on disconnect to stop stale playback for this session.
        if session.is_tts_playing:
            await self._flush_tts(ten_env, client_id)

        # Clean request mapping for this client.
        stale_request_ids = [
            req_id
            for req_id, req_client_id in self.tts_request_to_client.items()
            if req_client_id == client_id
        ]
        for req_id in stale_request_ids:
            self.tts_request_to_client.pop(req_id, None)

        self.sessions.pop(client_id, None)

    async def _handle_system_init_cmd(
        self, ten_env: AsyncTenEnv, cmd: Cmd, client_id: str
    ) -> None:
        """Handle system init delivered as command."""
        payload = self._read_cmd_payload(cmd)

        await self._handle_system_init_payload(ten_env, payload, client_id)

    async def _handle_user_input_cmd(
        self, ten_env: AsyncTenEnv, cmd: Cmd, client_id: str
    ) -> None:
        """Handle typed user input from the frontend for direct relay / playback."""
        payload = self._read_cmd_payload(cmd)
        await self._handle_user_input_payload(ten_env, payload, client_id)

    async def _handle_user_input_payload(
        self,
        ten_env: AsyncTenEnv,
        payload: Dict[str, Any],
        client_id: str,
    ) -> None:
        """Handle typed user input from any realtime transport."""
        text = str(payload.get("text", "") or "").strip()

        if not text:
            ten_env.log_warn(
                f"[VoxFlameMain] user_input without text, client_id={client_id}"
            )
            return

        session = await self._ensure_session_connected(
            ten_env,
            client_id,
            suppress_greeting=True,
        )
        session.last_user_speech_time = int(time.time() * 1000)

        if self.config.enable_interrupt and (
            session.is_tts_playing or session.current_tts_request_id is not None
        ):
            ten_env.log_info(
                f"[VoxFlameMain] Interrupting pending TTS due to typed user input, client_id={client_id}"
            )
            await self._flush_tts(ten_env, client_id)

        session.conversation_history.append(
            {
                "role": "user",
                "content": text,
                "timestamp": session.last_user_speech_time,
                "source": "typed_text",
            }
        )
        self._trim_history(session)

        if getattr(self.config, "enable_memory", False):
            await self._save_conversation_turn(
                ten_env,
                role="user",
                content=text,
                client_id=client_id,
                raw_asr=text,
            )

        await self._send_text_to_tts(ten_env, text, client_id)
        await self._send_transcript_event(
            ten_env,
            role="assistant",
            text=text,
            client_id=client_id,
            is_final=True,
            metadata={
                "type": "relay",
                "source": "user_input",
            },
        )

    async def _handle_flush(self, ten_env: AsyncTenEnv, client_id: str) -> None:
        """Handle per-client flush command - interrupt TTS."""
        ten_env.log_info(f"[VoxFlameMain] Flush command received, client_id={client_id}")
        await self._flush_tts(ten_env, client_id)

    async def _handle_flush_all(self, ten_env: AsyncTenEnv) -> None:
        """Handle global flush when no client_id is provided."""
        ten_env.log_info("[VoxFlameMain] Global flush command received")
        try:
            await send_cmd(ten_env, "flush", "tts")
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error sending global flush to TTS: {e}")

        for session in self.sessions.values():
            session.is_tts_playing = False
            session.current_tts_request_id = None
        self.tts_request_to_client.clear()

    async def _handle_training_result_cmd(
        self, ten_env: AsyncTenEnv, cmd: Cmd, client_id: str
    ) -> None:
        """Persist one training result into memory and hotword profile."""
        payload = self._read_cmd_payload(cmd)
        await self._handle_training_result_payload(ten_env, payload, client_id)

    async def _handle_training_result_payload(
        self,
        ten_env: AsyncTenEnv,
        payload: Dict[str, Any],
        client_id: str,
    ) -> None:
        """Persist one training result into memory and hotword profile."""
        target_text = str(payload.get("exercise_text", "") or "").strip()

        if not target_text:
            ten_env.log_warn(
                f"[VoxFlameMain] training_result without exercise_text, client_id={client_id}"
            )
            return

        recognized_text = str(payload.get("recognized_text", "") or "").strip()
        status = str(payload.get("feedback_status", "unclear") or "unclear").strip()
        category = str(payload.get("exercise_category", "") or "").strip()
        focus_tags = [
            str(tag).strip()
            for tag in payload.get("focus_tags", [])
            if isinstance(tag, str) and str(tag).strip()
        ]
        keywords = [
            str(keyword).strip()
            for keyword in payload.get("keywords", [])
            if isinstance(keyword, str) and str(keyword).strip()
        ]
        initial_pairs = [
            str(item).strip()
            for item in payload.get("pronunciation_initial_pairs", [])
            if isinstance(item, str) and str(item).strip()
        ]
        final_pairs = [
            str(item).strip()
            for item in payload.get("pronunciation_final_pairs", [])
            if isinstance(item, str) and str(item).strip()
        ]
        tone_pairs = [
            str(item).strip()
            for item in payload.get("pronunciation_tone_pairs", [])
            if isinstance(item, str) and str(item).strip()
        ]
        pronunciation_targets = [
            str(item).strip()
            for item in payload.get("pronunciation_targets", [])
            if isinstance(item, str) and str(item).strip()
        ]
        pronunciation_summary = str(payload.get("pronunciation_summary", "") or "").strip()
        exercise_id = str(payload.get("exercise_id", "") or "").strip()

        summary = self._build_training_result_summary(
            target_text=target_text,
            recognized_text=recognized_text,
            status=status,
            category=category,
            focus_tags=focus_tags,
        )
        clarity_score = self._read_training_clarity(payload, status)
        confusion_patterns = self._build_training_confusion_patterns(
            initial_pairs=initial_pairs,
            final_pairs=final_pairs,
            tone_pairs=tone_pairs,
            target_text=target_text,
            recognized_text=recognized_text,
            status=status,
        )

        ten_env.log_info(
            f"[VoxFlameMain] Received training_result, client_id={client_id}, "
            f"status={status}, category={category}, keywords={keywords[:3]}, "
            f"confusions={len(confusion_patterns)}"
        )

        memory_enabled = bool(getattr(self.config, "enable_memory", False))
        persisted = False
        persistence_error: Optional[str] = None
        profile_update_requested = bool(
            keywords or confusion_patterns or pronunciation_summary
        )
        profile_update_applied = False
        profile_update_error: Optional[str] = None

        if memory_enabled:
            try:
                await self._save_conversation_turn(
                    ten_env,
                    role="assistant",
                    content=summary,
                    client_id=client_id,
                    raw_asr=recognized_text,
                    corrected_text=target_text,
                    clarity_score=clarity_score,
                )
                persisted = True
            except Exception as e:
                persistence_error = str(e)
                ten_env.log_error(
                    f"[VoxFlameMain] Error saving training_result turn, client_id={client_id}: {e}"
                )

        hotword_category = self._map_training_category_to_hotword(category)
        if memory_enabled and profile_update_requested:
            try:
                await send_cmd(
                    ten_env,
                    "update_voice_profile",
                    "memory_layer",
                    {
                        "client_id": client_id,
                        "hotwords": [
                            {"word": keyword, "category": hotword_category}
                            for keyword in keywords[:3]
                        ],
                        "confusion_patterns": confusion_patterns,
                        "clarity_score": clarity_score,
                        "preferences": {
                            "last_training_category": category or "中文训练",
                            "last_pronunciation_summary": pronunciation_summary,
                            "last_pronunciation_targets": " / ".join(pronunciation_targets[:4]),
                        },
                    },
                )
                profile_update_applied = True
                ten_env.log_info(
                    f"[VoxFlameMain] Updated voice profile from training_result, client_id={client_id}"
                )
            except Exception as e:
                profile_update_error = str(e)
                ten_env.log_error(
                    f"[VoxFlameMain] Error updating voice profile from training_result: {e}"
                )

        await self._send_transport_event(
            ten_env,
            event_type="training_feedback",
            client_id=client_id,
            payload={
                "exercise_id": exercise_id,
                "exercise_text": target_text,
                "recognized_text": recognized_text,
                "feedback_status": status,
                "exercise_category": category,
                "clarity_score": clarity_score,
                "summary": summary,
                "focus_tags": focus_tags[:6],
                "keywords": keywords[:6],
                "pronunciation_summary": pronunciation_summary,
                "confusion_patterns_count": len(confusion_patterns),
                "persisted": persisted,
                "memory_enabled": memory_enabled,
                "voice_profile_update_requested": profile_update_requested,
                "voice_profile_updated": profile_update_applied,
                "error": persistence_error,
            },
            metadata={
                "source": "training_result",
                "voice_profile_error": profile_update_error,
            },
        )

        if profile_update_applied:
            await self._send_transport_event(
                ten_env,
                event_type="voice_profile_updated",
                client_id=client_id,
                payload={
                    "source": "training_result",
                    "exercise_id": exercise_id,
                    "exercise_category": category,
                    "hotword_count": min(len(keywords), 3),
                    "confusion_patterns_count": len(confusion_patterns),
                    "clarity_score": clarity_score,
                    "last_training_category": category or "中文训练",
                },
            )

    async def _handle_speech_activity_cmd(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
    ) -> None:
        """Handle frontend VAD events for earlier interruption and ASR finalize."""
        payload = self._read_cmd_payload(cmd)
        await self._handle_speech_activity_payload(ten_env, client_id, payload)

    async def _handle_speech_activity_data(
        self,
        ten_env: AsyncTenEnv,
        data: Data,
    ) -> None:
        """Handle speech activity as data for transport-safe client routing."""
        try:
            data_json, _ = data.get_property_to_json(None)
            payload = json.loads(data_json) if data_json else {}
        except Exception:
            payload = {}

        client_id = self._extract_client_id(payload, ten_env, "speech_activity")
        await self._handle_speech_activity_payload(ten_env, client_id, payload)

    async def _handle_speech_activity_payload(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        payload: Dict[str, Any],
    ) -> None:
        """Shared speech-activity handling for cmd and data transport."""
        state = str(payload.get("state", "") or "").strip().lower()
        if not state:
            ten_env.log_warn(
                f"[VoxFlameMain] speech_activity without state, client_id={client_id}"
            )
            return

        session = self._get_or_create_session(client_id)
        session.last_user_speech_time = int(time.time() * 1000)

        ten_env.log_info(
            f"[VoxFlameMain] speech_activity state={state}, client_id={client_id}"
        )

        if state == "speech_started":
            if self.config.enable_interrupt and (
                session.is_tts_playing or session.current_tts_request_id is not None
            ):
                await self._flush_tts(ten_env, client_id)
            return

        if state == "speech_stopped" and bool(payload.get("auto_finalize", False)):
            await self._finalize_asr_turn(ten_env, client_id, "vad")

    async def _handle_training_feedback_result(
        self,
        ten_env: AsyncTenEnv,
        data: Data,
    ) -> None:
        try:
            data_json, _ = data.get_property_to_json(None)
            payload = json.loads(data_json) if data_json else {}
            if not isinstance(payload, dict):
                return

            client_id = self._extract_client_id(
                payload,
                ten_env,
                "training_feedback_result",
            )
            await self._send_transport_event(
                ten_env,
                event_type="training_feedback",
                client_id=client_id,
                payload=payload,
            )
        except Exception as e:
            ten_env.log_error(
                f"[VoxFlameMain] Error handling training feedback result: {e}"
            )

    async def _handle_end_audio_cmd(
        self,
        ten_env: AsyncTenEnv,
        cmd: Cmd,
        client_id: str,
    ) -> None:
        """Force the ASR extension to finalize the current utterance."""
        payload = self._read_cmd_payload(cmd)
        reason = str(payload.get("reason", "manual") or "manual").strip() or "manual"
        await self._finalize_asr_turn(ten_env, client_id, reason)

    async def _handle_transport_event_cmd(
        self,
        ten_env: AsyncTenEnv,
        event_name: str,
        cmd: Cmd,
    ) -> None:
        """Track RTC transport lifecycle emitted by agora_rtc."""
        payload = self._read_cmd_payload(cmd)
        client_id = self._extract_client_id(payload, ten_env, event_name)
        should_bind_session = self._payload_has_session_reference(payload) or client_id in self.sessions

        if should_bind_session:
            session = self._get_or_create_session(client_id)
            session.transport_state[event_name] = {
                "timestamp": int(time.time() * 1000),
                "payload": payload,
            }

        log_line = (
            f"[VoxFlameMain] RTC transport event {event_name}, "
            f"client_id={client_id if should_bind_session else 'unbound'}"
        )
        if payload:
            log_line += f", payload={json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}"

        if event_name in {"on_connection_failure", "on_connection_error", "on_datastream_error"}:
            ten_env.log_warn(log_line)
        else:
            ten_env.log_info(log_line)

    # ========================================
    # Data Handlers
    # ========================================

    async def _handle_system_init_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Backward compatible system init when delivered as Data."""
        try:
            data_json, _ = data.get_property_to_json(None)
            payload = json.loads(data_json) if data_json else {}
        except Exception:
            payload = {}

        client_id = self._extract_client_id(payload, ten_env, "system_init")
        await self._handle_system_init_payload(ten_env, payload, client_id)

    async def _handle_client_connection_data(
        self,
        ten_env: AsyncTenEnv,
        data: Data,
    ) -> None:
        """Handle transport connect/disconnect as data to preserve client routing."""
        try:
            data_json, _ = data.get_property_to_json(None)
            payload = json.loads(data_json) if data_json else {}
        except Exception:
            payload = {}

        client_id = self._extract_client_id(payload, ten_env, "client_connection")
        state = str(payload.get("state", "") or "").strip().lower()

        if state == "connected":
            await self._handle_user_connected(ten_env, client_id, payload)
            return

        if state == "disconnected":
            await self._handle_user_disconnected(ten_env, client_id)
            return

        ten_env.log_warn(
            f"[VoxFlameMain] client_connection with unknown state='{state}', client_id={client_id}"
        )

    async def _handle_transport_data(
        self,
        ten_env: AsyncTenEnv,
        data: Data,
    ) -> None:
        """Handle transport data envelopes from agora_rtc/agora_rtm."""
        raw_payload = self._read_data_payload(data)
        transport_payload = self._extract_transport_payload(raw_payload)
        message_type = str(transport_payload.get("type", "") or "").strip().lower()

        if not message_type:
            ten_env.log_info(
                f"[VoxFlameMain] Ignoring transport data without type: "
                f"{json.dumps(raw_payload, ensure_ascii=False, separators=(',', ':'))}"
            )
            return

        client_id = self._extract_client_id(transport_payload, ten_env, message_type)

        if message_type == "system_init":
            await self._handle_system_init_payload(ten_env, transport_payload, client_id)
            return

        if message_type == "user_input":
            await self._handle_user_input_payload(ten_env, transport_payload, client_id)
            return

        if message_type == "training_result":
            await self._handle_training_result_payload(
                ten_env,
                transport_payload,
                client_id,
            )
            return

        if message_type == "training_feedback_request":
            await self._handle_training_feedback_request_payload(
                ten_env,
                transport_payload,
                client_id,
            )
            return

        if message_type == "update_voice_profile":
            await self._handle_update_voice_profile_payload(
                ten_env,
                transport_payload,
                client_id,
            )
            return

        if message_type == "end_audio":
            reason = (
                str(transport_payload.get("reason", "") or "").strip() or "transport"
            )
            await self._finalize_asr_turn(ten_env, client_id, reason)
            return

        if message_type == "flush":
            await self._flush_tts(ten_env, client_id)
            return

        ten_env.log_debug(
            f"[VoxFlameMain] Unhandled transport data type={message_type}, "
            f"payload={json.dumps(transport_payload, ensure_ascii=False, separators=(',', ':'))}"
        )

    async def _handle_update_voice_profile_payload(
        self,
        ten_env: AsyncTenEnv,
        payload: Dict[str, Any],
        client_id: str,
    ) -> None:
        """Forward updated voice profile payload to the memory layer."""
        forwarded_payload = dict(payload)
        forwarded_payload["client_id"] = client_id

        try:
            await send_cmd(
                ten_env,
                "update_voice_profile",
                "memory_layer",
                forwarded_payload,
            )
            ten_env.log_info(
                f"[VoxFlameMain] Forwarded voice profile update, client_id={client_id}"
            )
        except Exception as e:
            ten_env.log_warn(
                f"[VoxFlameMain] Failed to forward voice profile update, client_id={client_id}: {e}"
            )

    async def _handle_training_feedback_request_payload(
        self,
        ten_env: AsyncTenEnv,
        payload: Dict[str, Any],
        client_id: str,
    ) -> None:
        forwarded_payload = dict(payload)
        forwarded_payload["client_id"] = client_id

        try:
            await send_cmd(
                ten_env,
                "generate_training_feedback",
                "training_feedback",
                forwarded_payload,
            )
            ten_env.log_info(
                f"[VoxFlameMain] Forwarded training feedback request, client_id={client_id}"
            )
        except Exception as e:
            ten_env.log_warn(
                f"[VoxFlameMain] Failed to forward training feedback request, client_id={client_id}: {e}"
            )

    async def _handle_system_init_payload(
        self,
        ten_env: AsyncTenEnv,
        init_data: Dict[str, Any],
        client_id: str,
    ) -> None:
        """
        Handle system initialization with user context.
        Received from Backend Proxy upon connection.
        """
        session = await self._ensure_session_connected(
            ten_env,
            client_id,
            suppress_greeting=bool(init_data.get("suppress_greeting")),
        )

        user = init_data.get("user")
        if not isinstance(user, dict):
            ten_env.log_debug(
                f"[VoxFlameMain] system_init without user payload, client_id={client_id}"
            )
            return

        session.user_profile = user

        email = user.get("email", "unknown")
        name = user.get("name", "")
        user_id = user.get("id", "")

        ten_env.log_info(
            f"[VoxFlameMain] System Init - client_id={client_id}, user={email}"
        )
        if name:
            ten_env.log_info(f"[VoxFlameMain] User Name: {name}")
        if user_id:
            ten_env.log_info(f"[VoxFlameMain] User ID: {user_id}")

        # Update LLM Corrector with user profile.
        try:
            await send_cmd(
                ten_env,
                "update_profile",
                "corrector",
                {
                    "client_id": client_id,
                    "user_profile": user,
                },
            )
            ten_env.log_info(
                f"[VoxFlameMain] Sent user profile to corrector, client_id={client_id}"
            )
        except Exception as e:
            ten_env.log_warn(
                f"[VoxFlameMain] Failed to update corrector profile, client_id={client_id}: {e}"
            )

        # Initialize memory layer with user info.
        if getattr(self.config, "enable_memory", False):
            try:
                await send_cmd(
                    ten_env,
                    "init_memory",
                    "memory_layer",
                    {
                        "client_id": client_id,
                        "user_id": user_id,
                        "user_name": name,
                        "user_email": email,
                    },
                )
                ten_env.log_info(
                    f"[VoxFlameMain] Sent user info to Memory Layer, client_id={client_id}"
                )
            except Exception as e:
                ten_env.log_warn(
                    f"[VoxFlameMain] Failed to initialize memory layer, client_id={client_id}: {e}"
                )

    async def _handle_asr_result(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """
        Handle ASR result from STT extension.

        Key logic:
        1. If user is speaking and TTS is playing -> Interrupt TTS
        2. Forward ASR result to corrector for LLM correction
        3. Send interim results back over the active transport for real-time display
        """
        try:
            data_json, _ = data.get_property_to_json(None)
            asr_data = json.loads(data_json) if data_json else {}

            text = asr_data.get("text", "")
            is_final = asr_data.get("is_final", asr_data.get("final", False))

            if not text:
                return

            client_id = self._extract_client_id(asr_data, ten_env, "asr_result")
            session = self._get_or_create_session(client_id)
            if not session.user_connected:
                session = await self._ensure_session_connected(
                    ten_env,
                    client_id,
                    suppress_greeting=True,
                )

            ten_env.log_info(
                f"[VoxFlameMain] ASR result client_id={client_id}: '{text}' (final={is_final})"
            )

            # Update last speech time
            session.last_user_speech_time = int(time.time() * 1000)

            # Check if we should interrupt TTS
            if (
                self.config.enable_interrupt
                and session.is_tts_playing
                and self._should_interrupt_tts(text, is_final, asr_data)
            ):
                ten_env.log_info(
                    f"[VoxFlameMain] Interrupting TTS due to user speech, client_id={client_id}"
                )
                await self._flush_tts(ten_env, client_id)

            # Fan out interim/final text through the configured transcript transport.
            await self._send_transcript_event(
                ten_env,
                role="user",
                text=text,
                client_id=client_id,
                is_final=is_final,
            )

            if is_final and self.config.enable_correction:
                session.last_asr_text = text

                if getattr(self.config, "enable_memory", False):
                    await self._refresh_memory_context_for_query(
                        ten_env,
                        client_id=client_id,
                        query=text,
                    )

                ten_env.log_info(
                    f"[VoxFlameMain] Forwarding to corrector, client_id={client_id}: '{text}'"
                )
                await self._forward_to_corrector(ten_env, text, asr_data, client_id)

                session.conversation_history.append(
                    {
                        "role": "user",
                        "content": text,
                        "timestamp": session.last_user_speech_time,
                    }
                )
                self._trim_history(session)

                if getattr(self.config, "enable_memory", False):
                    await self._save_conversation_turn(
                        ten_env,
                        role="user",
                        content=text,
                        client_id=client_id,
                        raw_asr=text,
                    )

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling ASR result: {e}")

    async def _handle_corrected_text(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """
        Handle corrected text from LLM corrector.

        Forward to:
        1. TTS for speech synthesis
        2. Realtime transcript transport for frontend display
        3. Memory layer for learning (if correction occurred)
        """
        try:
            data_json, _ = data.get_property_to_json(None)
            corrected_data = json.loads(data_json) if data_json else {}

            original_text = corrected_data.get("original_text", "")
            corrected_text = corrected_data.get("corrected_text", "")

            if not corrected_text:
                return

            client_id = self._extract_client_id(
                corrected_data,
                ten_env,
                "corrected_text",
            )
            session = self._get_or_create_session(client_id)

            ten_env.log_info(
                f"[VoxFlameMain] Corrected client_id={client_id}: "
                f"'{original_text}' -> '{corrected_text}'"
            )

            await self._send_text_to_tts(ten_env, corrected_text, client_id)

            await self._send_transcript_event(
                ten_env,
                role="assistant",
                text=corrected_text,
                client_id=client_id,
                is_final=True,
                metadata={"original": original_text, "type": "correction"},
            )

            session.conversation_history.append(
                {
                    "role": "assistant",
                    "content": corrected_text,
                    "original": original_text,
                    "timestamp": int(time.time() * 1000),
                }
            )
            self._trim_history(session)

            if getattr(self.config, "enable_memory", False) and original_text != corrected_text:
                await self._send_correction_event(
                    ten_env,
                    raw_text=original_text,
                    corrected_text=corrected_text,
                    client_id=client_id,
                )

            if getattr(self.config, "enable_memory", False):
                clarity_raw = corrected_data.get("clarity_score", 0)
                try:
                    clarity_score = float(clarity_raw)
                except (TypeError, ValueError):
                    clarity_score = 0.0

                await self._save_conversation_turn(
                    ten_env,
                    role="assistant",
                    content=corrected_text,
                    client_id=client_id,
                    raw_asr=original_text,
                    corrected_text=corrected_text,
                    clarity_score=clarity_score,
                )

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling corrected text: {e}")

    async def _handle_interim_text(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle interim (non-final) ASR text for real-time display."""
        try:
            data_json, _ = data.get_property_to_json(None)
            interim_data = json.loads(data_json) if data_json else {}

            text = interim_data.get("text", "")
            if not text:
                return

            client_id = self._extract_client_id(interim_data, ten_env, "interim_text")
            await self._send_transcript_event(
                ten_env,
                role="user",
                text=text,
                client_id=client_id,
                is_final=False,
            )

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling interim text: {e}")

    async def _handle_tts_start(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle TTS playback start."""
        try:
            data_json, _ = data.get_property_to_json(None)
            tts_data = json.loads(data_json) if data_json else {}

            client_id = self._resolve_client_for_tts_event(tts_data)
            session = self._get_or_create_session(client_id)

            request_id = tts_data.get("request_id", "")
            if request_id:
                self.tts_request_to_client[request_id] = client_id

            session.is_tts_playing = True
            session.current_tts_request_id = request_id or session.current_tts_request_id
            ten_env.log_info(
                f"[VoxFlameMain] TTS started: request_id={request_id}, client_id={client_id}"
            )

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling TTS start: {e}")

    async def _handle_tts_end(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle TTS playback end."""
        try:
            data_json, _ = data.get_property_to_json(None)
            tts_data = json.loads(data_json) if data_json else {}

            client_id = self._resolve_client_for_tts_event(tts_data)
            session = self._get_or_create_session(client_id)

            request_id = tts_data.get("request_id", "")
            if request_id:
                self.tts_request_to_client.pop(request_id, None)

            session.is_tts_playing = False
            session.current_tts_request_id = None
            ten_env.log_info(
                f"[VoxFlameMain] TTS ended: request_id={request_id}, client_id={client_id}"
            )

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling TTS end: {e}")

    async def _handle_module_error(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle module-level runtime errors routed from upstream extensions."""
        try:
            data_json, _ = data.get_property_to_json(None)
            error_data = json.loads(data_json) if data_json else {}

            module_name = str(error_data.get("module", "unknown"))
            message = str(error_data.get("message", "unknown error"))
            code = error_data.get("code")
            metadata = error_data.get("metadata")
            payload = error_data if isinstance(error_data, dict) else {}

            client_id = self._extract_client_id(payload, ten_env, "error")
            ten_env.log_warn(
                f"[VoxFlameMain] Module error from {module_name}, "
                f"client_id={client_id}, code={code}, message={message}"
            )

            if self.config.transcript_transport != "none":
                await self._send_transcript_event(
                    ten_env,
                    role="system",
                    text=f"{module_name} error: {message}",
                    client_id=client_id,
                    is_final=True,
                    metadata={
                        "type": "module_error",
                        "module": module_name,
                        "code": code,
                        "error_metadata": metadata,
                    },
                )
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling module error: {e}")

    async def _handle_runtime_metrics(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Track vendor/runtime metrics so RTC graphs do not drop observability events."""
        try:
            data_json, _ = data.get_property_to_json(None)
            metrics_data = json.loads(data_json) if data_json else {}
            if not isinstance(metrics_data, dict):
                return

            module_name = str(metrics_data.get("module", "unknown") or "unknown")
            vendor = str(metrics_data.get("vendor", "unknown") or "unknown")
            payload_metrics = metrics_data.get("metrics")
            metadata = metrics_data.get("metadata")
            client_id = self._extract_client_id(metrics_data, ten_env, "metrics")

            if client_id in self.sessions or self._payload_has_session_reference(metrics_data):
                session = self._get_or_create_session(client_id)
                session.runtime_metrics[module_name] = {
                    "timestamp": int(time.time() * 1000),
                    "vendor": vendor,
                    "metrics": payload_metrics if isinstance(payload_metrics, dict) else {},
                    "metadata": metadata if isinstance(metadata, dict) else {},
                }

            ten_env.log_info(
                f"[VoxFlameMain] Runtime metrics module={module_name}, vendor={vendor}, "
                f"client_id={client_id}, metrics={json.dumps(payload_metrics or {}, ensure_ascii=False, separators=(',', ':'))}"
            )
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling runtime metrics: {e}")

    # ========================================
    # Helper Methods
    # ========================================

    def _normalize_client_id(self, client_id: Optional[str]) -> str:
        """Normalize client identifier and keep a stable fallback."""
        if isinstance(client_id, str) and client_id.strip():
            normalized = client_id.strip()
            self.default_client_id = normalized
            return normalized

        if self.sessions:
            # Prefer the most recent default if known.
            if self.default_client_id in self.sessions:
                return self.default_client_id
            # Fall back to first active session.
            return next(iter(self.sessions.keys()))

        return DEFAULT_CLIENT_ID

    def _read_client_id_from_cmd(self, cmd: Cmd) -> Optional[str]:
        """Extract client_id from command properties."""
        try:
            client_id = cmd.get_property_string("client_id")
            if client_id:
                return client_id
        except Exception:
            pass

        try:
            client_id_json, _ = cmd.get_property_to_json("client_id")
            if client_id_json:
                parsed = json.loads(client_id_json)
                if isinstance(parsed, str) and parsed.strip():
                    return parsed.strip()
        except Exception:
            pass

        try:
            metadata_json, _ = cmd.get_property_to_json("metadata")
            metadata = json.loads(metadata_json) if metadata_json else {}
            if isinstance(metadata, dict):
                nested = metadata.get("client_id")
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()
                session_id = metadata.get("session_id")
                if isinstance(session_id, str) and session_id.strip():
                    return session_id.strip()
        except Exception:
            pass

        # Fallback: parse whole command payload.
        try:
            cmd_json, _ = cmd.get_property_to_json(None)
            cmd_data = json.loads(cmd_json) if cmd_json else {}
            raw = cmd_data.get("client_id")
            if isinstance(raw, str) and raw.strip():
                return raw.strip()
            raw_session_id = cmd_data.get("session_id")
            if isinstance(raw_session_id, str) and raw_session_id.strip():
                return raw_session_id.strip()
            for numeric_key in ("stream_id", "user_id", "remote_stream_id"):
                numeric_value = cmd_data.get(numeric_key)
                if isinstance(numeric_value, int) and numeric_value > 0:
                    return str(numeric_value)
            metadata = cmd_data.get("metadata")
            if isinstance(metadata, dict):
                nested = metadata.get("client_id")
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()
                session_id = metadata.get("session_id")
                if isinstance(session_id, str) and session_id.strip():
                    return session_id.strip()
        except Exception:
            pass

        return None

    def _read_cmd_payload(self, cmd: Cmd) -> Dict[str, Any]:
        """Parse the full command payload into a dict."""
        try:
            cmd_json, _ = cmd.get_property_to_json(None)
            payload = json.loads(cmd_json) if cmd_json else {}
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass

        return {}

    def _read_data_payload(self, data: Data) -> Dict[str, Any]:
        """Parse the full data payload into a dict."""
        payload: Dict[str, Any] = {}

        try:
            data_json, _ = data.get_property_to_json(None)
            parsed_payload = json.loads(data_json) if data_json else {}
            if isinstance(parsed_payload, dict):
                payload.update(parsed_payload)
        except Exception:
            pass

        for key in (
            "data",
            "payload",
            "message",
            "type",
            "name",
            "text",
            "client_id",
            "session_id",
            "remote_user_id",
            "user_id",
            "stream_id",
            "remote_stream_id",
        ):
            try:
                value_json, _ = data.get_property_to_json(key)
            except Exception:
                continue

            if not value_json:
                continue

            try:
                payload[key] = json.loads(value_json)
            except json.JSONDecodeError:
                payload[key] = value_json

        for key in ("data", "payload", "message"):
            try:
                value_buf, _ = data.get_property_buf(key)
            except Exception:
                continue

            if not value_buf:
                continue

            decoded_payload = self._decode_transport_candidate(bytes(value_buf))
            if decoded_payload is not None:
                payload[key] = decoded_payload

        try:
            raw_buf = data.get_buf()
            if raw_buf:
                decoded_payload = self._decode_transport_candidate(bytes(raw_buf))
                if decoded_payload is not None:
                    payload["data"] = decoded_payload
        except Exception:
            pass

        return payload

    def _extract_transport_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Best-effort decode of RTC stream-message payloads delivered by agora_rtc."""
        if not isinstance(payload, dict):
            return {}

        parsed = None
        for key in ("payload", "message", "data"):
            candidate = payload.get(key)
            parsed = self._decode_transport_candidate(candidate)
            if parsed is not None:
                break

        if parsed is None and (
            isinstance(payload.get("type"), str) or isinstance(payload.get("name"), str)
        ):
            parsed = dict(payload)

        if parsed is None:
            return dict(payload)

        if not isinstance(parsed, dict):
            return {}

        metadata = parsed.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}

        for key in (
            "remote_user_id",
            "user_id",
            "stream_id",
            "remote_stream_id",
            "publisher",
            "channelName",
        ):
            value = payload.get(key)
            if value in (None, ""):
                continue

            if key in ("stream_id", "remote_stream_id") and isinstance(value, int) and value > 0:
                parsed.setdefault("client_id", str(value))
                metadata.setdefault(key, value)
                continue

            if isinstance(value, str) and value.strip():
                metadata.setdefault(key, value.strip())
                if key == "remote_user_id" and "client_id" not in parsed:
                    parsed["client_id"] = value.strip()
                if key == "publisher" and "client_id" not in parsed:
                    parsed["client_id"] = value.strip()

        if metadata:
            parsed["metadata"] = metadata

        return parsed

    def _decode_transport_candidate(self, candidate: Any) -> Optional[Dict[str, Any]]:
        """Decode nested RTC transport payloads from string/buffer/list forms."""
        if isinstance(candidate, dict):
            return dict(candidate)

        if isinstance(candidate, list) and all(isinstance(item, int) for item in candidate):
            try:
                decoded_bytes = bytes(candidate)
            except ValueError:
                return None
            return self._decode_transport_candidate(decoded_bytes)

        if isinstance(candidate, (bytes, bytearray)):
            try:
                decoded_text = bytes(candidate).decode("utf-8")
            except UnicodeDecodeError:
                return None
            return self._decode_transport_candidate(decoded_text)

        if isinstance(candidate, str):
            text = candidate.strip()
            if not text:
                return None

            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

            try:
                decoded_bytes = base64.b64decode(text, validate=True)
            except Exception:
                decoded_bytes = None

            if decoded_bytes:
                return self._decode_transport_candidate(decoded_bytes)

        return None

    def _extract_client_id(
        self,
        payload: Dict[str, Any],
        ten_env: Optional[AsyncTenEnv] = None,
        source: str = "",
    ) -> str:
        """Extract client_id from payload or nested metadata."""
        if isinstance(payload.get("client_id"), str) and payload["client_id"].strip():
            return self._normalize_client_id(payload["client_id"])
        if isinstance(payload.get("session_id"), str) and payload["session_id"].strip():
            return self._normalize_client_id(payload["session_id"])

        metadata = payload.get("metadata")
        if isinstance(metadata, dict):
            raw = metadata.get("client_id")
            if isinstance(raw, str) and raw.strip():
                return self._normalize_client_id(raw)
            session_id = metadata.get("session_id")
            if isinstance(session_id, str) and session_id.strip():
                return self._normalize_client_id(session_id)

        # If exactly one session is active, use it as deterministic fallback.
        if len(self.sessions) == 1:
            return next(iter(self.sessions.keys()))

        if ten_env and len(self.sessions) > 1:
            ten_env.log_warn(
                f"[VoxFlameMain] Missing client_id in {source} payload under multi-session mode; "
                f"falling back to {self.default_client_id}"
            )
        return self._normalize_client_id(None)

    def _resolve_client_for_tts_event(self, payload: Dict[str, Any]) -> str:
        """Resolve client_id for TTS start/end events from payload/request mapping."""
        client_id = self._extract_client_id(payload)
        if client_id != DEFAULT_CLIENT_ID or client_id in self.sessions:
            return client_id

        request_id = payload.get("request_id")
        if isinstance(request_id, str) and request_id:
            mapped_client = self.tts_request_to_client.get(request_id)
            if mapped_client:
                return mapped_client

        return self._normalize_client_id(None)

    def _payload_has_session_reference(self, payload: Dict[str, Any]) -> bool:
        """Return whether payload contains an explicit session/client reference."""
        if isinstance(payload.get("client_id"), str) and payload["client_id"].strip():
            return True
        if isinstance(payload.get("session_id"), str) and payload["session_id"].strip():
            return True
        if isinstance(payload.get("remote_stream_id"), int) and payload["remote_stream_id"] > 0:
            return True

        metadata = payload.get("metadata")
        if isinstance(metadata, dict):
            if isinstance(metadata.get("client_id"), str) and metadata["client_id"].strip():
                return True
            if isinstance(metadata.get("session_id"), str) and metadata["session_id"].strip():
                return True

        return False

    def _get_or_create_session(self, client_id: str) -> SessionContext:
        """Return per-client session context, creating one if missing."""
        normalized = self._normalize_client_id(client_id)
        session = self.sessions.get(normalized)
        if session is None:
            session = SessionContext(client_id=normalized)
            self.sessions[normalized] = session
        return session

    async def _flush_tts(self, ten_env: AsyncTenEnv, client_id: str) -> None:
        """Send flush command to TTS and clear local state for one client."""
        session = self.sessions.get(client_id)
        if session and not session.is_tts_playing and session.current_tts_request_id is None:
            return

        ten_env.log_info(f"[VoxFlameMain] Flushing TTS for client_id={client_id}...")
        try:
            payload = None
            if session and session.current_tts_request_id:
                payload = {"request_id": session.current_tts_request_id}
            await send_cmd(ten_env, "flush", "tts", payload)

            if session:
                if session.current_tts_request_id:
                    self.tts_request_to_client.pop(session.current_tts_request_id, None)
                session.is_tts_playing = False
                session.current_tts_request_id = None
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error flushing TTS for {client_id}: {e}")

    async def _send_text_to_tts(
        self,
        ten_env: AsyncTenEnv,
        text: str,
        client_id: str,
    ) -> None:
        """Send text to TTS for synthesis."""
        safe_client_id = client_id.replace(":", "_")
        request_id = f"voxflame_{safe_client_id}_{int(time.time() * 1000)}"

        self.tts_request_to_client[request_id] = client_id
        session = self._get_or_create_session(client_id)
        session.current_tts_request_id = request_id

        ten_env.log_info(
            f"[VoxFlameMain] Sending to TTS client_id={client_id}: '{text}' "
            f"(request_id={request_id})"
        )

        try:
            await send_data(
                ten_env,
                "tts_text_input",
                "tts",
                {
                    "text": text,
                    "text_input_end": True,
                    "request_id": request_id,
                    "client_id": client_id,
                    "metadata": {
                        "client_id": client_id,
                        "session_id": client_id,
                    },
                },
            )
            ten_env.log_debug(
                f"[VoxFlameMain] TTS data sent successfully, client_id={client_id}, request_id={request_id}"
            )
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error sending to TTS: {e}")

    async def _forward_to_corrector(
        self,
        ten_env: AsyncTenEnv,
        text: str,
        asr_data: Dict[str, Any],
        client_id: str,
    ) -> None:
        """Forward ASR result to LLM corrector."""
        try:
            metadata = asr_data.get("metadata")
            if not isinstance(metadata, dict):
                metadata = {}

            metadata = {**metadata, "client_id": client_id}

            await send_data(
                ten_env,
                "asr_result",
                "corrector",
                {
                    "text": text,
                    "is_final": True,
                    "client_id": client_id,
                    "metadata": metadata,
                },
            )
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error forwarding to corrector: {e}")

    async def _refresh_memory_context_for_query(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        query: str,
    ) -> None:
        """Retrieve query-specific memory context and send it to the corrector."""
        context_lines: list[str] = []

        try:
            result, err = await send_cmd(
                ten_env,
                "search_memory",
                "memory_layer",
                {
                    "client_id": client_id,
                    "query": query,
                    "limit": 5,
                },
            )
            if err is not None or result is None or result.get_status_code() != StatusCode.OK:
                ten_env.log_warn(
                    f"[VoxFlameMain] Memory search failed, client_id={client_id}"
                )
            else:
                result_json, _ = result.get_property_to_json(None)
                payload = json.loads(result_json) if result_json else {}
                results = payload.get("results", []) if isinstance(payload, dict) else []
                seen: set[str] = set()
                for item in results:
                    if not isinstance(item, dict):
                        continue
                    content = str(item.get("content", "") or "").strip()
                    if not content or content == query or content in seen:
                        continue
                    seen.add(content)
                    context_lines.append(f"- {content}")
                    if len(context_lines) >= 5:
                        break
        except Exception as e:
            ten_env.log_warn(
                f"[VoxFlameMain] Error retrieving memory context, client_id={client_id}: {e}"
            )

        try:
            await send_data(
                ten_env,
                "memory_context",
                "corrector",
                {
                    "client_id": client_id,
                    "context": "\n".join(context_lines),
                    "timestamp": int(time.time() * 1000),
                },
            )
        except Exception as e:
            ten_env.log_warn(
                f"[VoxFlameMain] Error sending memory context to corrector, client_id={client_id}: {e}"
            )

    async def _finalize_asr_turn(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        reason: str,
    ) -> None:
        """Prompt the realtime ASR stream to emit final text for the current turn."""
        finalize_id = f"{client_id}_{reason}_{uuid.uuid4().hex[:12]}"
        try:
            await send_data(
                ten_env,
                "asr_finalize",
                "stt",
                {
                    "finalize_id": finalize_id,
                    "metadata": {
                        "client_id": client_id,
                        "reason": reason,
                    },
                },
            )
            ten_env.log_info(
                f"[VoxFlameMain] Sent ASR finalize, client_id={client_id}, reason={reason}, finalize_id={finalize_id}"
            )
        except Exception as e:
            ten_env.log_error(
                f"[VoxFlameMain] Error sending ASR finalize, client_id={client_id}: {e}"
            )

    def _resolve_transcript_transport_target(self) -> Optional[str]:
        """Return the configured transcript transport target or None when disabled."""
        transport = getattr(self.config, "transcript_transport", "rtm")
        if transport == "none":
            return None

        target = str(
            getattr(self.config, "transcript_transport_extension", "agora_rtm")
            or ""
        ).strip()
        if not target:
            return None

        return target

    async def _send_transport_payload(
        self,
        ten_env: AsyncTenEnv,
        payload: Dict[str, Any],
    ) -> None:
        """Send one JSON payload through the configured realtime text transport."""
        target_extension = self._resolve_transcript_transport_target()
        if target_extension is None:
            return

        if target_extension == "agora_rtm":
            await send_rtm_publish(ten_env, target_extension, payload)
            return

        data_name = "data" if target_extension == "agora_rtc" else "data"
        await send_data(ten_env, data_name, target_extension, payload)

    async def _send_transport_event(
        self,
        ten_env: AsyncTenEnv,
        event_type: str,
        client_id: str,
        payload: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Send one typed realtime event to the active transcript transport."""
        try:
            event_payload: Dict[str, Any] = {
                "type": event_type,
                "client_id": client_id,
                "timestamp": int(time.time() * 1000),
            }
            if payload:
                event_payload.update(payload)
            if metadata:
                event_payload["metadata"] = {**metadata, "client_id": client_id}

            await self._send_transport_payload(ten_env, event_payload)
        except Exception as e:
            ten_env.log_error(
                f"[VoxFlameMain] Error sending transport event {event_type}: {e}"
            )

    async def _send_transcript_event(
        self,
        ten_env: AsyncTenEnv,
        role: str,
        text: str,
        client_id: str,
        is_final: bool = True,
        metadata: Optional[dict] = None,
    ) -> None:
        """Send transcript/error text to the configured realtime transport."""
        try:
            payload = {
                "type": "transcript",
                "role": role,
                "text": text,
                "is_final": is_final,
                "timestamp": int(time.time() * 1000),
                "client_id": client_id,
            }
            if metadata:
                payload["metadata"] = {**metadata, "client_id": client_id}

            await self._send_transport_payload(ten_env, payload)
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error sending transcript event: {e}")

    async def _send_correction_event(
        self,
        ten_env: AsyncTenEnv,
        raw_text: str,
        corrected_text: str,
        client_id: str,
    ) -> None:
        """Send correction event to memory layer for learning."""
        try:
            await send_data(
                ten_env,
                "correction_event",
                "memory_layer",
                {
                    "raw_text": raw_text,
                    "corrected_text": corrected_text,
                    "client_id": client_id,
                    "timestamp": int(time.time() * 1000),
                },
            )
            ten_env.log_info(
                f"[VoxFlameMain] Sent correction event to memory layer, client_id={client_id}: "
                f"'{raw_text}' -> '{corrected_text}'"
            )
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error sending correction event: {e}")

    async def _send_session_event(
        self,
        ten_env: AsyncTenEnv,
        event_type: str,
        client_id: str,
    ) -> None:
        """Send session event to memory layer."""
        try:
            session = self._get_or_create_session(client_id)
            await send_data(
                ten_env,
                event_type,
                "memory_layer",
                {
                    "client_id": client_id,
                    "timestamp": int(time.time() * 1000),
                    "turn_count": len(session.conversation_history),
                },
            )
            ten_env.log_info(
                f"[VoxFlameMain] Sent {event_type} event to memory layer, client_id={client_id}"
            )
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error sending session event: {e}")

    def _should_interrupt_tts(self, text: str, is_final: bool, asr_data: Dict[str, Any]) -> bool:
        """
        Decide whether current ASR chunk is strong enough to interrupt TTS.

        Preference order:
        1. Final ASR result always interrupts.
        2. Non-final chunk interrupts only if duration exceeds threshold.
        3. If no duration is available, use minimal text-length fallback.
        """
        if is_final:
            return True

        try:
            duration_ms = int(asr_data.get("duration_ms", 0))
        except (TypeError, ValueError):
            duration_ms = 0

        if duration_ms > 0:
            return duration_ms >= self.config.interrupt_threshold_ms

        return len(text.strip()) >= 2

    def _map_training_status_to_clarity(self, status: str) -> float:
        """Map page-level training result to a lightweight clarity proxy."""
        if status == "excellent":
            return 0.95
        if status == "close":
            return 0.75
        if status == "retry":
            return 0.45
        return 0.2

    def _read_training_clarity(self, payload: Dict[str, Any], status: str) -> float:
        """Prefer explicit clarity_score from page feedback, fallback to status mapping."""
        try:
            explicit = float(payload.get("clarity_score"))
        except (TypeError, ValueError):
            explicit = None

        if explicit is not None:
            return max(0.0, min(1.0, explicit))

        return self._map_training_status_to_clarity(status)

    def _parse_confusion_pair(self, pair: str) -> Optional[tuple[str, str]]:
        """Parse front-end pair text like 'zh → z' into target/heard tokens."""
        normalized = pair.replace("->", "→")
        if "→" not in normalized:
            return None

        parts = [item.strip() for item in normalized.split("→", 1)]
        if len(parts) != 2 or not parts[0] or not parts[1]:
            return None

        return parts[0], parts[1]

    def _build_training_confusion_patterns(
        self,
        initial_pairs: List[str],
        final_pairs: List[str],
        tone_pairs: List[str],
        target_text: str,
        recognized_text: str,
        status: str,
    ) -> List[Dict[str, Any]]:
        """Convert Phase 3 pair strings into confusion patterns for memory layer."""
        confidence_by_status = {
            "excellent": 0.72,
            "close": 0.78,
            "retry": 0.9,
            "unclear": 0.55,
        }
        base_confidence = confidence_by_status.get(status, 0.6)
        example = f"目标:{target_text} | 听到:{recognized_text or '未稳定听清'}"
        patterns: list[Dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        def append_pattern(pair_values: List[str], kind: str) -> None:
            for pair in pair_values[:4]:
                parsed = self._parse_confusion_pair(pair)
                if not parsed:
                    continue

                target_value, heard_value = parsed
                # Frontend pair is target -> heard. ConfusionPattern needs heard -> target.
                key = (heard_value, target_value)
                if key in seen:
                    continue
                seen.add(key)
                patterns.append(
                    {
                        "source_phonemes": [heard_value],
                        "target_phoneme": target_value,
                        "confidence": base_confidence,
                        "correction_count": 1,
                        "examples": [f"{kind} {target_value}→{heard_value}", example],
                    }
                )

        append_pattern(initial_pairs, "声母")
        append_pattern(final_pairs, "韵母")
        append_pattern(tone_pairs, "声调")

        return patterns

    def _map_training_category_to_hotword(self, category: str) -> str:
        """Map training category to memory hotword category."""
        if category in {"就医沟通", "紧急求助"}:
            return "medical"
        return "daily"

    def _build_training_result_summary(
        self,
        target_text: str,
        recognized_text: str,
        status: str,
        category: str,
        focus_tags: List[str],
    ) -> str:
        """Create one concise training summary for memory retrieval."""
        status_label = {
            "excellent": "匹配良好",
            "close": "接近目标句",
            "retry": "建议重练",
            "unclear": "系统未稳定听清",
        }.get(status, status)

        heard_label = recognized_text or "系统未稳定听清"
        focus_label = "、".join(focus_tags[:3]) if focus_tags else "未标注"

        return (
            f"训练记录：场景={category or '中文训练'}；"
            f"目标句“{target_text}”；"
            f"系统听到“{heard_label}”；"
            f"结果={status_label}；"
            f"重点={focus_label}。"
        )

    async def _save_conversation_turn(
        self,
        ten_env: AsyncTenEnv,
        role: str,
        content: str,
        client_id: str,
        raw_asr: str = "",
        corrected_text: str = "",
        clarity_score: float = 0.0,
    ) -> None:
        """Persist one conversation turn via memory layer command channel."""
        if not content:
            return

        try:
            await send_cmd(
                ten_env,
                "save_conversation",
                "memory_layer",
                {
                    "client_id": client_id,
                    "role": role,
                    "content": content,
                    "raw_asr": raw_asr,
                    "corrected_text": corrected_text,
                    "clarity_score": clarity_score,
                    "timestamp": int(time.time() * 1000),
                },
            )
            ten_env.log_debug(
                f"[VoxFlameMain] Saved turn role={role}, client_id={client_id}, content_len={len(content)}"
            )
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error saving conversation turn: {e}")

    def _trim_history(self, session: SessionContext) -> None:
        """Trim one session's conversation history to max length."""
        if len(session.conversation_history) > self.max_history_length:
            session.conversation_history = session.conversation_history[-self.max_history_length :]
