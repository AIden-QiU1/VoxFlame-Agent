#!/bin/bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"

PIDS=()

# 兼容现有 .env 键名，统一喂给 TEN 官方 control server / property placeholders。
if [[ -z "${AGORA_APP_CERTIFICATE:-}" && -n "${AGORA_CERTIFICATE:-}" ]]; then
  export AGORA_APP_CERTIFICATE="${AGORA_CERTIFICATE}"
fi

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

if [[ "${TEN_AGENT_ENABLE_API_SERVER:-0}" == "1" ]]; then
  AGORA_APP_ID_VALUE="${AGORA_APP_ID:-}"
  if [[ "${#AGORA_APP_ID_VALUE}" -eq 32 ]]; then
    echo "[entrypoint] starting TEN agent control server on port ${SERVER_PORT:-8080}"
    /app/bin/api -tenapp_dir=/app &
    PIDS+=("$!")
  else
    echo "[entrypoint] skipping TEN agent control server because AGORA_APP_ID is missing or invalid"
  fi
else
  echo "[entrypoint] TEN agent control server disabled"
fi

if [[ "${#PIDS[@]}" -eq 0 ]]; then
  echo "[entrypoint] no processes started"
  exit 1
fi

wait -n "${PIDS[@]}"
