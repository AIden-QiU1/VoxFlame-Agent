#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-status}"

print_status() {
  echo "[disk] root filesystem"
  df -h /
  echo
  echo "[docker] disk usage"
  sudo docker system df
}

case "$MODE" in
  status)
    print_status
    ;;
  prune)
    print_status
    echo
    echo "[docker] pruning unused images and build cache"
    echo "[docker] running containers and named volumes are preserved"
    sudo docker system prune -af
    echo
    print_status
    ;;
  *)
    echo "Usage: $0 [status|prune]" >&2
    exit 1
    ;;
esac
