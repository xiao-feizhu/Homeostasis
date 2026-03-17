/**
 * Telegram Bot Service
 * Telegram Bot 服务 - 集成到 Agent System
 */

import TelegramBotAPI, { Message } from 'node-telegram-bot-api';

export interface TelegramConfig {
  token: string;
  username?: string;
  webhookUrl?: string;
  polling?: boolean;
  allowedUsers?: number[];
}

export interface TelegramMessage {
  messageId: number;
  chatId: number;
  userId: string;
  username?: string;
  text?: string;
  photo?: any[];
  voice?: any;
  date: number;
  replyToMessageId?: number;
}

export interface TelegramSession {
  userId: string;
  chatId: number;
  username?: string;
  context: {
    lastMessageTime: number;
    messageCount: number;
    emotionState?: string;
  };
}

export interface SendMessageOptions {
  replyToMessageId?: number;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableNotification?: boolean;
}

export interface SendMessageResult {
  messageId: number;
  chatId: number;
  text: string;
}

export type MessageHandler = (message: TelegramMessage) => void | Promise<void>;
export type CommandHandler = (message: TelegramMessage, args: string[]) => void | Promise<void>;

/**
 * Telegram Bot 服务
 * 封装 node-telegram-bot-api，集成情感系统和记忆系统
 */
export class TelegramBot {
  private api: TelegramBotAPI | null = null;
  private config: TelegramConfig;
  private messageHandlers: Set<MessageHandler> = new Set();
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private sessions: Map<string, TelegramSession> = new Map();
  private emotionProvider: any = null;
  private memoryProvider: any = null;
  private running = false;

  constructor(config: TelegramConfig) {
    if (!config.token) {
      throw new Error('Token is required');
    }
    this.config = config;
  }

  /**
   * 初始化 Bot
   */
  async initialize(): Promise<void> {
    if (this.running) {
      return;
    }

    this.api = new TelegramBotAPI(this.config.token, {
      polling: this.config.polling ?? true,
      webHook: this.config.webhookUrl ? { port: 8443 } : false,
    });

    // 设置消息监听器
    this.api.on('message', (msg: Message) => {
      this.handleMessage(msg);
    });

    // 设置命令监听器
    this.api.onText(/^\/([a-zA-Z0-9_]+)(?:\s+(.+))?/, (msg: Message, match: RegExpExecArray | null) => {
      if (match) {
        const command = match[1];
        const args = match[2]?.split(/\s+/) || [];
        this.handleCommand(msg, command, args);
      }
    });

    this.running = true;

    // 获取 bot 信息
    const me = await this.api.getMe();
    console.log(`Telegram Bot initialized: @${me.username}`);
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 注册消息处理器
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.add(handler);
  }

  /**
   * 取消注册消息处理器
   */
  offMessage(handler: MessageHandler): void {
    this.messageHandlers.delete(handler);
  }

  /**
   * 检查是否有消息处理器
   */
  hasMessageHandler(handler: MessageHandler): boolean {
    return this.messageHandlers.has(handler);
  }

  /**
   * 注册命令处理器
   */
  onCommand(command: string, handler: CommandHandler): void {
    this.commandHandlers.set(command, handler);
  }

  /**
   * 检查是否有命令处理器
   */
  hasCommandHandler(command: string): boolean {
    return this.commandHandlers.has(command);
  }

  /**
   * 发送文本消息
   */
  async sendMessage(chatId: number, text: string, options?: SendMessageOptions): Promise<SendMessageResult> {
    if (!this.api || !this.running) {
      throw new Error('Bot not initialized');
    }

    const sendOptions: any = {};
    if (options?.replyToMessageId) {
      sendOptions.reply_to_message_id = options.replyToMessageId;
    }
    if (options?.parseMode) {
      sendOptions.parse_mode = options.parseMode;
    }
    if (options?.disableNotification) {
      sendOptions.disable_notification = options.disableNotification;
    }

    const result = await this.api.sendMessage(chatId, text, sendOptions);

    return {
      messageId: result.message_id,
      chatId: result.chat.id,
      text: result.text || text,
    };
  }

  /**
   * 发送语音消息
   */
  async sendVoice(chatId: number, voice: Buffer | string, options?: SendMessageOptions): Promise<SendMessageResult> {
    if (!this.api || !this.running) {
      throw new Error('Bot not initialized');
    }

    const sendOptions: any = {};
    if (options?.replyToMessageId) {
      sendOptions.reply_to_message_id = options.replyToMessageId;
    }

    const result = await this.api.sendVoice(chatId, voice, sendOptions);

    return {
      messageId: result.message_id,
      chatId: result.chat.id,
      text: '[voice]',
    };
  }

  /**
   * 获取或创建会话
   */
  getOrCreateSession(userId: number, chatId: number): TelegramSession {
    const key = `${userId}:${chatId}`;

    if (!this.sessions.has(key)) {
      this.sessions.set(key, {
        userId: String(userId),
        chatId,
        context: {
          lastMessageTime: Date.now(),
          messageCount: 0,
        },
      });
    }

    const session = this.sessions.get(key)!;
    session.context.lastMessageTime = Date.now();
    session.context.messageCount++;

    return session;
  }

  /**
   * 检查是否有会话
   */
  hasSession(userId: number, chatId: number): boolean {
    const key = `${userId}:${chatId}`;
    return this.sessions.has(key);
  }

  /**
   * 清除会话
   */
  clearSession(userId: number, chatId: number): void {
    const key = `${userId}:${chatId}`;
    this.sessions.delete(key);
  }

  /**
   * 设置情感提供者
   */
  setEmotionProvider(provider: any): void {
    this.emotionProvider = provider;
  }

  /**
   * 获取情感提供者
   */
  getEmotionProvider(): any {
    return this.emotionProvider;
  }

  /**
   * 设置记忆提供者
   */
  setMemoryProvider(provider: any): void {
    this.memoryProvider = provider;
  }

  /**
   * 获取记忆提供者
   */
  getMemoryProvider(): any {
    return this.memoryProvider;
  }

  /**
   * 停止 Bot
   */
  async stop(): Promise<void> {
    if (!this.api) {
      return;
    }

    if (this.api.isPolling()) {
      await this.api.stopPolling();
    }

    this.running = false;
  }

  /**
   * 销毁 Bot
   */
  async destroy(): Promise<void> {
    await this.stop();

    this.messageHandlers.clear();
    this.commandHandlers.clear();
    this.sessions.clear();

    this.api = null;
  }

  /**
   * 模拟消息（用于测试）
   */
  async simulateMessage(msg: Partial<Message>): Promise<void> {
    await this.handleMessage(msg as Message);

    // 如果是命令，也触发命令处理
    if (msg.text?.startsWith('/')) {
      const match = /^\/([a-zA-Z0-9_]+)(?:\s+(.+))?/.exec(msg.text);
      if (match) {
        const command = match[1];
        const args = match[2]?.split(/\s+/) || [];
        await this.handleCommand(msg as Message, command, args);
      }
    }
  }

  /**
   * 处理消息
   */
  private async handleMessage(msg: Message): Promise<void> {
    // 检查用户权限
    if (this.config.allowedUsers && msg.from) {
      if (!this.config.allowedUsers.includes(msg.from.id)) {
        console.warn(`Unauthorized user: ${msg.from.id}`);
        return;
      }
    }

    // 更新会话
    if (msg.from) {
      this.getOrCreateSession(msg.from.id, msg.chat.id);
    }

    // 转换消息格式
    const telegramMsg = this.convertMessage(msg);

    // 情感分析
    if (this.emotionProvider && telegramMsg.text) {
      try {
        const emotion = await this.emotionProvider.analyze(telegramMsg.text);
        const session = this.getOrCreateSession(Number(telegramMsg.userId), telegramMsg.chatId);
        session.context.emotionState = emotion.state;
      } catch (error) {
        console.error('Emotion analysis error:', error);
      }
    }

    // 触发消息处理器
    for (const handler of this.messageHandlers) {
      try {
        await handler(telegramMsg);
      } catch (error) {
        console.error('Message handler error:', error);
      }
    }
  }

  /**
   * 处理命令
   */
  private async handleCommand(msg: Message, command: string, args: string[]): Promise<void> {
    const handler = this.commandHandlers.get(command);

    if (handler) {
      const telegramMsg = this.convertMessage(msg);

      try {
        await handler(telegramMsg, args);
      } catch (error) {
        console.error(`Command handler error (${command}):`, error);
      }
    }
  }

  /**
   * 转换消息格式
   */
  private convertMessage(msg: Message): TelegramMessage {
    return {
      messageId: msg.message_id,
      chatId: msg.chat.id,
      userId: String(msg.from?.id || 0),
      username: msg.from?.username,
      text: msg.text,
      photo: msg.photo,
      voice: msg.voice,
      date: msg.date,
      replyToMessageId: msg.reply_to_message?.message_id,
    };
  }
}
