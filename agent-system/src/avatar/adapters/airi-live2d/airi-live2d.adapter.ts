/**
 * Airi Live2D 适配器实现
 * TDD: 先抛出错误，等待测试驱动实现
 */

import { ExpressionType, Live2DModelConfig } from '../../entities/avatar.entity';
import {
  IAiriLive2DAdapter,
  Live2DLoadConfig,
  AiriLive2DAdapterState,
} from './types';
import { EmotionMapper } from './emotion-mapper';

/**
 * Airi Live2D 适配器
 * 包装 Airi 的 Live2D 实现，提供统一的 API
 */
export class AiriLive2DAdapter implements IAiriLive2DAdapter {
  private state: AiriLive2DAdapterState;
  private emotionMapper: EmotionMapper;

  constructor(emotionMapper?: EmotionMapper) {
    this.emotionMapper = emotionMapper || new EmotionMapper();
    this.state = {
      isInitialized: false,
      isModelLoaded: false,
      currentExpression: ExpressionType.NEUTRAL,
      currentMotion: null,
      isTalking: false,
      scale: 1,
      position: { x: 0, y: 0 },
    };
  }

  async initialize(_config: Live2DLoadConfig): Promise<void> {
    throw new Error('Not implemented');
  }

  destroy(): void {
    throw new Error('Not implemented');
  }

  async loadModel(_modelConfig: Live2DModelConfig): Promise<void> {
    throw new Error('Not implemented');
  }

  unloadModel(): void {
    throw new Error('Not implemented');
  }

  async setExpression(_expression: ExpressionType): Promise<void> {
    throw new Error('Not implemented');
  }

  async playMotion(_motionName: string, _priority?: number): Promise<void> {
    throw new Error('Not implemented');
  }

  stopMotion(): void {
    throw new Error('Not implemented');
  }

  updateParameter(_paramId: string, _value: number): void {
    throw new Error('Not implemented');
  }

  getParameter(_paramId: string): number {
    throw new Error('Not implemented');
  }

  setScale(scale: number): void {
    this.state.scale = scale;
  }

  setPosition(x: number, y: number): void {
    this.state.position = { x, y };
  }

  startTalking(): void {
    throw new Error('Not implemented');
  }

  stopTalking(): void {
    throw new Error('Not implemented');
  }

  setLipSync(_vowel: string, _intensity: number): void {
    throw new Error('Not implemented');
  }

  isLoaded(): boolean {
    return this.state.isModelLoaded;
  }

  getCurrentExpression(): ExpressionType {
    return this.state.currentExpression;
  }

  /**
   * 获取当前状态 (用于测试)
   */
  getState(): AiriLive2DAdapterState {
    return { ...this.state };
  }

  /**
   * 获取表情映射器
   */
  getEmotionMapper(): EmotionMapper {
    return this.emotionMapper;
  }
}
