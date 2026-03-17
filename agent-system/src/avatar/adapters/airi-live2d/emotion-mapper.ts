/**
 * 表情映射器
 * 将现有系统的 ExpressionType 映射到 Airi 的表情系统
 */

import { ExpressionType } from '../../entities/avatar.entity';
import { AiriEmotionMapping } from './types';

/**
 * Airi 支持的表情动作名称
 * 参考: packages/stage-ui-live2d/src/constants/emotions.ts
 */
export enum AiriEmotion {
  Happy = 'happy',
  Sad = 'sad',
  Angry = 'angry',
  Think = 'think',
  Surprise = 'surprised',
  Awkward = 'awkward',
  Question = 'question',
  Curious = 'curious',
  Neutral = 'neutral',
}

/**
 * 默认表情映射配置
 * 现有系统 (10种) -> Airi (9种)
 */
export const DEFAULT_EMOTION_MAPPINGS: AiriEmotionMapping[] = [
  { sourceExpression: ExpressionType.NEUTRAL, airiMotionName: 'Idle' },
  { sourceExpression: ExpressionType.HAPPY, airiMotionName: 'Happy' },
  { sourceExpression: ExpressionType.SAD, airiMotionName: 'Sad' },
  { sourceExpression: ExpressionType.ANGRY, airiMotionName: 'Angry' },
  { sourceExpression: ExpressionType.SURPRISED, airiMotionName: 'Surprise' },
  { sourceExpression: ExpressionType.CONFUSED, airiMotionName: 'Think' },
  { sourceExpression: ExpressionType.THINKING, airiMotionName: 'Think' },
  { sourceExpression: ExpressionType.CONCERNED, airiMotionName: 'Awkward' },
  { sourceExpression: ExpressionType.EXCITED, airiMotionName: 'Happy' },
  { sourceExpression: ExpressionType.WORRIED, airiMotionName: 'Sad' },
];

/**
 * 表情映射器类
 */
export class EmotionMapper {
  private mappings: Map<ExpressionType, AiriEmotionMapping>;

  constructor(customMappings?: AiriEmotionMapping[]) {
    this.mappings = new Map();
    const mappings = customMappings || DEFAULT_EMOTION_MAPPINGS;

    for (const mapping of mappings) {
      this.mappings.set(mapping.sourceExpression, mapping);
    }
  }

  /**
   * 映射 ExpressionType 到 Airi 动作名称
   */
  mapToAiriMotion(expression: ExpressionType): string {
    const mapping = this.mappings.get(expression);
    if (!mapping) {
      // 默认返回 Idle
      return 'Idle';
    }
    return mapping.airiMotionName;
  }

  /**
   * 映射 ExpressionType 到 Airi 表情名称
   */
  mapToAiriExpression(expression: ExpressionType): string | undefined {
    const mapping = this.mappings.get(expression);
    return mapping?.airiExpression;
  }

  /**
   * 获取所有映射
   */
  getAllMappings(): AiriEmotionMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * 更新映射
   */
  updateMapping(expression: ExpressionType, airiMotionName: string, airiExpression?: string): void {
    this.mappings.set(expression, {
      sourceExpression: expression,
      airiMotionName,
      airiExpression,
    });
  }

  /**
   * 检查是否支持某个表情
   */
  supportsExpression(expression: ExpressionType): boolean {
    return this.mappings.has(expression);
  }
}

/**
 * 创建默认表情映射器
 */
export function createDefaultEmotionMapper(): EmotionMapper {
  return new EmotionMapper(DEFAULT_EMOTION_MAPPINGS);
}
