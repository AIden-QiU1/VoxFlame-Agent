"""
FunASR Worker - 基于阿里FunASR/SenseVoice的语音识别

官方文档参考: https://github.com/modelscope/funasr

FunASR支持的模型:
- SenseVoiceSmall: 轻量级，速度快，支持中英日韩粤
- Paraformer: 高精度中文识别
- paraformer-zh-streaming: 实时流式识别

安装依赖:
    pip install funasr modelscope
"""

import asyncio
import logging
import tempfile
import os
from typing import Dict, Any, Optional, List
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from agent_sdk import SDKConfig, ASRWorkerBase
except ImportError:
    # 独立测试时使用
    class SDKConfig:
        pass
    class ASRWorkerBase:
        worker_type = "asr"
        def __init__(self, config, max_concurrent=1):
            self.config = config
            self.max_concurrent = max_concurrent
        async def setup(self): pass
        async def teardown(self): pass
        async def transcribe(self, audio_data, options): pass

logger = logging.getLogger(__name__)


class FunASRWorker(ASRWorkerBase):
    """FunASR 语音识别 Worker
    
    基于阿里开源FunASR框架，支持多种模型。
    
    官方用法参考:
    ```python
    from funasr import AutoModel
    
    model = AutoModel(
        model="paraformer-zh",
        vad_model="fsmn-vad",
        vad_kwargs={"max_single_segment_time": 60000},
        punc_model="ct-punc"
    )
    
    res = model.generate(input="audio.wav", batch_size_s=300)
    print(res[0]["text"])
    ```
    """
    
    SUPPORTED_MODELS = {
        "sensevoice-small": "iic/SenseVoiceSmall",
        "paraformer": "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        "paraformer-streaming": "iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online",
    }
    
    def __init__(
        self, 
        config: SDKConfig,
        model_name: str = "sensevoice-small",
        device: str = "cuda:0",
        vad_model: Optional[str] = "fsmn-vad",
        punc_model: Optional[str] = "ct-punc",
        hotwords: Optional[List[str]] = None,
    ):
        super().__init__(config, max_concurrent=2)
        
        self.model_name = model_name
        self.model_id = self.SUPPORTED_MODELS.get(model_name, model_name)
        self.device = device
        self.vad_model = vad_model
        self.punc_model = punc_model
        self.hotwords = hotwords or []
        
        self.model = None
        self._initialized = False
        
    async def setup(self):
        """加载FunASR模型
        
        模型加载是同步操作，使用run_in_executor避免阻塞事件循环
        """
        logger.info(f"Loading FunASR model: {self.model_id}")
        logger.info(f"Device: {self.device}")
        
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_model)
        
        self._initialized = True
        logger.info("FunASR model loaded successfully")
        
    def _load_model(self):
        """同步加载模型"""
        try:
            from funasr import AutoModel
            
            model_kwargs = {
                "model": self.model_id,
                "device": self.device,
                "disable_update": True,
            }
            
            # SenseVoice自带VAD和标点，不需要额外模型
            if "SenseVoice" not in self.model_id:
                if self.vad_model:
                    model_kwargs["vad_model"] = self.vad_model
                    model_kwargs["vad_kwargs"] = {"max_single_segment_time": 60000}
                if self.punc_model:
                    model_kwargs["punc_model"] = self.punc_model
                    
            self.model = AutoModel(**model_kwargs)
            
        except ImportError:
            logger.error("FunASR not installed. Run: pip install funasr modelscope")
            raise
        except Exception as e:
            logger.error(f"Failed to load FunASR model: {e}")
            raise
            
    async def teardown(self):
        """清理资源"""
        logger.info("Unloading FunASR model...")
        self.model = None
        self._initialized = False
        
    async def transcribe(self, audio_data: bytes, options: Dict[str, Any]) -> str:
        """执行语音转录
        
        Args:
            audio_data: 音频数据 (WAV格式)
            options: 转录选项
                - language: 语言 (auto/zh/en/ja/ko/yue)
                - hotwords: 热词列表
                - batch_size_s: 批处理时长(秒)
                
        Returns:
            转录文本
        """
        if not self._initialized:
            raise RuntimeError("Model not initialized. Call setup() first.")
            
        logger.info(f"Transcribing audio ({len(audio_data)} bytes)")
        
        # 写入临时文件
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            audio_path = f.name
            
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                lambda: self._do_transcribe(audio_path, options)
            )
            return result
        finally:
            if os.path.exists(audio_path):
                os.unlink(audio_path)
                
    def _do_transcribe(self, audio_path: str, options: Dict[str, Any]) -> str:
        """同步执行转录
        
        官方API: model.generate(input=audio_path, batch_size_s=300)
        """
        generate_kwargs = {
            "input": audio_path,
            "batch_size_s": options.get("batch_size_s", 300),
        }
        
        # 热词设置
        hotwords = options.get("hotwords") or self.hotwords
        if hotwords:
            generate_kwargs["hotword"] = " ".join(hotwords)
            
        # 语言设置（SenseVoice支持）
        language = options.get("language", "auto")
        if "SenseVoice" in self.model_id:
            generate_kwargs["language"] = language
            
        # 执行推理
        result = self.model.generate(**generate_kwargs)
        
        # 解析结果 [{"text": "...", "timestamp": [...]}]
        if isinstance(result, list) and len(result) > 0:
            if isinstance(result[0], dict):
                return result[0].get("text", "")
            return str(result[0])
        elif isinstance(result, dict):
            return result.get("text", "")
        else:
            return str(result)


class SenseVoiceWorker(FunASRWorker):
    """SenseVoice专用Worker
    
    SenseVoice是阿里最新的多语言语音识别模型:
    - 支持中英日韩粤5种语言
    - 自带VAD和标点
    - 推理速度快
    """
    
    def __init__(self, config: SDKConfig, device: str = "cuda:0"):
        super().__init__(
            config=config,
            model_name="sensevoice-small",
            device=device,
            vad_model=None,
            punc_model=None,
        )


# 独立测试
async def test_funasr():
    """测试FunASR Worker"""
    logging.basicConfig(level=logging.INFO)
    
    class MockConfig:
        pass
    
    config = MockConfig()
    worker = SenseVoiceWorker(config, device="cpu")
    
    print("Loading model...")
    await worker.setup()
    print("Model loaded!")
    
    # 测试音频
    test_audio = "/tmp/test.wav"
    if os.path.exists(test_audio):
        with open(test_audio, "rb") as f:
            audio_data = f.read()
        result = await worker.transcribe(audio_data, {"language": "zh"})
        print(f"Result: {result}")
    else:
        print(f"请提供测试音频: {test_audio}")
        
    await worker.teardown()


if __name__ == "__main__":
    asyncio.run(test_funasr())
