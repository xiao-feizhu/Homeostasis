/**
 * Microphone Capture
 * 麦克风音频捕获模块
 */

export interface MicrophoneConfig {
  sampleRate?: number;
  bufferSize?: number;
  channels?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  audioContext?: AudioContext;
}

export interface AudioDataEvent {
  data: Float32Array;
  sampleRate: number;
  timestamp: number;
  volume: number;
}

const DEFAULT_CONFIG: Required<Omit<MicrophoneConfig, 'audioContext'>> = {
  sampleRate: 16000,
  bufferSize: 1024,
  channels: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/**
 * 麦克风捕获器
 * 封装 Web Audio API 用于麦克风输入
 */
export class MicrophoneCapture {
  private config: MicrophoneConfig;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private dataHandlers: Set<(event: AudioDataEvent) => void> = new Set();
  private volumeHandlers: Set<(volume: number) => void> = new Set();

  private state: {
    initialized: boolean;
    capturing: boolean;
    paused: boolean;
    currentVolume: number;
  } = {
    initialized: false,
    capturing: false,
    paused: false,
    currentVolume: 0,
  };

  constructor(config: MicrophoneConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.state.initialized) {
      return;
    }

    this.audioContext = this.config.audioContext || new AudioContext({
      sampleRate: this.config.sampleRate,
    });

    this.state.initialized = true;
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.state.initialized;
  }

  /**
   * 开始捕获
   */
  async start(): Promise<void> {
    this.ensureInitialized();

    if (this.state.capturing) {
      return;
    }

    try {
      // 获取麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
        },
      });

      // 创建音频源
      this.sourceNode = this.audioContext!.createMediaStreamSource(this.mediaStream);

      // 创建 ScriptProcessorNode (用于实时音频处理)
      this.scriptProcessor = this.audioContext!.createScriptProcessor(
        this.config.bufferSize,
        this.config.channels,
        this.config.channels
      );

      // 连接节点
      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext!.destination);

      // 设置音频处理回调
      this.scriptProcessor.onaudioprocess = (event) => {
        if (this.state.paused) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const data = new Float32Array(inputData);

        // 计算音量
        const volume = this.calculateVolume(data);
        this.state.currentVolume = volume;

        // 触发音量回调
        this.volumeHandlers.forEach(handler => handler(volume));

        // 触发数据回调
        const audioEvent: AudioDataEvent = {
          data,
          sampleRate: this.audioContext!.sampleRate,
          timestamp: Date.now(),
          volume,
        };

        this.dataHandlers.forEach(handler => {
          try {
            handler(audioEvent);
          } catch (error) {
            console.error('Audio data handler error:', error);
          }
        });
      };

      this.state.capturing = true;
    } catch (error) {
      throw new Error(`Failed to start microphone capture: ${error}`);
    }
  }

  /**
   * 停止捕获
   */
  stop(): void {
    if (!this.state.capturing) {
      return;
    }

    // 断开节点
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // 停止媒体流
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.state.capturing = false;
    this.state.paused = false;
    this.state.currentVolume = 0;
  }

  /**
   * 是否正在捕获
   */
  isCapturing(): boolean {
    return this.state.capturing;
  }

  /**
   * 暂停
   */
  pause(): void {
    this.state.paused = true;
  }

  /**
   * 恢复
   */
  async resume(): Promise<void> {
    if (!this.state.capturing) {
      await this.start();
      return;
    }
    this.state.paused = false;
  }

  /**
   * 是否已暂停
   */
  isPaused(): boolean {
    return this.state.paused;
  }

  /**
   * 注册数据回调
   */
  onData(handler: (event: AudioDataEvent) => void): () => void {
    this.dataHandlers.add(handler);

    return () => {
      this.dataHandlers.delete(handler);
    };
  }

  /**
   * 注册音量回调
   */
  onVolume(handler: (volume: number) => void): () => void {
    this.volumeHandlers.add(handler);

    return () => {
      this.volumeHandlers.delete(handler);
    };
  }

  /**
   * 获取当前音量
   */
  getVolume(): number {
    return this.state.currentVolume;
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<MicrophoneConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): MicrophoneConfig {
    return { ...this.config };
  }

  /**
   * 获取 AudioContext
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * 获取 MediaStream
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.dataHandlers.clear();
    this.volumeHandlers.clear();

    this.audioContext = null;
    this.state.initialized = false;
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.state.initialized) {
      throw new Error('Not initialized');
    }
  }

  /**
   * 计算音量 (RMS)
   */
  private calculateVolume(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    return Math.min(1, rms * 4); // 放大并限制到 0-1
  }
}
