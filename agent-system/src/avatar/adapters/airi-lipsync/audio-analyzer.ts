/**
 * Audio Analyzer
 * 音频输入处理和分析
 * 用于捕获麦克风或音频文件输入
 */

export interface AudioAnalyzerConfig {
  sampleRate?: number;
  bufferSize?: number;
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
}

export interface AudioAnalysisResult {
  volume: number;
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  peakFrequency: number;
  isVoiced: boolean;
}

const DEFAULT_CONFIG: Required<AudioAnalyzerConfig> = {
  sampleRate: 16000,
  bufferSize: 1024,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
};

/**
 * 音频分析器
 * 封装 Web Audio API，提供音频输入分析
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private config: Required<AudioAnalyzerConfig>;
  private isInitialized = false;
  private isCapturing = false;

  // 分析数据缓冲区
  private frequencyData: Uint8Array;
  private timeData: Uint8Array;

  constructor(config: AudioAnalyzerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.frequencyData = new Uint8Array(this.config.fftSize / 2);
    this.timeData = new Uint8Array(this.config.fftSize);
  }

  /**
   * 初始化音频分析器
   */
  async initialize(audioContext?: AudioContext): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.audioContext = audioContext || new AudioContext({
      sampleRate: this.config.sampleRate,
    });

    // 创建分析器节点
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
    this.analyser.minDecibels = this.config.minDecibels;
    this.analyser.maxDecibels = this.config.maxDecibels;

    // 重新分配缓冲区
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);

    this.isInitialized = true;
  }

  /**
   * 是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 从麦克风捕获音频
   */
  async startMicrophoneCapture(): Promise<void> {
    this.ensureInitialized();

    if (this.isCapturing) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.source = this.audioContext!.createMediaStreamSource(stream);
      this.source.connect(this.analyser!);
      this.isCapturing = true;
    } catch (error) {
      throw new Error(`Failed to access microphone: ${error}`);
    }
  }

  /**
   * 从音频元素捕获
   */
  startMediaCapture(audioElement: HTMLAudioElement | HTMLVideoElement): void {
    this.ensureInitialized();

    if (this.isCapturing) {
      this.stopCapture();
    }

    this.source = this.audioContext!.createMediaElementSource(audioElement);
    this.source.connect(this.analyser!);
    this.analyser!.connect(this.audioContext!.destination);
    this.isCapturing = true;
  }

  /**
   * 停止捕获
   */
  stopCapture(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    this.isCapturing = false;
  }

  /**
   * 分析当前音频帧
   */
  analyze(): AudioAnalysisResult {
    this.ensureInitialized();

    if (!this.analyser) {
      throw new Error('Analyser not initialized');
    }

    // 获取频域数据
    this.analyser.getByteFrequencyData(this.frequencyData);

    // 获取时域数据
    this.analyser.getByteTimeDomainData(this.timeData);

    // 计算音量
    const volume = this.calculateVolume();

    // 找到峰值频率
    const peakFrequency = this.findPeakFrequency();

    // 判断是否包含人声 (简单的基于频谱分析)
    const isVoiced = this.detectVoice();

    return {
      volume,
      frequencyData: new Uint8Array(this.frequencyData),
      timeData: new Uint8Array(this.timeData),
      peakFrequency,
      isVoiced,
    };
  }

  /**
   * 获取原始音频数据 (Float32Array)
   */
  getRawAudioData(): Float32Array {
    this.ensureInitialized();

    if (!this.analyser) {
      return new Float32Array(0);
    }

    const dataArray = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * 是否正在捕获
   */
  isCapturingAudio(): boolean {
    return this.isCapturing;
  }

  /**
   * 获取 AudioContext
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * 获取 AnalyserNode
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<AudioAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.analyser) {
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
      this.analyser.minDecibels = this.config.minDecibels;
      this.analyser.maxDecibels = this.config.maxDecibels;

      // 重新分配缓冲区
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): AudioAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopCapture();

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('AudioAnalyzer not initialized');
    }
  }

  /**
   * 计算音量 (0-1)
   */
  private calculateVolume(): number {
    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return sum / (this.frequencyData.length * 255);
  }

  /**
   * 找到峰值频率
   */
  private findPeakFrequency(): number {
    let maxIndex = 0;
    let maxValue = 0;

    for (let i = 0; i < this.frequencyData.length; i++) {
      if (this.frequencyData[i] > maxValue) {
        maxValue = this.frequencyData[i];
        maxIndex = i;
      }
    }

    // 转换为频率值
    if (this.audioContext && this.analyser) {
      const nyquist = this.audioContext.sampleRate / 2;
      return (maxIndex / this.analyser.frequencyBinCount) * nyquist;
    }

    return 0;
  }

  /**
   * 简单的人声检测
   * 人声通常在 85Hz - 255Hz (男声) 和 165Hz - 255Hz (女声)
   */
  private detectVoice(): boolean {
    if (!this.audioContext) return false;

    const nyquist = this.audioContext.sampleRate / 2;
    const minVoiceFreq = 80;
    const maxVoiceFreq = 300;

    const minIndex = Math.floor((minVoiceFreq / nyquist) * this.frequencyData.length);
    const maxIndex = Math.floor((maxVoiceFreq / nyquist) * this.frequencyData.length);

    let voiceRangeEnergy = 0;
    let totalEnergy = 0;

    for (let i = 0; i < this.frequencyData.length; i++) {
      totalEnergy += this.frequencyData[i];
      if (i >= minIndex && i <= maxIndex) {
        voiceRangeEnergy += this.frequencyData[i];
      }
    }

    // 如果人声频段能量占比超过 30%，认为包含人声
    return totalEnergy > 0 && (voiceRangeEnergy / totalEnergy) > 0.3;
  }
}
