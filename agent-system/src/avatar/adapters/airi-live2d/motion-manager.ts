/**
 * Live2D 动作管理器
 * 管理模型动作、表情和动画
 * 参考: Airi packages/stage-ui-live2d/src/composables/live2d/motion-manager.ts
 */

import type { InternalModel } from 'pixi-live2d-display';
import { useLive2DIdleEyeFocus, useAutoBlink, useBreathingAnimation } from './animation';

export interface MotionManagerOptions {
  enableBlink?: boolean;
  enableBreath?: boolean;
  enableIdleFocus?: boolean;
}

/**
 * 动作管理器
 */
export class Live2DMotionManager {
  private internalModel: InternalModel | null = null;
  private options: MotionManagerOptions;

  // 动画控制器
  private idleEyeFocus = useLive2DIdleEyeFocus();
  private autoBlink = useAutoBlink();
  private breathing = useBreathingAnimation();

  // 状态
  private isTalking = false;
  private lastUpdateTime = 0;
  private currentMotion: string | null = null;

  constructor(options: MotionManagerOptions = {}) {
    this.options = {
      enableBlink: true,
      enableBreath: true,
      enableIdleFocus: true,
      ...options,
    };
  }

  /**
   * 设置模型
   */
  setModel(model: InternalModel): void {
    this.internalModel = model;
    this.lastUpdateTime = Date.now();
    this.breathing.reset();
  }

  /**
   * 清除模型
   */
  clearModel(): void {
    this.internalModel = null;
    this.currentMotion = null;
  }

  /**
   * 更新循环
   * 应在每一帧调用
   */
  update(): void {
    if (!this.internalModel) return;

    const now = Date.now();
    const timeDelta = this.lastUpdateTime ? now - this.lastUpdateTime : 16;
    this.lastUpdateTime = now;

    const coreModel = this.internalModel.coreModel as any;
    if (!coreModel) return;

    // 1. 空闲注视动画
    if (this.options.enableIdleFocus && !this.isTalking) {
      this.idleEyeFocus.update(this.internalModel, now / 1000);
    }

    // 2. 自动眨眼
    if (this.options.enableBlink) {
      this.updateBlink(timeDelta, coreModel);
    }

    // 3. 呼吸动画
    if (this.options.enableBreath && !this.isTalking) {
      this.breathing.update(this.internalModel);
    }
  }

  /**
   * 更新眨眼
   */
  private updateBlink(timeDelta: number, coreModel: any): void {
    const baseLeft = 1; // 默认完全睁开
    const baseRight = 1;

    const { eyeLOpen, eyeROpen } = this.autoBlink.update(timeDelta, baseLeft, baseRight);

    coreModel.setParameterValueById('ParamEyeLOpen', eyeLOpen);
    coreModel.setParameterValueById('ParamEyeROpen', eyeROpen);
  }

  /**
   * 播放动作
   */
  playMotion(motionName: string, priority: number = 3): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.internalModel) {
        reject(new Error('Model not loaded'));
        return;
      }

      const motionManager = this.internalModel.motionManager;
      if (!motionManager) {
        reject(new Error('Motion manager not available'));
        return;
      }

      // 查找动作组
      const groups = motionManager.groups || {} as Record<string, string>;
      const groupName = (groups as Record<string, string>)[motionName] || motionName;

      try {
        // 播放动作
        motionManager.startMotion(groupName, 0, priority);
        this.currentMotion = motionName;

        // 监听动作完成
        const onMotionEnd = () => {
          this.currentMotion = null;
          resolve();
        };

        // 设置超时作为后备
        setTimeout(onMotionEnd, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 停止当前动作
   */
  stopMotion(): void {
    if (!this.internalModel?.motionManager) return;
    this.internalModel.motionManager.stopAllMotions();
    this.currentMotion = null;
  }

  /**
   * 设置表情
   */
  setExpression(expressionId: string): void {
    if (!this.internalModel) return;

    const expressionManager = (this.internalModel as any).expressionManager;
    if (!expressionManager) return;

    try {
      expressionManager.setExpression(expressionId);
    } catch (error) {
      console.warn('Failed to set expression:', error);
    }
  }

  /**
   * 开始说话 (口型同步)
   */
  startTalking(): void {
    this.isTalking = true;
  }

  /**
   * 停止说话
   */
  stopTalking(): void {
    this.isTalking = false;
  }

  /**
   * 设置口型
   */
  setLipSync(vowel: string, intensity: number): void {
    if (!this.internalModel) return;

    const coreModel = this.internalModel.coreModel as any;
    if (!coreModel) return;

    // 根据元音设置嘴型参数
    const mouthOpenY = intensity;
    let mouthForm = 0;

    switch (vowel.toLowerCase()) {
      case 'a': // 啊 - 张大嘴
        mouthForm = 0;
        break;
      case 'i': // 咿 - 扁嘴
        mouthForm = -1;
        break;
      case 'u': // 呜 - 圆嘴
        mouthForm = 1;
        break;
      case 'e': // 诶 - 中等
        mouthForm = 0.3;
        break;
      case 'o': // 哦 - 圆嘴
        mouthForm = 0.8;
        break;
      default:
        mouthForm = 0;
    }

    coreModel.setParameterValueById('ParamMouthOpenY', mouthOpenY);
    coreModel.setParameterValueById('ParamMouthForm', mouthForm);
  }

  /**
   * 更新模型参数
   */
  setParameter(paramId: string, value: number): void {
    if (!this.internalModel) return;
    const coreModel = this.internalModel.coreModel as any;
    if (!coreModel) return;

    coreModel.setParameterValueById(paramId, value);
  }

  /**
   * 获取模型参数
   */
  getParameter(paramId: string): number {
    if (!this.internalModel) return 0;
    const coreModel = this.internalModel.coreModel as any;
    if (!coreModel) return 0;

    return coreModel.getParameterValueById(paramId) || 0;
  }

  /**
   * 获取当前动作
   */
  getCurrentMotion(): string | null {
    return this.currentMotion;
  }

  /**
   * 是否正在说话
   */
  isTalkingState(): boolean {
    return this.isTalking;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.clearModel();
  }
}
