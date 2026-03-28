from __future__ import annotations

import copy
from typing import Any

from pydantic import BaseModel, Field
from ten_ai_base import utils


DEFAULT_QWEN_REALTIME_ASR_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"


class QwenRealtimeASRConfig(BaseModel):
    api_key: str = ""
    url: str = DEFAULT_QWEN_REALTIME_ASR_URL
    model: str = "qwen3-asr-flash-realtime"
    sample_rate: int = 16000
    language_hints: list[str] = Field(default_factory=lambda: ["zh"])
    prompt: str = ""
    turn_detection: str = "none"
    enable_interim: bool = True
    auto_update_session_on_profile: bool = True
    hotword_limit: int = 24
    corpus_limit_chars: int = 256
    connect_timeout_seconds: int = 15
    dump: bool = False
    dump_path: str = "/tmp"
    params: dict[str, Any] = Field(default_factory=dict)

    def update_params(self) -> None:
        for key, value in self.params.items():
            if hasattr(self, key) and value not in (None, ""):
                setattr(self, key, value)

    def get_language(self) -> str:
        for value in self.language_hints:
            if isinstance(value, str) and value.strip():
                return value.strip()
        return "zh"

    def to_str(self, sensitive_handling: bool = True) -> str:
        if not sensitive_handling:
            return str(self.model_dump())

        config = copy.deepcopy(self)
        if config.api_key:
            config.api_key = utils.encrypt(config.api_key)
        if config.params.get("api_key"):
            config.params["api_key"] = utils.encrypt(config.params["api_key"])
        return str(config.model_dump())
