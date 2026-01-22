#!/bin/bash
# 停止所有服务
echo "停止所有 VoxFlame 服务..."
pkill -f "next-server" 2>/dev/null && echo "✓ 前端已停止" || echo "- 前端未运行"
pkill -f "ts-node" 2>/dev/null && echo "✓ 后端已停止" || echo "- 后端未运行"
pkill -f "bin/main" 2>/dev/null && echo "✓ Agent已停止" || echo "- Agent未运行"
sleep 1
echo ""
echo "端口状态:"
ss -tlnp 2>/dev/null | grep -E "3000|3001|8766" || echo "(无相关服务)"
