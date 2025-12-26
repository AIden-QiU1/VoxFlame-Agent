"""
Qwen Agent Worker - 通义千问智能对话代理

官方文档: https://help.aliyun.com/document_detail/2712195.html
SDK参考: https://github.com/dashscope/dashscope-sdk-python

配置环境变量:
    export DASHSCOPE_API_KEY='your-api-key'
    
安装依赖:
    pip install dashscope
    # 或使用OpenAI兼容模式
    pip install openai
"""

import asyncio
import logging
import os
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from pathlib import Path
from http import HTTPStatus

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from agent_sdk import SDKConfig, AgentWorkerBase
except ImportError:
    class SDKConfig:
        pass
    class AgentWorkerBase:
        worker_type = "agent"
        def __init__(self, config, max_concurrent=1):
            self.config = config
            self.max_concurrent = max_concurrent

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Agent配置"""
    model: str = "qwen-plus"  # qwen-turbo, qwen-plus, qwen-max
    temperature: float = 0.7
    max_tokens: int = 1024
    system_prompt: str = ""
    tools: List[Dict] = field(default_factory=list)


# 构音障碍助手专用系统提示
DYSARTHRIA_SYSTEM_PROMPT = """你是VoxFlame燃言语音助手，专门为构音障碍用户设计。

## 你的角色
你是一个温暖、耐心、善解人意的AI助手。你服务的用户可能因为疾病导致说话困难。

## 核心原则
1. **理解优先**: 用户的语音识别结果可能不准确，尽力理解用户的真实意图
2. **简洁回复**: 用简短、清晰的句子回复，方便TTS朗读
3. **确认重要操作**: 对于重要操作（如拨打电话），要先确认
4. **情感支持**: 给予用户鼓励和情感支持

## 回复格式
- 使用中文回复
- 句子简短，每句不超过20字
- 避免使用复杂词汇
"""


class QwenAgent(AgentWorkerBase):
    """通义千问Agent Worker
    
    使用DashScope API，支持同步和流式调用。
    
    官方用法参考:
    ```python
    from dashscope import Generation
    from dashscope.api_entities.dashscope_response import Role
    
    messages = [
        {'role': Role.SYSTEM, 'content': 'You are a helpful assistant.'},
        {'role': Role.USER, 'content': '你好'}
    ]
    
    response = Generation.call(
        model=Generation.Models.qwen_turbo,
        messages=messages,
        result_format='message'
    )
    
    if response.status_code == HTTPStatus.OK:
        print(response.output.choices[0].message.content)
    ```
    """
    
    def __init__(
        self,
        config: SDKConfig,
        api_key: Optional[str] = None,
        agent_config: Optional[AgentConfig] = None,
    ):
        super().__init__(config, max_concurrent=5)
        
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
        self.agent_config = agent_config or AgentConfig()
        
        if not self.agent_config.system_prompt:
            self.agent_config.system_prompt = DYSARTHRIA_SYSTEM_PROMPT
            
        self._use_openai_compat = False
        self._client = None
        
    async def setup(self):
        """初始化通义千问客户端"""
        logger.info(f"Initializing Qwen Agent (model={self.agent_config.model})...")
        
        if not self.api_key:
            raise ValueError("Missing DASHSCOPE_API_KEY environment variable")
        
        # 尝试使用OpenAI兼容模式（推荐）
        try:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            )
            self._use_openai_compat = True
            logger.info("Using OpenAI compatible mode")
        except ImportError:
            logger.info("OpenAI SDK not found, using DashScope SDK")
            self._use_openai_compat = False
            
        logger.info("Qwen Agent initialized")
        
    async def teardown(self):
        """清理资源"""
        if self._client and hasattr(self._client, 'close'):
            await self._client.close()
            
    async def generate_response(
        self,
        input_text: str,
        context: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """生成Agent响应
        
        Args:
            input_text: 用户输入（ASR识别结果）
            context: 对话上下文
                - conversation_history: 历史消息
                - user_profile: 用户画像
            options: Agent选项
                - temperature: 生成温度
                - enable_ger: 是否启用GER纠错
                
        Returns:
            响应数据: {"text": str, "intent": str, "entities": dict}
        """
        logger.info(f"Generating response for: {input_text[:50]}...")
        
        # 构建消息列表
        messages = self._build_messages(input_text, context)
        
        # 调用LLM
        if self._use_openai_compat:
            response = await self._call_openai_compat(messages, options)
        else:
            response = await self._call_dashscope(messages, options)
            
        # 解析意图
        intent, entities = self._extract_intent(input_text)
        
        return {
            "text": response["text"],
            "intent": intent,
            "entities": entities,
            "tool_calls": response.get("tool_calls", []),
            "confidence": 0.9,
        }
        
    def _build_messages(self, input_text: str, context: Dict[str, Any]) -> List[Dict]:
        """构建消息列表"""
        messages = []
        
        # 系统提示
        system_prompt = self._build_system_prompt(context)
        messages.append({"role": "system", "content": system_prompt})
        
        # 历史消息
        history = context.get("conversation_history", [])
        for msg in history[-10:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
            
        # 当前输入
        messages.append({"role": "user", "content": input_text})
        
        return messages
        
    def _build_system_prompt(self, context: Dict[str, Any]) -> str:
        """构建系统提示"""
        base_prompt = self.agent_config.system_prompt
        
        # 添加用户画像
        user_profile = context.get("user_profile", {})
        if user_profile:
            name = user_profile.get('name', '用户')
            vocab = user_profile.get('vocabulary', [])
            base_prompt += f"\n\n## 当前用户\n- 姓名: {name}"
            if vocab:
                base_prompt += f"\n- 常用词汇: {', '.join(vocab[:10])}"
                
        return base_prompt
        
    async def _call_openai_compat(self, messages: List[Dict], options: Dict) -> Dict:
        """使用OpenAI兼容接口调用"""
        kwargs = {
            "model": self.agent_config.model,
            "messages": messages,
            "temperature": options.get("temperature", self.agent_config.temperature),
            "max_tokens": options.get("max_tokens", self.agent_config.max_tokens),
        }
        
        response = await self._client.chat.completions.create(**kwargs)
        message = response.choices[0].message
        
        return {
            "text": message.content or "",
            "tool_calls": [],
        }
        
    async def _call_dashscope(self, messages: List[Dict], options: Dict) -> Dict:
        """使用DashScope SDK调用
        
        官方用法:
        ```python
        from dashscope import Generation
        response = Generation.call(
            model='qwen-turbo',
            messages=messages,
            result_format='message'
        )
        ```
        """
        loop = asyncio.get_event_loop()
        
        def sync_call():
            from dashscope import Generation
            
            response = Generation.call(
                model=self.agent_config.model,
                messages=messages,
                result_format='message',
                temperature=options.get("temperature", self.agent_config.temperature),
                max_tokens=options.get("max_tokens", self.agent_config.max_tokens),
            )
            
            if response.status_code == HTTPStatus.OK:
                return response.output.choices[0].message.content
            else:
                raise RuntimeError(f"Qwen API error: {response.message}")
                
        text = await loop.run_in_executor(None, sync_call)
        return {"text": text, "tool_calls": []}
        
    def _extract_intent(self, text: str) -> tuple:
        """简单意图识别"""
        text_lower = text.lower()
        
        intent_patterns = {
            "emergency": ["疼", "不舒服", "难受", "帮我", "救命"],
            "request_water": ["喝水", "水", "渴"],
            "request_food": ["饿", "吃", "饭"],
            "toilet": ["厕所", "卫生间", "上厕所"],
            "call": ["打电话", "电话", "呼叫"],
        }
        
        for intent, keywords in intent_patterns.items():
            if any(kw in text_lower for kw in keywords):
                return intent, {}
                
        return "general_chat", {}


# 独立测试
async def test_qwen_agent():
    """测试通义千问Agent"""
    logging.basicConfig(level=logging.INFO)
    
    class MockConfig:
        pass
    
    config = MockConfig()
    agent = QwenAgent(config)
    
    print("Initializing agent...")
    await agent.setup()
    print("Agent initialized!")
    
    # 测试对话
    test_inputs = ["你好", "我想喝水", "有点不舒服"]
    
    context = {
        "user_profile": {"name": "张爷爷", "vocabulary": ["喝水", "吃饭"]},
        "conversation_history": [],
    }
    
    for text in test_inputs:
        print(f"\n用户: {text}")
        response = await agent.generate_response(text, context, {})
        print(f"助手: {response['text']}")
        print(f"意图: {response['intent']}")
        
    await agent.teardown()


if __name__ == "__main__":
    asyncio.run(test_qwen_agent())
