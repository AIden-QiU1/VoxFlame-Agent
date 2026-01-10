#!/bin/bash
# 后端服务手动启动 (前台模式)
set -e
PROJECT_ROOT="/root/VoxFlame-Agent"
LOGS_DIR="${PROJECT_ROOT}/logs"
mkdir -p "${LOGS_DIR}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "后端服务启动 (端口 3001)"
echo "日志: ${LOGS_DIR}/backend_${TIMESTAMP}.log"
cd "${PROJECT_ROOT}/backend"
npm run dev 2>&1 | tee "${LOGS_DIR}/backend_${TIMESTAMP}.log"
