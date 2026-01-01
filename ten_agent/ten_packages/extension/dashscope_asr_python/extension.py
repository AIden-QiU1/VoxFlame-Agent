"""
DashScope ASR Extension for TEN Framework

基于阿里云DashScope Paraformer的语音识别Extension。
参考ten-framework/ai_agents/agents/ten_packages/extension/aliyun_asr实现。

官方文档: https://help.aliyun.com/zh/model-studio/getting-started/paraformer
"""

import asyncio
import logging
import os
import wave
from typing import Optional, Callable
from http import HTTPStatus

# TEN Framework imports
try:
    from ten import (
        AsyncExtension,
        AsyncTenEnv,
        Data,
        Cmd,
        StatusCode,
        CmdResult,
        AudioFrame,
    )
    TEN_AVAILABLE = True
except ImportError:
    TEN_AVAILABLE = False
    class AsyncExtension:
        pass
    class AsyncTenEnv:
        pass
    class Data:
        pass
    class Cmd:
        pass
    class StatusCode:
        OK = 0
        ERROR = 1
    class CmdResult:
        @staticmethod
        def create(status): return None
    class AudioFrame:
        pass

# DashScope imports
try:
    import dashscope
    from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult
    DASHSCOPE_AVAILABLE = True
except ImportError:
    DASHSCOPE_AVAILABLE = False

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class DashScopeASRClient:
    """
    DashScope Paraformer ASR Client - 嵌入Extension内部
    
    按照TEN Framework最佳实践，API客户端嵌入在Extension内部。
    参考: aliyun_asr extension
    """
    
    def __init__(
        self, 
        api_key: str, 
        model: str = "paraformer-realtime-v2",
        sample_rate: int = 16000,
        format: str = "pcm"
    ):
        if not DASHSCOPE_AVAILABLE:
            raise ImportError("dashscope package not installed")
        
        dashscope.api_key = api_key
        self.model = model
        self.sample_rate = sample_rate
        self.format = format
        self.recognition = None
        
        logger.info(f"[DashScopeASR] Initialized: model={model}, sample_rate={sample_rate}")
    
    def transcribe_audio_data(self, audio_data: bytes) -> Optional[str]:
        """非流式音频数据转写"""
        try:
            temp_file = "/tmp/dashscope_temp_audio.wav"
            self._save_pcm_as_wav(audio_data, temp_file)
            
            recognition = Recognition(
                model=self.model,
                format="wav",
                sample_rate=self.sample_rate,
                callback=None
            )
            
            result = recognition.call(file_urls=[temp_file])
            
            if os.path.exists(temp_file):
                os.remove(temp_file)
            
            if result.status_code == HTTPStatus.OK:
                text = result.output["results"][0]["transcription_result"]["text"]
                logger.info(f"[DashScopeASR] Transcription: {text[:50]}...")
                return text
            else:
                logger.error(f"[DashScopeASR] Error: {result.message}")
                return None
                
        except Exception as e:
            logger.error(f"[DashScopeASR] Error: {e}")
            return None
    
    def _save_pcm_as_wav(self, pcm_data: bytes, output_path: str):
        """将PCM数据保存为WAV文件"""
        with wave.open(output_path, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(self.sample_rate)
            wav_file.writeframes(pcm_data)


class DashScopeASRExtension(AsyncExtension):
    """
    DashScope ASR Extension
    
    接收PCM音频帧 → DashScope API识别 → 输出文本数据
    """
    
    def __init__(self, name: str):
        super().__init__(name)
        self.client: Optional[DashScopeASRClient] = None
        self.stream_id: int = 0
        self.audio_buffer: bytearray = bytearray()
        self.buffer_threshold: int = 32000
        logger.info(f"[DashScopeASRExtension] Created: {name}")
    
    async def on_init(self, ten_env: AsyncTenEnv):
        try:
            api_key = os.getenv("DASHSCOPE_API_KEY", "")
            if not api_key:
                ten_env.log_error("[DashScopeASR] DASHSCOPE_API_KEY not found")
                return
            
            model = await ten_env.get_property_string("model")
            sample_rate = await ten_env.get_property_int("sample_rate")
            format_type = await ten_env.get_property_string("format")
            
            self.client = DashScopeASRClient(
                api_key=api_key,
                model=model,
                sample_rate=sample_rate,
                format=format_type
            )
            
            ten_env.log_info(f"[DashScopeASR] Initialized: model={model}")
            
        except Exception as e:
            ten_env.log_error(f"[DashScopeASR] Init error: {e}")
    
    async def on_start(self, ten_env: AsyncTenEnv):
        ten_env.log_info("[DashScopeASR] Started")
    
    async def on_stop(self, ten_env: AsyncTenEnv):
        ten_env.log_info("[DashScopeASR] Stopped")
    
    async def on_deinit(self, ten_env: AsyncTenEnv):
        self.client = None
        ten_env.log_info("[DashScopeASR] Deinitialized")
    
    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd):
        cmd_name = cmd.get_name()
        if cmd_name == "flush":
            await self._flush_recognition(ten_env)
            ten_env.return_result(CmdResult.create(StatusCode.OK), cmd)
        else:
            ten_env.return_result(CmdResult.create(StatusCode.ERROR), cmd)
    
    async def on_data(self, ten_env: AsyncTenEnv, data: Data):
        try:
            data_name = data.get_name()
            if data_name == "pcm_frame":
                audio_data = data.get_property_bytes("data")
                self.audio_buffer.extend(audio_data)
                
                if len(self.audio_buffer) >= self.buffer_threshold:
                    await self._process_audio_buffer(ten_env)
        except Exception as e:
            ten_env.log_error(f"[DashScopeASR] Data error: {e}")
    
    async def on_audio_frame(self, ten_env: AsyncTenEnv, frame: AudioFrame):
        """处理音频帧"""
        try:
            audio_data = frame.get_buf()
            self.audio_buffer.extend(audio_data)
            
            if len(self.audio_buffer) >= self.buffer_threshold:
                await self._process_audio_buffer(ten_env)
        except Exception as e:
            ten_env.log_error(f"[DashScopeASR] Audio frame error: {e}")
    
    async def _process_audio_buffer(self, ten_env: AsyncTenEnv):
        if not self.client or len(self.audio_buffer) == 0:
            return
        
        try:
            audio_bytes = bytes(self.audio_buffer)
            text = self.client.transcribe_audio_data(audio_bytes)
            
            if text:
                await self._send_text_data(ten_env, text, is_final=True)
            
            self.audio_buffer.clear()
        except Exception as e:
            ten_env.log_error(f"[DashScopeASR] Buffer error: {e}")
    
    async def _flush_recognition(self, ten_env: AsyncTenEnv):
        if len(self.audio_buffer) > 0:
            await self._process_audio_buffer(ten_env)
    
    async def _send_text_data(self, ten_env: AsyncTenEnv, text: str, is_final: bool):
        try:
            output_data = Data.create("text_data")
            output_data.set_property_string("text", text)
            output_data.set_property_bool("is_final", is_final)
            output_data.set_property_int("stream_id", self.stream_id)
            
            ten_env.send_data(output_data)
            ten_env.log_info(f"[DashScopeASR] Sent: {text[:50]}...")
        except Exception as e:
            ten_env.log_error(f"[DashScopeASR] Send error: {e}")


def register_extension(extension_group):
    """TEN Framework Extension注册入口"""
    extension_group.register_extension(
        "dashscope_asr_python",
        lambda name: DashScopeASRExtension(name)
    )
