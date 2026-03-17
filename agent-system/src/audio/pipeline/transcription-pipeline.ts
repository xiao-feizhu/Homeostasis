/**
 * Transcription Pipeline
 * 音频转录管道 - 整合 VAD、麦克风输入和转录服务
 */

import { MicrophoneCapture, AudioDataEvent } from '../input/microphone-capture';
import { VADEngine, VADEvent, VADState } from '../input/vad-engine';

export interface TranscriptionConfig {
  sampleRate?: number;
  bufferSize?: number;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  vadThreshold?: number;
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
  language?: string;
}

export interface TranscriptionEvent {
  type: 'start' | 'speech_start' | 'speech_end' | 'result' | 'error' | 'end';
  timestamp: number;
  data?: any;
}

const DEFAULT_CONFIG: Required<TranscriptionConfig> = {
  sampleRate: 16000,
  bufferSize: 1024,
  language: 'zh-CN',
  continuous: true,
  interimResults: true,
  vadThreshold: 0.15,
};

/**
 * 转录管道
 * 整合麦克风捕获、VAD 和转录服务
 */
export class TranscriptionPipeline {
  private config: Required<TranscriptionConfig>;
  private microphone: MicrophoneCapture;
  private vad: VADEngine;
  private eventHandlers: Set<(event: TranscriptionEvent) => void> = new Set();

  private state: {
    isRunning: boolean;
    isRecording: boolean;
    audioBuffer: Float32Array[];
  } = {
    isRunning: false,
    isRecording: false,
    audioBuffer: [],
  };

  private unregisterMicHandler: (() => void) | null = null;
  private unregisterVADHandler: (() => void) | null = null;

  constructor(config: TranscriptionConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.microphone = new MicrophoneCapture({
      sampleRate: this.config.sampleRate,
      bufferSize: this.config.bufferSize,
    });

    this.vad = new VADEngine({
      sampleRate: this.config.sampleRate,
      threshold: this.config.vadThreshold,
    });
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    await this.microphone.initialize();

    // 注册 VAD 事件处理器
    this.unregisterVADHandler = this.vad.onEvent((event) => {
      this.handleVADEvent(event);
    });

    // 注册麦克风数据处理器
    this.unregisterMicHandler = this.microphone.onData((event) => {
      this.handleAudioData(event);
    });
  }

  /**
   * 开始转录
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      return;
    }

    await this.microphone.start();
    this.state.isRunning = true;

    this.emitEvent({
      type: 'start',
      timestamp: Date.now(),
    });
  }

  /**
   * 停止转录
   */
  stop(): void {
    if (!this.state.isRunning) {
      return;
    }

    this.microphone.stop();
    this.state.isRunning = false;
    this.state.isRecording = false;

    // 处理剩余的音频
    this.processBufferedAudio(true);

    this.emitEvent({
      type: 'end',
      timestamp: Date.now(),
    });
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * 是否正在录制语音
   */
  isRecording(): boolean {
    return this.state.isRecording;
  }

  /**
   * 注册事件处理器
   */
  onEvent(handler: (event: TranscriptionEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<TranscriptionConfig>): void {
    this.config = { ...this.config, ...config };

    this.microphone.setConfig({
      sampleRate: this.config.sampleRate,
      bufferSize: this.config.bufferSize,
    });

    this.vad.setConfig({
      sampleRate: this.config.sampleRate,
      threshold: this.config.vadThreshold,
    });
  }

  /**
   * 获取当前音量
   */
  getVolume(): number {
    return this.microphone.getVolume();
  }

  /**
   * 获取 VAD 状态
   */
  getVADState(): VADState {
    return this.vad.getState();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();

    this.unregisterMicHandler?.();
    this.unregisterVADHandler?.();

    this.microphone.destroy();
    this.vad.destroy();
    this.eventHandlers.clear();
  }

  /**
   * 处理音频数据
   */
  private handleAudioData(event: AudioDataEvent): void {
    // 发送到 VAD 处理
    this.vad.processFrame(event.data);

    // 如果正在录制语音，保存音频数据
    if (this.state.isRecording) {
      this.state.audioBuffer.push(event.data);

      // 限制缓冲区大小 (最多 30 秒)
      const maxFrames = (30 * this.config.sampleRate) / this.config.bufferSize;
      if (this.state.audioBuffer.length > maxFrames) {
        this.state.audioBuffer.shift();
      }
    }
  }

  /**
   * 处理 VAD 事件
   */
  private handleVADEvent(event: VADEvent): void {
    switch (event.type) {
      case 'speech_start':
        this.state.isRecording = true;
        this.state.audioBuffer = [];

        // 添加前置缓冲 (VAD 缓冲区)
        const bufferedAudio = this.vad.getBufferedAudio();
        if (bufferedAudio.length > 0) {
          this.state.audioBuffer.push(bufferedAudio);
        }

        this.emitEvent({
          type: 'speech_start',
          timestamp: event.timestamp,
        });
        break;

      case 'speech_end':
        this.state.isRecording = false;
        this.processBufferedAudio(true);
        break;

      case 'speech_ongoing':
        // 实时转录中间结果
        if (this.config.interimResults) {
          this.processBufferedAudio(false);
        }
        break;
    }
  }

  /**
   * 处理缓冲的音频
   */
  private processBufferedAudio(isFinal: boolean): void {
    if (this.state.audioBuffer.length === 0) {
      return;
    }

    // 合并音频数据
    const audioData = this.mergeAudioBuffers(this.state.audioBuffer);

    // TODO: 发送到转录服务 (Whisper 等)
    // 目前模拟转录结果
    const mockResult: TranscriptionResult = {
      text: this.mockTranscribe(audioData),
      isFinal,
      confidence: 0.85,
      timestamp: Date.now(),
      language: this.config.language,
    };

    this.emitEvent({
      type: isFinal ? 'result' : 'result',
      timestamp: Date.now(),
      data: mockResult,
    });

    if (isFinal) {
      this.state.audioBuffer = [];

      this.emitEvent({
        type: 'speech_end',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 合并音频缓冲区
   */
  private mergeAudioBuffers(buffers: Float32Array[]): Float32Array {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;

    for (const buf of buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }

    return result;
  }

  /**
   * 模拟转录 (实际项目应调用 Whisper 等服务)
   */
  private mockTranscribe(_audioData: Float32Array): string {
    // 实际项目中，这里应该调用 Whisper API 或其他转录服务
    // 返回模拟结果
    return '';
  }

  /**
   * 触发事件
   */
  private emitEvent(event: TranscriptionEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Transcription event handler error:', error);
      }
    });
  }
}
