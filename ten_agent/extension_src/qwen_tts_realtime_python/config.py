from __future__ import annotations

import copy
from typing import Any

from pydantic import BaseModel, Field
from ten_ai_base import utils


DEFAULT_QWEN_REALTIME_TTS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"


class QwenRealtimeTTSConfig(BaseModel):
    api_key: str = ""
    url: str = DEFAULT_QWEN_REALTIME_TTS_URL
    model: str = "qwen3-tts-flash-realtime"
    voice: str = "Cherry"
    sample_rate: int = 16000
    response_format: str = "pcm"
    mode: str = "server_commit"
    language_type: str = "Chinese"
    speech_rate: float = 1.0
    volume: int = 50
    pitch_rate: float = 1.0
    bit_rate: int = 128
    instructions: str = ""
    optimize_instructions: bool = False
    commit_on_text_end: bool = True
    request_timeout_seconds: int = 20
    connect_timeout_seconds: int = 15
    dump: bool = False
    dump_path: str = "/tmp"
    params: dict[str, Any] = Field(default_factory=dict)

    def update_params(self) -> None:
        if "format" in self.params and "response_format" not in self.params:
            self.params["response_format"] = self.params["format"]
        if "speed" in self.params and "speech_rate" not in self.params:
            self.params["speech_rate"] = self.params["speed"]
        if "prompt" in self.params and "instructions" not in self.params:
            self.params["instructions"] = self.params["prompt"]
        for key, value in self.params.items():
            if hasattr(self, key) and value not in (None, ""):
                setattr(self, key, value)

    def to_str(self, sensitive_handling: bool = True) -> str:
        if not sensitive_handling:
            return str(self.model_dump())

        config = copy.deepcopy(self)
        if config.api_key:
            config.api_key = utils.encrypt(config.api_key)
        if config.params.get("api_key"):
            config.params["api_key"] = utils.encrypt(config.params["api_key"])
        return str(config.model_dump())
