from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from session_context import VoxFlameSessionContext
from session_userdata import (
    build_session_compaction_candidate,
    build_preparation_context_pack_from_payload,
    build_session_userdata,
)


def create_context(**overrides: object) -> VoxFlameSessionContext:
    base = dict(
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
        participant_payload={},
        dispatch_payload={},
    )
    base.update(overrides)
    return VoxFlameSessionContext(**base)


class SessionUserDataTests(unittest.TestCase):
    def test_build_session_userdata_falls_back_to_derived_pack(self) -> None:
        userdata = build_session_userdata(create_context())

        self.assertEqual(userdata.preparation.source, "derived_minimal_v1")
        self.assertEqual(userdata.session_memory.context_revision, 1)
        self.assertEqual(userdata.session_memory.last_preparation_source, "derived_minimal_v1")
        self.assertFalse(userdata.voice_reply_enabled)
        self.assertTrue(userdata.should_skip_tts())
        self.assertIn("最关键的一句表达", userdata.preparation.immediate_goal)
        self.assertEqual(userdata.preparation.scene, "medical")

    def test_build_session_userdata_prefers_metadata_pack(self) -> None:
        userdata = build_session_userdata(
            create_context(
                participant_payload={
                    "preparation_context": {
                        "scene": "medical",
                        "immediate_goal": "先准备描述症状的关键一句。",
                        "profile_summary": "用户当前需要稳定描述症状和持续时间。",
                        "hotwords": ["挂号", "邱生峰"],
                        "risky_terms": ["邱文峰"],
                        "document_content": "大家好，我叫邱生峰。今天我想先介绍 VoxFlame。",
                        "reference_lines": ["大家好，我叫邱生峰。"],
                        "training_pairs": [
                            {"target": "我叫邱生峰。", "heard": "我叫邱文峰。", "occurrence_count": 3},
                        ],
                        "listener_guidance": ["如果没听清，请先复述症状。"],
                    },
                },
            ),
        )

        self.assertEqual(userdata.preparation.source, "metadata")
        self.assertIn("邱生峰", userdata.preparation.document_content)
        self.assertEqual(
            userdata.preparation.training_pairs,
            [{"target": "我叫邱生峰。", "heard": "我叫邱文峰。", "occurrence_count": 3}],
        )
        self.assertEqual(userdata.preparation.hotwords, ["挂号", "邱生峰"])
        self.assertEqual(userdata.preparation.risky_terms, ["邱文峰"])
        self.assertIn("描述症状", userdata.preparation.immediate_goal)

    def test_build_session_userdata_skips_voice_reply_for_training_workspace(self) -> None:
        userdata = build_session_userdata(create_context(surface="training_workspace", mode="training"))

        self.assertFalse(userdata.voice_reply_enabled)
        self.assertTrue(userdata.should_skip_tts())

    def test_build_preparation_context_pack_from_payload_reads_document_and_pairs(self) -> None:
        preparation = build_preparation_context_pack_from_payload(
            {
                "immediate_goal": "先把开场说清楚。",
                "profile_summary": "已有参考全文和错配对。",
                "document_content": "大家好，我叫邱生峰。",
                "loadout_mode": "long_form",
                "loadout_reason": "当前已有完整准备稿，优先按长时间沟通模式装配。",
                "loadout_items": [
                    "默认 | 默认常驻 | 用户个人画像：围绕稳定表达规律继续装配。",
                    "辅助 | 最近沉淀 | 当前训练总结：最近一次训练总结可帮助减少误听。",
                ],
                "hotwords": ["挂号", "邱生峰"],
                "risky_terms": ["邱文峰"],
                "training_pairs": [
                    {"target": "邱生峰", "heard": "邱文峰", "occurrence_count": 2},
                ],
            },
            fallback_scene="medical",
        )

        self.assertIsNotNone(preparation)
        assert preparation is not None
        self.assertEqual(preparation.scene, "medical")
        self.assertEqual(preparation.document_content, "大家好，我叫邱生峰。")
        self.assertEqual(preparation.training_pairs[0]["heard"], "邱文峰")
        self.assertEqual(preparation.loadout_mode, "long_form")
        self.assertEqual(len(preparation.loadout_items), 2)
        self.assertEqual(preparation.hotwords, ["挂号", "邱生峰"])
        self.assertEqual(preparation.risky_terms, ["邱文峰"])

    def test_build_preparation_context_pack_from_payload_accepts_document_only_update(self) -> None:
        preparation = build_preparation_context_pack_from_payload(
            {
                "document_content": "大家好，我叫邱生峰，在生声不息科技做 AI 智能体。",
                "training_pairs": [
                    {"target": "邱生峰", "heard": "邱文峰", "occurrence_count": 2},
                ],
            },
            fallback_scene="medical",
        )

        self.assertIsNotNone(preparation)
        assert preparation is not None
        self.assertEqual(preparation.scene, "medical")
        self.assertIn("邱生峰", preparation.document_content)
        self.assertEqual(preparation.training_pairs[0]["target"], "邱生峰")
        self.assertIn("当前准备上下文已载入", preparation.profile_summary)

    def test_build_preparation_context_pack_from_payload_accepts_loadout_only_update(self) -> None:
        preparation = build_preparation_context_pack_from_payload(
            {
                "loadout_mode": "urgent",
                "loadout_reason": "当前更适合轻量 loadout 先开口。",
                "loadout_items": [
                    "默认 | 默认常驻 | 固定补救句：请您慢一点，我再说一次。",
                ],
            },
            fallback_scene="medical",
        )

        self.assertIsNotNone(preparation)
        assert preparation is not None
        self.assertEqual(preparation.loadout_mode, "urgent")
        self.assertIn("轻量 loadout", preparation.loadout_reason)
        self.assertEqual(
            preparation.loadout_items,
            ["默认 | 默认常驻 | 固定补救句：请您慢一点，我再说一次。"],
        )

    def test_caption_mode_still_skips_tts_when_voice_reply_is_enabled(self) -> None:
        userdata = build_session_userdata(create_context(surface="training_workspace", mode="training"))

        userdata.set_caption_mode(True)

        self.assertTrue(userdata.should_skip_tts())

    def test_note_user_transcript_stores_latest_text(self) -> None:
        userdata = build_session_userdata(
            create_context(
                participant_payload={
                    "preparation_context": {
                        "immediate_goal": "先准备描述症状的关键一句。",
                        "profile_summary": "用户当前需要稳定描述症状和持续时间。",
                        "document_content": "大家好，我叫邱生峰。",
                    },
                },
            ),
        )

        userdata.note_user_transcript("我头痛三天了，想先挂号。")
        self.assertEqual(userdata.session_memory.current_user_transcript, "我头痛三天了，想先挂号。")

    def test_note_assistant_reply_builds_recent_turn_memory(self) -> None:
        userdata = build_session_userdata(create_context())

        userdata.note_user_transcript("我头痛三天了，想先挂号。")
        userdata.note_assistant_reply("我头痛三天了，想先挂号。", source="dashscope_chat_completion")

        self.assertEqual(userdata.session_memory.turn_count, 1)
        self.assertEqual(userdata.session_memory.current_assistant_reply, "我头痛三天了，想先挂号。")
        self.assertEqual(len(userdata.session_memory.recent_turns), 1)
        self.assertEqual(userdata.session_memory.recent_turns[0].user_text, "我头痛三天了，想先挂号。")
        self.assertEqual(userdata.session_memory.recent_turns[0].source, "dashscope_chat_completion")

    def test_replace_preparation_increments_context_revision(self) -> None:
        userdata = build_session_userdata(create_context())
        next_preparation = build_preparation_context_pack_from_payload(
            {
                "document_content": "医生您好，我想先挂号。",
            },
            fallback_scene="medical",
        )

        assert next_preparation is not None
        userdata.replace_preparation(next_preparation)

        self.assertEqual(userdata.session_memory.context_revision, 2)
        self.assertEqual(userdata.session_memory.last_preparation_source, "runtime_update")

    def test_build_session_compaction_candidate_prefers_latest_confirmed_expression(self) -> None:
        userdata = build_session_userdata(create_context())
        userdata.note_user_transcript("我头痛三天了")
        userdata.note_assistant_reply("我头痛三天了，想先挂号。", source="dashscope_chat_completion")

        candidate = build_session_compaction_candidate(
            userdata.preparation,
            userdata.session_memory,
            session_kind="communication",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate.session_kind, "communication")
        self.assertIn("更稳的表达", candidate.summary)
        self.assertEqual(candidate.fallback_phrases[0], "我头痛三天了，想先挂号。")
        self.assertEqual(candidate.risky_terms[0], "我头痛三天了")
        self.assertEqual(candidate.turn_count, 1)


if __name__ == "__main__":
    unittest.main()
