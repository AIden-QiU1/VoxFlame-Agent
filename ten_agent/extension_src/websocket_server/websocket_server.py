"""
WebSocket Server Manager for receiving audio data
支持多客户端连接（每个客户端有独立的 ASR→LLM→TTS 会话）
"""

import asyncio
import json
import base64
from typing import Callable, Optional, Any, Dict
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit
import websockets
from ten_runtime.async_ten_env import AsyncTenEnv


@dataclass
class AudioData:
    """Container for audio data with metadata"""

    pcm_data: bytes
    client_id: str
    metadata: dict[str, Any]


@dataclass
class ClientConnectionContext:
    """Context parsed from the initial WebSocket request."""

    path: str
    suppress_greeting: bool = False


class WebSocketServerManager:
    """Manages WebSocket server and multiple client connections"""

    def __init__(
        self,
        host: str,
        port: int,
        ten_env: AsyncTenEnv,
        on_audio_callback: Optional[Callable[[AudioData], None]] = None,
        on_cmd_callback: Optional[Callable[[dict, str], None]] = None,
        on_client_connected: Optional[
            Callable[[str, ClientConnectionContext], None]
        ] = None,
        on_client_disconnected: Optional[Callable[[str], None]] = None,
    ):
        self.host = host
        self.port = port
        self.ten_env = ten_env
        self.on_audio_callback = on_audio_callback
        self.on_cmd_callback = on_cmd_callback
        self.on_client_connected = on_client_connected
        self.on_client_disconnected = on_client_disconnected

        self.server = None
        # 改为支持多客户端
        self.clients: Dict[str, Any] = {}  # client_id -> websocket
        self.running = False
        self._server_task: Optional[asyncio.Task] = None
        self._client_lock = asyncio.Lock()

    async def _monitor_server(self) -> None:
        """Periodically log server health while running."""
        while self.running:
            try:
                await asyncio.sleep(10)
                if not self.running:
                    break
                self.ten_env.log_info(
                    f"WebSocket server: {len(self.clients)} clients connected"
                )
            except Exception as e:
                self.ten_env.log_error(f"Monitor error: {e}")

    async def start(self) -> None:
        """Start the WebSocket server"""
        if self.running:
            return

        self.running = True
        try:
            self.server = await websockets.serve(
                self._handle_client, self.host, self.port
            )
            self.ten_env.log_info(
                f"WebSocket server started on ws://{self.host}:{self.port} (multi-client enabled)"
            )
            self._server_task = asyncio.create_task(self._monitor_server())
        except Exception as e:
            self.ten_env.log_error(f"Failed to start: {e}")
            self.running = False
            raise

    async def stop(self) -> None:
        """Stop the WebSocket server and close all connections"""
        if not self.running:
            return

        self.running = False
        if self._server_task:
            self._server_task.cancel()
            self._server_task = None

        # Close all client connections
        async with self._client_lock:
            for client_id, ws in list(self.clients.items()):
                try:
                    await ws.close()
                except:
                    pass
            self.clients.clear()

        if self.server:
            self.server.close()
            await self.server.wait_closed()

        self.ten_env.log_info("WebSocket server stopped")

    async def _handle_client(self, websocket: Any) -> None:
        """Handle a WebSocket client connection"""
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        connection_context = self._extract_connection_context(websocket)

        # 添加到客户端列表
        async with self._client_lock:
            self.clients[client_id] = websocket

        self.ten_env.log_info(
            f"Client connected: {client_id} (total: {len(self.clients)}), "
            f"path={connection_context.path}, suppress_greeting={connection_context.suppress_greeting}"
        )

        # Notify about client connection
        if self.on_client_connected:
            try:
                await self.on_client_connected(client_id, connection_context)
            except Exception as e:
                self.ten_env.log_error(f"Error in on_client_connected callback: {e}")

        try:
            async for message in websocket:
                if not self.running:
                    break
                await self._process_message(message, websocket, client_id)

        except websockets.exceptions.ConnectionClosed:
            self.ten_env.log_info(f"Client disconnected: {client_id}")
        except Exception as e:
            self.ten_env.log_error(f"Error handling client {client_id}: {e}")
            await self._send_error(websocket, f"Server error: {str(e)}")
        finally:
            async with self._client_lock:
                self.clients.pop(client_id, None)
            self.ten_env.log_info(f"Client removed: {client_id} (remaining: {len(self.clients)})")

            # Notify about client disconnection
            if self.on_client_disconnected:
                try:
                    await self.on_client_disconnected(client_id)
                except Exception as e:
                    self.ten_env.log_error(f"Error in on_client_disconnected callback: {e}")

    async def _process_message(
        self, message: str, websocket: Any, client_id: str
    ) -> None:
        """Process incoming message from client"""
        try:
            self.ten_env.log_debug(f"Message from {client_id}: len={len(message)}")
            data = json.loads(message)

            # Handle command-style JSON messages (e.g. system_init, user_input).
            if isinstance(data.get("type"), str) and "audio" not in data:
                if self.on_cmd_callback:
                    await self.on_cmd_callback(data, client_id)
                return

            if "audio" not in data:
                await self._send_error(websocket, 'Missing "audio" field')
                return

            try:
                pcm_data = base64.b64decode(data["audio"])
            except Exception as e:
                await self._send_error(websocket, f"Invalid base64: {e}")
                return

            metadata = data.get("metadata", {})
            metadata["client_id"] = client_id

            audio_data = AudioData(
                pcm_data=pcm_data, client_id=client_id, metadata=metadata
            )

            if self.on_audio_callback:
                try:
                    await self.on_audio_callback(audio_data)
                except Exception as e:
                    self.ten_env.log_error(f"Audio callback error: {e}")
                    await self._send_error(websocket, f"Processing error: {str(e)}")

        except json.JSONDecodeError as e:
            await self._send_error(websocket, f"Invalid JSON: {e}")
        except Exception as e:
            self.ten_env.log_error(f"Error processing: {e}")

    async def _send_error(self, websocket: Any, error: str) -> None:
        """Send error message to client"""
        try:
            await websocket.send(json.dumps({"type": "error", "error": error}))
        except:
            pass

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast message to all connected clients"""
        message_str = json.dumps(message)
        self.ten_env.log_info(f"broadcast: Sending to {len(self.clients)} clients, message_len={len(message_str)}")
        async with self._client_lock:
            for client_id, ws in list(self.clients.items()):
                try:
                    self.ten_env.log_info(f"broadcast: Sending to client {client_id}")
                    await ws.send(message_str)
                    self.ten_env.log_info(f"broadcast: Successfully sent to {client_id}")
                except Exception as e:
                    self.ten_env.log_error(f"broadcast: Failed to send to {client_id}: {e}")

    async def send_audio_to_clients(
        self, pcm_data: bytes, metadata: Optional[dict[str, Any]] = None
    ) -> None:
        """Send audio to all connected clients"""
        self.ten_env.log_info(f"send_audio_to_clients: Called with {len(pcm_data)} bytes, clients={len(self.clients)}")
        if not self.clients:
            self.ten_env.log_warn("send_audio_to_clients: No clients connected, skipping")
            return

        try:
            message = self._build_audio_message(pcm_data, metadata)
            self.ten_env.log_info("send_audio_to_clients: Broadcasting audio message")
            await self.broadcast(message)
            self.ten_env.log_info(f"send_audio_to_clients: Broadcast completed")
        except Exception as e:
            self.ten_env.log_error(f"Error sending audio: {e}")

    async def send_audio_to_client(
        self,
        client_id: str,
        pcm_data: bytes,
        metadata: Optional[dict[str, Any]] = None,
    ) -> bool:
        """Send audio to one specific client."""
        try:
            message = self._build_audio_message(pcm_data, metadata)
            return await self.send_to_client(client_id, message)
        except Exception as e:
            self.ten_env.log_error(
                f"send_audio_to_client failed for {client_id}: {e}"
            )
            return False

    async def send_to_client(
        self, client_id: str, message: dict[str, Any]
    ) -> bool:
        """Send message to a specific client"""
        async with self._client_lock:
            ws = self.clients.get(client_id)
            if not ws:
                return False
            try:
                await ws.send(json.dumps(message))
                return True
            except:
                return False

    def get_client_count(self) -> int:
        """Get number of connected clients"""
        return len(self.clients)

    def _extract_connection_context(self, websocket: Any) -> ClientConnectionContext:
        """Parse request path and query params from a new websocket connection."""
        raw_path = ""

        try:
            raw_path = getattr(websocket, "path", "") or ""
        except Exception:
            raw_path = ""

        if not raw_path:
            try:
                request = getattr(websocket, "request", None)
                raw_path = getattr(request, "path", "") or ""
            except Exception:
                raw_path = ""

        parsed = urlsplit(raw_path or "")
        query = parse_qs(parsed.query)
        suppress_raw = (
            query.get("suppress_greeting", ["0"])[0].strip().lower()
            if query.get("suppress_greeting")
            else "0"
        )

        return ClientConnectionContext(
            path=parsed.path or raw_path or "/",
            suppress_greeting=suppress_raw in {"1", "true", "yes", "on"},
        )

    def _build_audio_message(
        self,
        pcm_data: bytes,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Build websocket audio payload from raw PCM bytes."""
        audio_base64 = base64.b64encode(pcm_data).decode("utf-8")
        message: dict[str, Any] = {"type": "audio", "audio": audio_base64}
        if metadata:
            message["metadata"] = metadata
        return message
