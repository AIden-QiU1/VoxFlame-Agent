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
    payload: Any = None
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
    ten_env.log_debug(f"[VoxFlame] send_cmd: {cmd_name} -> {dest}")

    return await ten_env.send_cmd(cmd)


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
