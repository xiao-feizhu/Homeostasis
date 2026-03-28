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
  offset: number;
  duration: number;
}

// Lip shape parameters
export interface LipShape {
  open: number;
  wide: number;
}

// Head pose parameters
export interface HeadPose {
  tilt: number;
  turn: number;
  nodSpeed?: number;
}

// Body posture parameters
export interface BodyPosture {
  lean: number;
  shift: number;
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
    intensity: number;
    duration: number;
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

// LLM Provider type
export type LLMProvider = 'kimi' | 'claude' | 'openai';

// Action strategy types
export type ActionStrategy = 'minimal' | 'gesture_assisted' | 'expressive' | 'dramatic';
