import importlib.util
import unittest
from pathlib import Path

import numpy as np

SCRIPT = Path(__file__).resolve().parents[1] / 'web-ui' / 'voice-check' / 'voice_check.py'
SPEC = importlib.util.spec_from_file_location('voice_check', SCRIPT)
voice_check = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(voice_check)


class TestVoiceCheck(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.interpreter = voice_check.load_model()

    def test_silence_has_no_voice(self):
        silence = np.zeros(voice_check.SAMPLE_RATE * 6, dtype='float32')
        self.assertLess(voice_check.voice_score(self.interpreter, silence), 0.1)

    def test_clip_shorter_than_one_frame_is_scored(self):
        short = np.zeros(voice_check.FRAME // 2, dtype='float32')
        self.assertLess(voice_check.voice_score(self.interpreter, short), 0.1)

    def test_unreadable_clip_counts_as_a_voice(self):
        self.assertEqual(voice_check.score_clip(self.interpreter, 'no-such-clip.mp3'), voice_check.UNREADABLE_SCORE)


if __name__ == '__main__':
    unittest.main()
