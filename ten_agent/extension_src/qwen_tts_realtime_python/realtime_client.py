from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import websockets


ServerEventHandler = Callable[[dict[str, Any]], Awaitable[None]]


def compact_payload(payload: dict[str, Any]) -> str:
    try:
        shallow = dict(payload)
        if "delta" in shallow and isinstance(shallow["delta"], str):
            if len(shallow["delta"]) > 64:
                shallow["delta"] = shallow["delta"][:64] + "..."
        return json.dumps(shallow, ensure_ascii=False)
    except Exception:
        return str(payload)


class QwenRealtimeTTSClient:
    def __init__(
        self,
        *,
        url: str,
        model: str,
        api_key: str,
        connect_timeout_seconds: int,
        event_handler: ServerEventHandler,
        logger: Any,
    ) -> None:
        self.url = with_model_query(url, model)
        self.api_key = api_key
        self.connect_timeout_seconds = connect_timeout_seconds
        self.event_handler = event_handler
        self.logger = logger

        self.websocket = None
        self.receive_task: asyncio.Task[None] | None = None
        self.ready_event = asyncio.Event()
        self._connect_lock = asyncio.Lock()
        self._send_lock = asyncio.Lock()
        self._session_payload: dict[str, Any] = {}
        self.last_connect_delay_ms = 0

    def is_ready(self) -> bool:
        return self.websocket is not None and self.ready_event.is_set()

    async def start(self, session_payload: dict[str, Any]) -> None:
        self._session_payload = session_payload
        await self._connect()

    async def update_session(self, session_payload: dict[str, Any]) -> None:
        self._session_payload = session_payload
        await self._ensure_ready()
        await self._send_json(
            {"type": "session.update", "session": self._session_payload}
        )

    async def append_text(self, text: str) -> None:
        await self._ensure_ready()
        await self._send_json(
            {"type": "input_text_buffer.append", "text": text}
        )

    async def commit_text(self) -> None:
        await self._ensure_ready()
        await self._send_json({"type": "input_text_buffer.commit"})

    async def clear_text(self) -> None:
        if self.websocket is None:
            return
        try:
            await self._send_json({"type": "input_text_buffer.clear"})
        except Exception:
            pass

    async def finish_session(self) -> None:
        if self.websocket is None:
            return
        try:
            await self._send_json({"type": "session.finish"})
        except Exception:
            pass
        await self.stop()

    async def stop(self) -> None:
        async with self._connect_lock:
            await self._close_current_socket()

    async def _ensure_ready(self) -> None:
        if self.is_ready():
            return
        await self._connect()

    async def _connect(self) -> None:
        async with self._connect_lock:
            if self.is_ready():
                return

            await self._close_current_socket()
            self.ready_event.clear()

            headers = [("Authorization", f"Bearer {self.api_key}")]
            started_at = time.perf_counter()
            self.websocket = await websockets.connect(
                self.url,
                additional_headers=headers,
                max_size=16 * 1024 * 1024,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=5,
                open_timeout=self.connect_timeout_seconds,
            )
            self.last_connect_delay_ms = int(
                (time.perf_counter() - started_at) * 1000
            )
            self.logger.log_info(
                f"[QWEN-TTS] connected to realtime endpoint in "
                f"{self.last_connect_delay_ms}ms"
            )

            self.receive_task = asyncio.create_task(self._receive_loop())
            await self._send_json(
                {"type": "session.update", "session": self._session_payload}
            )
            await asyncio.wait_for(
                self.ready_event.wait(), timeout=self.connect_timeout_seconds
            )

    async def _close_current_socket(self) -> None:
        receive_task = self.receive_task
        self.receive_task = None
        websocket = self.websocket
        self.websocket = None
        self.ready_event.clear()

        if receive_task:
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        if websocket:
            try:
                await websocket.close()
            except Exception:
                pass

    async def _send_json(self, payload: dict[str, Any]) -> None:
        if self.websocket is None:
            raise RuntimeError("Qwen realtime TTS websocket is not connected")

        async with self._send_lock:
            payload_to_send = dict(payload)
            payload_to_send.setdefault("event_id", f"event_{uuid.uuid4().hex}")
            self.logger.log_debug(
                f"[QWEN-TTS] -> {compact_payload(payload_to_send)}"
            )
            await self.websocket.send(
                json.dumps(payload_to_send, ensure_ascii=False)
            )

    async def _receive_loop(self) -> None:
        websocket = self.websocket
        if websocket is None:
            return

        try:
            async for raw_message in websocket:
                if isinstance(raw_message, bytes):
                    self.logger.log_debug(
                        f"[QWEN-TTS] ignore binary frame len={len(raw_message)}"
                    )
                    continue

                payload = json.loads(raw_message)
                message_type = str(payload.get("type", "") or "")
                self.logger.log_debug(
                    f"[QWEN-TTS] <- {compact_payload(payload)}"
                )

                if message_type in {"session.created", "session.updated"}:
                    self.ready_event.set()
                elif message_type == "session.finished":
                    self.ready_event.clear()

                await self.event_handler(payload)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self.event_handler(
                {
                    "type": "client.error",
                    "error": {"message": str(exc)},
                }
            )
        finally:
            if websocket is self.websocket:
                self.ready_event.clear()
                self.websocket = None


def with_model_query(url: str, model: str) -> str:
    if not model:
        return url

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if query.get("model"):
        return url

    query["model"] = model
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )
