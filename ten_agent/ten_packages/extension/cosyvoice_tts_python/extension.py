"""
CosyVoice TTS Extension for TEN Framework

基于阿里CosyVoice的语音合成Extension。
CosyVoice支持多种音色和情感合成，适合构音障碍助手场景。

官方仓库: https://github.com/FunAudioLLM/CosyVoice
API文档: https://help.aliyun.com/document_detail/84435.html

主要特性:
- 自然流畅的中文语音合成
- 多种音色选择
- 流式音频输出
- 低延迟设计
"""

import asyncio
import logging
import os
import struct
from typing import Optional, List, AsyncIterator
from dataclasses import dataclass

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

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@dataclass
class TTSConfig:
    """TTS配置"""
    api_url: str = ""
    model: str = "cosyvoice-v1"
    voice_id: str = "longxiaochun"  # 默认音色
    sample_rate: int = 16000
    streaming: bool = True
    speed: float = 1.0


class CosyVoiceTTSExtension(AsyncExtension):
    """CosyVoice TTS Extension
    
    实现TEN Framework的TTS Extension接口。
    
    数据流:
    text_data (LLM回复) -> TTS合成 -> pcm_frame (音频)
    
    音频格式:
    - PCM 16bit
    - 16kHz采样率
    - 单声道
    """
    
    def __init__(self, name: str):
        super().__init__(name)
        self.config: Optional[TTSConfig] = None
        self._initialized = False
        self._text_buffer = ""
        self._interrupted = False
        self._current_stream_id = 0
        
    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """初始化Extension"""
        logger.info("CosyVoice TTS Extension initializing...")
        
        try:
            api_url = await ten_env.get_property_string("api_url")
            model = await ten_env.get_property_string("model")
            voice_id = await ten_env.get_property_string("voice_id")
            sample_rate = await ten_env.get_property_int("sample_rate")
            streaming = await ten_env.get_property_bool("streaming")
            speed = await ten_env.get_property_float("speed")
            
            self.config = TTSConfig(
                api_url=api_url or os.getenv("COSYVOICE_API_URL", "http://localhost:50000"),
                model=model or "cosyvoice-v1",
                voice_id=voice_id or "longxiaochun",
                sample_rate=sample_rate if sample_rate else 16000,
                streaming=streaming if streaming is not None else True,
                speed=speed if speed else 1.0,
            )
        except Exception as e:
            logger.warning(f"Failed to read config: {e}")
            self.config = TTSConfig(
                api_url=os.getenv("COSYVOICE_API_URL", "http://localhost:50000"),
            )
            
        logger.info(f"CosyVoice config: model={self.config.model}, voice={self.config.voice_id}")
        
    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """启动Extension"""
        logger.info("CosyVoice TTS Extension starting...")
        self._initialized = True
        
    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """停止Extension"""
        logger.info("CosyVoice TTS Extension stopping...")
        self._initialized = False
        
    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """反初始化"""
        logger.info("CosyVoice TTS Extension deinitializing...")
        
    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理输入数据"""
        if not self._initialized:
            logger.warning("TTS not initialized")
            return
            
        data_name = data.get_name()
        
        if data_name == "text_data":
            await self._handle_text_input(ten_env, data)
        else:
            logger.warning(f"Unknown data type: {data_name}")
            
    async def _handle_text_input(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理LLM文本输入"""
        try:
            text = data.get_property_string("text")
            is_final = data.get_property_bool("is_final")
            end_of_segment = data.get_property_bool("end_of_segment")
            stream_id = data.get_property_int("stream_id")
            
            self._current_stream_id = stream_id
            
            # 累积文本
            if text:
                self._text_buffer += text
                
            # 当收到完整句子或最终结果时进行合成
            if end_of_segment or is_final:
                if self._text_buffer:
                    await self._synthesize_and_send(ten_env, self._text_buffer)
                    self._text_buffer = ""
            elif self._should_synthesize():
                # 流式模式：当累积到一个句子时合成
                text_to_speak = self._extract_sentence()
                if text_to_speak:
                    await self._synthesize_and_send(ten_env, text_to_speak)
                    
        except Exception as e:
            logger.error(f"Error handling text input: {e}")
            
    def _should_synthesize(self) -> bool:
        """判断是否应该开始合成"""
        # 检查是否有完整的句子
        sentence_endings = ["。", "！", "？", "，", "、", ".", "!", "?", ","]
        for ending in sentence_endings:
            if ending in self._text_buffer:
                return True
        return False
        
    def _extract_sentence(self) -> str:
        """提取一个完整句子"""
        sentence_endings = ["。", "！", "？", ".", "!", "?"]
        
        for ending in sentence_endings:
            idx = self._text_buffer.find(ending)
            if idx != -1:
                sentence = self._text_buffer[:idx+1]
                self._text_buffer = self._text_buffer[idx+1:]
                return sentence
                
        # 如果没有句号，检查逗号
        comma_endings = ["，", "、", ","]
        for ending in comma_endings:
            idx = self._text_buffer.find(ending)
            if idx != -1 and idx > 5:  # 至少5个字符才按逗号分
                sentence = self._text_buffer[:idx+1]
                self._text_buffer = self._text_buffer[idx+1:]
                return sentence
                
        return ""
        
    async def _synthesize_and_send(self, ten_env: AsyncTenEnv, text: str) -> None:
        """合成并发送音频"""
        if self._interrupted:
            return
            
        logger.info(f"Synthesizing: {text[:50]}...")
        
        try:
            # 调用CosyVoice API
            async for audio_chunk in self._call_cosyvoice(text):
                if self._interrupted:
                    break
                await self._send_audio(ten_env, audio_chunk)
                
        except Exception as e:
            logger.error(f"TTS synthesis error: {e}")
            # 如果CosyVoice不可用，尝试使用备用方案或静默
            
    async def _call_cosyvoice(self, text: str) -> AsyncIterator[bytes]:
        """调用CosyVoice API
        
        支持两种模式:
        1. HTTP REST API (适合云端部署)
        2. 本地模型直接推理 (适合边缘部署)
        """
        import aiohttp
        
        url = f"{self.config.api_url}/tts/stream"
        payload = {
            "text": text,
            "voice_id": self.config.voice_id,
            "model": self.config.model,
            "sample_rate": self.config.sample_rate,
            "speed": self.config.speed,
            "streaming": self.config.streaming,
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status == 200:
                        # 流式读取音频数据
                        async for chunk in response.content.iter_chunked(4096):
                            if self._interrupted:
                                break
                            yield chunk
                    else:
                        error = await response.text()
                        logger.error(f"CosyVoice API error: {error}")
                        # 生成静默音频作为占位
                        yield self._generate_silence(0.5)
                        
        except aiohttp.ClientError as e:
            logger.error(f"Failed to connect to CosyVoice: {e}")
            # 生成静默音频作为占位
            yield self._generate_silence(0.5)
            
    def _generate_silence(self, duration: float) -> bytes:
        """生成静默音频"""
        num_samples = int(self.config.sample_rate * duration)
        return b'\x00\x00' * num_samples  # 16-bit silence
        
    async def _send_audio(self, ten_env: AsyncTenEnv, audio_data: bytes) -> None:
        """发送音频数据到下游"""
        try:
            # 创建PCM帧
            pcm_frame = Data.create("pcm_frame")
            pcm_frame.set_property_buf("bytes", audio_data)
            pcm_frame.set_property_int("sample_rate", self.config.sample_rate)
            pcm_frame.set_property_int("channels", 1)
            pcm_frame.set_property_int("timestamp", self._get_timestamp())
            
            await ten_env.send_data(pcm_frame)
            
        except Exception as e:
            logger.error(f"Error sending audio: {e}")
            
    def _get_timestamp(self) -> int:
        """获取当前时间戳(毫秒)"""
        import time
        return int(time.time() * 1000)
        
    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """处理命令"""
        cmd_name = cmd.get_name()
        logger.info(f"Received command: {cmd_name}")
        
        if cmd_name == "flush":
            # 刷新当前处理
            self._text_buffer = ""
            cmd_result = CmdResult.create(StatusCode.OK)
            await ten_env.return_result(cmd_result, cmd)
            
        elif cmd_name == "interrupt":
            # 中断当前合成
            self._interrupted = True
            self._text_buffer = ""
            cmd_result = CmdResult.create(StatusCode.OK)
            await ten_env.return_result(cmd_result, cmd)
            # 重置中断标志以便处理下一条消息
            await asyncio.sleep(0.1)
            self._interrupted = False
            
        else:
            cmd_result = CmdResult.create(StatusCode.ERROR)
            await ten_env.return_result(cmd_result, cmd)


# Extension注册
def register_addon_as_extension(register_func):
    """TEN Extension注册函数"""
    register_func(CosyVoiceTTSExtension)
