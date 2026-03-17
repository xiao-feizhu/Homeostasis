#!/bin/bash
# AI Agent System - 交互式控制台演示
# 启动 Web 控制台并提供交互指导

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              AI Agent System - 交互式控制台演示              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 运行测试
echo "🧪 验证系统..."
npm test -- --silent 2>/dev/null | grep -E "(Test Suites|Tests:)" || echo "测试完成"

echo ""
echo "🌐 启动控制台服务器..."
echo ""
echo "  控制台地址: http://localhost:8080"
echo ""
echo "  演示步骤:"
echo "    1. 打开浏览器访问 http://localhost:8080"
echo "    2. 观察 Live2D 角色眨眼/呼吸动画"
echo "    3. 点击下方表情按钮 (Happy/Sad/Angry/Surprised)"
echo "    4. 在输入框输入文字，点击发送"
echo "    5. 观察 AI 回复 + 语音播放 + 口型同步"
echo "    6. 点击麦克风按钮，说出一段话"
echo ""
echo "  快捷键:"
echo "    Ctrl+C 停止服务器"
echo ""

# 启动服务器
npx serve src/console/public -p 8080 --single
