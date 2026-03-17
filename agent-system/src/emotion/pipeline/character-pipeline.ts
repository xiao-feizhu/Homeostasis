/**
 * Character Pipeline
 * 核心角色管线 - 协调分段、情感、延迟、TTS
 * 事件驱动的处理管线
 */

import { SegmentationEngine, TextSegment } from './segmentation';
import { DelayController } from './delay-controller';
import { TTSConnector, TTSRequest, TTSResult } from './tts-connector';
import { EmotionMetrics } from '../entities/emotion.entity';

/** 管线事件类型 */
export enum PipelineEventType {
  SEGMENT_CREATED = 'segment_created',
  SEGMENT_PROCESSING = 'segment_processing',
  TTS_STARTED = 'tts_started',
  TTS_COMPLETED = 'tts_completed',
  TTS_FAILED = 'tts_failed',
  EMOTION_UPDATED = 'emotion_updated',
  PIPELINE_PAUSED = 'pipeline_paused',
  PIPELINE_RESUMED = 'pipeline_resumed',
  PIPELINE_ERROR = 'pipeline_error',
}

/** 管线事件 */
export interface PipelineEvent {
  type: PipelineEventType;
  timestamp: number;
  data: Record<string, any>;
}

/** 管线输入 */
export interface PipelineInput {
  text: string;
  userId: string;
  sessionId: string;
  context?: {
    previousEmotion?: EmotionMetrics;
    urgency?: number;
    priority?: number;
  };
}

/** 管线输出 */
export interface PipelineOutput {
  segments: ProcessedSegment[];
  totalDuration: number;
  emotionTimeline: EmotionMetrics[];
}

/** 处理后的片段 */
export interface ProcessedSegment {
  segment: TextSegment;
  ttsResult?: TTSResult;
  processingTime: number;
  emotionSnapshot: EmotionMetrics;
  emotionMetrics: EmotionMetrics;
}

/** 情感快照 */
interface EmotionSnapshot {
  timestamp: number;
  metrics: EmotionMetrics;
  triggerSegment?: string;
}

/** 事件处理器 */
type EventHandler = (event: PipelineEvent) => void;

/** 管线配置 */
export interface PipelineConfig {
  segmentation?: SegmentationEngine;
  delayController?: DelayController;
  tts?: TTSConnector;
  maxQueueSize?: number;
  enableEmotionTracking?: boolean;
}

/** 管线状态 */
export interface PipelineState {
  isRunning: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  processedCount: number;
  errorCount: number;
  averageProcessingTime: number;
}

/**
 * 角色管线
 * 协调输入分段、情感分析、延迟控制和 TTS 生成
 */
export class CharacterPipeline {
  private segmentation: SegmentationEngine;
  private delayController: DelayController;
  private tts: TTSConnector;
  private eventHandlers: Map<PipelineEventType, Set<EventHandler>> = new Map();
  private state: PipelineState;
  private segmentQueue: TextSegment[] = [];
  private emotionHistory: EmotionSnapshot[] = [];
  private maxQueueSize: number;
  private enableEmotionTracking: boolean;
  private currentEmotion: EmotionMetrics | null = null;

  constructor(config: PipelineConfig = {}) {
    this.segmentation = config.segmentation || new SegmentationEngine();
    this.delayController = config.delayController || new DelayController();
    this.tts = config.tts || new TTSConnector();
    this.maxQueueSize = config.maxQueueSize || 100;
    this.enableEmotionTracking = config.enableEmotionTracking ?? true;

    this.state = {
      isRunning: false,
      isPaused: false,
      isProcessing: false,
      processedCount: 0,
      errorCount: 0,
      averageProcessingTime: 0,
    };
  }

  /**
   * 初始化管线
   */
  async initialize(): Promise<void> {
    if (this.state.isRunning) {
      return;
    }

    await this.tts.initialize?.();

    this.state.isRunning = true;
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * 获取当前状态
   */
  getState(): PipelineState {
    return { ...this.state };
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.segmentQueue.length;
  }

  /**
   * 处理输入文本
   */
  async processInput(input: PipelineInput): Promise<PipelineOutput> {
    this.ensureInitialized();

    const startTime = Date.now();
    this.state.isProcessing = true;

    try {
      // 1. 分段
      const segments = this.segmentation.segment(input.text, input.context);

      // 2. 更新当前情感上下文
      if (input.context?.previousEmotion) {
        this.currentEmotion = input.context.previousEmotion;
      }

      // 3. 处理每个片段
      const processedSegments: ProcessedSegment[] = [];
      const emotionTimeline: EmotionMetrics[] = [];

      for (const segment of segments) {
        this.emit(PipelineEventType.SEGMENT_CREATED, {
          segment,
          userId: input.userId,
          sessionId: input.sessionId,
        });

        // 如果暂停，加入队列等待
        if (this.state.isPaused) {
          this.addToQueue(segment);
          continue;
        }

        const processed = await this.processSegmentInternal(segment);
        processedSegments.push(processed);

        if (processed.emotionMetrics) {
          emotionTimeline.push(processed.emotionMetrics);
        }
      }

      // 4. 处理队列中的片段
      while (!this.state.isPaused && this.segmentQueue.length > 0) {
        const segment = this.segmentQueue.shift()!;
        const processed = await this.processSegmentInternal(segment);
        processedSegments.push(processed);

        if (processed.emotionMetrics) {
          emotionTimeline.push(processed.emotionMetrics);
        }
      }

      return {
        segments: processedSegments,
        totalDuration: Date.now() - startTime,
        emotionTimeline,
      };
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * 处理单个片段
   */
  async processSegment(segment: TextSegment): Promise<ProcessedSegment> {
    this.ensureInitialized();
    return this.processSegmentInternal(segment);
  }

  /**
   * 注册事件处理器
   */
  on(eventType: PipelineEventType, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * 暂停管线
   */
  pause(): void {
    this.state.isPaused = true;
    this.emit(PipelineEventType.PIPELINE_PAUSED, {});
  }

  /**
   * 恢复管线
   */
  resume(): void {
    this.state.isPaused = false;
    this.emit(PipelineEventType.PIPELINE_RESUMED, {});

    // 处理队列中的片段
    void this.processQueue();
  }

  /**
   * 销毁管线
   */
  destroy(): void {
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.segmentQueue = [];
    this.emotionHistory = [];
    this.eventHandlers.clear();

    this.tts.destroy?.();
    this.delayController.destroy?.();
  }

  /**
   * 获取情感历史
   */
  getEmotionHistory(): EmotionSnapshot[] {
    return [...this.emotionHistory];
  }

  /**
   * 获取当前情感
   */
  getCurrentEmotion(): EmotionMetrics | null {
    return this.currentEmotion ? { ...this.currentEmotion } : null;
  }

  /**
   * 内部：处理单个片段
   */
  private async processSegmentInternal(segment: TextSegment): Promise<ProcessedSegment> {
    const startTime = Date.now();

    this.emit(PipelineEventType.SEGMENT_PROCESSING, {
      segmentId: segment.id,
      text: segment.text,
    });

    // 1. 检查延迟控制
    if (!this.delayController.shouldTrigger(segment)) {
      this.addToQueue(segment);
      const emotionSnapshot = this.captureEmotionSnapshot(segment.id);
      return {
        segment,
        processingTime: 0,
        emotionSnapshot,
        emotionMetrics: emotionSnapshot,
      };
    }

    // 2. 计算延迟
    const delay = this.delayController.calculateDelay(segment);
    if (delay > 0) {
      await this.sleep(delay);
    }

    // 3. TTS 合成
    let ttsResult: TTSResult | undefined;

    try {
      this.emit(PipelineEventType.TTS_STARTED, {
        segmentId: segment.id,
        text: segment.text,
      });

      const ttsRequest: TTSRequest = {
        text: segment.text,
        emotion: segment.emotionHint || 'neutral',
        emotionIntensity: segment.emotion ? this.calculateEmotionIntensity(segment.emotion) : 0.5,
        priority: segment.priority,
      };

      ttsResult = await this.tts.synthesize(ttsRequest);

      this.emit(PipelineEventType.TTS_COMPLETED, {
        segmentId: segment.id,
        audioUrl: ttsResult.audioUrl,
        duration: ttsResult.duration,
      });
    } catch (error) {
      this.state.errorCount++;
      this.emit(PipelineEventType.TTS_FAILED, {
        segmentId: segment.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 4. 更新统计
    const processingTime = Date.now() - startTime;
    this.updateProcessingStats(processingTime);

    // 5. 捕获情感快照
    const emotionMetrics = this.captureEmotionSnapshot(segment.id);

    return {
      segment,
      ttsResult,
      processingTime,
      emotionSnapshot: emotionMetrics,
      emotionMetrics,
    };
  }

  /**
   * 内部：处理队列
   */
  private async processQueue(): Promise<void> {
    while (!this.state.isPaused && this.segmentQueue.length > 0 && this.state.isRunning) {
      const segment = this.segmentQueue.shift()!;
      await this.processSegmentInternal(segment);
    }
  }

  /**
   * 内部：添加到队列
   */
  private addToQueue(segment: TextSegment): void {
    if (this.segmentQueue.length < this.maxQueueSize) {
      this.segmentQueue.push(segment);
    } else {
      console.warn('Pipeline queue full, dropping segment:', segment.id);
    }
  }

  /**
   * 内部：确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.state.isRunning) {
      throw new Error('Pipeline not initialized');
    }
  }

  /**
   * 内部：发送事件
   */
  private emit(type: PipelineEventType, data: Record<string, any>): void {
    const handlers = this.eventHandlers.get(type);
    if (!handlers) return;

    const event: PipelineEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    });
  }

  /**
   * 内部：更新处理统计
   */
  private updateProcessingStats(processingTime: number): void {
    this.state.processedCount++;

    // 移动平均
    const n = this.state.processedCount;
    this.state.averageProcessingTime =
      (this.state.averageProcessingTime * (n - 1) + processingTime) / n;
  }

  /**
   * 内部：捕获情感快照
   */
  private captureEmotionSnapshot(triggerSegment?: string): EmotionMetrics {
    // 如果片段有情感数据，使用片段的
    // 否则使用当前上下文情感
    const snapshot: EmotionSnapshot = {
      timestamp: Date.now(),
      metrics: this.currentEmotion || this.getDefaultEmotion(),
      triggerSegment,
    };

    if (this.enableEmotionTracking) {
      this.emotionHistory.push(snapshot);

      // 限制历史记录大小
      if (this.emotionHistory.length > 1000) {
        this.emotionHistory.shift();
      }
    }

    return snapshot.metrics;
  }

  /**
   * 内部：计算情感强度
   */
  private calculateEmotionIntensity(emotion: EmotionMetrics): number {
    // 基于满意度和挫败感计算整体情感强度
    const positive = emotion.satisfaction / 100;
    const negative = emotion.frustration / 100;
    const engagement = emotion.engagement / 100;

    // 强度 = (正面 + 负面) * 参与度
    return Math.min(1, (positive + negative) * (0.5 + engagement * 0.5));
  }

  /**
   * 内部：获取默认情感
   */
  private getDefaultEmotion(): EmotionMetrics {
    return {
      satisfaction: 50,
      trust: 50,
      frustration: 0,
      urgency: 0,
      engagement: 50,
      confusion: 0,
    };
  }

  /**
   * 内部：延时
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
