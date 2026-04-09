from __future__ import annotations

import asyncio
import difflib
import json
import logging
import time
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
9. 如果当前 ASR 和准备稿原句或训练过的目标句明显接近，优先恢复到这些原句。
10. 尤其保护人名、机构名、产品名、数字和专业术语，尽量不要把它们改坏。
11. 如果信息仍不确定，选择更短、更保守、不新增事实的表达。
12. 把输入视为“多数高置信片段 + 少量误听片段”，优先保留高置信片段原样，只做局部替换。
13. 只允许做同音/近音纠错、漏字补齐、标点整理和准备稿对齐，不要整句改写。
"""

CAPTION_SYSTEM_PROMPT = """你是 VoxFlame 的实时字幕纠错助手。

你的任务不是替用户发挥，而是把用户刚刚说出的这一句整理成最终展示字幕。

回复要求：
1. 默认使用简体中文。
2. 只输出当前这句话的最终字幕，不要解释，不要补充，不要续写。
3. 先保留用户原意、专有名词、数字、时间、地点和疾病名。
4. 只做最小必要纠错，不要为了更顺而新增事实。
5. 如果信息仍不确定，优先保守保留，不要猜测。
6. 如果这句话和准备稿参考原句或训练过的目标句明显接近，优先恢复到对应原句。
7. 把这句话视为“多数高置信片段 + 少量误听片段”，优先复制正确片段，只修局部错误。
"""

REPLY_HISTORY_WINDOW_MESSAGES = 6
REPLY_HISTORY_STORAGE_LIMIT = 12


def estimate_clarity_score(original_text: str, corrected_text: str) -> float:
    original = original_text.strip()
    corrected = corrected_text.strip()
    if not original or not corrected:
        return 0.0
    if original == corrected:
        return 1.0
    ratio = difflib.SequenceMatcher(a=original, b=corrected).ratio()
    return max(0.0, min(1.0, round(ratio, 4)))


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


def _format_reference_lines(lines: list[str], *, max_items: int, max_chars: int) -> list[str]:
    results: list[str] = []
    total_chars = 0

    for line in lines:
        normalized = line.strip()
        if not normalized or normalized in results:
            continue
        next_total_chars = total_chars + len(normalized)
        if results and next_total_chars > max_chars:
            break
        results.append(normalized)
        total_chars = next_total_chars
        if len(results) >= max_items:
            break

    return results


def _format_training_pairs(
    pairs: list[dict[str, Any]],
    *,
    max_items: int,
    max_chars: int,
) -> list[str]:
    results: list[str] = []
    total_chars = 0

    for pair in pairs:
        target = pair.get("target")
        heard = pair.get("heard")
        if not isinstance(target, str) or not target.strip():
            continue
        if not isinstance(heard, str) or not heard.strip():
            continue
        occurrence_count = pair.get("occurrence_count")
        normalized_occurrence_count = (
            int(occurrence_count)
            if isinstance(occurrence_count, int) and occurrence_count > 1
            else 1
        )
        line = (
            f"{normalized_occurrence_count}次 | 目标：{target.strip()} | 系统常听成：{heard.strip()}"
        )
        if line in results:
            continue
        next_total_chars = total_chars + len(line)
        if results and next_total_chars > max_chars:
            break
        results.append(line)
        total_chars = next_total_chars
        if len(results) >= max_items:
            break

    return results


def build_preparation_prompt(userdata: VoxFlameSessionUserData) -> str:
    preparation = userdata.preparation
    reference_lines = _format_reference_lines(
        preparation.reference_lines,
        max_items=80,
        max_chars=3600,
    )
    training_pairs = _format_training_pairs(
        preparation.training_pairs,
        max_items=80,
        max_chars=3600,
    )
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
    if preparation.document_summary and not preparation.document_content:
        lines.append(f"- 准备稿摘要：{_truncate_text(preparation.document_summary, 220)}")
    if preparation.document_content:
        lines.append("- 准备稿全文：")
        lines.append(preparation.document_content.strip())
    elif reference_lines:
        lines.append("- 准备稿参考原句：")
        lines.extend(f"  {index + 1}. {_truncate_text(line, 80)}" for index, line in enumerate(reference_lines))
    if training_pairs:
        lines.append("- 已训练错配对：")
        lines.extend(f"  - {_truncate_text(line, 120)}" for line in training_pairs)
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
    if userdata.preparation.reference_lines:
        lines.append("如果当前句和准备稿参考原句明显接近，优先恢复到对应原句。")
    if userdata.preparation.training_pairs:
        lines.append("如果当前句和已训练的目标句/误听句对明显接近，优先恢复到对应目标句。")
    lines.append("只允许做局部纠错：同音/近音替换、漏字补齐、标点整理、准备稿对齐。")
    lines.append(
        "请只输出当前这句话的最终展示字幕。"
        if caption_mode_enabled
        else "请只输出最终可直接说出去的话。"
    )
    return "\n".join(lines)


def build_cacheable_content(text: str) -> list[dict[str, Any]]:
    return [
        {
            "type": "text",
            "text": text,
            "cache_control": {"type": "ephemeral"},
        }
    ]


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

    def complete(self, messages: list[dict[str, Any]]) -> "DashScopeCompletionResult":
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
        usage = parsed.get("usage")
        prompt_tokens = usage.get("prompt_tokens") if isinstance(usage, dict) else None
        completion_tokens = usage.get("completion_tokens") if isinstance(usage, dict) else None

        prompt_token_details = usage.get("prompt_tokens_details") if isinstance(usage, dict) else None
        cached_tokens = (
            prompt_token_details.get("cached_tokens")
            if isinstance(prompt_token_details, dict)
            else None
        )
        cache_creation_input_tokens = (
            prompt_token_details.get("cache_creation_input_tokens")
            if isinstance(prompt_token_details, dict)
            else None
        )
        return DashScopeCompletionResult(
            text=text,
            prompt_tokens=prompt_tokens if isinstance(prompt_tokens, int) else None,
            completion_tokens=completion_tokens if isinstance(completion_tokens, int) else None,
            cached_tokens=cached_tokens if isinstance(cached_tokens, int) else None,
            cache_creation_input_tokens=(
                cache_creation_input_tokens
                if isinstance(cache_creation_input_tokens, int)
                else None
            ),
        )


@dataclass(frozen=True)
class DashScopeCompletionResult:
    text: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    cached_tokens: int | None = None
    cache_creation_input_tokens: int | None = None


class AssistantReplyGenerationError(RuntimeError):
    def __init__(self, user_message: str, *, code: str, detail: str | None = None) -> None:
        super().__init__(detail or user_message)
        self.user_message = user_message
        self.code = code
        self.detail = detail or user_message


def _normalize_completion_result(
    raw_result: str | DashScopeCompletionResult,
) -> DashScopeCompletionResult:
    if isinstance(raw_result, DashScopeCompletionResult):
        return raw_result

    normalized = raw_result.strip()
    if not normalized:
        raise RuntimeError("DashScope returned an empty reply")
    return DashScopeCompletionResult(text=normalized)


def _classify_generation_failure(exc: Exception) -> AssistantReplyGenerationError:
    detail = str(exc).strip() or exc.__class__.__name__
    lowered = detail.lower()
    if "timed out" in lowered or "timeout" in lowered:
        return AssistantReplyGenerationError(
            "本句整理超时，请再说一次完整句子。",
            code="correction_timeout",
            detail=detail,
        )
    return AssistantReplyGenerationError(
        "本句整理失败，请再说一次完整句子。",
        code="correction_failed",
        detail=detail,
    )


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
                timeout_seconds=self.config.dashscope_timeout_seconds,
            )

    def _build_system_prompt(self) -> str:
        return CAPTION_SYSTEM_PROMPT if self.userdata.caption_mode_enabled else SYSTEM_PROMPT

    async def generate_reply(self, user_text: str) -> tuple[str, str]:
        normalized = user_text.strip()
        if not normalized:
            raise AssistantReplyGenerationError(
                "未收到可整理的语音内容，请再说一遍。",
                code="empty_transcript",
            )

        self.userdata.note_user_transcript(normalized)

        if self.client is None:
            raise AssistantReplyGenerationError(
                "纠错模型未配置，暂时无法整理这句话。",
                code="llm_unavailable",
            )

        history_window = (
            []
            if self.userdata.caption_mode_enabled
            else build_recent_history_window(self.history)
        )
        stable_prompt = "\n\n".join(
            [
                self._build_system_prompt(),
                build_scene_prompt(
                    self.ctx,
                    caption_mode_enabled=self.userdata.caption_mode_enabled,
                ),
                build_preparation_prompt(self.userdata),
            ]
        )
        messages = [
            {
                "role": "system",
                "content": build_cacheable_content(stable_prompt),
            },
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
        started_at = time.perf_counter()
        soft_target_ms = round(self.config.dashscope_reply_timeout_seconds * 1000)

        try:
            if isinstance(self.client, DashScopeChatClient):
                raw_result = await asyncio.to_thread(self.client.complete, messages)
            else:
                raw_result = self.client.complete(messages)
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - started_at) * 1000)
            classified_error = _classify_generation_failure(exc)
            logger.warning(
                "DashScope correction failed room=%s participant=%s scene=%s latency_ms=%s soft_target_ms=%s code=%s error=%s",
                self.ctx.room_name,
                self.ctx.participant_identity,
                self.ctx.scene,
                elapsed_ms,
                soft_target_ms,
                classified_error.code,
                classified_error.detail,
            )
            raise classified_error from exc

        completion = _normalize_completion_result(raw_result)
        reply = completion.text.strip()
        if not reply:
            raise AssistantReplyGenerationError(
                "本句整理失败，请再说一次完整句子。",
                code="empty_correction",
            )

        elapsed_ms = round((time.perf_counter() - started_at) * 1000)
        logger.info(
            "DashScope correction completed room=%s participant=%s scene=%s latency_ms=%s soft_target_ms=%s exceeded_soft_target=%s prompt_tokens=%s cached_tokens=%s cache_creation_input_tokens=%s completion_tokens=%s reply_chars=%s",
            self.ctx.room_name,
            self.ctx.participant_identity,
            self.ctx.scene,
            elapsed_ms,
            soft_target_ms,
            elapsed_ms > soft_target_ms,
            completion.prompt_tokens,
            completion.cached_tokens,
            completion.cache_creation_input_tokens,
            completion.completion_tokens,
            len(reply),
        )
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
