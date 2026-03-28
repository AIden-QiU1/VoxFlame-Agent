#!/usr/bin/env bash
set -euo pipefail

TEXT_INPUT="${1:-请给我一点时间，我正在努力说清楚。}"
CONTAINER_NAME="${QWEN_TTS_SMOKE_CONTAINER:-voxflame-ten-agent}"

if [[ -n "${QWEN_TTS_SMOKE_EXEC:-}" ]]; then
  # shellcheck disable=SC2206
  DOCKER_EXEC=(${QWEN_TTS_SMOKE_EXEC})
elif command -v docker >/dev/null 2>&1; then
  DOCKER_EXEC=(docker exec -i)
else
  DOCKER_EXEC=(sudo docker exec -i)
fi

echo "[qwen-tts-smoke] text=$TEXT_INPUT"
echo "[qwen-tts-smoke] container=$CONTAINER_NAME"
echo "[qwen-tts-smoke] exec=${DOCKER_EXEC[*]}"

read -r -d '' PYTHON_CODE <<'PY' || true
from __future__ import annotations

import asyncio
import importlib.util
import os
import sys
import time


TEXT_INPUT = (sys.argv[1] or '').strip()
CONNECT_TIMEOUT_SECONDS = 15
FINAL_TIMEOUT_SECONDS = 15


def load_module(module_name: str, module_path: str):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'failed to load module: {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def main() -> int:
    if not TEXT_INPUT:
        print('[qwen-tts-smoke] empty text input', file=sys.stderr)
        return 1

    api_key = os.environ.get('DASHSCOPE_API_KEY', '').strip()
    if not api_key:
        print('[qwen-tts-smoke] DASHSCOPE_API_KEY is missing in container env', file=sys.stderr)
        return 1

    client_module = load_module(
        'qwen_tts_realtime_smoke_client',
        '/app/ten_packages/extension/qwen_tts_realtime_python/realtime_client.py',
    )
    client_cls = client_module.QwenRealtimeTTSClient

    total_audio_bytes = 0
    audio_chunks = 0
    first_audio_ms = -1
    response_done = asyncio.Event()
    error_message = ''
    started_at = time.perf_counter()

    class Logger:
        def log_info(self, message: str, *args, **kwargs) -> None:
            del args, kwargs
            print(message)

        def log_debug(self, message: str, *args, **kwargs) -> None:
            del message, args, kwargs

        def log_warn(self, message: str, *args, **kwargs) -> None:
            del args, kwargs
            print(message)

        def log_error(self, message: str, *args, **kwargs) -> None:
            del args, kwargs
            print(message, file=sys.stderr)

    async def handle_event(payload: dict) -> None:
        nonlocal total_audio_bytes, audio_chunks, first_audio_ms, error_message

        message_type = str(payload.get('type', '') or '')
        if message_type == 'response.audio.delta':
            delta = str(payload.get('delta', '') or '')
            if delta:
                import base64

                audio_bytes = base64.b64decode(delta)
                total_audio_bytes += len(audio_bytes)
                audio_chunks += 1
                if first_audio_ms < 0:
                    first_audio_ms = int((time.perf_counter() - started_at) * 1000)

        if message_type == 'response.done':
            response_done.set()

        if message_type in {'error', 'client.error'}:
            error_message = str(payload.get('error', {}).get('message', 'unknown error'))
            print(f'[qwen-tts-smoke] vendor_error={error_message}', file=sys.stderr)
            response_done.set()

    client = client_cls(
        url=os.environ.get('QWEN_TTS_REALTIME_URL', os.environ.get('QWEN_REALTIME_TTS_URL', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime')),
        model=os.environ.get('QWEN_TTS_REALTIME_MODEL', os.environ.get('QWEN_REALTIME_TTS_MODEL', 'qwen3-tts-flash-realtime')),
        api_key=api_key,
        connect_timeout_seconds=CONNECT_TIMEOUT_SECONDS,
        event_handler=handle_event,
        logger=Logger(),
    )

    await client.start(
        {
            'modalities': ['audio'],
            'voice': os.environ.get('QWEN_TTS_REALTIME_VOICE', os.environ.get('QWEN_REALTIME_TTS_VOICE', 'Cherry')),
            'mode': 'server_commit',
            'output_audio_format': 'pcm',
            'sample_rate': 16000,
        }
    )

    try:
        await client.append_text(TEXT_INPUT)
        await client.commit_text()

        try:
            await asyncio.wait_for(response_done.wait(), timeout=FINAL_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            print('[qwen-tts-smoke] timeout waiting for response.done', file=sys.stderr)
            return 1
    finally:
        await client.finish_session()

    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    print(
        f'[qwen-tts-smoke] chunks={audio_chunks} '
        f'bytes={total_audio_bytes} '
        f'first_audio_ms={first_audio_ms} '
        f'elapsed_ms={elapsed_ms}'
    )

    if error_message:
        return 1
    if total_audio_bytes <= 0 or audio_chunks <= 0:
        print('[qwen-tts-smoke] no audio delta received', file=sys.stderr)
        return 1
    return 0


raise SystemExit(asyncio.run(main()))
PY

"${DOCKER_EXEC[@]}" "$CONTAINER_NAME" /bin/bash -lc "
set -euo pipefail
source /app/venv/bin/activate
python -c \"$PYTHON_CODE\" \"$TEXT_INPUT\"
"
