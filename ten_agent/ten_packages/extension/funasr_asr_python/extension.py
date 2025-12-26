"""
FunASR ASR Extension for TEN Framework

基于阿里FunASR/SenseVoice的语音识别Extension。
支持流式和非流式识别，针对构音障碍用户优化。

官方文档: https://github.com/modelscope/funasr
TEN Extension API: AsyncASRBaseExtension

主要特性:
- SenseVoice多语言识别 (中英日韩粤)
- 热词支持 (提高特定词汇识别率)
- VAD集成 (语音活动检测)
- 流式识别支持
"""

import asyncio
import logging
import tempfile
import os
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

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
    # Mock for standalone testing
    class AsyncExtension:
        pass
    class AsyncTenEnv:
        pass

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@dataclass
class ASRConfig:
    """ASR配置"""
    model: str = "sensevoice-small"
    device: str = "cuda:0"
    language: str = "auto"
    hotwords: List[str] = field(default_factory=list)
    vad_model: Optional[str] = "fsmn-vad"
    punc_model: Optional[str] = "ct-punc"
    batch_size_s: int = 300


# 模型ID映射
MODEL_MAPPING = {
    "sensevoice-small": "iic/SenseVoiceSmall",
    "paraformer": "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    "paraformer-streaming": "iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online",
}


class FunASRExtension(AsyncExtension):
    """FunASR ASR Extension
    
    实现TEN Framework的ASR Extension接口。
    
    数据流:
    pcm_frame (input) -> ASR处理 -> text_data (output)
    
    使用方法:
    1. 配置property.json中的model, device, hotwords等参数
    2. 通过pcm_frame接收音频数据
    3. 识别结果通过text_data输出
    """
    
    def __init__(self, name: str):
        super().__init__(name)
        self.config: Optional[ASRConfig] = None
        self.model = None
        self._initialized = False
        self._audio_buffer: bytes = b""
        self._stream_id: int = 0
        
    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """初始化Extension
        
        加载配置参数，准备ASR模型。
        """
        logger.info("FunASR Extension initializing...")
        
        # 读取配置
        try:
            model = await ten_env.get_property_string("model")
            device = await ten_env.get_property_string("device")
            language = await ten_env.get_property_string("language")
            hotwords = await ten_env.get_property_to_json("hotwords")
            vad_model = await ten_env.get_property_string("vad_model")
            punc_model = await ten_env.get_property_string("punc_model")
            
            self.config = ASRConfig(
                model=model or "sensevoice-small",
                device=device or "cuda:0",
                language=language or "auto",
                hotwords=hotwords if isinstance(hotwords, list) else [],
                vad_model=vad_model if vad_model else None,
                punc_model=punc_model if punc_model else None,
            )
        except Exception as e:
            logger.warning(f"Failed to read config, using defaults: {e}")
            self.config = ASRConfig()
            
        logger.info(f"FunASR config: model={self.config.model}, device={self.config.device}")
        
    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """启动Extension，加载模型"""
        logger.info("FunASR Extension starting, loading model...")
        
        # 在后台线程加载模型（避免阻塞事件循环）
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_model)
        
        self._initialized = True
        logger.info("FunASR model loaded successfully")
        
    def _load_model(self):
        """同步加载FunASR模型"""
        try:
            from funasr import AutoModel
            
            model_id = MODEL_MAPPING.get(self.config.model, self.config.model)
            
            model_kwargs = {
                "model": model_id,
                "device": self.config.device,
                "disable_update": True,
            }
            
            # SenseVoice自带VAD和标点，不需要额外模型
            if "SenseVoice" not in model_id:
                if self.config.vad_model:
                    model_kwargs["vad_model"] = self.config.vad_model
                    model_kwargs["vad_kwargs"] = {"max_single_segment_time": 60000}
                if self.config.punc_model:
                    model_kwargs["punc_model"] = self.config.punc_model
                    
            self.model = AutoModel(**model_kwargs)
            logger.info(f"Model loaded: {model_id}")
            
        except ImportError:
            logger.error("FunASR not installed. Run: pip install funasr modelscope")
            raise
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
            
    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """停止Extension，清理资源"""
        logger.info("FunASR Extension stopping...")
        self.model = None
        self._initialized = False
        self._audio_buffer = b""
        
    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """反初始化"""
        logger.info("FunASR Extension deinitializing...")
        
    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理输入数据
        
        接收pcm_frame音频数据，进行语音识别。
        
        Args:
            ten_env: TEN环境
            data: 输入数据 (pcm_frame)
        """
        if not self._initialized:
            logger.warning("Model not initialized, dropping audio frame")
            return
            
        data_name = data.get_name()
        
        if data_name == "pcm_frame":
            await self._handle_pcm_frame(ten_env, data)
        else:
            logger.warning(f"Unknown data type: {data_name}")
            
    async def _handle_pcm_frame(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理PCM音频帧
        
        累积音频数据，达到一定量后进行识别。
        """
        try:
            # 获取音频数据
            audio_bytes = data.get_property_buf("data")
            sample_rate = data.get_property_int("sample_rate")
            
            if audio_bytes:
                self._audio_buffer += audio_bytes
                
            # 每积累约1秒音频进行一次识别 (16000 * 2 = 32000 bytes for 16bit mono)
            if len(self._audio_buffer) >= 32000:
                await self._do_recognition(ten_env, is_final=False)
                
        except Exception as e:
            logger.error(f"Error handling pcm_frame: {e}")
            
    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """处理命令
        
        支持的命令:
        - flush: 强制处理缓冲区中的音频
        - finalize: 完成当前识别会话
        """
        cmd_name = cmd.get_name()
        logger.info(f"Received command: {cmd_name}")
        
        if cmd_name == "flush" or cmd_name == "finalize":
            # 处理剩余音频
            if self._audio_buffer:
                await self._do_recognition(ten_env, is_final=True)
            
            cmd_result = CmdResult.create(StatusCode.OK)
            await ten_env.return_result(cmd_result, cmd)
        else:
            cmd_result = CmdResult.create(StatusCode.ERROR)
            await ten_env.return_result(cmd_result, cmd)
            
    async def _do_recognition(self, ten_env: AsyncTenEnv, is_final: bool = False) -> None:
        """执行语音识别
        
        Args:
            ten_env: TEN环境
            is_final: 是否最终结果
        """
        if not self._audio_buffer or not self.model:
            return
            
        audio_data = self._audio_buffer
        self._audio_buffer = b""
        self._stream_id += 1
        
        try:
            # 写入临时文件
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                # 简单WAV头 (16kHz, 16bit, mono)
                import struct
                wav_header = self._create_wav_header(len(audio_data))
                f.write(wav_header)
                f.write(audio_data)
                audio_path = f.name
                
            # 在后台线程执行识别
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self._transcribe(audio_path)
            )
            
            # 清理临时文件
            if os.path.exists(audio_path):
                os.unlink(audio_path)
                
            # 发送识别结果
            if result["text"]:
                await self._send_result(ten_env, result, is_final)
                
        except Exception as e:
            logger.error(f"Recognition error: {e}")
            
    def _transcribe(self, audio_path: str) -> Dict[str, Any]:
        """同步执行转录"""
        generate_kwargs = {
            "input": audio_path,
            "batch_size_s": self.config.batch_size_s,
        }
        
        # 热词设置
        if self.config.hotwords:
            generate_kwargs["hotword"] = " ".join(self.config.hotwords)
            
        # 语言设置（SenseVoice支持）
        if "SenseVoice" in MODEL_MAPPING.get(self.config.model, ""):
            generate_kwargs["language"] = self.config.language
            
        # 执行推理
        result = self.model.generate(**generate_kwargs)
        
        # 解析结果
        text = ""
        confidence = 0.95  # FunASR不直接返回置信度
        
        if isinstance(result, list) and len(result) > 0:
            if isinstance(result[0], dict):
                text = result[0].get("text", "")
            else:
                text = str(result[0])
        elif isinstance(result, dict):
            text = result.get("text", "")
        else:
            text = str(result) if result else ""
            
        return {
            "text": text.strip(),
            "confidence": confidence,
        }
        
    async def _send_result(self, ten_env: AsyncTenEnv, result: Dict, is_final: bool) -> None:
        """发送识别结果到下游"""
        try:
            output_data = Data.create("text_data")
            output_data.set_property_string("text", result["text"])
            output_data.set_property_bool("is_final", is_final)
            output_data.set_property_float("confidence", result["confidence"])
            output_data.set_property_int("stream_id", self._stream_id)
            
            await ten_env.send_data(output_data)
            logger.info(f"ASR result: {result['text'][:50]}... (final={is_final})")
            
        except Exception as e:
            logger.error(f"Error sending result: {e}")
            
    def _create_wav_header(self, data_size: int) -> bytes:
        """创建WAV文件头 (16kHz, 16bit, mono)"""
        import struct
        
        sample_rate = 16000
        bits_per_sample = 16
        channels = 1
        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        
        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            data_size + 36,
            b'WAVE',
            b'fmt ',
            16,  # Subchunk1Size
            1,   # AudioFormat (PCM)
            channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b'data',
            data_size
        )
        return header


# Extension注册
def register_addon_as_extension(register_func):
    """TEN Extension注册函数"""
    register_func(FunASRExtension)
