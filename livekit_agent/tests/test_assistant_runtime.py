from __future__ import annotations

import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from assistant_runtime import (
    CommunicationAssistantRuntime,
    DashScopeChatClient,
    build_fallback_text,
    build_preparation_prompt,
    build_training_feedback_payload,
    estimate_clarity_score,
    extract_text_from_completion,
)
from config import LiveKitAgentConfig
from session_context import VoxFlameSessionContext
from session_userdata import build_session_userdata


def create_config() -> LiveKitAgentConfig:
    return LiveKitAgentConfig(
        livekit_url="ws://127.0.0.1:7880",
        livekit_api_key="devkey",
        livekit_api_secret="secret",
        agent_name="voxflame-agent",
        mode="communication_stub",
        dashscope_api_key=None,
        dashscope_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        dashscope_llm_model="qwen3.5-flash",
        dashscope_timeout_seconds=15.0,
        dashscope_reply_timeout_seconds=4.5,
        dashscope_asr_url="wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        dashscope_asr_model="qwen3-asr-flash-realtime",
        dashscope_asr_sample_rate=16000,
        dashscope_asr_language="zh",
        dashscope_asr_enable_interim=True,
        dashscope_asr_connect_timeout_seconds=15,
        livekit_audio_apm_enabled=True,
        livekit_audio_apm_echo_cancellation=False,
        livekit_audio_apm_noise_suppression=True,
        livekit_audio_apm_high_pass_filter=True,
        livekit_audio_apm_auto_gain_control=False,
        dashscope_asr_vad_threshold=0.018,
        dashscope_asr_vad_silence_duration_ms=720,
        dashscope_asr_vad_hop_size_ms=16,
        dashscope_asr_barge_in_min_speech_ms=220,
        dashscope_tts_url="wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        dashscope_tts_model="qwen3-tts-flash-realtime",
        dashscope_tts_voice="Cherry",
        dashscope_tts_sample_rate=16000,
        dashscope_tts_connect_timeout_seconds=15,
        dashscope_tts_request_timeout_seconds=20.0,
        log_level="info",
    )


def create_context() -> VoxFlameSessionContext:
    return VoxFlameSessionContext(
        request_id="req-1",
        room_name="room-1",
        participant_identity="user-1",
        participant_name="User",
        surface="communication_workspace",
        mode="communication",
        scene="medical",
        session_strategy="heavy_realtime",
        requested_capabilities=["transport_send_control"],
        granted_capabilities=["transport_send_control"],
        raw_participant_metadata=None,
        raw_job_metadata=None,
        raw_attributes={},
    )


class FakeDashScopeClient:
    def __init__(self, text: str) -> None:
        self.text = text
        self.requests: list[list[dict[str, str]]] = []

    def complete(self, messages: list[dict[str, str]]) -> str:
        self.requests.append(messages)
        return self.text


class TestAssistantRuntime(unittest.TestCase):
    def test_estimate_clarity_score_prefers_identical_text(self) -> None:
        self.assertEqual(estimate_clarity_score("我想挂号", "我想挂号"), 1.0)

    def test_estimate_clarity_score_decreases_when_text_changes(self) -> None:
        score = estimate_clarity_score("我说话慢一点", "医生您好，我说话会慢一点，请等我说完。")
        self.assertGreaterEqual(score, 0.0)
        self.assertLess(score, 1.0)

    def test_extract_text_from_completion_reads_string_content(self) -> None:
        text = extract_text_from_completion(
            {"choices": [{"message": {"content": "你好，我来帮你。"}}]},
        )
        self.assertEqual(text, "你好，我来帮你。")

    def test_extract_text_from_completion_reads_parts_content(self) -> None:
        text = extract_text_from_completion(
            {
                "choices": [
                    {
                        "message": {
                            "content": [
                                {"type": "text", "text": "第一句。"},
                                {"type": "text", "text": "第二句。"},
                            ],
                        },
                    },
                ],
            },
        )
        self.assertEqual(text, "第一句。第二句。")

    def test_generate_reply_uses_fallback_without_dashscope(self) -> None:
        runtime = CommunicationAssistantRuntime(
            config=create_config(),
            ctx=create_context(),
            userdata=build_session_userdata(create_context()),
        )
        reply, source = asyncio.run(runtime.generate_reply("请帮我叫医生"))
        self.assertEqual(source, "livekit_agent_fallback")
        self.assertEqual(reply, build_fallback_text(create_context(), "请帮我叫医生"))

    def test_generate_reply_uses_client_when_available(self) -> None:
        fake_client = FakeDashScopeClient("请先帮我叫医生，我需要马上处理。")
        runtime = CommunicationAssistantRuntime(
            config=create_config(),
            ctx=create_context(),
            userdata=build_session_userdata(create_context()),
            client=fake_client,
        )
        reply, source = asyncio.run(runtime.generate_reply("请帮我叫医生"))
        self.assertEqual(source, "dashscope_chat_completion")
        self.assertEqual(reply, "请先帮我叫医生，我需要马上处理。")
        self.assertEqual(fake_client.requests[0][-1]["content"], "请帮我叫医生")
        self.assertTrue(
            any("当前准备目标" in message["content"] for message in fake_client.requests[0][:-1]),
        )

    def test_generate_reply_falls_back_quickly_when_dashscope_reply_times_out(self) -> None:
        config = create_config()
        object.__setattr__(config, "dashscope_reply_timeout_seconds", 0.01)
        runtime = CommunicationAssistantRuntime(
            config=config,
            ctx=create_context(),
            userdata=build_session_userdata(create_context()),
            client=DashScopeChatClient(
                api_key="dashscope-test",
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                model="qwen3.5-flash",
                timeout_seconds=0.01,
            ),
        )

        async def slow_to_thread(*args, **kwargs):  # noqa: ANN002, ANN003
            await asyncio.sleep(0.05)
            return "这条不该返回"

        with patch("assistant_runtime.asyncio.to_thread", slow_to_thread):
            reply, source = asyncio.run(runtime.generate_reply("我渴了"))

        self.assertEqual(source, "livekit_agent_fallback")
        self.assertEqual(reply, "我渴了")

    def test_build_preparation_prompt_includes_hotwords(self) -> None:
        userdata = build_session_userdata(create_context())
        userdata.preparation.hotwords = ["挂号", "复诊"]
        prompt = build_preparation_prompt(userdata)
        self.assertIn("当前准备目标", prompt)
        self.assertIn("挂号", prompt)

    def test_build_training_feedback_payload_matches_training_page_contract(self) -> None:
        payload = build_training_feedback_payload(
            create_context(),
            {
                "exercise_id": "exercise-1",
                "exercise_text": "请先听我说完",
                "exercise_category": "outing",
                "recognized_text": "请先听我说话",
                "feedback_status": "retry",
                "focus_tags": ["听我说完", "节奏"],
                "pronunciation_summary": "后半句容易被吞掉。",
                "guidance_profile": {
                    "priority": "clarity",
                    "severity": "moderate",
                },
            },
        )

        self.assertEqual(payload["exercise_id"], "exercise-1")
        self.assertEqual(payload["feedback_status"], "retry")
        self.assertEqual(payload["voice_profile_updated"], True)
        self.assertEqual(payload["voice_profile_update_requested"], True)
        self.assertEqual(payload["source"], "livekit_training_feedback")
        self.assertIn("听我说完", payload["summary"])
        self.assertIn("关键词", payload["articulation_tip"])


if __name__ == "__main__":
    unittest.main()
