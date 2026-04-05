from __future__ import annotations

import sys
import unittest
import importlib.util
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tts_runtime import pcm_bytes_to_audio_frame


class TTSRuntimeTests(unittest.TestCase):
    def test_pcm_bytes_to_audio_frame_builds_frame(self) -> None:
        if importlib.util.find_spec("livekit") is None:
            self.skipTest("livekit package is only installed in the worker runtime")
        pcm = (b"\x00\x00\x10\x00" * 160)
        frame = pcm_bytes_to_audio_frame(pcm, sample_rate=16000, num_channels=1)
        self.assertEqual(frame.sample_rate, 16000)
        self.assertEqual(frame.num_channels, 1)
        self.assertEqual(frame.samples_per_channel, 320)


if __name__ == "__main__":
    unittest.main()
