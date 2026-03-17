# AI Agent System - Airi 集成版

## 项目概览

本项目是基于 Airi 开源项目整合的 AI Agent 系统，实现了完整的虚拟形象交互功能。

### 核心功能

- **Live2D 渲染引擎**: PixiJS + pixi-live2d-display
- **口型同步**: wlipsync 音频驱动
- **角色管线**: 分段/情感/延迟/TTS 协调
- **音频系统**: 麦克风 + VAD + TTS
- **多平台**: Telegram Bot 集成
- **控制台**: 统一 Web 界面

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试

```bash
npm test
# 预期: 149 tests passed
```

### 3. 启动控制台

```bash
npx serve src/console/public -p 8080
open http://localhost:8080
```

### 4. 运行演示

```bash
npm run demo
```

## 项目结构

```
src/
├── avatar/           # Live2D 适配器
├── emotion/          # 情感系统 + 角色管线
├── audio/            # 音频输入/输出/管道
├── services/         # Telegram Bot 服务
├── console/          # Web 控制台
└── demo.ts           # 演示入口
```

## 技术栈

- TypeScript
- PixiJS / pixi-live2d-display
- node-telegram-bot-api
- wlipsync
- Jest (测试)

## 文档索引

| 文档 | 说明 |
|------|------|
| [01-QUICKSTART.md](./01-QUICKSTART.md) | 5分钟快速上手 |
| [02-ARCHITECTURE.md](./02-ARCHITECTURE.md) | 系统架构设计 |
| [03-CONFIGURATION.md](./03-CONFIGURATION.md) | 配置指南 |
| [04-API.md](./04-API.md) | API 文档 |
| [05-DEMO.md](./05-DEMO.md) | 演示指南 |
| [06-DEPLOYMENT.md](./06-DEPLOYMENT.md) | 部署文档 |
| [CHANGELOG.md](./CHANGELOG.md) | 更新日志 |

## 许可证

MIT
