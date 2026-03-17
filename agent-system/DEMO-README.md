# AI Agent System - Demo演示说明

## 📦 项目概述

AI Agent System 是一个基于 Airi 开源项目整合的虚拟形象交互系统，实现了完整的 Live2D 渲染、口型同步、情感分析、语音交互和多平台服务。

**核心技术栈**:
- TypeScript
- PixiJS + pixi-live2d-display
- wlipsync (口型同步)
- Web Audio API
- node-telegram-bot-api

---

## 🚀 快速启动

### 环境要求

- Node.js 18+
- npm 9+
- 现代浏览器 (Chrome/Firefox/Safari)

### 1. 安装依赖

```bash
npm install
```

### 2. 验证安装

```bash
npm test
# 预期: 149 tests passed
```

### 3. 启动控制台

```bash
npx serve src/console/public -p 8080
```

访问: http://localhost:8080

### 4. 运行 Demo

```bash
npm run demo
```

---

## 🎬 Demo 演示指南

### Demo 入口

**主文件**: `src/demo.ts`

**类**: `DemoRunner`

### 演示场景

#### 场景 1: 表情演示 (Expressions)

**命令**:
```bash
npx ts-node -e "
import { DemoRunner } from './src/demo';
const demo = new DemoRunner({ enableLive2D: true });
await demo.initialize();
await demo.runScenario('expressions');
"
```

**效果**:
- 角色依次展示: Neutral → Happy → Sad → Angry → Surprised → Neutral
- 每个表情持续 2 秒
- 眨眼和呼吸动画持续播放

**代码实现**:
```typescript
const expressions = [
  ExpressionType.NEUTRAL,
  ExpressionType.HAPPY,
  ExpressionType.SAD,
  ExpressionType.ANGRY,
  ExpressionType.SURPRISED,
  ExpressionType.NEUTRAL,
];

for (const expression of expressions) {
  await this.console.setExpression(expression);
  await this.sleep(2000);
}
```

---

#### 场景 2: 对话演示 (Conversation)

**命令**:
```bash
npx ts-node -e "
import { DemoRunner } from './src/demo';
const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
await demo.initialize();
await demo.runScenario('conversation');
"
```

**对话流程**:
```
用户: "你好！"
AI: [友好问候] + Happy表情 + 语音

用户: "今天工作好累啊"
AI: [表示关心] + Sad表情 + 温和语调

用户: "谢谢你安慰我"
AI: [温暖回复] + Grateful表情

用户: "再见！"
AI: [告别] + Neutral表情
```

**技术展示**:
- CharacterPipeline 完整流程
- 情感分析 (6维指标)
- 延迟控制
- TTS 合成
- 口型同步
- Live2D 表情联动

---

#### 场景 3: 语音演示 (Voice)

**命令**:
```bash
npx ts-node -e "
import { DemoRunner } from './src/demo';
const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
await demo.initialize();
await demo.runScenario('voice');
"
```

**演示内容**:
```
语音1: "你好，这是语音合成测试"
      → 观察口型: a(张大), i(扁嘴), o(圆嘴)

语音2: "我能根据文字生成语音"
      → 观察口型变化与语音同步

语音3: "并且口型会与语音同步"
      → 观察元音映射准确性
```

**口型映射表**:
| 元音 | 张嘴程度 | 嘴宽 | 示例字 |
|------|---------|------|--------|
| a | 0.8 | 0.9 | 啊、他 |
| i | 0.3 | 0.4 | 衣、七 |
| u | 0.2 | 0.3 | 乌、书 |
| e | 0.5 | 0.8 | 鹅、得 |
| o | 0.6 | 0.6 | 哦、多 |

---

#### 场景 4: 完整演示 (Full)

**命令**:
```bash
npm run demo
```

**流程**:
1. 表情演示 (30秒)
2. 对话演示 (20秒)
3. 语音演示 (15秒)

**总时长**: 约 1 分钟

---

## 🎮 交互式演示

### 控制台操作

#### 1. 基础功能

| 操作 | 步骤 | 预期结果 |
|------|------|----------|
| 查看动画 | 打开页面 | 眨眼、呼吸动画 |
| 切换表情 | 点击表情按钮 | 表情变化 |
| 文字对话 | 输入文字发送 | AI回复+语音 |
| 语音输入 | 点击麦克风说话 | 语音转文字→AI回复 |

#### 2. 浏览器控制台调试

```javascript
// 访问 bridge 对象
window.bridge = bridge;

// 查看状态
bridge.getState();

// 切换表情
bridge.setExpression('happy');

// 发送消息
bridge.sendMessage('你好');

// TTS 播放
bridge.speak('测试语音');
```

---

## 📊 系统架构展示

### Phase 1: Live2D 渲染

```
用户界面
    ↓
AiriLive2DAdapter
    ↓
PixiJS + pixi-live2d-display
    ↓
Live2D 模型渲染
```

**关键文件**:
- `src/avatar/adapters/airi-live2d/airi-live2d.adapter.ts`
- `src/avatar/adapters/airi-live2d/motion-manager.ts`
- `src/avatar/adapters/airi-live2d/emotion-mapper.ts`

### Phase 2: 口型同步

```
音频输入
    ↓
WlipsyncAdapter
    ↓
音素分析 → 元音映射
    ↓
Live2D 口型参数更新
```

**关键文件**:
- `src/avatar/adapters/airi-lipsync/wlipsync-adapter.ts`
- `src/avatar/adapters/airi-lipsync/hybrid-lipsync.ts`

### Phase 3: 角色管线

```
输入文本
    ↓
SegmentationEngine (分段)
    ↓
EmotionAnalyzer (情感分析)
    ↓
DelayController (延迟控制)
    ↓
TTSConnector (语音合成)
    ↓
CharacterPipeline 事件输出
```

**关键文件**:
- `src/emotion/pipeline/character-pipeline.ts`
- `src/emotion/pipeline/segmentation.ts`
- `src/emotion/services/emotion.analyzer.ts`

### Phase 4: 音频系统

```
麦克风 → VADEngine → TranscriptionPipeline
                                    ↓
TTS合成 ← AudioPlayer ← CharacterPipeline
```

**关键文件**:
- `src/audio/input/microphone-capture.ts`
- `src/audio/input/vad-engine.ts`
- `src/audio/output/audio-player.ts`

### Phase 5: Telegram Bot

```
Telegram User
    ↓
TelegramBot
    ↓
TelegramAgentBridge
    ↓
CharacterPipeline (与Console共享)
```

**关键文件**:
- `src/services/telegram/bot.ts`
- `src/services/telegram/agent/agent-bridge.ts`

---

## 🔧 高级配置

### 自定义 Demo

```typescript
import { DemoRunner } from './demo';

const demo = new DemoRunner({
  enableLive2D: true,      // 启用 Live2D
  enableAudio: true,       // 启用音频
  enableTelegram: true,    // 启用 Telegram
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
});

await demo.initialize();

// 自定义场景
await demo.runScenario('expressions');
await demo.runScenario('conversation');
```

### 环境变量

```bash
# Telegram Bot
export TELEGRAM_BOT_TOKEN="your_token"

# LLM
export LLM_API_KEY="your_key"
export LLM_PROVIDER="openai"

# TTS
export TTS_PROVIDER="system"
```

---

## 🐛 故障排除

### 测试失败

```bash
# 详细错误
npm test -- --verbose

# 单个测试文件
npm test -- console-bridge.spec.ts
```

### Live2D 不显示

1. 检查浏览器控制台错误
2. 确认 WebGL 支持: http://get.webgl.org/
3. 检查模型文件路径

### 麦克风不工作

```javascript
// 检查权限
navigator.permissions.query({ name: 'microphone' })
  .then(r => console.log(r.state));
```

### TTS 无声音

```javascript
// 检查音频上下文
const ctx = new AudioContext();
console.log(ctx.state); // suspended 需要用户交互
await ctx.resume();
```

---

## 📈 性能监控

### 浏览器控制台

```javascript
// 实时状态
const state = bridge.getState();
console.table(state);

// 消息历史
console.table(state.messages);

// 当前情感
console.log(state.currentEmotion);
```

### 性能指标

| 指标 | 目标值 |
|------|--------|
| Live2D FPS | 60 |
| 音频延迟 | < 100ms |
| Pipeline 处理 | < 500ms |
| TTS 生成 | < 1s |

---

## 📚 相关文档

- `docs/01-QUICKSTART.md` - 快速开始
- `docs/02-ARCHITECTURE.md` - 架构设计
- `docs/03-CONFIGURATION.md` - 配置指南
- `docs/04-API.md` - API 文档
- `docs/05-DEMO.md` - 演示指南
- `docs/06-DEPLOYMENT.md` - 部署文档
- `docs/TROUBLESHOOTING.md` - 故障排除

---

## 🎯 Demo 检查清单

### 演示前

- [ ] 所有 149 个测试通过
- [ ] `npm install` 完成
- [ ] 浏览器支持 WebGL
- [ ] 麦克风权限已授权 (如需语音)

### 演示中

- [ ] Live2D 动画流畅
- [ ] 表情切换正常
- [ ] 文字对话正常
- [ ] TTS 播放正常
- [ ] 口型同步准确

### 演示后

- [ ] 无错误日志
- [ ] 资源已释放
