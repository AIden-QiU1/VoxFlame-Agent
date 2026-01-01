"""
DashScope TTS Extension for TEN Framework

基于阿里云DashScope CosyVoice的语音合成Extension。
按照TEN Framework最佳实践，API客户端嵌入在Extension内部。

官方文档: https://help.aliyun.com/zh/model-studio/getting-started/cosyvoice
"""

import asyncio
import logging
import os
from typing import Optional
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
    )
    TEN_AVAILABLE = True
except ImportError:
    TEN_AVAILABLE = False
    class AsyncExtension:
        pass
    class AsyncTenEnv:
        pass
    class Data:
        @staticmethod
        def create(name): return Data()
        def set_property_buf(self, k, v): pass
        def set_property_int(self, k, v): pass
        def set_property_string(self, k, v): pass
        def get_property_string(self, k): return ''
        def get_property_bool(self, k): return False
        def get_name(self): return ''
    class Cmd:
        def get_name(self): return ''
    class StatusCode:
        OK = 0
        ERROR = 1
    class CmdResult:
        @staticmethod
        def create(status): return None

# DashScope imports
try:
    import dashscope
    from dashscope.audio.tts_v2 import SpeechSynthesizer, ResultCallback, AudioFormat
    DASHSCOPE_AVAILABLE = True
except ImportError:
    DASHSCOPE_AVAILABLE = False

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class DashScopeTTSClient:
    """
    DashScope CosyVoice TTS Client - 嵌入Extension内部
    
    按照TEN Framework最佳实践，API客户端嵌入在Extension内部。
    """
    
    def __init__(
        self, 
        api_key: str, 
        model: str = "cosyvoice-v3-flash",
        voice: str = "longanyang",
        sample_rate: int = 22050,
        format: str = "pcm"
    ):
        if not DASHSCOPE_AVAILABLE:
            raise ImportError("dashscope package not installed")
        
        dashscope.api_key = api_key
        self.model = model
        self.voice = voice
        self.sample_rate = sample_rate
        self.format = format
        
        logger.info(f"[DashScopeTTS] Initialized: model={model}, voice={voice}")
    
    def synthesize(self, text: str) -> Optional[bytes]:
        """同步语音合成"""
        try:
            synthesizer = SpeechSynthesizer(
                model=self.model,
                voice=self.voice,
                format=AudioFormat.PCM_22050HZ_MONO_16BIT if self.sample_rate == 22050 else AudioFormat.PCM_16000HZ_MONO_16BIT,
            )
            
            audio_data = synthesizer.call(text)
            
            if audio_data:
                logger.info(f"[DashScopeTTS] Synthesized {len(audio_data)} bytes for: {text[:30]}...")
                return audio_data
            else:
                logger.error("[DashScopeTTS] Synthesis returned empty data")
                return None
                
        except Exception as e:
            logger.error(f"[DashScopeTTS] Error: {e}")
            return None
    
    async def synthesize_streaming(self, text: str, on_audio: callable):
        """流式语音合成"""
        try:
            class StreamCallback(ResultCallback):
                def on_open(self):
                    logger.info("[DashScopeTTS] Stream opened")
                
                def on_complete(self):
                    logger.info("[DashScopeTTS] Stream completed")
                
                def on_error(self, message: str):
                    logger.error(f"[DashScopeTTS] Stream error: {message}")
                
                def on_event(self, message):
                    pass
                
                def on_data(self, data: bytes):
                    on_audio(data)
            
            synthesizer = SpeechSynthesizer(
                model=self.model,
                voice=self.voice,
                format=AudioFormat.PCM_22050HZ_MONO_16BIT,
                callback=StreamCallback()
            )
            
            synthesizer.streaming_call(text)
            synthesizer.streaming_complete()
            
        except Exception as e:
            logger.error(f"[DashScopeTTS] Streaming error: {e}")


class DashScopeTTSExtension(AsyncExtension):
    """
    DashScope TTS Extension
    
    接收文本数据 → DashScope API合成 → 输出PCM音频帧
    """
    
    def __init__(self, name: str):
        super().__init__(name)
        self.client: Optional[DashScopeTTSClient] = None
        self.stream_id: int = 0
        self.interrupted: bool = False
        logger.info(f"[DashScopeTTSExtension] Created: {name}")
    
    async def on_init(self, ten_env: AsyncTenEnv):
        try:
            api_key = os.getenv("DASHSCOPE_API_KEY", "")
            if not api_key:
                ten_env.log_error("[DashScopeTTS] DASHSCOPE_API_KEY not found")
                return
            
            model = await ten_env.get_property_string("model")
            voice = await ten_env.get_property_string("voice")
            sample_rate = await ten_env.get_property_int("sample_rate")
            
            self.client = DashScopeTTSClient(
                api_key=api_key,
                model=model,
                voice=voice,
                sample_rate=sample_rate
            )
            
            ten_env.log_info(f"[DashScopeTTS] Initialized: model={model}, voice={voice}")
            
        except Exception as e:
            ten_env.log_error(f"[DashScopeTTS] Init error: {e}")
    
    async def on_start(self, ten_env: AsyncTenEnv):
        ten_env.log_info("[DashScopeTTS] Started")
    
    async def on_stop(self, ten_env: AsyncTenEnv):
        ten_env.log_info("[DashScopeTTS] Stopped")
    
    async def on_deinit(self, ten_env: AsyncTenEnv):
        self.client = None
        ten_env.log_info("[DashScopeTTS] Deinitialized")
    
    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd):
        cmd_name = cmd.get_name()
        
        if cmd_name == "flush":
            ten_env.return_result(CmdResult.create(StatusCode.OK), cmd)
        elif cmd_name == "interrupt":
            self.interrupted = True
            ten_env.return_result(CmdResult.create(StatusCode.OK), cmd)
        else:
            ten_env.return_result(CmdResult.create(StatusCode.ERROR), cmd)
    
    async def on_data(self, ten_env: AsyncTenEnv, data: Data):
        try:
            data_name = data.get_name()
            
            if data_name == "text_data":
                text = data.get_property_string("text")
                is_final = data.get_property_bool("is_final")
                
                if text and self.client and not self.interrupted:
                    await self._synthesize_and_send(ten_env, text)
                
                self.interrupted = False
                
        except Exception as e:
            ten_env.log_error(f"[DashScopeTTS] Data error: {e}")
    
    async def _synthesize_and_send(self, ten_env: AsyncTenEnv, text: str):
        """合成并发送音频"""
        if not self.client:
            return
        
        try:
            audio_data = self.client.synthesize(text)
            
            if audio_data:
                await self._send_pcm_frame(ten_env, audio_data)
                
        except Exception as e:
            ten_env.log_error(f"[DashScopeTTS] Synthesis error: {e}")
    
    async def _send_pcm_frame(self, ten_env: AsyncTenEnv, audio_data: bytes):
        """发送PCM音频帧"""
        try:
            output_data = Data.create("pcm_frame")
            output_data.set_property_buf("bytes", audio_data)
            output_data.set_property_int("sample_rate", self.client.sample_rate if self.client else 22050)
            output_data.set_property_int("channels", 1)
            output_data.set_property_int("timestamp", 0)
            
            ten_env.send_data(output_data)
            ten_env.log_info(f"[DashScopeTTS] Sent {len(audio_data)} bytes audio")
            
        except Exception as e:
            ten_env.log_error(f"[DashScopeTTS] Send error: {e}")


def register_extension(extension_group):
    """TEN Framework Extension注册入口"""
    extension_group.register_extension(
        "dashscope_tts_python",
        lambda name: DashScopeTTSExtension(name)
    )
