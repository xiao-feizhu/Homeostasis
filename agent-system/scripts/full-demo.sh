#!/bin/bash
# AI Agent System - 完整系统演示脚本
# 自动化运行所有演示流程

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}         ${GREEN}AI Agent System - 完整系统演示${NC}                    ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查函数
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 未安装${NC}"
        return 1
    fi
    echo -e "${GREEN}✅ $1 已安装${NC}"
    return 0
}

# ============================================
# Stage 1: 环境检查
# ============================================
echo -e "${YELLOW}▶ Stage 1: 环境检查${NC}"
echo "────────────────────────────────────────────────────────────"

check_command node || exit 1
check_command npm || exit 1

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 版本需要 >= 18${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js 版本: $(node -v)${NC}"

# 检查项目结构
if [ ! -d "src" ]; then
    echo -e "${RED}❌ 未找到 src 目录${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 项目结构完整${NC}"

# ============================================
# Stage 2: 依赖安装
# ============================================
echo ""
echo -e "${YELLOW}▶ Stage 2: 依赖安装${NC}"
echo "────────────────────────────────────────────────────────────"

if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
else
    echo -e "${GREEN}✅ 依赖已安装${NC}"
fi

# ============================================
# Stage 3: 测试验证
# ============================================
echo ""
echo -e "${YELLOW}▶ Stage 3: 测试验证 (149 tests)${NC}"
echo "────────────────────────────────────────────────────────────"

echo "🧪 运行测试套件..."
npm test -- --silent --passWithNoTests 2>&1 | tee /tmp/test-output.log || true

# 检查测试结果
if grep -q "Tests:.*149 passed" /tmp/test-output.log; then
    echo -e "${GREEN}✅ 全部 149 个测试通过!${NC}"
elif grep -q "Test Suites:.*passed" /tmp/test-output.log; then
    PASSED=$(grep -oP '\d+(?= passed)' /tmp/test-output.log | tail -1)
    echo -e "${GREEN}✅ $PASSED 个测试通过${NC}"
else
    echo -e "${YELLOW}⚠️  测试输出异常，继续演示...${NC}"
fi

# ============================================
# Stage 4: 演示选项
# ============================================
echo ""
echo -e "${YELLOW}▶ Stage 4: 选择演示模式${NC}"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  1) 🎭 Live2D 表情演示 (Phase 1)"
echo "  2) 🎤 口型同步演示 (Phase 2)"
echo "  3) 💬 对话管线演示 (Phase 3)"
echo "  4) 🎙️  语音输入演示 (Phase 4)"
echo "  5) 🎬 完整演示 (所有 Phase)"
echo "  6) 🌐 启动 Web 控制台"
echo "  7) 📱 Telegram Bot (如配置了 Token)"
echo "  0) ❌ 退出"
echo ""

read -p "请选择演示模式 [0-7]: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}🎭 运行 Live2D 表情演示...${NC}"
        npx ts-node -e "
            import { DemoRunner } from './src/demo';
            const demo = new DemoRunner({ enableLive2D: true });
            await demo.initialize();
            await demo.runScenario('expressions');
            demo.destroy();
            process.exit(0);
        "
        ;;
    2)
        echo ""
        echo -e "${BLUE}🎤 运行口型同步演示...${NC}"
        npx ts-node -e "
            import { DemoRunner } from './src/demo';
            const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
            await demo.initialize();
            await demo.runScenario('voice');
            demo.destroy();
            process.exit(0);
        "
        ;;
    3)
        echo ""
        echo -e "${BLUE}💬 运行对话管线演示...${NC}"
        npx ts-node -e "
            import { DemoRunner } from './src/demo';
            const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
            await demo.initialize();
            await demo.runScenario('conversation');
            demo.destroy();
            process.exit(0);
        "
        ;;
    4)
        echo ""
        echo -e "${BLUE}🎙️  启动语音输入演示...${NC}"
        echo -e "${YELLOW}⚠️  请在浏览器中打开 http://localhost:8080 并点击麦克风按钮${NC}"
        echo ""
        npx serve src/console/public -p 8080
        ;;
    5)
        echo ""
        echo -e "${BLUE}🎬 运行完整演示...${NC}"
        npx ts-node -e "
            import { DemoRunner } from './src/demo';
            const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
            await demo.initialize();
            await demo.runScenario('full');
            demo.destroy();
            process.exit(0);
        "
        ;;
    6)
        echo ""
        echo -e "${BLUE}🌐 启动 Web 控制台...${NC}"
        echo -e "${GREEN}请打开: http://localhost:8080${NC}"
        echo ""
        echo "可用操作:"
        echo "  - 观察 Live2D 眨眼/呼吸动画"
        echo "  - 点击表情按钮切换表情"
        echo "  - 输入文字与 AI 对话"
        echo "  - 点击麦克风进行语音输入"
        echo ""
        npx serve src/console/public -p 8080
        ;;
    7)
        if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
            echo -e "${RED}❌ 未设置 TELEGRAM_BOT_TOKEN 环境变量${NC}"
            echo "请先设置: export TELEGRAM_BOT_TOKEN='your_token'"
            exit 1
        fi
        echo ""
        echo -e "${BLUE}📱 启动 Telegram Bot...${NC}"
        npm run telegram
        ;;
    0)
        echo -e "${GREEN}👋 再见!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ 无效选项${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ 演示完成!${NC}"
echo ""
