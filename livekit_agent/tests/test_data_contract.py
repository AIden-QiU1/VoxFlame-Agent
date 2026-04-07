from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_contract import (
    build_audio_input_telemetry_output,
    build_assistant_text_output,
    build_error_output,
    build_session_init_ack,
    build_session_userdata_ack,
    build_speech_activity_output,
    build_user_transcript_output,
    build_voice_profile_updated_output,
    decode_data_packet,
    extract_end_audio_reason,
    extract_training_feedback_request,
    extract_user_text_input,
)
from session_context import VoxFlameSessionContext
from session_userdata import PreparationContextPack


def create_context() -> VoxFlameSessionContext:
    return VoxFlameSessionContext(
        request_id="req-123",
        room_name="vox-room",
        participant_identity="vox-user-1",
        participant_name="Qiu",
        mode="communication",
        surface="communication_workspace",
        scene="medical",
        session_strategy="heavy_realtime",
        requested_capabilities=["transport_send_control"],
        granted_capabilities=["transport_send_control"],
    )


class DataContractTests(unittest.TestCase):
    def test_decode_data_packet_accepts_json_bytes(self) -> None:
        payload = json.dumps({"type": "user_input", "input_type": "text", "text": "你好"}).encode("utf-8")
        decoded = decode_data_packet(payload)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded["type"], "user_input")

    def test_extract_user_text_input_reads_text_only(self) -> None:
        message = {
            "type": "user_input",
            "input_type": "text",
            "text": "  请帮我说慢一点  ",
        }

        self.assertEqual(extract_user_text_input(message), "请帮我说慢一点")
        self.assertIsNone(extract_user_text_input({"type": "end_audio"}))
        self.assertEqual(extract_end_audio_reason({"type": "end_audio", "reason": "manual_stop"}), "manual_stop")

    def test_extract_training_feedback_request_reads_training_message(self) -> None:
        message = {
            "type": "training_feedback_request",
            "exercise_id": "exercise-1",
        }
        payload = extract_training_feedback_request(message)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["exercise_id"], "exercise-1")

    def test_build_session_init_ack_exposes_runtime_metadata(self) -> None:
        payload = build_session_init_ack(create_context())

        self.assertEqual(payload["type"], "session_init_ack")
        self.assertEqual(payload["metadata"]["surface"], "communication_workspace")
        self.assertEqual(payload["metadata"]["request_id"], "req-123")

    def test_build_session_userdata_ack_exposes_preparation_context(self) -> None:
        payload = build_session_userdata_ack(
            create_context(),
            PreparationContextPack(
                source="metadata",
                scene="medical",
                immediate_goal="先准备就医时最关键的一句表达。",
                profile_summary="用户当前就医场景下需要优先保真和少扩写。",
                listener_guidance=["如果没听清，请直接复述确认。"],
                support_strategies=["优先突出症状和诉求。"],
                hotwords=["挂号", "疼痛"],
            ),
        )

        self.assertEqual(payload["type"], "session_userdata_ack")
        self.assertEqual(payload["metadata"]["source"], "metadata")
        self.assertEqual(payload["preparation"]["hotwords"], ["挂号", "疼痛"])

    def test_build_assistant_text_output_matches_frontend_reducer_shape(self) -> None:
        payload = build_assistant_text_output(create_context(), "我想挂号")

        self.assertEqual(payload["type"], "transcript")
        self.assertEqual(payload["role"], "assistant")
        self.assertTrue(payload["is_final"])
        self.assertIn("我想挂号", payload["text"])
        self.assertEqual(payload["metadata"]["type"], "assistant_text_output")

    def test_build_assistant_text_output_supports_correction_metadata(self) -> None:
        payload = build_assistant_text_output(
            create_context(),
            "医生您好，我说话会慢一点。",
            source="dashscope_chat_completion",
            metadata_type="correction",
            original_text="我说话慢一点",
        )

        self.assertEqual(payload["metadata"]["type"], "correction")
        self.assertEqual(payload["metadata"]["original"], "我说话慢一点")
        self.assertEqual(payload["metadata"]["source"], "dashscope_chat_completion")

    def test_build_user_transcript_output_matches_frontend_reducer_shape(self) -> None:
        payload = build_user_transcript_output(create_context(), "我想挂号", is_final=False)

        self.assertEqual(payload["type"], "transcript")
        self.assertEqual(payload["role"], "user")
        self.assertFalse(payload["is_final"])
        self.assertEqual(payload["metadata"]["type"], "user_transcript_output")

    def test_build_voice_profile_updated_output_matches_frontend_reducer_shape(self) -> None:
        payload = build_voice_profile_updated_output(
            create_context(),
            source="livekit_correction",
            clarity_score=0.72,
            confusion_patterns_count=1,
            exercise_id="exercise-1",
            hotword_count=2,
            last_training_category="medical",
        )

        self.assertEqual(payload["type"], "voice_profile_updated")
        self.assertEqual(payload["source"], "livekit_correction")
        self.assertEqual(payload["clarity_score"], 0.72)
        self.assertEqual(payload["confusion_patterns_count"], 1)
        self.assertEqual(payload["exercise_id"], "exercise-1")
        self.assertEqual(payload["hotword_count"], 2)
        self.assertEqual(payload["last_training_category"], "medical")
        self.assertEqual(payload["exercise_category"], "medical")

    def test_build_speech_activity_output_matches_turn_contract(self) -> None:
        payload = build_speech_activity_output(
            create_context(),
            state="speech_started",
            auto_finalize=False,
            interruption_requested=False,
            speech_duration_ms=180,
        )

        self.assertEqual(payload["type"], "speech_activity")
        self.assertEqual(payload["state"], "speech_started")
        self.assertFalse(payload["auto_finalize"])
        self.assertFalse(payload["interruption_requested"])
        self.assertEqual(payload["speech_duration_ms"], 180)
        self.assertEqual(payload["metadata"]["scene"], "medical")

    def test_build_audio_input_telemetry_output_matches_runtime_shape(self) -> None:
        payload = build_audio_input_telemetry_output(
            create_context(),
            normalized_level=0.12,
            peak_level=0.91,
            clipping_detected=False,
            apm_enabled=True,
            reason="speech_stopped",
        )

        self.assertEqual(payload["type"], "audio_input_telemetry")
        self.assertEqual(payload["reason"], "speech_stopped")
        self.assertEqual(payload["normalized_level"], 0.12)
        self.assertEqual(payload["peak_level"], 0.91)
        self.assertFalse(payload["clipping_detected"])
        self.assertTrue(payload["apm_enabled"])
        self.assertEqual(payload["metadata"]["request_id"], "req-123")

    def test_build_error_output_uses_error_envelope(self) -> None:
        payload = build_error_output("worker failed")
        self.assertEqual(payload["type"], "error")
        self.assertEqual(payload["message"], "worker failed")


if __name__ == "__main__":
    unittest.main()
