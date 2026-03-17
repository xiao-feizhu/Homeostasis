/**
 * Airi Live2D 适配器实现
 * 集成 PixiJS + pixi-live2d-display
 */

import { Application, Container } from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import { ExpressionType, Live2DModelConfig } from '../../entities/avatar.entity';
import {
  IAiriLive2DAdapter,
  Live2DLoadConfig,
  AiriLive2DAdapterState,
  AiriLive2DEventHandlers,
} from './types';
import { EmotionMapper } from './emotion-mapper';
import { Live2DMotionManager } from './motion-manager';

/**
 * Airi Live2D 适配器
 * 包装 Airi 的 Live2D 实现，提供统一的 API
 */
export class AiriLive2DAdapter implements IAiriLive2DAdapter {
  private state: AiriLive2DAdapterState;
  private emotionMapper: EmotionMapper;
  private motionManager: Live2DMotionManager;
  private eventHandlers: AiriLive2DEventHandlers = {};

  // PixiJS 相关
  private pixiApp: Application | null = null;
  private live2dModel: Live2DModel | null = null;
  private modelContainer: Container | null = null;

  // 配置
  private canvasElement: HTMLCanvasElement | null = null;
  private animationFrameId: number | null = null;

  constructor(emotionMapper?: EmotionMapper, motionManagerOptions?: { enableBlink?: boolean; enableBreath?: boolean }) {
    this.emotionMapper = emotionMapper || new EmotionMapper();
    this.motionManager = new Live2DMotionManager({
      enableBlink: motionManagerOptions?.enableBlink ?? true,
      enableBreath: motionManagerOptions?.enableBreath ?? true,
    });
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

  /**
   * 设置事件处理器
   */
  setEventHandlers(handlers: AiriLive2DEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  async initialize(config: Live2DLoadConfig): Promise<void> {
    if (this.state.isInitialized) {
      throw new Error('Adapter already initialized');
    }

    try {
      // 获取 canvas 元素
      const canvas = typeof config.canvas === 'string'
        ? document.getElementById(config.canvas) as HTMLCanvasElement
        : config.canvas;

      if (!canvas) {
        throw new Error('Canvas element not found');
      }

      this.canvasElement = canvas;

      // 创建 PixiJS 应用
      this.pixiApp = new Application({
        view: canvas,
        resizeTo: canvas,
        backgroundAlpha: config.options?.transparentBackground ? 0 : 1,
        backgroundColor: config.options?.transparentBackground ? undefined : 0x000000,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      // 创建容器
      this.modelContainer = new Container();
      this.pixiApp.stage.addChild(this.modelContainer);

      // 设置初始位置
      this.updateContainerPosition();

      // 启动更新循环
      this.startUpdateLoop();

      this.state.isInitialized = true;

      // 加载模型（如果提供了配置）
      if (config.modelConfig) {
        await this.loadModel(config.modelConfig);
      }

      this.eventHandlers.onModelLoaded?.();
    } catch (error) {
      this.eventHandlers.onModelError?.(error as Error);
      throw error;
    }
  }

  destroy(): void {
    this.stopUpdateLoop();

    this.motionManager.destroy();

    if (this.live2dModel) {
      this.live2dModel.destroy();
      this.live2dModel = null;
    }

    if (this.modelContainer) {
      this.modelContainer.destroy({ children: true });
      this.modelContainer = null;
    }

    if (this.pixiApp) {
      this.pixiApp.destroy(true);
      this.pixiApp = null;
    }

    this.canvasElement = null;
    this.state.isInitialized = false;
    this.state.isModelLoaded = false;
  }

  async loadModel(modelConfig: Live2DModelConfig): Promise<void> {
    if (!this.pixiApp || !this.modelContainer) {
      throw new Error('Adapter not initialized');
    }

    try {
      // 卸载旧模型
      this.unloadModel();

      // 加载新模型
      const model = await Live2DModel.from(modelConfig.modelPath, {
        autoUpdate: false, // 我们手动更新
      });

      this.live2dModel = model;

      // 设置模型容器
      this.modelContainer.addChild(model);

      // 设置缩放和位置
      model.scale.set(this.state.scale);
      model.anchor.set(0.5, 0.5);

      // 居中
      const canvasWidth = this.canvasElement?.width || 800;
      const canvasHeight = this.canvasElement?.height || 600;
      model.position.set(canvasWidth / 2, canvasHeight / 2);

      // 设置动作管理器
      if (model.internalModel) {
        this.motionManager.setModel(model.internalModel);
      }

      this.state.isModelLoaded = true;

      // 播放待机动画
      try {
        await this.playMotion('Idle', 1);
      } catch {
        // 忽略待机动画错误
      }
    } catch (error) {
      this.eventHandlers.onModelError?.(error as Error);
      throw error;
    }
  }

  unloadModel(): void {
    if (this.live2dModel) {
      this.modelContainer?.removeChild(this.live2dModel);
      this.live2dModel.destroy();
      this.live2dModel = null;
    }

    this.motionManager.clearModel();
    this.state.isModelLoaded = false;
    this.state.currentMotion = null;
  }

  async setExpression(expression: ExpressionType): Promise<void> {
    if (!this.state.isModelLoaded) {
      throw new Error('Model not loaded');
    }

    const airiMotionName = this.emotionMapper.mapToAiriMotion(expression);

    try {
      await this.playMotion(airiMotionName, 3);
      this.state.currentExpression = expression;
      this.eventHandlers.onExpressionChange?.(expression);
    } catch (error) {
      console.warn('Failed to set expression:', error);
      // 即使失败也更新状态
      this.state.currentExpression = expression;
    }
  }

  async playMotion(motionName: string, priority?: number): Promise<void> {
    if (!this.state.isModelLoaded) {
      throw new Error('Model not loaded');
    }

    this.eventHandlers.onMotionStart?.(motionName);

    try {
      await this.motionManager.playMotion(motionName, priority);
      this.state.currentMotion = motionName;
    } finally {
      this.eventHandlers.onMotionEnd?.(motionName);
    }
  }

  stopMotion(): void {
    this.motionManager.stopMotion();
    this.state.currentMotion = null;
  }

  updateParameter(paramId: string, value: number): void {
    this.motionManager.setParameter(paramId, value);
  }

  getParameter(paramId: string): number {
    return this.motionManager.getParameter(paramId);
  }

  setScale(scale: number): void {
    this.state.scale = scale;

    if (this.live2dModel) {
      this.live2dModel.scale.set(scale);
    }

    this.updateContainerPosition();
  }

  setPosition(x: number, y: number): void {
    this.state.position = { x, y };
    this.updateContainerPosition();
  }

  startTalking(): void {
    this.state.isTalking = true;
    this.motionManager.startTalking();
  }

  stopTalking(): void {
    this.state.isTalking = false;
    this.motionManager.stopTalking();

    // 重置嘴型
    this.motionManager.setParameter('ParamMouthOpenY', 0);
    this.motionManager.setParameter('ParamMouthForm', 0);
  }

  setLipSync(vowel: string, intensity: number): void {
    if (!this.state.isTalking) return;
    this.motionManager.setLipSync(vowel, intensity);
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

  /**
   * 获取动作管理器
   */
  getMotionManager(): Live2DMotionManager {
    return this.motionManager;
  }

  /**
   * 获取 PixiJS 应用 (用于高级操作)
   */
  getPixiApp(): Application | null {
    return this.pixiApp;
  }

  /**
   * 获取 Live2D 模型 (用于高级操作)
   */
  getLive2DModel(): Live2DModel | null {
    return this.live2dModel;
  }

  /**
   * 更新容器位置
   */
  private updateContainerPosition(): void {
    if (!this.modelContainer || !this.canvasElement) return;

    const canvasWidth = this.canvasElement.width;
    const canvasHeight = this.canvasElement.height;

    const centerX = canvasWidth / 2 + this.state.position.x;
    const centerY = canvasHeight / 2 + this.state.position.y;

    this.modelContainer.position.set(centerX, centerY);
  }

  /**
   * 启动更新循环
   */
  private startUpdateLoop(): void {
    const update = () => {
      // 更新动作管理器
      this.motionManager.update();

      // 更新 PixiJS ticker
      this.pixiApp?.ticker.update();

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * 停止更新循环
   */
  private stopUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
