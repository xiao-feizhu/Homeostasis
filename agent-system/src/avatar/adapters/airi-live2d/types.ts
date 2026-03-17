/**
 * Airi Live2D 适配器类型定义
 * 用于将 Airi 的 Live2D 实现适配到现有 Agent System
 */

import { ExpressionType, Live2DModelConfig } from '../../entities/avatar.entity';

/**
 * Airi 表情映射配置
 */
export interface AiriEmotionMapping {
  /** 现有系统的 ExpressionType */
  sourceExpression: ExpressionType;
  /** Airi 的表情名称 */
  airiMotionName: string;
  /** Airi 的表情参数 (可选) */
  airiExpression?: string;
}

/**
 * Live2D 模型加载配置
 */
export interface Live2DLoadConfig {
  /** 模型配置 */
  modelConfig: Live2DModelConfig;
  /** Canvas 元素或 ID */
  canvas: HTMLCanvasElement | string;
  /** 加载选项 */
  options?: {
    /** 自动播放待机动画 */
    autoIdle?: boolean;
    /** 背景透明 */
    transparentBackground?: boolean;
  };
}

/**
 * 动作管理器配置
 */
export interface MotionManagerConfig {
  /** 启用眨眼 */
  enableBlink?: boolean;
  /** 启用呼吸动画 */
  enableBreath?: boolean;
  /** 启用待机动画 */
  enableIdle?: boolean;
  /** 眨眼间隔范围 (ms) */
  blinkInterval?: { min: number; max: number };
}

/**
 * 适配器事件回调
 */
export interface AiriLive2DEventHandlers {
  /** 模型加载完成 */
  onModelLoaded?: () => void;
  /** 模型加载失败 */
  onModelError?: (error: Error) => void;
  /** 动作开始 */
  onMotionStart?: (motionName: string) => void;
  /** 动作结束 */
  onMotionEnd?: (motionName: string) => void;
  /** 表情变化 */
  onExpressionChange?: (expression: ExpressionType) => void;
}

/**
 * Airi Live2D 适配器接口
 * 抽象 Airi 的具体实现，提供与现有系统兼容的 API
 */
export interface IAiriLive2DAdapter {
  /** 初始化适配器 */
  initialize(config: Live2DLoadConfig): Promise<void>;
  /** 销毁适配器 */
  destroy(): void;
  /** 加载模型 */
  loadModel(modelConfig: Live2DModelConfig): Promise<void>;
  /** 卸载模型 */
  unloadModel(): void;
  /** 设置表情 */
  setExpression(expression: ExpressionType): Promise<void>;
  /** 播放动作 */
  playMotion(motionName: string, priority?: number): Promise<void>;
  /** 停止当前动作 */
  stopMotion(): void;
  /** 更新模型参数 */
  updateParameter(paramId: string, value: number): void;
  /** 获取模型参数 */
  getParameter(paramId: string): number;
  /** 设置缩放 */
  setScale(scale: number): void;
  /** 设置位置 */
  setPosition(x: number, y: number): void;
  /** 开始说话 (口型同步) */
  startTalking(): void;
  /** 停止说话 */
  stopTalking(): void;
  /** 设置口型 */
  setLipSync(vowel: string, intensity: number): void;
  /** 是否已加载 */
  isLoaded(): boolean;
  /** 获取当前表情 */
  getCurrentExpression(): ExpressionType;
}

/**
 * 适配器状态
 */
export interface AiriLive2DAdapterState {
  isInitialized: boolean;
  isModelLoaded: boolean;
  currentExpression: ExpressionType;
  currentMotion: string | null;
  isTalking: boolean;
  scale: number;
  position: { x: number; y: number };
}
