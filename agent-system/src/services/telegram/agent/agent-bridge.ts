/**
 * Telegram Agent Bridge
 * 桥接 Telegram Bot 和 Agent System
 */

import { TelegramBot, TelegramMessage, SendMessageResult } from '../bot';
import { CharacterPipeline } from '../../../emotion/pipeline/character-pipeline';
import { TTSPlayback } from '../../../audio/output/tts-playback';

export interface AgentBridgeConfig {
  bot: TelegramBot;
  pipeline?: CharacterPipeline;
  tts?: TTSPlayback;
  enableTTS?: boolean;
  responseDelay?: number;
}

export interface AgentResponse {
  text: string;
  emotion?: string;
  audioUrl?: string;
  suggestions?: string[];
}

/**
 * Agent Bridge
 * 连接 Telegram Bot 与 Agent System 的核心组件
 */
export class TelegramAgentBridge {
  private config: Required<Omit<AgentBridgeConfig, 'bot' | 'pipeline' | 'tts'>> &
    Pick<AgentBridgeConfig, 'bot' | 'pipeline' | 'tts'>;

  constructor(config: AgentBridgeConfig) {
    this.config = {
      bot: config.bot,
      pipeline: config.pipeline,
      tts: config.tts,
      enableTTS: config.enableTTS ?? false,
      responseDelay: config.responseDelay ?? 500,
    };
  }

  /**
   * 初始化桥接
   */
  async initialize(): Promise<void> {
    // 注册消息处理器
    this.config.bot.onMessage(async (message) => {
      await this.handleMessage(message);
    });

    // 注册命令处理器
    this.config.bot.onCommand('start', async (msg) => {
      await this.handleStartCommand(msg);
    });

    this.config.bot.onCommand('help', async (msg) => {
      await this.handleHelpCommand(msg);
    });

    this.config.bot.onCommand('voice', async (msg) => {
      await this.handleVoiceCommand(msg);
    });

    console.log('Telegram Agent Bridge initialized');
  }

  /**
   * 处理消息
   */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    if (!message.text) {
      return;
    }

    // 模拟思考延迟
    await this.sleep(this.config.responseDelay);

    // 生成回复
    const response = await this.generateResponse(message);

    // 发送文本回复
    const result = await this.config.bot.sendMessage(
      message.chatId,
      response.text,
      {
        replyToMessageId: message.messageId,
      }
    );

    // 发送语音（如果启用）
    if (this.config.enableTTS && this.config.tts && response.text) {
      try {
        await this.sendVoiceResponse(message.chatId, response.text, result);
      } catch (error) {
        console.error('TTS error:', error);
      }
    }
  }

  /**
   * 生成回复
   */
  private async generateResponse(message: TelegramMessage): Promise<AgentResponse> {
    const text = message.text || '';

    // 简单的回复逻辑（实际项目应调用 LLM）
    if (text.includes('你好') || text.includes('hi') || text.includes('hello')) {
      return {
        text: '你好！我是你的 AI 助手。有什么可以帮助你的吗？',
        emotion: 'happy',
      };
    }

    if (text.includes('谢谢') || text.includes('感谢')) {
      return {
        text: '不客气！很高兴能帮到你。',
        emotion: 'happy',
      };
    }

    if (text.includes('再见') || text.includes('拜拜')) {
      return {
        text: '再见！有需要随时找我。',
        emotion: 'neutral',
      };
    }

    // 默认回复
    return {
      text: `收到你的消息："${text}"\n\n（这是默认回复，实际项目应集成 LLM 生成回复）`,
      emotion: 'neutral',
    };
  }

  /**
   * 发送语音回复
   */
  private async sendVoiceResponse(
    chatId: number,
    text: string,
    replyTo: SendMessageResult
  ): Promise<void> {
    if (!this.config.tts) {
      return;
    }

    // 合成语音
    const result = await this.config.tts.speak({
      text,
      emotion: 'neutral',
    });

    // 获取音频缓冲区
    if (result.audioBuffer) {
      await this.config.bot.sendVoice(chatId, Buffer.from(result.audioBuffer), {
        replyToMessageId: replyTo.messageId,
      });
    }
  }

  /**
   * 处理 /start 命令
   */
  private async handleStartCommand(message: TelegramMessage): Promise<void> {
    const welcomeText = `
🎉 欢迎使用 AI Agent Bot!

我是你的智能助手，可以：
• 💬 进行智能对话
• 🎭 表达情感
• 🔊 语音回复 (使用 /voice 开启)

发送消息开始对话吧！
    `.trim();

    await this.config.bot.sendMessage(message.chatId, welcomeText);
  }

  /**
   * 处理 /help 命令
   */
  private async handleHelpCommand(message: TelegramMessage): Promise<void> {
    const helpText = `
🤖 可用命令：

/start - 开始使用
/help - 显示帮助
/voice - 切换语音回复

💡 提示：
• 直接发送消息进行对话
• 我会根据内容分析情感
• 支持中文和英文
    `.trim();

    await this.config.bot.sendMessage(message.chatId, helpText);
  }

  /**
   * 处理 /voice 命令
   */
  private async handleVoiceCommand(message: TelegramMessage): Promise<void> {
    this.config.enableTTS = !this.config.enableTTS;

    const status = this.config.enableTTS ? '开启' : '关闭';
    await this.config.bot.sendMessage(
      message.chatId,
      `🔊 语音回复已${status}`
    );
  }

  /**
   * 延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
