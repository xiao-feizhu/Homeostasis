
/**
 * 口型同步引擎
 * 将文本/音频转换为 Live2D 口型动画
 */

import {
  LipSyncVowel,
  LipSyncConfig,
  VISEME_PARAMS,
  TEXT_TO_VISEME,
  AvatarState,
} from '../entities/avatar.entity';

/** 口型时间戳 */
interface LipSyncTimestamp {
  vowel: LipSyncVowel;
  startTime: number;    // 开始时间 (ms)
  endTime: number;      // 结束时间 (ms)
  intensity: number;    // 强度 (0-1)
}

/** 口型序列 */
interface LipSyncSequence {
  duration: number;           // 总时长 (ms)
  timestamps: LipSyncTimestamp[];
}

/**
 * 口型同步引擎
 * 支持文本驱动和音频驱动两种模式
 */
export class LipSyncEngine {
  private currentSequence: LipSyncSequence | null = null;
  private playbackStartTime: number = 0;
  private isPlaying: boolean = false;
  private animationFrameId: number | null = null;

  constructor(
    private avatarState: AvatarState,
    private onLipSyncUpdate?: (mouthOpenness: number, mouthWidth: number) => void
  ) {}

  /**
   * 从文本生成口型序列（简单模拟）
   * @param text 文本内容
   * @param duration 预计时长 (ms)，默认文字长度 * 200ms
   */
  generateFromText(text: string, duration?: number): LipSyncSequence {
    const estimatedDuration = duration || text.length * 180;
    const timestamps: LipSyncTimestamp[] = [];

    // 将文本分割为字符
    const chars = text.split('');
    const charDuration = estimatedDuration / chars.length;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i].toLowerCase();
      const vowel = this.mapCharToVowel(char);

      // 跳过静音字符的口型，但保留时间间隔
      if (vowel !== LipSyncVowel.SILENT) {
        timestamps.push({
          vowel,
          startTime: i * charDuration,
          endTime: (i + 0.8) * charDuration,
          intensity: 0.7 + Math.random() * 0.3, // 随机强度增加自然感
        });
      }
    }

    return {
      duration: estimatedDuration,
      timestamps,
    };
  }

  /**
   * 从音频生成口型序列（基于音量/频谱分析）
   * @param audioBuffer 音频数据
   */
  async generateFromAudio(audioBuffer: ArrayBuffer): Promise<LipSyncSequence> {
    // 模拟音频分析 - 实际项目中应使用 Web Audio API 分析频谱
    // 这里使用简化的模拟
    const duration = 5000; // 假设5秒音频
    const timestamps: LipSyncTimestamp[] = [];

    // 模拟音频波形生成口型
    const sampleRate = 100; // 每秒100个采样点
    const totalSamples = (duration / 1000) * sampleRate;

    for (let i = 0; i < totalSamples; i++) {
      const time = (i / sampleRate) * 1000;
      // 模拟音量变化
      const volume = Math.abs(Math.sin(i * 0.1) * Math.cos(i * 0.05));

      if (volume > 0.1) {
        // 根据音量大小选择口型
        const vowel = this.selectVowelByVolume(volume);
        timestamps.push({
          vowel,
          startTime: time,
          endTime: time + (1000 / sampleRate),
          intensity: volume,
        });
      }
    }

    return {
      duration,
      timestamps,
    };
  }

  /**
   * 开始播放口型动画
   * @param sequence 口型序列
   */
  play(sequence: LipSyncSequence): void {
    this.stop(); // 停止之前的播放
    this.currentSequence = sequence;
    this.playbackStartTime = Date.now();
    this.isPlaying = true;
    this.avatarState.isTalking = true;

    this.startPlaybackLoop();
  }

  /**
   * 停止口型动画
   */
  stop(): void {
    this.isPlaying = false;
    this.avatarState.isTalking = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // 重置口型到静音状态
    this.onLipSyncUpdate?.(0, 0.5);
  }

  /**
   * 暂停口型动画
   */
  pause(): void {
    this.isPlaying = false;
    this.avatarState.isTalking = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 获取当前口型配置
   */
  getCurrentLipSync(): LipSyncConfig {
    return this.avatarState.currentLipSync;
  }

  /**
   * 是否正在播放
   */
  isPlayingLipSync(): boolean {
    return this.isPlaying;
  }

  /**
   * 实时更新口型（用于外部音频驱动）
   * @param vowel 元音类型
   * @param intensity 强度
   */
  updateRealtime(vowel: LipSyncVowel, intensity: number): void {
    const params = VISEME_PARAMS[vowel];
    this.avatarState.currentLipSync = {
      vowel,
      intensity,
      blendTime: 50, // 50ms 混合时间
    };
    this.onLipSyncUpdate?.(
      params.mouthOpenness * intensity,
      params.mouthWidth
    );
  }

  /**
   * 字符映射到元音
   */
  private mapCharToVowel(char: string): LipSyncVowel {
    // 直接映射
    if (TEXT_TO_VISEME[char]) {
      return TEXT_TO_VISEME[char];
    }

    // 拼音韵母映射
    const pinyinMap: Record<string, LipSyncVowel> = {
      // 开口音 'a'
      'a': LipSyncVowel.A,
      'ai': LipSyncVowel.A,
      'ao': LipSyncVowel.A,
      'an': LipSyncVowel.A,
      'ang': LipSyncVowel.A,
      'o': LipSyncVowel.O,
      // 扁唇音 'i'
      'i': LipSyncVowel.I,
      'yi': LipSyncVowel.I,
      // 合口音 'u'
      'u': LipSyncVowel.U,
      'wu': LipSyncVowel.U,
      // 半开口 'e'
      'e': LipSyncVowel.E,
      'ei': LipSyncVowel.E,
      'en': LipSyncVowel.E,
      'eng': LipSyncVowel.E,
    };

    // 简单拼音检测
    if (/[aeiou]/.test(char)) {
      return pinyinMap[char] || LipSyncVowel.A;
    }

    // 辅音根据口型特点映射
    const consonantMap: Record<string, LipSyncVowel> = {
      'b': LipSyncVowel.U,
      'p': LipSyncVowel.U,
      'm': LipSyncVowel.U,
      'f': LipSyncVowel.I,
      'v': LipSyncVowel.I,
    };

    if (consonantMap[char]) {
      return consonantMap[char];
    }

    // 标点符号静音
    if (/[，。？！；：""''（）【】]/.test(char)) {
      return LipSyncVowel.SILENT;
    }

    // 默认静音
    return LipSyncVowel.SILENT;
  }

  /**
   * 根据音量选择口型
   */
  private selectVowelByVolume(volume: number): LipSyncVowel {
    // 音量高 -> 开口大 (A)
    // 音量中 -> 半开口 (E, O)
    // 音量低 -> 扁唇或合口 (I, U)
    if (volume > 0.7) return LipSyncVowel.A;
    if (volume > 0.5) return LipSyncVowel.O;
    if (volume > 0.3) return LipSyncVowel.E;
    if (volume > 0.15) return LipSyncVowel.I;
    return LipSyncVowel.U;
  }

  /**
   * 播放循环
   */
  private startPlaybackLoop(): void {
    const animate = () => {
      if (!this.isPlaying || !this.currentSequence) {
        this.avatarState.isTalking = false;
        return;
      }

      const now = Date.now();
      const elapsed = now - this.playbackStartTime;

      // 检查是否播放完成
      if (elapsed >= this.currentSequence.duration) {
        this.stop();
        return;
      }

      // 查找当前时间对应的口型
      const currentTimestamp = this.currentSequence.timestamps.find(
        ts => elapsed >= ts.startTime && elapsed < ts.endTime
      );

      if (currentTimestamp) {
        const params = VISEME_PARAMS[currentTimestamp.vowel];
        const progress = (elapsed - currentTimestamp.startTime) /
          (currentTimestamp.endTime - currentTimestamp.startTime);

        // 平滑过渡
        const smoothProgress = this.smoothStep(progress);
        const intensity = currentTimestamp.intensity * smoothProgress;

        this.avatarState.currentLipSync = {
          vowel: currentTimestamp.vowel,
          intensity,
          blendTime: 30,
        };

        this.onLipSyncUpdate?.(
          params.mouthOpenness * intensity,
          params.mouthWidth
        );
      } else {
        // 没有口型时静音
        this.avatarState.currentLipSync = {
          vowel: LipSyncVowel.SILENT,
          intensity: 0,
          blendTime: 50,
        };
        this.onLipSyncUpdate?.(0, 0.5);
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * 平滑步进函数
   */
  private smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
