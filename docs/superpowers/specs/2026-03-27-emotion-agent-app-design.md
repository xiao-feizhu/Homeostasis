---
name: 情感Agent移动端App设计方案 - LLM驱动Live2D动作系统
description: Capacitor + 优化版Live2D，实现情绪驱动的智能动作反应系统
type: project
---

# 情感Agent移动端App设计方案

## 版本信息
- 创建日期: 2026-03-27
- 状态: 已审核
- 版本: 1.0

---

## 1. 项目概述

### 1.1 目标
开发一个移动端MVP应用，实现可动虚拟形象(Yumi)与用户的语音交互，Agent根据对话情境自动做出丰富的动作反应。

### 1.2 核心特性
- **Live2D虚拟形象**: 加载Yumi模型，支持8种基础表情 + 扩展手势
- **语音交互**: STT语音识别 + Azure TTS语音合成
- **智能动作**: LLM直接编排动作序列，情绪强度驱动表现
- **口型同步**: 音素级精准口型驱动

### 1.3 技术选型
| 层级 | 技术 | 说明 |
|------|------|------|
| 跨平台框架 | Capacitor 6 | 复用现有Web代码，原生能力扩展 |
| 渲染引擎 | Live2D Cubism 4 Core | WebAssembly物理，Core API直连 |
| 状态管理 | Zustand | 轻量，TypeScript友好 |
| 网络通信 | Socket.io-client | 自动重连，事件驱动 |
| 语音识别 | 原生STT | iOS Speech / Android 科大讯飞 |
| 语音合成 | Azure TTS REST API | 神经网络中文语音，提供音素时间轴用于口型同步 |
| 口型数据源 | Azure TTS viseme输出 | 需通过viseme-to-phoneme映射表转换 |

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Capacitor App Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Live2DView  │  │  ChatScreen  │  │  SettingsScreen  │   │
│  │  (Canvas)    │  │  (WebSocket) │  │  (LLM Switch)    │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
└─────────┼─────────────────┼──────────────────┼─────────────┘
          │                 │                  │
┌─────────▼─────────────────▼──────────────────▼─────────────┐
│                   Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │AvatarService │  │SpeechService │  │   AgentService   │   │
│  │ • Expression │  │  • STT       │  │  • WebSocket     │   │
│  │ • Gesture    │  │  • TTS       │  │  • LLM Switch    │   │
│  │ • LipSync    │  │  • Phoneme   │  │  • Emotion       │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                 │                  │
          ▼                 │                  ▼
┌───────────────────────────┴───────────────────────────────┐
│                   Native & External Services                │
│  ┌────────────────────────┐  ┌──────────────────────────┐   │
│  │  Native STT            │  │  Azure TTS API           │   │
│  │  (iOS/Android)         │  │  (音素数据+语音合成)      │   │
│  └────────────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 | 接口 |
|------|------|------|
| AvatarService | Live2D渲染控制、动作执行、表情混合 | `setExpression()`, `playGesture()`, `setLipSync()` |
| SpeechService | 语音录制、识别、合成、音素提取 | `startRecording()`, `synthesize()`, `onPhoneme()` |
| AgentService | LLM通信、情感识别、动作编排 | `sendMessage()`, `onDelta()`, `onAction()` |

---

## 3. Live2D 优化策略

### 3.1 当前瓶颈与优化

| 瓶颈 | 现状 | 优化方案 | 预期效果 |
|------|------|----------|----------|
| 参数响应延迟 | PixiJS封装层50ms | 直接调用Cubism Core API | 16ms响应 |
| 物理模拟 | JS单线程计算 | WebAssembly物理引擎(使用Live2D官方Core SDK内置WASM) | 帧率稳定+30% |
| 表情切换 | 直接替换，跳变 | 渐变插值200ms | 平滑过渡 |
| 手势系统 | 仅8种预设 | 参数级15+部位控制 | 动作丰富度翻倍 |

**WebAssembly方案说明**: 使用Live2D Cubism Core SDK官方提供的WASM构建版本，将物理计算(Math.random、三角函数等)移至WASM线程，主线程仅负责渲染。

### 3.2 控制器接口设计

```typescript
// 表情类型枚举 (对应模型中的exp3.json文件)
type ExpressionType =
  | 'HEART_EYES'      // 爱心眼 - 喜悦、害羞
  | 'BLACK_FACE'      // 黑脸 - 生气、不满
  | 'TEARY_EYES'      // 泪汪汪 - 难过、委屈
  | 'STAR_EYES'       // 星星眼 - 惊喜、崇拜
  | 'CAT_MOUTH'       // 猫猫嘴 - 调皮、卖萌
  | 'HOLD_MIC'        // 拿话筒 - 唱歌、播报
  | 'BLUSH'           // 脸红 - 害羞、紧张
  | 'NEUTRAL';        // 平常 - 默认状态

// 手势类型枚举
type GestureType =
  | 'WAVE'            // 挥手
  | 'POINT'           // 指点
  | 'CHIN_RUB'        // 摸下巴(思考)
  | 'CLAP'            // 拍手
  | 'SHRUG'           // 摊手
  | 'SELF_HUG'        // 抱胸
  | 'PEACE_SIGN'      // 比耶
  | 'THUMBS_UP';      // 竖拇指

// 情绪类型枚举
type EmotionType =
  | 'happy'           // 开心
  | 'sad'             // 难过
  | 'excited'         // 兴奋
  | 'thinking'        // 思考
  | 'angry'           // 生气
  | 'playful'         // 调皮
  | 'neutral';        // 平静

// 音素类型 (中文拼音元音映射)
type Phoneme = 'a' | 'i' | 'u' | 'e' | 'o' | 'n' | 'sil';

// 口型数据
interface PhonemeData {
  phoneme: Phoneme;
  offset: number;     // 开始时间(ms)
  duration: number;   // 持续时间(ms)
}

// 平滑参数工具类
class SmoothParam {
  private current = 0;
  private target = 0;
  private smoothFactor: number;

  constructor(smoothFactor = 0.1) {
    this.smoothFactor = smoothFactor;
  }

  setTarget(value: number) {
    this.target = value;
  }

  update(deltaTime: number): number {
    const t = 1 - Math.exp(-deltaTime / this.smoothFactor);
    this.current += (this.target - this.current) * t;
    return this.current;
  }
}
  // 面部表情（8种基础 + 强度微调）
  setExpression(
    emotion: ExpressionType,
    intensity: number, // 0-1范围
    blendTime?: number // 单位: ms
  ): void;

  // 头部精细控制（新增）
  setHeadPose(params: {
    tilt: number;      // 左右倾斜 -30~30°
    turn: number;      // 水平转动 -45~45°
    nodSpeed?: number; // 点头频率
  }): void;

  // 手势层（新增，叠加在表情上）
  playGesture(
    gesture: GestureType,
    options: {
      triggerAt?: number;  // 延迟触发(ms)
      duration?: number;   // 持续时间
      loop?: boolean;      // 是否循环
    }
  ): void;

  // 身体姿态（新增）
  setBodyPosture(params: {
    lean: number;        // 前倾程度 0-1
    shift: number;       // 左右偏移 -1~1
    breathingRate?: number; // 呼吸频率
  }): void;

  // 口型同步（音素级）
  setLipSync(phoneme: Phoneme, intensity: number): void;
}
```

### 3.3 动作库扩展

```
面部层 (8种): HEART_EYES, BLACK_FACE, TEARY_EYES, STAR_EYES, CAT_MOUTH, HOLD_MIC, BLUSH, NEUTRAL
+
头部层 (6种): NOD, SHAKE_HEAD, TILT, LOOK_UP, LOOK_DOWN, SHAKE_RAPID
+
手势层 (8种): WAVE, POINT, CHIN_RUB, CLAP, SHRUG, SELF_HUG, PEACE_SIGN, THUMBS_UP
+
身体层 (4种): LEAN_FORWARD, LEAN_BACK, LEAN_SIDE, BOUNCE
= 26种基础动作，可组合出多种变化
```

---

## 4. LLM 驱动动作系统

### 4.1 智能穿插策略

Agent根据内容复杂度自动选择动作策略：

| 内容类型 | 策略 | 动作表现 |
|----------|------|----------|
| 简单句子 (<5字) | minimal | 仅表情 + 简单点头 |
| 中等复杂度 + 积极 | gesture_assisted | 手势辅助说明 |
| 复杂描述/强调 | expressive | 大幅度动作 + 身体前倾 |
| 情绪强度 >0.8 | dramatic | 表情夸张 + 双手动作 |

**内容复杂度判定规则**:
```typescript
function determineComplexity(text: string, emotionIntensity: number): ActionStrategy {
  const wordCount = text.length; // 中文字符数
  const hasPunctuation = /[！。？]/.test(text);
  const hasEmphasis = /(真的|特别|非常|超级)/.test(text);

  if (emotionIntensity > 0.8) return 'dramatic';
  if (wordCount < 5 && !hasPunctuation) return 'minimal';
  if (hasEmphasis || (wordCount > 15 && hasPunctuation)) return 'expressive';
  return 'gesture_assisted';
}
```

### 4.2 情绪强度分级

| 强度 | 表情 | 头部 | 手势 | 身体 |
|------|------|------|------|------|
| 0.0-0.3 平静 | 细微 | 轻微点头 | 无 | 直立 |
| 0.3-0.6 温和 | 明显 | 配合转动 | 小动作 | 轻微倾斜 |
| 0.6-0.8 活跃 | 夸张 | 大幅转动 | 完整手势 | 明显前倾 |
| 0.8-1.0 强烈 | 最大化 | 快速晃动 | 双手动作 | 大幅度 |

### 4.3 LLM 输出协议

```typescript
interface AgentActionResponse {
  emotion: {
    type: EmotionType;
    intensity: number;    // 0-1
    duration: number;     // ms
  };

  actions: {
    expression?: {
      name: ExpressionType;
      fadeIn: number;
    };
    head?: {
      tilt: number;
      nod?: { speed: number; amplitude: number };
    };
    gesture?: {
      name: GestureType;
      triggerAt: number;  // 相对语音起始时间
      duration: number;
    };
    body?: {
      lean: number;
      bounce?: { freq: number; amp: number };
    };
  };

  syncPoints: Array<{
    wordIndex: number;    // LLM输出中的词索引(按空格/标点分割)
    action: 'gesture_emphasis' | 'head_nod' | 'expression_change';
  }>;

  // 说明: wordIndex通过以下步骤映射到音素时间:
  // 1. Azure TTS返回的viseme数据包含每个音素的offset
  // 2. 使用Grapheme-to-Phoneme(G2P)将word转换为音素序列
  // 3. 累积计算wordIndex对应的音素起始位置
  // 4. 映射到具体的时间点(ms)
  //
  // 示例: "Hello world"
  //   wordIndex 0 "Hello" -> 音素 [h, ə, l, oʊ] -> offset: 0ms
  //   wordIndex 1 "world" -> 音素 [w, ɜː, r, l, d] -> offset: 350ms

  lipSync: Array<{
    time: number;      // ms from start
    phoneme: string;   // a, i, u, e, o, sil
    intensity: number; // 0-1
  }>;
}
```

### 4.4 情绪-动作映射表

```typescript
const emotionActionMap: Record<EmotionType, ActionConfig> = {
  happy: {
    expression: 'HEART_EYES',
    head: { tilt: -10, nodSpeed: 1.5 },
    gesture: { name: 'CLAP', trigger: 'emphasis' },
    body: { lean: 0.2, bounce: true }
  },
  thinking: {
    expression: 'NEUTRAL',
    head: { tilt: 15, slowSway: true },
    gesture: { name: 'CHIN_RUB', loop: true },
    body: { lean: 0.1 }
  },
  excited: {
    expression: 'STAR_EYES',
    head: { shake: 'rapid' },
    gesture: { name: 'WAVE', hold: 1000 },
    body: { jump: true, lean: 0.3 }
  },
  sad: {
    expression: 'TEARY_EYES',
    head: { tilt: 10, droop: true },
    gesture: { name: 'SELF_HUG', loop: true },
    body: { lean: -0.1, sink: true }
  },
  angry: {
    expression: 'BLACK_FACE',
    head: { shake: 'emphatic' },
    gesture: { name: 'POINT', trigger: 'keyword' },
    body: { lean: 0.4, tense: true }
  },
  playful: {
    expression: 'CAT_MOUTH',
    head: { tilt: -15, sway: true },
    gesture: { name: 'PEACE_SIGN', trigger: 'random' },
    body: { lean: 0.15, bounce: { freq: 1.5 } }
  }
};
```

---

## 5. 口型同步系统

### 5.1 音素映射表

```typescript
const phonemeToLipShape: Record<string, LipShape> = {
  'a': { open: 1.0, wide: 0.8 },  // 啊 - 张大
  'i': { open: 0.2, wide: 1.0 },  // 衣 - 咧嘴
  'u': { open: 0.2, wide: 0.3 },  // 乌 - 嘟嘴
  'e': { open: 0.5, wide: 0.8 },  // 诶 - 半开
  'o': { open: 0.6, wide: 0.6 },  // 哦 - 圆形
  'n': { open: 0.1, wide: 0.5 },  // 嗯 - 微张
  'sil': { open: 0, wide: 0.5 },  // 静音 - 闭合
};

interface LipShape {
  open: number;   // 嘴巴张开程度 0-1
  wide: number;   // 嘴巴宽度 0-1
}
```

### 5.2 口型控制器

```typescript
class LipSyncController {
  private phonemes: PhonemeData[] = [];
  private startTime: number = 0;
  private smoothParam = new SmoothParam(0.05); // 50ms平滑

  setPhonemeData(data: PhonemeData[], startTime: number) {
    this.phonemes = data;
    this.startTime = startTime;
  }

  update(): void {
    const now = performance.now() - this.startTime;

    // 找到当前音素
    const current = this.phonemes.find(
      p => now >= p.offset && now < p.offset + p.duration
    );

    if (!current || current.phoneme === 'sil') {
      this.smoothParam.setTarget(0);
    } else {
      const shape = phonemeToLipShape[current.phoneme];
      // 添加微抖动模拟自然说话
      const jitter = Math.sin(now * 0.02) * 0.05;
      this.smoothParam.setTarget(shape.open + jitter);
    }

    // 应用平滑后的值
    const smoothedValue = this.smoothParam.update(0.016);
    live2dModel.setParamValue('ParamMouthOpenY', smoothedValue);
  }
}
```

---

## 6. 数据流设计

### 6.1 交互流程

```
用户语音输入
    ↓
[Capacitor Native STT]
- 实时返回识别文本
- 注: 科大讯飞/系统STT不返回音素数据
    ↓ 仅文本
[AgentService WebSocket]
- 发送: { text, context, emotion_history }
- 接收: 流式响应(文本+情感+动作指令)
    ↓
[Azure TTS API]
- 请求语音合成
- 返回: 音频流 + viseme(音素时间轴)
    ↓ 音频 + 音素序列
[Action Orchestrator]
- 解析语义关键词
- 查询情绪-动作映射
- 生成动作时间轴
- 绑定音素到口型
    ↓ 动作指令序列
[OptimizedLive2DController]
- 表情混合器 (200ms fade)
- 手势触发器 (sync to word)
- 口型同步器 (viseme-based)
- 物理模拟器 (WASM)
    ↓ 渲染
[Capacitor WebView]
- 60fps Live2D渲染
- 触摸交互响应
```

### 6.2 状态管理

```typescript
// Zustand Store
interface AppState {
  // 会话状态
  session: {
    isConnected: boolean;
    messages: Message[];
    currentEmotion: EmotionType;
    emotionIntensity: number;
  };

  // Avatar状态
  avatar: {
    currentExpression: ExpressionType;
    currentGesture: GestureType | null;
    lipSyncValue: number;
    headPose: { tilt: number; turn: number };
    bodyPosture: { lean: number; shift: number };
  };

  // 语音状态
  speech: {
    isRecording: boolean;
    isPlaying: boolean;
    currentTranscript: string;
    phonemeData: PhonemeData[]; // 来自Azure TTS viseme
  };

  // 设置
  settings: {
    llmProvider: 'kimi' | 'claude' | 'openai';
    voiceType: 'xiaoxiao' | 'xiaoyi' | 'xiaochen';
    avatarScale: number;
  };
}

// 消息类型
interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  emotion?: EmotionType;
  timestamp: number;
  audioUrl?: string; // TTS生成的音频URL
}

// Azure TTS Viseme映射到Phoneme (完整22个viseme)
// 参考: https://docs.microsoft.com/azure/cognitive-services/speech-service/speech-synthesis-markup#viseme-element
const visemeToPhoneme: Record<number, Phoneme> = {
  0: 'sil',   // silence
  1: 'a',     // ae, ax, ah
  2: 'a',     // aa
  3: 'i',     // iy, ih, ey, eh, ay
  4: 'u',     // uw, uh, ow
  5: 'e',     // er, ao
  6: 'o',     // aw, oy, uh
  7: 'u',     // w, uw
  8: 'n',     // r
  9: 'n',     // y, iy, ih
  10: 'n',    // s, z
  11: 'i',    // sh, ch, jh, zh
  12: 'n',    // th, dh
  13: 'i',    // f, v
  14: 'n',    // d, t, n, l
  15: 'a',    // k, g, ng
  16: 'i',    // p, b, m
};
```

---

## 7. 错误处理策略

### 7.1 错误场景与处理

| 场景 | 检测方式 | 处理策略 | 用户反馈 |
|------|----------|----------|----------|
| STT识别失败 | 置信度<0.6 | 显示"没听清" + 困惑表情 + 重试提示 | 角色歪头眨眼 |
| WebSocket断开 | onClose事件 | 自动重连3次，失败进入离线模式 | 显示网络状态，使用本地缓存 |
| LLM响应超时 | 8秒无响应 | 显示"让我想想" + 思考动作 | 角色摸下巴 |
| TTS加载失败 | 请求失败 | 降级为静音模式，仅显示文字 | 角色点头示意 |
| 动作冲突 | 队列检测 | 优先级: 紧急>情绪>手势，高优打断低优 | 平滑过渡，无跳变 |

### 7.2 动作冲突优先级队列实现

```typescript
type ActionPriority = 'emergency' | 'emotion' | 'gesture' | 'ambient';

interface ActionQueueItem {
  id: string;
  type: 'expression' | 'gesture' | 'head' | 'body';
  priority: ActionPriority;
  duration: number;
  startTime: number;
  interruptible: boolean;
}

class ActionPriorityQueue {
  private queue: ActionQueueItem[] = [];
  private currentAction: ActionQueueItem | null = null;

  enqueue(action: ActionQueueItem): boolean {
    // 高优先级可打断低优先级
    if (this.currentAction && !this.currentAction.interruptible) {
      if (this.getPriorityLevel(action.priority) <=
          this.getPriorityLevel(this.currentAction.priority)) {
        return false; // 无法打断
      }
      this.interruptCurrent();
    }

    // 按优先级插入队列
    const insertIndex = this.queue.findIndex(
      item => this.getPriorityLevel(item.priority) <
              this.getPriorityLevel(action.priority)
    );
    this.queue.splice(insertIndex === -1 ? this.queue.length : insertIndex, 0, action);
    return true;
  }

  private getPriorityLevel(p: ActionPriority): number {
    return { emergency: 4, emotion: 3, gesture: 2, ambient: 1 }[p];
  }

  private interruptCurrent() {
    if (this.currentAction) {
      // 触发平滑淡出
      this.emit('action:interrupt', this.currentAction);
    }
  }
}
```
| 渲染卡顿 | FPS<30检测 | 降低物理精度，简化特效 | 自动降级，用户无感知 |

### 7.3 降级策略

```typescript
class DegradationManager {
  private level: 'normal' | 'reduced' | 'minimal' = 'normal';

  onPerformanceIssue(fps: number) {
    if (fps < 20) {
      this.level = 'minimal';
      this.applyMinimalMode();
    } else if (fps < 40) {
      this.level = 'reduced';
      this.applyReducedMode();
    }
  }

  private applyReducedMode() {
    // 降低物理精度
    physicsConfig.drag = 0.9;
    // 减少手势复杂度
    gestureConfig.maxConcurrent = 1;
    // 延长插值时间，减少计算
    animationConfig.blendTime = 300;
  }

  private applyMinimalMode() {
    // 仅保留基础表情
    avatarConfig.enableGestures = false;
    // 关闭物理模拟
    physicsConfig.enabled = false;
    // 固定口型更新频率
    lipSyncConfig.updateRate = 15; // 15fps
  }
}
```

---

## 8. 性能目标

### 8.1 关键指标

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| 渲染帧率 | ≥60fps | requestAnimationFrame统计 |
| 动作响应延迟 | ≤50ms | 指令发出到参数变化 |
| 口型同步延迟 | ≤100ms | 音频播放vs嘴型变化 |
| 首屏加载时间 | ≤3s | 从点击到角色显示 |
| 内存占用 | ≤150MB | Chrome DevTools |
| 包体积(iOS) | ≤30MB | Xcode Archive |
| 包体积(Android) | ≤25MB | APK分析 |

**包体积构成估算**:
| 组件 | 大小(iOS) | 大小(Android) |
|------|-----------|---------------|
| Live2D Core SDK | ~3MB | ~2.5MB |
| Yumi模型资产 | ~8MB | ~8MB |
|   - 贴图纹理 | ~6MB | ~6MB |
|   - 模型JSON | ~1MB | ~1MB |
|   - 物理/表情配置 | ~1MB | ~1MB |
| Capacitor Runtime | ~5MB | ~4MB |
| 应用代码+资源 | ~4MB | ~3.5MB |
| **总计** | **~20MB** | **~18MB** |

*注: 模型资产可通过按需加载(lazy loading)减少到首包仅3MB*

### 8.2 优化措施

1. **WebAssembly物理引擎**: 将物理计算从JS线程移出
2. **模型懒加载**: 表情资源按需加载
3. **音频预缓存**: 常用TTS片段本地缓存
4. **渲染批处理**: 减少draw call
5. **纹理压缩**: 使用ASTC/ETC2格式

---

## 9. 测试策略

### 9.1 单元测试

```typescript
// AvatarController测试
describe('AvatarController', () => {
  it('should blend expressions over 200ms', async () => {
    controller.setExpression('happy', 1.0, 200);
    await wait(100);
    expect(controller.getExpressionWeight('happy')).toBeGreaterThan(0.3);
    expect(controller.getExpressionWeight('happy')).toBeLessThan(0.8);
    await wait(150);
    expect(controller.getExpressionWeight('happy')).toBe(1.0);
  });

  it('should prioritize emergency actions', () => {
    controller.playGesture('wave', { duration: 1000 });
    controller.playGesture('emergency_attention', { priority: 'high' });
    expect(controller.getCurrentGesture()).toBe('emergency_attention');
  });
});
```

### 9.2 集成测试
- 端到端对话流程
- WebSocket断线重连
- STT→Agent→TTS 完整链路

### 9.3 性能测试
- 长时间运行内存泄漏检测
- 低电量模式表现
- 后台恢复行为

### 9.4 设备兼容性

**最低系统版本**:
- iOS 14.0+ (支持WebAssembly和Speech Framework)
- Android 8.0 (API 26)+ (支持WebView WebAssembly)

**测试设备**:
- iPhone 12及以上
- iPad全系列 (iPadOS 14.0+)
- Android旗舰(小米/华为/三星) - Android 10+
- Android中端机(性能降级测试) - Android 8.0+

---

## 10. 未来演进

### 10.1 三渲2方案(Phase 2)

当需要更高自由度时，预留迁移路径：

```typescript
// 抽象接口，支持底层替换
interface AvatarController {
  setExpression(emotion: string, intensity: number): void;
  setGesture(gesture: string): void;
  setLookAt(x: number, y: number): void;
}

// 当前: Live2D实现
class Live2DAvatar implements AvatarController { }

// 未来: 三渲2实现
class ThreeDAnimeAvatar implements AvatarController { }
```

### 10.2 可能的升级方向
- 3D模型支持(360°旋转)
- Mocap动作捕捉接入
- 用户自定义动作录制
- 多角色同时显示

---

## 11. 风险评估

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|----------|
| Live2D移动端性能不达标 | 中 | 高 | 提前准备降级方案，WASM优化 |
| 科大讯飞SDK集成复杂 | 中 | 中 | 预留系统STT作为备选 |
| LLM响应延迟影响体验 | 高 | 中 | 本地预加载常见回复，流式渲染 |
| 口型同步不够自然 | 中 | 中 | 使用Azure音素数据，精细调参 |

---

## 12. 附录

### 12.1 参考资源
- [Live2D Cubism SDK Documentation](https://docs.live2d.com/cubism-sdk-manual/top/)
- [Capacitor Plugin Development](https://capacitorjs.com/docs/plugins)
- [Azure Speech Services REST API](https://docs.microsoft.com/azure/cognitive-services/speech-service/rest-speech-to-text)

### 12.2 模型资产
- 现有Yumi模型: `/agent-system/yumi/`
- 表情文件: `*.exp3.json`
- 物理配置: `*.physics3.json`

### 12.3 命名规范
- 分支: `feature/live2d-optimization`
- 提交: `feat: Add WASM physics engine`
- 文件: `avatar-controller.ts`, `lip-sync.ts`

---

## 审批记录

| 版本 | 日期 | 审批人 | 状态 |
|------|------|--------|------|
| 1.0 | 2026-03-27 | Spec Review | 已审核 |
