/**
 * TTS Playback
 * TTS 播放控制器 - 整合 TTS 生成和音频播放
 */

import { TTSConnector, TTSRequest, TTSResult } from '../../emotion/pipeline/tts-connector';
import { AudioPlayer } from './audio-player';
import { LipSyncFrame } from '../../emotion/pipeline/tts-connector';

export interface TTSPlaybackConfig {
  tts?: TTSConnector;
  player?: AudioPlayer;
  autoPlay?: boolean;
  cacheEnabled?: boolean;
}

export interface TTSPlaybackEvent {
  type: 'tts_start' | 'tts_complete' | 'tts_error' | 'playback_start' | 'playback_complete' | 'lip_sync';
  timestamp: number;
  data?: any;
}

/**
 * TTS 播放控制器
 * 整合 TTS 合成和音频播放，触发口型同步
 */
export class TTSPlayback {
  private tts: TTSConnector;
  private player: AudioPlayer;
  private config: Required<Omit<TTSPlaybackConfig, 'tts' | 'player'>>;
  private eventHandlers: Set<(event: TTSPlaybackEvent) => void> = new Set();
  private lipSyncData: LipSyncFrame[] = [];
  private currentLipSyncFrame: LipSyncFrame | null = null;

  constructor(config: TTSPlaybackConfig = {}) {
    this.tts = config.tts || new TTSConnector();
    this.player = config.player || new AudioPlayer({
      onComplete: () => this.handlePlaybackComplete(),
      onError: (error) => this.handlePlaybackError(error),
    });

    this.config = {
      autoPlay: config.autoPlay ?? true,
      cacheEnabled: config.cacheEnabled ?? true,
    };

    // 设置口型同步回调
    this.player.setLipSyncCallback((currentTime) => this.handleLipSync(currentTime));
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    await this.tts.initialize();
  }

  /**
   * 合成并播放
   */
  async speak(request: TTSRequest): Promise<TTSResult> {
    this.emitEvent({
      type: 'tts_start',
      timestamp: Date.now(),
      data: { text: request.text },
    });

    try {
      // 1. TTS 合成
      const result = await this.tts.synthesize(request);

      // 2. 保存口型数据
      this.lipSyncData = result.lipSyncData;

      this.emitEvent({
        type: 'tts_complete',
        timestamp: Date.now(),
        data: { duration: result.duration },
      });

      // 3. 加载并播放
      if (this.config.autoPlay) {
        await this.play(result);
      }

      return result;
    } catch (error) {
      this.emitEvent({
        type: 'tts_error',
        timestamp: Date.now(),
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  /**
   * 播放 TTS 结果
   */
  async play(result: TTSResult): Promise<void> {
    this.emitEvent({
      type: 'playback_start',
      timestamp: Date.now(),
    });

    await this.player.load(result.audioUrl);
    await this.player.play();
  }

  /**
   * 播放音频缓冲区
   */
  async playBuffer(buffer: ArrayBuffer, lipSyncData?: LipSyncFrame[]): Promise<void> {
    if (lipSyncData) {
      this.lipSyncData = lipSyncData;
    }

    await this.player.loadBuffer(buffer);
    await this.player.play();
  }

  /**
   * 暂停
   */
  pause(): void {
    this.player.pause();
  }

  /**
   * 恢复
   */
  async resume(): Promise<void> {
    await this.player.resume();
  }

  /**
   * 停止
   */
  stop(): void {
    this.player.stop();
    this.currentLipSyncFrame = null;
  }

  /**
   * 是否正在播放
   */
  isPlaying(): boolean {
    return this.player.isPlaying();
  }

  /**
   * 获取当前口型数据
   */
  getCurrentLipSyncFrame(): LipSyncFrame | null {
    return this.currentLipSyncFrame;
  }

  /**
   * 获取口型数据
   */
  getLipSyncData(): LipSyncFrame[] {
    return [...this.lipSyncData];
  }

  /**
   * 注册事件处理器
   */
  onEvent(handler: (event: TTSPlaybackEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * 获取播放器状态
   */
  getPlaybackState() {
    return this.player.getState();
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    this.player.setVolume(volume);
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.player.destroy();
    this.tts.destroy();
    this.eventHandlers.clear();
  }

  /**
   * 处理口型同步
   */
  private handleLipSync(currentTime: number): void {
    // 查找当前时间对应的口型帧
    const frame = this.findLipSyncFrame(currentTime);

    if (frame && frame !== this.currentLipSyncFrame) {
      this.currentLipSyncFrame = frame;

      this.emitEvent({
        type: 'lip_sync',
        timestamp: Date.now(),
        data: {
          time: currentTime,
          vowel: frame.vowel,
          intensity: frame.intensity,
        },
      });
    }
  }

  /**
   * 查找对应时间的口型帧
   */
  private findLipSyncFrame(time: number): LipSyncFrame | null {
    // 找到最接近当前时间的口型帧
    let closestFrame: LipSyncFrame | null = null;
    let minDiff = Infinity;

    for (const frame of this.lipSyncData) {
      const diff = Math.abs(frame.time - time * 1000); // time 是秒，frame.time 是毫秒
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    // 只返回时间差小于 100ms 的帧
    return minDiff < 100 ? closestFrame : null;
  }

  /**
   * 处理播放完成
   */
  private handlePlaybackComplete(): void {
    this.currentLipSyncFrame = null;

    this.emitEvent({
      type: 'playback_complete',
      timestamp: Date.now(),
    });
  }

  /**
   * 处理播放错误
   */
  private handlePlaybackError(error: Error): void {
    this.emitEvent({
      type: 'tts_error',
      timestamp: Date.now(),
      data: { error: error.message },
    });
  }

  /**
   * 触发事件
   */
  private emitEvent(event: TTSPlaybackEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('TTS playback event handler error:', error);
      }
    });
  }
}
