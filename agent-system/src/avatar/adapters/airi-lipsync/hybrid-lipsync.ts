/**
 * Hybrid LipSync
 * 混合模式：文本驱动 + 音频驱动
 * 优先使用音频分析，无音频时回退到文本分析
 */

import { WlipsyncAdapter, WlipsyncResult } from './wlipsync-adapter';
import { LipSyncVowel, TEXT_TO_VISEME } from '../../entities/avatar.entity';

export type LipSyncMode = 'text' | 'audio' | 'hybrid';

export interface LipSyncFrame {
  vowel: string;
  intensity: number;
  timestamp: number;
}

export interface HybridLipSyncConfig {
  mode?: LipSyncMode;
  textFallback?: boolean;
  smoothFactor?: number;
  minIntensity?: number;
  maxIntensity?: number;
}

const DEFAULT_CONFIG: Required<HybridLipSyncConfig> = {
  mode: 'hybrid',
  textFallback: true,
  smoothFactor: 0.3,
  minIntensity: 0.1,
  maxIntensity: 1.0,
};

/**
 * 混合口型同步器
 * 整合文本和音频两种驱动方式
 */
export class HybridLipSync {
  private config: Required<HybridLipSyncConfig>;
  private wlipsyncAdapter: WlipsyncAdapter | null = null;
  private currentFrame: LipSyncFrame = {
    vowel: 'sil',
    intensity: 0,
    timestamp: 0,
  };
  private lastUpdateTime = 0;
  private isPlaying = false;
  private onFrameCallback: ((frame: LipSyncFrame) => void) | null = null;

  constructor(
    config: HybridLipSyncConfig = {},
    private wlipsync?: WlipsyncAdapter
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.wlipsyncAdapter = wlipsync || null;
  }

  /**
   * 初始化
   */
  async initialize(audioContext?: AudioContext, profile?: any): Promise<void> {
    if (this.wlipsyncAdapter && !this.wlipsyncAdapter.isInitialized()) {
      await this.wlipsyncAdapter.initialize(audioContext, profile);
    }
  }

  /**
   * 从文本生成口型序列 (文本驱动)
   */
  generateFromText(text: string, duration?: number): LipSyncFrame[] {
    const estimatedDuration = duration || text.length * 180;
    const chars = text.split('');
    const charDuration = estimatedDuration / chars.length;
    const frames: LipSyncFrame[] = [];

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i].toLowerCase();
      const vowel = this.mapCharToVowel(char);

      frames.push({
        vowel,
        intensity: vowel === 'sil' ? 0 : 0.7 + Math.random() * 0.3,
        timestamp: i * charDuration,
      });
    }

    return frames;
  }

  /**
   * 播放文本口型动画
   */
  playText(text: string, duration?: number): void {
    const frames = this.generateFromText(text, duration);
    this.playFrames(frames);
  }

  /**
   * 开始音频口型分析
   */
  startAudioAnalysis(onFrame: (frame: LipSyncFrame) => void): void {
    if (!this.wlipsyncAdapter?.isInitialized()) {
      if (this.config.textFallback) {
        console.warn('Wlipsync not initialized, using text fallback');
        return;
      }
      throw new Error('Wlipsync adapter not initialized');
    }

    this.onFrameCallback = onFrame;
    this.isPlaying = true;

    this.wlipsyncAdapter.startStream((result: WlipsyncResult) => {
      if (!this.isPlaying) return;

      const frame: LipSyncFrame = {
        vowel: this.wlipsyncAdapter!.mapPhonemeToVowel(result.phoneme),
        intensity: this.clampIntensity(result.volume),
        timestamp: Date.now(),
      };

      this.currentFrame = this.smoothFrame(frame);
      this.onFrameCallback?.(this.currentFrame);
    });
  }

  /**
   * 停止音频分析
   */
  stopAudioAnalysis(): void {
    this.isPlaying = false;
    this.wlipsyncAdapter?.stopStream();
    this.onFrameCallback = null;

    // 重置到静音状态
    this.currentFrame = {
      vowel: 'sil',
      intensity: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<HybridLipSyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前帧
   */
  getCurrentFrame(): LipSyncFrame {
    return { ...this.currentFrame };
  }

  /**
   * 是否正在播放
   */
  isPlayingSync(): boolean {
    return this.isPlaying;
  }

  /**
   * 设置 wlipsync 适配器
   */
  setWlipsyncAdapter(adapter: WlipsyncAdapter): void {
    this.wlipsyncAdapter = adapter;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopAudioAnalysis();
    this.wlipsyncAdapter = null;
  }

  /**
   * 播放帧序列
   */
  private playFrames(frames: LipSyncFrame[]): void {
    if (frames.length === 0) return;

    let currentIndex = 0;
    const startTime = Date.now();

    const playNext = () => {
      if (currentIndex >= frames.length || !this.isPlaying) {
        this.isPlaying = false;
        return;
      }

      const frame = frames[currentIndex];
      this.currentFrame = frame;
      this.onFrameCallback?.(frame);

      currentIndex++;
      const nextFrame = frames[currentIndex];
      if (nextFrame) {
        const delay = nextFrame.timestamp - frame.timestamp;
        setTimeout(playNext, delay);
      }
    };

    this.isPlaying = true;
    playNext();
  }

  /**
   * 字符映射到元音
   */
  private mapCharToVowel(char: string): string {
    // 使用现有的 TEXT_TO_VISEME 映射
    const vowel = TEXT_TO_VISEME[char];
    if (vowel !== undefined) {
      return vowel === LipSyncVowel.SILENT ? 'sil' : vowel;
    }
    return 'sil';
  }

  /**
   * 平滑帧 (减少抖动)
   */
  private smoothFrame(newFrame: LipSyncFrame): LipSyncFrame {
    const smoothFactor = this.config.smoothFactor;

    return {
      vowel: newFrame.intensity > this.currentFrame.intensity * 0.5
        ? newFrame.vowel
        : this.currentFrame.vowel,
      intensity: this.currentFrame.intensity * (1 - smoothFactor) +
        newFrame.intensity * smoothFactor,
      timestamp: newFrame.timestamp,
    };
  }

  /**
   * 限制强度范围
   */
  private clampIntensity(intensity: number): number {
    return Math.max(this.config.minIntensity,
      Math.min(this.config.maxIntensity, intensity));
  }
}
