/**
 * Audio System Module
 * 音频系统 - 输入/输出/管道
 */

// 音频输入
export { MicrophoneCapture } from './input/microphone-capture';
export type {
  MicrophoneConfig,
  AudioDataEvent,
} from './input/microphone-capture';

export { VADEngine } from './input/vad-engine';
export type {
  VADConfig,
  VADEvent,
  VADState,
} from './input/vad-engine';

// 音频输出
export { AudioPlayer } from './output/audio-player';
export type {
  AudioPlayerConfig,
  AudioPlaybackState,
} from './output/audio-player';

export { TTSPlayback } from './output/tts-playback';
export type {
  TTSPlaybackConfig,
  TTSPlaybackEvent,
} from './output/tts-playback';

// 音频管道
export { TranscriptionPipeline } from './pipeline/transcription-pipeline';
export type {
  TranscriptionConfig,
  TranscriptionResult,
  TranscriptionEvent,
} from './pipeline/transcription-pipeline';
