/**
 * 情感系统实体定义
 * 6维情感指标 + 情绪状态分类
 */

/** 6维情感指标 */
export interface EmotionMetrics {
  /** 满意度 - 用户对交互的满意程度 (0-100) */
  satisfaction: number;
  /** 信任度 - 用户对Agent的信任程度 (0-100) */
  trust: number;
  /** 挫败感 - 用户的沮丧/挫败程度 (0-100) */
  frustration: number;
  /** 紧急度 - 用户需求的紧急程度 (0-100) */
  urgency: number;
  /** 参与度 - 用户的投入和专注程度 (0-100) */
  engagement: number;
  /** 困惑度 - 用户的困惑/疑惑程度 (0-100) */
  confusion: number;
}

/** 情绪状态分类 */
export enum EmotionState {
  POSITIVE = 'positive',     // 积极 - 满意、信任、开心
  NEUTRAL = 'neutral',       // 中性 - 平静、一般
  NEGATIVE = 'negative',     // 负面 - 不满、失望
  CRITICAL = 'critical',     // 危机 - 愤怒、极度挫败
}

/** 情感分析结果 */
export interface EmotionAnalysis {
  /** 分析ID */
  analysisId: string;
  /** 会话ID */
  sessionId: string;
  /** 用户ID */
  userId: string;
  /** 6维指标 */
  metrics: EmotionMetrics;
  /** 主导情绪状态 */
  dominantState: EmotionState;
  /** 主导情绪强度 (0-100) */
  intensity: number;
  /** 分析来源文本 */
  sourceText: string;
  /** 分析使用的模型/方法 */
  analysisMethod: 'rule' | 'llm' | 'hybrid';
  /** 置信度 (0-1) */
  confidence: number;
  /** 分析时间戳 */
  timestamp: Date;
  /** 建议的Agent响应策略 */
  suggestedResponse: ResponseStrategy;
}

/** 响应策略 */
export interface ResponseStrategy {
  /** 策略类型 */
  type: 'empathize' | 'clarify' | 'escalate' | 'celebrate' | 'calm';
  /** 语气建议 */
  tone: 'warm' | 'professional' | 'urgent' | 'gentle';
  /** 是否主动询问 */
  shouldAsk: boolean;
  /** 建议的问题（如果需要询问） */
  suggestedQuestion?: string;
  /** 响应优先级 */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/** 情感历史记录 */
export interface EmotionHistory {
  /** 历史记录ID */
  historyId: string;
  /** 会话ID */
  sessionId: string;
  /** 用户ID */
  userId: string;
  /** 情感变化时间线 */
  timeline: EmotionSnapshot[];
  /** 会话整体情感趋势 */
  overallTrend: 'improving' | 'stable' | 'declining';
  /** 峰值情绪记录 */
  peakEmotions: PeakEmotion[];
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** 情感快照 */
export interface EmotionSnapshot {
  /** 快照时间戳 */
  timestamp: Date;
  /** 6维指标 */
  metrics: EmotionMetrics;
  /** 情绪状态 */
  state: EmotionState;
  /** 触发文本 */
  triggerText: string;
}

/** 峰值情绪 */
export interface PeakEmotion {
  /** 情绪类型 */
  state: EmotionState;
  /** 强度 */
  intensity: number;
  /** 发生时间 */
  timestamp: Date;
  /** 触发文本 */
  triggerText: string;
}

/** 分析配置 */
export interface EmotionAnalysisConfig {
  /** 是否启用规则分析 */
  enableRuleAnalysis: boolean;
  /** 是否启用LLM分析 */
  enableLLMAnalysis: boolean;
  /** 规则与LLM的权重 */
  hybridWeights: { rule: number; llm: number };
  /** 置信度阈值 */
  confidenceThreshold: number;
  /** 历史记录保留时长 (小时) */
  historyRetentionHours: number;
}

/** 默认情感指标（中性状态） */
export const DEFAULT_EMOTION_METRICS: EmotionMetrics = {
  satisfaction: 50,
  trust: 50,
  frustration: 0,
  urgency: 30,
  engagement: 50,
  confusion: 0,
};

/** 情绪状态阈值 */
export const EMOTION_STATE_THRESHOLDS = {
  [EmotionState.CRITICAL]: { frustration: 70, urgency: 80, negative: 75 },
  [EmotionState.NEGATIVE]: { frustration: 50, confusion: 60, satisfaction: 30 },
  [EmotionState.POSITIVE]: { satisfaction: 70, trust: 60, engagement: 70 },
  [EmotionState.NEUTRAL]: {},
} as const;
