/**
 * VAD Engine
 * 语音活动检测引擎
 */

export interface VADConfig {
  sampleRate?: number;
  frameDuration?: number;      // 帧时长 (ms)
  threshold?: number;          // 检测阈值 (0-1)
  minSilenceDuration?: number; // 最小静音时长 (ms)
  minSpeechDuration?: number;  // 最小语音时长 (ms)
  preSpeechPadding?: number;   // 前置缓冲 (ms)
  postSpeechPadding?: number;  // 后置缓冲 (ms)
}

export interface VADEvent {
  type: 'speech_start' | 'speech_end' | 'speech_ongoing';
  timestamp: number;
  duration?: number;
  confidence: number;
}

export interface VADState {
  isSpeech: boolean;
  speechDuration: number;
  silenceDuration: number;
  confidence: number;
}

const DEFAULT_CONFIG: Required<VADConfig> = {
  sampleRate: 16000,
  frameDuration: 30,
  threshold: 0.15,
  minSilenceDuration: 300,
  minSpeechDuration: 200,
  preSpeechPadding: 100,
  postSpeechPadding: 150,
};

/**
 * VAD 引擎
 * 检测语音活动状态
 */
export class VADEngine {
  private config: Required<VADConfig>;
  private state: VADState;
  private eventHandlers: Set<(event: VADEvent) => void> = new Set();

  private frameSamples: number;
  private speechStartTime: number | null = null;
  private lastSpeechTime: number = 0;
  private buffer: Float32Array[] = [];
  private maxBufferSize: number;

  constructor(config: VADConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.frameSamples = (this.config.sampleRate * this.config.frameDuration) / 1000;
    this.maxBufferSize = Math.ceil(this.config.preSpeechPadding / this.config.frameDuration);

    this.state = {
      isSpeech: false,
      speechDuration: 0,
      silenceDuration: 0,
      confidence: 0,
    };
  }

  /**
   * 处理音频帧
   */
  processFrame(frame: Float32Array): VADState {
    const now = Date.now();
    const energy = this.calculateEnergy(frame);
    const isSpeechFrame = energy > this.config.threshold;

    // 更新置信度 (平滑)
    this.state.confidence = isSpeechFrame
      ? Math.min(1, this.state.confidence * 0.8 + 0.2)
      : Math.max(0, this.state.confidence * 0.8);

    // 状态机
    if (isSpeechFrame) {
      this.handleSpeechFrame(now);
    } else {
      this.handleSilenceFrame(now);
    }

    return { ...this.state };
  }

  /**
   * 注册事件处理器
   */
  onEvent(handler: (event: VADEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      isSpeech: false,
      speechDuration: 0,
      silenceDuration: 0,
      confidence: 0,
    };
    this.speechStartTime = null;
    this.lastSpeechTime = 0;
    this.buffer = [];
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
    this.frameSamples = (this.config.sampleRate * this.config.frameDuration) / 1000;
    this.maxBufferSize = Math.ceil(this.config.preSpeechPadding / this.config.frameDuration);
  }

  /**
   * 获取配置
   */
  getConfig(): VADConfig {
    return { ...this.config };
  }

  /**
   * 获取当前状态
   */
  getState(): VADState {
    return { ...this.state };
  }

  /**
   * 是否正在说话
   */
  isSpeech(): boolean {
    return this.state.isSpeech;
  }

  /**
   * 获取缓冲的音频 (前置语音)
   */
  getBufferedAudio(): Float32Array {
    if (this.buffer.length === 0) {
      return new Float32Array(0);
    }

    const totalLength = this.buffer.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;

    for (const arr of this.buffer) {
      result.set(arr, offset);
      offset += arr.length;
    }

    return result;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.reset();
    this.eventHandlers.clear();
  }

  /**
   * 处理语音帧
   */
  private handleSpeechFrame(now: number): void {
    this.lastSpeechTime = now;

    if (!this.state.isSpeech) {
      // 语音开始
      this.state.silenceDuration = 0;
      this.state.speechDuration += this.config.frameDuration;

      if (this.state.speechDuration >= this.config.minSpeechDuration) {
        this.state.isSpeech = true;
        this.speechStartTime = now - this.state.speechDuration;

        this.emitEvent({
          type: 'speech_start',
          timestamp: this.speechStartTime,
          confidence: this.state.confidence,
        });
      }
    } else {
      // 语音持续
      this.state.speechDuration += this.config.frameDuration;

      this.emitEvent({
        type: 'speech_ongoing',
        timestamp: now,
        duration: this.state.speechDuration,
        confidence: this.state.confidence,
      });
    }

    // 添加到缓冲区
    this.buffer.push(new Float32Array(0)); // Placeholder, actual audio would be stored
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * 处理静音帧
   */
  private handleSilenceFrame(now: number): void {
    const timeSinceLastSpeech = now - this.lastSpeechTime;

    if (this.state.isSpeech) {
      this.state.silenceDuration += this.config.frameDuration;

      if (this.state.silenceDuration >= this.config.minSilenceDuration) {
        // 语音结束
        const duration = this.state.speechDuration;

        this.emitEvent({
          type: 'speech_end',
          timestamp: now,
          duration,
          confidence: this.state.confidence,
        });

        this.state.isSpeech = false;
        this.state.speechDuration = 0;
        this.state.silenceDuration = 0;
        this.buffer = [];
      }
    } else {
      this.state.speechDuration = 0;
      this.state.silenceDuration = timeSinceLastSpeech;
    }
  }

  /**
   * 计算音频能量
   */
  private calculateEnergy(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  /**
   * 触发事件
   */
  private emitEvent(event: VADEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('VAD event handler error:', error);
      }
    });
  }
}
