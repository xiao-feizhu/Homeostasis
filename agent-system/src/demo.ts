/**
 * Demo Entry Point
 * 演示入口 - 整合所有功能展示
 */

import { ConsoleBridge } from './console';
import { TelegramBot, TelegramAgentBridge } from './services/telegram';
import { ExpressionType } from './avatar/entities/avatar.entity';

export interface DemoConfig {
  enableLive2D?: boolean;
  enableAudio?: boolean;
  enableTelegram?: boolean;
  telegramToken?: string;
}

/**
 * Demo Runner
 * 运行完整演示
 */
export class DemoRunner {
  private console: ConsoleBridge | null = null;
  private telegramBot: TelegramBot | null = null;
  private telegramBridge: TelegramAgentBridge | null = null;
  private config: Required<DemoConfig>;

  constructor(config: DemoConfig = {}) {
    this.config = {
      enableLive2D: true,
      enableAudio: true,
      enableTelegram: false,
      telegramToken: '',
      ...config,
    };
  }

  /**
   * 初始化演示
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Demo...');

    // 1. 初始化控制台
    this.console = new ConsoleBridge({
      canvasId: 'live2d-canvas',
      enableLive2D: this.config.enableLive2D,
      enableAudio: this.config.enableAudio,
      enablePipeline: true,
    });

    await this.console.initialize();
    console.log('✅ Console initialized');

    // 2. 初始化 Telegram (如果配置了 token)
    if (this.config.enableTelegram && this.config.telegramToken) {
      await this.initializeTelegram();
    }

    console.log('🎉 Demo ready!');
  }

  /**
   * 运行演示场景
   */
  async runScenario(scenario: string): Promise<void> {
    switch (scenario) {
      case 'expressions':
        await this.runExpressionDemo();
        break;
      case 'conversation':
        await this.runConversationDemo();
        break;
      case 'voice':
        await this.runVoiceDemo();
        break;
      case 'full':
        await this.runFullDemo();
        break;
      default:
        console.log('Available scenarios: expressions, conversation, voice, full');
    }
  }

  /**
   * 表情演示
   */
  private async runExpressionDemo(): Promise<void> {
    console.log('🎭 Running Expression Demo...');

    if (!this.console) return;

    const expressions = [
      ExpressionType.NEUTRAL,
      ExpressionType.HAPPY,
      ExpressionType.SAD,
      ExpressionType.ANGRY,
      ExpressionType.SURPRISED,
      ExpressionType.NEUTRAL,
    ];

    for (const expression of expressions) {
      console.log(`Setting expression: ${expression}`);
      await this.console.setExpression(expression);
      await this.sleep(2000);
    }

    console.log('✅ Expression demo complete');
  }

  /**
   * 对话演示
   */
  private async runConversationDemo(): Promise<void> {
    console.log('💬 Running Conversation Demo...');

    if (!this.console) return;

    const conversations = [
      { text: '你好！', expectedEmotion: 'happy' },
      { text: '我有点难过...', expectedEmotion: 'sad' },
      { text: '谢谢你安慰我', expectedEmotion: 'grateful' },
      { text: '再见！', expectedEmotion: 'neutral' },
    ];

    for (const turn of conversations) {
      console.log(`User: ${turn.text}`);
      await this.console.sendMessage(turn.text);
      await this.sleep(4000); // 等待 AI 回复
    }

    console.log('✅ Conversation demo complete');
  }

  /**
   * 语音演示
   */
  private async runVoiceDemo(): Promise<void> {
    console.log('🎤 Running Voice Demo...');

    if (!this.console) return;

    // TTS 演示
    const phrases = [
      '你好，这是语音合成测试',
      '我能根据文字生成语音',
      '并且口型会与语音同步',
    ];

    for (const phrase of phrases) {
      console.log(`Speaking: ${phrase}`);
      await this.console.speak(phrase);
      await this.sleep(3000);
    }

    console.log('✅ Voice demo complete');
  }

  /**
   * 完整演示
   */
  private async runFullDemo(): Promise<void> {
    console.log('🎬 Running Full Demo...');

    // 1. 表情展示
    await this.runExpressionDemo();

    // 2. 对话交互
    await this.runConversationDemo();

    // 3. 语音合成
    await this.runVoiceDemo();

    console.log('🎉 Full demo complete!');
  }

  /**
   * 获取状态
   */
  getState() {
    return {
      console: this.console?.getState(),
      telegram: this.telegramBot?.isRunning(),
    };
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.console?.destroy();
    this.telegramBot?.destroy();
    console.log('Demo destroyed');
  }

  /**
   * 初始化 Telegram
   */
  private async initializeTelegram(): Promise<void> {
    if (!this.config.telegramToken) return;

    this.telegramBot = new TelegramBot({
      token: this.config.telegramToken,
    });

    await this.telegramBot.initialize();

    this.telegramBridge = new TelegramAgentBridge({
      bot: this.telegramBot,
      enableTTS: this.config.enableAudio,
    });

    await this.telegramBridge.initialize();

    console.log('✅ Telegram Bot initialized');
  }

  /**
   * 延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const demo = new DemoRunner({
    enableLive2D: true,
    enableAudio: true,
    enableTelegram: !!process.env.TELEGRAM_BOT_TOKEN,
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  });

  demo.initialize().then(() => {
    // 默认运行完整演示
    demo.runScenario('full');
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    demo.destroy();
    process.exit(0);
  });
}
