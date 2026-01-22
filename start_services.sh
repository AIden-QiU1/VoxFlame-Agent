#!/bin/bash

# VoxFlame Agent 一键启动脚本
# 将所有服务日志输出到 logs 目录

set -e

PROJECT_ROOT="/root/VoxFlame-Agent"
LOGS_DIR="${PROJECT_ROOT}/logs"

# 端口配置
FRONTEND_PORT=3000
BACKEND_PORT=3001
AGENT_PORT=8766

# 创建日志目录
mkdir -p "${LOGS_DIR}"

# 获取当前日期时间作为日志文件后缀
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║       VoxFlame Agent 一键启动脚本              ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "日志目录: ${LOGS_DIR}"
echo "日志文件: *_${TIMESTAMP}.log"
echo ""

# 停止已运行的服务
stop_services() {
    echo "正在停止已有服务..."
    pkill -f "next-server" 2>/dev/null || true
    pkill -f "ts-node.*backend" 2>/dev/null || true
    pkill -f "main.*property.json" 2>/dev/null || true
    sleep 2
    echo "已有服务已停止"
    echo ""
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 1. 启动 TEN Agent
start_agent() {
    echo "┌───────────────────────────────────────────────┐"
    echo "│ [1/3] 启动 TEN Agent (端口 ${AGENT_PORT})              │"
    echo "└───────────────────────────────────────────────┘"
    
    if check_port ${AGENT_PORT}; then
        echo "  ✓ TEN Agent 已在运行 (端口 ${AGENT_PORT})"
    else
        echo "  → 正在启动 TEN Agent..."
        cd "${PROJECT_ROOT}/ten_agent"
        
        # 使用 start.sh 脚本启动 (会激活 venv 并设置环境变量)
        nohup ./scripts/start.sh -property property.json > "${LOGS_DIR}/ten_agent_${TIMESTAMP}.log" 2>&1 &
        
        # 等待启动
        for i in {1..10}; do
            sleep 1
            if check_port ${AGENT_PORT}; then
                echo "  ✓ TEN Agent 启动成功"
                return 0
            fi
            echo "  ... 等待启动 (${i}s)"
        done
        
        echo "  ✗ TEN Agent 启动失败"
        echo "  查看日志: tail -f ${LOGS_DIR}/ten_agent_${TIMESTAMP}.log"
        return 1
    fi
}

# 2. 启动后端服务
start_backend() {
    echo ""
    echo "┌───────────────────────────────────────────────┐"
    echo "│ [2/3] 启动后端服务 (端口 ${BACKEND_PORT})              │"
    echo "└───────────────────────────────────────────────┘"
    
    if check_port ${BACKEND_PORT}; then
        echo "  ✓ 后端服务已在运行 (端口 ${BACKEND_PORT})"
    else
        echo "  → 正在启动后端服务..."
        cd "${PROJECT_ROOT}/backend"
        nohup npm run dev > "${LOGS_DIR}/backend_${TIMESTAMP}.log" 2>&1 &
        
        # 等待启动
        for i in {1..10}; do
            sleep 1
            if check_port ${BACKEND_PORT}; then
                echo "  ✓ 后端服务启动成功"
                return 0
            fi
            echo "  ... 等待启动 (${i}s)"
        done
        
        echo "  ✗ 后端服务启动失败"
        echo "  查看日志: tail -f ${LOGS_DIR}/backend_${TIMESTAMP}.log"
        return 1
    fi
}

# 3. 启动前端服务
start_frontend() {
    echo ""
    echo "┌───────────────────────────────────────────────┐"
    echo "│ [3/3] 启动前端服务 (端口 ${FRONTEND_PORT})              │"
    echo "└───────────────────────────────────────────────┘"
    
    if check_port ${FRONTEND_PORT}; then
        echo "  ✓ 前端服务已在运行 (端口 ${FRONTEND_PORT})"
    else
        echo "  → 正在启动前端服务..."
        cd "${PROJECT_ROOT}/frontend"
        nohup npm run dev > "${LOGS_DIR}/frontend_${TIMESTAMP}.log" 2>&1 &
        
        # 等待启动
        for i in {1..15}; do
            sleep 1
            if check_port ${FRONTEND_PORT}; then
                echo "  ✓ 前端服务启动成功"
                return 0
            fi
            echo "  ... 等待启动 (${i}s)"
        done
        
        echo "  ✗ 前端服务启动失败"
        echo "  查看日志: tail -f ${LOGS_DIR}/frontend_${TIMESTAMP}.log"
        return 1
    fi
}

# 显示服务状态
show_status() {
    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║                 服务状态汇总                   ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""
    
    echo "端口监听状态:"
    ss -tlnp 2>/dev/null | grep -E "${FRONTEND_PORT}|${BACKEND_PORT}|${AGENT_PORT}" || echo "  (无服务运行)"
}

# 显示访问提示
show_tips() {
    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║                   访问指南                     ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""
    echo "本地访问: http://localhost:${FRONTEND_PORT}"
    echo ""
    echo "VSCode Remote SSH 端口转发:"
    echo "  添加端口: ${FRONTEND_PORT}, ${BACKEND_PORT}, ${AGENT_PORT}"
    echo ""
    echo "查看日志:"
    echo "  tail -f ${LOGS_DIR}/ten_agent_*.log"
    echo "  tail -f ${LOGS_DIR}/backend_*.log"
    echo "  tail -f ${LOGS_DIR}/frontend_*.log"
    echo ""
}

# 主流程
main() {
    case "${1:-}" in
        --restart|-r)
            stop_services
            ;;
        --stop|-s)
            stop_services
            echo "所有服务已停止"
            exit 0
            ;;
        --status)
            show_status
            exit 0
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo "  (无参数)    启动所有服务"
            echo "  --restart   重启所有服务"
            echo "  --stop      停止所有服务"
            echo "  --status    显示服务状态"
            exit 0
            ;;
    esac
    
    start_agent
    start_backend
    start_frontend
    show_status
    show_tips
    
    echo "═══════════════════════════════════════════════"
    echo "  VoxFlame Agent 启动完成!"
    echo "═══════════════════════════════════════════════"
}

main "$@"
