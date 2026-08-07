#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-status}"
PRUNE_UNTIL="${VOXFLAME_DOCKER_PRUNE_UNTIL:-168h}"

print_status() {
  echo "[disk] root filesystem"
  df -h /
  echo
  echo "[docker] disk usage"
  sudo docker system df
  echo
  echo "[docker] protected VoxFlame images"
  sudo docker image ls --format '{{.Repository}}:{{.Tag}}\t{{.CreatedSince}}\t{{.Size}}' \
    | awk '$1 ~ /^voxflame-agent-/ && ($1 ~ /:latest$/ || $1 ~ /:pre-/) { print }'
  echo
  echo "[docker] dangling image candidates older than ${PRUNE_UNTIL}"
  sudo docker image ls --filter dangling=true --filter "until=${PRUNE_UNTIL}" \
    --format '{{.ID}}\t{{.CreatedSince}}\t{{.Size}}'
}

case "$MODE" in
  status)
    print_status
    ;;
  prune|prune-safe)
    print_status
    echo
    echo "[docker] pruning dangling images and build cache older than ${PRUNE_UNTIL}"
    echo "[docker] running containers, named volumes, tagged latest images, and pre-* rollback images are preserved"
    sudo docker image prune -f --filter "until=${PRUNE_UNTIL}"
    sudo docker builder prune -f --filter "until=${PRUNE_UNTIL}"
    echo
    print_status
    ;;
  *)
    echo "Usage: $0 [status|prune-safe]" >&2
    exit 1
    ;;
esac
