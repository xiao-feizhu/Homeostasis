# 演示指南

## 概述

本文档提供完整的系统演示方案，包括各个 Phase 的独立演示和完整流程演示。

## 快速演示 (5 分钟)

### 启动

```bash
cd /Users/xxx/claude-workspace/ecomop/agent-system

# 运行测试
npm test -- --silent

# 启动控制台
npx serve src/console/public -p 8080
open http://localhost:8080
```

### 基础验证

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 页面加载 | 看到 Live2D 角色，眨眼、呼吸动画 |
| 2 | 点击 Happy | 角色微笑表情 |
| 3 | 输入 "你好" | AI 回复 + 表情变化 |
| 4 | 点击麦克风 | 录音指示灯闪烁 |

## 详细演示脚本

### 演示 1: Live2D 表情系统 (3 分钟)

**目的**: 展示 Phase 1 (Live2D) + Phase 3 (表情管线)

**代码演示**:

```typescript
const bridge = new ConsoleBridge({
  canvasId: 'live2d-canvas'
});

await bridge.initialize();

// 表情循环演示
const expressions = [
  ExpressionType.NEUTRAL,
  ExpressionType.HAPPY,
  ExpressionType.SAD,
  ExpressionType.ANGRY,
  ExpressionType.SURPRISED,
];

for (const expression of expressions) {
  await bridge.setExpression(expression);
  console.log(`表情: ${expression}`);
  await sleep(2000);
}
```

**观察点**:
- 表情切换平滑度
- 眨眼/呼吸动画持续播放
- 右侧情感状态指示器更新

---

### 演示 2: 口型同步 (3 分钟)

**目的**: 展示 Phase 2 (wlipsync) + Phase 4 (音频输出)

**代码演示**:

```typescript
// TTS + 口型同步
await bridge.speak('你好，这是语音合成测试');

// 观察: 角色嘴巴根据元音 (a, i, u, e, o) 变化
```

**口型映射表**:

| 音素 | 张嘴 | 嘴宽 | 示例字 |
|------|------|------|--------|
| a | 0.8 | 0.9 | 啊、他、卡 |
| i | 0.3 | 0.4 | 衣、七、西 |
| u | 0.2 | 0.3 | 乌、书、古 |
| e | 0.5 | 0.8 | 鹅、得、和 |
| o | 0.6 | 0.6 | 哦、多、罗 |

---

### 演示 3: 完整对话管线 (5 分钟)

**目的**: 展示 Phase 3 (CharacterPipeline) 完整流程

**对话示例**:

```typescript
const conversation = [
  { text: '你好！', expectedEmotion: 'happy' },
  { text: '今天工作好累啊', expectedEmotion: 'sad' },
  { text: '谢谢你安慰我', expectedEmotion: 'grateful' },
];

for (const turn of conversation) {
  console.log(`用户: ${turn.text}`);
  await bridge.sendMessage(turn.text);
  await sleep(4000);
}
```

**处理流程展示**:

```
输入: "今天工作好累啊"
   ↓
[Segmentation] 分段: ["今天工作好累啊"]
   ↓
[Emotion Analysis]
   - satisfaction: 30
   - trust: 50
   - frustration: 70  ← 高挫败感
   - urgency: 0
   - engagement: 60
   - confusion: 0
   ↓
[Delay Controller] 计算延迟: 1200ms
   ↓
[LLM] 生成回复: "听起来你今天过得很辛苦。需要休息一下吗？"
   ↓
[TTS] 语音合成 + 口型数据
   ↓
[Live2D] 表情: Sad, 动作: concern
   ↓
输出: 文本 + 语音 + 动画
```

---

### 演示 4: 语音输入完整流程 (4 分钟)

**目的**: 展示 Phase 4 (音频输入 + VAD)

**交互流程**:

1. 点击麦克风按钮
2. 说出: "明天天气怎么样"
3. 观察流程:

```
[点击麦克风]
    ↓
[MicrophoneCapture] 开始捕获音频
    ↓
[VADEngine] 检测语音活动 (阈值: 0.02)
    ↓
[检测到语音开始]
    ↓
[TranscriptionPipeline] 实时转录
    ↓
[检测到语音结束] (静音 > 500ms)
    ↓
[生成文字] "明天天气怎么样"
    ↓
[发送给 AI] → 进入对话管线
```

**代码监听**:

```typescript
await bridge.startVoiceInput();

// VAD 事件
bridge.onStateChange((state) => {
  if (state.audio.isRecording) {
    console.log('🎤 录音中...');
  }
});
```

---

### 演示 5: Telegram Bot (5 分钟)

**目的**: 展示 Phase 5 (多平台服务)

**启动**:

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
npm run telegram:demo
```

**手机操作**:

1. 打开 Telegram
2. 搜索 @YourDemoBot
3. 点击 Start
4. 发送测试消息

**命令测试**:

| 命令 | 操作 | 预期 |
|------|------|------|
| `/start` | 发送 | 显示欢迎消息 |
| `/voice` | 发送 | 开启/关闭语音回复 |
| 文字输入 | 发送 "你好" | AI 文字回复 |
| 语音输入 | 按住说话 | AI 语音回复 |

**集成验证**:

```typescript
// Console 和 Telegram 共享状态
await bridge.sendMessage('从控制台发送');
// 在 Telegram 中应该能看到对话上下文
```

---

## 完整演示 (15 分钟)

### 场景: 用户情绪变化

**脚本**:

```typescript
const fullConversation = [
  {
    user: '你好！',
    expectEmotion: 'happy',
    expectResponse: '友好问候'
  },
  {
    user: '今天工作不顺利...',
    expectEmotion: 'sad',
    expectResponse: '表示关心'
  },
  {
    user: '不过问题解决了！',
    expectEmotion: 'excited',
    expectResponse: '庆祝'
  },
  {
    user: '谢谢你的陪伴',
    expectEmotion: 'grateful',
    expectResponse: '温暖回复'
  }
];

for (const turn of fullConversation) {
  console.log(`\n用户: ${turn.user}`);
  await bridge.sendMessage(turn.user);

  // 观察指标
  const state = bridge.getState();
  console.log('情感状态:', state.currentEmotion);
  console.log('Live2D 表情:', state.live2d.currentExpression);

  await sleep(5000);
}
```

**观察指标**:

| 指标 | 观察位置 |
|------|----------|
| 6维情感指标 | Console State |
| 主导情绪 | 右侧情感面板 |
| Live2D 表情 | 角色面部 |
| TTS 语调 | 语音播放 |

---

## 使用 DemoRunner

### 启动演示

```typescript
import { DemoRunner } from './demo';

const demo = new DemoRunner({
  enableLive2D: true,
  enableAudio: true,
  enableTelegram: false,
});

await demo.initialize();

// 运行指定场景
await demo.runScenario('expressions');   // 表情演示
await demo.runScenario('conversation');  // 对话演示
await demo.runScenario('voice');         // 语音演示
await demo.runScenario('full');          // 完整演示
```

### 命令行运行

```bash
# 运行完整演示
npm run demo

# 指定场景
npm run demo -- --scenario=expressions
```

---

## 故障排查

### 常见问题

#### Live2D 不显示

```bash
# 检查 canvas
document.getElementById('live2d-canvas')

# 检查模型路径
ls src/console/public/assets/live2d/
```

#### 麦克风不工作

```javascript
// 检查权限
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('麦克风权限正常'))
  .catch(e => console.error('权限错误:', e));
```

#### TTS 无声音

```typescript
// 检查音频上下文
const audioContext = new AudioContext();
console.log('AudioContext state:', audioContext.state);

// 如果是 suspended，需要用户交互
await audioContext.resume();
```

#### Telegram Bot 无响应

```bash
# 检查连通性
curl https://api.telegram.org/bot<TOKEN>/getMe

# 检查 webhook/polling
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

---

## 性能监控

### 实时监控

```typescript
// 性能指标
const metrics = {
  fps: 60,                    // Live2D 帧率
  audioLatency: 50,           // 音频延迟 (ms)
  pipelineTime: 200,          // 管线处理时间 (ms)
  ttsTime: 500,               // TTS 生成时间 (ms)
  memoryUsage: 100,           // 内存使用 (MB)
};

// 在浏览器控制台查看
console.table(metrics);
```

### 浏览器 DevTools

```javascript
// 查看系统状态
const state = bridge.getState();
console.table(state);

// 查看消息历史
console.table(state.messages);

// 查看当前情感
console.log('Current Emotion:', state.currentEmotion);
```

---

## 演示检查清单

### 演示前

- [ ] 所有 149 个测试通过
- [ ] Live2D 模型文件存在
- [ ] 麦克风权限已授权
- [ ] Telegram Bot Token 有效
- [ ] 浏览器支持 Web Audio API

### 演示中

- [ ] Live2D 动画流畅
- [ ] 表情切换正常
- [ ] 文字对话正常
- [ ] 语音输入正常
- [ ] TTS 播放正常
- [ ] 口型同步准确
- [ ] Telegram Bot 响应

### 演示后

- [ ] 无错误日志
- [ ] 内存使用正常
- [ ] 会话数据正确
