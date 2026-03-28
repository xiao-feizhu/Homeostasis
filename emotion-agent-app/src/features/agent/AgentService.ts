import { WebSocketManager } from './WebSocketManager';
import type {
  LLMProvider,
  Message,
  AgentActionResponse,
  EmotionType,
} from '@/shared/types';

interface AgentServiceConfig {
  serverUrl: string;
  provider?: LLMProvider;
  sessionId?: string;
}

interface AgentRequest {
  type: 'chat' | 'voice';
  sessionId: string;
  message?: string;
  audioBase64?: string;
  provider: LLMProvider;
  history: Array<{ role: 'user' | 'agent'; content: string }>;
}

export class AgentService {
  private wsManager: WebSocketManager;
  private config: AgentServiceConfig;
  private messages: Message[] = [];
  private currentStreamingMessage: string = '';
  private onMessageCallback: ((msg: Message) => void) | null = null;
  private onActionCallback: ((action: AgentActionResponse) => void) | null = null;
  private onDeltaCallback: ((delta: string) => void) | null = null;

  constructor(config: AgentServiceConfig) {
    this.config = {
      provider: 'kimi',
      ...config,
    };

    this.wsManager = new WebSocketManager(config.serverUrl);
    this.setupEventHandlers();
  }

  getProvider(): LLMProvider {
    return this.config.provider!;
  }

  setProvider(provider: LLMProvider): void {
    this.config.provider = provider;
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  onMessage(callback: (msg: Message) => void): void {
    this.onMessageCallback = callback;
  }

  onDelta(callback: (delta: string) => void): void {
    this.onDeltaCallback = callback;
  }

  onAction(callback: (action: AgentActionResponse) => void): void {
    this.onActionCallback = callback;
  }

  parseEmotion(response: any): { type: EmotionType; intensity: number } | null {
    if (response?.emotion?.type) {
      return {
        type: response.emotion.type,
        intensity: response.emotion.intensity || 0.5,
      };
    }
    return null;
  }

  private setupEventHandlers(): void {
    this.wsManager.on('connected', () => {
      console.log('[Agent] Connected to server');
    });

    this.wsManager.on('disconnected', () => {
      console.log('[Agent] Disconnected from server');
    });

    this.wsManager.on('delta', (data) => {
      if (data.content) {
        this.currentStreamingMessage += data.content;
        this.onDeltaCallback?.(data.content);
      }
    });

    this.wsManager.on('complete', (data) => {
      const message: Message = {
        id: this.generateId(),
        role: 'agent',
        content: this.currentStreamingMessage || data.content,
        emotion: data.emotion?.type,
        timestamp: Date.now(),
      };

      this.messages.push(message);
      this.onMessageCallback?.(message);
      this.currentStreamingMessage = '';

      if (data.actions || data.emotion) {
        this.onActionCallback?.(data as AgentActionResponse);
      }
    });

    this.wsManager.on('error', (error) => {
      console.error('[Agent] Error:', error);
    });
  }

  async connect(): Promise<void> {
    const sessionId = this.config.sessionId || this.generateId();
    await this.wsManager.connect({ sessionId });
  }

  disconnect(): void {
    this.wsManager.disconnect();
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.wsManager.isConnected()) {
      await this.connect();
    }

    const userMessage: Message = {
      id: this.generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    this.messages.push(userMessage);

    const request: AgentRequest = {
      type: 'chat',
      sessionId: this.config.sessionId || 'default',
      message: text,
      provider: this.config.provider!,
      history: this.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    this.wsManager.send(request);
  }

  async sendVoice(audioBase64: string, transcript: string): Promise<void> {
    if (!this.wsManager.isConnected()) {
      await this.connect();
    }

    const request: AgentRequest = {
      type: 'voice',
      sessionId: this.config.sessionId || 'default',
      message: transcript,
      audioBase64,
      provider: this.config.provider!,
      history: this.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    this.wsManager.send(request);
  }

  clearHistory(): void {
    this.messages = [];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
