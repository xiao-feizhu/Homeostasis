# Sofia Agent 测试指南

> 基于 Live2D + Kimi API 的智能对话 Agent 测试文档

## 快速开始

### 1. 环境准备

```bash
# 设置 API Key
export MOONSHOT_API_KEY="your-api-key-here"
```

> 获取 API Key: https://kimi.com/coding

### 2. 启动服务

**终端 1 - 启动后端代理:**
```bash
cd /Users/xxx/claude-workspace/ecomop/agent-system
npx tsx src/agent/simple/agent-proxy.ts
```

看到以下输出表示成功:
```
🚀 Agent 代理服务器已启动
📡 WebSocket: ws://localhost:3001
🔑 API Key: sk-xxxx...
```

**终端 2 - 启动前端服务器:**
```bash
cd /Users/xxx/claude-workspace/ecomop/agent-system/src/console/public
python3 -m http.server 8080
```

### 3. 访问页面

打开浏览器访问: http://localhost:8080/agent-chat-kimi.html

---

## 功能测试清单

### ✅ 基础功能

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 页面加载 | 刷新页面 | Live2D 模型显示，连接状态"已连接" |
| WebSocket 连接 | 观察右上角状态 | 显示"已连接"（绿色） |
| 对话功能 | 输入消息发送 | Sofia 回复并自动切换表情 |
| 表情控制 | 点击表情按钮 | Live2D 模型切换对应表情 |

### ✅ 镜头控制

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 初始状态 | 刷新页面 | 模型位于中心偏下，150% 缩放 |
| 滚轮缩放 | 滚轮上下滚动 | 模型放大/缩小 |
| 按钮缩放 | 点击 50%/100%/150%/200% | 快速切换到对应比例 |
| 拖拽移动 | 按住左键拖动 | 模型跟随移动 |
| 双击重置 | 双击画布 | 回到 150% 缩放，居中偏下 |

### ✅ 智能表情

| 输入内容 | 预期表情 | 说明 |
|----------|----------|------|
| "你好！" | happy | 开心 |
| "我很难过" | sad | 难过 |
| "太棒了！" | excited | 兴奋 |
| "唱首歌吧" | singing | 拿话筒 |
| "讨厌！" | angry | 生气 |
| "调皮一下" | playful | 调皮 |

---

## 项目结构

```
agent-system/
├── src/
│   ├── agent/simple/
│   │   └── agent-proxy.ts      # WebSocket 代理服务器
│   └── console/public/
│       └── agent-chat-kimi.html # 前端页面
├── start-agent.sh               # 启动脚本
└── AGENT_TEST_README.md         # 本文档
```

---

## 技术栈

- **前端**: HTML5 + PixiJS 6.5.10 + Live2D Cubism 4
- **后端**: Node.js + WebSocket + Anthropic SDK
- **API**: Kimi Coding API (Anthropic Messages 格式)
- **模型**: k2p5

---

## 注意事项

1. **API Key 安全**: 只在后端代理中使用，不暴露到前端
2. **WebSocket 端口**: 默认 3001，可在环境变量 `AGENT_WS_PORT` 修改
3. **静态文件端口**: 默认 8080，可根据需要调整

---

## 故障排查

### 连接状态显示"连接中"
- 检查代理服务器是否启动
- 检查端口 3001 是否被占用

### 模型不显示
- 检查浏览器控制台是否有错误
- 确认 Live2D Cubism Core 已加载

### 对话无响应
- 检查 API Key 是否有效
- 查看代理服务器日志
