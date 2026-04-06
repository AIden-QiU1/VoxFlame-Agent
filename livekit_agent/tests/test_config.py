from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import load_config


class ConfigTests(unittest.TestCase):
    def test_load_config_reads_livekit_env(self) -> None:
        env_updates = {
            "LIVEKIT_URL": "ws://127.0.0.1:7880",
            "LIVEKIT_API_KEY": "devkey",
            "LIVEKIT_API_SECRET": "secret",
            "LIVEKIT_AGENT_NAME": "voxflame-agent",
            "VOXFLAME_LIVEKIT_AGENT_MODE": "communication_stub",
            "DASHSCOPE_API_KEY": "dashscope-test",
            "DASHSCOPE_BASE_URL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "DASHSCOPE_LLM_MODEL": "qwen3.5-flash",
            "DASHSCOPE_TIMEOUT_SECONDS": "9.5",
            "QWEN_ASR_REALTIME_URL": "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            "QWEN_ASR_REALTIME_MODEL": "qwen3-asr-flash-realtime",
            "QWEN_ASR_REALTIME_SAMPLE_RATE": "16000",
            "QWEN_ASR_REALTIME_LANGUAGE": "zh",
            "QWEN_ASR_ENABLE_INTERIM": "1",
            "QWEN_ASR_CONNECT_TIMEOUT_SECONDS": "11",
            "QWEN_ASR_VAD_THRESHOLD": "0.02",
            "QWEN_ASR_VAD_SILENCE_DURATION_MS": "650",
            "QWEN_ASR_VAD_HOP_SIZE_MS": "20",
            "QWEN_ASR_BARGE_IN_MIN_SPEECH_MS": "240",
            "QWEN_TTS_REALTIME_URL": "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            "QWEN_TTS_REALTIME_MODEL": "qwen3-tts-flash-realtime",
            "QWEN_TTS_REALTIME_VOICE": "Cherry",
            "QWEN_TTS_REALTIME_SAMPLE_RATE": "16000",
            "QWEN_TTS_CONNECT_TIMEOUT_SECONDS": "12",
            "QWEN_TTS_REQUEST_TIMEOUT_SECONDS": "21",
        }
        previous = {key: os.environ.get(key) for key in env_updates}

        try:
            os.environ.update(env_updates)
            config = load_config()
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

        self.assertEqual(config.livekit_url, "ws://127.0.0.1:7880")
        self.assertEqual(config.livekit_api_key, "devkey")
        self.assertEqual(config.livekit_api_secret, "secret")
        self.assertEqual(config.agent_name, "voxflame-agent")
        self.assertEqual(config.mode, "communication_stub")
        self.assertEqual(config.dashscope_api_key, "dashscope-test")
        self.assertEqual(
            config.dashscope_base_url,
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        self.assertEqual(config.dashscope_llm_model, "qwen3.5-flash")
        self.assertEqual(config.dashscope_timeout_seconds, 9.5)
        self.assertEqual(config.dashscope_asr_url, "wss://dashscope.aliyuncs.com/api-ws/v1/realtime")
        self.assertEqual(config.dashscope_asr_model, "qwen3-asr-flash-realtime")
        self.assertEqual(config.dashscope_asr_sample_rate, 16000)
        self.assertEqual(config.dashscope_asr_language, "zh")
        self.assertTrue(config.dashscope_asr_enable_interim)
        self.assertEqual(config.dashscope_asr_connect_timeout_seconds, 11)
        self.assertEqual(config.dashscope_asr_vad_threshold, 0.02)
        self.assertEqual(config.dashscope_asr_vad_silence_duration_ms, 650)
        self.assertEqual(config.dashscope_asr_vad_hop_size_ms, 20)
        self.assertEqual(config.dashscope_asr_barge_in_min_speech_ms, 240)
        self.assertEqual(config.dashscope_tts_url, "wss://dashscope.aliyuncs.com/api-ws/v1/realtime")
        self.assertEqual(config.dashscope_tts_model, "qwen3-tts-flash-realtime")
        self.assertEqual(config.dashscope_tts_voice, "Cherry")
        self.assertEqual(config.dashscope_tts_sample_rate, 16000)
        self.assertEqual(config.dashscope_tts_connect_timeout_seconds, 12)
        self.assertEqual(config.dashscope_tts_request_timeout_seconds, 21)


if __name__ == "__main__":
    unittest.main()
