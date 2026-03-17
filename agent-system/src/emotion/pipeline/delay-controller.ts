/**
 * Delay Controller
 * 控制响应延迟，模拟自然对话节奏
 */

import { TextSegment } from './segmentation';

export interface DelayConfig {
  baseDelay?: number;           // 基础延迟 (ms)
  charDelay?: number;           // 每字符延迟 (ms)
  minDelay?: number;            // 最小延迟 (ms)
  maxDelay?: number;            // 最大延迟 (ms)
  enableThinkingDelay?: boolean; // 启用思考延迟
  enableTypingDelay?: boolean;  // 启用打字延迟
}

export interface DelayContext {
  previousSegment?: TextSegment;
  urgency?: number;             // 紧急度 (0-1)
  complexity?: number;          // 复杂度 (0-1)
  userWaitTime?: number;        // 用户等待时间 (ms)
}

const DEFAULT_CONFIG: Required<DelayConfig> = {
  baseDelay: 200,
  charDelay: 30,
  minDelay: 100,
  maxDelay: 3000,
  enableThinkingDelay: true,
  enableTypingDelay: true,
};

/**
 * 延迟控制器
 * 模拟人类对话的自然延迟
 */
export class DelayController {
  private config: Required<DelayConfig>;
  private lastTriggerTime = 0;

  constructor(config: DelayConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 计算延迟时间
   */
  calculateDelay(segment: TextSegment, context?: DelayContext): number {
    let delay = this.config.baseDelay;

    // 基于文本长度计算打字延迟
    if (this.config.enableTypingDelay) {
      delay += segment.text.length * this.config.charDelay;
    }

    // 基于复杂度计算思考延迟
    if (this.config.enableThinkingDelay && context?.complexity) {
      delay += context.complexity * 1000;
    }

    // 紧急度减少延迟
    if (context?.urgency) {
      delay *= (1 - context.urgency * 0.5);
    }

    // 根据片段类型调整
    delay *= this.getTypeMultiplier(segment.type);

    // 限制在范围内
    return Math.max(this.config.minDelay, Math.min(this.config.maxDelay, delay));
  }

  /**
   * 是否应该立即触发
   */
  shouldTrigger(segment: TextSegment, context?: DelayContext): boolean {
    const now = Date.now();
    const timeSinceLastTrigger = now - this.lastTriggerTime;

    // 高优先级立即触发
    if (segment.priority >= 8) {
      return true;
    }

    // 问候语立即触发
    if (segment.type === 'greeting') {
      return true;
    }

    // 用户等待时间过长，立即响应
    if (context?.userWaitTime && context.userWaitTime > 5000) {
      return true;
    }

    // 紧急内容立即触发
    if (context?.urgency && context.urgency > 0.8) {
      return true;
    }

    // 检查是否满足最小间隔
    const minInterval = this.config.minDelay;
    if (timeSinceLastTrigger < minInterval) {
      return false;
    }

    return true;
  }

  /**
   * 记录触发时间
   */
  recordTrigger(): void {
    this.lastTriggerTime = Date.now();
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<DelayConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): DelayConfig {
    return { ...this.config };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.lastTriggerTime = 0;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.reset();
  }

  /**
   * 获取类型乘数
   */
  private getTypeMultiplier(type: string): number {
    const multipliers: Record<string, number> = {
      greeting: 0.5,      // 问候语快速响应
      farewell: 0.8,
      question: 1.2,      // 问题需要思考
      answer: 1.0,
      exclamation: 0.7,
      content: 1.0,
      pause: 0,
    };

    return multipliers[type] || 1.0;
  }
}
