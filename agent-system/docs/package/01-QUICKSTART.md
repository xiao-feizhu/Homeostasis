# 快速开始指南

## 5 分钟快速上手

### 环境要求

- Node.js 18+
- npm 9+
- 现代浏览器 (Chrome/Firefox/Safari)
- (可选) Telegram Bot Token

### 安装步骤

#### 1. 克隆项目

```bash
cd /Users/xxx/claude-workspace/ecomop/agent-system
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 验证安装

```bash
npm test
```

预期输出：
```
Test Suites: 8 passed, 8 total
Tests:       149 passed, 149 total
```

### 运行控制台

#### 方式 1: 简单 HTTP 服务器

```bash
npx serve src/console/public -p 8080
```

访问: http://localhost:8080

#### 方式 2: 开发模式

```bash
npm run dev
```

### 基础功能测试

#### 1. Live2D 模型

打开控制台后，你应该看到：
- 角色眨眼动画
- 呼吸动画
- 注视动画

#### 2. 表情切换

点击下方的表情按钮：
- Neutral → Happy → Sad → Surprised

#### 3. 文字对话

在输入框输入：
```
你好！
```

预期：AI 回复 + 表情变化 + 语音播放

#### 4. 语音输入

点击麦克风按钮，说出：
```
今天天气怎么样
```

预期：语音转文字 → AI 回复 → 语音播放

### 配置 Telegram Bot (可选)

#### 1. 获取 Token

1. 在 Telegram 搜索 @BotFather
2. 发送 `/newbot`
3. 按提示创建 Bot
4. 保存 Token

#### 2. 配置环境变量

```bash
export TELEGRAM_BOT_TOKEN="your_token_here"
```

#### 3. 启动 Bot

```bash
npm run telegram
```

#### 4. 测试 Bot

1. 在 Telegram 搜索你的 Bot
2. 发送 `/start`
3. 发送文字消息

### 下一步

- 阅读 [02-ARCHITECTURE.md](./02-ARCHITECTURE.md) 了解系统架构
- 阅读 [05-DEMO.md](./05-DEMO.md) 查看完整演示
- 阅读 [04-API.md](./04-API.md) 了解 API 使用

### 常见问题

#### Q: Live2D 模型未加载
A: 检查浏览器控制台是否有错误，确保 canvas 元素存在

#### Q: 麦克风不工作
A: 检查浏览器权限设置，确保允许麦克风访问

#### Q: TTS 无声音
A: 检查系统音量，浏览器需要用户交互后才能播放音频

### 获取帮助

- 查看 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- 提交 Issue 到项目仓库
