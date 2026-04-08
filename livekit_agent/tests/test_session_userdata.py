from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from session_context import VoxFlameSessionContext
from session_userdata import build_session_userdata


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
                        "hotwords": ["头痛", "三天"],
                        "asr_hotword_entries": [
                            {"text": "挂号", "weight": 6, "lang": "zh"},
                        ],
                        "listener_guidance": ["如果没听清，请先复述症状。"],
                    },
                },
            ),
        )

        self.assertEqual(userdata.preparation.source, "metadata")
        self.assertEqual(userdata.preparation.hotwords, ["头痛", "三天"])
        self.assertEqual(
            userdata.preparation.asr_hotword_entries,
            [{"text": "挂号", "weight": 6, "lang": "zh"}],
        )
        self.assertIn("描述症状", userdata.preparation.immediate_goal)

    def test_note_user_transcript_tracks_hotword_hits(self) -> None:
        userdata = build_session_userdata(
            create_context(
                participant_payload={
                    "preparation_context": {
                        "immediate_goal": "先准备描述症状的关键一句。",
                        "profile_summary": "用户当前需要稳定描述症状和持续时间。",
                        "hotwords": ["头痛", "三天"],
                        "asr_hotword_entries": [
                            {"text": "挂号", "weight": 6, "lang": "zh"},
                        ],
                    },
                },
            ),
        )

        userdata.note_user_transcript("我头痛三天了，想先挂号。")
        self.assertEqual(userdata.active_hotwords, ["头痛", "三天", "挂号"])


if __name__ == "__main__":
    unittest.main()
