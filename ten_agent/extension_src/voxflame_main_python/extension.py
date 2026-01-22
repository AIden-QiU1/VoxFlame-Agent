#
# VoxFlame Main Control Extension
# Central coordinator for voice assistant with speech correction
#

import asyncio
import time
import json
from typing import Optional, Dict, Any

from ten_runtime import (
    AsyncExtension,
    AsyncTenEnv,
    Cmd,
    CmdResult,
    Data,
    StatusCode,
)

from .config import VoxFlameMainConfig
from .helper import send_cmd, send_data, broadcast_data


class VoxFlameMainExtension(AsyncExtension):
    """
    VoxFlame Main Control Extension

    Responsibilities:
    1. Coordinate data flow between ASR -> Corrector -> TTS
    2. Handle user speech interruption (flush TTS when user speaks)
    3. Send transcripts to WebSocket for frontend display
    4. Manage conversation state and history
    """

    def __init__(self, name: str):
        super().__init__(name)
        self.ten_env: AsyncTenEnv = None
        self.config: VoxFlameMainConfig = None
        self.stopped: bool = False

        # State tracking
        self.is_tts_playing: bool = False
        self.current_tts_request_id: Optional[str] = None
        self.last_user_speech_time: int = 0
        self.user_connected: bool = False

        # Conversation history for context
        self.conversation_history: list = []
        self.max_history_length: int = 10

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """Initialize the extension."""
        self.ten_env = ten_env
        ten_env.log_info("[VoxFlameMain] Initializing...")

        try:
            # Load configuration
            config_json, _ = await ten_env.get_property_to_json(None)
            self.config = VoxFlameMainConfig.model_validate_json(config_json)
            ten_env.log_info(f"[VoxFlameMain] Config loaded: greeting={self.config.greeting}, "
                           f"enable_interrupt={self.config.enable_interrupt}")
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

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """Cleanup resources."""
        ten_env.log_info("[VoxFlameMain] Deinitialized")

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """
        Handle incoming commands.

        Supported commands:
        - on_user_connected: User connected via WebSocket
        - on_user_disconnected: User disconnected
        - flush: Interrupt current TTS playback
        """
        cmd_name = cmd.get_name()
        ten_env.log_info(f"[VoxFlameMain] Received cmd: {cmd_name}")

        try:
            if cmd_name == "on_user_connected":
                await self._handle_user_connected(ten_env)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "on_user_disconnected":
                await self._handle_user_disconnected(ten_env)
                await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

            elif cmd_name == "flush":
                await self._handle_flush(ten_env)
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
        2. corrected_text from corrector -> Forward to TTS and WebSocket
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

            else:
                ten_env.log_debug(f"[VoxFlameMain] Unhandled data: {data_name}")

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling data {data_name}: {e}")

    # ========================================
    # Command Handlers
    # ========================================

    async def _handle_user_connected(self, ten_env: AsyncTenEnv) -> None:
        """Handle user connection."""
        ten_env.log_info("[VoxFlameMain] User connected")
        self.user_connected = True
        self.conversation_history = []

        # Send greeting if enabled
        if self.config.enable_greeting and self.config.greeting:
            ten_env.log_info(f"[VoxFlameMain] Sending greeting: {self.config.greeting}")
            # Send greeting text to TTS
            await self._send_text_to_tts(ten_env, self.config.greeting)
            # Also send to WebSocket for display
            await self._send_to_websocket(ten_env, "assistant", self.config.greeting, is_final=True)

    async def _handle_user_disconnected(self, ten_env: AsyncTenEnv) -> None:
        """Handle user disconnection."""
        ten_env.log_info("[VoxFlameMain] User disconnected")
        self.user_connected = False

        # Flush any ongoing TTS
        if self.is_tts_playing:
            await self._flush_tts(ten_env)

    async def _handle_flush(self, ten_env: AsyncTenEnv) -> None:
        """Handle flush command - interrupt TTS."""
        ten_env.log_info("[VoxFlameMain] Flush command received")
        await self._flush_tts(ten_env)

    # ========================================
    # Data Handlers
    # ========================================

    async def _handle_asr_result(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """
        Handle ASR result from STT extension.

        Key logic:
        1. If user is speaking and TTS is playing -> Interrupt TTS
        2. Forward ASR result to corrector for LLM correction
        3. Send interim results to WebSocket for real-time display
        """
        try:
            data_json, _ = data.get_property_to_json(None)
            asr_data = json.loads(data_json) if data_json else {}

            text = asr_data.get("text", "")
            is_final = asr_data.get("is_final", asr_data.get("final", False))

            if not text:
                return

            ten_env.log_info(f"[VoxFlameMain] ASR result: '{text}' (final={is_final})")

            # Update last speech time
            self.last_user_speech_time = int(time.time() * 1000)

            # Check if we should interrupt TTS
            if self.config.enable_interrupt and self.is_tts_playing:
                ten_env.log_info("[VoxFlameMain] User speaking while TTS playing - interrupting")
                await self._flush_tts(ten_env)

            # Send interim text to WebSocket for real-time display
            await self._send_to_websocket(ten_env, "user", text, is_final=is_final)

            # If final result, forward to corrector
            if is_final and self.config.enable_correction:
                ten_env.log_info(f"[VoxFlameMain] Forwarding to corrector: '{text}'")
                await self._forward_to_corrector(ten_env, text, asr_data)

                # Add to conversation history
                self.conversation_history.append({
                    "role": "user",
                    "content": text,
                    "timestamp": self.last_user_speech_time
                })
                self._trim_history()

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling ASR result: {e}")

    async def _handle_corrected_text(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """
        Handle corrected text from LLM corrector.

        Forward to:
        1. TTS for speech synthesis
        2. WebSocket for frontend display
        """
        try:
            data_json, _ = data.get_property_to_json(None)
            corrected_data = json.loads(data_json) if data_json else {}

            original_text = corrected_data.get("original_text", "")
            corrected_text = corrected_data.get("corrected_text", "")

            if not corrected_text:
                return

            ten_env.log_info(f"[VoxFlameMain] Corrected: '{original_text}' -> '{corrected_text}'")

            # Send corrected text to TTS
            await self._send_text_to_tts(ten_env, corrected_text)

            # Send to WebSocket for display (as assistant response showing correction)
            await self._send_to_websocket(
                ten_env,
                "assistant",
                corrected_text,
                is_final=True,
                metadata={"original": original_text, "type": "correction"}
            )

            # Add to conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": corrected_text,
                "original": original_text,
                "timestamp": int(time.time() * 1000)
            })
            self._trim_history()

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling corrected text: {e}")

    async def _handle_interim_text(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle interim (non-final) ASR text for real-time display."""
        try:
            data_json, _ = data.get_property_to_json(None)
            interim_data = json.loads(data_json) if data_json else {}

            text = interim_data.get("text", "")
            if text:
                await self._send_to_websocket(ten_env, "user", text, is_final=False)

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling interim text: {e}")

    async def _handle_tts_start(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle TTS playback start."""
        try:
            data_json, _ = data.get_property_to_json(None)
            tts_data = json.loads(data_json) if data_json else {}

            self.is_tts_playing = True
            self.current_tts_request_id = tts_data.get("request_id", "")
            ten_env.log_info(f"[VoxFlameMain] TTS started: {self.current_tts_request_id}")

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling TTS start: {e}")

    async def _handle_tts_end(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Handle TTS playback end."""
        try:
            self.is_tts_playing = False
            self.current_tts_request_id = None
            ten_env.log_info("[VoxFlameMain] TTS ended")

        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error handling TTS end: {e}")

    # ========================================
    # Helper Methods
    # ========================================

    async def _flush_tts(self, ten_env: AsyncTenEnv) -> None:
        """Send flush command to TTS to interrupt playback."""
        if not self.is_tts_playing:
            return

        ten_env.log_info("[VoxFlameMain] Flushing TTS...")
        try:
            # Send flush command to TTS extension
            await send_cmd(ten_env, "flush", "tts")
            self.is_tts_playing = False
            self.current_tts_request_id = None
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error flushing TTS: {e}")

    async def _send_text_to_tts(self, ten_env: AsyncTenEnv, text: str) -> None:
        """Send text to TTS for synthesis."""
        request_id = f"voxflame_{int(time.time() * 1000)}"
        ten_env.log_info(f"[VoxFlameMain] Sending to TTS: '{text}' (request_id={request_id})")
        try:
            # Use send_data to directly send to TTS extension
            await send_data(ten_env, "tts_text_input", "tts", {
                "text": text,
                "text_input_end": True,
                "request_id": request_id
            })
            ten_env.log_info(f"[VoxFlameMain] TTS data sent successfully")
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error sending to TTS: {e}")

    async def _forward_to_corrector(self, ten_env: AsyncTenEnv, text: str, metadata: dict) -> None:
        """Forward ASR result to LLM corrector."""
        try:
            await broadcast_data(ten_env, "asr_result", {
                "text": text,
                "is_final": True,
                "metadata": metadata
            })
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error forwarding to corrector: {e}")

    async def _send_to_websocket(
        self,
        ten_env: AsyncTenEnv,
        role: str,
        text: str,
        is_final: bool = True,
        metadata: dict = None
    ) -> None:
        """Send transcript to WebSocket for frontend display."""
        try:
            payload = {
                "type": "transcript",
                "role": role,
                "text": text,
                "is_final": is_final,
                "timestamp": int(time.time() * 1000)
            }
            if metadata:
                payload["metadata"] = metadata

            await send_data(ten_env, "transcript", "websocket_server", payload)
        except Exception as e:
            ten_env.log_error(f"[VoxFlameMain] Error sending to WebSocket: {e}")

    
    def _trim_history(self) -> None:
        """Trim conversation history to max length."""
        if len(self.conversation_history) > self.max_history_length:
            self.conversation_history = self.conversation_history[-self.max_history_length:]
