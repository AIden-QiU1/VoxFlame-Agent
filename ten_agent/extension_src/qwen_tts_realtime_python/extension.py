from __future__ import annotations

import asyncio
import base64
import os
import traceback
from datetime import datetime

from ten_ai_base.const import LOG_CATEGORY_KEY_POINT, LOG_CATEGORY_VENDOR
from ten_ai_base.helper import PCMWriter
from ten_ai_base.message import (
    ModuleError,
    ModuleErrorCode,
    ModuleErrorVendorInfo,
    ModuleType,
    TTSAudioEndReason,
)
from ten_ai_base.struct import TTSTextInput
from ten_ai_base.tts2 import AsyncTTS2BaseExtension
from ten_runtime import AsyncTenEnv

from .config import QwenRealtimeTTSConfig
from .realtime_client import QwenRealtimeTTSClient


class QwenRealtimeTTSExtension(AsyncTTS2BaseExtension):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.name = name
        self.config: QwenRealtimeTTSConfig | None = None
        self.client: QwenRealtimeTTSClient | None = None
        self.current_request_id: str | None = None
        self.request_start_ts: datetime | None = None
        self.total_audio_bytes: int = 0
        self.first_chunk_received: bool = False
        self.response_done_event: asyncio.Event = asyncio.Event()
        self.response_error: ModuleError | None = None
        self.recorder_map: dict[str, PCMWriter] = {}

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        try:
            await super().on_init(ten_env)
            config_json, _ = await self.ten_env.get_property_to_json("")
            self.config = QwenRealtimeTTSConfig.model_validate_json(config_json)
            self.config.update_params()
            ten_env.log_info(
                f"[QWEN-TTS] config: {self.config.to_str()}",
                category=LOG_CATEGORY_KEY_POINT,
            )

            self.client = QwenRealtimeTTSClient(
                url=self.config.url,
                model=self.config.model,
                api_key=self.config.api_key,
                connect_timeout_seconds=self.config.connect_timeout_seconds,
                event_handler=self._handle_server_event,
                logger=ten_env,
            )
        except Exception as exc:
            ten_env.log_error(f"[QWEN-TTS] on_init failed: {traceback.format_exc()}")
            await self.send_tts_error(
                "",
                ModuleError(
                    message=str(exc),
                    module=ModuleType.TTS,
                    code=int(ModuleErrorCode.FATAL_ERROR),
                    vendor_info=ModuleErrorVendorInfo(vendor=self.vendor()),
                ),
            )

    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        if self.client:
            await self.client.finish_session()
            self.client = None

        for request_id, recorder in list(self.recorder_map.items()):
            try:
                await recorder.flush()
            except Exception as exc:
                ten_env.log_error(
                    f"[QWEN-TTS] flush recorder failed for {request_id}: {exc}"
                )
        self.recorder_map.clear()

        await super().on_stop(ten_env)

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        await super().on_deinit(ten_env)

    def vendor(self) -> str:
        return "qwen_realtime"

    def synthesize_audio_sample_rate(self) -> int:
        if self.config is None:
            return 16000
        return self.config.sample_rate

    async def request_tts(self, t: TTSTextInput) -> None:
        if self.config is None or self.client is None:
            await self._finish_request_with_error(
                t.request_id,
                ModuleError(
                    message="Qwen realtime TTS client is not initialized",
                    module=ModuleType.TTS,
                    code=int(ModuleErrorCode.FATAL_ERROR),
                    vendor_info=ModuleErrorVendorInfo(vendor=self.vendor()),
                ),
            )
            return

        self.current_request_id = t.request_id
        self.request_start_ts = datetime.now()
        self.total_audio_bytes = 0
        self.first_chunk_received = False
        self.response_error = None
        self.response_done_event = asyncio.Event()

        if self.config.dump and t.request_id not in self.recorder_map:
            dump_path = os.path.join(
                self.config.dump_path,
                f"qwen_tts_realtime_{t.request_id}.pcm",
            )
            self.recorder_map[t.request_id] = PCMWriter(dump_path)

        try:
            if not t.text.strip():
                await self._complete_request(t.request_id, TTSAudioEndReason.REQUEST_END)
                return

            await self.client.start(self._build_session_payload())
            if self.client.last_connect_delay_ms > 0:
                await self.metrics_connect_delay(
                    self.client.last_connect_delay_ms,
                    request_id=t.request_id,
                )

            self.metrics_add_input_characters(len(t.text))
            await self.client.append_text(t.text)
            if t.text_input_end and self.config.commit_on_text_end:
                await self.client.commit_text()

            await asyncio.wait_for(
                self.response_done_event.wait(),
                timeout=self.config.request_timeout_seconds,
            )

            if self.response_error is not None:
                await self._finish_request_with_error(
                    t.request_id,
                    self.response_error,
                )
                return

            await self._complete_request(
                t.request_id, TTSAudioEndReason.REQUEST_END
            )
        except asyncio.CancelledError:
            raise
        except asyncio.TimeoutError:
            await self._finish_request_with_error(
                t.request_id,
                ModuleError(
                    message="Qwen realtime TTS timed out waiting for response.done",
                    module=ModuleType.TTS,
                    code=int(ModuleErrorCode.NON_FATAL_ERROR),
                    vendor_info=ModuleErrorVendorInfo(vendor=self.vendor()),
                ),
            )
        except Exception as exc:
            self.ten_env.log_error(
                f"[QWEN-TTS] request_tts failed: {traceback.format_exc()}"
            )
            await self._finish_request_with_error(
                t.request_id,
                ModuleError(
                    message=str(exc),
                    module=ModuleType.TTS,
                    code=int(ModuleErrorCode.NON_FATAL_ERROR),
                    vendor_info=ModuleErrorVendorInfo(vendor=self.vendor()),
                ),
            )

    async def cancel_tts(self) -> None:
        request_id = self.current_request_id
        if request_id is None:
            return

        try:
            if self.client:
                await self.client.clear_text()
                await self.client.stop()
        except Exception as exc:
            self.ten_env.log_warn(f"[QWEN-TTS] cancel transport failed: {exc}")

        if self.request_start_ts is not None:
            await self.send_tts_audio_end(
                request_id=request_id,
                request_event_interval_ms=int(
                    (datetime.now() - self.request_start_ts).total_seconds()
                    * 1000
                ),
                request_total_audio_duration_ms=self._calculate_audio_duration_ms(),
                reason=TTSAudioEndReason.INTERRUPTED,
            )

        recorder = self.recorder_map.pop(request_id, None)
        if recorder:
            try:
                await recorder.flush()
            except Exception:
                pass

        self.current_request_id = None
        self.request_start_ts = None
        self.total_audio_bytes = 0
        self.response_error = None
        self.response_done_event.set()

    async def _handle_server_event(self, payload: dict) -> None:
        message_type = str(payload.get("type", "") or "")

        if message_type in {"session.created", "session.updated"}:
            self.ten_env.log_info(
                f"vendor_status_changed: {message_type}",
                category=LOG_CATEGORY_VENDOR,
            )
            return

        if message_type == "response.audio.delta":
            await self._handle_audio_delta(payload)
            return

        if message_type == "response.done":
            self.response_done_event.set()
            return

        if message_type == "response.audio.done":
            self.ten_env.log_info(
                "[QWEN-TTS] event=response.audio.done",
                category=LOG_CATEGORY_VENDOR,
            )
            return

        if message_type in {"error", "client.error"}:
            error_info = payload.get("error", {})
            self.response_error = ModuleError(
                message=str(error_info.get("message", "unknown error")),
                module=ModuleType.TTS,
                code=int(ModuleErrorCode.NON_FATAL_ERROR),
                vendor_info=ModuleErrorVendorInfo(vendor=self.vendor()),
            )
            self.response_done_event.set()
            return

        if message_type in {
            "input_text_buffer.committed",
            "input_text_buffer.cleared",
            "session.finished",
        }:
            self.ten_env.log_info(
                f"[QWEN-TTS] event={message_type}",
                category=LOG_CATEGORY_VENDOR,
            )
            return

        self.ten_env.log_debug(f"[QWEN-TTS] ignored event: {payload}")

    async def _handle_audio_delta(self, payload: dict) -> None:
        request_id = self.current_request_id
        if request_id is None:
            return

        delta = str(payload.get("delta", "") or "")
        if not delta:
            return

        audio_bytes = base64.b64decode(delta)
        if not audio_bytes:
            return

        if not self.first_chunk_received:
            self.first_chunk_received = True
            await self.send_tts_audio_start(request_id=request_id)
            if self.request_start_ts is not None:
                await self.send_tts_ttfb_metrics(
                    request_id=request_id,
                    ttfb_ms=int(
                        (datetime.now() - self.request_start_ts).total_seconds()
                        * 1000
                    ),
                )

        self.total_audio_bytes += len(audio_bytes)
        self.metrics_add_recv_audio_chunks(audio_bytes)
        await self.send_tts_audio_data(audio_bytes)

        recorder = self.recorder_map.get(request_id)
        if recorder:
            await recorder.write(audio_bytes)

    async def _complete_request(
        self,
        request_id: str,
        reason: TTSAudioEndReason,
    ) -> None:
        interval_ms = 0
        if self.request_start_ts is not None:
            interval_ms = int(
                (datetime.now() - self.request_start_ts).total_seconds() * 1000
            )

        await self.send_tts_audio_end(
            request_id=request_id,
            request_event_interval_ms=interval_ms,
            request_total_audio_duration_ms=self._calculate_audio_duration_ms(),
            reason=reason,
        )
        await self.finish_request(request_id, reason=reason)

        recorder = self.recorder_map.pop(request_id, None)
        if recorder:
            try:
                await recorder.flush()
            except Exception:
                pass

        self.current_request_id = None
        self.request_start_ts = None
        self.total_audio_bytes = 0
        self.response_error = None

    async def _finish_request_with_error(
        self,
        request_id: str,
        error: ModuleError,
    ) -> None:
        interval_ms = 0
        if self.request_start_ts is not None:
            interval_ms = int(
                (datetime.now() - self.request_start_ts).total_seconds() * 1000
            )

        await self.send_tts_audio_end(
            request_id=request_id,
            request_event_interval_ms=interval_ms,
            request_total_audio_duration_ms=self._calculate_audio_duration_ms(),
            reason=TTSAudioEndReason.ERROR,
        )
        await self.finish_request(
            request_id,
            reason=TTSAudioEndReason.ERROR,
            error=error,
        )

        recorder = self.recorder_map.pop(request_id, None)
        if recorder:
            try:
                await recorder.flush()
            except Exception:
                pass

        self.current_request_id = None
        self.request_start_ts = None
        self.total_audio_bytes = 0
        self.response_error = None

    def _calculate_audio_duration_ms(self) -> int:
        sample_rate = self.synthesize_audio_sample_rate()
        if sample_rate <= 0:
            return 0
        bytes_per_sample = self.synthesize_audio_sample_width()
        channels = self.synthesize_audio_channels()
        duration_seconds = self.total_audio_bytes / (
            sample_rate * bytes_per_sample * channels
        )
        return int(duration_seconds * 1000)

    def _build_session_payload(self) -> dict:
        assert self.config is not None
        session = {
            "voice": self.config.voice,
            "mode": self.config.mode,
            "language_type": self.config.language_type,
            "response_format": self.config.response_format,
            "sample_rate": self.config.sample_rate,
            "speech_rate": self.config.speech_rate,
            "volume": self.config.volume,
            "pitch_rate": self.config.pitch_rate,
        }
        if self.config.response_format == "opus":
            session["bit_rate"] = self.config.bit_rate
        if self.config.instructions:
            session["instructions"] = self.config.instructions
            session["optimize_instructions"] = self.config.optimize_instructions
        return session
