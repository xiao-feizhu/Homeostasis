# 系统架构文档

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户界面层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web 控制台  │  │ Telegram Bot │  │   API 接口   │          │
│  │  (Phase 6)   │  │  (Phase 5)   │  │             │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      业务逻辑层 (ConsoleBridge)                   │
│              统一接口层，协调各子系统                              │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Avatar 系统    │  │   Emotion 系统   │  │   Audio 系统    │
│  (Phase 1)      │  │   (Phase 3)      │  │  (Phase 4)      │
│                 │  │                 │  │                 │
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │Live2DAdapter│ │  │ │ Character   │ │  │ │ Microphone  │ │
│ │             │ │  │ │ Pipeline    │ │  │ │ Capture     │ │
│ │ ┌─────────┐ │ │  │ │             │ │  │ └─────────────┘ │
│ │ │Motion   │ │ │  │ │ ┌─────────┐ │ │  │ ┌─────────────┐ │
│ │ │Manager  │ │ │  │ │ │Segment  │ │ │  │ │ VAD Engine  │ │
│ │ └─────────┘ │ │  │ │ │Engine   │ │ │  │ └─────────────┘ │
│ │ ┌─────────┐ │ │  │ │ └─────────┘ │ │  │ ┌─────────────┐ │
│ │ │Animation│ │ │  │ │ ┌─────────┐ │ │  │ │ TTSPlayback │ │
│ │ └─────────┘ │ │  │ │ │ Delay   │ │ │  │ └─────────────┘ │
│ └─────────────┘ │  │ │ │Controller│ │ │  └─────────────────┘
│ ┌─────────────┐ │  │ │ └─────────┘ │ │
│ │EmotionMapper│ │  │ │ ┌─────────┐ │ │
│ └─────────────┘ │  │ │ │ TTS     │ │ │
└─────────────────┘  │ │ │Connector│ │ │
                     │ │ └─────────┘ │ │
                     │ └─────────────┘ │
                     │  ┌─────────────┐ │
                     │  │ Emotion     │ │
                     │  │ Analyzer    │ │
                     │  └─────────────┘ │
                     └───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      适配器层                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  pixi-live2d    │  │    wlipsync     │  │  node-telegram  │  │
│  │  -display       │  │                 │  │  -bot-api       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 模块详细说明

### Phase 1: Live2D 渲染引擎

**位置**: `src/avatar/adapters/airi-live2d/`

**核心组件**:
- `AiriLive2DAdapter`: 主适配器，封装 PixiJS 和 Live2D
- `Live2DMotionManager`: 动作管理，协调眨眼/呼吸/注视
- `EmotionMapper`: 表情映射，连接系统 ExpressionType 和 Live2D

**关键流程**:
```
初始化 → 创建 PixiJS App → 加载 Live2D 模型 → 启动动画循环
         ↓
    设置动作管理器 → 开始眨眼/呼吸/注视动画
```

### Phase 2: 口型同步

**位置**: `src/avatar/adapters/airi-lipsync/`

**核心组件**:
- `WlipsyncAdapter`: wlipsync 音频分析封装
- `HybridLipSync`: 文本+音频混合驱动
- `AudioAnalyzer`: Web Audio API 分析

**口型映射**:
```typescript
Phoneme → Vowel → Live2D Parameter
   A    →  'a'  → ParamMouthOpenY (0.8)
   I    →  'i'  → ParamMouthOpenY (0.3)
   U    →  'u'  → ParamMouthOpenY (0.2)
```

### Phase 3: 角色管线

**位置**: `src/emotion/pipeline/`

**核心组件**:
- `CharacterPipeline`: 主管线，协调全流程
- `SegmentationEngine`: 输入分段
- `DelayController`: 延迟控制
- `TTSConnector`: 语音合成

**处理流程**:
```
输入文本
   ↓
分段 (Segmentation)
   ↓
情感分析 (Emotion Analysis)
   ↓
延迟计算 (Delay Controller)
   ↓
TTS 合成
   ↓
口型数据生成
   ↓
触发 Live2D 表情
   ↓
输出
```

### Phase 4: 音频系统

**位置**: `src/audio/`

**输入模块** (`src/audio/input/`):
- `MicrophoneCapture`: 麦克风捕获
- `VADEngine`: 语音活动检测

**输出模块** (`src/audio/output/`):
- `AudioPlayer`: 音频播放
- `TTSPlayback`: TTS 播放控制

**管道模块** (`src/audio/pipeline/`):
- `TranscriptionPipeline`: 语音转文字管道

**数据流**:
```
麦克风 → VAD检测 → 音频缓冲 → 转录服务 → 文字输出
                                      ↓
TTS合成 → 音频缓冲 → 播放器 → 口型同步回调
```

### Phase 5: 多平台服务

**位置**: `src/services/telegram/`

**核心组件**:
- `TelegramBot`: Bot 核心
- `TelegramAgentBridge`: Agent System 桥接
- `LLMConnector`: 多 LLM 提供商支持

**架构**:
```
Telegram User
      ↓
Telegram Bot API
      ↓
TelegramBot (消息接收)
      ↓
TelegramAgentBridge (处理)
      ↓
CharacterPipeline (与 Console 共享)
      ↓
响应生成
      ↓
TelegramBot (消息发送)
      ↓
Telegram User
```

### Phase 6: 控制台

**位置**: `src/console/`

**核心组件**:
- `ConsoleBridge`: UI 与后端桥接
- `index.html`: 界面布局

**界面布局**:
```
┌─────────────────┬─────────────┐
│                 │   聊天面板   │
│   Live2D 场景   ├─────────────┤
│                 │   信息面板   │
│  (canvas)       │             │
└─────────────────┴─────────────┘
```

## 数据流

### 对话完整数据流

```
用户输入 "你好"
   ↓
┌────────────────────────────────────────┐
│ 1. 输入处理                             │
│    - ConsoleBridge.receiveInput()      │
│    - 如果是语音: TranscriptionPipeline │
└────────────────────────────────────────┘
   ↓
┌────────────────────────────────────────┐
│ 2. 角色管线处理                         │
│    - SegmentationEngine.segment()      │
│    - DelayController.calculateDelay()  │
└────────────────────────────────────────┘
   ↓
┌────────────────────────────────────────┐
│ 3. 情感分析                             │
│    - EmotionAnalyzer.analyze()         │
│    - 更新 EmotionMetrics (6维)         │
└────────────────────────────────────────┘
   ↓
┌────────────────────────────────────────┐
│ 4. 响应生成                             │
│    - LLMConnector.chat()               │
│    - 生成回复文本                      │
└────────────────────────────────────────┘
   ↓
┌────────────────────────────────────────┐
│ 5. TTS 合成                             │
│    - TTSConnector.synthesize()         │
│    - 生成音频 + 口型数据               │
└────────────────────────────────────────┘
   ↓
┌────────────────────────────────────────┐
│ 6. Live2D 展示                          │
│    - 设置表情 setExpression()          │
│    - 播放动画 playMotion()             │
└────────────────────────────────────────┘
   ↓
┌────────────────────────────────────────┐
│ 7. 音频播放                             │
│    - TTSPlayback.play()                │
│    - 口型同步回调                      │
│    - updateParameter('ParamMouth...')  │
└────────────────────────────────────────┘
   ↓
用户看到角色说话动画 + 听到语音
```

## 接口定义

### ConsoleBridge 公共接口

```typescript
class ConsoleBridge {
  // 初始化
  initialize(): Promise<void>

  // Live2D
  loadLive2DModel(path: string): Promise<void>
  setExpression(type: ExpressionType): Promise<void>

  // 消息
  sendMessage(text: string): Promise<void>
  onMessage(handler: (msg: ChatMessage) => void): () => void

  // 语音
  startVoiceInput(): Promise<void>
  stopVoiceInput(): void
  speak(text: string): Promise<void>

  // 状态
  getState(): ConsoleState
  onStateChange(handler: (state: ConsoleState) => void): () => void
}
```

## 扩展点

### 添加新的 LLM 提供商

```typescript
// src/services/telegram/llm/llm-connector.ts
class LLMConnector {
  private async chatCustom(request: LLMRequest): Promise<LLMResponse> {
    // 实现自定义提供商
  }
}
```

### 添加新的表情类型

```typescript
// src/avatar/adapters/airi-live2d/emotion-mapper.ts
const DEFAULT_MAPPINGS: AiriEmotionMapping[] = [
  { sourceExpression: ExpressionType.CUSTOM, airiMotionName: 'Custom' },
];
```

### 添加新的音频提供商

```typescript
// src/emotion/pipeline/tts-connector.ts
class TTSConnector {
  private async synthesizeCustom(request: TTSRequest): Promise<TTSResult> {
    // 实现自定义 TTS
  }
}
```

## 性能考虑

### 优化点

1. **Live2D**: 使用 `autoUpdate: false` + 手动 `ticker.update()`
2. **音频**: 使用缓冲区避免内存泄漏
3. **TTS**: 启用缓存减少重复合成
4. **VAD**: 可调节阈值平衡灵敏度和误触发

### 监控指标

```typescript
const metrics = {
  fps: 60,                    // Live2D 帧率
  audioLatency: 50,           // 音频延迟 (ms)
  pipelineTime: 200,          // 管线处理时间 (ms)
  ttsTime: 500,               // TTS 生成时间 (ms)
  memoryUsage: 100,           // 内存使用 (MB)
}
```
