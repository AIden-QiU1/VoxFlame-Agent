#!/bin/bash
# TEN Agent 手动启动 (前台模式)
set -e
PROJECT_ROOT="/root/VoxFlame-Agent"
LOGS_DIR="${PROJECT_ROOT}/logs"
mkdir -p "${LOGS_DIR}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "TEN Agent 启动 (端口 8766)"
echo "日志: ${LOGS_DIR}/ten_agent_${TIMESTAMP}.log"
cd "${PROJECT_ROOT}/ten_agent"
exec ./scripts/start.sh -property property.json 2>&1 | tee "${LOGS_DIR}/ten_agent_${TIMESTAMP}.log"
