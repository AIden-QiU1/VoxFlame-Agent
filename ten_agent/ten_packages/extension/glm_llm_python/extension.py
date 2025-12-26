"""
GLM-4 LLM Extension for TEN Framework

基于智谱GLM-4的大语言模型Extension，支持Tool Calling。
专为构音障碍用户设计，提供简洁、温暖的对话体验。

官方文档: https://open.bigmodel.cn/dev/api
GLM-4 API: https://open.bigmodel.cn/dev/api/normal-model/glm-4

主要特性:
- GLM-4 / GLM-4-Plus 模型支持
- Tool Calling (函数调用)
- 流式输出
- 针对构音障碍用户优化的系统提示
"""

import asyncio
import logging
import json
import os
from typing import Optional, List, Dict, Any, AsyncIterator
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
    class AsyncExtension:
        pass
    class AsyncTenEnv:
        pass

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# 构音障碍助手专用系统提示
DYSARTHRIA_SYSTEM_PROMPT = """你是燃言(VoxFlame)语音助手，专门为构音障碍用户设计。

## 你的角色
你是一个温暖、耐心、善解人意的AI助手。你服务的用户可能因为疾病导致说话困难。

## 核心原则
1. **理解优先**: 用户的语音识别结果可能不准确，尽力理解用户的真实意图
2. **简洁回复**: 用简短、清晰的句子回复，方便TTS朗读，每句不超过20字
3. **确认重要操作**: 对于重要操作（如拨打电话），要先确认
4. **情感支持**: 给予用户鼓励和情感支持
5. **主动帮助**: 如果用户意图不清，主动询问澄清

## 可用工具
你可以使用以下工具帮助用户：
- make_phone_call: 拨打电话给联系人
- control_smart_device: 控制智能家居设备
- send_emergency_alert: 发送紧急求助
- set_reminder: 设置提醒

## 回复格式
- 使用中文回复
- 句子简短，每句不超过20字
- 避免使用复杂词汇
- 语气亲切温暖
"""


# 工具定义
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "make_phone_call",
            "description": "拨打电话给指定联系人。用户说'打电话给xxx'时使用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "contact_name": {
                        "type": "string",
                        "description": "联系人姓名，如'儿子'、'女儿'、'老伴'、'医生'"
                    },
                    "phone_number": {
                        "type": "string",
                        "description": "电话号码（可选，如果知道的话）"
                    }
                },
                "required": ["contact_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "control_smart_device",
            "description": "控制智能家居设备，如开灯、关灯、调空调等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "device": {
                        "type": "string",
                        "description": "设备名称，如'灯'、'空调'、'电视'、'窗帘'"
                    },
                    "action": {
                        "type": "string",
                        "enum": ["open", "close", "increase", "decrease"],
                        "description": "操作类型：open打开、close关闭、increase增加、decrease减少"
                    },
                    "location": {
                        "type": "string",
                        "description": "位置，如'卧室'、'客厅'、'厨房'"
                    },
                    "value": {
                        "type": "integer",
                        "description": "数值（如空调温度、灯光亮度）"
                    }
                },
                "required": ["device", "action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_emergency_alert",
            "description": "发送紧急求助信号。用户说'帮我'、'救命'、'不舒服'时考虑使用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "emergency_type": {
                        "type": "string",
                        "enum": ["medical", "fall", "help", "other"],
                        "description": "紧急类型：medical医疗、fall跌倒、help求助、other其他"
                    },
                    "message": {
                        "type": "string",
                        "description": "附加信息"
                    }
                },
                "required": ["emergency_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_reminder",
            "description": "设置提醒，如吃药提醒、活动提醒等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "提醒内容，如'吃药'、'喝水'、'休息'"
                    },
                    "time": {
                        "type": "string",
                        "description": "提醒时间，如'10分钟后'、'下午3点'、'每天早上8点'"
                    }
                },
                "required": ["content"]
            }
        }
    }
]


@dataclass
class LLMConfig:
    """LLM配置"""
    api_key: str = ""
    model: str = "glm-4"
    temperature: float = 0.7
    max_tokens: int = 500
    system_prompt: str = ""
    enable_tools: bool = True
    streaming: bool = True


class GLMLLMExtension(AsyncExtension):
    """GLM-4 LLM Extension
    
    实现TEN Framework的LLM Extension接口，支持Tool Calling。
    
    数据流:
    text_data (ASR结果) -> LLM处理 -> text_data (回复)
    
    Tool Calling流程:
    1. 接收用户输入
    2. 调用GLM-4判断是否需要工具
    3. 如需要工具，执行工具并获取结果
    4. 将结果返回给LLM生成最终回复
    """
    
    def __init__(self, name: str):
        super().__init__(name)
        self.config: Optional[LLMConfig] = None
        self.client = None
        self._initialized = False
        self._conversation_history: List[Dict] = []
        self._stream_id: int = 0
        self._interrupted = False
        
    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """初始化Extension"""
        logger.info("GLM LLM Extension initializing...")
        
        try:
            api_key = await ten_env.get_property_string("api_key")
            model = await ten_env.get_property_string("model")
            temperature = await ten_env.get_property_float("temperature")
            max_tokens = await ten_env.get_property_int("max_tokens")
            system_prompt = await ten_env.get_property_string("system_prompt")
            enable_tools = await ten_env.get_property_bool("enable_tools")
            streaming = await ten_env.get_property_bool("streaming")
            
            self.config = LLMConfig(
                api_key=api_key or os.getenv("GLM_API_KEY", ""),
                model=model or "glm-4",
                temperature=temperature if temperature else 0.7,
                max_tokens=max_tokens if max_tokens else 500,
                system_prompt=system_prompt or DYSARTHRIA_SYSTEM_PROMPT,
                enable_tools=enable_tools if enable_tools is not None else True,
                streaming=streaming if streaming is not None else True,
            )
        except Exception as e:
            logger.warning(f"Failed to read config: {e}")
            self.config = LLMConfig(
                api_key=os.getenv("GLM_API_KEY", ""),
                system_prompt=DYSARTHRIA_SYSTEM_PROMPT,
            )
            
        logger.info(f"GLM config: model={self.config.model}, tools={self.config.enable_tools}")
        
    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """启动Extension"""
        logger.info("GLM LLM Extension starting...")
        
        if not self.config.api_key:
            logger.error("GLM API key not configured!")
            return
            
        # 初始化OpenAI兼容客户端
        try:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(
                api_key=self.config.api_key,
                base_url="https://open.bigmodel.cn/api/paas/v4/",
            )
            self._initialized = True
            logger.info("GLM client initialized")
        except ImportError:
            logger.error("OpenAI SDK not installed. Run: pip install openai")
            
    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """停止Extension"""
        logger.info("GLM LLM Extension stopping...")
        self._initialized = False
        self._conversation_history.clear()
        
    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """反初始化"""
        logger.info("GLM LLM Extension deinitializing...")
        
    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理输入数据"""
        if not self._initialized:
            logger.warning("LLM not initialized")
            return
            
        data_name = data.get_name()
        
        if data_name == "text_data":
            await self._handle_text_input(ten_env, data)
        else:
            logger.warning(f"Unknown data type: {data_name}")
            
    async def _handle_text_input(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理ASR文本输入"""
        try:
            text = data.get_property_string("text")
            is_final = data.get_property_bool("is_final")
            stream_id = data.get_property_int("stream_id")
            
            if not text or not is_final:
                return
                
            self._stream_id = stream_id
            self._interrupted = False
            
            logger.info(f"Processing user input: {text}")
            
            # 添加用户消息到历史
            self._conversation_history.append({
                "role": "user",
                "content": text
            })
            
            # 调用LLM
            response = await self._call_llm(ten_env)
            
            if response:
                # 添加助手消息到历史
                self._conversation_history.append({
                    "role": "assistant",
                    "content": response
                })
                
                # 限制历史长度
                if len(self._conversation_history) > 20:
                    self._conversation_history = self._conversation_history[-20:]
                    
        except Exception as e:
            logger.error(f"Error handling text input: {e}")
            
    async def _call_llm(self, ten_env: AsyncTenEnv) -> str:
        """调用GLM-4 LLM"""
        messages = [
            {"role": "system", "content": self.config.system_prompt}
        ] + self._conversation_history
        
        try:
            kwargs = {
                "model": self.config.model,
                "messages": messages,
                "temperature": self.config.temperature,
                "max_tokens": self.config.max_tokens,
            }
            
            # 添加工具定义
            if self.config.enable_tools:
                kwargs["tools"] = TOOL_DEFINITIONS
                kwargs["tool_choice"] = "auto"
                
            if self.config.streaming:
                return await self._call_llm_streaming(ten_env, kwargs)
            else:
                return await self._call_llm_sync(ten_env, kwargs)
                
        except Exception as e:
            logger.error(f"LLM call error: {e}")
            # 返回友好的错误消息
            error_msg = "抱歉，我现在有点问题，请稍后再试。"
            await self._send_text(ten_env, error_msg, is_final=True, end_of_segment=True)
            return error_msg
            
    async def _call_llm_streaming(self, ten_env: AsyncTenEnv, kwargs: Dict) -> str:
        """流式调用LLM"""
        kwargs["stream"] = True
        
        full_response = ""
        tool_calls = []
        current_tool_call = None
        
        async for chunk in await self.client.chat.completions.create(**kwargs):
            if self._interrupted:
                logger.info("LLM response interrupted")
                break
                
            delta = chunk.choices[0].delta if chunk.choices else None
            
            if delta:
                # 处理文本内容
                if delta.content:
                    full_response += delta.content
                    await self._send_text(ten_env, delta.content, is_final=False)
                    
                # 处理工具调用
                if delta.tool_calls:
                    for tool_call_delta in delta.tool_calls:
                        if tool_call_delta.index is not None:
                            if tool_call_delta.index >= len(tool_calls):
                                tool_calls.append({
                                    "id": tool_call_delta.id or "",
                                    "type": "function",
                                    "function": {
                                        "name": "",
                                        "arguments": ""
                                    }
                                })
                            current_tool_call = tool_calls[tool_call_delta.index]
                            
                            if tool_call_delta.function:
                                if tool_call_delta.function.name:
                                    current_tool_call["function"]["name"] = tool_call_delta.function.name
                                if tool_call_delta.function.arguments:
                                    current_tool_call["function"]["arguments"] += tool_call_delta.function.arguments
                                    
        # 发送最终结果
        if full_response:
            await self._send_text(ten_env, "", is_final=True, end_of_segment=True)
            
        # 处理工具调用
        if tool_calls:
            full_response = await self._handle_tool_calls(ten_env, tool_calls)
            
        return full_response
        
    async def _call_llm_sync(self, ten_env: AsyncTenEnv, kwargs: Dict) -> str:
        """同步调用LLM"""
        response = await self.client.chat.completions.create(**kwargs)
        message = response.choices[0].message
        
        # 处理工具调用
        if message.tool_calls:
            return await self._handle_tool_calls(ten_env, [
                {
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                }
                for tc in message.tool_calls
            ])
            
        # 发送文本回复
        if message.content:
            await self._send_text(ten_env, message.content, is_final=True, end_of_segment=True)
            return message.content
            
        return ""
        
    async def _handle_tool_calls(self, ten_env: AsyncTenEnv, tool_calls: List[Dict]) -> str:
        """处理工具调用"""
        tool_results = []
        
        for tool_call in tool_calls:
            func_name = tool_call["function"]["name"]
            func_args = json.loads(tool_call["function"]["arguments"])
            
            logger.info(f"Tool call: {func_name}({func_args})")
            
            # 执行工具
            result = await self._execute_tool(func_name, func_args)
            
            tool_results.append({
                "tool_call_id": tool_call["id"],
                "role": "tool",
                "content": json.dumps(result, ensure_ascii=False)
            })
            
        # 将工具结果添加到消息历史
        self._conversation_history.append({
            "role": "assistant",
            "content": None,
            "tool_calls": tool_calls
        })
        
        for result in tool_results:
            self._conversation_history.append(result)
            
        # 再次调用LLM生成最终回复
        messages = [
            {"role": "system", "content": self.config.system_prompt}
        ] + self._conversation_history
        
        response = await self.client.chat.completions.create(
            model=self.config.model,
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
        )
        
        final_response = response.choices[0].message.content or ""
        await self._send_text(ten_env, final_response, is_final=True, end_of_segment=True)
        
        return final_response
        
    async def _execute_tool(self, func_name: str, args: Dict) -> Dict:
        """执行工具
        
        注意：实际工具执行应该发送命令到外部系统。
        这里返回模拟结果，实际应通过agent-sdk与后端通信。
        """
        if func_name == "make_phone_call":
            contact = args.get("contact_name", "")
            logger.info(f"[Tool] Making call to: {contact}")
            return {
                "success": True,
                "message": f"正在拨打{contact}的电话",
                "action": "call_initiated"
            }
            
        elif func_name == "control_smart_device":
            device = args.get("device", "")
            action = args.get("action", "")
            location = args.get("location", "")
            logger.info(f"[Tool] Controlling device: {device} {action} at {location}")
            return {
                "success": True,
                "message": f"已{action}{location}{device}",
                "device": device,
                "action": action
            }
            
        elif func_name == "send_emergency_alert":
            emergency_type = args.get("emergency_type", "help")
            logger.info(f"[Tool] Sending emergency alert: {emergency_type}")
            return {
                "success": True,
                "message": "紧急求助已发送，家人会尽快联系您",
                "alert_type": emergency_type
            }
            
        elif func_name == "set_reminder":
            content = args.get("content", "")
            time = args.get("time", "")
            logger.info(f"[Tool] Setting reminder: {content} at {time}")
            return {
                "success": True,
                "message": f"已设置{time}的{content}提醒",
                "reminder_content": content,
                "reminder_time": time
            }
            
        else:
            logger.warning(f"Unknown tool: {func_name}")
            return {
                "success": False,
                "message": f"未知工具: {func_name}"
            }
            
    async def _send_text(self, ten_env: AsyncTenEnv, text: str, 
                         is_final: bool = False, end_of_segment: bool = False) -> None:
        """发送文本数据到下游"""
        try:
            output_data = Data.create("text_data")
            output_data.set_property_string("text", text)
            output_data.set_property_bool("is_final", is_final)
            output_data.set_property_bool("end_of_segment", end_of_segment)
            output_data.set_property_int("stream_id", self._stream_id)
            
            await ten_env.send_data(output_data)
            
        except Exception as e:
            logger.error(f"Error sending text: {e}")
            
    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """处理命令"""
        cmd_name = cmd.get_name()
        logger.info(f"Received command: {cmd_name}")
        
        if cmd_name == "flush":
            # 刷新当前处理
            cmd_result = CmdResult.create(StatusCode.OK)
            await ten_env.return_result(cmd_result, cmd)
            
        elif cmd_name == "interrupt":
            # 中断当前生成
            self._interrupted = True
            cmd_result = CmdResult.create(StatusCode.OK)
            await ten_env.return_result(cmd_result, cmd)
            
        else:
            cmd_result = CmdResult.create(StatusCode.ERROR)
            await ten_env.return_result(cmd_result, cmd)


# Extension注册
def register_addon_as_extension(register_func):
    """TEN Extension注册函数"""
    register_func(GLMLLMExtension)
