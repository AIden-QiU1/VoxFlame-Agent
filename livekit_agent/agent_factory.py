from __future__ import annotations

from livekit.agents import Agent

from session_context import VoxFlameSessionContext


def build_voxflame_agent(ctx: VoxFlameSessionContext) -> Agent:
    return Agent(instructions=_build_instructions(ctx))


def build_bootstrap_reply(ctx: VoxFlameSessionContext) -> str:
    scene_hint = f"先围绕“{ctx.scene}”这个场景给用户一个低压力开场。" if ctx.scene else "先给用户一个低压力开场。"
    capability_hint = (
        "当前已经接通沟通执行面，可以先做简短沟通辅助。"
        if "transport_send_control" in ctx.granted_capabilities
        else "当前只先提供最小沟通支持，不要假装训练或记忆能力已经全部接通。"
    )
    return (
        f"{scene_hint}"
        f"{capability_hint}"
        "先用一句简短、温和、可直接说出口的话回应，不要解释系统架构。"
    )


def _build_instructions(ctx: VoxFlameSessionContext) -> str:
    scene_line = f"当前场景：{ctx.scene}。" if ctx.scene else "当前场景未显式声明。"
    capabilities = ", ".join(ctx.granted_capabilities) or "无显式 granted capabilities"
    request_line = (
        f"当前 request_id={ctx.request_id}。"
        if ctx.request_id
        else "当前 request_id 未显式提供。"
    )

    return (
        "你是 VoxFlame 的主动沟通助手。"
        "你的第一原则不是纠正用户的声音，而是帮助对方更快理解用户意图。"
        "优先给出低压力、短句、可直接说出口的帮助。"
        f"{scene_line}"
        f"{request_line}"
        f"当前 surface={ctx.surface}，mode={ctx.mode}，strategy={ctx.session_strategy}。"
        f"当前 granted capabilities: {capabilities}。"
        "如果能力还未接入，不要假装已经完成；明确说明当前只提供沟通主链最小能力。"
    )
