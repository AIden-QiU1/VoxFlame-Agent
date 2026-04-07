from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from asr_runtime import (
    LiveKitASRRuntime,
    RMSVoiceActivityDetector,
    build_asr_session_payload,
    build_livekit_audio_apm_options,
    frame_to_pcm_bytes,
    normalized_rms_energy,
    should_enable_livekit_audio_apm,
    with_model_query,
)
from config import LiveKitAgentConfig


def create_config() -> LiveKitAgentConfig:
    return LiveKitAgentConfig(
        livekit_url="ws://127.0.0.1:7880",
        livekit_api_key="devkey",
        livekit_api_secret="secret",
        agent_name="voxflame-agent",
        mode="communication_stub",
        dashscope_api_key="dashscope-test",
        dashscope_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        dashscope_llm_model="qwen3.6-plus",
        dashscope_timeout_seconds=15.0,
        dashscope_reply_timeout_seconds=4.5,
        dashscope_training_extension_model="qwen3.5-plus",
        dashscope_training_extension_timeout_seconds=8.0,
        dashscope_asr_url="wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        dashscope_asr_model="qwen3-asr-flash-realtime-2026-02-10",
        dashscope_asr_sample_rate=16000,
        dashscope_asr_language="zh",
        dashscope_asr_enable_interim=True,
        dashscope_asr_connect_timeout_seconds=15,
        livekit_audio_apm_enabled=True,
        livekit_audio_apm_echo_cancellation=False,
        livekit_audio_apm_noise_suppression=True,
        livekit_audio_apm_high_pass_filter=True,
        livekit_audio_apm_auto_gain_control=False,
        dashscope_asr_vad_threshold=0.018,
        dashscope_asr_vad_silence_duration_ms=720,
        dashscope_asr_vad_hop_size_ms=16,
        dashscope_asr_barge_in_min_speech_ms=220,
        dashscope_tts_url="wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        dashscope_tts_model="qwen3-tts-flash-realtime",
        dashscope_tts_voice="Cherry",
        dashscope_tts_sample_rate=16000,
        dashscope_tts_connect_timeout_seconds=15,
        dashscope_tts_request_timeout_seconds=20.0,
        log_level="info",
    )


class FakeFrame:
    def __init__(self, data: bytes, num_channels: int) -> None:
        self.data = data
        self.num_channels = num_channels


class FakeAPM:
    def __init__(self) -> None:
        self.frames: list[bytes] = []

    def process_stream(self, frame):  # noqa: ANN001
        payload = frame.data.tobytes() if hasattr(frame.data, "tobytes") else bytes(frame.data)
        self.frames.append(payload)
        return frame


class FakeMonoFrame:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.num_channels = 1


class TestASRRuntime(unittest.TestCase):
    def test_with_model_query_appends_model_when_missing(self) -> None:
        url = with_model_query(
            "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            "qwen3-asr-flash-realtime-2026-02-10",
        )
        self.assertIn("model=qwen3-asr-flash-realtime-2026-02-10", url)

    def test_build_asr_session_payload_matches_dashscope_contract(self) -> None:
        payload = build_asr_session_payload(create_config())
        self.assertEqual(payload["modalities"], ["text"])
        self.assertEqual(payload["input_audio_format"], "pcm")
        self.assertEqual(payload["sample_rate"], 16000)
        self.assertEqual(payload["input_audio_transcription"]["language"], "zh")

    def test_livekit_audio_apm_defaults_are_conservative_for_remote_tracks(self) -> None:
        options = build_livekit_audio_apm_options(create_config())
        self.assertEqual(
            options,
            {
                "echo_cancellation": False,
                "noise_suppression": True,
                "high_pass_filter": True,
                "auto_gain_control": False,
            },
        )
        self.assertTrue(should_enable_livekit_audio_apm(create_config()))

    def test_frame_to_pcm_bytes_downmixes_stereo_to_mono(self) -> None:
        frame = FakeFrame(
            data=bytes.fromhex("0100020003000400"),
            num_channels=2,
        )
        pcm = frame_to_pcm_bytes(frame)
        self.assertEqual(len(pcm), 4)

    def test_normalized_rms_energy_returns_zero_for_silence(self) -> None:
        self.assertEqual(normalized_rms_energy(b"\x00\x00" * 160), 0.0)

    def test_vad_detector_emits_start_then_stop_after_silence_window(self) -> None:
        detector = RMSVoiceActivityDetector(threshold=0.01, silence_duration_ms=20)
        speech_frame = (1000).to_bytes(2, byteorder="little", signed=True) * 160
        silence_frame = b"\x00\x00" * 160

        started, stopped, _ = detector.observe(speech_frame, 16000)
        self.assertTrue(started)
        self.assertFalse(stopped)

        started, stopped, _ = detector.observe(silence_frame, 16000)
        self.assertFalse(started)
        self.assertFalse(stopped)

        started, stopped, _ = detector.observe(silence_frame, 16000)
        self.assertFalse(started)
        self.assertTrue(stopped)

    def test_apply_audio_apm_chunks_pcm_into_10ms_frames(self) -> None:
        runtime = LiveKitASRRuntime(
            config=create_config(),
            ctx=type("Ctx", (), {"room_name": "room", "participant_identity": "user"})(),
            participant=None,
            publish_payload=None,
            on_final_transcript=None,
        )
        fake_apm = FakeAPM()
        runtime._audio_apm = fake_apm
        pcm_bytes = b"\x01\x00" * 400  # 25ms @ 16k mono

        with patch(
            "asr_runtime.pcm_bytes_to_audio_frame",
            side_effect=lambda data, sample_rate, num_channels=1: FakeMonoFrame(data),
        ):
            first = runtime._apply_audio_apm(pcm_bytes, 16000)
            second = runtime._apply_audio_apm(b"", 16000)

        self.assertEqual(len(fake_apm.frames), 2)
        self.assertEqual(len(fake_apm.frames[0]), 320)
        self.assertEqual(len(fake_apm.frames[1]), 320)
        self.assertEqual(len(first), 640)
        self.assertEqual(second, b"")
        self.assertEqual(len(runtime._apm_remainder), 160)


if __name__ == "__main__":
    unittest.main()
