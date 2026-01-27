#
# VoxFlame LLM Correction Extension
# Copyright (c) 2025 VoxFlame. All rights reserved.
#
from typing import List, Optional
from openai import AsyncOpenAI

from ten_runtime.async_ten_env import AsyncTenEnv


class LLMCorrector:
    """
    LLM-based speech correction for dysarthric speech.

    Uses DashScope (Qwen) API via OpenAI-compatible interface
    to correct ASR recognition errors.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        max_tokens: int,
        temperature: float,
        system_prompt: str,
        user_profile: str,
        vocabulary: List[str],
        ten_env: AsyncTenEnv,
    ):
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.system_prompt = system_prompt
        self.user_profile = user_profile
        self.vocabulary = vocabulary
        self.ten_env = ten_env

        # Initialize OpenAI client with DashScope endpoint
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
        )

        ten_env.log_info(f"LLMCorrector initialized with model: {model}")

    def update_user_profile(self, user_profile: dict) -> None:
        """Update user profile for personalized correction."""
        # Format user profile as string for prompt
        if isinstance(user_profile, dict):
            profile_parts = []
            if user_profile.get('email'):
                profile_parts.append(f"邮箱: {user_profile['email']}")
            if user_profile.get('name'):
                profile_parts.append(f"昵称: {user_profile['name']}")
            if user_profile.get('id'):
                profile_parts.append(f"用户ID: {user_profile['id']}")
            self.user_profile = "\n".join(profile_parts) if profile_parts else ""
        else:
            self.user_profile = str(user_profile)

        self.ten_env.log_info(f"User profile updated: {self.user_profile[:100] if self.user_profile else 'empty'}...")

    def _build_prompt(self, asr_text: str, context: List[dict]) -> str:
        """Build the correction prompt with context"""
        prompt_parts = []

        # Add user profile if available
        if self.user_profile:
            prompt_parts.append(f"## 用户信息\n{self.user_profile}\n")

        # Add vocabulary hints if available
        if self.vocabulary:
            vocab_str = "、".join(self.vocabulary[:20])  # Limit to 20 words
            prompt_parts.append(f"## 用户常用词汇\n{vocab_str}\n")

        # Add recent context
        if context:
            context_str = "\n".join([
                f"- 原文: {c['original']} -> 纠正: {c['corrected']}"
                for c in context[-3:]  # Last 3 exchanges
            ])
            prompt_parts.append(f"## 最近对话\n{context_str}\n")

        # Add the ASR text to correct
        prompt_parts.append(f"## 语音识别结果\n{asr_text}\n")
        prompt_parts.append("## 纠正后的文本")

        return "\n".join(prompt_parts)

    async def correct(
        self, asr_text: str, context: Optional[List[dict]] = None
    ) -> str:
        """
        Correct ASR text using LLM.

        Args:
            asr_text: The ASR recognition result to correct
            context: Recent conversation context for better correction

        Returns:
            Corrected text
        """
        if not asr_text.strip():
            return asr_text

        try:
            # Build the user prompt
            user_prompt = self._build_prompt(asr_text, context or [])

            self.ten_env.log_debug(f"Correction prompt: {user_prompt[:200]}...")

            # Call LLM for correction
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                stream=False,
            )

            # Extract corrected text
            corrected = response.choices[0].message.content.strip()

            # Clean up the response (remove any explanations)
            corrected = self._clean_response(corrected)

            self.ten_env.log_debug(f"LLM correction: '{asr_text}' -> '{corrected}'")

            return corrected if corrected else asr_text

        except Exception as e:
            self.ten_env.log_error(f"LLM correction failed: {e}")
            # Return original text on error
            return asr_text

    def _clean_response(self, response: str) -> str:
        """Clean up LLM response to extract only the corrected text"""
        # Remove common prefixes that LLMs might add
        prefixes_to_remove = [
            "纠正后的文本：",
            "纠正后：",
            "纠正结果：",
            "纠正：",
            "正确的文本：",
            "应该是：",
        ]

        result = response.strip()
        for prefix in prefixes_to_remove:
            if result.startswith(prefix):
                result = result[len(prefix):].strip()

        # Remove quotes if present
        if result.startswith('"') and result.endswith('"'):
            result = result[1:-1]
        if result.startswith("'") and result.endswith("'"):
            result = result[1:-1]
        if result.startswith("「") and result.endswith("」"):
            result = result[1:-1]

        # Take only the first line if multiple lines
        lines = result.split("\n")
        result = lines[0].strip()

        return result
