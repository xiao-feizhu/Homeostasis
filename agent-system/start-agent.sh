#!/bin/bash

# Yumi Agent 代理服务器启动脚本

# 检查环境变量
if [ -z "$MOONSHOT_API_KEY" ]; then
    echo "❌ 错误: 请设置 MOONSHOT_API_KEY 环境变量"
    echo ""
    echo "设置方法:"
    echo "  export MOONSHOT_API_KEY='your-api-key-here'"
    echo ""
    exit 1
fi

echo "🚀 启动 Yumi Agent 代理服务器..."
echo "📡 WebSocket: ws://localhost:3001"
echo "🔑 API Key: ${MOONSHOT_API_KEY:0:10}..."
echo ""

# 使用 ts-node 直接运行
npx ts-node --skipProject src/agent/simple/agent-proxy.ts
