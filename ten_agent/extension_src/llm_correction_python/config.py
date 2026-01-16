#
# VoxFlame LLM Correction Extension
# Copyright (c) 2025 VoxFlame. All rights reserved.
#
from pydantic import BaseModel
from typing import Optional, List


class LLMCorrectionConfig(BaseModel):
    """Configuration for LLM Correction Extension"""

    # DashScope API settings
    api_key: str = ""
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    model: str = "qwen-turbo"

    # Correction settings
    max_tokens: int = 256
    temperature: float = 0.3  # Lower temperature for more deterministic corrections

    # User profile for personalized correction
    user_profile: str = ""

    # Common vocabulary for the user (helps with correction)
    vocabulary: List[str] = []

    # Maximum context history to keep
    max_context_length: int = 5

    # System prompt for correction
    system_prompt: str = """你是专业的语音纠错助手，帮助构音障碍患者纠正语音识别错误。

## 任务
根据语音识别结果，推断用户真实意图并输出纠正后的文本。

## 要求
1. 分析可能的发音混淆（如：z/zh, s/sh, l/n, an/ang, in/ing）
2. 结合上下文推断语义
3. 直接输出纠正后的文本，不要解释
4. 如果识别结果已经正确，直接输出原文
5. 保持简洁，不要添加额外内容"""

    def validate_config(self) -> None:
        """Validate configuration"""
        if not self.api_key:
            raise ValueError("api_key is required")

    def to_str(self, sensitive_handling: bool = True) -> str:
        """Convert config to string for logging"""
        config_dict = self.model_dump()
        if sensitive_handling and self.api_key:
            config_dict["api_key"] = self.api_key[:8] + "***"
        return str(config_dict)
