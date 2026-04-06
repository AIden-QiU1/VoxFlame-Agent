from __future__ import annotations

import asyncio
import audioop
import base64
import json
import logging
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


def normalized_rms_energy(pcm_bytes: bytes) -> float:
    if not pcm_bytes:
        return 0.0
    return audioop.rms(pcm_bytes, 2) / 32768.0


def pcm_duration_ms(pcm_bytes: bytes, sample_rate: int) -> float:
    if not pcm_bytes or sample_rate <= 0:
        return 0.0
    samples = len(pcm_bytes) / 2
    return (samples * 1000.0) / sample_rate


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
    client: QwenRealtimeASRClient | None = None
    _stream_task: asyncio.Task[None] | None = None
    _started: bool = False
    _audio_frame_count: int = 0
    _logged_first_frame: bool = False
    _vad: RMSVoiceActivityDetector | None = None
    _received_voice_since_commit: bool = False
    _speech_ms_since_commit: float = 0.0
    _barge_in_triggered_since_commit: bool = False

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
        stream = rtc.AudioStream.from_participant(
            participant=self.participant,
            track_source=rtc.TrackSource.SOURCE_MICROPHONE,
        )
        self._stream_task = asyncio.create_task(self._consume_stream(stream))

    async def commit_audio(self, reason: str | None = None) -> None:
        if self.client is None or not self._started:
            return

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
                await self.client.append_audio(pcm_bytes)
                await self._observe_vad(pcm_bytes, current.sample_rate)

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
        chunk_duration_ms = pcm_duration_ms(pcm_bytes, sample_rate)

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
            return

        if self._vad.state is VADState.SPEAKING:
            self._received_voice_since_commit = True
            self._speech_ms_since_commit += chunk_duration_ms
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
            transcript = str(payload.get("transcript", "") or "").strip()
            if not transcript:
                transcript = str(payload.get("text", "") or "").strip()
            if not transcript:
                logger.warning(
                    "LiveKit ASR final transcript event had no text room=%s participant=%s payload=%s",
                    self.ctx.room_name,
                    self.ctx.participant_identity,
                    payload,
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
            return

        if message_type in {"error", "client.error"}:
            error_info = payload.get("error", {})
            error_message = str(error_info.get("message", "unknown error"))
            logger.warning("LiveKit ASR error room=%s error=%s", self.ctx.room_name, error_message)
            await self.publish_payload(build_error_output(error_message))
            return
