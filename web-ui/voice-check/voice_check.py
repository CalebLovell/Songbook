#!/usr/bin/env python3
"""Scores audio clips for human voice with YAMNet, so a voice can keep a clip private.

Reads one clip path per line on stdin and writes one JSON line per clip on stdout:
{"path": "...", "score": 0.04}. The score is YAMNet's highest confidence in any
human voice class, in any part of the clip. A clip that can't be read scores 1.0,
so it counts as a voice and stays private.

Usage:
    python voice_check.py < paths.txt
"""

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import soxr

try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    from tflite_runtime.interpreter import Interpreter

MODEL = Path(__file__).resolve().parent / 'yamnet.tflite'
SAMPLE_RATE = 16000
FRAME = 15600
HOP = FRAME // 2
# YAMNet's "Human sounds" classes from Speech to Grunt, leaving out Synthetic singing (30).
VOICE_CLASSES = [*range(0, 30), *range(31, 35)]
UNREADABLE_SCORE = 1.0


def load_model() -> Interpreter:
    interpreter = Interpreter(model_path=str(MODEL), num_threads=1)
    interpreter.resize_tensor_input(interpreter.get_input_details()[0]['index'], [FRAME])
    interpreter.allocate_tensors()
    return interpreter


def load_clip(path: str) -> np.ndarray:
    audio, rate = sf.read(path, dtype='float32', always_2d=True)
    return soxr.resample(audio.mean(axis=1), rate, SAMPLE_RATE)


def voice_score(interpreter: Interpreter, audio: np.ndarray) -> float:
    input_index = interpreter.get_input_details()[0]['index']
    output_index = interpreter.get_output_details()[0]['index']
    highest = 0.0
    for start in range(0, max(len(audio) - FRAME, 1), HOP):
        frame = audio[start:start + FRAME]
        interpreter.set_tensor(input_index, np.pad(frame, (0, FRAME - len(frame))).astype('float32'))
        interpreter.invoke()
        scores = interpreter.get_tensor(output_index).reshape(-1)
        highest = max(highest, float(scores[VOICE_CLASSES].max()))
    return highest


def score_clip(interpreter: Interpreter, path: str) -> float:
    try:
        return voice_score(interpreter, load_clip(path))
    except Exception:
        return UNREADABLE_SCORE


def main() -> None:
    interpreter = load_model()
    for line in sys.stdin:
        path = line.rstrip('\r\n')
        print(json.dumps({'path': path, 'score': score_clip(interpreter, path)}), flush=True)


if __name__ == '__main__':
    main()
