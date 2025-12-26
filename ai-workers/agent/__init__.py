"""
VoxFlame Agent Module - 智能对话代理

支持多种LLM后端：
- 通义千问 (阿里DashScope)
- 智谱AI (ChatGLM)
"""

from .qwen_agent import QwenAgent, AgentConfig

__all__ = ["QwenAgent", "AgentConfig"]
