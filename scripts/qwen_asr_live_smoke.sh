#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_FIXTURE="$ROOT_DIR/ten-framework/ai_agents/agents/integration_tests/asr_guarder/tests/test_data/16k_zh_cn.pcm"

FIXTURE_PATH="${1:-$DEFAULT_FIXTURE}"
EXPECTED_TEXT="${2:-}"
CONTAINER_NAME="${QWEN_ASR_SMOKE_CONTAINER:-voxflame-ten-agent}"

if [[ -n "${QWEN_ASR_SMOKE_EXEC:-}" ]]; then
  # shellcheck disable=SC2206
  DOCKER_EXEC=(${QWEN_ASR_SMOKE_EXEC})
elif command -v docker >/dev/null 2>&1; then
  DOCKER_EXEC=(docker exec -i)
else
  DOCKER_EXEC=(sudo docker exec -i)
fi

if [[ ! -f "$FIXTURE_PATH" ]]; then
  echo "[qwen-asr-smoke] fixture not found: $FIXTURE_PATH" >&2
  exit 1
fi

echo "[qwen-asr-smoke] fixture=$FIXTURE_PATH"
echo "[qwen-asr-smoke] container=$CONTAINER_NAME"
echo "[qwen-asr-smoke] exec=${DOCKER_EXEC[*]}"

read -r -d '' PYTHON_CODE <<'PY' || true
from __future__ import annotations

import asyncio
import importlib.util
import os
import sys
import time


EXPECTED = (sys.argv[1] or '').strip()
PCM_BYTES = sys.stdin.buffer.read()
SAMPLE_RATE = 16000
CHUNK_MS = 40
BYTES_PER_CHUNK = SAMPLE_RATE * 2 * CHUNK_MS // 1000
CONNECT_TIMEOUT_SECONDS = 15
FINAL_TIMEOUT_SECONDS = 12


def load_module(module_name: str, module_path: str):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'failed to load module: {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def main() -> int:
    if not PCM_BYTES:
        print('[qwen-asr-smoke] empty PCM input', file=sys.stderr)
        return 1

    api_key = os.environ.get('DASHSCOPE_API_KEY', '').strip()
    if not api_key:
        print('[qwen-asr-smoke] DASHSCOPE_API_KEY is missing in container env', file=sys.stderr)
        return 1

    client_module = load_module(
        'qwen_asr_realtime_smoke_client',
        '/app/ten_packages/extension/qwen_asr_realtime_python/realtime_client.py',
    )
    client_cls = client_module.QwenRealtimeASRClient

    events: list[dict] = []
    final_text: str = ''
    final_event = asyncio.Event()

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
        nonlocal final_text
        events.append(payload)
        message_type = str(payload.get('type', '') or '')

        if message_type == 'conversation.item.input_audio_transcription.text':
            text = str(payload.get('text', '') or '').strip()
            if text:
                print(f'[qwen-asr-smoke] interim={text}')

        if message_type == 'conversation.item.input_audio_transcription.completed':
            final_text = str(payload.get('transcript', '') or payload.get('text', '') or '').strip()
            print(f'[qwen-asr-smoke] final={final_text}')
            final_event.set()

        if message_type in {'error', 'client.error'}:
            error_message = str(payload.get('error', {}).get('message', 'unknown error'))
            print(f'[qwen-asr-smoke] vendor_error={error_message}', file=sys.stderr)
            final_event.set()

    client = client_cls(
        url=os.environ.get('QWEN_REALTIME_ASR_URL', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'),
        model=os.environ.get('QWEN_REALTIME_ASR_MODEL', 'qwen3-asr-flash-realtime'),
        api_key=api_key,
        connect_timeout_seconds=CONNECT_TIMEOUT_SECONDS,
        event_handler=handle_event,
        logger=Logger(),
    )

    started_at = time.perf_counter()
    await client.start(
        {
            'modalities': ['text'],
            'input_audio_format': 'pcm',
            'sample_rate': SAMPLE_RATE,
            'input_audio_transcription': {'language': 'zh'},
            'turn_detection': None,
        }
    )

    try:
        for offset in range(0, len(PCM_BYTES), BYTES_PER_CHUNK):
            chunk = PCM_BYTES[offset: offset + BYTES_PER_CHUNK]
            if not chunk:
                continue
            await client.append_audio(chunk)
            await asyncio.sleep(CHUNK_MS / 1000)

        await client.commit_audio()

        try:
            await asyncio.wait_for(final_event.wait(), timeout=FINAL_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            print('[qwen-asr-smoke] timeout waiting for final transcription', file=sys.stderr)
            return 1
    finally:
        await client.finish_session()

    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    print(f'[qwen-asr-smoke] events={len(events)} elapsed_ms={elapsed_ms}')

    if not final_text:
        print('[qwen-asr-smoke] final transcript is empty', file=sys.stderr)
        return 1

    if EXPECTED and EXPECTED not in final_text:
        print(
            f'[qwen-asr-smoke] expected substring not found: expected={EXPECTED} final={final_text}',
            file=sys.stderr,
        )
        return 1

    return 0


raise SystemExit(asyncio.run(main()))
PY

cat "$FIXTURE_PATH" | "${DOCKER_EXEC[@]}" "$CONTAINER_NAME" /bin/bash -lc "
set -euo pipefail
source /app/venv/bin/activate
python -c \"$PYTHON_CODE\" \"$EXPECTED_TEXT\"
"
