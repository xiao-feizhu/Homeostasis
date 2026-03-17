/**
 * Wlipsync Adapter
 * Wraps wlipsync library for lip sync analysis
 */

import { createWLipSyncNode, WLipSyncAudioNode, parseBinaryProfile, Profile } from 'wlipsync';

export interface WlipsyncResult {
  phoneme: string;
  volume: number;
}

export interface WlipsyncConfig {
  sampleRate?: number;
  audioContext?: AudioContext;
  profile?: Profile;
}

const DEFAULT_CONFIG: WlipsyncConfig = {
  sampleRate: 16000,
};

/**
 * wlipsync 适配器
 * 封装 wlipsync 库，提供统一的口型分析接口
 *
 * wlipsync API 说明:
 * - createWLipSyncNode(audioContext, profile) - 创建 WLipSyncAudioNode
 * - lipsyncNode.weights - 各音素的权重数组
 * - lipsyncNode.volume - 音量
 */
export class WlipsyncAdapter {
  private lipsyncNode: WLipSyncAudioNode | null = null;
  private audioContext: AudioContext | null = null;
  private config: WlipsyncConfig;
  private initialized = false;
  private streaming = false;
  private streamCallback: ((result: WlipsyncResult) => void) | null = null;
  private animationFrameId: number | null = null;

  constructor(config: WlipsyncConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化适配器
   */
  async initialize(audioContext?: AudioContext, profile?: Profile): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.audioContext = audioContext || this.config.audioContext || null;
    const profileData = profile || this.config.profile;

    if (!this.audioContext) {
      throw new Error('AudioContext is required');
    }

    if (!profileData) {
      throw new Error('Profile is required. Please provide a valid wlipsync profile.');
    }

    this.lipsyncNode = await createWLipSyncNode(this.audioContext, profileData);
    this.initialized = true;
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 分析音频缓冲区 (模拟 - wlipsync 主要用于实时流)
   * 注意: wlipsync 设计用于实时音频流，批量分析需要特殊处理
   */
  async analyze(_audioBuffer: ArrayBuffer): Promise<WlipsyncResult[]> {
    this.ensureInitialized();

    if (_audioBuffer.byteLength === 0) {
      return [];
    }

    // 获取当前音素状态
    return this.getCurrentPhonemes();
  }

  /**
   * 处理音频块 (实时模式)
   * 由于 wlipsync 使用 AudioWorklet，需要通过音频输入流处理
   */
  async processChunk(_chunk: Float32Array): Promise<WlipsyncResult> {
    this.ensureInitialized();

    // 从当前状态获取结果
    const phonemes = this.getCurrentPhonemes();
    return phonemes[0] || { phoneme: 'SIL', volume: 0 };
  }

  /**
   * 获取当前音素状态
   */
  getCurrentPhonemes(): WlipsyncResult[] {
    if (!this.lipsyncNode) {
      return [{ phoneme: 'SIL', volume: 0 }];
    }

    // wlipsync 返回 weights 数组，需要找到最大权重的音素
    const weights = this.lipsyncNode.weights || [];
    const volume = this.lipsyncNode.volume || 0;

    // 音素名称映射 (wlipsync 默认顺序)
    const phonemeNames = ['A', 'I', 'U', 'E', 'O', 'N'];

    // 找到最大权重的音素
    let maxIndex = 0;
    let maxWeight = 0;

    for (let i = 0; i < weights.length && i < phonemeNames.length; i++) {
      if (weights[i] > maxWeight) {
        maxWeight = weights[i];
        maxIndex = i;
      }
    }

    // 如果最大权重太低，认为是静音
    if (maxWeight < 0.1) {
      return [{ phoneme: 'SIL', volume }];
    }

    return [{ phoneme: phonemeNames[maxIndex] || 'SIL', volume }];
  }

  /**
   * 将音素映射到元音
   */
  mapPhonemeToVowel(phoneme: string): string {
    const mapping: Record<string, string> = {
      'A': 'a',
      'I': 'i',
      'U': 'u',
      'E': 'e',
      'O': 'o',
      'SIL': 'sil',
      'N': 'a', // 鼻音 fallback
    };

    return mapping[phoneme] || 'sil';
  }

  /**
   * 开始流式处理
   * 在每一帧回调口型结果
   */
  startStream(onResult: (result: WlipsyncResult) => void): void {
    this.ensureInitialized();
    this.streaming = true;
    this.streamCallback = onResult;

    // 启动更新循环
    const updateLoop = () => {
      if (!this.streaming) return;

      const phonemes = this.getCurrentPhonemes();
      if (phonemes.length > 0 && this.streamCallback) {
        this.streamCallback(phonemes[0]);
      }

      this.animationFrameId = requestAnimationFrame(updateLoop);
    };

    this.animationFrameId = requestAnimationFrame(updateLoop);
  }

  /**
   * 停止流式处理
   */
  stopStream(): void {
    this.streaming = false;
    this.streamCallback = null;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 是否正在流式处理
   */
  isStreaming(): boolean {
    return this.streaming;
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<WlipsyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): WlipsyncConfig {
    return { ...this.config };
  }

  /**
   * 获取底层 wlipsync 节点 (用于高级操作)
   */
  getLipSyncNode(): WLipSyncAudioNode | null {
    return this.lipsyncNode;
  }

  /**
   * 获取 AudioContext
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * 销毁适配器
   */
  destroy(): void {
    this.stopStream();

    if (this.lipsyncNode) {
      this.lipsyncNode.disconnect?.();
      this.lipsyncNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close?.();
      this.audioContext = null;
    }

    this.initialized = false;
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Adapter not initialized');
    }
  }
}

// 导出 wlipsync 相关类型和函数
export { createWLipSyncNode, parseBinaryProfile };
export type { Profile, WLipSyncAudioNode };
