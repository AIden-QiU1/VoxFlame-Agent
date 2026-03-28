import asyncio
import json
import os
from dataclasses import dataclass, field
from enum import Enum, auto

import numpy as np
from ten_runtime import (
    AsyncExtension,
    AsyncTenEnv,
    AudioFrame,
    AudioFrameDataFmt,
    Cmd,
    CmdResult,
    Data,
    StatusCode,
)

from .config import VoxFlameVADConfig


BYTES_PER_SAMPLE = 2
SAMPLE_RATE = 16000
DEFAULT_CLIENT_ID = "default"


class VADState(Enum):
    IDLE = auto()
    SPEAKING = auto()


@dataclass
class StreamState:
    audio_buffer: bytearray = field(default_factory=bytearray)
    probe_window: list[float] = field(default_factory=list)
    state: VADState = VADState.IDLE


class VoxFlameVADPythonExtension(AsyncExtension):
    """Multi-client VAD passthrough for the RTC audio pipeline."""

    def __init__(self, name: str):
        super().__init__(name)
        self.name = name
        self.config: VoxFlameVADConfig | None = None
        self.hop_size: int = 0
        self.window_size: int = 0
        self.prefix_window_size: int = 0
        self.silence_window_size: int = 0
        self.stream_states: dict[str, StreamState] = {}

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        config_json, _ = await ten_env.get_property_to_json("")
        self.config = VoxFlameVADConfig.model_validate_json(config_json)

        self.hop_size = self.config.hop_size_ms * SAMPLE_RATE // 1000
        self.silence_window_size = (
            self.config.silence_duration_ms // self.config.hop_size_ms
        )
        self.prefix_window_size = (
            self.config.prefix_padding_ms // self.config.hop_size_ms
        )
        self.window_size = max(
            self.silence_window_size,
            self.prefix_window_size,
        )

        ten_env.log_info(
            "[VoxFlameVAD] Initialized with "
            f"hop_size={self.hop_size}, prefix_window={self.prefix_window_size}, "
            f"silence_window={self.silence_window_size}, threshold={self.config.vad_threshold}"
        )

    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        ten_env.log_info("[VoxFlameVAD] Started")

    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        ten_env.log_info("[VoxFlameVAD] Stopping")
        self.stream_states.clear()

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        ten_env.log_info("[VoxFlameVAD] Deinitialized")

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        if cmd.get_name() == "flush":
            self.stream_states.clear()
            ten_env.log_info("[VoxFlameVAD] Flushed all client VAD states")

        await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

    async def on_data(self, _ten_env: AsyncTenEnv, _data: Data) -> None:
        return

    async def on_audio_frame(
        self,
        ten_env: AsyncTenEnv,
        audio_frame: AudioFrame,
    ) -> None:
        metadata = self._read_metadata(audio_frame)
        client_id = self._extract_client_id(metadata)
        state = self._get_or_create_stream_state(client_id)

        frame_buf = audio_frame.get_buf()
        self._dump_audio_if_needed(frame_buf, client_id, "in")

        await self._forward_audio_frame(ten_env, frame_buf, metadata)

        state.audio_buffer.extend(frame_buf)
        chunk_size = self.hop_size * BYTES_PER_SAMPLE
        while len(state.audio_buffer) >= chunk_size:
            audio_buf = state.audio_buffer[:chunk_size]
            del state.audio_buffer[:chunk_size]

            probe = self._compute_probe(audio_buf)
            state.probe_window.append(probe)
            if len(state.probe_window) > self.window_size:
                state.probe_window.pop(0)

            await self._check_state_transition(
                ten_env,
                client_id,
                state,
                metadata,
            )

    def _get_or_create_stream_state(self, client_id: str) -> StreamState:
        stream_state = self.stream_states.get(client_id)
        if stream_state is None:
            stream_state = StreamState()
            self.stream_states[client_id] = stream_state
        return stream_state

    def _extract_client_id(self, metadata: dict[str, object]) -> str:
        raw_client_id = metadata.get("client_id")
        if isinstance(raw_client_id, str) and raw_client_id.strip():
            return raw_client_id.strip()
        raw_session_id = metadata.get("session_id")
        if isinstance(raw_session_id, str) and raw_session_id.strip():
            return raw_session_id.strip()
        return DEFAULT_CLIENT_ID

    def _read_metadata(self, audio_frame: AudioFrame) -> dict[str, object]:
        metadata: dict[str, object] = {}

        try:
            metadata_json, _ = audio_frame.get_property_to_json("metadata")
            parsed = json.loads(metadata_json) if metadata_json else {}
            if isinstance(parsed, dict):
                metadata = parsed
        except Exception:
            metadata = {}

        try:
            metadata_json = audio_frame.get_property_string("metadata")
            parsed = json.loads(metadata_json) if metadata_json else {}
            if isinstance(parsed, dict):
                metadata = parsed
        except Exception:
            metadata = {}

        try:
            client_id_json, _ = audio_frame.get_property_to_json("client_id")
            if client_id_json:
                parsed_client_id = json.loads(client_id_json)
                if isinstance(parsed_client_id, str) and parsed_client_id.strip():
                    metadata["client_id"] = parsed_client_id.strip()
        except Exception:
            pass

        try:
            client_id = audio_frame.get_property_string("client_id")
            if isinstance(client_id, str) and client_id.strip():
                metadata["client_id"] = client_id.strip()
        except Exception:
            pass

        return metadata

    async def _check_state_transition(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        stream_state: StreamState,
        metadata: dict[str, object],
    ) -> None:
        if len(stream_state.probe_window) != self.window_size:
            return

        if stream_state.state == VADState.IDLE:
            prefix_probes = stream_state.probe_window[-self.prefix_window_size:]
            if all(p >= self.config.vad_threshold for p in prefix_probes):
                stream_state.state = VADState.SPEAKING
                ten_env.log_info(
                    f"[VoxFlameVAD] start_of_sentence client_id={client_id}"
                )
                await self._send_speech_activity(
                    ten_env,
                    client_id,
                    metadata,
                    "speech_started",
                    auto_finalize=False,
                )
            return

        silence_probes = stream_state.probe_window[-self.silence_window_size:]
        if all(p < self.config.vad_threshold for p in silence_probes):
            stream_state.state = VADState.IDLE
            ten_env.log_info(
                f"[VoxFlameVAD] end_of_sentence client_id={client_id}"
            )
            await self._send_speech_activity(
                ten_env,
                client_id,
                metadata,
                "speech_stopped",
                auto_finalize=True,
            )

    async def _send_speech_activity(
        self,
        ten_env: AsyncTenEnv,
        client_id: str,
        metadata: dict[str, object],
        state: str,
        auto_finalize: bool,
    ) -> None:
        event = Data.create("speech_activity")
        event.set_property_from_json(
            None,
            json.dumps(
                {
                    "client_id": client_id,
                    "state": state,
                    "source": "server_vad",
                    "auto_finalize": auto_finalize,
                    "metadata": metadata,
                }
            ),
        )
        await asyncio.create_task(ten_env.send_data(event))

    async def _forward_audio_frame(
        self,
        ten_env: AsyncTenEnv,
        audio_data: bytes,
        metadata: dict[str, object],
    ) -> None:
        self._dump_audio_if_needed(audio_data, self._extract_client_id(metadata), "out")

        audio_frame = AudioFrame.create("pcm_frame")
        audio_frame.set_bytes_per_sample(BYTES_PER_SAMPLE)
        audio_frame.set_sample_rate(SAMPLE_RATE)
        audio_frame.set_number_of_channels(1)
        audio_frame.set_data_fmt(AudioFrameDataFmt.INTERLEAVE)
        audio_frame.set_samples_per_channel(len(audio_data) // BYTES_PER_SAMPLE)
        audio_frame.alloc_buf(len(audio_data))
        buf = audio_frame.lock_buf()
        buf[:] = audio_data
        audio_frame.unlock_buf(buf)

        if metadata:
            audio_frame.set_property_from_json("metadata", json.dumps(metadata))
        client_id = self._extract_client_id(metadata)
        audio_frame.set_property_string("client_id", client_id)

        await ten_env.send_audio_frame(audio_frame)

    def _dump_audio_if_needed(
        self,
        buf: bytes,
        client_id: str,
        suffix: str,
    ) -> None:
        if not self.config or not self.config.dump or not self.config.dump_path:
            return

        os.makedirs(self.config.dump_path, exist_ok=True)
        safe_client_id = client_id.replace(":", "_")
        dump_file = os.path.join(
            self.config.dump_path,
            f"{self.name}_{safe_client_id}_{suffix}.pcm",
        )
        with open(dump_file, "ab") as file_obj:
            file_obj.write(buf)

    def _compute_probe(self, audio_buf: bytes) -> float:
        samples = np.frombuffer(audio_buf, dtype=np.int16).astype(np.float32)
        if samples.size == 0:
            return 0.0

        rms = float(np.sqrt(np.mean(np.square(samples))))
        return rms / 32768.0
