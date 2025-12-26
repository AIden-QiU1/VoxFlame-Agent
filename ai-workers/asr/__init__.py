"""
VoxFlame ASR Module - 语音识别模块

支持多种ASR后端：
- FunASR (阿里开源，中文优化)
- 云API (火山引擎/阿里云)
"""

from .funasr_worker import FunASRWorker, SenseVoiceWorker

__all__ = ["FunASRWorker", "SenseVoiceWorker"]
