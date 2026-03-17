/**
 * Audio Player
 * 音频播放控制器
 */

export interface AudioPlayerConfig {
  volume?: number;
  playbackRate?: number;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (currentTime: number, duration: number) => void;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
}

const DEFAULT_CONFIG: Required<Omit<AudioPlayerConfig, 'onComplete' | 'onError' | 'onProgress'>> = {
  volume: 1.0,
  playbackRate: 1.0,
};

/**
 * 音频播放器
 * 封装 HTMLAudioElement 提供统一接口
 */
export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private config: AudioPlayerConfig;
  private state: AudioPlaybackState;
  private lipSyncCallback: ((currentTime: number, duration: number) => void) | null = null;
  private progressInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: AudioPlayerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: 0,
      volume: this.config.volume ?? 1.0,
      playbackRate: this.config.playbackRate ?? 1.0,
    };
  }

  /**
   * 加载音频
   */
  load(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audio = new Audio(url);
      this.audio.volume = this.state.volume;
      this.audio.playbackRate = this.state.playbackRate;

      this.audio.addEventListener('loadedmetadata', () => {
        this.state.duration = this.audio?.duration || 0;
        resolve();
      });

      this.audio.addEventListener('error', (e) => {
        reject(new Error(`Failed to load audio: ${e}`));
      });

      this.audio.addEventListener('ended', () => {
        this.state.isPlaying = false;
        this.state.isPaused = false;
        this.stopProgressTracking();
        this.config.onComplete?.();
      });
    });
  }

  /**
   * 加载音频缓冲区
   */
  loadBuffer(buffer: ArrayBuffer): Promise<void> {
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    return this.load(url);
  }

  /**
   * 播放
   */
  async play(): Promise<void> {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }

    try {
      await this.audio.play();
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.startProgressTracking();
    } catch (error) {
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 暂停
   */
  pause(): void {
    if (!this.audio || !this.state.isPlaying) {
      return;
    }

    this.audio.pause();
    this.state.isPlaying = false;
    this.state.isPaused = true;
    this.stopProgressTracking();
  }

  /**
   * 恢复播放
   */
  async resume(): Promise<void> {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }

    if (!this.state.isPaused) {
      return;
    }

    await this.play();
  }

  /**
   * 停止
   */
  stop(): void {
    if (!this.audio) {
      return;
    }

    this.audio.pause();
    this.audio.currentTime = 0;
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentTime = 0;
    this.stopProgressTracking();
  }

  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    if (!this.audio) {
      return;
    }

    this.audio.currentTime = Math.max(0, Math.min(time, this.state.duration));
    this.state.currentTime = this.audio.currentTime;
  }

  /**
   * 是否正在播放
   */
  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  /**
   * 是否已暂停
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.state.volume;
    }
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate: number): void {
    this.state.playbackRate = Math.max(0.5, Math.min(2, rate));
    if (this.audio) {
      this.audio.playbackRate = this.state.playbackRate;
    }
  }

  /**
   * 获取当前状态
   */
  getState(): AudioPlaybackState {
    if (this.audio) {
      this.state.currentTime = this.audio.currentTime;
      this.state.duration = this.audio.duration || 0;
    }
    return { ...this.state };
  }

  /**
   * 设置口型同步回调
   */
  setLipSyncCallback(callback: (currentTime: number, duration: number) => void): void {
    this.lipSyncCallback = callback;
  }

  /**
   * 清除口型同步回调
   */
  clearLipSyncCallback(): void {
    this.lipSyncCallback = null;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.stopProgressTracking();
    this.clearLipSyncCallback();

    if (this.audio) {
      this.audio.src = '';
      this.audio = null;
    }
  }

  /**
   * 启动进度跟踪
   */
  private startProgressTracking(): void {
    this.stopProgressTracking();

    this.progressInterval = setInterval(() => {
      if (!this.audio) return;

      this.state.currentTime = this.audio.currentTime;

      this.config.onProgress?.(this.state.currentTime, this.state.duration);

      // 触发口型同步
      if (this.lipSyncCallback) {
        this.lipSyncCallback(this.state.currentTime, this.state.duration);
      }
    }, 50); // 20fps
  }

  /**
   * 停止进度跟踪
   */
  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}
