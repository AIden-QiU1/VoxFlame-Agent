from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

from typing_extensions import override

from ten_ai_base.asr import (
    ASRBufferConfig,
    ASRBufferConfigModeKeep,
    ASRResult,
    AsyncASRBaseExtension,
)
from ten_ai_base.const import LOG_CATEGORY_KEY_POINT, LOG_CATEGORY_VENDOR
from ten_ai_base.dumper import Dumper
from ten_ai_base.message import ModuleError, ModuleErrorCode
from ten_runtime import AsyncTenEnv, AudioFrame, Data

from .config import QwenRealtimeASRConfig
from .realtime_client import QwenRealtimeASRClient


MODULE_NAME_ASR = "qwen_asr_realtime"


class QwenRealtimeASRExtension(AsyncASRBaseExtension):
    def __init__(self, name: str):
        super().__init__(name)
        self.config: QwenRealtimeASRConfig | None = None
        self.client: QwenRealtimeASRClient | None = None
        self.audio_dumper: Dumper | None = None
        self._current_corpus_text = ""
        self._voice_profiles: dict[str, str] = {}
        self._last_interim_text = ""
        self._connect_metric_reported = False

    @override
    def vendor(self) -> str:
        return "qwen_realtime"

    @override
    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        await super().on_init(ten_env)

        config_json, _ = await ten_env.get_property_to_json("")
        try:
            self.config = QwenRealtimeASRConfig.model_validate_json(config_json)
            self.config.update_params()
            ten_env.log_info(
                f"[QWEN-ASR] config: {self.config.to_str()}",
                category=LOG_CATEGORY_KEY_POINT,
            )

            if self.config.dump:
                dump_path = Path(self.config.dump_path)
                if dump_path.suffix != ".pcm":
                    dump_path = dump_path / "qwen_asr_realtime_in.pcm"
                dump_path.parent.mkdir(parents=True, exist_ok=True)
                self.audio_dumper = Dumper(str(dump_path))
                await self.audio_dumper.start()

            self.client = QwenRealtimeASRClient(
                url=self.config.url,
                model=self.config.model,
                api_key=self.config.api_key,
                connect_timeout_seconds=self.config.connect_timeout_seconds,
                event_handler=self._handle_server_event,
                logger=ten_env,
            )
        except Exception as exc:
            ten_env.log_error(f"[QWEN-ASR] invalid config: {exc}")
            self.config = None
            await self.send_asr_error(
                ModuleError(
                    module=MODULE_NAME_ASR,
                    code=ModuleErrorCode.FATAL_ERROR.value,
                    message=str(exc),
                )
            )

    @override
    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        await super().on_deinit(ten_env)
        if self.audio_dumper:
            await self.audio_dumper.stop()
            self.audio_dumper = None

    @override
    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        ten_env.log_info("on_start")

        # Keep the provider connection lazy so text-only sessions do not hold
        # an idle realtime websocket that later times out server-side.
        self.audio_actual_send_metrics_task = asyncio.create_task(
            self._send_audio_actual_send_metrics_task()
        )

    @override
    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        if data.get_name() == "voice_profile":
            await self._handle_voice_profile(data)
            return
        await super().on_data(ten_env, data)

    @override
    async def on_audio_frame(
        self, ten_env: AsyncTenEnv, audio_frame: AudioFrame
    ) -> None:
        # Keep the vendor websocket lazy for text-only sessions, but make sure
        # the first real audio frame can actually reach send_audio(). The base
        # ASR extension buffers or discards frames while disconnected, and only
        # flushes the buffer when handling a later frame after connection.
        # Connecting before enqueueing the first frame avoids a silent
        # no-transcript path where finalize fires before any audio was sent.
        if not self.is_connected():
            await self.start_connection()
        await super().on_audio_frame(ten_env, audio_frame)

    @override
    async def start_connection(self) -> None:
        if self.client is None or self.config is None:
            return
        try:
            self._connect_metric_reported = False
            await self.client.start(self._build_session_payload())
        except Exception as exc:
            self.ten_env.log_error(f"[QWEN-ASR] start_connection failed: {exc}")
            await self.send_asr_error(
                ModuleError(
                    module=MODULE_NAME_ASR,
                    code=ModuleErrorCode.FATAL_ERROR.value,
                    message=str(exc),
                )
            )

    @override
    def is_connected(self) -> bool:
        return self.client is not None and self.client.is_ready()

    @override
    async def stop_connection(self) -> None:
        if self.client:
            await self.client.finish_session()

    @override
    def input_audio_sample_rate(self) -> int:
        assert self.config is not None
        return self.config.sample_rate

    @override
    def buffer_strategy(self) -> ASRBufferConfig:
        return ASRBufferConfigModeKeep(
            byte_limit=self.input_audio_sample_rate() * 2 * 5
        )

    @override
    async def send_audio(
        self, frame: AudioFrame, session_id: str | None
    ) -> bool:
        if self.client is None or self.config is None:
            return False

        try:
            if session_id:
                await self._apply_profile_for_session(session_id)

            frame_buf = frame.lock_buf()
            try:
                audio_bytes = bytes(frame_buf)
            finally:
                frame.unlock_buf(frame_buf)

            if self.audio_dumper:
                await self.audio_dumper.push_bytes(audio_bytes)

            self.audio_timeline.add_user_audio(
                int(len(audio_bytes) / (self.input_audio_sample_rate() / 1000 * 2))
            )

            await self.client.append_audio(audio_bytes)
            return True
        except Exception as exc:
            self.ten_env.log_error(f"[QWEN-ASR] failed to send audio: {exc}")
            return False

    @override
    async def finalize(self, session_id: str | None) -> None:
        if not self.is_connected() or self.client is None:
            return

        self.last_finalize_timestamp = int(time.time() * 1000)
        self.ten_env.log_info(
            f"[QWEN-ASR] finalize requested, session_id={session_id}",
            category=LOG_CATEGORY_KEY_POINT,
        )
        await self.client.commit_audio()

    async def _handle_server_event(self, payload: dict[str, Any]) -> None:
        message_type = str(payload.get("type", "") or "")

        if message_type in {"session.created", "session.updated"}:
            self.ten_env.log_info(
                f"vendor_status_changed: {message_type}",
                category=LOG_CATEGORY_VENDOR,
            )
            if (
                self.client is not None
                and self.client.last_connect_delay_ms > 0
                and not self._connect_metric_reported
            ):
                self._connect_metric_reported = True
                await self.send_connect_delay_metrics(
                    self.client.last_connect_delay_ms
                )
            return

        if message_type == "conversation.item.input_audio_transcription.text":
            if not self.config or not self.config.enable_interim:
                return

            text = str(payload.get("text", "") or "").strip()
            if not text or text == self._last_interim_text:
                return

            self._last_interim_text = text
            await self.send_asr_result(
                ASRResult(
                    text=text,
                    final=False,
                    start_ms=0,
                    duration_ms=0,
                    language=self.config.get_language(),
                    words=[],
                )
            )
            return

        if message_type == "conversation.item.input_audio_transcription.completed":
            transcript = str(payload.get("transcript", "") or "").strip()
            if not transcript:
                transcript = str(payload.get("text", "") or "").strip()
            if not transcript or not self.config:
                return

            if self.last_finalize_timestamp != 0:
                latency = int(time.time() * 1000) - self.last_finalize_timestamp
                self.ten_env.log_info(
                    f"[QWEN-ASR] finalize completed in {latency}ms",
                    category=LOG_CATEGORY_KEY_POINT,
                )
                self.last_finalize_timestamp = 0
                await self.send_asr_finalize_end()

            self._last_interim_text = ""
            await self.send_asr_result(
                ASRResult(
                    text=transcript,
                    final=True,
                    start_ms=0,
                    duration_ms=0,
                    language=self.config.get_language(),
                    words=[],
                )
            )
            return

        if message_type == "input_audio_buffer.committed":
            self.ten_env.log_info(
                "[QWEN-ASR] input_audio_buffer committed",
                category=LOG_CATEGORY_VENDOR,
            )
            return

        if message_type in {"error", "client.error"}:
            error_info = payload.get("error", {})
            error_message = str(error_info.get("message", "unknown error"))
            if "Response timeout" in error_message:
                if self.client is not None:
                    self.client.invalidate()
                self.ten_env.log_warn(
                    "[QWEN-ASR] vendor timeout after idle period; "
                    "the client will reconnect on the next audio frame"
                )
                return
            self.ten_env.log_error(f"[QWEN-ASR] vendor_error: {error_message}")
            await self.send_asr_error(
                ModuleError(
                    module=MODULE_NAME_ASR,
                    code=ModuleErrorCode.NON_FATAL_ERROR.value,
                    message=error_message,
                )
            )
            return

        if message_type == "session.finished":
            self.ten_env.log_info(
                "vendor_status_changed: session.finished",
                category=LOG_CATEGORY_VENDOR,
            )
            return

        self.ten_env.log_debug(
            f"[QWEN-ASR] ignored event: {json.dumps(payload, ensure_ascii=False)}"
        )

    async def _handle_voice_profile(self, data: Data) -> None:
        if self.config is None:
            return

        try:
            data_json, _ = data.get_property_to_json(None)
            payload = json.loads(data_json) if data_json else {}
        except Exception as exc:
            self.ten_env.log_warn(f"[QWEN-ASR] invalid voice_profile payload: {exc}")
            return

        client_id = str(payload.get("client_id", "") or "").strip()
        hotwords_raw = payload.get("hotwords", [])
        hotwords: list[str] = []
        if isinstance(hotwords_raw, list):
            for item in hotwords_raw:
                if isinstance(item, str) and item.strip():
                    hotwords.append(item.strip())
                elif isinstance(item, dict):
                    word = str(item.get("word", "") or "").strip()
                    if word:
                        hotwords.append(word)

        corpus_text = self._build_corpus_text(hotwords)
        if client_id:
            self._voice_profiles[client_id] = corpus_text

        if not client_id or client_id == self.session_id or not self.session_id:
            self._current_corpus_text = corpus_text
            if (
                corpus_text
                and self.config.auto_update_session_on_profile
                and self.client is not None
                and self.client.is_ready()
            ):
                await self.client.update_session(self._build_session_payload())
                self.ten_env.log_info(
                    f"[QWEN-ASR] session corpus updated, hotwords={len(hotwords)}"
                )

    async def _apply_profile_for_session(self, session_id: str) -> None:
        if not session_id:
            return
        corpus_text = self._voice_profiles.get(session_id, "")
        if corpus_text == self._current_corpus_text:
            return

        self._current_corpus_text = corpus_text
        if (
            self.config
            and self.config.auto_update_session_on_profile
            and self.client is not None
            and self.client.is_ready()
        ):
            await self.client.update_session(self._build_session_payload())
            self.ten_env.log_info(
                f"[QWEN-ASR] applied profile for session_id={session_id}"
            )

    def _build_corpus_text(self, hotwords: list[str]) -> str:
        if self.config is None:
            return ""

        seen: set[str] = set()
        terms: list[str] = []
        for item in hotwords:
            normalized = item.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            terms.append(normalized)
            if len(terms) >= self.config.hotword_limit:
                break

        corpus_text = "，".join(terms)
        if len(corpus_text) > self.config.corpus_limit_chars:
            corpus_text = corpus_text[: self.config.corpus_limit_chars]
        return corpus_text

    def _build_session_payload(self) -> dict[str, Any]:
        assert self.config is not None

        transcription: dict[str, Any] = {
            "language": self.config.get_language(),
        }
        if self._current_corpus_text:
            transcription["corpus"] = {"text": self._current_corpus_text}
        if self.config.prompt:
            transcription["prompt"] = self.config.prompt

        turn_detection: dict[str, Any] | None = None
        if self.config.turn_detection == "server_vad":
            turn_detection = {"type": "server_vad"}

        return {
            "modalities": ["text"],
            "input_audio_format": "pcm",
            "sample_rate": self.config.sample_rate,
            "input_audio_transcription": transcription,
            "turn_detection": turn_detection,
        }
