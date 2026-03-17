/**
 * Text Segmentation Engine
 * 将输入文本分段处理，识别不同类型的内容
 */

import { EmotionMetrics } from '../entities/emotion.entity';

/** 片段类型 */
export type SegmentType =
  | 'greeting'      // 问候
  | 'farewell'      // 告别
  | 'question'      // 问题
  | 'answer'        // 回答
  | 'exclamation'   // 感叹
  | 'content'       // 普通内容
  | 'pause';        // 停顿

/** 文本片段 */
export interface TextSegment {
  id: string;
  text: string;
  type: SegmentType;
  emotionHint?: string;
  priority: number;
  emotion?: EmotionMetrics;
  metadata?: {
    wordCount?: number;
    charCount?: number;
    hasPunctuation?: boolean;
  };
}

/** 分段配置 */
export interface SegmentationConfig {
  maxSegmentLength?: number;
  minSegmentLength?: number;
  preserveSentences?: boolean;
  detectEmotionHints?: boolean;
}

const DEFAULT_CONFIG: Required<SegmentationConfig> = {
  maxSegmentLength: 100,
  minSegmentLength: 1,
  preserveSentences: true,
  detectEmotionHints: true,
};

/**
 * 分段引擎
 * 将长文本分割成可处理的片段
 */
export class SegmentationEngine {
  private config: Required<SegmentationConfig>;
  private segmentCounter = 0;

  constructor(config: SegmentationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 分段文本
   */
  segment(text: string, context?: any): TextSegment[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // 1. 按句子分割
    const sentences = this.splitIntoSentences(text);

    // 2. 处理每个句子
    const segments: TextSegment[] = [];

    for (const sentence of sentences) {
      const segment = this.createSegment(sentence, context);
      segments.push(segment);
    }

    return segments;
  }

  /**
   * 快速分段（不分析情感）
   */
  segmentFast(text: string): TextSegment[] {
    return this.segment(text, { skipEmotionAnalysis: true });
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<SegmentationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): SegmentationConfig {
    return { ...this.config };
  }

  /**
   * 重置计数器
   */
  resetCounter(): void {
    this.segmentCounter = 0;
  }

  /**
   * 分割成句子
   */
  private splitIntoSentences(text: string): string[] {
    // 中文句子结束符：。！？\n
    // 英文句子结束符：.!?\n
    const sentenceEndRegex = /[。！？.!?\n]+/g;

    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentenceEndRegex.exec(text)) !== null) {
      const sentence = text.slice(lastIndex, match.index).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }

    // 处理最后一段
    const lastSentence = text.slice(lastIndex).trim();
    if (lastSentence.length > 0) {
      sentences.push(lastSentence);
    }

    // 如果没有找到句子分隔符，按长度分割
    if (sentences.length === 0 && text.trim().length > 0) {
      return this.splitByLength(text.trim());
    }

    return sentences;
  }

  /**
   * 按长度分割
   */
  private splitByLength(text: string): string[] {
    const segments: string[] = [];
    const maxLen = this.config.maxSegmentLength;

    for (let i = 0; i < text.length; i += maxLen) {
      segments.push(text.slice(i, i + maxLen));
    }

    return segments;
  }

  /**
   * 创建片段
   */
  private createSegment(text: string, context?: any): TextSegment {
    this.segmentCounter++;

    const type = this.detectSegmentType(text);
    const emotionHint = this.config.detectEmotionHints && !context?.skipEmotionAnalysis
      ? this.detectEmotionHint(text)
      : 'neutral';

    const priority = this.calculatePriority(type, text);

    return {
      id: `seg_${Date.now()}_${this.segmentCounter}`,
      text: text.trim(),
      type,
      emotionHint,
      priority,
      metadata: {
        wordCount: text.split(/\s+/).length,
        charCount: text.length,
        hasPunctuation: /[。！？.!?]/.test(text),
      },
    };
  }

  /**
   * 检测片段类型
   */
  private detectSegmentType(text: string): SegmentType {
    const trimmed = text.trim();

    // 问候语检测
    if (/^(你好|您好|嗨|hello|hi|hey)/i.test(trimmed)) {
      return 'greeting';
    }

    // 告别语检测
    if (/(再见|拜拜|bye|goodbye|see you)/i.test(trimmed)) {
      return 'farewell';
    }

    // 问题检测
    if (/[?？]$|^(为什么|怎么|什么|哪里|谁|多少|几)/.test(trimmed)) {
      return 'question';
    }

    // 感叹检测
    if (/[！!]$/.test(trimmed) || /^(太|真|好|太棒了| amazing|great)/.test(trimmed)) {
      return 'exclamation';
    }

    // 回答检测（以"是"、"不是"、"对"等开头）
    if (/^(是|不是|对|不对|没错|是的|no|yes|yeah|nope)/i.test(trimmed)) {
      return 'answer';
    }

    return 'content';
  }

  /**
   * 检测情感提示
   */
  private detectEmotionHint(text: string): string {
    const emotionPatterns: Record<string, RegExp[]> = {
      happy: [/开心|高兴|快乐|棒|太好了|喜欢|love|happy|great|awesome/i],
      sad: [/难过|伤心|失望|遗憾|sorry|sad|unfortunate/i],
      angry: [/生气|愤怒|讨厌|恨|angry|hate|mad/i],
      excited: [/兴奋|激动|期待|wow|excited|amazing|incredible/i],
      concerned: [/担心|关心|注意|care|concern|worry/i],
      neutral: [],
    };

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return emotion;
        }
      }
    }

    return 'neutral';
  }

  /**
   * 计算优先级
   */
  private calculatePriority(type: SegmentType, text: string): number {
    const basePriority: Record<SegmentType, number> = {
      greeting: 1,
      farewell: 1,
      question: 3,
      answer: 2,
      exclamation: 2,
      content: 1,
      pause: 0,
    };

    let priority = basePriority[type] || 1;

    // 紧急关键词提升优先级
    if (/紧急| urgent|立刻| immediately|马上| right now/i.test(text)) {
      priority += 2;
    }

    // 短句提升优先级
    if (text.length < 10) {
      priority += 1;
    }

    return Math.min(10, priority);
  }
}
