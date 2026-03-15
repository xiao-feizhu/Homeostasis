/**
 * 情感分析服务
 * 基于规则的文本情感分析引擎
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EmotionMetrics,
  EmotionState,
  EmotionAnalysis,
  EmotionAnalysisConfig,
  ResponseStrategy,
  DEFAULT_EMOTION_METRICS,
  EMOTION_STATE_THRESHOLDS,
} from '../entities/emotion.entity';

/** 分析请求 */
export interface AnalyzeTextRequest {
  text: string;
  userId: string;
  sessionId: string;
  context?: string;
}

/** 情感词典 - 中文 */
const EMOTION_KEYWORDS: Record<string, Array<{ word: string; weight: number }>> = {
  satisfaction: [
    { word: '满意', weight: 10 },
    { word: '喜欢', weight: 8 },
    { word: '开心', weight: 8 },
    { word: '高兴', weight: 8 },
    { word: '感谢', weight: 7 },
    { word: '谢谢', weight: 6 },
    { word: '好', weight: 5 },
    { word: '不错', weight: 6 },
    { word: '棒', weight: 8 },
    { word: '优秀', weight: 9 },
    { word: '完美', weight: 10 },
    { word: '太好了', weight: 9 },
    { word: '给力', weight: 7 },
    { word: '失望', weight: -12 },
    { word: '糟糕', weight: -10 },
    { word: '差', weight: -8 },
    { word: '垃圾', weight: -12 },
    { word: '烂', weight: -10 },
    { word: '后悔', weight: -8 },
  ],
  trust: [
    { word: '相信', weight: 8 },
    { word: '信任', weight: 10 },
    { word: '可靠', weight: 8 },
    { word: '靠谱', weight: 7 },
    { word: '专业', weight: 7 },
    { word: '厉害', weight: 6 },
    { word: '佩服', weight: 7 },
  ],
  frustration: [
    { word: '生气', weight: 10 },
    { word: '愤怒', weight: 10 },
    { word: '失望', weight: 8 },
    { word: '沮丧', weight: 9 },
    { word: '糟糕', weight: 8 },
    { word: '烦', weight: 7 },
    { word: '讨厌', weight: 8 },
    { word: '恨', weight: 10 },
    { word: '无语', weight: 6 },
    { word: '郁闷', weight: 7 },
    { word: '痛苦', weight: 9 },
    { word: '受不了', weight: 8 },
  ],
  urgency: [
    { word: '紧急', weight: 10 },
    { word: ' urgent', weight: 10 },
    { word: '立即', weight: 9 },
    { word: '马上', weight: 9 },
    { word: '赶紧', weight: 8 },
    { word: '快点', weight: 8 },
    { word: '着急', weight: 7 },
    { word: '急', weight: 7 },
    { word: '十万火急', weight: 10 },
    { word: '刻不容缓', weight: 10 },
  ],
  engagement: [
    { word: '?', weight: 5 },
    { word: '？', weight: 5 },
    { word: '为什么', weight: 6 },
    { word: '怎么', weight: 5 },
    { word: '请问', weight: 6 },
    { word: '想了解', weight: 7 },
    { word: '告诉我', weight: 6 },
    { word: '详细', weight: 5 },
    { word: '具体', weight: 5 },
  ],
  confusion: [
    { word: '不懂', weight: 9 },
    { word: '不明白', weight: 9 },
    { word: '困惑', weight: 10 },
    { word: '疑惑', weight: 8 },
    { word: '什么意思', weight: 8 },
    { word: '不理解', weight: 8 },
    { word: '迷茫', weight: 8 },
    { word: '不清楚', weight: 7 },
    { word: '模糊', weight: 6 },
    { word: '混乱', weight: 7 },
    { word: '再解释', weight: 6 },
    { word: '再说一遍', weight: 5 },
  ],
};

/** 否定词修饰 */
const NEGATION_WORDS = ['不', '没', '无', '别', '不要', '没有', '不是', '不能', '不会'];

/** 强度修饰词 */
const INTENSIFIERS = [
  { word: '非常', multiplier: 1.5 },
  { word: '特别', multiplier: 1.4 },
  { word: '很', multiplier: 1.3 },
  { word: '太', multiplier: 1.3 },
  { word: '极其', multiplier: 1.6 },
  { word: '超级', multiplier: 1.5 },
  { word: '十分', multiplier: 1.4 },
  { word: '相当', multiplier: 1.2 },
  { word: '有点', multiplier: 0.6 },
  { word: '稍微', multiplier: 0.5 },
  { word: '略微', multiplier: 0.5 },
];

export class EmotionAnalyzer {
  constructor(private config: EmotionAnalysisConfig) {}

  /**
   * 分析文本情感
   */
  async analyzeText(request: AnalyzeTextRequest): Promise<EmotionAnalysis> {
    const { text, userId, sessionId } = request;

    // 限制文本长度
    const trimmedText = text.slice(0, 1000);

    // 基于规则分析
    let metrics: EmotionMetrics;
    let confidence: number;

    if (this.config.enableRuleAnalysis) {
      const ruleResult = this.analyzeByRule(trimmedText);
      metrics = ruleResult.metrics;
      confidence = ruleResult.confidence;
    } else {
      metrics = { ...DEFAULT_EMOTION_METRICS };
      confidence = 0.3;
    }

    // 确定主导情绪状态
    const dominantState = this.determineEmotionState(metrics);

    // 计算情绪强度
    const intensity = this.calculateIntensity(metrics, dominantState);

    // 生成响应策略
    const suggestedResponse = this.generateResponseStrategy(dominantState, metrics, intensity);

    return {
      analysisId: uuidv4(),
      sessionId,
      userId,
      metrics,
      dominantState,
      intensity,
      sourceText: trimmedText,
      analysisMethod: this.config.enableLLMAnalysis ? 'hybrid' : 'rule',
      confidence,
      timestamp: new Date(),
      suggestedResponse,
    };
  }

  /**
   * 基于规则的情感分析
   */
  private analyzeByRule(text: string): { metrics: EmotionMetrics; confidence: number } {
    // 初始化为默认值
    const metrics = { ...DEFAULT_EMOTION_METRICS };
    let keywordCount = 0;

    // 遍历每种情感维度
    for (const [dimension, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      let score = metrics[dimension as keyof EmotionMetrics];

      for (const { word, weight } of keywords) {
        const matches = this.findKeywordMatches(text, word);

        for (const match of matches) {
          let adjustedWeight = weight;

          // 检查否定修饰
          if (this.isNegated(text, match.index)) {
            adjustedWeight = -adjustedWeight * 0.5; // 否定反向
          }

          // 检查强度修饰
          const intensifier = this.findIntensifier(text, match.index);
          if (intensifier) {
            adjustedWeight *= intensifier.multiplier;
          }

          // 累加到对应维度
          score += adjustedWeight;
          keywordCount++;
        }
      }

      // 归一化到 0-100 范围
      metrics[dimension as keyof EmotionMetrics] = this.normalizeScore(score);
    }

    // 维度间相互影响
    this.applyDimensionInteractions(metrics);

    // 计算置信度（基于匹配的关键词数量）
    const confidence = keywordCount === 0
      ? 0.25 // 空文本或没有匹配时
      : Math.min(0.3 + keywordCount * 0.15, 0.95);

    return { metrics, confidence };
  }

  /**
   * 应用维度间的相互影响
   * 例如：高挫败感会降低满意度
   */
  private applyDimensionInteractions(metrics: EmotionMetrics): void {
    // 挫败感对满意度的影响
    if (metrics.frustration > 50) {
      const reduction = (metrics.frustration - 50) * 0.6;
      metrics.satisfaction = Math.max(0, metrics.satisfaction - reduction);
    }

    // 困惑对信任度的影响
    if (metrics.confusion > 60) {
      const reduction = (metrics.confusion - 60) * 0.4;
      metrics.trust = Math.max(0, metrics.trust - reduction);
    }

    // 高满意度提升信任度
    if (metrics.satisfaction > 70 && metrics.trust < 60) {
      metrics.trust = Math.min(100, metrics.trust + (metrics.satisfaction - 70) * 0.3);
    }

    // 高参与度降低困惑（用户投入了说明理解了一些）
    if (metrics.engagement > 60 && metrics.confusion > 40) {
      const reduction = (metrics.engagement - 60) * 0.3;
      metrics.confusion = Math.max(0, metrics.confusion - reduction);
    }
  }

  /**
   * 查找关键词匹配
   */
  private findKeywordMatches(text: string, keyword: string): Array<{ index: number }> {
    const matches: Array<{ index: number }> = [];
    let index = text.indexOf(keyword);

    while (index !== -1) {
      matches.push({ index });
      index = text.indexOf(keyword, index + 1);
    }

    return matches;
  }

  /**
   * 检查是否被否定修饰
   */
  private isNegated(text: string, keywordIndex: number): boolean {
    // 检查关键词前5个字符内是否有否定词
    const beforeText = text.slice(Math.max(0, keywordIndex - 5), keywordIndex);
    return NEGATION_WORDS.some(neg => beforeText.includes(neg));
  }

  /**
   * 查找强度修饰词
   */
  private findIntensifier(text: string, keywordIndex: number): { multiplier: number } | null {
    // 检查关键词前4个字符内是否有强度修饰词
    const beforeText = text.slice(Math.max(0, keywordIndex - 4), keywordIndex);

    for (const { word, multiplier } of INTENSIFIERS) {
      if (beforeText.includes(word)) {
        return { multiplier };
      }
    }

    return null;
  }

  /**
   * 归一化分数到 0-100
   */
  private normalizeScore(score: number): number {
    // 基础分50，根据正负偏移
    const normalized = 50 + score;
    return Math.max(0, Math.min(100, normalized));
  }

  /**
   * 确定主导情绪状态
   */
  determineEmotionState(metrics: EmotionMetrics): EmotionState {
    const thresholds = EMOTION_STATE_THRESHOLDS;

    // 检查危机状态
    if (metrics.frustration >= thresholds[EmotionState.CRITICAL].frustration ||
        (metrics.frustration >= 60 && metrics.urgency >= 70)) {
      return EmotionState.CRITICAL;
    }

    // 检查负面状态
    if (metrics.frustration >= thresholds[EmotionState.NEGATIVE].frustration ||
        metrics.confusion >= thresholds[EmotionState.NEGATIVE].confusion ||
        metrics.satisfaction <= thresholds[EmotionState.NEGATIVE].satisfaction) {
      return EmotionState.NEGATIVE;
    }

    // 检查积极状态
    if (metrics.satisfaction >= thresholds[EmotionState.POSITIVE].satisfaction ||
        metrics.trust >= thresholds[EmotionState.POSITIVE].trust ||
        metrics.engagement >= thresholds[EmotionState.POSITIVE].engagement) {
      return EmotionState.POSITIVE;
    }

    // 默认为中性
    return EmotionState.NEUTRAL;
  }

  /**
   * 计算情绪强度
   */
  private calculateIntensity(metrics: EmotionMetrics, state: EmotionState): number {
    switch (state) {
      case EmotionState.POSITIVE:
        return Math.max(metrics.satisfaction, metrics.trust, metrics.engagement);
      case EmotionState.NEGATIVE:
        return Math.max(metrics.frustration, 100 - metrics.satisfaction, metrics.confusion);
      case EmotionState.CRITICAL:
        return Math.max(metrics.frustration, metrics.urgency);
      case EmotionState.NEUTRAL:
      default:
        return 50;
    }
  }

  /**
   * 生成响应策略
   */
  generateResponseStrategy(
    state: EmotionState,
    metrics: EmotionMetrics,
    _intensity: number
  ): ResponseStrategy {
    switch (state) {
      case EmotionState.CRITICAL:
        return {
          type: 'escalate',
          tone: 'urgent',
          shouldAsk: true,
          suggestedQuestion: '我理解您现在很着急，让我立即为您处理。能告诉我最紧急的部分吗？',
          priority: 'critical',
        };

      case EmotionState.NEGATIVE:
        if (metrics.confusion > 50) {
          return {
            type: 'clarify',
            tone: 'gentle',
            shouldAsk: true,
            suggestedQuestion: '我可能没有解释清楚，让我重新说明一下。您具体是哪部分不太明白呢？',
            priority: 'high',
          };
        }
        return {
          type: 'empathize',
          tone: 'warm',
          shouldAsk: true,
          suggestedQuestion: '我理解您的不满，让我来帮您解决。能详细说说遇到的问题吗？',
          priority: 'high',
        };

      case EmotionState.POSITIVE:
        return {
          type: 'celebrate',
          tone: 'warm',
          shouldAsk: false,
          priority: 'low',
        };

      case EmotionState.NEUTRAL:
      default:
        if (metrics.confusion > 40) {
          return {
            type: 'clarify',
            tone: 'gentle',
            shouldAsk: true,
            suggestedQuestion: '让我再为您解释一下，您觉得这个方案如何？',
            priority: 'medium',
          };
        }
        return {
          type: 'empathize',
          tone: 'professional',
          shouldAsk: false,
          priority: 'low',
        };
    }
  }
}
