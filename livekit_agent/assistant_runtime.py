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

logger = logging.getLogger("voxflame-livekit-agent.assistant")

SYSTEM_PROMPT = """你是 VoxFlame 的沟通助手。

你的目标不是纠正用户本人，而是帮用户更顺利地把意思表达出去。

回复要求：
1. 默认使用简体中文。
2. 语气温和、直接、支持性强。
3. 只输出一到两句可直接说出去的话。
4. 不要分析，不要解释，不要项目符号，不要自我介绍。
5. 如果是就医、求助、购物等具体场景，优先把最关键的一句说清楚。
"""


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
    scene_hint = f"现在先按“{ctx.scene}”场景继续。" if ctx.scene else "现在先按当前沟通场景继续。"
    return (
        f"{scene_hint}我先帮你把这句话往前推进：{normalized}"
        if normalized
        else "我已经接到你的输入，但还没有拿到可用文本。"
    )


def build_scene_prompt(ctx: VoxFlameSessionContext) -> str:
    scene = ctx.scene or "general"
    return (
        f"当前场景：{scene}\n"
        "请优先输出一句能让对方马上理解用户意图、可以直接代说的表达。"
    )


def _normalize_training_status(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"excellent", "close", "retry", "unclear"}:
            return normalized
    return "unclear"


def _read_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _pick_primary_focus(payload: dict[str, Any]) -> str:
    focus_tags = _read_string_list(payload.get("focus_tags"))
    if focus_tags:
        return focus_tags[0]

    pronunciation_summary = payload.get("pronunciation_summary")
    if isinstance(pronunciation_summary, str) and pronunciation_summary.strip():
        return pronunciation_summary.strip().split("，")[0].split("。")[0].strip()

    exercise_text = payload.get("exercise_text")
    if isinstance(exercise_text, str) and exercise_text.strip():
        return f"先把“{exercise_text.strip()[:6]}”说稳"

    return "先把整句放慢一点"


def _extract_focus_syllables(payload: dict[str, Any], primary_focus: str) -> list[str]:
    focus_tags = _read_string_list(payload.get("focus_tags"))
    candidates = focus_tags or ([primary_focus] if primary_focus else [])
    syllables: list[str] = []
    for item in candidates:
        normalized = item.replace("先补", "").replace("先看", "").replace("“", "").replace("”", "").strip()
        if normalized and normalized not in syllables:
            syllables.append(normalized)
    return syllables[:4]


def _build_pronunciation_targets(primary_focus: str, focus_syllables: list[str]) -> list[str]:
    targets = [item for item in [primary_focus, *focus_syllables] if item]
    deduped: list[str] = []
    for item in targets:
        if item not in deduped:
            deduped.append(item)
    return deduped[:4]


def _pick_articulation_tip(
    payload: dict[str, Any],
    *,
    status: str,
) -> str:
    guidance_profile = payload.get("guidance_profile")
    priority = ""
    severity = ""
    if isinstance(guidance_profile, dict):
        priority = str(guidance_profile.get("priority", "") or "").strip()
        severity = str(guidance_profile.get("severity", "") or "").strip()

    if priority == "clarity":
        return "先把关键词拉开说，嘴巴动作做大一点，别急着整句连过去。"
    if priority == "pace":
        return "先把每个短词之间留一点空隙，让节奏慢下来。"
    if priority == "breath":
        return "先吸一口气再开口，整句只盯一个呼气节奏。"
    if severity == "severe":
        return "先只抓一句里最关键的两个词，把嘴形和节奏做稳。"
    if status == "excellent":
        return "保持刚才这个节奏，只放大关键词，不用整句都用力。"
    if status == "close":
        return "先把最容易糊掉的那个音节单独慢练两遍，再回整句。"
    if status == "retry":
        return "先拆成更短的两段，嘴巴先张开，再把重点词拖清楚。"
    return "先把嘴巴张开一点，把第一个关键词慢慢送出来。"


def _status_to_clarity(status: str) -> float:
    return {
        "excellent": 0.92,
        "close": 0.76,
        "retry": 0.56,
        "unclear": 0.32,
    }.get(status, 0.32)


def build_training_feedback_payload(
    ctx: VoxFlameSessionContext,
    payload: dict[str, Any],
) -> dict[str, Any]:
    status = _normalize_training_status(payload.get("feedback_status"))
    recognized_text = str(payload.get("recognized_text", "") or "").strip()
    exercise_text = str(payload.get("exercise_text", "") or "").strip()
    exercise_id = str(payload.get("exercise_id", "") or ctx.request_id or "").strip()
    category = str(payload.get("exercise_category", "") or ctx.scene or "中文训练").strip()
    focus_tags = _read_string_list(payload.get("focus_tags"))[:6]
    primary_focus = _pick_primary_focus(payload)
    pronunciation_summary = str(payload.get("pronunciation_summary", "") or "").strip()
    clarity_score = _status_to_clarity(status)
    confusion_patterns_count = max(1, len(focus_tags)) if status != "excellent" else 0

    encouragement = {
        "excellent": "这句已经很稳了，可以继续换下一句。",
        "close": "这次已经很接近了，我们只盯一个点继续收口。",
        "retry": "这次先不求整句完美，只改最关键的一处。",
        "unclear": "系统这次没完全听清，但这条练习还是有价值。",
    }[status]
    next_step = {
        "excellent": "保持这个节奏，再换一句高频表达继续练。",
        "close": "先把这个重点音节单独慢练 2 到 3 次，再回整句。",
        "retry": "先拆成短一点的两段，再把关键词连回整句。",
        "unclear": "先把第一关键词单独说清，再补一条完整版本。",
    }[status]
    articulation_tip = _pick_articulation_tip(payload, status=status)
    articulation_tips = [articulation_tip]
    summary = (
        f"这次先重点看“{primary_focus}”。"
        if primary_focus
        else "这次先盯一个关键词，把它说稳。"
    )
    primary_pinyin = focus_tags[0] if focus_tags else ""
    focus_syllables = _extract_focus_syllables(payload, primary_focus)
    pronunciation_targets = _build_pronunciation_targets(primary_focus, focus_syllables)
    keywords = focus_tags[:3] if focus_tags else ([category] if category else [])

    return {
        "feedback_request_id": exercise_id or ctx.request_id or "",
        "exercise_id": exercise_id,
        "exercise_text": exercise_text,
        "recognized_text": recognized_text,
        "feedback_status": status,
        "exercise_category": category,
        "clarity_score": clarity_score,
        "summary": summary,
        "focus_tags": focus_tags,
        "keywords": keywords,
        "pronunciation_summary": pronunciation_summary or summary,
        "confusion_patterns_count": confusion_patterns_count,
        "persisted": False,
        "memory_enabled": True,
        "voice_profile_update_requested": True,
        "voice_profile_updated": True,
        "encouragement": encouragement,
        "primary_focus": primary_focus,
        "primary_pinyin": primary_pinyin,
        "articulation_tip": articulation_tip,
        "articulation_tips": articulation_tips,
        "focus_syllables": focus_syllables,
        "pronunciation_targets": pronunciation_targets,
        "pronunciation_initial_pairs": [],
        "pronunciation_final_pairs": [],
        "pronunciation_tone_pairs": [],
        "next_step": next_step,
        "source": "livekit_training_feedback",
        "error": None,
        "metadata": {
            "request_id": ctx.request_id,
            "surface": ctx.surface,
            "mode": ctx.mode,
            "scene": ctx.scene,
        },
    }


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
    client: DashScopeChatClient | None = None
    history: list[dict[str, str]] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.client is None and self.config.dashscope_api_key:
            self.client = DashScopeChatClient(
                api_key=self.config.dashscope_api_key,
                base_url=self.config.dashscope_base_url,
                model=self.config.dashscope_llm_model,
                timeout_seconds=self.config.dashscope_timeout_seconds,
            )

    async def generate_reply(self, user_text: str) -> tuple[str, str]:
        normalized = user_text.strip()
        if not normalized:
            return build_fallback_text(self.ctx, normalized), "livekit_agent_fallback"

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
            *self.history,
        ]

        try:
            if isinstance(self.client, DashScopeChatClient):
                reply = await asyncio.to_thread(self.client.complete, messages)
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
        return reply, source
