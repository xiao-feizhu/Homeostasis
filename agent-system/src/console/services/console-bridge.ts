/**
 * Console Bridge
 * 桥接控制台 UI 和 Agent System 后端
 */

import { AiriLive2DAdapter } from '../../avatar/adapters/airi-live2d/airi-live2d.adapter';
import { CharacterPipeline } from '../../emotion/pipeline/character-pipeline';
import { TranscriptionPipeline } from '../../audio/pipeline/transcription-pipeline';
import { TTSPlayback } from '../../audio/output/tts-playback';
import { ExpressionType } from '../../avatar/entities/avatar.entity';

export interface ConsoleConfig {
  canvasId: string;
  enableLive2D?: boolean;
  enableAudio?: boolean;
  enablePipeline?: boolean;
}

export interface ConsoleState {
  isInitialized: boolean;
  isLive2DLoaded: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  currentExpression: ExpressionType;
  currentEmotion: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  emotion?: string;
}

/**
 * 控制台桥接服务
 * 统一接口供 UI 层调用
 */
export class ConsoleBridge {
  private config: Required<ConsoleConfig>;
  private live2dAdapter: AiriLive2DAdapter | null = null;
  private pipeline: CharacterPipeline | null = null;
  private transcription: TranscriptionPipeline | null = null;
  private tts: TTSPlayback | null = null;

  private state: ConsoleState = {
    isInitialized: false,
    isLive2DLoaded: false,
    isRecording: false,
    isSpeaking: false,
    currentExpression: ExpressionType.NEUTRAL,
    currentEmotion: 'neutral',
    messages: [],
  };

  private stateListeners: Set<(state: ConsoleState) => void> = new Set();
  private messageListeners: Set<(message: ChatMessage) => void> = new Set();

  constructor(config: ConsoleConfig) {
    this.config = {
      enableLive2D: true,
      enableAudio: true,
      enablePipeline: true,
      ...config,
    };
  }

  /**
   * 初始化控制台
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      return;
    }

    // 1. 初始化 Live2D
    if (this.config.enableLive2D) {
      await this.initializeLive2D();
    }

    // 2. 初始化 Pipeline
    if (this.config.enablePipeline) {
      this.pipeline = new CharacterPipeline();
      await this.pipeline.initialize();
    }

    // 3. 初始化音频
    if (this.config.enableAudio) {
      this.transcription = new TranscriptionPipeline();
      await this.transcription.initialize();

      this.tts = new TTSPlayback();
      await this.tts.initialize();
    }

    this.state.isInitialized = true;
    this.emitStateUpdate();

    console.log('Console Bridge initialized');
  }

  /**
   * 加载 Live2D 模型
   */
  async loadLive2DModel(modelPath: string): Promise<void> {
    if (!this.live2dAdapter) {
      throw new Error('Live2D not initialized');
    }

    await this.live2dAdapter.loadModel({
      modelId: 'default',
      name: 'Live2D Model',
      version: '1.0',
      modelPath,
      texturePath: '',
    });

    this.state.isLive2DLoaded = true;
    this.emitStateUpdate();
  }

  /**
   * 设置表情
   */
  async setExpression(expression: ExpressionType): Promise<void> {
    if (!this.live2dAdapter) {
      return;
    }

    await this.live2dAdapter.setExpression(expression);
    this.state.currentExpression = expression;
    this.emitStateUpdate();
  }

  /**
   * 发送消息
   */
  async sendMessage(content: string): Promise<void> {
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    this.state.messages.push(userMessage);
    this.emitStateUpdate();
    this.emitMessage(userMessage);

    // 模拟 AI 回复 (实际项目应调用 LLM)
    await this.simulateAIResponse(content);
  }

  /**
   * 开始语音输入
   */
  async startVoiceInput(): Promise<void> {
    if (!this.transcription) {
      throw new Error('Audio not initialized');
    }

    await this.transcription.start();
    this.state.isRecording = true;
    this.emitStateUpdate();

    // 监听转录结果
    this.transcription.onEvent((event) => {
      if (event.type === 'result' && event.data?.text) {
        this.sendMessage(event.data.text);
      }

      if (event.type === 'speech_end') {
        this.state.isRecording = false;
        this.emitStateUpdate();
      }
    });
  }

  /**
   * 停止语音输入
   */
  stopVoiceInput(): void {
    this.transcription?.stop();
    this.state.isRecording = false;
    this.emitStateUpdate();
  }

  /**
   * 开始说话 (TTS)
   */
  async speak(text: string): Promise<void> {
    if (!this.tts) {
      return;
    }

    this.state.isSpeaking = true;
    this.emitStateUpdate();

    // 触发表情
    this.live2dAdapter?.startTalking();

    // 监听口型同步
    const unregister = this.tts.onEvent((event) => {
      if (event.type === 'lip_sync') {
        this.live2dAdapter?.setLipSync(event.data.vowel, event.data.intensity);
      }

      if (event.type === 'playback_complete') {
        this.state.isSpeaking = false;
        this.live2dAdapter?.stopTalking();
        this.emitStateUpdate();
        unregister();
      }
    });

    await this.tts.speak({
      text,
      emotion: this.state.currentEmotion,
    });
  }

  /**
   * 获取当前状态
   */
  getState(): ConsoleState {
    return { ...this.state };
  }

  /**
   * 注册状态监听器
   */
  onStateChange(listener: (state: ConsoleState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * 注册消息监听器
   */
  onMessage(listener: (message: ChatMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.live2dAdapter?.destroy();
    this.pipeline?.destroy();
    this.transcription?.destroy();
    this.tts?.destroy();

    this.stateListeners.clear();
    this.messageListeners.clear();

    this.state.isInitialized = false;
    this.emitStateUpdate();
  }

  /**
   * 初始化 Live2D
   */
  private async initializeLive2D(): Promise<void> {
    const canvas = document.getElementById(this.config.canvasId) as HTMLCanvasElement;
    if (!canvas) {
      console.warn(`Canvas ${this.config.canvasId} not found`);
      return;
    }

    this.live2dAdapter = new AiriLive2DAdapter();

    await this.live2dAdapter.initialize({
      canvas,
      options: {
        autoIdle: true,
        transparentBackground: true,
      },
    });

    // 设置事件监听
    this.live2dAdapter.setEventHandlers({
      onModelLoaded: () => {
        console.log('Live2D model loaded');
        this.state.isLive2DLoaded = true;
        this.emitStateUpdate();
      },
      onModelError: (error) => {
        console.error('Live2D model error:', error);
      },
    });
  }

  /**
   * 模拟 AI 回复
   */
  private async simulateAIResponse(userMessage: string): Promise<void> {
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 生成简单回复
    let reply = '';
    let emotion = 'neutral';

    if (userMessage.includes('你好') || userMessage.includes('hi')) {
      reply = '你好！很高兴见到你。我是你的 AI 助手。';
      emotion = 'happy';
    } else if (userMessage.includes('再见')) {
      reply = '再见！有需要随时找我。';
      emotion = 'neutral';
    } else {
      reply = `我收到了你的消息："${userMessage}"\n\n（这是演示回复，实际项目应集成 LLM）`;
    }

    // 更新表情
    this.state.currentEmotion = emotion;
    if (emotion === 'happy') {
      await this.setExpression(ExpressionType.HAPPY);
    }

    // 添加 AI 消息
    const aiMessage: ChatMessage = {
      id: `msg_${Date.now()}_ai`,
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
      emotion,
    };

    this.state.messages.push(aiMessage);
    this.emitStateUpdate();
    this.emitMessage(aiMessage);

    // 语音回复
    await this.speak(reply);

    // 恢复中性表情
    await this.setExpression(ExpressionType.NEUTRAL);
  }

  /**
   * 触发状态更新
   */
  private emitStateUpdate(): void {
    const state = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
  }

  /**
   * 触发消息事件
   */
  private emitMessage(message: ChatMessage): void {
    this.messageListeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        console.error('Message listener error:', error);
      }
    });
  }
}
