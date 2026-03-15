/**
 * Avatar 服务
 * 管理 Live2D 虚拟形象的整体状态和交互
 */

import {
  AvatarState,
  AvatarConfig,
  ExpressionType,
  AnimationType,
  Live2DModelConfig,
  EMOTION_TO_EXPRESSION,
  LipSyncVowel,
} from '../entities/avatar.entity';
import { LipSyncSequence } from './lipsync.engine';
import { ExpressionController } from './expression.controller';
import { LipSyncEngine } from './lipsync.engine';

/** Avatar 事件类型 */
type AvatarEventType =
  | 'expressionChanged'
  | 'lipSyncUpdate'
  | 'animationChanged'
  | 'blink'
  | 'stateChanged';

type AvatarEventHandler = (data: any) => void;

/**
 * Avatar 服务类
 * 提供虚拟形象的完整控制能力
 */
export class AvatarService {
  private state: AvatarState;
  private config: AvatarConfig;
  private expressionController: ExpressionController;
  private lipSyncEngine: LipSyncEngine;
  private eventHandlers: Map<AvatarEventType, AvatarEventHandler[]> = new Map();
  private blinkTimer: NodeJS.Timeout | null = null;
  private idleAnimationTimer: NodeJS.Timeout | null = null;

  constructor(
    avatarId: string,
    sessionId: string,
    config: Partial<AvatarConfig> = {}
  ) {
    // 初始化状态
    this.state = {
      avatarId,
      sessionId,
      currentExpression: ExpressionType.NEUTRAL,
      currentLipSync: { vowel: LipSyncVowel.SILENT, intensity: 0, blendTime: 50 },
      isTalking: false,
      currentAnimation: AnimationType.IDLE,
      position: { x: 0, y: 0 },
      scale: 1,
      opacity: 1,
    };

    // 默认配置
    this.config = {
      model: config.model || this.getDefaultModel(),
      defaultExpression: config.defaultExpression || ExpressionType.NEUTRAL,
      idleAnimations: config.idleAnimations || ['idle1', 'idle2', 'idle3'],
      emotionMappings: { ...EMOTION_TO_EXPRESSION, ...config.emotionMappings },
      lipSyncEnabled: config.lipSyncEnabled ?? true,
      blinkEnabled: config.blinkEnabled ?? true,
      blinkInterval: config.blinkInterval || { min: 2000, max: 6000 },
      breathEnabled: config.breathEnabled ?? true,
    };

    // 初始化控制器
    this.expressionController = new ExpressionController(
      this.state,
      (params) => {
        this.emit('expressionChanged', params);
      }
    );

    this.lipSyncEngine = new LipSyncEngine(this.state, (mouthOpenness, mouthWidth) => {
      this.emit('lipSyncUpdate', { mouthOpenness, mouthWidth });
    });

    // 启动自动行为
    if (this.config.blinkEnabled) {
      this.startBlinking();
    }
    if (this.config.breathEnabled) {
      this.startIdleAnimation();
    }
  }

  /**
   * 获取当前状态
   */
  getState(): AvatarState {
    return { ...this.state };
  }

  /**
   * 获取配置
   */
  getConfig(): AvatarConfig {
    return { ...this.config };
  }

  /**
   * 设置表情
   */
  setExpression(
    expression: ExpressionType | string,
    transitionDuration: number = 300
  ): void {
    const expressionType = typeof expression === 'string'
      ? (ExpressionType[expression.toUpperCase() as keyof typeof ExpressionType] || ExpressionType.NEUTRAL)
      : expression;

    this.expressionController.setExpression(expressionType, transitionDuration);
    this.emit('expressionChanged', { expression: expressionType, duration: transitionDuration });
  }

  /**
   * 根据情感标签设置表情
   */
  setExpressionByEmotion(emotionLabel: string, transitionDuration: number = 300): void {
    const expressionType = this.config.emotionMappings[emotionLabel.toLowerCase()];
    if (expressionType) {
      this.setExpression(expressionType, transitionDuration);
    }
  }

  /**
   * 根据情感指标自动调整表情
   */
  updateExpressionFromEmotionMetrics(metrics: {
    satisfaction: number;
    trust: number;
    frustration: number;
    urgency: number;
    engagement: number;
    confusion: number;
  }): void {
    const params = this.expressionController.calculateExpressionFromEmotion(metrics);
    this.expressionController.setCustomExpression(params, 500);
  }

  /**
   * 说话（带口型同步）
   */
  speak(text: string, duration?: number): void {
    if (!this.config.lipSyncEnabled) {
      return;
    }

    // 生成口型序列
    const sequence = this.lipSyncEngine.generateFromText(text, duration);

    // 播放口型
    this.lipSyncEngine.play(sequence);

    // 切换到说话动画
    this.state.currentAnimation = AnimationType.TALKING;
    this.emit('animationChanged', { animation: AnimationType.TALKING });

    // 播放完成后恢复
    setTimeout(() => {
      this.state.currentAnimation = AnimationType.IDLE;
      this.state.isTalking = false;
      this.emit('animationChanged', { animation: AnimationType.IDLE });
    }, sequence.duration);
  }

  /**
   * 播放口型序列
   */
  playLipSync(sequence: LipSyncSequence): void {
    this.lipSyncEngine.play(sequence);
  }

  /**
   * 停止说话
   */
  stopSpeaking(): void {
    this.lipSyncEngine.stop();
    this.state.currentAnimation = AnimationType.IDLE;
    this.emit('animationChanged', { animation: AnimationType.IDLE });
  }

  /**
   * 播放动画
   */
  playAnimation(animationType: AnimationType, animationName?: string): void {
    this.state.currentAnimation = animationType;
    this.emit('animationChanged', { animation: animationType, name: animationName });
  }

  /**
   * 设置位置
   */
  setPosition(x: number, y: number): void {
    this.state.position = { x, y };
    this.emit('stateChanged', { position: this.state.position });
  }

  /**
   * 设置缩放
   */
  setScale(scale: number): void {
    this.state.scale = scale;
    this.emit('stateChanged', { scale });
  }

  /**
   * 设置透明度
   */
  setOpacity(opacity: number): void {
    this.state.opacity = Math.max(0, Math.min(1, opacity));
    this.emit('stateChanged', { opacity: this.state.opacity });
  }

  /**
   * 显示/隐藏
   */
  show(): void {
    this.setOpacity(1);
  }

  hide(): void {
    this.setOpacity(0);
  }

  /**
   * 订阅事件
   */
  on(event: AvatarEventType, handler: AvatarEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    // 返回取消订阅函数
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 停止所有定时器
    if (this.blinkTimer) {
      clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
    if (this.idleAnimationTimer) {
      clearInterval(this.idleAnimationTimer);
      this.idleAnimationTimer = null;
    }

    // 停止口型同步
    this.lipSyncEngine.stop();

    // 清理事件处理器
    this.eventHandlers.clear();
  }

  /**
   * 触发事件
   */
  private emit(event: AvatarEventType, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in avatar event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * 启动眨眼动画
   */
  private startBlinking(): void {
    const scheduleBlink = () => {
      const interval = this.config.blinkInterval.min +
        Math.random() * (this.config.blinkInterval.max - this.config.blinkInterval.min);

      this.blinkTimer = setTimeout(() => {
        this.emit('blink', { duration: 150 });
        scheduleBlink();
      }, interval);
    };

    scheduleBlink();
  }

  /**
   * 启动待机动画
   */
  private startIdleAnimation(): void {
    // 呼吸效果 - 每50ms更新一次
    this.idleAnimationTimer = setInterval(() => {
      const time = Date.now() / 1000;
      // 正弦波模拟呼吸
      const breathScale = 1 + Math.sin(time * 2) * 0.005;
      this.emit('stateChanged', { breathScale });
    }, 50);
  }

  /**
   * 获取默认模型配置
   */
  private getDefaultModel(): Live2DModelConfig {
    return {
      modelId: 'default-agent',
      name: '默认助手',
      version: '1.0.0',
      modelPath: '/live2d/models/default/model.json',
      texturePath: '/live2d/models/default/texture.png',
    };
  }
}