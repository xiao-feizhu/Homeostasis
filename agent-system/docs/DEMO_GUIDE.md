# Demo 演示详细指南

## 快速开始 (5 分钟上手)

### 1. 启动系统

```bash
cd /Users/xxx/claude-workspace/ecomop/agent-system

# 安装依赖 (如果尚未安装)
npm install

# 运行所有测试 (确保一切正常)
npm test -- --testPathPattern="avatar|emotion|audio|telegram|console"

# 预期输出: 149 passed
```

### 2. 打开控制台

```bash
# 使用简单的 HTTP 服务器
npx serve src/console/public -p 8080

# 打开浏览器
open http://localhost:8080
```

### 3. 基础功能验证

| 功能 | 操作 | 预期结果 |
|------|------|----------|
| Live2D | 页面加载后 | 看到眨眼、呼吸动画 |
| 表情 | 点击 Happy 按钮 | 角色微笑 |
| 聊天 | 输入 "你好" | AI 回复 + 表情变化 |
| 语音 | 点击麦克风 | 录音指示灯闪烁 |

---

## 功能演示详解

### 演示 1: Live2D 表情系统

**目的**: 展示 Phase 1 (Live2D) + Phase 3 (表情管线)

**步骤**:

```typescript
// 控制台执行
const bridge = new ConsoleBridge({
  canvasId: 'live2d-canvas'
});

await bridge.initialize();

// 切换表情
await bridge.setExpression(ExpressionType.HAPPY);   // 开心
await bridge.setExpression(ExpressionType.SAD);     // 难过
await bridge.setExpression(ExpressionType.ANGRY);   // 生气
await bridge.setExpression(ExpressionType.NEUTRAL); // 恢复
```

**观察点**:
- 表情切换平滑度
- 眨眼/呼吸动画持续播放
- 右侧情感状态指示器更新

---

### 演示 2: 口型同步 (LipSync)

**目的**: 展示 Phase 2 (wlipsync) + Phase 4 (音频输出)

**步骤**:

```typescript
// 启动 TTS 并观察口型
await bridge.speak('你好，这是语音合成测试');

// 观察: 角色嘴巴会根据元音 (a, i, u, e, o) 变化
```

**技术细节**:

```typescript
// 口型映射
const VISEME_MAP = {
  'a': { mouthOpenness: 0.8, mouthWidth: 0.9 },  // 张大嘴
  'i': { mouthOpenness: 0.3, mouthWidth: 0.4 },  // 扁嘴
  'u': { mouthOpenness: 0.2, mouthWidth: 0.3 },  // 圆嘴
  'e': { mouthOpenness: 0.5, mouthWidth: 0.8 },  // 中等
  'o': { mouthOpenness: 0.6, mouthWidth: 0.6 },  // 圆嘴
};
```

---

### 演示 3: 完整对话管线

**目的**: 展示 Phase 3 (CharacterPipeline) 完整流程

**流程图**:

```
用户输入
    ↓
[Segmentation] 文本分段
    ↓
[Emotion Analysis] 情感分析
    ↓
[Delay Controller] 延迟控制
    ↓
[TTS] 语音合成
    ↓
[LipSync] 口型同步
    ↓
[Live2D] 表情展示
    ↓
AI 回复输出
```

**实测对话**:

```javascript
// 输入
"今天工作好累啊"

// Pipeline 处理
{
  segments: ["今天工作好累啊"],
  emotion: {
    satisfaction: 30,
    trust: 50,
    frustration: 70,  // 高挫败感
    urgency: 0,
    engagement: 60,
    confusion: 0
  },
  dominantState: 'NEGATIVE',
  response: '听起来你今天过得很辛苦。需要休息一下吗？',
  responseEmotion: 'concerned'
}

// 输出
// - 文本回复
// - 表情: Sad
// - 语调: 温和
// - 口型同步
```

---

### 演示 4: 语音输入完整流程

**目的**: 展示 Phase 4 (音频输入 + VAD)

**步骤**:

1. 点击麦克风按钮
2. 说出: "明天天气怎么样"
3. 观察流程:

```
[点击麦克风]
    ↓
[MicrophoneCapture] 开始捕获音频
    ↓
[VADEngine] 检测语音活动
    ↓
[检测到语音开始]
    ↓
[TranscriptionPipeline] 实时转录
    ↓
[检测到语音结束]
    ↓
[生成文字] "明天天气怎么样"
    ↓
[发送给 AI]
```

**代码示例**:

```typescript
// 开始录音
await bridge.startVoiceInput();

// VAD 事件监听
transcription.onEvent((event) => {
  switch (event.type) {
    case 'speech_start':
      console.log('开始说话');
      break;
    case 'speech_end':
      console.log('结束说话');
      break;
    case 'result':
      console.log('转录结果:', event.data.text);
      break;
  }
});
```

---

### 演示 5: Telegram Bot

**目的**: 展示 Phase 5 (多平台服务)

**步骤**:

1. 环境准备
```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
npm run telegram:demo
```

2. 手机操作
```
1. 打开 Telegram
2. 搜索 @YourDemoBot
3. 点击 Start
4. 发送测试消息
```

3. 功能验证

| 命令 | 功能 | 预期 |
|------|------|------|
| `/start` | 欢迎消息 | 显示 Bot 介绍 |
| `/help` | 帮助信息 | 显示可用命令 |
| `/voice` | 切换语音 | 开启/关闭 TTS |
| 文字输入 | 普通对话 | AI 回复 |
| 语音输入 | 语音对话 | AI 语音回复 |

**集成验证**:

```typescript
// 验证 Telegram 和 Console 共享状态
const bridge = new ConsoleBridge({});
const telegramBot = new TelegramBot({ token });
const agentBridge = new TelegramAgentBridge({
  bot: telegramBot,
  pipeline: bridge['pipeline'], // 共享 pipeline
});

// 在 Console 发送消息
await bridge.sendMessage('你好');

// 在 Telegram 应该能看到相同的上下文
```

---

## 高级演示: 情感驱动的完整交互

### 场景: 用户情绪变化

**脚本**:

```typescript
// 模拟完整对话流程
const conversation = [
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

// 执行对话
for (const turn of conversation) {
  console.log(`用户: ${turn.user}`);
  await bridge.sendMessage(turn.user);
  await sleep(3000); // 等待 AI 回复
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

## 故障排查

### 常见问题快速修复

#### Live2D 不显示
```bash
# 检查 canvas
 document.getElementById('live2d-canvas')

# 检查模型路径
ls src/console/public/assets/live2d/
```

#### 麦克风不工作
```bash
# 检查权限
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
# 检查 webhook/polling
 curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# 测试连通性
 curl https://api.telegram.org/bot<TOKEN>/getMe
```

---

## 性能监控

### 关键指标

```typescript
// 实时性能监控
const metrics = {
  // Live2D FPS
  fps: 0,

  // 音频延迟
  audioLatency: 0,

  // Pipeline 处理时间
  pipelineTime: 0,

  // TTS 生成时间
  ttsTime: 0,
};

// 显示在 Console
console.log('Performance Metrics:', metrics);
```

### 浏览器 DevTools

```javascript
// 在控制台执行，查看系统状态
const state = bridge.getState();
console.table(state);

// 查看消息历史
console.table(state.messages);

// 查看当前情感
console.log('Current Emotion:', state.currentEmotion);
```

---

## 演示检查清单

### 演示前检查

- [ ] 所有 149 个测试通过
- [ ] Live2D 模型文件存在
- [ ] 麦克风权限已授权
- [ ] Telegram Bot Token 有效
- [ ] 浏览器支持 Web Audio API
- [ ] 备用方案就绪 (纯文字模式)

### 演示中检查

- [ ] Live2D 动画流畅
- [ ] 表情切换正常
- [ ] 文字对话正常
- [ ] 语音输入正常
- [ ] TTS 播放正常
- [ ] 口型同步准确
- [ ] Telegram Bot 响应

### 演示后检查

- [ ] 无错误日志
- [ ] 内存使用正常
- [ ] 会话数据正确

---

## 附录: 一键启动脚本

```bash
#!/bin/bash
# demo-start.sh

echo "🚀 Starting AI Agent Demo..."

# 1. 检查测试
npm test -- --silent || exit 1
echo "✅ All tests passed"

# 2. 启动控制台服务器
npx serve src/console/public -p 8080 &
CONSOLE_PID=$!
echo "✅ Console server started (PID: $CONSOLE_PID)"

# 3. 打开浏览器
sleep 2
open http://localhost:8080
echo "✅ Browser opened"

# 4. 等待中断
echo ""
echo "Demo is running! Press Ctrl+C to stop."
wait $CONSOLE_PID
```

```bash
# 赋予执行权限
chmod +x demo-start.sh

# 运行
./demo-start.sh
```
