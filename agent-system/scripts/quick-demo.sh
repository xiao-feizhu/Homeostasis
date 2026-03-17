#!/bin/bash
# AI Agent System - 快速演示脚本
# 一键运行完整演示流程

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "🚀 AI Agent System - 快速演示"
echo "=============================="
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 运行测试
echo "🧪 运行测试..."
npm test -- --silent 2>&1 | tail -5

# 启动演示
echo ""
echo "🎬 启动完整演示..."
npx ts-node -e "
    import { DemoRunner } from './src/demo';

    console.log('🚀 初始化 Demo...');
    const demo = new DemoRunner({
        enableLive2D: true,
        enableAudio: true
    });

    await demo.initialize();
    console.log('✅ Demo 就绪!');
    console.log('');

    await demo.runScenario('full');

    demo.destroy();
    console.log('');
    console.log('🎉 演示完成!');
    process.exit(0);
"

echo ""
echo "✅ 所有演示完成!"
