#!/usr/bin/env python3
"""
VoxFlame Agent WebSocket Test Script
Tests the complete data flow: WebSocket -> ASR -> Corrector -> TTS
"""

import asyncio
import json
import struct
import math
import websockets

WS_URL = "ws://localhost:8766"

def generate_sine_wave(frequency=440, duration=0.5, sample_rate=16000):
    """Generate a simple sine wave audio for testing."""
    num_samples = int(sample_rate * duration)
    samples = []
    for i in range(num_samples):
        sample = int(32767 * 0.5 * math.sin(2 * math.pi * frequency * i / sample_rate))
        samples.append(struct.pack('<h', sample))
    return b''.join(samples)

async def test_websocket_connection():
    """Test basic WebSocket connection."""
    print(f"\n{'='*60}")
    print("VoxFlame Agent WebSocket Test")
    print(f"{'='*60}")
    print(f"\nConnecting to {WS_URL}...")

    try:
        async with websockets.connect(WS_URL, ping_interval=20) as ws:
            print("✅ Connected successfully!")

            # Wait for any initial messages
            print("\nWaiting for messages (5 seconds)...")

            async def receive_messages():
                try:
                    while True:
                        msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                        if isinstance(msg, bytes):
                            print(f"  📦 Received binary data: {len(msg)} bytes")
                        else:
                            try:
                                data = json.loads(msg)
                                print(f"  📨 Received JSON: {json.dumps(data, ensure_ascii=False, indent=2)}")
                            except:
                                print(f"  📨 Received text: {msg[:100]}...")
                except asyncio.TimeoutError:
                    pass
                except websockets.exceptions.ConnectionClosed:
                    print("  Connection closed")

            # Receive messages for 5 seconds
            for _ in range(5):
                await receive_messages()

            # Send test audio
            print("\nSending test audio...")
            test_audio = generate_sine_wave(frequency=440, duration=0.5)
            await ws.send(test_audio)
            print(f"  📤 Sent {len(test_audio)} bytes of audio")

            # Wait for response
            print("\nWaiting for ASR response (10 seconds)...")
            for _ in range(10):
                await receive_messages()

            print("\n✅ Test completed!")

    except websockets.exceptions.ConnectionRefused:
        print("❌ Connection refused. Is the ten-agent running?")
    except Exception as e:
        print(f"❌ Error: {e}")

async def test_with_real_speech_simulation():
    """Simulate real speech by sending multiple audio chunks."""
    print(f"\n{'='*60}")
    print("Simulating Real Speech")
    print(f"{'='*60}")

    try:
        async with websockets.connect(WS_URL, ping_interval=20) as ws:
            print("✅ Connected!")

            # Send multiple audio chunks to simulate speech
            print("\nSending simulated speech (3 seconds)...")
            for i in range(30):  # 30 chunks of 100ms each = 3 seconds
                chunk = generate_sine_wave(frequency=300 + i*10, duration=0.1)
                await ws.send(chunk)
                await asyncio.sleep(0.1)

                # Check for any responses
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.05)
                    if isinstance(msg, bytes):
                        print(f"  📦 Audio response: {len(msg)} bytes")
                    else:
                        try:
                            data = json.loads(msg)
                            if data.get('type') == 'transcript':
                                print(f"  📝 Transcript: {data.get('text', '')} (final={data.get('is_final', False)})")
                            else:
                                print(f"  📨 Message: {data.get('type', 'unknown')}")
                        except:
                            pass
                except asyncio.TimeoutError:
                    pass

            print("\nWaiting for final responses (5 seconds)...")
            for _ in range(50):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.1)
                    if isinstance(msg, bytes):
                        print(f"  📦 Audio: {len(msg)} bytes")
                    else:
                        try:
                            data = json.loads(msg)
                            print(f"  📨 {data.get('type', 'message')}: {json.dumps(data, ensure_ascii=False)[:100]}")
                        except:
                            pass
                except asyncio.TimeoutError:
                    pass

            print("\n✅ Simulation completed!")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("VoxFlame Agent Test Suite")
    print("=" * 60)

    # Run tests
    asyncio.run(test_websocket_connection())
    asyncio.run(test_with_real_speech_simulation())
