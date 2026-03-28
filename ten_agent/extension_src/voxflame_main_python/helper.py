#
# VoxFlame Helper Functions
# Utility functions for sending commands and data
#

import json
from typing import Any, Optional
from ten_runtime import AsyncTenEnv, Cmd, CmdResult, Data, Loc, TenError


async def send_cmd(
    ten_env: AsyncTenEnv,
    cmd_name: str,
    dest: str,
    payload: Any = None,
    buffer_properties: Optional[dict[str, bytes]] = None,
) -> tuple[Optional[CmdResult], Optional[TenError]]:
    """
    Send a command to a specific extension.

    Args:
        ten_env: TEN environment
        cmd_name: Name of the command
        dest: Destination extension name
        payload: Optional payload data

    Returns:
        Tuple of (CmdResult, TenError)
    """
    cmd = Cmd.create(cmd_name)
    loc = Loc("", "", dest)
    cmd.set_dests([loc])
    if payload is not None:
        cmd.set_property_from_json(None, json.dumps(payload))
    if buffer_properties:
        for key, value in buffer_properties.items():
            if value:
                cmd.set_property_buf(key, value)
    ten_env.log_debug(f"[VoxFlame] send_cmd: {cmd_name} -> {dest}")

    return await ten_env.send_cmd(cmd)


async def send_rtm_publish(
    ten_env: AsyncTenEnv,
    dest: str,
    message: Any,
    *,
    channel_name: Optional[str] = None,
    channel_type: str = "MESSAGE",
) -> tuple[Optional[CmdResult], Optional[TenError]]:
    """
    Publish a realtime text/control payload through agora_rtm.

    The agora_rtm addon expects the `message` field as a raw buffer. Keep the
    control payload JSON-encoded so browser RTM clients can parse it directly.
    """
    if isinstance(message, bytes):
        message_bytes = message
    elif isinstance(message, str):
        message_bytes = message.encode("utf-8")
    else:
        message_bytes = json.dumps(message, ensure_ascii=False).encode("utf-8")

    payload: dict[str, Any] = {"channelType": channel_type}
    if channel_name:
        payload["channelName"] = channel_name

    return await send_cmd(
        ten_env,
        "publish",
        dest,
        payload=payload,
        buffer_properties={"message": message_bytes},
    )


async def send_data(
    ten_env: AsyncTenEnv,
    data_name: str,
    dest: str,
    payload: Any = None
) -> Optional[TenError]:
    """
    Send data to a specific extension.

    Args:
        ten_env: TEN environment
        data_name: Name of the data
        dest: Destination extension name
        payload: Optional payload data

    Returns:
        Optional TenError if failed
    """
    data = Data.create(data_name)
    loc = Loc("", "", dest)
    data.set_dests([loc])
    if payload is not None:
        if data_name == "data" and dest == "agora_rtc":
            payload_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            if payload_bytes:
                data.set_property_buf("data", payload_bytes)
        else:
            data.set_property_from_json(None, json.dumps(payload))
    ten_env.log_debug(f"[VoxFlame] send_data: {data_name} -> {dest}")

    return await ten_env.send_data(data)


async def broadcast_data(
    ten_env: AsyncTenEnv,
    data_name: str,
    payload: Any = None
) -> Optional[TenError]:
    """
    Broadcast data to all connected extensions (via graph connections).

    Args:
        ten_env: TEN environment
        data_name: Name of the data
        payload: Optional payload data

    Returns:
        Optional TenError if failed
    """
    data = Data.create(data_name)
    if payload is not None:
        data.set_property_from_json(None, json.dumps(payload))
    ten_env.log_debug(f"[VoxFlame] broadcast_data: {data_name}")

    return await ten_env.send_data(data)
