from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from session_context import build_session_context


class SessionContextTests(unittest.TestCase):
    def test_prefers_dispatch_metadata_for_request_and_identity(self) -> None:
        participant_metadata = json.dumps(
            {
                "request_id": "participant-req",
                "session_intent": {
                    "surface": "communication_workspace",
                    "mode": "communication",
                    "sessionStrategy": "heavy_realtime",
                    "requestedCapabilities": ["transport_send_control"],
                },
                "granted_capabilities": ["workspace_snapshot_read"],
            }
        )
        dispatch_metadata = json.dumps(
            {
                "request_id": "dispatch-req",
                "participant_identity": "vox-user-42-dispatch",
                "session_intent": {
                    "scene": "medical",
                    "requestedCapabilities": ["training_feedback_request"],
                },
                "granted_capabilities": ["transport_send_control"],
            }
        )

        ctx = build_session_context(
            room_name="vox-room-1",
            participant_identity="vox-user-42-participant",
            participant_name="Qiu",
            metadata=participant_metadata,
            job_metadata=dispatch_metadata,
            attributes={"vox.surface": "communication_workspace"},
        )

        self.assertEqual(ctx.request_id, "dispatch-req")
        self.assertEqual(ctx.participant_identity, "vox-user-42-dispatch")
        self.assertEqual(ctx.surface, "communication_workspace")
        self.assertEqual(ctx.scene, "medical")
        self.assertEqual(
            ctx.requested_capabilities,
            ["transport_send_control", "training_feedback_request"],
        )
        self.assertEqual(
            ctx.granted_capabilities,
            ["workspace_snapshot_read", "transport_send_control"],
        )

    def test_falls_back_when_metadata_is_missing(self) -> None:
        ctx = build_session_context(
            room_name="vox-room-2",
            participant_identity="vox-user-7",
            participant_name=None,
            metadata=None,
            job_metadata=None,
            attributes=None,
        )

        self.assertIsNone(ctx.request_id)
        self.assertEqual(ctx.mode, "communication")
        self.assertEqual(ctx.surface, "communication_workspace")
        self.assertEqual(ctx.session_strategy, "heavy_realtime")
        self.assertEqual(ctx.requested_capabilities, [])
        self.assertEqual(ctx.granted_capabilities, [])


if __name__ == "__main__":
    unittest.main()
