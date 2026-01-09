#!/bin/bash
# VoxFlame Agent 服务启动脚本
# 使用方法: ./start_services.sh

set -e

PROJECT_DIR="/root/VoxFlame-Agent"
cd "$PROJECT_DIR"

echo "🔥 VoxFlame Agent 启动脚本"
echo "================================"
echo ""

# 检查 TEN Agent 是否运行
echo "🤖 检查 TEN Agent 状态..."
if ss -tlnp | grep -q ":8765"; then
    echo "   ✅ TEN Agent 正在监听 8765 端口"
else
    echo "   ⚠️ TEN Agent 未运行，正在启动..."
    cd "$PROJECT_DIR/ten_agent"
    nohup ./bin/main -property property.json > ten_agent.log 2>&1 &
    sleep 3
    if ss -tlnp | grep -q ":8765"; then
        echo "   ✅ TEN Agent 已启动"
    else
        echo "   ❌ TEN Agent 启动失败，请检查 ten_agent.log"
    fi
fi

# 检查并启动后端
echo ""
echo "📡 检查后端服务..."
if ss -tlnp | grep -q ":3001"; then
    echo "   ✅ 后端服务已在运行"
else
    echo "   ⚠️ 后端未运行，正在启动..."
    cd "$PROJECT_DIR/backend"
    nohup npm run dev > backend.log 2>&1 &
    sleep 3
    echo "   ✅ 后端服务已启动"
fi

# 检查并启动前端
echo ""
echo "🌐 检查前端服务..."
if ss -tlnp | grep -q ":3000"; then
    echo "   ✅ 前端服务已在运行"
else
    echo "   ⚠️ 前端未运行，正在启动..."
    cd "$PROJECT_DIR/frontend"
    nohup npm run dev > frontend.log 2>&1 &
    sleep 8
    echo "   ✅ 前端服务已启动"
fi

# 最终状态检查
echo ""
echo "================================"
echo "📊 服务状态汇总:"
echo ""
ss -tlnp | grep -E "3000|3001|8765" | while read line; do
    echo "   $line"
done

echo ""
echo "================================"
echo "🎉 启动完成！"
echo ""
echo "请在浏览器打开: http://localhost:3000"
echo ""
