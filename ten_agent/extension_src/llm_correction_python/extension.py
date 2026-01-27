#
# VoxFlame LLM Correction Extension
# Copyright (c) 2025 VoxFlame. All rights reserved.
#
import json
import asyncio
from collections import deque
from typing import Optional

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

        # Context history for better correction
        self.context_history: deque = deque(maxlen=5)

        # Pending correction task
        self._correction_task: Optional[asyncio.Task] = None

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """Initialize the extension"""
        self.ten_env = ten_env
        ten_env.log_info("LLM Correction Extension initializing...")

        try:
            # Load configuration
            config_json, _ = await ten_env.get_property_to_json("")
            self.config = LLMCorrectionConfig.model_validate_json(config_json)
            self.config.validate_config()

            ten_env.log_info(f"Loaded config: {self.config.to_str()}")

            # Update context history max length
            self.context_history = deque(maxlen=self.config.max_context_length)

        except Exception as e:
            ten_env.log_error(f"Failed to load configuration: {e}")
            raise

    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """Start the extension"""
        ten_env.log_info("LLM Correction Extension starting...")

        try:
            # Initialize the corrector
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

        # Cancel any pending correction task
        if self._correction_task and not self._correction_task.done():
            self._correction_task.cancel()
            try:
                await self._correction_task
            except asyncio.CancelledError:
                pass

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """Deinitialize the extension"""
        ten_env.log_info("LLM Correction Extension deinitializing...")
        self.corrector = None

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """Handle commands"""
        cmd_name = cmd.get_name()
        ten_env.log_debug(f"Received command: {cmd_name}")

        if cmd_name == "flush":
            # Cancel any pending correction
            if self._correction_task and not self._correction_task.done():
                self._correction_task.cancel()
            # Clear context
            self.context_history.clear()
            ten_env.log_info("Flushed correction context")

        elif cmd_name == "update_profile":
            # Update user profile in corrector
            try:
                cmd_json, _ = cmd.get_property_to_json(None)
                profile_data = json.loads(cmd_json) if cmd_json else {}
                user_profile = profile_data.get("user_profile")

                if user_profile and self.corrector:
                    self.corrector.update_user_profile(user_profile)
                    ten_env.log_info(f"Updated user profile: {user_profile.get('email', 'unknown')}")
            except Exception as e:
                ten_env.log_error(f"Error updating profile: {e}")

        # Return success
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
                # Parse ASR result
                data_json, _ = data.get_property_to_json(None)
                asr_data = json.loads(data_json)

                text = asr_data.get("text", "")
                is_final = asr_data.get("is_final", False)

                ten_env.log_info(f"ASR result: '{text}', final={is_final}")

                if not text.strip():
                    ten_env.log_debug("Empty ASR text, skipping correction")
                    return

                # Only correct final results to avoid excessive API calls
                if is_final:
                    await self._process_final_asr(ten_env, text, asr_data)
                else:
                    # For interim results, just forward to frontend for display
                    await self._send_interim_text(ten_env, text)

            except Exception as e:
                ten_env.log_error(f"Error processing ASR result: {e}")

    async def _process_final_asr(
        self, ten_env: AsyncTenEnv, text: str, asr_data: dict
    ) -> None:
        """Process final ASR result with LLM correction"""
        try:
            # Get context for better correction
            context = list(self.context_history)

            # Perform correction
            corrected_text = await self.corrector.correct(text, context)

            ten_env.log_info(f"Correction: '{text}' -> '{corrected_text}'")

            # Add to context history
            self.context_history.append({
                "original": text,
                "corrected": corrected_text
            })

            # Send corrected text to TTS (text_data format)
            await self._send_to_tts(ten_env, corrected_text)

            # Send corrected text to frontend (for display)
            await self._send_corrected_text(ten_env, text, corrected_text)

        except Exception as e:
            ten_env.log_error(f"Error in correction: {e}")
            # On error, forward original text
            await self._send_to_tts(ten_env, text)
            await self._send_corrected_text(ten_env, text, text)

    async def _send_to_tts(self, ten_env: AsyncTenEnv, text: str) -> None:
        """Send corrected text to TTS extension"""
        try:
            # Create text_data for TTS
            text_data = Data.create("text_data")
            text_data.set_property_string("text", text)
            text_data.set_property_bool("end_of_segment", True)

            await ten_env.send_data(text_data)
            ten_env.log_debug(f"Sent to TTS: '{text}'")

        except Exception as e:
            ten_env.log_error(f"Error sending to TTS: {e}")

    async def _send_corrected_text(
        self, ten_env: AsyncTenEnv, original: str, corrected: str
    ) -> None:
        """Send corrected text to frontend via WebSocket"""
        try:
            # Create corrected_text data for frontend
            corrected_data = Data.create("corrected_text")
            corrected_data.set_property_string("original_text", original)
            corrected_data.set_property_string("corrected_text", corrected)
            corrected_data.set_property_bool("is_corrected", original != corrected)

            await ten_env.send_data(corrected_data)
            ten_env.log_debug(f"Sent corrected text to frontend")

        except Exception as e:
            ten_env.log_error(f"Error sending corrected text: {e}")

    async def _send_interim_text(self, ten_env: AsyncTenEnv, text: str) -> None:
        """Send interim (non-final) ASR text to frontend"""
        try:
            interim_data = Data.create("interim_text")
            interim_data.set_property_string("text", text)
            interim_data.set_property_bool("is_interim", True)

            await ten_env.send_data(interim_data)
            ten_env.log_debug(f"Sent interim text: '{text}'")

        except Exception as e:
            ten_env.log_error(f"Error sending interim text: {e}")
