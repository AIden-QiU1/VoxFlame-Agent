#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/voxflame/android-release"
LOG_PATH="$STATE_DIR/release.log"
PID_PATH="$STATE_DIR/release.pid"
MODE="${1:-build}"

if [[ "$MODE" != "build" && "$MODE" != "publish-latest" ]]; then
  echo "Usage: $0 [build|publish-latest]" >&2
  exit 1
fi

mkdir -p "$STATE_DIR"

if [[ -f "$PID_PATH" ]]; then
  existing_pid="$(sed -n '1p' "$PID_PATH")"
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "Android release is already running (PID $existing_pid)."
    echo "Log: $LOG_PATH"
    exit 0
  fi
fi

nohup bash "$ROOT_DIR/scripts/release-android-preview.sh" "$MODE" \
  >>"$LOG_PATH" 2>&1 </dev/null &
release_pid=$!
printf '%s\n' "$release_pid" > "$PID_PATH"

echo "Android release started in the background (PID $release_pid)."
echo "Log: $LOG_PATH"
