from __future__ import annotations

import asyncio
import audioop
import base64
import json
import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import Enum, auto
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from config import LiveKitAgentConfig
from session_context import VoxFlameSessionContext

logger = logging.getLogger("voxflame-livekit-agent.asr")

ServerEventHandler = Callable[[dict[str, Any]], Awaitable[None]]
PublishPayload = Callable[[dict[str, Any]], Awaitable[None]]
FinalTranscriptHandler = Callable[[str], Awaitable[None]]
SpeechActivityHandler = Callable[[str, bool], Awaitable[None]]
AudioTelemetryHandler = Callable[[float, float, bool, bool, str], Awaitable[None]]
TRANSCRIPT_EDGE_PUNCTUATION_PATTERN = re.compile(
    r"^[\s，。！？!?；;：:、,.…~～-]+|[\s，。！？!?；;：:、,.…~～-]+$"
)
MANUAL_STOP_SHORT_TRANSCRIPT_GRACE_SECONDS = 2.0
SHORT_UTTERANCE_EXTRA_FINALIZE_GRACE_SECONDS = 1.1


class VADState(Enum):
    IDLE = auto()
    SPEAKING = auto()


def with_model_query(url: str, model: str) -> str:
    if not model:
        return url

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if query.get("model"):
        return url

    query["model"] = model
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )


def build_asr_session_payload(config: LiveKitAgentConfig) -> dict[str, Any]:
    return {
        "modalities": ["text"],
        "input_audio_format": "pcm",
        "sample_rate": config.dashscope_asr_sample_rate,
        "input_audio_transcription": {
            "language": config.dashscope_asr_language,
        },
        "turn_detection": None,
    }


def frame_to_pcm_bytes(frame: Any) -> bytes:
    data = frame.data.tobytes() if hasattr(frame.data, "tobytes") else bytes(frame.data)
    if getattr(frame, "num_channels", 1) > 1:
        return audioop.tomono(data, 2, 0.5, 0.5)
    return data


def pcm_bytes_to_audio_frame(
    pcm_bytes: bytes,
    *,
    sample_rate: int,
    num_channels: int = 1,
) -> Any:
    from livekit import rtc

    samples_per_channel = len(pcm_bytes) // 2 // num_channels
    if samples_per_channel <= 0:
        raise ValueError("PCM payload is empty")
    return rtc.AudioFrame(
        pcm_bytes,
        sample_rate=sample_rate,
        num_channels=num_channels,
        samples_per_channel=samples_per_channel,
    )


def normalized_rms_energy(pcm_bytes: bytes) -> float:
    if not pcm_bytes:
        return 0.0
    return audioop.rms(pcm_bytes, 2) / 32768.0


def pcm_duration_ms(pcm_bytes: bytes, sample_rate: int) -> float:
    if not pcm_bytes or sample_rate <= 0:
        return 0.0
    samples = len(pcm_bytes) / 2
    return (samples * 1000.0) / sample_rate


def normalized_peak_level(pcm_bytes: bytes) -> float:
    if not pcm_bytes:
        return 0.0
    return audioop.max(pcm_bytes, 2) / 32768.0


def semantic_transcript_length(text: str) -> int:
    return len(TRANSCRIPT_EDGE_PUNCTUATION_PATTERN.sub("", text.strip()))


def build_livekit_audio_apm_options(config: LiveKitAgentConfig) -> dict[str, bool]:
    return {
        "echo_cancellation": config.livekit_audio_apm_echo_cancellation,
        "noise_suppression": config.livekit_audio_apm_noise_suppression,
        "high_pass_filter": config.livekit_audio_apm_high_pass_filter,
        "auto_gain_control": config.livekit_audio_apm_auto_gain_control,
    }


def should_enable_livekit_audio_apm(config: LiveKitAgentConfig) -> bool:
    return config.livekit_audio_apm_enabled and any(build_livekit_audio_apm_options(config).values())


@dataclass
class RMSVoiceActivityDetector:
    threshold: float
    silence_duration_ms: int
    state: VADState = VADState.IDLE
    silence_ms: float = 0.0

    def observe(self, pcm_bytes: bytes, sample_rate: int) -> tuple[bool, bool, float]:
        energy = normalized_rms_energy(pcm_bytes)
        is_speech = energy >= self.threshold
        speech_started = False
        speech_stopped = False

        if is_speech:
            if self.state is VADState.IDLE:
                speech_started = True
            self.state = VADState.SPEAKING
            self.silence_ms = 0.0
            return speech_started, speech_stopped, energy

        if self.state is VADState.SPEAKING:
            self.silence_ms += pcm_duration_ms(pcm_bytes, sample_rate)
            if self.silence_ms >= self.silence_duration_ms:
                self.state = VADState.IDLE
                self.silence_ms = 0.0
                speech_stopped = True

        return speech_started, speech_stopped, energy


@dataclass
class QwenRealtimeASRClient:
    url: str
    model: str
    api_key: str
    connect_timeout_seconds: int
    event_handler: ServerEventHandler

    websocket: Any = None
    receive_task: asyncio.Task[None] | None = None
    ready_event: asyncio.Event = asyncio.Event()
    _connect_lock: asyncio.Lock = asyncio.Lock()
    _send_lock: asyncio.Lock = asyncio.Lock()
    _session_payload: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        self.url = with_model_query(self.url, self.model)
        self.ready_event = asyncio.Event()
        self._connect_lock = asyncio.Lock()
        self._send_lock = asyncio.Lock()

    def is_ready(self) -> bool:
        return self.websocket is not None and self.ready_event.is_set()

    async def start(self, session_payload: dict[str, Any]) -> None:
        self._session_payload = session_payload
        await self._connect()

    async def append_audio(self, pcm_bytes: bytes) -> None:
        await self._ensure_ready()
        await self._send_json(
            {
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm_bytes).decode("utf-8"),
            }
        )

    async def commit_audio(self) -> None:
        await self._ensure_ready()
        await self._send_json({"type": "input_audio_buffer.commit"})

    async def stop(self) -> None:
        async with self._connect_lock:
            await self._close_current_socket()

    async def _ensure_ready(self) -> None:
        if self.is_ready():
            return
        await self._connect()

    async def _connect(self) -> None:
        if not self._session_payload:
            raise RuntimeError("Qwen realtime ASR session payload is missing")

        async with self._connect_lock:
            if self.is_ready():
                return

            await self._close_current_socket()
            self.ready_event.clear()

            import websockets

            self.websocket = await websockets.connect(
                self.url,
                additional_headers=[("Authorization", f"Bearer {self.api_key}")],
                max_size=16 * 1024 * 1024,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=5,
                open_timeout=self.connect_timeout_seconds,
            )
            self.receive_task = asyncio.create_task(self._receive_loop())
            await self._send_json({"type": "session.update", "session": self._session_payload})
            await asyncio.wait_for(self.ready_event.wait(), timeout=self.connect_timeout_seconds)

    async def _close_current_socket(self) -> None:
        receive_task = self.receive_task
        self.receive_task = None
        websocket = self.websocket
        self.websocket = None
        self.ready_event.clear()

        if receive_task:
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        if websocket:
            try:
                await websocket.close()
            except Exception:
                pass

    async def _send_json(self, payload: dict[str, Any]) -> None:
        if self.websocket is None:
            raise RuntimeError("Qwen realtime ASR websocket is not connected")

        async with self._send_lock:
            payload_to_send = dict(payload)
            payload_to_send.setdefault("event_id", f"event_{uuid.uuid4().hex}")
            await self.websocket.send(json.dumps(payload_to_send, ensure_ascii=False))

    async def _receive_loop(self) -> None:
        websocket = self.websocket
        if websocket is None:
            return

        try:
            async for raw_message in websocket:
                if isinstance(raw_message, bytes):
                    continue

                payload = json.loads(raw_message)
                message_type = str(payload.get("type", "") or "")
                if message_type in {"session.created", "session.updated"}:
                    self.ready_event.set()
                elif message_type == "session.finished":
                    self.ready_event.clear()

                await self.event_handler(payload)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self.event_handler(
                {
                    "type": "client.error",
                    "error": {"message": str(exc)},
                }
            )
        finally:
            if websocket is self.websocket:
                self.ready_event.clear()
                self.websocket = None


@dataclass
class LiveKitASRRuntime:
    config: LiveKitAgentConfig
    ctx: VoxFlameSessionContext
    participant: Any
    publish_payload: PublishPayload
    on_final_transcript: FinalTranscriptHandler
    on_speech_activity: SpeechActivityHandler | None = None
    on_audio_telemetry: AudioTelemetryHandler | None = None
    client: QwenRealtimeASRClient | None = None
    _stream_task: asyncio.Task[None] | None = None
    _started: bool = False
    _audio_frame_count: int = 0
    _logged_first_frame: bool = False
    _vad: RMSVoiceActivityDetector | None = None
    _audio_apm: Any | None = None
    _received_voice_since_commit: bool = False
    _speech_ms_since_commit: float = 0.0
    _barge_in_triggered_since_commit: bool = False
    _level_sum_since_commit: float = 0.0
    _level_count_since_commit: int = 0
    _peak_level_since_commit: float = 0.0
    _clipping_detected_since_commit: bool = False
    _clipping_reported_since_commit: bool = False
    _apm_remainder: bytes = b""
    _ignore_short_transcripts_until: float = 0.0
    _client_recording_active: bool = False
    _client_capture_tracking_enabled: bool = False
    _client_capture_id: int = 0
    _last_committed_client_capture_id: int | None = None
    _suppress_vad_auto_finalize_until: float = 0.0
    _short_utterance_capture_expected: bool = False

    async def start(self) -> None:
        if self._stream_task is not None:
            return

        from livekit import rtc

        if not self.config.dashscope_api_key:
            logger.warning("DashScope ASR is disabled because DASHSCOPE_API_KEY is missing")
            return

        if self.client is None:
            self.client = QwenRealtimeASRClient(
                url=self.config.dashscope_asr_url,
                model=self.config.dashscope_asr_model,
                api_key=self.config.dashscope_api_key,
                connect_timeout_seconds=self.config.dashscope_asr_connect_timeout_seconds,
                event_handler=self._handle_server_event,
            )

        logger.info(
            "LiveKit ASR runtime starting room=%s participant=%s model=%s sample_rate=%s interim=%s vad_threshold=%s vad_silence_ms=%s barge_in_min_speech_ms=%s",
            self.ctx.room_name,
            self.ctx.participant_identity,
            self.config.dashscope_asr_model,
            self.config.dashscope_asr_sample_rate,
            self.config.dashscope_asr_enable_interim,
            self.config.dashscope_asr_vad_threshold,
            self.config.dashscope_asr_vad_silence_duration_ms,
            self.config.dashscope_asr_barge_in_min_speech_ms,
        )
        self._vad = RMSVoiceActivityDetector(
            threshold=self.config.dashscope_asr_vad_threshold,
            silence_duration_ms=self.config.dashscope_asr_vad_silence_duration_ms,
        )
        self._audio_apm = self._create_audio_apm()
        stream = rtc.AudioStream.from_participant(
            participant=self.participant,
            track_source=rtc.TrackSource.SOURCE_MICROPHONE,
        )
        self._stream_task = asyncio.create_task(self._consume_stream(stream))

    def note_client_recording_event(
        self,
        state: str,
        auto_finalize: bool,
        *,
        short_utterance_expected: bool = False,
    ) -> None:
        normalized_state = state.strip()
        if not normalized_state:
            return

        if normalized_state == "speech_started":
            self._client_recording_active = True
            self._client_capture_tracking_enabled = True
            self._client_capture_id += 1
            self._last_committed_client_capture_id = None
            self._suppress_vad_auto_finalize_until = 0.0
            self._short_utterance_capture_expected = short_utterance_expected
            return

        if normalized_state == "speech_stopped":
            self._client_recording_active = False
            if auto_finalize:
                suppression_seconds = self.config.dashscope_asr_vad_silence_duration_ms / 1000.0
                if self._short_utterance_capture_expected:
                    suppression_seconds = max(
                        suppression_seconds,
                        SHORT_UTTERANCE_EXTRA_FINALIZE_GRACE_SECONDS,
                    )
                self._suppress_vad_auto_finalize_until = time.monotonic() + (
                    suppression_seconds
                )

    def _is_duplicate_client_capture_commit(self) -> bool:
        return (
            self._client_capture_tracking_enabled
            and self._client_capture_id > 0
            and self._last_committed_client_capture_id == self._client_capture_id
        )

    async def commit_audio(self, reason: str | None = None) -> None:
        if self.client is None or not self._started:
            return

        if self._is_duplicate_client_capture_commit():
            logger.info(
                "LiveKit ASR duplicate commit ignored room=%s participant=%s reason=%s capture_id=%s",
                self.ctx.room_name,
                self.ctx.participant_identity,
                reason or "unknown",
                self._client_capture_id,
            )
            return

        self._ignore_short_transcripts_until = 0.0
        if reason == "manual_stop" and not self._short_utterance_capture_expected:
            self._ignore_short_transcripts_until = (
                time.monotonic() + MANUAL_STOP_SHORT_TRANSCRIPT_GRACE_SECONDS
            )
        await self._emit_audio_telemetry(reason or "unknown")

        logger.info(
            "LiveKit ASR commit requested room=%s participant=%s reason=%s",
            self.ctx.room_name,
            self.ctx.participant_identity,
            reason or "unknown",
        )
        await self.client.commit_audio()
        self._received_voice_since_commit = False
        self._speech_ms_since_commit = 0.0
        self._barge_in_triggered_since_commit = False
        self._level_sum_since_commit = 0.0
        self._level_count_since_commit = 0
        self._peak_level_since_commit = 0.0
        self._clipping_detected_since_commit = False
        self._clipping_reported_since_commit = False
        self._apm_remainder = b""
        if self._client_capture_tracking_enabled and self._client_capture_id > 0:
            self._last_committed_client_capture_id = self._client_capture_id

    async def stop(self) -> None:
        logger.info(
            "LiveKit ASR runtime stopping room=%s participant=%s started=%s frames=%s",
            self.ctx.room_name,
            self.ctx.participant_identity,
            self._started,
            self._audio_frame_count,
        )
        if self._stream_task:
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass
            self._stream_task = None

        if self.client is not None:
            await self.client.stop()

    def _create_audio_apm(self) -> Any | None:
        if not should_enable_livekit_audio_apm(self.config):
            logger.info(
                "LiveKit audio APM disabled room=%s participant=%s",
                self.ctx.room_name,
                self.ctx.participant_identity,
            )
            return None

        from livekit import rtc

        options = build_livekit_audio_apm_options(self.config)
        logger.info(
            "LiveKit audio APM enabled room=%s participant=%s options=%s",
            self.ctx.room_name,
            self.ctx.participant_identity,
            options,
        )
        try:
            return rtc.AudioProcessingModule(**options)
        except Exception as exc:
            logger.warning(
                "LiveKit audio APM unavailable room=%s participant=%s error=%s",
                self.ctx.room_name,
                self.ctx.participant_identity,
                exc,
            )
            return None

    async def _consume_stream(self, stream: Any) -> None:
        from livekit import rtc

        resampler: rtc.AudioResampler | None = None
        async for audio_event in stream:
            frame = audio_event.frame
            self._audio_frame_count += 1
            if not self._logged_first_frame:
                self._logged_first_frame = True
                logger.info(
                    "LiveKit ASR first audio frame room=%s participant=%s sample_rate=%s channels=%s samples_per_channel=%s",
                    self.ctx.room_name,
                    self.ctx.participant_identity,
                    frame.sample_rate,
                    getattr(frame, "num_channels", 1),
                    getattr(frame, "samples_per_channel", "unknown"),
                )
            if not self._started:
                await self._ensure_started()

            frames = [frame]
            if frame.sample_rate != self.config.dashscope_asr_sample_rate:
                if resampler is None:
                    resampler = rtc.AudioResampler(
                        input_rate=frame.sample_rate,
                        output_rate=self.config.dashscope_asr_sample_rate,
                    )
                frames = list(resampler.push(frame))

            for current in frames:
                pcm_bytes = frame_to_pcm_bytes(current)
                pcm_bytes = self._apply_audio_apm(pcm_bytes, current.sample_rate)
                if not pcm_bytes:
                    continue
                await self.client.append_audio(pcm_bytes)
                await self._observe_vad(pcm_bytes, current.sample_rate)

    def _apply_audio_apm(self, pcm_bytes: bytes, sample_rate: int) -> bytes:
        if self._audio_apm is None or not pcm_bytes:
            return pcm_bytes

        samples_per_10ms = sample_rate // 100
        if samples_per_10ms <= 0:
            return pcm_bytes

        chunk_size = samples_per_10ms * 2
        buffered = self._apm_remainder + pcm_bytes
        processed_chunks: list[bytes] = []

        while len(buffered) >= chunk_size:
            chunk = buffered[:chunk_size]
            buffered = buffered[chunk_size:]
            try:
                frame = pcm_bytes_to_audio_frame(
                    chunk,
                    sample_rate=sample_rate,
                    num_channels=1,
                )
                processed = self._audio_apm.process_stream(frame)
                processed_frame = processed if processed is not None else frame
                processed_chunks.append(frame_to_pcm_bytes(processed_frame))
            except Exception as exc:
                logger.warning(
                    "LiveKit audio APM process_stream failed room=%s participant=%s error=%s",
                    self.ctx.room_name,
                    self.ctx.participant_identity,
                    exc,
                )
                self._audio_apm = None
                self._apm_remainder = b""
                return pcm_bytes

        self._apm_remainder = buffered
        if not processed_chunks:
            return b""
        return b"".join(processed_chunks)

    async def _ensure_started(self) -> None:
        if self._started:
            return
        if self.client is None:
            raise RuntimeError("LiveKit ASR client is not initialized")
        logger.info(
            "LiveKit ASR opening realtime session room=%s participant=%s url=%s model=%s",
            self.ctx.room_name,
            self.ctx.participant_identity,
            self.client.url,
            self.config.dashscope_asr_model,
        )
        await self.client.start(build_asr_session_payload(self.config))
        self._started = True
        logger.info(
            "LiveKit ASR realtime session ready room=%s participant=%s",
            self.ctx.room_name,
            self.ctx.participant_identity,
        )

    async def _observe_vad(self, pcm_bytes: bytes, sample_rate: int) -> None:
        if self._vad is None:
            return

        speech_started, speech_stopped, energy = self._vad.observe(pcm_bytes, sample_rate)
        peak_level = normalized_peak_level(pcm_bytes)
        chunk_duration_ms = pcm_duration_ms(pcm_bytes, sample_rate)
        self._level_sum_since_commit += energy
        self._level_count_since_commit += 1
        self._peak_level_since_commit = max(self._peak_level_since_commit, peak_level)
        clipping_detected = peak_level >= 0.98
        self._clipping_detected_since_commit = self._clipping_detected_since_commit or clipping_detected

        if speech_started:
            self._received_voice_since_commit = True
            self._speech_ms_since_commit = chunk_duration_ms
            self._barge_in_triggered_since_commit = False
            logger.info(
                "LiveKit VAD speech_started room=%s participant=%s energy=%.4f threshold=%.4f",
                self.ctx.room_name,
                self.ctx.participant_identity,
                energy,
                self.config.dashscope_asr_vad_threshold,
            )
            if self.on_speech_activity is not None:
                await self.on_speech_activity("speech_started", False)
            await self._emit_audio_telemetry("speech_started")
            return

        if self._vad.state is VADState.SPEAKING:
            self._received_voice_since_commit = True
            self._speech_ms_since_commit += chunk_duration_ms
            if clipping_detected and not self._clipping_reported_since_commit:
                self._clipping_reported_since_commit = True
                await self._emit_audio_telemetry("clipping_detected")
            if (
                not self._barge_in_triggered_since_commit
                and self._speech_ms_since_commit >= self.config.dashscope_asr_barge_in_min_speech_ms
            ):
                self._barge_in_triggered_since_commit = True
                logger.info(
                    "LiveKit barge-in triggered room=%s participant=%s speech_ms=%s threshold_ms=%s",
                    self.ctx.room_name,
                    self.ctx.participant_identity,
                    round(self._speech_ms_since_commit),
                    self.config.dashscope_asr_barge_in_min_speech_ms,
                )
                if self.on_speech_activity is not None:
                    await self.on_speech_activity("barge_in_triggered", False)

        if speech_stopped and self._received_voice_since_commit:
            if (
                not self._client_recording_active
                and time.monotonic() < self._suppress_vad_auto_finalize_until
            ):
                logger.info(
                    "LiveKit ASR auto finalize suppressed after client stop room=%s participant=%s speech_ms=%s",
                    self.ctx.room_name,
                    self.ctx.participant_identity,
                    round(self._speech_ms_since_commit),
                )
                self._received_voice_since_commit = False
                self._speech_ms_since_commit = 0.0
                self._barge_in_triggered_since_commit = False
                return
            await self._emit_audio_telemetry("speech_stopped")
            logger.info(
                "LiveKit VAD speech_stopped room=%s participant=%s silence_ms=%s speech_ms=%s -> auto_finalize",
                self.ctx.room_name,
                self.ctx.participant_identity,
                self.config.dashscope_asr_vad_silence_duration_ms,
                round(self._speech_ms_since_commit),
            )
            if self.on_speech_activity is not None:
                await self.on_speech_activity("speech_stopped", True)
            await self.commit_audio("vad_auto_finalize")

    async def _emit_audio_telemetry(self, reason: str) -> None:
        if self.on_audio_telemetry is None or self._level_count_since_commit <= 0:
            return

        normalized_level = self._level_sum_since_commit / self._level_count_since_commit
        await self.on_audio_telemetry(
            normalized_level,
            self._peak_level_since_commit,
            self._clipping_detected_since_commit,
            self._audio_apm is not None,
            reason,
        )

    async def _handle_server_event(self, payload: dict[str, Any]) -> None:
        from data_contract import build_error_output, build_user_transcript_output

        message_type = str(payload.get("type", "") or "")

        if message_type in {"session.created", "session.updated"}:
            logger.info(
                "LiveKit ASR session event room=%s participant=%s type=%s",
                self.ctx.room_name,
                self.ctx.participant_identity,
                message_type,
            )
            return

        if message_type == "input_audio_buffer.committed":
            logger.info(
                "LiveKit ASR audio buffer committed room=%s participant=%s",
                self.ctx.room_name,
                self.ctx.participant_identity,
            )
            return

        if message_type == "conversation.item.input_audio_transcription.text":
            if not self.config.dashscope_asr_enable_interim:
                return

            text = str(payload.get("text", "") or "").strip()
            if not text:
                return

            logger.info(
                "LiveKit ASR interim transcript room=%s participant=%s chars=%s preview=%s",
                self.ctx.room_name,
                self.ctx.participant_identity,
                len(text),
                text[:80],
            )

            await self.publish_payload(
                build_user_transcript_output(
                    self.ctx,
                    text,
                    is_final=False,
                    source="dashscope_realtime_asr",
                )
            )
            return

        if message_type == "conversation.item.input_audio_transcription.completed":
            ignore_short_transcript = time.monotonic() <= self._ignore_short_transcripts_until
            transcript = str(payload.get("transcript", "") or "").strip()
            if not transcript:
                transcript = str(payload.get("text", "") or "").strip()
            if not transcript:
                if ignore_short_transcript:
                    self._ignore_short_transcripts_until = 0.0
                logger.warning(
                    "LiveKit ASR final transcript event had no text room=%s participant=%s payload=%s",
                    self.ctx.room_name,
                    self.ctx.participant_identity,
                    payload,
                )
                return

            if ignore_short_transcript:
                self._ignore_short_transcripts_until = 0.0
                if (
                    semantic_transcript_length(transcript) <= 2
                    and not self._short_utterance_capture_expected
                ):
                    logger.info(
                        "LiveKit ASR ignored short manual_stop tail room=%s participant=%s chars=%s transcript=%s",
                        self.ctx.room_name,
                        self.ctx.participant_identity,
                        len(transcript),
                        transcript,
                    )
                    return

            logger.info(
                "LiveKit ASR final transcript room=%s participant=%s chars=%s transcript=%s",
                self.ctx.room_name,
                self.ctx.participant_identity,
                len(transcript),
                transcript,
            )

            await self.publish_payload(
                build_user_transcript_output(
                    self.ctx,
                    transcript,
                    is_final=True,
                    source="dashscope_realtime_asr",
                )
            )
            await self.on_final_transcript(transcript)
            self._short_utterance_capture_expected = False
            return

        if message_type in {"error", "client.error"}:
            error_info = payload.get("error", {})
            error_message = str(error_info.get("message", "unknown error"))
            logger.warning("LiveKit ASR error room=%s error=%s", self.ctx.room_name, error_message)
            await self.publish_payload(build_error_output(error_message))
            return
