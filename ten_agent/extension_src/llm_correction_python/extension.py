#
# VoxFlame LLM Correction Extension
# Copyright (c) 2025 VoxFlame. All rights reserved.
#
import json
import asyncio
from collections import deque
from dataclasses import dataclass, field
from typing import Optional, Any, Dict

from ten_runtime import (
    AsyncExtension,
    AsyncTenEnv,
    Cmd,
    StatusCode,
    CmdResult,
    Data,
)

from .config import LLMCorrectionConfig
from .corrector import LLMCorrector


DEFAULT_CLIENT_ID = "default"


@dataclass
class ClientCorrectionContext:
    """Per-client correction context to avoid cross-session contamination."""

    context_history: deque
    voice_profile: dict = field(default_factory=dict)
    memory_context: str = ""


class LLMCorrectionExtension(AsyncExtension):
    """
    LLM Correction Extension for VoxFlame

    This extension receives ASR results, corrects them using LLM,
    and outputs the corrected text to TTS and frontend.

    Data Flow:
        ASR (asr_result) -> LLMCorrection -> TTS (text_data) + WebSocket (corrected_text)
    """

    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.config: Optional[LLMCorrectionConfig] = None
        self.corrector: Optional[LLMCorrector] = None
        self.ten_env: Optional[AsyncTenEnv] = None

        # Per-client contexts.
        self.client_contexts: Dict[str, ClientCorrectionContext] = {}

        # Pending correction task
        self._correction_task: Optional[asyncio.Task] = None

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """Initialize the extension"""
        self.ten_env = ten_env
        ten_env.log_info("LLM Correction Extension initializing...")

        try:
            config_json, _ = await ten_env.get_property_to_json("")
            self.config = LLMCorrectionConfig.model_validate_json(config_json)
            self.config.validate_config()

            ten_env.log_info(f"Loaded config: {self.config.to_str()}")

        except Exception as e:
            ten_env.log_error(f"Failed to load configuration: {e}")
            raise

    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """Start the extension"""
        ten_env.log_info("LLM Correction Extension starting...")

        try:
            self.corrector = LLMCorrector(
                api_key=self.config.api_key,
                base_url=self.config.base_url,
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                system_prompt=self.config.system_prompt,
                user_profile=self.config.user_profile,
                vocabulary=self.config.vocabulary,
                ten_env=ten_env,
            )
            ten_env.log_info("LLM Corrector initialized successfully")

        except Exception as e:
            ten_env.log_error(f"Failed to initialize corrector: {e}")
            raise

    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """Stop the extension"""
        ten_env.log_info("LLM Correction Extension stopping...")

        if self._correction_task and not self._correction_task.done():
            self._correction_task.cancel()
            try:
                await self._correction_task
            except asyncio.CancelledError:
                pass

        self.client_contexts.clear()

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """Deinitialize the extension"""
        ten_env.log_info("LLM Correction Extension deinitializing...")
        self.corrector = None

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Handle commands"""
        cmd_name = cmd.get_name()
        ten_env.log_debug(f"Received command: {cmd_name}")

        cmd_data = self._load_json_from_cmd(cmd)
        client_id = self._extract_client_id(cmd_data)

        if cmd_name == "flush":
            if self._correction_task and not self._correction_task.done():
                self._correction_task.cancel()

            if client_id:
                context = self.client_contexts.get(client_id)
                if context:
                    context.context_history.clear()
                    context.memory_context = ""
                ten_env.log_info(f"Flushed correction context for client_id={client_id}")
            else:
                self.client_contexts.clear()
                ten_env.log_info("Flushed correction contexts for all clients")

        elif cmd_name == "update_profile":
            try:
                user_profile = cmd_data.get("user_profile")
                if user_profile and self.corrector:
                    self.corrector.update_user_profile(user_profile)
                    ten_env.log_info(
                        f"Updated user profile for client_id={client_id or DEFAULT_CLIENT_ID}: "
                        f"{user_profile.get('email', 'unknown')}"
                    )
            except Exception as e:
                ten_env.log_error(f"Error updating profile: {e}")

        cmd_result = CmdResult.create(StatusCode.OK, cmd)
        await ten_env.return_result(cmd_result)

    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """
        Handle data messages - primarily ASR results

        Expected input format (asr_result):
        {
            "text": "识别的文本",
            "final": true/false,
            "start_ms": 0,
            "duration_ms": 1000,
            "language": "zh"
        }
        """
        data_name = data.get_name()
        ten_env.log_debug(f"Received data: {data_name}")

        if data_name == "asr_result":
            try:
                data_json, _ = data.get_property_to_json(None)
                asr_data = json.loads(data_json) if data_json else {}

                text = asr_data.get("text", "")
                is_final = asr_data.get("is_final", False)
                client_id = self._extract_client_id(asr_data) or DEFAULT_CLIENT_ID

                ten_env.log_info(
                    f"ASR result client_id={client_id}: '{text}', final={is_final}"
                )

                if not text.strip():
                    ten_env.log_debug("Empty ASR text, skipping correction")
                    return

                if is_final:
                    await self._process_final_asr(ten_env, client_id, text, asr_data)
                else:
                    await self._send_interim_text(ten_env, text, client_id)

            except Exception as e:
                ten_env.log_error(f"Error processing ASR result: {e}")

        elif data_name == "voice_profile":
            await self._handle_voice_profile(ten_env, data)

        elif data_name == "memory_context":
            await self._handle_memory_context(ten_env, data)

    async def _process_final_asr(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        text: str,
        asr_data: dict,
    ) -> None:
        """Process final ASR result with LLM correction"""
        try:
            context = self._get_or_create_client_context(client_id)

            if self.corrector and isinstance(context.voice_profile, dict):
                hotwords = context.voice_profile.get("hotwords", [])
                if isinstance(hotwords, list):
                    self.corrector.update_vocabulary(hotwords)
                confusion_rules = context.voice_profile.get("confusion_rules", {})
                if isinstance(confusion_rules, dict):
                    self.corrector.update_confusion_rules(confusion_rules)
                self.corrector.update_memory_context(context.memory_context)

            corrected_text = text
            if self.corrector:
                corrected_text = await self.corrector.correct(
                    text,
                    list(context.context_history),
                    memory_context=context.memory_context,
                )

            ten_env.log_info(
                f"Correction client_id={client_id}: '{text}' -> '{corrected_text}'"
            )

            context.context_history.append(
                {
                    "original": text,
                    "corrected": corrected_text,
                }
            )

            await self._send_to_tts(ten_env, corrected_text, client_id)
            await self._send_corrected_text(ten_env, text, corrected_text, client_id)

        except Exception as e:
            ten_env.log_error(f"Error in correction: {e}")
            await self._send_to_tts(ten_env, text, client_id)
            await self._send_corrected_text(ten_env, text, text, client_id)

    async def _handle_voice_profile(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Receive personal voice profile from memory layer."""
        try:
            data_json, _ = data.get_property_to_json(None)
            profile = json.loads(data_json) if data_json else {}
            if not isinstance(profile, dict):
                ten_env.log_warn("voice_profile payload is not a dict, ignored")
                return

            client_id = self._extract_client_id(profile) or DEFAULT_CLIENT_ID
            context = self._get_or_create_client_context(client_id)
            context.voice_profile = profile

            hotwords = profile.get("hotwords", [])
            if isinstance(hotwords, list) and self.corrector:
                self.corrector.update_vocabulary(hotwords)
            confusion_rules = profile.get("confusion_rules", {})
            if isinstance(confusion_rules, dict) and self.corrector:
                self.corrector.update_confusion_rules(confusion_rules)

            ten_env.log_info(
                f"Voice profile received for client_id={client_id}: "
                f"{len(hotwords) if isinstance(hotwords, list) else 0} hotwords, "
                f"{len(confusion_rules) if isinstance(confusion_rules, dict) else 0} confusion rules"
            )
        except Exception as e:
            ten_env.log_error(f"Error handling voice_profile: {e}")

    async def _handle_memory_context(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """Receive long-term memory retrieval result from memory layer."""
        try:
            data_json, _ = data.get_property_to_json(None)
            context_payload = json.loads(data_json) if data_json else {}
            client_id = self._extract_client_id(context_payload) or DEFAULT_CLIENT_ID

            context_value = context_payload.get("context", "")
            if not isinstance(context_value, str):
                context_value = str(context_value)

            context = self._get_or_create_client_context(client_id)
            context.memory_context = context_value.strip()

            if self.corrector:
                self.corrector.update_memory_context(context.memory_context)

            ten_env.log_info(
                f"Memory context received for client_id={client_id}: "
                f"{len(context.memory_context)} chars"
            )
        except Exception as e:
            ten_env.log_error(f"Error handling memory_context: {e}")

    async def _send_to_tts(
        self,
        ten_env: AsyncTenEnv,
        text: str,
        client_id: str,
    ) -> None:
        """Send corrected text to TTS extension"""
        try:
            text_data = Data.create("text_data")
            text_data.set_property_string("text", text)
            text_data.set_property_bool("end_of_segment", True)
            text_data.set_property_string("client_id", client_id)

            await ten_env.send_data(text_data)
            ten_env.log_debug(f"Sent to TTS client_id={client_id}: '{text}'")

        except Exception as e:
            ten_env.log_error(f"Error sending to TTS: {e}")

    async def _send_corrected_text(
        self,
        ten_env: AsyncTenEnv,
        original: str,
        corrected: str,
        client_id: str,
    ) -> None:
        """Send corrected text to frontend via WebSocket."""
        try:
            corrected_data = Data.create("corrected_text")
            corrected_data.set_property_string("original_text", original)
            corrected_data.set_property_string("corrected_text", corrected)
            corrected_data.set_property_bool("is_corrected", original != corrected)
            corrected_data.set_property_string("client_id", client_id)

            clarity_score = 100 if original == corrected else max(0, 100 - len(original) * 2)
            corrected_data.set_property_int("clarity_score", clarity_score)

            await ten_env.send_data(corrected_data)
            ten_env.log_debug(
                "Sent dual-line text: "
                f"client_id={client_id}, original='{original}', corrected='{corrected}', score={clarity_score}"
            )

        except Exception as e:
            ten_env.log_error(f"Error sending corrected text: {e}")

    async def _send_interim_text(
        self,
        ten_env: AsyncTenEnv,
        text: str,
        client_id: str,
    ) -> None:
        """Send interim (non-final) ASR text to frontend."""
        try:
            interim_data = Data.create("interim_text")
            interim_data.set_property_string("text", text)
            interim_data.set_property_bool("is_interim", True)
            interim_data.set_property_string("client_id", client_id)

            await ten_env.send_data(interim_data)
            ten_env.log_debug(f"Sent interim text client_id={client_id}: '{text}'")

        except Exception as e:
            ten_env.log_error(f"Error sending interim text: {e}")

    def _get_or_create_client_context(self, client_id: str) -> ClientCorrectionContext:
        """Get per-client correction context."""
        normalized = client_id.strip() if isinstance(client_id, str) and client_id.strip() else DEFAULT_CLIENT_ID
        context = self.client_contexts.get(normalized)
        if context is None:
            maxlen = self.config.max_context_length if self.config else 5
            context = ClientCorrectionContext(context_history=deque(maxlen=maxlen))
            self.client_contexts[normalized] = context
        return context

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

    def _load_json_from_cmd(self, cmd: Cmd) -> dict:
        """Best-effort command payload parsing helper."""
        try:
            cmd_json, _ = cmd.get_property_to_json(None)
            return json.loads(cmd_json) if cmd_json else {}
        except Exception:
            return {}
