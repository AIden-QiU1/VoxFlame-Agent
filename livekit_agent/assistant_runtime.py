from __future__ import annotations

import asyncio
import difflib
import json
import logging
from dataclasses import dataclass, field
from typing import Any
from urllib import error, request

from config import LiveKitAgentConfig
from session_context import VoxFlameSessionContext
from session_userdata import VoxFlameSessionUserData

logger = logging.getLogger("voxflame-livekit-agent.assistant")

SYSTEM_PROMPT = """你是 VoxFlame 的沟通助手。

你的目标不是纠正用户本人，而是帮用户更顺利地把意思表达出去。

回复要求：
1. 默认使用简体中文。
2. 语气温和、直接、支持性强。
3. 只输出一到两句可直接说出去的话。
4. 不要分析，不要解释，不要项目符号，不要自我介绍。
5. 如果是就医、求助、购物等具体场景，优先把最关键的一句说清楚。
6. 不要输出“现在先按当前沟通场景继续”“我先帮你把这句话往前推进”这类铺垫。
"""

TRAINING_EXTENSION_SYSTEM_PROMPT = """你是 VoxFlame 的训练点评 extension。

你的任务不是给用户打分、贴标签或输出结构化表格，而是在用户刚录完一句后，给出一小段自然语言训练点评。

输出要求：
1. 默认使用简体中文。
2. 只输出 2 到 4 句自然语言，不要项目符号，不要 JSON，不要标题。
3. 先点出这次最值得先改的一点，再给一个立刻能重录的具体动作。
4. 不要输出“excellent / close / retry / unclear”这类状态词。
5. 不要列“漏字 / 多字 / speech_patterns / articulation_tips”等结构化字段名。
6. 语气温和、直接、像现场教练，不要写成长分析报告。
"""


def compute_reply_timeout_seconds(
    configured_timeout_seconds: float,
    user_text: str,
) -> float:
    normalized = user_text.strip()
    if not normalized:
        return max(0.8, configured_timeout_seconds)

    text_length = len(normalized)
    if text_length <= 8:
        return max(0.8, min(configured_timeout_seconds, 1.2))
    if text_length <= 20:
        return max(1.2, min(configured_timeout_seconds, 2.2))
    return max(1.5, configured_timeout_seconds)


def estimate_clarity_score(original_text: str, corrected_text: str) -> float:
    original = original_text.strip()
    corrected = corrected_text.strip()
    if not original or not corrected:
        return 0.0
    if original == corrected:
      return 1.0
    ratio = difflib.SequenceMatcher(a=original, b=corrected).ratio()
    return max(0.0, min(1.0, round(ratio, 4)))


def build_fallback_text(ctx: VoxFlameSessionContext, user_text: str) -> str:
    normalized = user_text.strip()
    if normalized:
        return normalized
    return "请再说一遍。"


def build_scene_prompt(ctx: VoxFlameSessionContext) -> str:
    scene = ctx.scene or "general"
    return (
        f"当前场景：{scene}\n"
        "请优先输出一句能让对方马上理解用户意图、可以直接代说的表达。"
    )


def build_preparation_prompt(userdata: VoxFlameSessionUserData) -> str:
    preparation = userdata.preparation
    lines = [
        f"当前准备目标：{preparation.immediate_goal}",
        f"当前表达画像：{preparation.profile_summary}",
    ]
    if preparation.listener_guidance:
        lines.append(f"听者引导：{'；'.join(preparation.listener_guidance[:2])}")
    if preparation.support_strategies:
        lines.append(f"支持策略：{'；'.join(preparation.support_strategies[:2])}")
    if preparation.hotwords:
        lines.append(f"热词：{'、'.join(preparation.hotwords[:6])}")
    if preparation.common_confusions:
        lines.append(f"常见误听：{'、'.join(preparation.common_confusions[:4])}")
    if userdata.active_hotwords:
        lines.append(f"本轮命中热词：{'、'.join(userdata.active_hotwords[:4])}")
    return "\n".join(lines)


def _read_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def build_training_extension_fallback_text(payload: dict[str, Any]) -> str:
    exercise_text = str(payload.get("exercise_text", "") or "").strip()
    recognized_text = str(payload.get("recognized_text", "") or "").strip()
    if exercise_text and recognized_text and exercise_text != recognized_text:
        return (
            f"这次系统听到的是“{recognized_text}”，和目标句“{exercise_text}”还有一点偏差。"
            "先别追求整句一次到位，先把最容易跑掉的那几个字慢一点、拉开一点，再重录一遍。"
        )
    if exercise_text:
        return (
            f"这次先继续对着目标句“{exercise_text}”练。"
            "先把节奏放慢一点，嘴巴动作做大一点，再马上补一条新的版本。"
        )
    return "这次先把速度放慢一点，只盯一句里最关键的几个字，再补录一遍。"


def _build_training_guidance_line(payload: dict[str, Any]) -> str | None:
    guidance_profile = payload.get("guidance_profile")
    if isinstance(guidance_profile, dict):
        priority = str(guidance_profile.get("priority", "") or "").strip()
        severity = str(guidance_profile.get("severity", "") or "").strip()
        if priority or severity:
            return f"训练偏好：priority={priority or 'default'}；severity={severity or 'default'}"
    return None


def build_training_extension_prompt(
    ctx: VoxFlameSessionContext,
    payload: dict[str, Any],
) -> str:
    exercise_text = str(payload.get("exercise_text", "") or "").strip()
    recognized_text = str(payload.get("recognized_text", "") or "").strip()
    category = str(payload.get("exercise_category", "") or ctx.scene or "中文训练").strip()
    prepared_expression_title = str(payload.get("prepared_expression_title", "") or "").strip()
    prepared_expression_section_title = str(payload.get("prepared_expression_section_title", "") or "").strip()
    hotwords = _read_string_list(payload.get("hotwords"))[:5]
    keywords = _read_string_list(payload.get("keywords"))[:5]
    fallback_phrases = _read_string_list(payload.get("fallback_phrases"))[:2]
    high_risk_phrases = _read_string_list(payload.get("high_risk_phrases"))[:3]

    lines = [
        f"训练分类：{category}",
        f"目标句：{exercise_text or '未提供'}",
        f"系统听到：{recognized_text or '这次还没有稳定拿到最终结果'}",
    ]
    guidance_line = _build_training_guidance_line(payload)
    if guidance_line:
        lines.append(guidance_line)
    if prepared_expression_title:
        if prepared_expression_section_title:
            lines.append(f"来源准备稿：{prepared_expression_title} / {prepared_expression_section_title}")
        else:
            lines.append(f"来源准备稿：{prepared_expression_title}")
    if hotwords:
        lines.append(f"热词：{'、'.join(hotwords)}")
    elif keywords:
        lines.append(f"关键词：{'、'.join(keywords)}")
    if high_risk_phrases:
        lines.append(f"高风险表达：{'、'.join(high_risk_phrases)}")
    if fallback_phrases:
        lines.append(f"卡住时可退回：{'；'.join(fallback_phrases)}")
    lines.append("请直接给出自然语言训练点评。")
    return "\n".join(lines)


def extract_text_from_completion(payload: dict[str, Any]) -> str | None:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return None

    first = choices[0]
    if not isinstance(first, dict):
        return None

    message = first.get("message")
    if not isinstance(message, dict):
        return None

    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()

    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text" and isinstance(item.get("text"), str):
                text_parts.append(item["text"].strip())
        combined = "".join(part for part in text_parts if part)
        return combined or None

    return None


@dataclass
class DashScopeChatClient:
    api_key: str
    base_url: str
    model: str
    timeout_seconds: float

    def complete(self, messages: list[dict[str, str]]) -> str:
        payload = json.dumps(
            {
                "model": self.model,
                "messages": messages,
                "temperature": 0.2,
                "max_tokens": 48,
                "parameters": {
                    "enable_thinking": False,
                },
            },
            ensure_ascii=False,
        ).encode("utf-8")
        req = request.Request(
            url=f"{self.base_url}/chat/completions",
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )

        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                body = resp.read().decode("utf-8")
        except error.HTTPError as exc:  # pragma: no cover - exercised via caller fallback
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"DashScope HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:  # pragma: no cover - exercised via caller fallback
            raise RuntimeError(f"DashScope connection failed: {exc.reason}") from exc

        parsed = json.loads(body)
        text = extract_text_from_completion(parsed)
        if not text:
            raise RuntimeError("DashScope returned no usable text content")
        return text


@dataclass
class CommunicationAssistantRuntime:
    config: LiveKitAgentConfig
    ctx: VoxFlameSessionContext
    userdata: VoxFlameSessionUserData
    client: DashScopeChatClient | None = None
    history: list[dict[str, str]] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.client is None and self.config.dashscope_api_key:
            self.client = DashScopeChatClient(
                api_key=self.config.dashscope_api_key,
                base_url=self.config.dashscope_base_url,
                model=self.config.dashscope_llm_model,
                timeout_seconds=self.config.dashscope_reply_timeout_seconds,
            )

    async def generate_reply(self, user_text: str) -> tuple[str, str]:
        normalized = user_text.strip()
        if not normalized:
            return build_fallback_text(self.ctx, normalized), "livekit_agent_fallback"

        self.userdata.note_user_transcript(normalized)
        self.history.append({"role": "user", "content": normalized})
        self.history = self.history[-8:]

        if self.client is None:
            reply = build_fallback_text(self.ctx, normalized)
            self.history.append({"role": "assistant", "content": reply})
            self.history = self.history[-8:]
            return reply, "livekit_agent_fallback"

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": build_scene_prompt(self.ctx)},
            {"role": "system", "content": build_preparation_prompt(self.userdata)},
            *self.history,
        ]
        reply_timeout_seconds = compute_reply_timeout_seconds(
            self.config.dashscope_reply_timeout_seconds,
            normalized,
        )

        try:
            if isinstance(self.client, DashScopeChatClient):
                reply = await asyncio.wait_for(
                    asyncio.to_thread(self.client.complete, messages),
                    timeout=reply_timeout_seconds,
                )
            else:
                reply = self.client.complete(messages)
        except Exception as exc:
            logger.warning("DashScope reply generation failed, falling back to deterministic text: %s", exc)
            reply = build_fallback_text(self.ctx, normalized)
            source = "livekit_agent_fallback"
        else:
            source = "dashscope_chat_completion"

        self.history.append({"role": "assistant", "content": reply})
        self.history = self.history[-8:]
        self.userdata.note_assistant_reply(reply)
        return reply, source


@dataclass
class TrainingCoachRuntime:
    config: LiveKitAgentConfig
    ctx: VoxFlameSessionContext
    client: DashScopeChatClient | None = None

    def __post_init__(self) -> None:
        if self.client is None and self.config.dashscope_api_key:
            self.client = DashScopeChatClient(
                api_key=self.config.dashscope_api_key,
                base_url=self.config.dashscope_base_url,
                model=self.config.dashscope_training_extension_model,
                timeout_seconds=self.config.dashscope_training_extension_timeout_seconds,
            )

    async def generate_feedback(
        self,
        payload: dict[str, Any],
    ) -> tuple[str, str, str]:
        fallback_text = build_training_extension_fallback_text(payload)
        model = self.config.dashscope_training_extension_model

        if self.client is None:
            return fallback_text, "livekit_training_extension_fallback", model

        messages = [
            {"role": "system", "content": TRAINING_EXTENSION_SYSTEM_PROMPT},
            {"role": "system", "content": build_scene_prompt(self.ctx)},
            {"role": "user", "content": build_training_extension_prompt(self.ctx, payload)},
        ]

        try:
            if isinstance(self.client, DashScopeChatClient):
                feedback_text = await asyncio.wait_for(
                    asyncio.to_thread(self.client.complete, messages),
                    timeout=self.config.dashscope_training_extension_timeout_seconds,
                )
            else:
                feedback_text = self.client.complete(messages)
        except Exception as exc:
            logger.warning(
                "DashScope training extension failed, falling back to deterministic text: %s",
                exc,
            )
            return fallback_text, "livekit_training_extension_fallback", model

        normalized = feedback_text.strip()
        if not normalized:
            return fallback_text, "livekit_training_extension_fallback", model
        return normalized, "livekit_training_extension", model
