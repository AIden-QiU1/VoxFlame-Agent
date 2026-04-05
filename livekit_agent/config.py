from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class LiveKitAgentConfig:
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    agent_name: str
    mode: str
    dashscope_api_key: str | None
    dashscope_base_url: str
    dashscope_llm_model: str
    dashscope_timeout_seconds: float
    dashscope_asr_url: str
    dashscope_asr_model: str
    dashscope_asr_sample_rate: int
    dashscope_asr_language: str
    dashscope_asr_enable_interim: bool
    dashscope_asr_connect_timeout_seconds: int
    dashscope_asr_vad_threshold: float
    dashscope_asr_vad_silence_duration_ms: int
    dashscope_asr_vad_hop_size_ms: int
    dashscope_tts_url: str
    dashscope_tts_model: str
    dashscope_tts_voice: str
    dashscope_tts_sample_rate: int
    dashscope_tts_connect_timeout_seconds: int
    dashscope_tts_request_timeout_seconds: float
    log_level: str


def should_bypass_proxy_for_livekit(livekit_url: str) -> bool:
    parsed = urlparse(livekit_url)
    hostname = (parsed.hostname or "").strip().lower()
    return hostname in {"127.0.0.1", "localhost", "livekit-server"}


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def load_config() -> LiveKitAgentConfig:
    return LiveKitAgentConfig(
        livekit_url=_required_env("LIVEKIT_URL"),
        livekit_api_key=_required_env("LIVEKIT_API_KEY"),
        livekit_api_secret=_required_env("LIVEKIT_API_SECRET"),
        agent_name=os.getenv("LIVEKIT_AGENT_NAME", "voxflame-agent").strip() or "voxflame-agent",
        mode=os.getenv("VOXFLAME_LIVEKIT_AGENT_MODE", "communication_stub").strip()
        or "communication_stub",
        dashscope_api_key=os.getenv("DASHSCOPE_API_KEY", "").strip() or None,
        dashscope_base_url=(
            os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
            .strip()
            .rstrip("/")
        ),
        dashscope_llm_model=os.getenv("DASHSCOPE_LLM_MODEL", "qwen3.5-flash").strip()
        or "qwen3.5-flash",
        dashscope_timeout_seconds=float(os.getenv("DASHSCOPE_TIMEOUT_SECONDS", "15").strip() or "15"),
        dashscope_asr_url=(
            os.getenv("QWEN_ASR_REALTIME_URL", "wss://dashscope.aliyuncs.com/api-ws/v1/realtime")
            .strip()
        ),
        dashscope_asr_model=(
            os.getenv("QWEN_ASR_REALTIME_MODEL", "qwen3-asr-flash-realtime").strip()
            or "qwen3-asr-flash-realtime"
        ),
        dashscope_asr_sample_rate=int(os.getenv("QWEN_ASR_REALTIME_SAMPLE_RATE", "16000").strip() or "16000"),
        dashscope_asr_language=os.getenv("QWEN_ASR_REALTIME_LANGUAGE", "zh").strip() or "zh",
        dashscope_asr_enable_interim=(
            os.getenv("QWEN_ASR_ENABLE_INTERIM", "1").strip().lower() not in {"0", "false", "no"}
        ),
        dashscope_asr_connect_timeout_seconds=int(
            os.getenv("QWEN_ASR_CONNECT_TIMEOUT_SECONDS", "15").strip() or "15"
        ),
        dashscope_asr_vad_threshold=float(os.getenv("QWEN_ASR_VAD_THRESHOLD", "0.018").strip() or "0.018"),
        dashscope_asr_vad_silence_duration_ms=int(
            os.getenv("QWEN_ASR_VAD_SILENCE_DURATION_MS", "720").strip() or "720"
        ),
        dashscope_asr_vad_hop_size_ms=int(os.getenv("QWEN_ASR_VAD_HOP_SIZE_MS", "16").strip() or "16"),
        dashscope_tts_url=(
            os.getenv("QWEN_TTS_REALTIME_URL", "wss://dashscope.aliyuncs.com/api-ws/v1/realtime")
            .strip()
        ),
        dashscope_tts_model=(
            os.getenv("QWEN_TTS_REALTIME_MODEL", "qwen3-tts-flash-realtime").strip()
            or "qwen3-tts-flash-realtime"
        ),
        dashscope_tts_voice=os.getenv("QWEN_TTS_REALTIME_VOICE", "Cherry").strip() or "Cherry",
        dashscope_tts_sample_rate=int(os.getenv("QWEN_TTS_REALTIME_SAMPLE_RATE", "16000").strip() or "16000"),
        dashscope_tts_connect_timeout_seconds=int(
            os.getenv("QWEN_TTS_CONNECT_TIMEOUT_SECONDS", "15").strip() or "15"
        ),
        dashscope_tts_request_timeout_seconds=float(
            os.getenv("QWEN_TTS_REQUEST_TIMEOUT_SECONDS", "20").strip() or "20"
        ),
        log_level=os.getenv("LOG_LEVEL", "info").strip().lower() or "info",
    )
