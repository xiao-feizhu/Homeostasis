/**
 * Live2D Avatar 实体定义
 * 定义虚拟形象的数据结构和类型
 */

/** 表情类型 */
export enum ExpressionType {
  NEUTRAL = 'neutral',       // 中性/默认
  HAPPY = 'happy',           // 开心
  SAD = 'sad',               // 悲伤
  ANGRY = 'angry',           // 生气
  SURPRISED = 'surprised',   // 惊讶
  CONFUSED = 'confused',     // 困惑
  THINKING = 'thinking',     // 思考
  CONCERNED = 'concerned',   // 关切
  EXCITED = 'excited',       // 兴奋
  WORRIED = 'worried',       // 担心
}

/** 口型类型 (基于日语五十音) */
export enum LipSyncVowel {
  SILENT = 'sil',    // 静音
  A = 'a',           // あ
  I = 'i',           // い
  U = 'u',           // う
  E = 'e',           // え
  O = 'o',           // お
}

/** 动画类型 */
export enum AnimationType {
  IDLE = 'idle',           // 待机动画
  TALKING = 'talking',     // 说话动画
  GESTURE = 'gesture',     // 手势动画
  EMOTION = 'emotion',     // 情感动画
}

/** Live2D 模型配置 */
export interface Live2DModelConfig {
  modelId: string;
  name: string;
  version: string;
  modelPath: string;        // .model3.json 路径
  texturePath: string;      // 贴图路径
  physicsPath?: string;     // 物理配置路径
  posePath?: string;        // 姿势配置路径
}

/** 表情参数 */
export interface ExpressionParams {
  eyebrowAngle: number;     // 眉毛角度 (-1 ~ 1)
  eyebrowHeight: number;    // 眉毛高度 (-1 ~ 1)
  eyeOpenness: number;      // 眼睛睁开程度 (0 ~ 1)
  mouthOpenness: number;    // 嘴巴张开程度 (0 ~ 1)
  mouthWidth: number;       // 嘴巴宽度 (0 ~ 1)
  cheekTint: number;        // 脸颊红晕 (0 ~ 1)
  tearLevel: number;        // 眼泪程度 (0 ~ 1)
  sweatLevel: number;       // 汗珠程度 (0 ~ 1)
}

/** 预定义表情配置 */
export const PRESET_EXPRESSIONS: Record<ExpressionType, ExpressionParams> = {
  [ExpressionType.NEUTRAL]: {
    eyebrowAngle: 0,
    eyebrowHeight: 0,
    eyeOpenness: 1,
    mouthOpenness: 0,
    mouthWidth: 0.5,
    cheekTint: 0,
    tearLevel: 0,
    sweatLevel: 0,
  },
  [ExpressionType.HAPPY]: {
    eyebrowAngle: -0.3,
    eyebrowHeight: 0.2,
    eyeOpenness: 0.8,
    mouthOpenness: 0.4,
    mouthWidth: 0.8,
    cheekTint: 0.3,
    tearLevel: 0,
    sweatLevel: 0,
  },
  [ExpressionType.SAD]: {
    eyebrowAngle: 0.5,
    eyebrowHeight: -0.3,
    eyeOpenness: 0.6,
    mouthOpenness: 0.1,
    mouthWidth: 0.3,
    cheekTint: 0,
    tearLevel: 0.4,
    sweatLevel: 0,
  },
  [ExpressionType.ANGRY]: {
    eyebrowAngle: -0.6,
    eyebrowHeight: 0.3,
    eyeOpenness: 0.9,
    mouthOpenness: 0.3,
    mouthWidth: 0.6,
    cheekTint: 0.2,
    tearLevel: 0,
    sweatLevel: 0,
  },
  [ExpressionType.SURPRISED]: {
    eyebrowAngle: -0.2,
    eyebrowHeight: 0.6,
    eyeOpenness: 1.2,
    mouthOpenness: 0.6,
    mouthWidth: 0.7,
    cheekTint: 0,
    tearLevel: 0,
    sweatLevel: 0.2,
  },
  [ExpressionType.CONFUSED]: {
    eyebrowAngle: 0.3,
    eyebrowHeight: 0.1,
    eyeOpenness: 0.7,
    mouthOpenness: 0.15,
    mouthWidth: 0.4,
    cheekTint: 0,
    tearLevel: 0,
    sweatLevel: 0.3,
  },
  [ExpressionType.THINKING]: {
    eyebrowAngle: 0.2,
    eyebrowHeight: 0,
    eyeOpenness: 0.5,
    mouthOpenness: 0.1,
    mouthWidth: 0.3,
    cheekTint: 0,
    tearLevel: 0,
    sweatLevel: 0,
  },
  [ExpressionType.CONCERNED]: {
    eyebrowAngle: 0.4,
    eyebrowHeight: -0.1,
    eyeOpenness: 0.85,
    mouthOpenness: 0.2,
    mouthWidth: 0.4,
    cheekTint: 0,
    tearLevel: 0,
    sweatLevel: 0,
  },
  [ExpressionType.EXCITED]: {
    eyebrowAngle: -0.4,
    eyebrowHeight: 0.4,
    eyeOpenness: 1,
    mouthOpenness: 0.5,
    mouthWidth: 0.9,
    cheekTint: 0.4,
    tearLevel: 0,
    sweatLevel: 0,
  },
  [ExpressionType.WORRIED]: {
    eyebrowAngle: 0.3,
    eyebrowHeight: -0.2,
    eyeOpenness: 0.75,
    mouthOpenness: 0.1,
    mouthWidth: 0.35,
    cheekTint: 0,
    tearLevel: 0.1,
    sweatLevel: 0.1,
  },
};

/** 口型配置 */
export interface LipSyncConfig {
  vowel: LipSyncVowel;
  intensity: number;        // 强度 (0 ~ 1)
  blendTime: number;        // 混合时间 (ms)
}

/** 视素到嘴型参数映射 */
export const VISEME_PARAMS: Record<LipSyncVowel, { mouthOpenness: number; mouthWidth: number }> = {
  [LipSyncVowel.SILENT]: { mouthOpenness: 0, mouthWidth: 0.5 },
  [LipSyncVowel.A]: { mouthOpenness: 0.8, mouthWidth: 0.9 },
  [LipSyncVowel.I]: { mouthOpenness: 0.3, mouthWidth: 0.4 },
  [LipSyncVowel.U]: { mouthOpenness: 0.2, mouthWidth: 0.3 },
  [LipSyncVowel.E]: { mouthOpenness: 0.5, mouthWidth: 0.8 },
  [LipSyncVowel.O]: { mouthOpenness: 0.6, mouthWidth: 0.6 },
};

/** 文本到口型的简单映射 (基于拼音/发音) */
export const TEXT_TO_VISEME: Record<string, LipSyncVowel> = {
  // 静音
  ' ': LipSyncVowel.SILENT,
  '，': LipSyncVowel.SILENT,
  '。': LipSyncVowel.SILENT,
  // 开口音 'a'
  'a': LipSyncVowel.A,
  'o': LipSyncVowel.O,
  // 扁唇音 'i'
  'i': LipSyncVowel.I,
  'y': LipSyncVowel.I,
  // 合口音 'u'
  'u': LipSyncVowel.U,
  'w': LipSyncVowel.U,
  // 半开口 'e'
  'e': LipSyncVowel.E,
};

/** Avatar 实例状态 */
export interface AvatarState {
  avatarId: string;
  sessionId: string;
  currentExpression: ExpressionType;
  currentLipSync: LipSyncConfig;
  isTalking: boolean;
  currentAnimation: AnimationType;
  position: { x: number; y: number };
  scale: number;
  opacity: number;
}

/** Avatar 配置 */
export interface AvatarConfig {
  model: Live2DModelConfig;
  defaultExpression: ExpressionType;
  idleAnimations: string[];
  emotionMappings: Record<string, ExpressionType>;  // 情感标签到表情的映射
  lipSyncEnabled: boolean;
  blinkEnabled: boolean;
  blinkInterval: { min: number; max: number };  // 眨眼间隔范围 (ms)
  breathEnabled: boolean;
}

/** 情感系统到表情的映射 */
export const EMOTION_TO_EXPRESSION: Record<string, ExpressionType> = {
  'happy': ExpressionType.HAPPY,
  'satisfied': ExpressionType.HAPPY,
  'excited': ExpressionType.EXCITED,
  'positive': ExpressionType.HAPPY,
  'sad': ExpressionType.SAD,
  'frustrated': ExpressionType.CONCERNED,
  'angry': ExpressionType.ANGRY,
  'negative': ExpressionType.SAD,
  'confused': ExpressionType.CONFUSED,
  'surprised': ExpressionType.SURPRISED,
  'thinking': ExpressionType.THINKING,
  'worried': ExpressionType.WORRIED,
  'concerned': ExpressionType.CONCERNED,
  'neutral': ExpressionType.NEUTRAL,
  'calm': ExpressionType.NEUTRAL,
};
