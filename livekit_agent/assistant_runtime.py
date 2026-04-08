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
7. 把输入视为 ASR 最终文本，默认先做最小必要纠错，而不是大幅改写。
8. 优先保留用户已经表达出的事实、专有名词、数字、时间、地点、疾病名和产品名。
9. 如果某个词和热词/风险词明显接近，优先按准备上下文修正到这些词。
10. 如果信息仍不确定，选择更短、更保守、不新增事实的表达。
11. 把输入视为“多数高置信片段 + 少量误听片段”，优先保留高置信片段原样，只做局部替换。
12. 只允许做同音/近音纠错、漏字补齐、标点整理和热词纠偏，不要整句改写。
"""

CAPTION_SYSTEM_PROMPT = """你是 VoxFlame 的实时字幕纠错助手。

你的任务不是替用户发挥，而是把用户刚刚说出的这一句整理成最终展示字幕。

回复要求：
1. 默认使用简体中文。
2. 只输出当前这句话的最终字幕，不要解释，不要补充，不要续写。
3. 先保留用户原意、专有名词、数字、时间、地点和疾病名。
4. 只做最小必要纠错，不要为了更顺而新增事实。
5. 如果信息仍不确定，优先保守保留，不要猜测。
6. 把这句话视为“多数高置信片段 + 少量误听片段”，优先复制正确片段，只修局部错误。
"""

REPLY_HISTORY_WINDOW_MESSAGES = 6
REPLY_HISTORY_STORAGE_LIMIT = 12


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


def build_scene_prompt(
    ctx: VoxFlameSessionContext,
    *,
    caption_mode_enabled: bool = False,
) -> str:
    scene = ctx.scene or "general"
    return (
        f"当前场景：{scene}\n"
        + (
            "请优先输出当前这句话的最终展示字幕。"
            if caption_mode_enabled
            else "请优先输出一句能让对方马上理解用户意图、可以直接代说的表达。"
        )
    )


def _dedupe_strings(values: list[str], limit: int) -> list[str]:
    results: list[str] = []
    for value in values:
        normalized = value.strip()
        if normalized and normalized not in results:
            results.append(normalized)
        if len(results) >= limit:
            break
    return results


def _truncate_text(value: str, limit: int) -> str:
    normalized = " ".join(value.strip().split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 1]}…"


def build_priority_hotwords(userdata: VoxFlameSessionUserData) -> list[str]:
    weighted_entries = sorted(
        userdata.preparation.asr_hotword_entries,
        key=lambda item: int(item.get("weight", 4))
        if isinstance(item.get("weight"), int)
        else 4,
        reverse=True,
    )
    weighted_hotwords = [
        item["text"].strip()
        for item in weighted_entries
        if isinstance(item.get("text"), str) and item["text"].strip()
    ]
    return _dedupe_strings(
        [
            *userdata.active_hotwords,
            *weighted_hotwords,
            *userdata.preparation.hotwords,
        ],
        8,
    )


def build_preparation_prompt(userdata: VoxFlameSessionUserData) -> str:
    preparation = userdata.preparation
    priority_hotwords = build_priority_hotwords(userdata)
    lines = [
        "稳定准备上下文：",
        f"- 当前目标：{_truncate_text(preparation.immediate_goal, 120)}",
        f"- 表达画像：{_truncate_text(preparation.profile_summary, 180)}",
    ]
    if preparation.listener_guidance:
        lines.append(
            f"- 听者引导：{'；'.join(_truncate_text(item, 48) for item in preparation.listener_guidance[:2])}"
        )
    if preparation.support_strategies:
        lines.append(
            f"- 支持策略：{'；'.join(_truncate_text(item, 48) for item in preparation.support_strategies[:2])}"
        )
    if priority_hotwords:
        lines.append(f"- 优先热词：{'、'.join(priority_hotwords)}")
    if preparation.risky_terms:
        lines.append(
            f"- 高风险词句：{'；'.join(_truncate_text(item, 32) for item in preparation.risky_terms[:4])}"
        )
    if preparation.common_confusions:
        lines.append(
            f"- 常见误听：{'；'.join(_truncate_text(item, 32) for item in preparation.common_confusions[:4])}"
        )
    if preparation.fallback_phrases:
        lines.append(
            f"- 保底句：{'；'.join(_truncate_text(item, 40) for item in preparation.fallback_phrases[:2])}"
        )
    if userdata.active_hotwords:
        lines.append(f"- 本轮命中热词：{'、'.join(userdata.active_hotwords[:4])}")
    return "\n".join(lines)


def build_current_turn_prompt(
    user_text: str,
    userdata: VoxFlameSessionUserData,
    *,
    caption_mode_enabled: bool = False,
) -> str:
    lines = [
        "以下是用户本轮 ASR 最终文本，可能仍有误听、漏字或同音词偏差。",
        f"本轮 ASR 最终文本：{user_text.strip() or '未提供'}",
    ]
    if userdata.active_hotwords:
        lines.append(f"优先核对热词：{'、'.join(userdata.active_hotwords[:4])}")
    elif userdata.preparation.hotwords:
        lines.append(f"优先参考热词：{'、'.join(build_priority_hotwords(userdata)[:6])}")
    if userdata.preparation.risky_terms:
        lines.append(
            f"优先核对风险词句：{'；'.join(_truncate_text(item, 32) for item in userdata.preparation.risky_terms[:3])}"
        )
    if userdata.preparation.fallback_phrases:
        lines.append(
            f"如果原句不完整，可优先参考这些保底句的表达方式，但不要凭空补事实：{'；'.join(_truncate_text(item, 40) for item in userdata.preparation.fallback_phrases[:2])}"
        )
    lines.append("只允许做局部纠错：同音/近音替换、漏字补齐、标点整理、热词纠偏。")
    lines.append(
        "请只输出当前这句话的最终展示字幕。"
        if caption_mode_enabled
        else "请只输出最终可直接说出去的话。"
    )
    return "\n".join(lines)


def build_recent_history_window(
    history: list[dict[str, str]],
) -> list[dict[str, str]]:
    return history[-REPLY_HISTORY_WINDOW_MESSAGES:]


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

    def _build_system_prompt(self) -> str:
        return CAPTION_SYSTEM_PROMPT if self.userdata.caption_mode_enabled else SYSTEM_PROMPT

    async def generate_reply(self, user_text: str) -> tuple[str, str]:
        normalized = user_text.strip()
        if not normalized:
            return build_fallback_text(self.ctx, normalized), "livekit_agent_fallback"

        self.userdata.note_user_transcript(normalized)

        if self.client is None:
            reply = build_fallback_text(self.ctx, normalized)
            self._remember_turn(normalized, reply)
            return reply, "livekit_agent_fallback"

        history_window = (
            []
            if self.userdata.caption_mode_enabled
            else build_recent_history_window(self.history)
        )
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
            {
                "role": "system",
                "content": build_scene_prompt(
                    self.ctx,
                    caption_mode_enabled=self.userdata.caption_mode_enabled,
                ),
            },
            {"role": "system", "content": build_preparation_prompt(self.userdata)},
            *history_window,
            {
                "role": "user",
                "content": build_current_turn_prompt(
                    normalized,
                    self.userdata,
                    caption_mode_enabled=self.userdata.caption_mode_enabled,
                ),
            },
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

        self._remember_turn(normalized, reply)
        self.userdata.note_assistant_reply(reply)
        return reply, source

    def _remember_turn(self, user_text: str, reply: str) -> None:
        self.history.extend(
            [
                {"role": "user", "content": user_text},
                {"role": "assistant", "content": reply},
            ]
        )
        self.history = self.history[-REPLY_HISTORY_STORAGE_LIMIT:]
