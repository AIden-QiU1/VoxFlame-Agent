from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from asr_runtime import (
    RMSVoiceActivityDetector,
    build_asr_session_payload,
    frame_to_pcm_bytes,
    normalized_rms_energy,
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
        dashscope_llm_model="qwen3.5-flash",
        dashscope_timeout_seconds=15.0,
        dashscope_asr_url="wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        dashscope_asr_model="qwen3-asr-flash-realtime",
        dashscope_asr_sample_rate=16000,
        dashscope_asr_language="zh",
        dashscope_asr_enable_interim=True,
        dashscope_asr_connect_timeout_seconds=15,
        dashscope_asr_vad_threshold=0.018,
        dashscope_asr_vad_silence_duration_ms=720,
        dashscope_asr_vad_hop_size_ms=16,
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


class TestASRRuntime(unittest.TestCase):
    def test_with_model_query_appends_model_when_missing(self) -> None:
        url = with_model_query("wss://dashscope.aliyuncs.com/api-ws/v1/realtime", "qwen3-asr-flash-realtime")
        self.assertIn("model=qwen3-asr-flash-realtime", url)

    def test_build_asr_session_payload_matches_dashscope_contract(self) -> None:
        payload = build_asr_session_payload(create_config())
        self.assertEqual(payload["modalities"], ["text"])
        self.assertEqual(payload["input_audio_format"], "pcm")
        self.assertEqual(payload["sample_rate"], 16000)
        self.assertEqual(payload["input_audio_transcription"]["language"], "zh")

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


if __name__ == "__main__":
    unittest.main()
