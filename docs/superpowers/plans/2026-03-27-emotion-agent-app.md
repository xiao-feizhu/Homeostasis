---
name: 情感Agent移动端App实施计划
description: Capacitor + Live2D Core + LLM驱动的情感Agent移动应用详细实施步骤
type: project
---

# 情感Agent App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile app with Live2D virtual avatar (Yumi), voice interaction, and LLM-driven emotional actions using Capacitor 6

**Architecture:** Three-layer architecture with Capacitor WebView for UI, Service Layer for business logic, and Native/External services for STT/TTS. Live2D Cubism 4 Core SDK with WebAssembly physics runs in the WebView.

**Tech Stack:** Capacitor 6, TypeScript, Live2D Cubism 4 Core SDK, Zustand, Socket.io-client, Azure TTS REST API

**Based on spec:** `docs/superpowers/specs/2026-03-27-emotion-agent-app-design.md`

---

## Project Structure

```
emotion-agent-app/
├── capacitor.config.ts
├── package.json
├── tsconfig.json
├── index.html
├── src/
│   ├── main.ts
│   ├── App.tsx
│   ├── features/
│   │   ├── avatar/
│   │   │   ├── AvatarService.ts      # Live2D controller
│   │   │   ├── LipSyncController.ts  # Viseme-based lip sync
│   │   │   ├── Live2DView.tsx        # React component
│   │   │   ├── useAvatar.ts          # Avatar state hook
│   │   │   ├── useLipSync.ts         # Lip sync hook
│   │   │   └── __tests__/
│   │   │       ├── AvatarService.test.ts
│   │   │       └── LipSyncController.test.ts
│   │   ├── speech/
│   │   │   ├── SpeechService.ts      # STT/TTS abstraction
│   │   │   ├── useSTT.ts             # Speech recognition hook
│   │   │   ├── useTTS.ts             # Speech synthesis hook
│   │   │   └── __tests__/
│   │   │       └── SpeechService.test.ts
│   │   └── agent/
│   │       ├── AgentService.ts       # WebSocket + LLM
│   │       ├── WebSocketManager.ts   # Connection management
│   │       ├── emotionActionMap.ts   # Emotion to action mapping
│   │       ├── useAgent.ts           # Agent state hook
│   │       └── __tests__/
│   │           ├── AgentService.test.ts
│   │           └── emotionActionMap.test.ts
│   ├── shared/
│   │   ├── store/
│   │   │   └── appStore.ts           # Zustand store
│   │   ├── types/
│   │   │   └── index.ts              # Shared type definitions
│   │   └── utils/
│   │       └── SmoothParam.ts        # Smooth parameter interpolation
│   └── assets/
│       └── live2d/                   # Yumi model files
├── ios/                              # iOS native project
├── android/                          # Android native project
└── tests/
    └── e2e/
```

---

## Phase 1: Project Setup & Dependencies

### Task 1: Initialize Capacitor Project

**Files:**
- Create: `emotion-agent-app/package.json`
- Create: `emotion-agent-app/tsconfig.json`
- Create: `emotion-agent-app/capacitor.config.ts`
- Create: `emotion-agent-app/index.html`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p emotion-agent-app && cd emotion-agent-app
npm init -y
```

- [ ] **Step 2: Install core dependencies**

```bash
npm install @capacitor/core@6 @capacitor/cli@6
npm install @capacitor/ios@6 @capacitor/android@6
npm install react@18 react-dom@18
npm install zustand socket.io-client
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react
```

- [ ] **Step 3: Create TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create Capacitor config**

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emotionagent.app',
  appName: 'EmotionAgent',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a2e',
    },
  },
};

export default config;
```

- [ ] **Step 5: Create Vite config**

```bash
npm install -D vite @vitejs/plugin-react
```

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
});
```

- [ ] **Step 6: Initialize iOS and Android platforms**

```bash
npx cap add ios
npx cap add android
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: Initialize Capacitor 6 project with React and TypeScript"
```

---

## Phase 2: Core Types and Utilities

### Task 2: Create Type Definitions

**Files:**
- Create: `emotion-agent-app/src/shared/types/index.ts`
- Test: `emotion-agent-app/src/shared/types/__tests__/types.test.ts`

- [ ] **Step 1: Write type validation test**

```typescript
// src/shared/types/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import type { ExpressionType, EmotionType, Phoneme, AgentActionResponse } from '../index';

describe('Type definitions', () => {
  it('should validate ExpressionType', () => {
    const expr: ExpressionType = 'HEART_EYES';
    expect(expr).toBe('HEART_EYES');
  });

  it('should validate EmotionType', () => {
    const emotion: EmotionType = 'happy';
    expect(emotion).toBe('happy');
  });

  it('should validate Phoneme type', () => {
    const phoneme: Phoneme = 'a';
    expect(['a', 'i', 'u', 'e', 'o', 'n', 'sil']).toContain(phoneme);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm install -D vitest
npx vitest run src/shared/types/__tests__/types.test.ts
```

Expected: FAIL - Module not found

- [ ] **Step 3: Create type definitions**

```typescript
// src/shared/types/index.ts

// Expression types (must match exp3.json files in model)
export type ExpressionType =
  | 'HEART_EYES'
  | 'BLACK_FACE'
  | 'TEARY_EYES'
  | 'STAR_EYES'
  | 'CAT_MOUTH'
  | 'HOLD_MIC'
  | 'BLUSH'
  | 'NEUTRAL';

// Gesture types
export type GestureType =
  | 'WAVE'
  | 'POINT'
  | 'CHIN_RUB'
  | 'CLAP'
  | 'SHRUG'
  | 'SELF_HUG'
  | 'PEACE_SIGN'
  | 'THUMBS_UP';

// Emotion types
export type EmotionType =
  | 'happy'
  | 'sad'
  | 'excited'
  | 'thinking'
  | 'angry'
  | 'playful'
  | 'neutral';

// Phoneme types for lip sync
export type Phoneme = 'a' | 'i' | 'u' | 'e' | 'o' | 'n' | 'sil';

// Phoneme data with timing
export interface PhonemeData {
  phoneme: Phoneme;
  offset: number;     // ms from start
  duration: number;   // ms
}

// Lip shape parameters
export interface LipShape {
  open: number;   // 0-1 mouth openness
  wide: number;   // 0-1 mouth width
}

// Head pose parameters
export interface HeadPose {
  tilt: number;      // -30 to 30 degrees (left/right tilt)
  turn: number;      // -45 to 45 degrees (horizontal turn)
  nodSpeed?: number; // nod frequency
}

// Body posture parameters
export interface BodyPosture {
  lean: number;        // 0-1 forward lean
  shift: number;       // -1 to 1 left/right shift
  breathingRate?: number;
}

// Action configuration from emotion mapping
export interface ActionConfig {
  expression: ExpressionType;
  head?: {
    tilt?: number;
    nodSpeed?: number;
    slowSway?: boolean;
    shake?: 'rapid' | 'emphatic';
    droop?: boolean;
  };
  gesture?: {
    name: GestureType;
    trigger?: 'emphasis' | 'keyword' | 'random';
    loop?: boolean;
    hold?: number;
  };
  body?: {
    lean?: number;
    bounce?: boolean | { freq: number };
    jump?: boolean;
    sink?: boolean;
    tense?: boolean;
  };
}

// Agent action response from LLM
export interface AgentActionResponse {
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
      triggerAt: number;
      duration: number;
    };
    body?: {
      lean: number;
      bounce?: { freq: number; amp: number };
    };
  };
  syncPoints: Array<{
    wordIndex: number;
    action: 'gesture_emphasis' | 'head_nod' | 'expression_change';
  }>;
  lipSync: Array<{
    time: number;
    phoneme: string;
    intensity: number;
  }>;
}

// Message in conversation
export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  emotion?: EmotionType;
  timestamp: number;
  audioUrl?: string;
}

// Action strategy types
export type ActionStrategy = 'minimal' | 'gesture_assisted' | 'expressive' | 'dramatic';

// LLM Provider type
export type LLMProvider = 'kimi' | 'claude' | 'openai';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/types/__tests__/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/
git commit -m "feat: Add core TypeScript type definitions"
```

---

### Task 3: Create SmoothParam Utility

**Files:**
- Create: `emotion-agent-app/src/shared/utils/SmoothParam.ts`
- Test: `emotion-agent-app/src/shared/utils/__tests__/SmoothParam.test.ts`

- [ ] **Step 1: Write SmoothParam test**

```typescript
// src/shared/utils/__tests__/SmoothParam.test.ts
import { describe, it, expect } from 'vitest';
import { SmoothParam } from '../SmoothParam';

describe('SmoothParam', () => {
  it('should initialize with default value 0', () => {
    const param = new SmoothParam();
    expect(param.getCurrent()).toBe(0);
  });

  it('should set target value', () => {
    const param = new SmoothParam();
    param.setTarget(1.0);
    expect(param.getTarget()).toBe(1.0);
  });

  it('should smoothly interpolate towards target', () => {
    const param = new SmoothParam(0.1);
    param.setTarget(1.0);

    const value1 = param.update(16); // 16ms
    expect(value1).toBeGreaterThan(0);
    expect(value1).toBeLessThan(1.0);

    // Multiple updates should approach target
    let value = value1;
    for (let i = 0; i < 100; i++) {
      value = param.update(16);
    }
    expect(value).toBeGreaterThan(0.99);
  });

  it('should use custom smooth factor', () => {
    const fastParam = new SmoothParam(0.05); // Faster
    const slowParam = new SmoothParam(0.2);  // Slower

    fastParam.setTarget(1.0);
    slowParam.setTarget(1.0);

    const fastValue = fastParam.update(16);
    const slowValue = slowParam.update(16);

    expect(fastValue).toBeGreaterThan(slowValue);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/utils/__tests__/SmoothParam.test.ts
```

Expected: FAIL - Module not found

- [ ] **Step 3: Implement SmoothParam class**

```typescript
// src/shared/utils/SmoothParam.ts

/**
 * Smooth parameter interpolation using exponential easing
 * For smooth transitions between animation values
 */
export class SmoothParam {
  private current: number = 0;
  private target: number = 0;
  private smoothFactor: number;

  /**
   * @param smoothFactor - Time constant in seconds (default 0.1 = 100ms)
   *                       Lower = faster response, Higher = smoother
   */
  constructor(smoothFactor: number = 0.1) {
    this.smoothFactor = smoothFactor;
  }

  /**
   * Set the target value to interpolate towards
   */
  setTarget(value: number): void {
    this.target = Math.max(0, Math.min(1, value));
  }

  /**
   * Get current target value
   */
  getTarget(): number {
    return this.target;
  }

  /**
   * Get current interpolated value
   */
  getCurrent(): number {
    return this.current;
  }

  /**
   * Update interpolation and return new current value
   * @param deltaTime - Time since last update in milliseconds
   * @returns Current interpolated value
   */
  update(deltaTime: number): number {
    // Convert deltaTime to seconds for calculation
    const dt = deltaTime / 1000;

    // Exponential easing: y = y0 + (y1 - y0) * (1 - e^(-t/τ))
    const t = 1 - Math.exp(-dt / this.smoothFactor);
    this.current += (this.target - this.current) * t;

    return this.current;
  }

  /**
   * Reset to a specific value (no interpolation)
   */
  reset(value: number): void {
    this.current = value;
    this.target = value;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/utils/__tests__/SmoothParam.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/
git commit -m "feat: Add SmoothParam utility for animation interpolation"
```

---

## Phase 3: Avatar Service (Live2D Controller)

### Task 4: Create Emotion Action Map

**Files:**
- Create: `emotion-agent-app/src/features/agent/emotionActionMap.ts`
- Test: `emotion-agent-app/src/features/agent/__tests__/emotionActionMap.test.ts`

- [ ] **Step 1: Write emotion action map test**

```typescript
// src/features/agent/__tests__/emotionActionMap.test.ts
import { describe, it, expect } from 'vitest';
import { emotionActionMap, determineComplexity } from '../emotionActionMap';
import type { EmotionType } from '@/shared/types';

describe('emotionActionMap', () => {
  it('should have all emotion types defined', () => {
    const emotions: EmotionType[] = ['happy', 'sad', 'excited', 'thinking', 'angry', 'playful', 'neutral'];
    emotions.forEach(emotion => {
      expect(emotionActionMap[emotion]).toBeDefined();
    });
  });

  it('should return correct action config for happy emotion', () => {
    const config = emotionActionMap.happy;
    expect(config.expression).toBe('HEART_EYES');
    expect(config.gesture?.name).toBe('CLAP');
  });

  it('should return correct action config for thinking emotion', () => {
    const config = emotionActionMap.thinking;
    expect(config.expression).toBe('NEUTRAL');
    expect(config.gesture?.name).toBe('CHIN_RUB');
  });
});

describe('determineComplexity', () => {
  it('should return minimal for short text', () => {
    expect(determineComplexity('你好', 0.5)).toBe('minimal');
  });

  it('should return dramatic for high emotion intensity', () => {
    expect(determineComplexity('任何文字', 0.9)).toBe('dramatic');
  });

  it('should return expressive for long text with punctuation', () => {
    expect(determineComplexity('这是一个很长的句子，带标点。', 0.5)).toBe('expressive');
  });

  it('should return expressive for emphasis words', () => {
    expect(determineComplexity('真的太棒了！', 0.5)).toBe('expressive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/agent/__tests__/emotionActionMap.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement emotion action map**

```typescript
// src/features/agent/emotionActionMap.ts
import type { EmotionType, ActionConfig } from '@/shared/types';

/**
 * Maps emotion types to their corresponding action configurations
 * Used by LLM-driven action system
 */
export const emotionActionMap: Record<EmotionType, ActionConfig> = {
  happy: {
    expression: 'HEART_EYES',
    head: { tilt: -10, nodSpeed: 1.5 },
    gesture: { name: 'CLAP', trigger: 'emphasis' },
    body: { lean: 0.2, bounce: true }
  },
  sad: {
    expression: 'TEARY_EYES',
    head: { tilt: 10, droop: true },
    gesture: { name: 'SELF_HUG', loop: true },
    body: { lean: -0.1, sink: true }
  },
  excited: {
    expression: 'STAR_EYES',
    head: { shake: 'rapid' },
    gesture: { name: 'WAVE', hold: 1000 },
    body: { jump: true, lean: 0.3 }
  },
  thinking: {
    expression: 'NEUTRAL',
    head: { tilt: 15, slowSway: true },
    gesture: { name: 'CHIN_RUB', loop: true },
    body: { lean: 0.1 }
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
  },
  neutral: {
    expression: 'NEUTRAL',
    head: { nodSpeed: 0.5 },
    body: { lean: 0 }
  }
};

// Action strategy types
export type ActionStrategy = 'minimal' | 'gesture_assisted' | 'expressive' | 'dramatic';

/**
 * Determines action strategy based on content complexity and emotion
 * @param text - The text content to analyze
 * @param emotionIntensity - Emotion intensity 0-1
 * @returns Action strategy to use
 */
export function determineComplexity(
  text: string,
  emotionIntensity: number
): ActionStrategy {
  const wordCount = text.length; // Chinese character count
  const hasPunctuation = /[！。？]/.test(text);
  const hasEmphasis = /(真的|特别|非常|超级)/.test(text);

  if (emotionIntensity > 0.8) return 'dramatic';
  if (wordCount < 5 && !hasPunctuation) return 'minimal';
  if (hasEmphasis || (wordCount > 15 && hasPunctuation)) return 'expressive';
  return 'gesture_assisted';
}

/**
 * Gets intensity level based on emotion intensity value
 * @param intensity - 0-1 emotion intensity
 * @returns Intensity level description
 */
export function getIntensityLevel(intensity: number): 'calm' | 'gentle' | 'active' | 'intense' {
  if (intensity < 0.3) return 'calm';
  if (intensity < 0.6) return 'gentle';
  if (intensity < 0.8) return 'active';
  return 'intense';
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/agent/__tests__/emotionActionMap.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/agent/
git commit -m "feat: Add emotion-to-action mapping system"
```

---

### Task 5: Create LipSyncController

**Files:**
- Create: `emotion-agent-app/src/features/avatar/LipSyncController.ts`
- Test: `emotion-agent-app/src/features/avatar/__tests__/LipSyncController.test.ts`

- [ ] **Step 1: Write LipSyncController test**

```typescript
// src/features/avatar/__tests__/LipSyncController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LipSyncController } from '../LipSyncController';
import type { PhonemeData } from '@/shared/types';

describe('LipSyncController', () => {
  let controller: LipSyncController;
  let mockSetParam: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetParam = vi.fn();
    controller = new LipSyncController(mockSetParam);
  });

  it('should initialize with closed mouth', () => {
    controller.update(0);
    expect(mockSetParam).toHaveBeenCalledWith('ParamMouthOpenY', expect.any(Number));
  });

  it('should set phoneme data correctly', () => {
    const phonemes: PhonemeData[] = [
      { phoneme: 'a', offset: 0, duration: 100 },
      { phoneme: 'i', offset: 100, duration: 100 }
    ];
    controller.setPhonemeData(phonemes, performance.now());
    expect(controller.getPhonemeCount()).toBe(2);
  });

  it('should return correct lip shape for phoneme "a"', () => {
    const shape = controller.getLipShapeForPhoneme('a');
    expect(shape.open).toBe(1.0);
    expect(shape.wide).toBe(0.8);
  });

  it('should return closed mouth for silence', () => {
    const shape = controller.getLipShapeForPhoneme('sil');
    expect(shape.open).toBe(0);
  });

  it('should map viseme ID to phoneme correctly', () => {
    expect(controller.visemeToPhoneme(0)).toBe('sil');
    expect(controller.visemeToPhoneme(1)).toBe('a');
    expect(controller.visemeToPhoneme(3)).toBe('i');
    expect(controller.visemeToPhoneme(4)).toBe('u');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/avatar/__tests__/LipSyncController.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement LipSyncController**

```typescript
// src/features/avatar/LipSyncController.ts
import type { PhonemeData, Phoneme, LipShape } from '@/shared/types';
import { SmoothParam } from '@/shared/utils/SmoothParam';

/**
 * Maps phonemes to lip shapes for mouth animation
 */
const phonemeToLipShape: Record<Phoneme, LipShape> = {
  'a': { open: 1.0, wide: 0.8 },  // "啊" - wide open
  'i': { open: 0.2, wide: 1.0 },  // "衣" - wide smile
  'u': { open: 0.2, wide: 0.3 },  // "乌" - pursed
  'e': { open: 0.5, wide: 0.8 },  // "诶" - half open
  'o': { open: 0.6, wide: 0.6 },  // "哦" - round
  'n': { open: 0.1, wide: 0.5 },  // "嗯" - slightly open
  'sil': { open: 0, wide: 0.5 },  // silence - closed
};

/**
 * Azure TTS viseme to phoneme mapping
 * Reference: https://docs.microsoft.com/azure/cognitive-services/speech-service/speech-synthesis-markup#viseme-element
 */
const visemeToPhonemeMap: Record<number, Phoneme> = {
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

/**
 * Controls lip synchronization based on phoneme timing data
 */
export class LipSyncController {
  private phonemes: PhonemeData[] = [];
  private startTime: number = 0;
  private smoothOpen = new SmoothParam(0.05); // 50ms smoothing
  private smoothWide = new SmoothParam(0.05);
  private setParam: (param: string, value: number) => void;

  constructor(setParamCallback: (param: string, value: number) => void) {
    this.setParam = setParamCallback;
  }

  /**
   * Set phoneme timing data from Azure TTS viseme output
   * @param data - Array of phoneme timing data
   * @param startTime - Audio playback start timestamp
   */
  setPhonemeData(data: PhonemeData[], startTime: number): void {
    this.phonemes = data;
    this.startTime = startTime;
  }

  /**
   * Get number of phonemes in current sequence
   */
  getPhonemeCount(): number {
    return this.phonemes.length;
  }

  /**
   * Convert Azure viseme ID to phoneme
   */
  visemeToPhoneme(visemeId: number): Phoneme {
    return visemeToPhonemeMap[visemeId] || 'sil';
  }

  /**
   * Get lip shape for a specific phoneme
   */
  getLipShapeForPhoneme(phoneme: Phoneme): LipShape {
    return phonemeToLipShape[phoneme] || { open: 0, wide: 0.5 };
  }

  /**
   * Update lip sync based on current audio position
   * Call this every animation frame during speech
   * @param currentTime - Current timestamp (performance.now())
   */
  update(currentTime: number): void {
    const elapsed = currentTime - this.startTime;

    // Find current phoneme based on timing
    const current = this.phonemes.find(
      p => elapsed >= p.offset && elapsed < p.offset + p.duration
    );

    let targetOpen = 0;
    let targetWide = 0.5;

    if (current && current.phoneme !== 'sil') {
      const shape = this.getLipShapeForPhoneme(current.phoneme);
      targetOpen = shape.open;
      targetWide = shape.wide;

      // Add subtle jitter for natural speech effect
      const jitter = Math.sin(elapsed * 0.02) * 0.05;
      targetOpen += jitter;
    }

    // Apply smoothing
    this.smoothOpen.setTarget(targetOpen);
    this.smoothWide.setTarget(targetWide);

    const smoothedOpen = this.smoothOpen.update(16); // Assume 16ms frame
    const smoothedWide = this.smoothWide.update(16);

    // Apply to Live2D model parameters
    this.setParam('ParamMouthOpenY', Math.max(0, Math.min(1, smoothedOpen)));
    this.setParam('ParamMouthForm', (smoothedWide - 0.5) * 2); // Convert to -1 to 1 range
  }

  /**
   * Reset lip sync to closed mouth
   */
  reset(): void {
    this.smoothOpen.reset(0);
    this.smoothWide.reset(0.5);
    this.setParam('ParamMouthOpenY', 0);
    this.setParam('ParamMouthForm', 0);
    this.phonemes = [];
  }

  /**
   * Check if lip sync is active (has phoneme data)
   */
  isActive(): boolean {
    return this.phonemes.length > 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/avatar/__tests__/LipSyncController.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/avatar/__tests__/ src/features/avatar/LipSyncController.ts
git commit -m "feat: Add LipSyncController for viseme-based mouth animation"
```

---

### Task 6: Create AvatarService

**Files:**
- Create: `emotion-agent-app/src/features/avatar/AvatarService.ts`
- Test: `emotion-agent-app/src/features/avatar/__tests__/AvatarService.test.ts`

- [ ] **Step 1: Write AvatarService test**

```typescript
// src/features/avatar/__tests__/AvatarService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvatarService } from '../AvatarService';
import type { ExpressionType, GestureType } from '@/shared/types';

describe('AvatarService', () => {
  let service: AvatarService;
  let mockModel: {
    setExpression: ReturnType<typeof vi.fn>;
    setParamValue: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockModel = {
      setExpression: vi.fn(),
      setParamValue: vi.fn(),
    };
    service = new AvatarService();
    service.setModel(mockModel as any);
  });

  it('should set expression with fade', async () => {
    service.setExpression('HEART_EYES', 1.0, 200);
    expect(mockModel.setExpression).toHaveBeenCalledWith('HEART_EYES');
  });

  it('should set head pose parameters', () => {
    service.setHeadPose({ tilt: 15, turn: 30 });
    expect(mockModel.setParamValue).toHaveBeenCalledWith('ParamAngleX', 30);
    expect(mockModel.setParamValue).toHaveBeenCalledWith('ParamAngleY', 15);
  });

  it('should set body posture', () => {
    service.setBodyPosture({ lean: 0.5, shift: 0.3 });
    expect(mockModel.setParamValue).toHaveBeenCalled();
  });

  it('should track current expression', () => {
    service.setExpression('STAR_EYES', 1.0);
    expect(service.getCurrentExpression()).toBe('STAR_EYES');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/avatar/__tests__/AvatarService.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement AvatarService**

```typescript
// src/features/avatar/AvatarService.ts
import type {
  ExpressionType,
  GestureType,
  HeadPose,
  BodyPosture,
  EmotionType,
  ActionConfig
} from '@/shared/types';
import { SmoothParam } from '@/shared/utils/SmoothParam';
import { emotionActionMap } from '@/features/agent/emotionActionMap';

/**
 * Live2D model interface (minimal for type safety)
 */
interface Live2DModel {
  setExpression(expressionId: string): void;
  setParamValue(paramId: string, value: number): void;
  getParamValue(paramId: string): number;
}

/**
 * Action queue item for prioritized execution
 */
interface ActionQueueItem {
  id: string;
  type: 'expression' | 'gesture' | 'head' | 'body';
  priority: 'emergency' | 'emotion' | 'gesture' | 'ambient';
  execute: () => void;
  duration: number;
}

/**
 * Central service for controlling Live2D avatar
 * Manages expressions, gestures, head pose, body posture, and lip sync
 */
export class AvatarService {
  private model: Live2DModel | null = null;
  private currentExpression: ExpressionType = 'NEUTRAL';
  private currentGesture: GestureType | null = null;

  // Smooth parameter controllers
  private headTilt = new SmoothParam(0.1);
  private headTurn = new SmoothParam(0.1);
  private bodyLean = new SmoothParam(0.15);
  private bodyShift = new SmoothParam(0.15);

  // Action queue
  private actionQueue: ActionQueueItem[] = [];
  private currentAction: ActionQueueItem | null = null;

  /**
   * Set the Live2D model instance
   */
  setModel(model: Live2DModel): void {
    this.model = model;
  }

  /**
   * Get current expression
   */
  getCurrentExpression(): ExpressionType {
    return this.currentExpression;
  }

  /**
   * Set facial expression with optional fade
   * @param expression - Expression type
   * @param intensity - 0-1 expression intensity
   * @param blendTime - Fade duration in ms
   */
  setExpression(
    expression: ExpressionType,
    intensity: number = 1.0,
    blendTime: number = 200
  ): void {
    if (!this.model) return;

    this.currentExpression = expression;

    // Live2D Cubism handles expression blending internally
    // We just trigger the expression change
    this.model.setExpression(expression);

    // Log for debugging
    console.log(`[Avatar] Expression: ${expression}, intensity: ${intensity}, blend: ${blendTime}ms`);
  }

  /**
   * Set head pose (tilt and turn)
   */
  setHeadPose(params: HeadPose): void {
    this.headTilt.setTarget(params.tilt / 30); // Normalize -30~30 to -1~1
    this.headTurn.setTarget(params.turn / 45); // Normalize -45~45 to -1~1
  }

  /**
   * Set body posture
   */
  setBodyPosture(params: BodyPosture): void {
    this.bodyLean.setTarget(params.lean);
    this.bodyShift.setTarget(params.shift);
  }

  /**
   * Play a gesture animation
   * @param gesture - Gesture type
   * @param options - Gesture options
   */
  playGesture(
    gesture: GestureType,
    options: {
      triggerAt?: number;
      duration?: number;
      loop?: boolean;
    } = {}
  ): void {
    if (!this.model) return;

    this.currentGesture = gesture;

    // Map gestures to Live2D parameters
    const gestureMap: Record<GestureType, Record<string, number>> = {
      'WAVE': { 'ParamArmLA': 1, 'ParamHandL': 0.5 },
      'POINT': { 'ParamArmRA': 0.8, 'ParamHandR': 1 },
      'CHIN_RUB': { 'ParamArmRA': 0.5, 'ParamHandR': 0.3 },
      'CLAP': { 'ParamArmLA': 0.8, 'ParamArmRA': 0.8 },
      'SHRUG': { 'ParamShoulderL': 1, 'ParamShoulderR': 1 },
      'SELF_HUG': { 'ParamArmLA': 0.6, 'ParamArmRA': 0.6 },
      'PEACE_SIGN': { 'ParamArmRA': 0.7, 'ParamHandR': 0.8 },
      'THUMBS_UP': { 'ParamArmRA': 0.9, 'ParamHandR': 1 },
    };

    const params = gestureMap[gesture];
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        this.model!.setParamValue(param, value);
      });
    }

    console.log(`[Avatar] Gesture: ${gesture}, duration: ${options.duration || 1000}ms`);
  }

  /**
   * Apply emotion-based action configuration
   */
  applyEmotionAction(emotion: EmotionType, intensity: number): void {
    const config = emotionActionMap[emotion];
    if (!config) return;

    // Set expression
    this.setExpression(config.expression, intensity);

    // Set head pose if defined
    if (config.head) {
      this.setHeadPose({
        tilt: config.head.tilt || 0,
        turn: 0,
        nodSpeed: config.head.nodSpeed,
      });
    }

    // Play gesture if defined
    if (config.gesture) {
      this.playGesture(config.gesture.name, {
        duration: config.gesture.hold,
        loop: config.gesture.loop,
      });
    }

    // Set body posture if defined
    if (config.body) {
      this.setBodyPosture({
        lean: config.body.lean || 0,
        shift: 0,
      });
    }
  }

  /**
   * Update animation frame
   * Call this in requestAnimationFrame loop
   * @param deltaTime - Time since last frame in ms
   */
  update(deltaTime: number): void {
    if (!this.model) return;

    // Update smooth parameters
    const tilt = this.headTilt.update(deltaTime) * 30;  // Denormalize
    const turn = this.headTurn.update(deltaTime) * 45;
    const lean = this.bodyLean.update(deltaTime);
    const shift = this.bodyShift.update(deltaTime);

    // Apply to model
    this.model.setParamValue('ParamAngleX', turn);
    this.model.setParamValue('ParamAngleY', tilt);
    this.model.setParamValue('ParamBodyAngleX', shift * 10);
    this.model.setParamValue('ParamBodyAngleY', lean * 10);
  }

  /**
   * Reset avatar to neutral state
   */
  reset(): void {
    this.setExpression('NEUTRAL');
    this.setHeadPose({ tilt: 0, turn: 0 });
    this.setBodyPosture({ lean: 0, shift: 0 });
    this.currentGesture = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/avatar/__tests__/AvatarService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/avatar/
git commit -m "feat: Add AvatarService for Live2D model control"
```

---

## Phase 4: Speech Service (STT/TTS)

### Task 7: Create SpeechService

**Files:**
- Create: `emotion-agent-app/src/features/speech/SpeechService.ts`
- Test: `emotion-agent-app/src/features/speech/__tests__/SpeechService.test.ts`

- [ ] **Step 1: Write SpeechService test**

```typescript
// src/features/speech/__tests__/SpeechService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechService } from '../SpeechService';

describe('SpeechService', () => {
  let service: SpeechService;

  beforeEach(() => {
    service = new SpeechService({
      azureKey: 'test-key',
      azureRegion: 'eastasia',
    });
  });

  it('should initialize with config', () => {
    expect(service.isRecording()).toBe(false);
    expect(service.isPlaying()).toBe(false);
  });

  it('should map viseme to phoneme', () => {
    expect(service.visemeToPhoneme(0)).toBe('sil');
    expect(service.visemeToPhoneme(1)).toBe('a');
    expect(service.visemeToPhoneme(3)).toBe('i');
  });

  it('should validate Azure configuration', () => {
    const invalidService = new SpeechService({});
    expect(() => invalidService.validateConfig()).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/speech/__tests__/SpeechService.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement SpeechService**

```typescript
// src/features/speech/SpeechService.ts
import type { PhonemeData, Phoneme, LLMProvider } from '@/shared/types';

/**
 * Speech service configuration
 */
interface SpeechServiceConfig {
  azureKey?: string;
  azureRegion?: string;
  voiceName?: string;
}

/**
 * Azure TTS viseme response
 */
interface VisemeData {
  visemeId: number;
  audioOffset: number; // in ticks (100 nanoseconds)
}

/**
 * Service for Speech-to-Text and Text-to-Speech
 * Uses native STT (Capacitor plugin) and Azure TTS REST API
 */
export class SpeechService {
  private config: SpeechServiceConfig;
  private isRec = false;
  private isPlay = false;
  private audioContext: AudioContext | null = null;
  private onPhonemeCallback: ((data: PhonemeData[]) => void) | null = null;
  private onTranscriptCallback: ((text: string) => void) | null = null;

  constructor(config: SpeechServiceConfig = {}) {
    this.config = {
      voiceName: 'zh-CN-XiaoxiaoNeural',
      ...config,
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(): void {
    if (!this.config.azureKey || !this.config.azureRegion) {
      throw new Error('Azure Speech configuration required');
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.isRec;
  }

  /**
   * Check if currently playing audio
   */
  isPlaying(): boolean {
    return this.isPlay;
  }

  /**
   * Set callback for phoneme data (for lip sync)
   */
  onPhoneme(callback: (data: PhonemeData[]) => void): void {
    this.onPhonemeCallback = callback;
  }

  /**
   * Set callback for speech recognition transcript
   */
  onTranscript(callback: (text: string) => void): void {
    this.onTranscriptCallback = callback;
  }

  /**
   * Convert Azure viseme ID to phoneme
   */
  visemeToPhoneme(visemeId: number): Phoneme {
    const map: Record<number, Phoneme> = {
      0: 'sil', 1: 'a', 2: 'a', 3: 'i', 4: 'u', 5: 'e', 6: 'o',
      7: 'u', 8: 'n', 9: 'n', 10: 'n', 11: 'i', 12: 'n',
      13: 'i', 14: 'n', 15: 'a', 16: 'i',
    };
    return map[visemeId] || 'sil';
  }

  /**
   * Start speech recognition (STT)
   * Uses native Capacitor plugin
   */
  async startRecording(): Promise<void> {
    this.isRec = true;
    // TODO: Integrate with Capacitor Speech Recognition plugin
    console.log('[Speech] Started recording');
  }

  /**
   * Stop speech recognition
   */
  async stopRecording(): Promise<string> {
    this.isRec = false;
    console.log('[Speech] Stopped recording');
    return '';
  }

  /**
   * Synthesize speech using Azure TTS
   * @param text - Text to speak
   * @returns Audio blob and phoneme data
   */
  async synthesize(text: string): Promise<{
    audio: Blob;
    phonemes: PhonemeData[];
  }> {
    this.validateConfig();

    const ssml = this.buildSSML(text);
    const response = await this.callAzureTTS(ssml);

    this.isPlay = true;

    return {
      audio: response.audio,
      phonemes: response.phonemes,
    };
  }

  /**
   * Build SSML for Azure TTS
   */
  private buildSSML(text: string): string {
    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
             xmlns:mstts="https://www.w3.org/2001/mstts"
             xml:lang="zh-CN">
        <voice name="${this.config.voiceName}">
          <mstts:viseme type="redlips_front"/>
          ${text}
        </voice>
      </speak>
    `;
  }

  /**
   * Call Azure TTS REST API
   */
  private async callAzureTTS(ssml: string): Promise<{
    audio: Blob;
    phonemes: PhonemeData[];
  }> {
    const url = `https://${this.config.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.config.azureKey!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3',
        'Viseme-ID': 'true',
      },
      body: ssml,
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }

    // Parse viseme headers
    const visemeHeader = response.headers.get('Viseme-IDs');
    const phonemes = this.parseVisemeData(visemeHeader);

    const audio = await response.blob();

    return { audio, phonemes };
  }

  /**
   * Parse Azure viseme header to phoneme data
   */
  private parseVisemeData(visemeHeader: string | null): PhonemeData[] {
    if (!visemeHeader) return [];

    try {
      const visemes: VisemeData[] = JSON.parse(visemeHeader);

      return visemes.map((v, index, array) => {
        const nextOffset = array[index + 1]?.audioOffset || v.audioOffset + 10000000;
        return {
          phoneme: this.visemeToPhoneme(v.visemeId),
          offset: v.audioOffset / 10000, // Convert ticks to ms
          duration: (nextOffset - v.audioOffset) / 10000,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Stop audio playback
   */
  stopPlayback(): void {
    this.isPlay = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/speech/__tests__/SpeechService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/speech/
git commit -m "feat: Add SpeechService for STT/TTS with Azure integration"
```

---

## Phase 5: Agent Service (WebSocket + LLM)

### Task 8: Create WebSocketManager

**Files:**
- Create: `emotion-agent-app/src/features/agent/WebSocketManager.ts`
- Test: `emotion-agent-app/src/features/agent/__tests__/WebSocketManager.test.ts`

- [ ] **Step 1: Write WebSocketManager test**

```typescript
// src/features/agent/__tests__/WebSocketManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketManager } from '../WebSocketManager';

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager;

  beforeEach(() => {
    wsManager = new WebSocketManager('ws://localhost:3000');
  });

  it('should initialize in disconnected state', () => {
    expect(wsManager.isConnected()).toBe(false);
  });

  it('should register event handlers', () => {
    const handler = vi.fn();
    wsManager.on('message', handler);
    expect(wsManager.hasHandler('message')).toBe(true);
  });

  it('should track reconnection attempts', () => {
    expect(wsManager.getReconnectAttempts()).toBe(0);
  });

  it('should build connection URL with params', () => {
    const url = wsManager.buildUrl({ sessionId: 'test-123' });
    expect(url).toBe('ws://localhost:3000?sessionId=test-123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/agent/__tests__/WebSocketManager.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement WebSocketManager**

```typescript
// src/features/agent/WebSocketManager.ts

type EventHandler = (data: any) => void;

/**
 * WebSocket connection manager with auto-reconnect
 */
export class WebSocketManager {
  private url: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current reconnection attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Check if event handler exists
   */
  hasHandler(event: string): boolean {
    return this.eventHandlers.has(event) &&
           (this.eventHandlers.get(event)?.length || 0) > 0;
  }

  /**
   * Build connection URL with query params
   */
  buildUrl(params: Record<string, string>): string {
    const query = new URLSearchParams(params).toString();
    return query ? `${this.url}?${query}` : this.url;
  }

  /**
   * Register event handler
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(params: Record<string, string> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const fullUrl = this.buildUrl(params);
        this.ws = new WebSocket(fullUrl);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', null);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit('message', data);

            // Emit specific event types
            if (data.type) {
              this.emit(data.type, data);
            }
          } catch {
            this.emit('message', event.data);
          }
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit('disconnected', null);
          this.attemptReconnect(params);
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(params: Record<string, string>): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed', null);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect(params);
    }, delay);
  }

  /**
   * Send message to server
   */
  send(data: any): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(data));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.reconnectAttempts = 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/agent/__tests__/WebSocketManager.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/agent/WebSocketManager.ts src/features/agent/__tests__/WebSocketManager.test.ts
git commit -m "feat: Add WebSocketManager with auto-reconnect"
```

---

### Task 9: Create AgentService

**Files:**
- Create: `emotion-agent-app/src/features/agent/AgentService.ts`
- Test: `emotion-agent-app/src/features/agent/__tests__/AgentService.test.ts`

- [ ] **Step 1: Write AgentService test**

```typescript
// src/features/agent/__tests__/AgentService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../AgentService';
import type { LLMProvider, EmotionType } from '@/shared/types';

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService({
      serverUrl: 'ws://localhost:3000',
      provider: 'kimi',
    });
  });

  it('should initialize with default provider', () => {
    expect(service.getProvider()).toBe('kimi');
  });

  it('should switch provider', () => {
    service.setProvider('claude');
    expect(service.getProvider()).toBe('claude');
  });

  it('should track conversation history', () => {
    expect(service.getHistory().length).toBe(0);
  });

  it('should parse emotion from response', () => {
    const mockResponse = {
      emotion: { type: 'happy', intensity: 0.8 },
      content: 'Hello!',
    };

    const emotion = service.parseEmotion(mockResponse);
    expect(emotion?.type).toBe('happy');
    expect(emotion?.intensity).toBe(0.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/agent/__tests__/AgentService.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement AgentService**

```typescript
// src/features/agent/AgentService.ts
import { WebSocketManager } from './WebSocketManager';
import type {
  LLMProvider,
  Message,
  AgentActionResponse,
  EmotionType,
} from '@/shared/types';

/**
 * Agent service configuration
 */
interface AgentServiceConfig {
  serverUrl: string;
  provider?: LLMProvider;
  sessionId?: string;
}

/**
 * Request payload for agent
 */
interface AgentRequest {
  type: 'chat' | 'voice';
  sessionId: string;
  message?: string;
  audioBase64?: string;
  provider: LLMProvider;
  history: Array<{ role: 'user' | 'agent'; content: string }>;
}

/**
 * Service for LLM communication via WebSocket
 * Handles message sending, streaming responses, and emotion detection
 */
export class AgentService {
  private wsManager: WebSocketManager;
  private config: AgentServiceConfig;
  private messages: Message[] = [];
  private currentStreamingMessage: string = '';
  private onMessageCallback: ((msg: Message) => void) | null = null;
  private onActionCallback: ((action: AgentActionResponse) => void) | null = null;
  private onDeltaCallback: ((delta: string) => void) | null = null;

  constructor(config: AgentServiceConfig) {
    this.config = {
      provider: 'kimi',
      ...config,
    };

    this.wsManager = new WebSocketManager(config.serverUrl);
    this.setupEventHandlers();
  }

  /**
   * Get current LLM provider
   */
  getProvider(): LLMProvider {
    return this.config.provider!;
  }

  /**
   * Switch LLM provider
   */
  setProvider(provider: LLMProvider): void {
    this.config.provider = provider;
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.messages];
  }

  /**
   * Set callback for complete messages
   */
  onMessage(callback: (msg: Message) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set callback for streaming deltas
   */
  onDelta(callback: (delta: string) => void): void {
    this.onDeltaCallback = callback;
  }

  /**
   * Set callback for action responses
   */
  onAction(callback: (action: AgentActionResponse) => void): void {
    this.onActionCallback = callback;
  }

  /**
   * Parse emotion from agent response
   */
  parseEmotion(response: any): { type: EmotionType; intensity: number } | null {
    if (response?.emotion?.type) {
      return {
        type: response.emotion.type,
        intensity: response.emotion.intensity || 0.5,
      };
    }
    return null;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wsManager.on('connected', () => {
      console.log('[Agent] Connected to server');
    });

    this.wsManager.on('disconnected', () => {
      console.log('[Agent] Disconnected from server');
    });

    this.wsManager.on('delta', (data) => {
      if (data.content) {
        this.currentStreamingMessage += data.content;
        this.onDeltaCallback?.(data.content);
      }
    });

    this.wsManager.on('complete', (data) => {
      const message: Message = {
        id: this.generateId(),
        role: 'agent',
        content: this.currentStreamingMessage || data.content,
        emotion: data.emotion?.type,
        timestamp: Date.now(),
      };

      this.messages.push(message);
      this.onMessageCallback?.(message);

      // Reset streaming buffer
      this.currentStreamingMessage = '';

      // Trigger action callback if actions present
      if (data.actions || data.emotion) {
        this.onActionCallback?.(data as AgentActionResponse);
      }
    });

    this.wsManager.on('error', (error) => {
      console.error('[Agent] Error:', error);
    });
  }

  /**
   * Connect to agent server
   */
  async connect(): Promise<void> {
    const sessionId = this.config.sessionId || this.generateId();
    await this.wsManager.connect({ sessionId });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.wsManager.disconnect();
  }

  /**
   * Send text message to agent
   */
  async sendMessage(text: string): Promise<void> {
    if (!this.wsManager.isConnected()) {
      await this.connect();
    }

    // Add user message to history
    const userMessage: Message = {
      id: this.generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    this.messages.push(userMessage);

    // Send to server
    const request: AgentRequest = {
      type: 'chat',
      sessionId: this.config.sessionId || 'default',
      message: text,
      provider: this.config.provider!,
      history: this.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    this.wsManager.send(request);
  }

  /**
   * Send voice input to agent
   */
  async sendVoice(audioBase64: string, transcript: string): Promise<void> {
    if (!this.wsManager.isConnected()) {
      await this.connect();
    }

    const request: AgentRequest = {
      type: 'voice',
      sessionId: this.config.sessionId || 'default',
      message: transcript,
      audioBase64,
      provider: this.config.provider!,
      history: this.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    this.wsManager.send(request);
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/agent/__tests__/AgentService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/agent/AgentService.ts src/features/agent/__tests__/AgentService.test.ts
git commit -m "feat: Add AgentService for LLM communication"
```

---

## Phase 6: State Management (Zustand)

### Task 10: Create App Store

**Files:**
- Create: `emotion-agent-app/src/shared/store/appStore.ts`
- Test: `emotion-agent-app/src/shared/store/__tests__/appStore.test.ts`

- [ ] **Step 1: Write store test**

```typescript
// src/shared/store/__tests__/appStore.test.ts
import { describe, it, expect } from 'vitest';
import { useAppStore } from '../appStore';
import type { Message, EmotionType } from '@/shared/types';

describe('appStore', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      messages: [],
      currentEmotion: 'neutral',
      emotionIntensity: 0,
    });
  });

  it('should initialize with default state', () => {
    const state = useAppStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.currentEmotion).toBe('neutral');
    expect(state.isConnected).toBe(false);
  });

  it('should add message', () => {
    const { addMessage } = useAppStore.getState();
    const message: Message = {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    };

    addMessage(message);
    expect(useAppStore.getState().messages).toContainEqual(message);
  });

  it('should set emotion', () => {
    const { setEmotion } = useAppStore.getState();
    setEmotion('happy', 0.8);

    expect(useAppStore.getState().currentEmotion).toBe('happy');
    expect(useAppStore.getState().emotionIntensity).toBe(0.8);
  });

  it('should toggle recording state', () => {
    const { toggleRecording } = useAppStore.getState();

    toggleRecording();
    expect(useAppStore.getState().isRecording).toBe(true);

    toggleRecording();
    expect(useAppStore.getState().isRecording).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/store/__tests__/appStore.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement Zustand store**

```typescript
// src/shared/store/appStore.ts
import { create } from 'zustand';
import type {
  Message,
  EmotionType,
  ExpressionType,
  GestureType,
  PhonemeData,
  LLMProvider,
} from '@/shared/types';

/**
 * App state interface
 */
interface AppState {
  // Session state
  isConnected: boolean;
  messages: Message[];
  currentEmotion: EmotionType;
  emotionIntensity: number;

  // Avatar state
  currentExpression: ExpressionType;
  currentGesture: GestureType | null;
  lipSyncValue: number;
  headPose: { tilt: number; turn: number };
  bodyPosture: { lean: number; shift: number };

  // Speech state
  isRecording: boolean;
  isPlaying: boolean;
  currentTranscript: string;
  phonemeData: PhonemeData[];

  // Settings
  llmProvider: LLMProvider;
  voiceType: string;
  avatarScale: number;

  // Actions
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setEmotion: (emotion: EmotionType, intensity: number) => void;
  setExpression: (expression: ExpressionType) => void;
  setGesture: (gesture: GestureType | null) => void;
  setLipSyncValue: (value: number) => void;
  setHeadPose: (pose: { tilt: number; turn: number }) => void;
  setBodyPosture: (posture: { lean: number; shift: number }) => void;
  toggleRecording: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTranscript: (text: string) => void;
  setPhonemeData: (data: PhonemeData[]) => void;
  setConnected: (connected: boolean) => void;
  setLLMProvider: (provider: LLMProvider) => void;
  setAvatarScale: (scale: number) => void;
}

/**
 * Global app state store using Zustand
 */
export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isConnected: false,
  messages: [],
  currentEmotion: 'neutral',
  emotionIntensity: 0,
  currentExpression: 'NEUTRAL',
  currentGesture: null,
  lipSyncValue: 0,
  headPose: { tilt: 0, turn: 0 },
  bodyPosture: { lean: 0, shift: 0 },
  isRecording: false,
  isPlaying: false,
  currentTranscript: '',
  phonemeData: [],
  llmProvider: 'kimi',
  voiceType: 'zh-CN-XiaoxiaoNeural',
  avatarScale: 1.0,

  // Actions
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  clearMessages: () => set({ messages: [] }),

  setEmotion: (emotion, intensity) =>
    set({ currentEmotion: emotion, emotionIntensity: intensity }),

  setExpression: (expression) => set({ currentExpression: expression }),

  setGesture: (gesture) => set({ currentGesture: gesture }),

  setLipSyncValue: (value) => set({ lipSyncValue: value }),

  setHeadPose: (pose) => set({ headPose: pose }),

  setBodyPosture: (posture) => set({ bodyPosture: posture }),

  toggleRecording: () =>
    set((state) => ({ isRecording: !state.isRecording })),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentTranscript: (text) => set({ currentTranscript: text }),

  setPhonemeData: (data) => set({ phonemeData: data }),

  setConnected: (connected) => set({ isConnected: connected }),

  setLLMProvider: (provider) => set({ llmProvider: provider }),

  setAvatarScale: (scale) => set({ avatarScale: scale }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/store/__tests__/appStore.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/store/
git commit -m "feat: Add Zustand state management store"
```

---

## Phase 7: React Components

### Task 11: Create Live2DView Component

**Files:**
- Create: `emotion-agent-app/src/features/avatar/Live2DView.tsx`
- Create: `emotion-agent-app/src/features/avatar/useAvatar.ts`

- [ ] **Step 1: Create useAvatar hook**

```typescript
// src/features/avatar/useAvatar.ts
import { useEffect, useRef, useCallback } from 'react';
import { AvatarService } from './AvatarService';
import { LipSyncController } from './LipSyncController';
import { useAppStore } from '@/shared/store/appStore';

/**
 * Hook for managing avatar state and rendering
 */
export function useAvatar(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const avatarServiceRef = useRef<AvatarService | null>(null);
  const lipSyncRef = useRef<LipSyncController | null>(null);
  const animationRef = useRef<number | null>(null);

  const store = useAppStore();

  // Initialize avatar service
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize services
    avatarServiceRef.current = new AvatarService();

    // Initialize lip sync with parameter setter
    lipSyncRef.current = new LipSyncController((param, value) => {
      // This will be connected to Live2D model
      console.log(`[LipSync] ${param}: ${value}`);
    });

    // Start animation loop
    let lastTime = performance.now();
    const animate = () => {
      const now = performance.now();
      const deltaTime = now - lastTime;
      lastTime = now;

      // Update avatar
      avatarServiceRef.current?.update(deltaTime);

      // Update lip sync if active
      if (lipSyncRef.current?.isActive()) {
        lipSyncRef.current.update(now);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Apply emotion from store
  useEffect(() => {
    if (avatarServiceRef.current && store.currentEmotion) {
      avatarServiceRef.current.applyEmotionAction(
        store.currentEmotion,
        store.emotionIntensity
      );
    }
  }, [store.currentEmotion, store.emotionIntensity]);

  // Apply expression from store
  useEffect(() => {
    if (avatarServiceRef.current) {
      avatarServiceRef.current.setExpression(store.currentExpression);
    }
  }, [store.currentExpression]);

  // Apply gesture from store
  useEffect(() => {
    if (avatarServiceRef.current && store.currentGesture) {
      avatarServiceRef.current.playGesture(store.currentGesture);
    }
  }, [store.currentGesture]);

  // Apply phoneme data for lip sync
  useEffect(() => {
    if (lipSyncRef.current && store.phonemeData.length > 0) {
      lipSyncRef.current.setPhonemeData(
        store.phonemeData,
        performance.now()
      );
    }
  }, [store.phonemeData]);

  const setExpression = useCallback((expression: any) => {
    store.setExpression(expression);
  }, []);

  const setGesture = useCallback((gesture: any) => {
    store.setGesture(gesture);
  }, []);

  return {
    setExpression,
    setGesture,
    avatarService: avatarServiceRef.current,
  };
}
```

- [ ] **Step 2: Create Live2DView component**

```typescript
// src/features/avatar/Live2DView.tsx
import React, { useRef, useEffect } from 'react';
import { useAvatar } from './useAvatar';

interface Live2DViewProps {
  modelPath?: string;
  className?: string;
}

/**
 * Live2D avatar rendering component
 * Renders to canvas and manages Live2D model lifecycle
 */
export const Live2DView: React.FC<Live2DViewProps> = ({
  modelPath = 'assets/live2d/yumi/yumi.model3.json',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setExpression, setGesture } = useAvatar(canvasRef);

  useEffect(() => {
    // TODO: Initialize Live2D Core SDK and load model
    console.log(`[Live2DView] Loading model from: ${modelPath}`);

    // This will be implemented when Live2D SDK is integrated
    // const initLive2D = async () => {
    //   const core = await import('@/assets/live2d/core/live2dcubismcore.js');
    //   // Initialize and load model
    // };
    // initLive2D();
  }, [modelPath]);

  return (
    <canvas
      ref={canvasRef}
      className={`live2d-canvas ${className}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
};

export default Live2DView;
```

- [ ] **Step 3: Commit**

```bash
git add src/features/avatar/Live2DView.tsx src/features/avatar/useAvatar.ts
git commit -m "feat: Add Live2DView component and useAvatar hook"
```

---

### Task 12: Create App Component and Entry Point

**Files:**
- Create: `emotion-agent-app/src/App.tsx`
- Create: `emotion-agent-app/src/main.ts`
- Modify: `emotion-agent-app/index.html`

- [ ] **Step 1: Create main entry point**

```typescript
// src/main.ts
import { createRoot } from 'react-dom/client';
import App from './App';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root element not found');
  }

  const root = createRoot(container);
  root.render(App());
});

// Handle Capacitor app lifecycle
document.addEventListener('deviceready', () => {
  console.log('[App] Capacitor device ready');
}, false);
```

- [ ] **Step 2: Create App component**

```typescript
// src/App.tsx
import React from 'react';
import { Live2DView } from './features/avatar/Live2DView';
import { AgentService } from './features/agent/AgentService';
import { SpeechService } from './features/speech/SpeechService';
import { useAppStore } from './shared/store/appStore';
import './App.css';

// Initialize services
const agentService = new AgentService({
  serverUrl: import.meta.env.VITE_AGENT_SERVER_URL || 'ws://localhost:3000',
});

const speechService = new SpeechService({
  azureKey: import.meta.env.VITE_AZURE_SPEECH_KEY,
  azureRegion: import.meta.env.VITE_AZURE_SPEECH_REGION || 'eastasia',
});

const App: React.FC = () => {
  const store = useAppStore();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Emotion Agent</h1>
        <div className="connection-status">
          {store.isConnected ? '🟢' : '🔴'}
        </div>
      </header>

      <main className="app-main">
        <div className="avatar-container">
          <Live2DView />
        </div>

        <div className="controls">
          <div className="emotion-indicator">
            Emotion: {store.currentEmotion} ({store.emotionIntensity.toFixed(2)})
          </div>

          <button
            className={`record-btn ${store.isRecording ? 'recording' : ''}`}
            onClick={() => store.toggleRecording()}
          >
            {store.isRecording ? '⏹ Stop' : '🎤 Record'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
```

- [ ] **Step 3: Create App styles**

```css
/* src/App.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  min-height: 100vh;
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
}

.app-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.connection-status {
  font-size: 12px;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.avatar-container {
  width: 100%;
  max-width: 400px;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  overflow: hidden;
}

.controls {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.emotion-indicator {
  font-size: 14px;
  opacity: 0.8;
  text-transform: capitalize;
}

.record-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 24px;
  background: #4a9eff;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.record-btn:hover {
  background: #3a8eef;
  transform: scale(1.05);
}

.record-btn.recording {
  background: #ff4a4a;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

- [ ] **Step 4: Update index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>Emotion Agent</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Create environment types**

```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_SERVER_URL: string
  readonly VITE_AZURE_SPEECH_KEY: string
  readonly VITE_AZURE_SPEECH_REGION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/main.ts src/App.css src/vite-env.d.ts index.html
git commit -m "feat: Add App component with Live2D view and basic controls"
```

---

## Phase 8: Build and Platform Configuration

### Task 13: Configure Build Scripts

**Files:**
- Modify: `emotion-agent-app/package.json`
- Create: `emotion-agent-app/.env.example`

- [ ] **Step 1: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "sync:ios": "npm run build && npx cap sync ios",
    "sync:android": "npm run build && npx cap sync android",
    "open:ios": "npx cap open ios",
    "open:android": "npx cap open android"
  }
}
```

- [ ] **Step 2: Create environment example**

```bash
# .env.example
# Copy to .env.local and fill in your values

# Agent WebSocket server URL
VITE_AGENT_SERVER_URL=ws://localhost:3000

# Azure Speech Services
VITE_AZURE_SPEECH_KEY=your-azure-speech-key-here
VITE_AZURE_SPEECH_REGION=eastasia
```

- [ ] **Step 3: Create .gitignore**

```bash
# .gitignore
node_modules/
dist/
.ios/
.android/
*.local
.env.local
.DS_Store
*.log
coverage/
```

- [ ] **Step 4: Test build**

```bash
npm run build
```

Expected: Build completes without errors

- [ ] **Step 5: Commit**

```bash
git add package.json .env.example .gitignore
git commit -m "chore: Configure build scripts and environment"
```

---

### Task 14: Sync to Mobile Platforms

**Files:**
- Build output synced to iOS/Android

- [ ] **Step 1: Build and sync to iOS**

```bash
npm run sync:ios
```

- [ ] **Step 2: Build and sync to Android**

```bash
npm run sync:android
```

- [ ] **Step 3: Verify platform directories**

```bash
ls -la ios/App/App/
ls -la android/app/src/main/assets/
```

Expected: Both platforms have the web assets

- [ ] **Step 4: Commit platform changes**

```bash
git add ios/ android/
git commit -m "chore: Sync web assets to iOS and Android platforms"
```

---

## Summary

This implementation plan creates a complete Capacitor-based mobile app with:

1. **Core Infrastructure**: TypeScript, Vite, Capacitor 6, React
2. **Avatar System**: AvatarService, LipSyncController, emotion mapping
3. **Speech System**: SpeechService with Azure TTS integration
4. **Agent System**: WebSocketManager, AgentService for LLM communication
5. **State Management**: Zustand store for global state
6. **UI Components**: Live2DView, hooks, basic styling
7. **Build Configuration**: Scripts for development and deployment

**Next Steps After Plan Execution:**
- Integrate Live2D Cubism Core SDK (WASM)
- Implement native STT plugins for iOS/Android
- Add actual LLM server endpoint
- Performance optimization and testing
