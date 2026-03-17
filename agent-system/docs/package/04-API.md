# API 文档

## 概述

本文档描述 AI Agent System 的公共 API 接口，包括 ConsoleBridge、Telegram Bot 和内部模块接口。

## ConsoleBridge API

ConsoleBridge 是系统的主要入口点，提供统一的接口与虚拟形象交互。

### 初始化

```typescript
import { ConsoleBridge } from './console';

const bridge = new ConsoleBridge({
  canvasId: 'live2d-canvas',     // Canvas 元素 ID
  width: 800,                     // 画布宽度
  height: 600,                    // 画布高度
  enableLive2D: true,            // 启用 Live2D
  enableAudio: true,             // 启用音频
  enablePipeline: true,          // 启用角色管线
});

await bridge.initialize();
```

### 配置选项

```typescript
interface ConsoleBridgeConfig {
  canvasId: string;              // Canvas 元素 ID
  width?: number;                // 画布宽度 (默认: 800)
  height?: number;               // 画布高度 (默认: 600)
  enableLive2D?: boolean;        // 启用 Live2D (默认: true)
  enableAudio?: boolean;         // 启用音频 (默认: true)
  enablePipeline?: boolean;      // 启用角色管线 (默认: true)
  modelPath?: string;            // Live2D 模型路径
}
```

### Live2D 控制

#### 加载模型

```typescript
await bridge.loadLive2DModel('/assets/live2d/model.json');
```

#### 设置表情

```typescript
import { ExpressionType } from './avatar/entities/avatar.entity';

await bridge.setExpression(ExpressionType.HAPPY);
```

表情类型：
- `ExpressionType.NEUTRAL` - 中性
- `ExpressionType.HAPPY` - 开心
- `ExpressionType.SAD` - 难过
- `ExpressionType.ANGRY` - 生气
- `ExpressionType.SURPRISED` - 惊讶

#### 播放动作

```typescript
await bridge.playMotion('greeting');
```

### 消息处理

#### 发送消息

```typescript
await bridge.sendMessage('你好！');
```

处理流程：
1. 分段输入文本
2. 情感分析
3. 延迟计算
4. LLM 生成回复
5. TTS 合成
6. 播放回复（音频 + Live2D）

#### 监听消息

```typescript
const unsubscribe = bridge.onMessage((message: ChatMessage) => {
  console.log('收到消息:', message);
});

// 取消监听
unsubscribe();
```

消息类型：

```typescript
interface ChatMessage {
  id: string;                    // 消息 ID
  role: 'user' | 'assistant';    // 发送者角色
  content: string;               // 消息内容
  emotion?: EmotionType;         // 情感类型
  timestamp: number;             // 时间戳
  audioUrl?: string;             // 音频 URL (如果有)
}
```

### 语音控制

#### 开始语音输入

```typescript
await bridge.startVoiceInput();
```

触发 VAD (语音活动检测) 流程：
1. 请求麦克风权限
2. 开始音频捕获
3. VAD 检测语音开始/结束
4. 转录语音为文本
5. 自动发送消息

#### 停止语音输入

```typescript
bridge.stopVoiceInput();
```

#### TTS 播放

```typescript
await bridge.speak('这是要播放的文本');
```

### 状态获取

#### 获取当前状态

```typescript
const state = bridge.getState();
```

状态类型：

```typescript
interface ConsoleState {
  // Live2D 状态
  live2d: {
    initialized: boolean;        // 是否已初始化
    modelLoaded: boolean;        // 模型是否已加载
    currentExpression: ExpressionType; // 当前表情
  };

  // 音频状态
  audio: {
    microphoneAvailable: boolean; // 麦克风是否可用
    isRecording: boolean;        // 是否正在录音
    isPlaying: boolean;          // 是否正在播放
  };

  // 消息状态
  messages: ChatMessage[];       // 消息历史

  // 情感状态
  currentEmotion: EmotionMetrics; // 当前情感指标
}
```

#### 监听状态变化

```typescript
const unsubscribe = bridge.onStateChange((state: ConsoleState) => {
  console.log('状态更新:', state);
});

// 取消监听
unsubscribe();
```

### 销毁

```typescript
bridge.destroy();
```

清理所有资源：
- 停止动画循环
- 释放音频资源
- 断开 WebSocket 连接
- 清理事件监听器

## Telegram Bot API

### 初始化

```typescript
import { TelegramBot } from './services/telegram';

const bot = new TelegramBot({
  token: process.env.TELEGRAM_BOT_TOKEN,
  polling: true,
});

await bot.initialize();
```

### 发送消息

```typescript
await bot.sendMessage({
  chatId: '123456789',
  text: '你好！',
  options: {
    parseMode: 'HTML',
    replyMarkup: {
      keyboard: [['按钮1', '按钮2']],
      resizeKeyboard: true,
    },
  },
});
```

### 发送语音

```typescript
await bot.sendVoice({
  chatId: '123456789',
  audioBuffer: audioData,
  caption: '语音消息',
});
```

### 监听消息

```typescript
bot.onMessage((message) => {
  console.log('收到消息:', message.text);
});
```

### TelegramAgentBridge

连接 Telegram Bot 与 CharacterPipeline：

```typescript
import { TelegramAgentBridge } from './services/telegram';

const agentBridge = new TelegramAgentBridge({
  bot: telegramBot,
  enableTTS: true,
});

await agentBridge.initialize();
```

## CharacterPipeline API

### 初始化

```typescript
import { CharacterPipeline } from './emotion/pipeline';

const pipeline = new CharacterPipeline({
  llmConnector: llmInstance,
  ttsConnector: ttsInstance,
});

await pipeline.initialize();
```

### 处理输入

```typescript
const result = await pipeline.processInput('用户输入文本');
```

返回结果：

```typescript
interface PipelineResult {
  segments: string[];            // 分段结果
  emotion: {
    metrics: EmotionMetrics;     // 情感指标
    dominantState: EmotionState; // 主导情感状态
  };
  response: string;              // AI 回复
  responseEmotion: string;       // 回复情感
  audio?: AudioBuffer;           // TTS 音频
  lipSyncData?: LipSyncData;     // 口型同步数据
}
```

### 事件监听

```typescript
pipeline.on(PipelineEvent.SEGMENT_CREATED, (segment) => {
  console.log('分段创建:', segment);
});

pipeline.on(PipelineEvent.EMOTION_UPDATED, (emotion) => {
  console.log('情感更新:', emotion);
});

pipeline.on(PipelineEvent.RESPONSE_READY, (response) => {
  console.log('回复就绪:', response);
});

pipeline.on(PipelineEvent.TTS_COMPLETE, (audio) => {
  console.log('TTS 完成:', audio);
});
```

## EmotionAnalyzer API

### 分析文本

```typescript
import { EmotionAnalyzer } from './emotion/analyzer';

const analyzer = new EmotionAnalyzer();

const result = analyzer.analyze('今天工作好累啊');
```

返回结果：

```typescript
interface EmotionAnalysisResult {
  metrics: EmotionMetrics;       // 6维情感指标
  dominantState: EmotionState;   // 主导状态
  confidence: number;            // 置信度 (0-1)
}

interface EmotionMetrics {
  satisfaction: number;          // 满意度 (0-100)
  trust: number;                 // 信任度 (0-100)
  frustration: number;           // 挫败感 (0-100)
  urgency: number;               // 紧急度 (0-100)
  engagement: number;            // 参与度 (0-100)
  confusion: number;             // 困惑度 (0-100)
}

type EmotionState = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
```

## Live2D Adapter API

### AiriLive2DAdapter

```typescript
import { AiriLive2DAdapter } from './avatar/adapters/airi-live2d';

const adapter = new AiriLive2DAdapter({
  canvas: document.getElementById('canvas'),
  modelPath: '/assets/live2d/model.json',
});

await adapter.initialize();
```

### 控制方法

```typescript
// 设置表情
await adapter.setExpression('happy');

// 播放动作
await adapter.playMotion('greeting');

// 更新口型参数
adapter.updateLipSync({
  open: 0.5,                     // 张嘴程度 (0-1)
  wide: 0.3,                     // 嘴宽 (0-1)
});

// 设置注视方向
adapter.setGazeDirection(x, y);  // x, y 范围 0-1

// 启用/禁用眨眼
adapter.setBlinking(true);

// 销毁
adapter.destroy();
```

### 事件

```typescript
adapter.on('modelLoaded', () => {
  console.log('模型加载完成');
});

adapter.on('expressionChanged', (expression) => {
  console.log('表情变化:', expression);
});

adapter.on('motionStarted', (motion) => {
  console.log('动作开始:', motion);
});

adapter.on('motionCompleted', (motion) => {
  console.log('动作完成:', motion);
});
```

## LipSync API

### WlipsyncAdapter

```typescript
import { WlipsyncAdapter } from './avatar/adapters/airi-lipsync';

const lipSync = new WlipsyncAdapter({
  sampleRate: 16000,
});

await lipSync.initialize();
```

### 分析音频

```typescript
// 实时分析
lipSync.processAudio(audioBuffer);

// 获取当前口型
const viseme = lipSync.getCurrentViseme();
// { a: 0.5, i: 0.1, u: 0, e: 0.2, o: 0.1 }
```

### 从文本生成

```typescript
const lipSyncData = lipSync.generateFromText('你好世界');
```

## Audio API

### MicrophoneCapture

```typescript
import { MicrophoneCapture } from './audio/input';

const mic = new MicrophoneCapture({
  sampleRate: 16000,
  bufferSize: 2048,
});

await mic.initialize();

// 开始捕获
await mic.start();

// 监听音频数据
mic.onAudioData((buffer) => {
  console.log('音频数据:', buffer);
});

// 停止捕获
mic.stop();
```

### VADEngine

```typescript
import { VADEngine } from './audio/input';

const vad = new VADEngine({
  threshold: 0.02,
  minSpeechDuration: 200,
});

vad.onSpeechStart(() => {
  console.log('语音开始');
});

vad.onSpeechEnd((audioBuffer) => {
  console.log('语音结束，缓冲区:', audioBuffer);
});

// 处理音频
vad.process(audioData);
```

### AudioPlayer

```typescript
import { AudioPlayer } from './audio/output';

const player = new AudioPlayer();

await player.initialize();

// 播放音频
await player.play(audioBuffer);

// 停止播放
player.stop();

// 暂停/恢复
player.pause();
player.resume();

// 设置音量
player.setVolume(0.8);           // 0-1
```

## 错误处理

所有 API 都可能抛出错误，应使用 try-catch 处理：

```typescript
try {
  await bridge.initialize();
} catch (error) {
  if (error instanceof Live2DError) {
    console.error('Live2D 错误:', error.message);
  } else if (error instanceof AudioError) {
    console.error('音频错误:', error.message);
  } else {
    console.error('未知错误:', error);
  }
}
```

错误类型：

```typescript
class Live2DError extends Error {}
class AudioError extends Error {}
class PipelineError extends Error {}
class TelegramError extends Error {}
```

## 类型定义

完整的 TypeScript 类型定义：

```typescript
// 导出所有类型
export * from './avatar/entities/avatar.entity';
export * from './emotion/entities/emotion.entity';
export * from './audio/entities/audio.entity';
export * from './console/entities/console.entity';
```
