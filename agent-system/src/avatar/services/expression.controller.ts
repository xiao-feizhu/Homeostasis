/**
 * 表情控制器
 * 管理 Live2D 虚拟形象的表情状态和过渡
 */

import {
  ExpressionType,
  ExpressionParams,
  PRESET_EXPRESSIONS,
  AvatarState,
} from '../entities/avatar.entity';

/** 表情过渡配置 */
interface TransitionConfig {
  duration: number;     // 过渡时间 (ms)
  easing: EasingFunction;
}

type EasingFunction = (t: number) => number;

/** 缓动函数 */
const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  elastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
};

/** 表情控制器类 */
export class ExpressionController {
  private currentParams: ExpressionParams;
  private targetParams: ExpressionParams;
  private transitionStartTime: number = 0;
  private transitionDuration: number = 0;
  private isTransitioning: boolean = false;
  private easingFunction: EasingFunction = EASING_FUNCTIONS.easeInOut;

  constructor(
    private avatarState: AvatarState,
    private onParamsUpdate?: (params: ExpressionParams) => void
  ) {
    // 初始化为默认表情参数
    this.currentParams = { ...PRESET_EXPRESSIONS[ExpressionType.NEUTRAL] };
    this.targetParams = { ...this.currentParams };
  }

  /**
   * 设置表情
   * @param expressionType 表情类型
   * @param transitionDuration 过渡时间 (ms)，默认 300ms
   * @param easing 缓动函数名称
   */
  setExpression(
    expressionType: ExpressionType,
    transitionDuration: number = 300,
    easing: string = 'easeInOut'
  ): void {
    const presetParams = PRESET_EXPRESSIONS[expressionType];
    if (!presetParams) {
      throw new Error(`Unknown expression type: ${expressionType}`);
    }

    this.targetParams = { ...presetParams };
    this.avatarState.currentExpression = expressionType;
    this.transitionDuration = transitionDuration;
    this.easingFunction = EASING_FUNCTIONS[easing] || EASING_FUNCTIONS.easeInOut;
    this.transitionStartTime = Date.now();
    this.isTransitioning = true;

    // 立即开始动画循环
    this.startTransitionLoop();
  }

  /**
   * 设置自定义表情参数
   * @param params 自定义参数
   * @param transitionDuration 过渡时间
   * @param easing 缓动函数
   */
  setCustomExpression(
    params: Partial<ExpressionParams>,
    transitionDuration: number = 300,
    easing: string = 'easeInOut'
  ): void {
    this.targetParams = {
      ...this.currentParams,
      ...params,
    };
    this.transitionDuration = transitionDuration;
    this.easingFunction = EASING_FUNCTIONS[easing] || EASING_FUNCTIONS.easeInOut;
    this.transitionStartTime = Date.now();
    this.isTransitioning = true;
    this.avatarState.currentExpression = ExpressionType.NEUTRAL; // 自定义表情标记为中性

    this.startTransitionLoop();
  }

  /**
   * 根据情感指标计算表情参数
   * @param emotionMetrics 情感指标
   * @returns 计算后的表情参数
   */
  calculateExpressionFromEmotion(emotionMetrics: {
    satisfaction: number;
    trust: number;
    frustration: number;
    urgency: number;
    engagement: number;
    confusion: number;
  }): ExpressionParams {
    const base = { ...PRESET_EXPRESSIONS[ExpressionType.NEUTRAL] };

    // 满意度影响整体表情基调
    if (emotionMetrics.satisfaction > 70) {
      // 高兴
      base.eyebrowAngle = -0.3;
      base.mouthOpenness = 0.3;
      base.mouthWidth = 0.7;
      base.cheekTint = 0.2;
    } else if (emotionMetrics.satisfaction < 30) {
      // 不满
      base.eyebrowAngle = 0.2;
      base.mouthOpenness = 0.1;
      base.mouthWidth = 0.4;
    }

    // 挫败感影响眉毛和眼睛
    if (emotionMetrics.frustration > 60) {
      base.eyebrowAngle = -0.5;
      base.eyebrowHeight = 0.2;
      base.sweatLevel = 0.3;
    }

    // 困惑度影响眼神和汗珠
    if (emotionMetrics.confusion > 50) {
      base.eyeOpenness = 0.7;
      base.sweatLevel = Math.max(base.sweatLevel, 0.2);
    }

    // 紧急度影响眼睛睁大和眉毛
    if (emotionMetrics.urgency > 70) {
      base.eyeOpenness = 1.1;
      base.eyebrowHeight = 0.3;
    }

    // 信任度低时眼神躲闪
    if (emotionMetrics.trust < 40) {
      base.eyeOpenness = 0.6;
    }

    // 参与度影响整体活跃度
    if (emotionMetrics.engagement < 30) {
      base.eyeOpenness *= 0.8;
      base.mouthOpenness *= 0.5;
    }

    return base;
  }

  /**
   * 获取当前表情参数（用于渲染）
   */
  getCurrentParams(): ExpressionParams {
    return { ...this.currentParams };
  }

  /**
   * 获取当前表情类型
   */
  getCurrentExpression(): ExpressionType {
    return this.avatarState.currentExpression;
  }

  /**
   * 停止当前过渡
   */
  stopTransition(): void {
    this.isTransitioning = false;
  }

  /**
   * 开始过渡动画循环
   */
  private startTransitionLoop(): void {
    const animate = () => {
      if (!this.isTransitioning) return;

      const now = Date.now();
      const elapsed = now - this.transitionStartTime;
      const progress = Math.min(elapsed / this.transitionDuration, 1);
      const easedProgress = this.easingFunction(progress);

      // 插值计算当前参数
      this.currentParams = this.interpolateParams(
        this.currentParams,
        this.targetParams,
        easedProgress
      );

      // 通知更新
      this.onParamsUpdate?.(this.currentParams);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isTransitioning = false;
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * 参数插值
   */
  private interpolateParams(
    current: ExpressionParams,
    target: ExpressionParams,
    t: number
  ): ExpressionParams {
    const lerp = (a: number, b: number, factor: number) => a + (b - a) * factor;

    return {
      eyebrowAngle: lerp(current.eyebrowAngle, target.eyebrowAngle, t),
      eyebrowHeight: lerp(current.eyebrowHeight, target.eyebrowHeight, t),
      eyeOpenness: lerp(current.eyeOpenness, target.eyeOpenness, t),
      mouthOpenness: lerp(current.mouthOpenness, target.mouthOpenness, t),
      mouthWidth: lerp(current.mouthWidth, target.mouthWidth, t),
      cheekTint: lerp(current.cheekTint, target.cheekTint, t),
      tearLevel: lerp(current.tearLevel, target.tearLevel, t),
      sweatLevel: lerp(current.sweatLevel, target.sweatLevel, t),
    };
  }
}
