# 配置指南

## 概述

本文档详细说明 AI Agent System 的所有配置选项，包括环境变量、配置文件和运行时参数。

## 环境变量配置

### 必需配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token (如需使用 Telegram 功能) | `123456:ABC-DEF...` |

### 可选配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `NODE_ENV` | 运行环境 | `development` | `production` |
| `PORT` | 服务端口 | `8080` | `3000` |
| `LOG_LEVEL` | 日志级别 | `info` | `debug`, `warn`, `error` |
| `LLM_PROVIDER` | LLM 提供商 | `openai` | `anthropic`, `custom` |
| `LLM_API_KEY` | LLM API 密钥 | - | `sk-...` |
| `LLM_MODEL` | LLM 模型名称 | `gpt-4` | `claude-3-opus` |
| `TTS_PROVIDER` | TTS 提供商 | `system` | `elevenlabs`, `custom` |
| `TTS_API_KEY` | TTS API 密钥 | - | `...` |

## Phase 1: Live2D 配置

### 模型配置

```typescript
// src/avatar/adapters/airi-live2d/config.ts
export const Live2DConfig = {
  // 模型路径
  modelPath: '/assets/live2d/model.json',

  // 渲染选项
  renderOptions: {
    autoUpdate: false,           // 手动控制渲染循环
    antialias: true,             // 抗锯齿
    backgroundAlpha: 0,          // 透明背景
    resolution: window.devicePixelRatio || 1,
  },

  // 动画参数
  animation: {
    blinkInterval: 4000,         // 眨眼间隔 (ms)
    blinkDuration: 200,          // 眨眼持续时间 (ms)
    breathAmplitude: 0.05,       // 呼吸幅度
    breathSpeed: 0.003,          // 呼吸速度
    gazeSmoothness: 0.1,         // 注视平滑度 (0-1)
  },

  // 表情映射
  expressionMappings: {
    [ExpressionType.NEUTRAL]: 'neutral',
    [ExpressionType.HAPPY]: 'happy',
    [ExpressionType.SAD]: 'sad',
    [ExpressionType.ANGRY]: 'angry',
    [ExpressionType.SURPRISED]: 'surprised',
  },
};
```

### Canvas 配置

```html
<!-- index.html -->
<canvas
  id="live2d-canvas"
  width="800"
  height="600"
  style="width: 100%; height: 100%;"
></canvas>
```

```typescript
// ConsoleBridge 初始化
const bridge = new ConsoleBridge({
  canvasId: 'live2d-canvas',     // Canvas 元素 ID
  width: 800,                     // 画布宽度
  height: 600,                    // 画布高度
  enableLive2D: true,            // 启用 Live2D
});
```

## Phase 2: 口型同步配置

### Wlipsync 配置

```typescript
// src/avatar/adapters/airi-lipsync/config.ts
export const LipSyncConfig = {
  // 音频分析参数
  audio: {
    sampleRate: 16000,           // 采样率
    bufferSize: 2048,            // 缓冲区大小
    channels: 1,                 // 声道数
  },

  // 口型映射权重
  visemeWeights: {
    'a': { open: 0.8, wide: 0.9 },
    'i': { open: 0.3, wide: 0.4 },
    'u': { open: 0.2, wide: 0.3 },
    'e': { open: 0.5, wide: 0.8 },
    'o': { open: 0.6, wide: 0.6 },
  },

  // 平滑参数
  smoothing: {
    enabled: true,
    factor: 0.3,                 // 平滑因子 (0-1)
  },

  // 阈值
  threshold: {
    silence: 0.01,               // 静音阈值
    minDuration: 50,             // 最小持续时间 (ms)
  },
};
```

## Phase 3: 角色管线配置

### 分段引擎配置

```typescript
// src/emotion/pipeline/config.ts
export const SegmentationConfig = {
  // 分段策略
  strategy: 'semantic',          // 'semantic' | 'fixed' | 'hybrid'

  // 语义分段参数
  semantic: {
    maxSegmentLength: 100,       // 最大段长度 (字符)
    minSegmentLength: 10,        // 最小段长度
    sentenceBreaks: ['。', '！', '？', '.', '!', '?'],
  },

  // 固定分段参数
  fixed: {
    segmentLength: 50,           // 固定段长度
    overlap: 10,                 // 重叠字符数
  },
};
```

### 延迟控制器配置

```typescript
export const DelayConfig = {
  // 基础延迟 (ms)
  baseDelay: {
    min: 500,
    max: 2000,
  },

  // 情感影响因子
  emotionFactors: {
    urgency: 0.5,                // 紧急度影响
    engagement: 0.3,             // 参与度影响
    frustration: 0.2,            // 挫败感影响
  },

  // 打字速度模拟
  typingSimulation: {
    enabled: true,
    charsPerSecond: 8,           // 模拟打字速度
  },
};
```

### TTS 连接器配置

```typescript
export const TTSConfig = {
  // 提供商配置
  provider: 'system',            // 'system' | 'elevenlabs' | 'custom'

  // 系统 TTS 参数
  system: {
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: 1.0,                   // 语速
    pitch: 1.0,                  // 音调
    volume: 1.0,                 // 音量
  },

  // ElevenLabs 配置
  elevenlabs: {
    voiceId: '...',
    modelId: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.75,
  },

  // 缓存配置
  cache: {
    enabled: true,
    maxSize: 100,                // 最大缓存条目数
    ttl: 3600000,                // 缓存过期时间 (ms)
  },
};
```

## Phase 4: 音频系统配置

### 麦克风输入配置

```typescript
// src/audio/input/config.ts
export const MicrophoneConfig = {
  // 音频约束
  constraints: {
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },

  // 缓冲区配置
  buffer: {
    size: 4096,                  // 缓冲区大小
    maxDuration: 60000,          // 最大录制时长 (ms)
  },
};
```

### VAD 配置

```typescript
export const VADConfig = {
  // 检测参数
  detection: {
    threshold: 0.02,             // 语音检测阈值 (0-1)
    minSpeechDuration: 200,      // 最小语音时长 (ms)
    minSilenceDuration: 500,     // 最小静音时长 (ms)
    preSpeechBuffer: 300,        // 前置缓冲 (ms)
  },

  // 自适应参数
  adaptive: {
    enabled: true,
    adaptationRate: 0.1,         // 适应速率
  },
};
```

### 转录配置

```typescript
export const TranscriptionConfig = {
  // 提供商
  provider: 'whisper',           // 'whisper' | 'azure' | 'custom'

  // Whisper 配置
  whisper: {
    model: 'base',
    language: 'zh',
    task: 'transcribe',
  },

  // 实时转录
  realtime: {
    enabled: true,
    interval: 500,               // 转录间隔 (ms)
  },
};
```

## Phase 5: Telegram Bot 配置

### Bot 配置

```typescript
// src/services/telegram/config.ts
export const TelegramConfig = {
  // Bot 设置
  bot: {
    polling: true,               // 使用轮询模式
    webhook: false,              // 或使用 webhook
    webhookUrl: undefined,
  },

  // 命令列表
  commands: [
    { command: 'start', description: '开始使用' },
    { command: 'help', description: '帮助信息' },
    { command: 'voice', description: '切换语音模式' },
    { command: 'reset', description: '重置对话' },
  ],

  // 功能开关
  features: {
    voiceMessages: true,         // 语音消息
    tts: true,                   // TTS 回复
    inlineMode: false,           // 内联模式
  },

  // 限制
  limits: {
    maxMessageLength: 4096,      // 最大消息长度
    maxConcurrentChats: 100,     // 最大并发聊天数
  },
};
```

### LLM 连接器配置

```typescript
export const LLMConfig = {
  // 提供商配置
  providers: {
    openai: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      apiKey: process.env.OPENAI_API_KEY,
    },
    anthropic: {
      model: 'claude-3-opus-20240229',
      temperature: 0.7,
      maxTokens: 1000,
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  },

  // 默认提供商
  defaultProvider: 'openai',

  // 系统提示词
  systemPrompt: `你是一个友好的 AI 助手...`,

  // 上下文窗口
  contextWindow: {
    maxMessages: 20,             // 最大历史消息数
    maxTokens: 4000,             // 最大上下文 token 数
  },
};
```

## Phase 6: 控制台配置

### UI 配置

```typescript
// src/console/config.ts
export const ConsoleConfig = {
  // 布局
  layout: {
    live2dPanel: {
      width: '60%',
      minWidth: 400,
    },
    chatPanel: {
      width: '40%',
      minWidth: 300,
    },
  },

  // 主题
  theme: {
    primaryColor: '#1890ff',
    backgroundColor: '#f0f2f5',
    textColor: '#333333',
  },

  // 动画
  animation: {
    enabled: true,
    duration: 300,               // 动画持续时间 (ms)
  },
};
```

## 配置文件示例

### 完整配置 (config.json)

```json
{
  "environment": "development",
  "port": 8080,
  "logLevel": "info",

  "live2d": {
    "modelPath": "/assets/live2d/model.json",
    "canvasWidth": 800,
    "canvasHeight": 600,
    "animation": {
      "blinkInterval": 4000,
      "breathAmplitude": 0.05
    }
  },

  "lipsync": {
    "sampleRate": 16000,
    "smoothing": {
      "enabled": true,
      "factor": 0.3
    }
  },

  "pipeline": {
    "segmentation": {
      "strategy": "semantic",
      "maxSegmentLength": 100
    },
    "delay": {
      "baseDelay": {
        "min": 500,
        "max": 2000
      }
    }
  },

  "audio": {
    "microphone": {
      "sampleRate": 16000,
      "echoCancellation": true
    },
    "vad": {
      "threshold": 0.02,
      "minSpeechDuration": 200
    }
  },

  "telegram": {
    "enabled": false,
    "polling": true,
    "features": {
      "voiceMessages": true,
      "tts": true
    }
  },

  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7
  },

  "tts": {
    "provider": "system",
    "voice": "zh-CN-XiaoxiaoNeural",
    "cache": {
      "enabled": true,
      "maxSize": 100
    }
  }
}
```

## 环境特定配置

### 开发环境

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_DEBUG_UI=true
TTS_CACHE_ENABLED=false
```

### 生产环境

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_DEBUG_UI=false
TTS_CACHE_ENABLED=true
LLM_RETRY_ATTEMPTS=3
```

## 配置加载顺序

配置按以下优先级加载（后加载的覆盖先加载的）：

1. 默认配置 (代码中的默认值)
2. 配置文件 (`config.json`)
3. 环境变量 (`.env` 文件)
4. 运行时参数 (代码中传入)

```typescript
// 示例：加载配置
import { loadConfig } from './config/loader';

const config = loadConfig({
  configFile: './config.json',
  envFile: `.env.${process.env.NODE_ENV}`,
  overrides: {
    // 运行时覆盖
    port: process.env.PORT,
  },
});
```

## 配置验证

系统启动时会验证配置的有效性：

```typescript
// 验证示例
const validation = validateConfig(config);

if (!validation.valid) {
  console.error('配置错误:', validation.errors);
  process.exit(1);
}
```

验证规则包括：
- 必需字段存在性检查
- 数值范围检查
- 枚举值有效性检查
- 路径可访问性检查
