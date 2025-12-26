"""
Backend Webhook Extension for TEN Framework

将TEN Agent与agent-sdk业务层连接的桥接Extension。
负责：
- 转发会话数据到后端存储
- 获取用户配置文件和偏好
- 执行需要后端支持的工具调用

集成方式:
- HTTP Webhook: POST请求发送数据
- 可选WebSocket: 实时双向通信

与agent-sdk的集成点:
- /api/agent/session - 会话管理
- /api/agent/profile - 用户配置
- /api/agent/tool - 工具执行
"""

import asyncio
import logging
import os
import json
from typing import Optional, Dict, Any
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
class WebhookConfig:
    """Webhook配置"""
    webhook_url: str = ""
    user_id: str = ""
    session_id: str = ""
    enable_logging: bool = True
    timeout: int = 5000  # ms


class BackendWebhookExtension(AsyncExtension):
    """Backend Webhook Extension
    
    桥接TEN Framework与agent-sdk业务层。
    
    主要功能:
    1. 会话记录: 保存ASR/LLM交互到后端
    2. 用户配置: 获取用户偏好和配置
    3. 工具执行: 转发工具调用到后端执行
    
    数据流:
    - 接收: ASR文本、LLM回复、工具调用结果
    - 发送: 用户上下文、配置更新
    """
    
    def __init__(self, name: str):
        super().__init__(name)
        self.config: Optional[WebhookConfig] = None
        self._initialized = False
        self._session = None
        self._user_profile = {}
        
    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        """初始化Extension"""
        logger.info("Backend Webhook Extension initializing...")
        
        try:
            webhook_url = await ten_env.get_property_string("webhook_url")
            user_id = await ten_env.get_property_string("user_id")
            session_id = await ten_env.get_property_string("session_id")
            enable_logging = await ten_env.get_property_bool("enable_logging")
            timeout = await ten_env.get_property_int("timeout")
            
            self.config = WebhookConfig(
                webhook_url=webhook_url or os.getenv("AGENT_SDK_URL", "http://localhost:3001"),
                user_id=user_id or "",
                session_id=session_id or "",
                enable_logging=enable_logging if enable_logging is not None else True,
                timeout=timeout if timeout else 5000,
            )
        except Exception as e:
            logger.warning(f"Failed to read config: {e}")
            self.config = WebhookConfig(
                webhook_url=os.getenv("AGENT_SDK_URL", "http://localhost:3001"),
            )
            
        logger.info(f"Webhook config: url={self.config.webhook_url}")
        
    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        """启动Extension"""
        logger.info("Backend Webhook Extension starting...")
        
        # 初始化HTTP会话
        import aiohttp
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.timeout / 1000)
        )
        
        # 获取用户配置
        if self.config.user_id:
            await self._fetch_user_profile()
            
        self._initialized = True
        
    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        """停止Extension"""
        logger.info("Backend Webhook Extension stopping...")
        
        if self._session:
            await self._session.close()
            
        self._initialized = False
        
    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        """反初始化"""
        logger.info("Backend Webhook Extension deinitializing...")
        
    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理输入数据"""
        if not self._initialized:
            logger.warning("Webhook not initialized")
            return
            
        data_name = data.get_name()
        
        if data_name == "text_data":
            await self._handle_text_data(ten_env, data)
        elif data_name == "tool_result":
            await self._handle_tool_result(ten_env, data)
        else:
            logger.debug(f"Ignoring data type: {data_name}")
            
    async def _handle_text_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理文本数据（ASR/LLM）"""
        try:
            text = data.get_property_string("text")
            is_final = data.get_property_bool("is_final")
            source = data.get_property_string("source")  # "asr" or "llm"
            
            if not is_final or not text:
                return
                
            # 记录到后端
            if self.config.enable_logging:
                await self._log_conversation(source, text)
                
        except Exception as e:
            logger.error(f"Error handling text data: {e}")
            
    async def _handle_tool_result(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """处理工具执行结果"""
        try:
            tool_name = data.get_property_string("tool_name")
            result = data.get_property_string("result")
            success = data.get_property_bool("success")
            
            # 记录工具执行结果
            if self.config.enable_logging:
                await self._log_tool_execution(tool_name, result, success)
                
        except Exception as e:
            logger.error(f"Error handling tool result: {e}")
            
    async def _log_conversation(self, source: str, text: str) -> None:
        """记录会话到后端"""
        try:
            url = f"{self.config.webhook_url}/api/agent/session/log"
            payload = {
                "user_id": self.config.user_id,
                "session_id": self.config.session_id,
                "source": source,
                "text": text,
                "timestamp": self._get_timestamp(),
            }
            
            async with self._session.post(url, json=payload) as response:
                if response.status != 200:
                    error = await response.text()
                    logger.warning(f"Failed to log conversation: {error}")
                    
        except Exception as e:
            logger.error(f"Error logging conversation: {e}")
            
    async def _log_tool_execution(self, tool_name: str, result: str, success: bool) -> None:
        """记录工具执行到后端"""
        try:
            url = f"{self.config.webhook_url}/api/agent/tool/log"
            payload = {
                "user_id": self.config.user_id,
                "session_id": self.config.session_id,
                "tool_name": tool_name,
                "result": result,
                "success": success,
                "timestamp": self._get_timestamp(),
            }
            
            async with self._session.post(url, json=payload) as response:
                if response.status != 200:
                    error = await response.text()
                    logger.warning(f"Failed to log tool execution: {error}")
                    
        except Exception as e:
            logger.error(f"Error logging tool execution: {e}")
            
    async def _fetch_user_profile(self) -> None:
        """获取用户配置"""
        try:
            url = f"{self.config.webhook_url}/api/agent/profile/{self.config.user_id}"
            
            async with self._session.get(url) as response:
                if response.status == 200:
                    self._user_profile = await response.json()
                    logger.info(f"Fetched user profile: {self._user_profile.get('name', 'Unknown')}")
                else:
                    logger.warning(f"Failed to fetch user profile")
                    
        except Exception as e:
            logger.error(f"Error fetching user profile: {e}")
            
    async def _execute_tool_on_backend(self, tool_name: str, args: Dict) -> Dict:
        """在后端执行工具"""
        try:
            url = f"{self.config.webhook_url}/api/agent/tool/execute"
            payload = {
                "user_id": self.config.user_id,
                "session_id": self.config.session_id,
                "tool_name": tool_name,
                "arguments": args,
            }
            
            async with self._session.post(url, json=payload) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error = await response.text()
                    return {
                        "success": False,
                        "error": error
                    }
                    
        except Exception as e:
            logger.error(f"Error executing tool on backend: {e}")
            return {
                "success": False,
                "error": str(e)
            }
            
    def _get_timestamp(self) -> int:
        """获取当前时间戳(毫秒)"""
        import time
        return int(time.time() * 1000)
        
    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """处理命令"""
        cmd_name = cmd.get_name()
        logger.info(f"Received command: {cmd_name}")
        
        if cmd_name == "get_user_profile":
            # 返回用户配置
            await self._fetch_user_profile()
            
            # 发送用户上下文数据
            context_data = Data.create("user_context")
            context_data.set_property_string("user_profile", json.dumps(self._user_profile, ensure_ascii=False))
            context_data.set_property_string("preferences", json.dumps(self._user_profile.get("preferences", {}), ensure_ascii=False))
            context_data.set_property_string("history", json.dumps(self._user_profile.get("history", []), ensure_ascii=False))
            await ten_env.send_data(context_data)
            
            cmd_result = CmdResult.create(StatusCode.OK)
            await ten_env.return_result(cmd_result, cmd)
            
        elif cmd_name == "execute_tool":
            # 在后端执行工具
            try:
                tool_name = cmd.get_property_string("tool_name")
                args_json = cmd.get_property_string("arguments")
                args = json.loads(args_json) if args_json else {}
                
                result = await self._execute_tool_on_backend(tool_name, args)
                
                # 返回结果
                cmd_result = CmdResult.create(StatusCode.OK)
                cmd_result.set_property_string("result", json.dumps(result, ensure_ascii=False))
                await ten_env.return_result(cmd_result, cmd)
                
            except Exception as e:
                logger.error(f"Error executing tool: {e}")
                cmd_result = CmdResult.create(StatusCode.ERROR)
                await ten_env.return_result(cmd_result, cmd)
                
        else:
            cmd_result = CmdResult.create(StatusCode.ERROR)
            await ten_env.return_result(cmd_result, cmd)


# Extension注册
def register_addon_as_extension(register_func):
    """TEN Extension注册函数"""
    register_func(BackendWebhookExtension)
