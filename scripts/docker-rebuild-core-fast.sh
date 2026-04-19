#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -n "${VOXFLAME_DOCKER_PREFIX:-}" ]]; then
  # shellcheck disable=SC2206
  DOCKER_PREFIX=( ${VOXFLAME_DOCKER_PREFIX} )
else
  DOCKER_PREFIX=( sudo )
fi

docker_cmd() {
  "${DOCKER_PREFIX[@]}" docker "$@"
}

compose_cmd() {
  docker_cmd compose "$@"
}

compose_cmd_with_env() {
  local -a env_args=()
  while [[ $# -gt 0 && "$1" == *=* ]]; do
    env_args+=( "$1" )
    shift
  done

  if [[ ${#DOCKER_PREFIX[@]} -gt 0 && "${DOCKER_PREFIX[0]}" == "sudo" ]]; then
    "${DOCKER_PREFIX[@]}" env "${env_args[@]}" docker compose "$@"
  else
    env "${env_args[@]}" docker compose "$@"
  fi
}

LIVEKIT_AGENT_IMAGE="${LIVEKIT_AGENT_IMAGE:-voxflame-agent-livekit-agent:latest}"
LIVEKIT_AGENT_BASE_IMAGE="${LIVEKIT_AGENT_BASE_IMAGE:-docker.m.daocloud.io/library/python:3.10-slim}"
FAST_BOOTSTRAP_DEPS=1
FAST_BASE_IMAGE="$LIVEKIT_AGENT_BASE_IMAGE"
FAST_DOCKERFILE="${LIVEKIT_AGENT_DOCKERFILE:-Dockerfile}"

if [[ -x "$ROOT_DIR/livekit_agent/.venv/bin/python" ]] && \
   "$ROOT_DIR/livekit_agent/.venv/bin/python" -c "import livekit; import livekit.agents; import websockets; import dotenv" >/dev/null 2>&1; then
  FAST_DOCKERFILE="Dockerfile.localvenv"
  FAST_BOOTSTRAP_DEPS=0
  echo "[voxflame] Reusing local livekit_agent/.venv as dependency layer via $FAST_DOCKERFILE"
elif docker_cmd image inspect "$LIVEKIT_AGENT_IMAGE" >/dev/null 2>&1; then
  FAST_BOOTSTRAP_DEPS=0
  FAST_BASE_IMAGE="$LIVEKIT_AGENT_IMAGE"
  echo "[voxflame] Reusing local livekit-agent image as dependency base: $FAST_BASE_IMAGE"
else
  echo "[voxflame] No local livekit-agent image or reusable .venv found; falling back to full dependency bootstrap."
fi

echo "[voxflame] Building frontend/backend..."
compose_cmd build frontend backend

echo "[voxflame] Building livekit-agent with dockerfile=$FAST_DOCKERFILE LIVEKIT_AGENT_BOOTSTRAP_DEPS=$FAST_BOOTSTRAP_DEPS"
compose_cmd_with_env \
  "LIVEKIT_AGENT_DOCKERFILE=$FAST_DOCKERFILE" \
  "LIVEKIT_AGENT_BOOTSTRAP_DEPS=$FAST_BOOTSTRAP_DEPS" \
  "LIVEKIT_AGENT_BASE_IMAGE=$FAST_BASE_IMAGE" \
  build livekit-agent

echo "[voxflame] Recreating core services..."
compose_cmd up -d --force-recreate livekit-server backend frontend livekit-agent

echo "[voxflame] Done."
