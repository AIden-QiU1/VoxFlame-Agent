from __future__ import annotations

import asyncio
import base64
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from typing import Any


class FakeConnectionClosed(Exception):
    pass


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict[str, Any]] = []
        self.incoming: asyncio.Queue[str | bytes | object] = asyncio.Queue()
        self.closed = False

    async def send(self, message: str) -> None:
        payload = json.loads(message)
        self.sent_messages.append(payload)
        if payload.get("type") == "session.update":
            await self.queue_json({"type": "session.updated"})

    async def close(self) -> None:
        self.closed = True
        await self.incoming.put(StopAsyncIteration)

    async def queue_json(self, payload: dict[str, Any]) -> None:
        await self.incoming.put(json.dumps(payload, ensure_ascii=False))

    async def queue_text(self, payload: str) -> None:
        await self.incoming.put(payload)

    def __aiter__(self) -> "FakeWebSocket":
        return self

    async def __anext__(self) -> str | bytes:
        item = await self.incoming.get()
        if item is StopAsyncIteration:
            raise StopAsyncIteration
        return item


class FakeWebsocketsModule(types.SimpleNamespace):
    def __init__(self) -> None:
        super().__init__()
        self.connections: list[FakeWebSocket] = []
        self.connect_calls: list[dict[str, Any]] = []
        self.ConnectionClosed = FakeConnectionClosed

    async def connect(self, url: str, **kwargs: Any) -> FakeWebSocket:
        websocket = FakeWebSocket()
        self.connections.append(websocket)
        self.connect_calls.append({"url": url, "kwargs": kwargs})
        return websocket


FAKE_WEBSOCKETS = FakeWebsocketsModule()
sys.modules["websockets"] = FAKE_WEBSOCKETS

ROOT = Path(__file__).resolve().parents[1]


def load_module(module_name: str, relative_path: str):
    module_path = ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


asr_module = load_module(
    "qwen_asr_realtime_client_test",
    "ten_agent/extension_src/qwen_asr_realtime_python/realtime_client.py",
)
tts_module = load_module(
    "qwen_tts_realtime_client_test",
    "ten_agent/extension_src/qwen_tts_realtime_python/realtime_client.py",
)

QwenRealtimeASRClient = asr_module.QwenRealtimeASRClient
with_asr_model_query = asr_module.with_model_query
QwenRealtimeTTSClient = tts_module.QwenRealtimeTTSClient
with_tts_model_query = tts_module.with_model_query


class FakeLogger:
    def log_info(self, message: str, *args: Any, **kwargs: Any) -> None:
        del message, args, kwargs

    def log_debug(self, message: str, *args: Any, **kwargs: Any) -> None:
        del message, args, kwargs


async def wait_for(predicate, timeout: float = 1.0) -> None:
    deadline = asyncio.get_running_loop().time() + timeout
    while not predicate():
        if asyncio.get_running_loop().time() >= deadline:
            raise TimeoutError("condition not met before timeout")
        await asyncio.sleep(0.01)


class QwenRealtimeClientsTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        FAKE_WEBSOCKETS.connections.clear()
        FAKE_WEBSOCKETS.connect_calls.clear()
        self.logger = FakeLogger()
        self.asr_events: list[dict[str, Any]] = []
        self.tts_events: list[dict[str, Any]] = []

        async def handle_asr_event(payload: dict[str, Any]) -> None:
            self.asr_events.append(payload)

        async def handle_tts_event(payload: dict[str, Any]) -> None:
            self.tts_events.append(payload)

        self.handle_asr_event = handle_asr_event
        self.handle_tts_event = handle_tts_event

    async def test_asr_client_sends_session_append_commit_and_finish(self) -> None:
        client = QwenRealtimeASRClient(
            url="ws://local/realtime",
            model="qwen-test-asr",
            api_key="token",
            connect_timeout_seconds=1,
            event_handler=self.handle_asr_event,
            logger=self.logger,
        )

        await client.start({"modalities": ["text"], "sample_rate": 16000})
        await client.append_audio(b"\x01\x02\x03\x04")
        await client.commit_audio()
        await client.finish_session()

        websocket = FAKE_WEBSOCKETS.connections[0]
        self.assertEqual(websocket.sent_messages[0]["type"], "session.update")
        self.assertEqual(websocket.sent_messages[1]["type"], "input_audio_buffer.append")
        self.assertEqual(
            base64.b64decode(websocket.sent_messages[1]["audio"]),
            b"\x01\x02\x03\x04",
        )
        self.assertEqual(websocket.sent_messages[2]["type"], "input_audio_buffer.commit")
        self.assertEqual(websocket.sent_messages[3]["type"], "session.finish")
        self.assertTrue(any(event.get("type") == "session.updated" for event in self.asr_events))

    async def test_asr_client_reconnects_after_stop(self) -> None:
        client = QwenRealtimeASRClient(
            url="ws://local/realtime",
            model="qwen-test-asr",
            api_key="token",
            connect_timeout_seconds=1,
            event_handler=self.handle_asr_event,
            logger=self.logger,
        )

        await client.start({"modalities": ["text"]})
        await client.stop()
        await client.append_audio(b"\x05\x06")

        self.assertEqual(len(FAKE_WEBSOCKETS.connections), 2)
        self.assertEqual(
            FAKE_WEBSOCKETS.connections[1].sent_messages[0]["type"],
            "session.update",
        )
        self.assertEqual(
            FAKE_WEBSOCKETS.connections[1].sent_messages[1]["type"],
            "input_audio_buffer.append",
        )

    async def test_asr_client_reports_client_error_on_invalid_server_message(self) -> None:
        client = QwenRealtimeASRClient(
            url="ws://local/realtime",
            model="qwen-test-asr",
            api_key="token",
            connect_timeout_seconds=1,
            event_handler=self.handle_asr_event,
            logger=self.logger,
        )

        await client.start({"modalities": ["text"]})
        websocket = FAKE_WEBSOCKETS.connections[0]
        await websocket.queue_text("not-json")

        await wait_for(lambda: any(event.get("type") == "client.error" for event in self.asr_events))

    async def test_asr_client_invalidate_forces_reconnect_on_next_audio(self) -> None:
        client = QwenRealtimeASRClient(
            url="ws://local/realtime",
            model="qwen-test-asr",
            api_key="token",
            connect_timeout_seconds=1,
            event_handler=self.handle_asr_event,
            logger=self.logger,
        )

        await client.start({"modalities": ["text"]})
        client.invalidate()
        await client.append_audio(b"\x09\x0a")

        self.assertEqual(len(FAKE_WEBSOCKETS.connections), 2)
        self.assertEqual(
            FAKE_WEBSOCKETS.connections[1].sent_messages[0]["type"],
            "session.update",
        )
        self.assertEqual(
            FAKE_WEBSOCKETS.connections[1].sent_messages[1]["type"],
            "input_audio_buffer.append",
        )

    async def test_tts_client_sends_session_append_commit_clear_and_finish(self) -> None:
        client = QwenRealtimeTTSClient(
            url="ws://local/realtime",
            model="qwen-test-tts",
            api_key="token",
            connect_timeout_seconds=1,
            event_handler=self.handle_tts_event,
            logger=self.logger,
        )

        await client.start({"modalities": ["audio"]})
        await client.append_text("你好")
        await client.commit_text()
        await client.clear_text()
        await client.finish_session()

        websocket = FAKE_WEBSOCKETS.connections[0]
        self.assertEqual(websocket.sent_messages[0]["type"], "session.update")
        self.assertEqual(websocket.sent_messages[1]["type"], "input_text_buffer.append")
        self.assertEqual(websocket.sent_messages[1]["text"], "你好")
        self.assertEqual(websocket.sent_messages[2]["type"], "input_text_buffer.commit")
        self.assertEqual(websocket.sent_messages[3]["type"], "input_text_buffer.clear")
        self.assertEqual(websocket.sent_messages[4]["type"], "session.finish")
        self.assertTrue(any(event.get("type") == "session.updated" for event in self.tts_events))

    def test_model_query_helpers_preserve_existing_query(self) -> None:
        self.assertEqual(
            with_asr_model_query("wss://example.com/realtime", "qwen-asr"),
            "wss://example.com/realtime?model=qwen-asr",
        )
        self.assertEqual(
            with_asr_model_query("wss://example.com/realtime?model=keep", "qwen-asr"),
            "wss://example.com/realtime?model=keep",
        )
        self.assertEqual(
            with_tts_model_query("wss://example.com/realtime?foo=bar", "qwen-tts"),
            "wss://example.com/realtime?foo=bar&model=qwen-tts",
        )


if __name__ == "__main__":
    unittest.main()
