# AI Agent System - 完整启动指南

## 📋 前置要求

- **Node.js**: 18.0.0 或更高版本
- **npm**: 9.0.0 或更高版本
- **浏览器**: Chrome 90+ / Firefox 88+ / Safari 14+ (支持 WebGL)
- **操作系统**: macOS / Linux / Windows

## 🚀 启动步骤

### 步骤 1: 进入项目目录

```bash
cd /Users/xxx/claude-workspace/ecomop/agent-system
```

### 步骤 2: 检查环境

```bash
# 检查 Node.js 版本
node -v
# 应该显示 v18.x.x 或更高

# 检查 npm 版本
npm -v
# 应该显示 9.x.x 或更高
```

### 步骤 3: 安装依赖

```bash
npm install
```

**预期输出**:
```
added XXX packages in XXs
```

### 步骤 4: 运行测试 (验证安装)

```bash
npm test
```

**预期输出**:
```
Test Suites: 53 passed, 53 total
Tests:       981 passed, 1 skipped, 982 total
```

### 步骤 5: 启动 Web 服务器

#### 方式 A: 使用 Python (推荐，最简单)

```bash
python3 -m http.server 8080 --directory src/console/public
```

#### 方式 B: 使用 Node.js serve

```bash
npx serve src/console/public -p 8080
```

#### 方式 C: 使用 Node.js http-server

```bash
npx http-server src/console/public -p 8080
```

**成功标志**:
```
Serving HTTP on :: port 8080 (http://[::]:8080/) ...
```

### 步骤 6: 访问控制台

打开浏览器，访问:

```
http://localhost:8080/simple-demo.html
```

## 🖥️ 界面说明

启动成功后，你将看到:

```
┌─────────────────────────────────────────────────────────────────┐
│                    🎭 AI Agent System                            │
├──────────────────────────────────────┬──────────────────────────┤
│                                      │   🎭 表情控制             │
│      ┌──────────────────┐            │   ┌────────┬────────┐    │
│      │   👁️ 眨眼动画     │            │   │😐 中性 │😊 开心 │    │
│      │   〰️ 呼吸效果     │            │   ├────────┼────────┤    │
│      │                  │            │   │😢 悲伤 │😲 惊讶 │    │
│      │   😊 虚拟形象     │            │   ├────────┼────────┤    │
│      │                  │            │   │😠 生气 │🤔 思考 │    │
│      └──────────────────┘            │   └────────┴────────┘    │
│                                      │                          │
│   ● 系统就绪 - 等待输入               │   💬 对话                 │
│                                      │   ┌─────────────────┐    │
└──────────────────────────────────────┤   │ 消息历史...      │    │
                                       │   └─────────────────┘    │
                                       │   [输入消息...] [🎤] [➤] │
                                       │                          │
                                       │   📊 系统状态             │
                                       │   Live2D ✓ 运行中        │
                                       │   Audio  ✓ 就绪          │
                                       └──────────────────────────┘
```

## 🎮 功能测试

### 测试 1: 表情切换
1. 点击右侧表情按钮 (开心/悲伤/惊讶/生气/思考)
2. 观察虚拟形象表情变化
3. 查看状态栏文字更新

### 测试 2: 对话功能
1. 在输入框输入文字
2. 点击发送按钮或按回车
3. 观察消息显示和 AI 自动回复

### 测试 3: 语音按钮
1. 点击麦克风按钮 🎤
2. 按钮变为红色并开始闪烁
3. 3秒后自动模拟语音输入

## 🐛 故障排查

### 问题 1: 端口被占用

**症状**:
```
Address already in use
```

**解决**:
```bash
# 查找占用 8080 端口的进程
lsof -i :8080

# 杀死进程
kill -9 <PID>

# 或使用其他端口
python3 -m http.server 8081 --directory src/console/public
```

### 问题 2: 页面空白

**检查清单**:
1. 浏览器是否支持 WebGL?
   - 访问 https://get.webgl.org/ 测试
2. 查看浏览器控制台 (F12)
   - 是否有红色错误信息?
3. 强制刷新页面
   - Windows: Ctrl+F5
   - Mac: Cmd+Shift+R

### 问题 3: npm install 失败

**解决**:
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 问题 4: 测试失败

**解决**:
```bash
# 查看详细错误
npm test -- --verbose

# 跳过测试直接启动 (不推荐)
python3 -m http.server 8080 --directory src/console/public
```

## 📁 项目结构

```
agent-system/
├── src/
│   ├── console/
│   │   └── public/
│   │       ├── index.html          # 主控制台
│   │       └── simple-demo.html    # 简化版演示 ⭐
│   ├── avatar/                     # Live2D + 口型同步
│   ├── emotion/                    # 情感系统
│   ├── audio/                      # 音频系统
│   └── services/telegram/          # Telegram Bot
├── scripts/
│   ├── full-demo.sh               # 交互式演示
│   ├── quick-demo.sh              # 快速演示
│   └── console-demo.sh            # 控制台演示
├── docs/                           # 文档
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 🎯 快速启动脚本

### 一键启动 (推荐)

```bash
# 给脚本执行权限
chmod +x scripts/*.sh

# 运行交互式菜单
./scripts/full-demo.sh
```

菜单选项:
```
1) 🎭 Live2D 表情演示
2) 🎤 口型同步演示
3) 💬 对话管线演示
4) 🎙️ 语音输入演示
5) 🎬 完整演示
6) 🌐 启动 Web 控制台
7) 📱 Telegram Bot
0) ❌ 退出
```

### 快速演示

```bash
# 一键运行完整演示
./scripts/quick-demo.sh
```

### 仅启动控制台

```bash
./scripts/console-demo.sh
```

## 🔧 高级配置

### 配置 Telegram Bot (可选)

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token_here"
npm run telegram
```

### 配置 LLM API (可选)

```bash
export LLM_API_KEY="your_api_key"
export LLM_PROVIDER="openai"  # 或 anthropic
```

## 📞 获取帮助

如果遇到问题:

1. 查看日志文件 `/tmp/server.log`
2. 检查浏览器控制台错误 (F12)
3. 查看故障排除文档 `docs/TROUBLESHOOTING.md`

## ✅ 启动检查清单

- [ ] Node.js >= 18
- [ ] npm install 完成
- [ ] npm test 通过
- [ ] 服务器启动 (端口 8080)
- [ ] 浏览器能访问 http://localhost:8080
- [ ] 虚拟形象显示正常
- [ ] 表情切换正常
- [ ] 对话功能正常
