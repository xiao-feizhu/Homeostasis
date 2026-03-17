#!/bin/bash
# AI Agent System 源代码和Demo演示打包脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR"

# 版本号
VERSION="1.0.0"
DATE=$(date +%Y%m%d)
ARCHIVE_NAME="ai-agent-system-source-v${VERSION}-${DATE}"

echo "🚀 AI Agent System 源代码打包工具"
echo "====================================="
echo ""

# 创建临时目录
echo "📁 创建临时目录..."
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

PACKAGE_DIR="$TEMP_DIR/$ARCHIVE_NAME"
mkdir -p "$PACKAGE_DIR"

# 复制源代码
echo "📄 复制源代码文件..."
cp -r "$SCRIPT_DIR/src" "$PACKAGE_DIR/"

# 复制配置文件
echo "⚙️  复制配置文件..."
cp "$SCRIPT_DIR/package.json" "$PACKAGE_DIR/"
cp "$SCRIPT_DIR/tsconfig.json" "$PACKAGE_DIR/"
cp "$SCRIPT_DIR/jest.config.js" "$PACKAGE_DIR/"

# 复制文档
echo "📚 复制文档..."
if [ -d "$SCRIPT_DIR/docs/package" ]; then
    cp -r "$SCRIPT_DIR/docs/package" "$PACKAGE_DIR/docs"
fi

# 复制 Demo 说明
cp "$SCRIPT_DIR/DEMO-README.md" "$PACKAGE_DIR/" 2>/dev/null || true

# 创建 README
echo "📝 创建运行说明..."
cat > "$PACKAGE_DIR/README-RUN.md" << 'EOF'
# AI Agent System - 运行指南

## 快速开始

### 1. 环境要求

- Node.js 18+
- npm 9+
- 现代浏览器 (Chrome/Firefox/Safari)

### 2. 安装依赖

```bash
cd ai-agent-system-source-v1.0.0-202*
npm install
```

### 3. 运行测试

```bash
npm test
```

预期输出:
```
Test Suites: 8 passed, 8 total
Tests:       149 passed, 149 total
```

### 4. 启动控制台

```bash
# 方式 1: 简单 HTTP 服务器
npx serve src/console/public -p 8080

# 方式 2: 使用 Python
python3 -m http.server 8080 --directory src/console/public
```

访问: http://localhost:8080

### 5. 运行 Demo

```bash
npm run demo
```

---

## Demo 演示说明

### Demo 入口

**文件**: `src/demo.ts`

**运行方式**:
```bash
# 完整演示
npm run demo

# 特定场景演示
npx ts-node src/demo.ts --scenario=expressions
```

### 演示场景

| 场景 | 命令 | 说明 |
|------|------|------|
| 表情演示 | `expressions` | 循环展示所有表情 |
| 对话演示 | `conversation` | 模拟多轮对话 |
| 语音演示 | `voice` | TTS 语音合成测试 |
| 完整演示 | `full` | 包含以上所有场景 |

### 代码示例

```typescript
import { DemoRunner } from './demo';

const demo = new DemoRunner({
  enableLive2D: true,
  enableAudio: true,
  enableTelegram: false,
});

await demo.initialize();
await demo.runScenario('full');
```

---

## 项目结构

```
src/
├── demo.ts                    # Demo 入口
├── server.ts                  # 服务器入口
├── avatar/                    # Live2D 虚拟形象
│   ├── adapters/airi-live2d/  # Live2D 适配器
│   ├── adapters/airi-lipsync/ # 口型同步适配器
│   └── services/              # 头像服务
├── emotion/                   # 情感系统
│   ├── pipeline/              # 角色管线
│   └── services/              # 情感分析
├── audio/                     # 音频系统
│   ├── input/                 # 麦克风 + VAD
│   ├── output/                # 音频播放
│   └── pipeline/              # 转录管道
├── console/                   # Web 控制台
│   ├── public/index.html      # 控制台页面
│   └── services/console-bridge.ts
├── services/telegram/         # Telegram Bot
└── workflow/                  # 工作流引擎

├── package.json               # 项目配置
├── tsconfig.json             # TypeScript 配置
└── jest.config.js            # 测试配置
```

---

## 功能演示流程

### Phase 1: Live2D 表情

1. 打开 http://localhost:8080
2. 观察角色眨眼、呼吸动画
3. 点击下方表情按钮切换

### Phase 2: 口型同步

```bash
# 运行语音演示
npx ts-node -e "
import { DemoRunner } from './src/demo';
const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
await demo.initialize();
await demo.runScenario('voice');
"
```

### Phase 3: 对话管线

```bash
# 运行对话演示
npx ts-node -e "
import { DemoRunner } from './src/demo';
const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
await demo.initialize();
await demo.runScenario('conversation');
"
```

### Phase 4: 语音输入

1. 在控制台页面点击麦克风按钮
2. 说出: "你好"
3. 观察语音转文字 → AI 回复流程

### Phase 5: Telegram Bot (可选)

```bash
export TELEGRAM_BOT_TOKEN="your_token"
npm run telegram
```

---

## 文档目录

```
docs/
├── README.md              # 项目概述
├── 01-QUICKSTART.md       # 5分钟快速上手
├── 02-ARCHITECTURE.md     # 系统架构
├── 03-CONFIGURATION.md    # 配置指南
├── 04-API.md             # API 文档
├── 05-DEMO.md            # 演示指南
├── 06-DEPLOYMENT.md      # 部署文档
├── CHANGELOG.md          # 更新日志
└── TROUBLESHOOTING.md    # 故障排除
```

---

## 常见问题

### 1. 测试失败

```bash
# 检查 Node.js 版本
node -v  # 需要 >= 18

# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

### 2. Live2D 不显示

- 确保使用现代浏览器
- 检查 WebGL 是否启用
- 查看浏览器控制台错误

### 3. 麦克风不工作

- 检查浏览器权限设置
- 确保使用 HTTPS 或 localhost

### 4. TTS 无声音

- 检查系统音量
- 浏览器需要用户交互后才能播放音频

---

## 开发命令

```bash
# 运行测试
npm test

# 运行特定测试
npm test -- avatar.spec.ts

# 编译 TypeScript
npm run build

# 运行演示
npm run demo

# 运行 Telegram Bot
npm run telegram
```

---

## 许可证

MIT
EOF

# 复制演示脚本
echo "🎬 复制演示脚本..."
if [ -d "$SCRIPT_DIR/scripts" ]; then
    cp -r "$SCRIPT_DIR/scripts" "$PACKAGE_DIR/"
fi

# 创建快速启动脚本
echo "🚀 创建启动脚本..."
cat > "$PACKAGE_DIR/start-demo.sh" << 'EOF'
#!/bin/bash
# 快速启动 Demo

echo "🚀 AI Agent System Demo 启动器"
echo "=============================="
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 运行测试
echo "🧪 运行测试..."
npm test -- --silent

if [ $? -ne 0 ]; then
    echo "❌ 测试失败，请检查问题"
    exit 1
fi

echo "✅ 测试通过"
echo ""

# 启动控制台服务器
echo "🌐 启动控制台服务器..."
npx serve src/console/public -p 8080 &
SERVER_PID=$!

# 等待服务器启动
sleep 2

# 打开浏览器
if command -v open &> /dev/null; then
    open http://localhost:8080
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8080
fi

echo ""
echo "✅ Demo 已启动!"
echo "🌐 控制台地址: http://localhost:8080"
echo ""
echo "📋 可用命令:"
echo "  npm run demo           # 运行完整演示"
echo "  npm test               # 运行测试"
echo ""
echo "按 Ctrl+C 停止服务器"
wait $SERVER_PID
EOF

chmod +x "$PACKAGE_DIR/start-demo.sh"

# 创建归档
echo ""
echo "📦 创建归档..."
cd "$TEMP_DIR"
tar -czf "$OUTPUT_DIR/${ARCHIVE_NAME}.tar.gz" "$ARCHIVE_NAME"

if command -v zip &> /dev/null; then
    zip -rq "$OUTPUT_DIR/${ARCHIVE_NAME}.zip" "$ARCHIVE_NAME"
    ZIP_CREATED=true
else
    ZIP_CREATED=false
fi

cd "$OUTPUT_DIR"

# 显示结果
echo ""
echo "✅ 打包完成!"
echo "====================================="
echo ""
echo "📦 输出文件:"
echo "  📄 ${ARCHIVE_NAME}.tar.gz ($(du -h "${ARCHIVE_NAME}.tar.gz" | cut -f1))"
if [ "$ZIP_CREATED" = true ]; then
    echo "  📄 ${ARCHIVE_NAME}.zip ($(du -h "${ARCHIVE_NAME}.zip" | cut -f1))"
fi
echo ""
echo "📂 输出目录: $OUTPUT_DIR"
echo ""
echo "📋 包含内容:"
echo "  📁 src/              源代码 (TypeScript)"
echo "  📄 package.json      项目配置"
echo "  📄 tsconfig.json     TypeScript 配置"
echo "  📄 jest.config.js    测试配置"
echo "  📁 docs/             文档"
echo "  📁 scripts/          演示脚本"
echo "  📄 README-RUN.md     运行指南"
echo "  📄 DEMO-README.md    Demo 详细说明"
echo "  📄 DEMO-SCRIPT.md    演示脚本"
echo "  📄 start-demo.sh     快速启动脚本"
echo ""
echo "🚀 使用方式:"
echo "  tar -xzf ${ARCHIVE_NAME}.tar.gz"
echo "  cd ${ARCHIVE_NAME}"
echo "  ./start-demo.sh           # 一键启动"
echo "  ./scripts/full-demo.sh    # 交互式演示菜单"
echo "  ./scripts/quick-demo.sh   # 快速完整演示"
echo "  ./scripts/console-demo.sh # 交互式控制台"
echo ""

# 清理
trap - EXIT
