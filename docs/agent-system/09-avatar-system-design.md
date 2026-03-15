# 增强型 Agent 系统 - 虚拟形象系统设计文档

**版本**: v1.0
**日期**: 2026-03-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 设计目标

虚拟形象系统为用户提供可视化的 AI 交互界面，实现：

1. **情感可视化**: 通过表情、动作传递情感
2. **品牌个性化**: 定制化数字人形象
3. **多模态交互**: 语音+视觉的沉浸式体验
4. **场景适配**: 不同场景使用不同形象风格

### 1.2 形象类型

| 类型 | 描述 | 适用场景 |
|------|------|----------|
| **2D 卡通** | 二次元风格，轻量化 | 娱乐、教育 |
| **2.5D 写实** | 半写实风格 | 客服、营销 |
| **3D 数字人** | 三维模型，高精度 | 直播、演示 |
| **照片级** | 基于真人照片 | 高端服务 |

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         虚拟形象系统架构                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        渲染层 (Rendering)                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   2D渲染      │  │   3D渲染      │  │       视频合成           │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • Live2D    │  │ • WebGL     │  │ • 绿幕合成              │  │   │
│  │  │ • Spine     │  │ • Three.js  │  │ • 背景替换              │  │   │
│  │  │ • 序列帧    │  │ • Unity Web │  │ • 滤镜特效              │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        动画层 (Animation)                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   口型同步    │  │   表情驱动    │  │       动作控制           │  │   │
│  │  │  (Lip Sync)  │  │  (Expression)│  │   (Motion)               │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 音素识别   │  │ • 情绪映射   │  │ • 姿态库               │  │   │
│  │  │ • 口型曲线   │  │ • 混合变形   │  │ • 动作混合             │  │   │
│  │  │ • 平滑过渡   │  │ • 眨眼呼吸   │  │ • 物理模拟             │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        语音层 (Audio)                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │    TTS        │  │   语音克隆    │  │       音效处理           │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 情感TTS   │  │ • 声纹提取   │  │ • 降噪                 │  │   │
│  │  │ • 多语言    │  │ • 语音合成   │  │ • 音量均衡             │  │   │
│  │  │ • 语速调节  │  │ • 风格控制   │  │ • 混响                 │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        管理层 (Management)                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   形象管理    │  │   场景管理    │  │       会话管理           │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 模型上传   │  │ • 场景定义   │  │ • 状态保持             │  │   │
│  │  │ • 资源加载   │  │ • 形象匹配   │  │ • 实时同步             │  │   │
│  │  │ • 版本控制   │  │ • 切换策略   │  │ • 会话恢复             │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 | 技术选型 |
|------|------|----------|
| LipSyncEngine | 口型同步 | Wav2Lip / SadTalker |
| ExpressionController | 表情控制 | Blend Shape |
| MotionLibrary | 动作库 | Mixamo / 自研 |
| TTSService | 语音合成 | CosyVoice / Azure TTS |
| AvatarRenderer | 形象渲染 | WebGL / Live2D |
| SceneManager | 场景管理 | 自研 |

---

## 3. 口型同步 (Lip Sync)

### 3.1 技术方案

```typescript
interface LipSyncConfig {
  // 音素映射表
  phonemeMap: Record<string, Viseme>;

  // 平滑配置
  smoothing: {
    windowSize: number;         // 平滑窗口大小
    threshold: number;          // 触发阈值
  };

  // 口型强度
  intensity: number;            // 0-1

  // 延迟补偿
  latencyCompensation: number;  // ms
}

// 视素 (Visual Phoneme)
interface Viseme {
  id: string;
  blendShapes: Record<string, number>;  // 混合变形权重
  mouthOpenness: number;        // 嘴巴张开程度
  duration: number;             // 基础持续时间
}

// 音素到视素映射示例
const PHONEME_TO_VISEME: Record<string, string> = {
  // 元音
  'a': 'viseme_aa',
  'e': 'viseme_E',
  'i': 'viseme_I',
  'o': 'viseme_O',
  'u': 'viseme_U',

  // 辅音
  'p': 'viseme_PP',
  'b': 'viseme_PP',
  'm': 'viseme_PP',
  'f': 'viseme_FF',
  'v': 'viseme_FF',
  'th': 'viseme_TH',
  's': 'viseme_SS',
  'sh': 'viseme_CH',
  // ...
};
```

### 3.2 实现

```typescript
@Injectable()
export class LipSyncEngine {
  constructor(
    private audioAnalyzer: AudioAnalyzer,
    private visemeLibrary: VisemeLibrary
  ) {}

  async generateLipSyncData(
    audioBuffer: AudioBuffer,
    text: string
  ): Promise<LipSyncData> {
    // 1. 音频分析 - 提取音素时间戳
    const phonemes = await this.analyzeAudio(audioBuffer, text);

    // 2. 转换为视素序列
    const visemes: VisemeFrame[] = [];
    for (const phoneme of phonemes) {
      const visemeId = PHONEME_TO_VISEME[phoneme.symbol];
      if (visemeId) {
        visemes.push({
          visemeId,
          startTime: phoneme.startTime,
          endTime: phoneme.endTime,
          weight: phoneme.energy
        });
      }
    }

    // 3. 应用平滑
    const smoothed = this.applySmoothing(visemes);

    // 4. 生成混合变形权重曲线
    const blendShapeCurves = this.generateBlendShapeCurves(smoothed);

    return {
      duration: audioBuffer.duration,
      visemes: smoothed,
      blendShapeCurves,
      metadata: {
        sampleRate: audioBuffer.sampleRate,
        phonemeCount: phonemes.length
      }
    };
  }

  private applySmoothing(visemes: VisemeFrame[]): VisemeFrame[] {
    // 使用移动平均平滑
    const smoothed: VisemeFrame[] = [];
    const windowSize = 3;

    for (let i = 0; i < visemes.length; i++) {
      const window = visemes.slice(
        Math.max(0, i - Math.floor(windowSize / 2)),
        Math.min(visemes.length, i + Math.ceil(windowSize / 2))
      );

      const avgWeight = window.reduce((sum, v) => sum + v.weight, 0) / window.length;

      smoothed.push({
        ...visemes[i],
        weight: avgWeight
      });
    }

    return smoothed;
  }

  private generateBlendShapeCurves(
    visemes: VisemeFrame[]
  ): BlendShapeCurve[] {
    const curves: Map<string, number[]> = new Map();
    const fps = 30;
    const totalFrames = Math.ceil(visemes[visemes.length - 1]?.endTime * fps || 0);

    // 初始化曲线
    const blendShapeNames = Object.keys(
      this.visemeLibrary.getAllBlendShapes()
    );
    for (const name of blendShapeNames) {
      curves.set(name, new Array(totalFrames).fill(0));
    }

    // 填充数据
    for (const viseme of visemes) {
      const startFrame = Math.floor(viseme.startTime * fps);
      const endFrame = Math.ceil(viseme.endTime * fps);
      const visemeDef = this.visemeLibrary.getViseme(viseme.visemeId);

      for (let frame = startFrame; frame < endFrame; frame++) {
        const t = (frame / fps - viseme.startTime) /
                  (viseme.endTime - viseme.startTime);
        const easeT = this.easeInOut(t);

        for (const [shape, weight] of Object.entries(visemeDef.blendShapes)) {
          const curve = curves.get(shape)!;
          curve[frame] = Math.max(curve[frame], weight * viseme.weight * easeT);
        }
      }
    }

    return Array.from(curves.entries()).map(([name, values]) => ({
      name,
      values,
      fps
    }));
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
}
```

---

## 4. 形象管理

### 4.1 形象数据模型

```typescript
interface Avatar {
  avatarId: string;
  name: string;
  description?: string;

  // 形象类型
  type: '2d' | '2.5d' | '3d' | 'photo_realistic';

  // 外观配置
  appearance: {
    // 模型资源
    model: {
      format: 'live2d' | 'spine' | 'vrm' | 'fbx' | 'custom';
      url: string;
      thumbnailUrl: string;
      assets: Record<string, string>;  // 材质、贴图等
    };

    // 外观参数
    face?: {
      shape?: string;
      skinTone?: string;
      eyeColor?: string;
      hairStyle?: string;
      hairColor?: string;
    };

    clothing?: {
      style: string;
      colors: string[];
      accessories?: string[];
    };

    // 可变形部分配置
    blendShapes?: Record<string, BlendShapeConfig>;

    // 骨骼配置（3D）
    skeleton?: SkeletonConfig;
  };

  // 语音配置
  voice: {
    provider: 'cosyvoice' | 'azure' | 'elevenlabs' | 'custom';
    voiceId: string;
    settings: {
      pitch: number;              // 音调 0.5-2
      speed: number;              // 语速 0.5-2
      volume: number;             // 音量 0-1
      emotion?: string;           // 情感风格
    };
    // 自定义发音词典
    pronunciationDict?: Record<string, string>;
  };

  // 动画库
  animations: {
    idle: AnimationConfig[];      // 待机动画
    talking: AnimationConfig[];   // 说话动画
    gestures: AnimationConfig[];  // 手势动画
    emotions: Record<string, AnimationConfig>;  // 情感动画
    custom: AnimationConfig[];    // 自定义动画
  };

  // 表情配置
  expressions: {
    default: string;              // 默认表情
    map: Record<string, ExpressionConfig>;
  };

  // 适用场景
  suitableScenes: string[];

  // 权限配置
  permissions: {
    ownerId: string;
    visibility: 'private' | 'team' | 'public';
    allowedUsers?: string[];
    allowedRoles?: string[];
  };

  // 状态
  status: 'active' | 'inactive' | 'deprecated';
}

interface AnimationConfig {
  id: string;
  name: string;
  type: 'idle' | 'talking' | 'gesture' | 'emotion' | 'custom';

  // 资源
  source: {
    url: string;
    format: string;
    duration: number;
  };

  // 触发条件
  trigger: {
    type: 'auto' | 'manual' | 'event';
    conditions?: Record<string, any>;
  };

  // 播放配置
  playback: {
    loop: boolean;
    blendTime: number;            // 混合过渡时间
    priority: number;             // 优先级
  };

  // 权重曲线（用于动态混合）
  weightCurve?: number[];
}

interface ExpressionConfig {
  name: string;
  blendShapes: Record<string, number>;  // 混合变形权重
  duration?: number;                    // 保持时间
  transitionIn?: number;                // 进入过渡时间
  transitionOut?: number;               // 退出过渡时间
}
```

### 4.2 场景匹配

```typescript
@Injectable()
export class SceneMatcher {
  // 场景定义
  private sceneDefinitions: Record<string, SceneConfig> = {
    'customer_service': {
      name: '客服场景',
      preferredAvatars: ['professional_female', 'friendly_male'],
      voiceTone: 'professional',
      expression: 'friendly',
      gestures: ['welcome', 'listening', 'thinking']
    },
    'education': {
      name: '教育场景',
      preferredAvatars: ['teacher_female', 'scholar_male'],
      voiceTone: 'gentle',
      expression: 'encouraging',
      gestures: ['explaining', 'pointing', 'encouraging']
    },
    'entertainment': {
      name: '娱乐场景',
      preferredAvatars: ['cute_anime', 'cool_character'],
      voiceTone: 'energetic',
      expression: 'excited',
      gestures: ['dancing', 'celebrating', 'surprised']
    },
    'business': {
      name: '商务场景',
      preferredAvatars: ['business_formal', 'executive'],
      voiceTone: 'confident',
      expression: 'professional',
      gestures: ['presenting', 'handshake', 'confident']
    }
  };

  async matchAvatar(
    scene: string,
    userPreference?: string,
    emotion?: EmotionMetrics
  ): Promise<AvatarMatchResult> {
    const sceneConfig = this.sceneDefinitions[scene];
    if (!sceneConfig) {
      throw new UnknownSceneError(scene);
    }

    // 1. 获取场景推荐形象
    let candidates = await this.getAvatarsByTags(
      sceneConfig.preferredAvatars
    );

    // 2. 应用用户偏好
    if (userPreference) {
      const preferred = await this.getAvatar(userPreference);
      if (preferred && this.isSuitableForScene(preferred, scene)) {
        candidates = [preferred, ...candidates.filter(a => a.avatarId !== userPreference)];
      }
    }

    // 3. 应用情感适配
    if (emotion) {
      candidates = this.rankByEmotionFit(candidates, emotion);
    }

    // 4. 返回最佳匹配
    const selected = candidates[0];

    return {
      avatar: selected,
      sceneConfig,
      voiceSettings: this.adaptVoiceSettings(selected, sceneConfig, emotion),
      expression: this.selectExpression(selected, emotion),
      alternatives: candidates.slice(1, 4)
    };
  }

  private adaptVoiceSettings(
    avatar: Avatar,
    sceneConfig: SceneConfig,
    emotion?: EmotionMetrics
  ): VoiceSettings {
    const baseSettings = avatar.voice.settings;

    // 根据场景调整
    const sceneAdjustments = {
      'professional': { pitch: 1.0, speed: 0.95 },
      'gentle': { pitch: 1.05, speed: 0.9 },
      'energetic': { pitch: 1.1, speed: 1.05 },
      'confident': { pitch: 0.95, speed: 1.0 }
    };

    const adjustment = sceneAdjustments[sceneConfig.voiceTone] || {};

    // 根据情感调整
    const emotionAdjustment = this.getEmotionVoiceAdjustment(emotion);

    return {
      ...baseSettings,
      pitch: baseSettings.pitch * (adjustment.pitch || 1) * emotionAdjustment.pitch,
      speed: baseSettings.speed * (adjustment.speed || 1) * emotionAdjustment.speed,
      emotion: sceneConfig.voiceTone
    };
  }
}
```

---

## 5. API 接口

```typescript
// GET /api/v1/avatars
interface ListAvatarsRequest {
  type?: string;
  scene?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

// POST /api/v1/avatars/{avatarId}/render
interface RenderAvatarRequest {
  text: string;
  emotion?: string;
  animation?: string;
  scene?: string;
  outputFormat: 'video' | 'frames' | 'websocket';
}

interface RenderAvatarResponse {
  renderId: string;
  status: 'pending' | 'processing' | 'completed';
  outputUrl?: string;
  websocketUrl?: string;
  estimatedTime: number;
}

// POST /api/v1/avatar-sessions
interface CreateAvatarSessionRequest {
  avatarId: string;
  userId: string;
  scene?: string;
  enableRealtime?: boolean;
}

interface CreateAvatarSessionResponse {
  sessionId: string;
  websocketUrl: string;
  config: {
    avatar: Avatar;
    voiceSettings: VoiceSettings;
    renderSettings: RenderSettings;
  };
}

// WebSocket 消息
interface AvatarWebSocketMessage {
  type: 'speak' | 'expression' | 'gesture' | 'state';
  payload: {
    text?: string;
    emotion?: string;
    gesture?: string;
    audioChunk?: ArrayBuffer;
    blendShapeData?: BlendShapeFrame[];
  };
}
```

---

## 6. 附录

### 6.1 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-10 | 初始版本 |
