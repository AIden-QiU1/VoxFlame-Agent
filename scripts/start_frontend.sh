#!/bin/bash
# 前端服务手动启动 (前台模式)
set -e
PROJECT_ROOT="/root/VoxFlame-Agent"
LOGS_DIR="${PROJECT_ROOT}/logs"
mkdir -p "${LOGS_DIR}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "前端服务启动 (端口 3000)"
echo "日志: ${LOGS_DIR}/frontend_${TIMESTAMP}.log"
cd "${PROJECT_ROOT}/frontend"
npm run dev 2>&1 | tee "${LOGS_DIR}/frontend_${TIMESTAMP}.log"
