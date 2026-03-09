#
# This file is part of TEN Framework, an open source project.
# Licensed under the Apache License, Version 2.0.
# See the LICENSE file for more information.
#
import json
from pathlib import Path
from typing import Any, Optional
from ten_runtime import (
    AudioFrame,
    VideoFrame,
    AsyncExtension,
    AsyncTenEnv,
    Cmd,
    StatusCode,
    CmdResult,
    Data,
    AudioFrameDataFmt,
)

from .config import WebSocketServerConfig
from .websocket_server import (
    WebSocketServerManager,
    AudioData,
    ClientConnectionContext,
)


class WebsocketServerExtension(AsyncExtension):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.config: WebSocketServerConfig = None
        self.ws_server: WebSocketServerManager = None
        self.dump_file = None
        self.dump_bytes_written = 0
        self.ten_env: AsyncTenEnv = None

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        # Store ten_env for later use
        self.ten_env = ten_env

        ten_env.log_info("WebSocket Server Extension initializing...")

        # Load configuration from property.json
        try:
            config_json, _ = await ten_env.get_property_to_json("")
            self.config = WebSocketServerConfig.model_validate_json(config_json)
            self.config.validate_config()

            ten_env.log_info(f"Loaded config: {self.config.to_str()}")
        except Exception as e:
            ten_env.log_error(f"Failed to load configuration: {e}")
            raise

        # Initialize dump file if enabled
        if self.config.dump:
            try:
                dump_path = Path(self.config.dump_path)
                dump_path.parent.mkdir(parents=True, exist_ok=True)
                self.dump_file = open(dump_path, "wb")
                self.dump_bytes_written = 0
                ten_env.log_info(f"Audio dump enabled: {dump_path}")
            except Exception as e:
                ten_env.log_error(f"Failed to open dump file: {e}")
                self.dump_file = None

    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        ten_env.log_info("WebSocket Server Extension starting...")

        # Create and start WebSocket server
        try:
            self.ws_server = WebSocketServerManager(
                host=self.config.host,
                port=self.config.port,
                ten_env=ten_env,
                on_audio_callback=self._on_audio_received,
                on_cmd_callback=self._on_cmd_received,
                on_client_connected=self._on_client_connected,
                on_client_disconnected=self._on_client_disconnected,
            )
            await self.ws_server.start()
            ten_env.log_info(
                f"WebSocket server listening on ws://{self.config.host}:{self.config.port}"
            )
        except Exception as e:
            ten_env.log_error(f"Failed to start WebSocket server: {e}")
            raise

    async def on_stop(self, ten_env: AsyncTenEnv) -> None:
        ten_env.log_info("WebSocket Server Extension stopping...")

        # Stop WebSocket server
        if self.ws_server:
            await self.ws_server.stop()
            self.ws_server = None

        # Close dump file
        if self.dump_file:
            try:
                self.dump_file.close()
                ten_env.log_info("Audio dump file closed")
            except Exception as e:
                ten_env.log_error(f"Error closing dump file: {e}")
            finally:
                self.dump_file = None

    async def on_deinit(self, ten_env: AsyncTenEnv) -> None:
        ten_env.log_info("WebSocket Server Extension deinitializing...")

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        """
        Handle command messages from TEN graph
        Forward to WebSocket clients as JSON
        """
        cmd_name = cmd.get_name()
        ten_env.log_debug(f"Received command: {cmd_name}")

        try:
            # Convert command to JSON
            cmd_json = cmd.to_json()
            cmd_data = json.loads(cmd_json)

            target_client_id = self._extract_client_id_from_cmd(cmd)
            if self.ws_server:
                message = {"type": "cmd", "name": cmd_name, "data": cmd_data}
                await self._send_message_to_clients(
                    ten_env,
                    message,
                    target_client_id,
                    log_label=f"cmd/{cmd_name}",
                )

        except Exception as e:
            ten_env.log_error(
                f"Error forwarding command to WebSocket clients: {e}"
            )

        # Return success
        cmd_result = CmdResult.create(StatusCode.OK, cmd)
        await ten_env.return_result(cmd_result)

    async def on_data(self, ten_env: AsyncTenEnv, data: Data) -> None:
        """
        Handle data messages from TEN graph (e.g., ASR results, LLM responses, corrections)
        Forward to WebSocket clients as JSON
        """
        data_name = data.get_name()
        ten_env.log_debug(f"Received data: {data_name}")
        try:
            # Handle various data types from the graph
            if data_name in ["text_data", "corrected_text", "interim_text", "transcript"]:
                # Convert data to JSON
                data_json, _ = data.get_property_to_json(None)
                ten_env.log_info(f"Data [{data_name}]: {data_json}")
                data_dict = json.loads(data_json)

                target_client_id = self._extract_client_id_from_payload(data_dict)
                if self.ws_server:
                    message = {
                        "type": "data",
                        "name": data_name,
                        "data": data_dict,
                    }
                    await self._send_message_to_clients(
                        ten_env,
                        message,
                        target_client_id,
                        log_label=f"data/{data_name}",
                    )

        except Exception as e:
            ten_env.log_error(
                f"Error forwarding data to WebSocket clients: {e}"
            )

    async def on_audio_frame(
        self, ten_env: AsyncTenEnv, audio_frame: AudioFrame
    ) -> None:
        """
        Handle audio frames from TEN graph (e.g., TTS output)
        Sends audio to WebSocket clients as base64-encoded JSON
        """
        audio_frame_name = audio_frame.get_name()
        ten_env.log_debug(f"Received audio frame: {audio_frame_name}")

        if not self.ws_server:
            ten_env.log_warn(
                "WebSocket server not initialized, dropping audio frame"
            )
            return

        try:
            # Get PCM data from audio frame
            buf = audio_frame.lock_buf()
            pcm_data = bytes(buf)
            audio_frame.unlock_buf(buf)

            # Extract metadata if present
            metadata = {}
            try:
                metadata_json = audio_frame.get_property_string("metadata")
                if metadata_json:
                    metadata = json.loads(metadata_json)
            except Exception:
                # No metadata or invalid JSON, continue without it
                pass

            # Add audio properties to metadata
            metadata.update(
                {
                    "sample_rate": audio_frame.get_sample_rate(),
                    "channels": audio_frame.get_number_of_channels(),
                    "bytes_per_sample": audio_frame.get_bytes_per_sample(),
                    "samples_per_channel": audio_frame.get_samples_per_channel(),
                }
            )

            target_client_id = self._extract_client_id_from_payload(metadata)
            if target_client_id:
                sent = await self.ws_server.send_audio_to_client(
                    target_client_id,
                    pcm_data,
                    metadata,
                )
                if not sent:
                    ten_env.log_warn(
                        f"Failed to send audio to target client {target_client_id}; dropping chunk"
                    )
            else:
                await self.ws_server.send_audio_to_clients(pcm_data, metadata)

            ten_env.log_debug(
                f"Forwarded {len(pcm_data)} bytes of audio to WebSocket clients"
            )

        except Exception as e:
            ten_env.log_error(
                f"Error processing audio frame for WebSocket: {e}"
            )

    async def on_video_frame(
        self, ten_env: AsyncTenEnv, video_frame: VideoFrame
    ) -> None:
        """Handle video frames (not typically used for this extension)"""
        video_frame_name = video_frame.get_name()
        ten_env.log_debug(f"Received video frame: {video_frame_name}")

    async def _on_audio_received(self, audio_data: AudioData) -> None:
        """
        Callback when audio data is received from WebSocket client
        Creates AudioFrame and sends it to TEN graph

        Args:
            audio_data: Audio data container with PCM data and metadata
        """
        try:
            self.ten_env.log_info(f"Audio received: {len(audio_data.pcm_data)} bytes")
            # Get ten_env (stored during initialization)
            ten_env = self.ten_env

            # Dump audio if enabled
            if self.dump_file:
                try:
                    self.dump_file.write(audio_data.pcm_data)
                    self.dump_bytes_written += len(audio_data.pcm_data)
                    # Truncate when exceeding configured max size
                    if self.dump_bytes_written >= self.config.dump_max_bytes:
                        self.dump_file.flush()
                        self.dump_file.close()
                        # Reopen same path in write mode to truncate
                        dump_path = Path(self.config.dump_path)
                        self.dump_file = open(dump_path, "wb")
                        self.dump_bytes_written = 0
                        ten_env.log_info(
                            f"Audio dump truncated after reaching {self.config.dump_max_bytes} bytes"
                        )
                    else:
                        self.dump_file.flush()
                except Exception as e:
                    ten_env.log_error(f"Error writing dump file: {e}")

            # Create AudioFrame
            audio_frame = AudioFrame.create("pcm_frame")

            # Set fixed audio properties (16kHz mono 16-bit PCM)
            audio_frame.set_sample_rate(self.config.sample_rate)
            audio_frame.set_bytes_per_sample(self.config.bytes_per_sample)
            audio_frame.set_number_of_channels(self.config.channels)
            audio_frame.set_data_fmt(AudioFrameDataFmt.INTERLEAVE)

            # Calculate number of samples
            bytes_per_frame = (
                self.config.bytes_per_sample * self.config.channels
            )
            samples_per_channel = len(audio_data.pcm_data) // bytes_per_frame
            audio_frame.set_samples_per_channel(samples_per_channel)

            # Allocate and fill buffer
            audio_frame.alloc_buf(len(audio_data.pcm_data))
            buf = audio_frame.lock_buf()
            buf[:] = audio_data.pcm_data
            audio_frame.unlock_buf(buf)

            # Attach metadata if present
            if audio_data.metadata:
                metadata_json = json.dumps(audio_data.metadata)
                audio_frame.set_property_from_json("metadata", metadata_json)

            # Send audio frame to TEN graph
            await ten_env.send_audio_frame(audio_frame)

            ten_env.log_debug(
                f"Sent audio frame from {audio_data.client_id}: "
                f"{len(audio_data.pcm_data)} bytes, {samples_per_channel} samples"
            )

        except Exception as e:
            ten_env.log_error(f"Error processing audio from WebSocket: {e}")
            raise

    async def _on_client_connected(
        self,
        client_id: str,
        connection_context: ClientConnectionContext,
    ) -> None:
        """
        Callback when a WebSocket client connects.
        Sends on_user_connected command to main_control.
        """
        try:
            self.ten_env.log_info(
                "Sending on_user_connected for client: "
                f"{client_id}, suppress_greeting={connection_context.suppress_greeting}"
            )
            cmd = Cmd.create("on_user_connected")
            cmd.set_property_string("client_id", client_id)
            cmd.set_property_from_json(
                "suppress_greeting",
                json.dumps(connection_context.suppress_greeting),
            )
            await self.ten_env.send_cmd(cmd)
        except Exception as e:
            self.ten_env.log_error(f"Error sending on_user_connected: {e}")

    async def _on_client_disconnected(self, client_id: str) -> None:
        """
        Callback when a WebSocket client disconnects.
        Sends on_user_disconnected command to main_control.
        """
        try:
            self.ten_env.log_info(f"Sending on_user_disconnected for client: {client_id}")
            cmd = Cmd.create("on_user_disconnected")
            cmd.set_property_string("client_id", client_id)
            await self.ten_env.send_cmd(cmd)
        except Exception as e:
            self.ten_env.log_error(f"Error sending on_user_disconnected: {e}")

    async def _on_cmd_received(self, data: dict, client_id: str) -> None:
        """
        Callback when a command JSON is received from WebSocket client.
        Sends Cmd to TEN graph.
        """
        try:
            cmd_name = data.get("type", "unknown_cmd")
            self.ten_env.log_info(f"Received command: {cmd_name} from {client_id}")
            
            cmd = Cmd.create(cmd_name)
            
            # Pass properties to Cmd
            for k, v in data.items():
                if k == "type": continue
                # We use set_property_from_json for everything to support complex types
                try:
                    cmd.set_property_from_json(k, json.dumps(v))
                except:
                    # Fallback for simple strings if json dump fails (unlikely for dict values)
                    cmd.set_property_string(k, str(v))
            
            cmd.set_property_string("client_id", client_id)
            
            await self.ten_env.send_cmd(cmd)
            self.ten_env.log_debug(f"Forwarded command {cmd_name} to TEN graph")
            
        except Exception as e:
            self.ten_env.log_error(f"Error processing command from WebSocket: {e}")

    def _extract_client_id_from_cmd(self, cmd: Cmd) -> Optional[str]:
        """Extract client_id from TEN command payload if present."""
        try:
            client_id = cmd.get_property_string("client_id")
            if isinstance(client_id, str) and client_id.strip():
                return client_id.strip()
        except Exception:
            pass

        try:
            payload_json, _ = cmd.get_property_to_json(None)
            payload = json.loads(payload_json) if payload_json else {}
            return self._extract_client_id_from_payload(payload)
        except Exception:
            return None

    def _extract_client_id_from_payload(self, payload: Any) -> Optional[str]:
        """Extract target client_id from payload and nested metadata."""
        if not isinstance(payload, dict):
            return None

        direct = payload.get("client_id")
        if isinstance(direct, str) and direct.strip():
            return direct.strip()

        metadata = payload.get("metadata")
        if isinstance(metadata, dict):
            nested = metadata.get("client_id")
            if isinstance(nested, str) and nested.strip():
                return nested.strip()

        return None

    async def _send_message_to_clients(
        self,
        ten_env: AsyncTenEnv,
        message: dict[str, Any],
        target_client_id: Optional[str],
        log_label: str,
    ) -> None:
        """Send message to one client if targeted, otherwise broadcast."""
        if not self.ws_server:
            return

        if target_client_id:
            sent = await self.ws_server.send_to_client(target_client_id, message)
            if sent:
                ten_env.log_debug(
                    f"Sent {log_label} to target client {target_client_id}"
                )
            else:
                ten_env.log_warn(
                    f"Failed to send {log_label} to target client {target_client_id}"
                )
            return

        await self.ws_server.broadcast(message)
        ten_env.log_debug(f"Broadcasted {log_label} to all WebSocket clients")
