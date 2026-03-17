/**
 * Telegram Bot Tests
 * TDD for Telegram Bot service
 */

import { TelegramBot, TelegramConfig } from '../bot';

// Mock node-telegram-bot-api
jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    onText: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({
      message_id: 123,
      chat: { id: 123, type: 'private' },
      text: 'Hello user',
    }),
    sendPhoto: jest.fn().mockResolvedValue({ message_id: 124 }),
    sendVoice: jest.fn().mockResolvedValue({ message_id: 125 }),
    startPolling: jest.fn(),
    stopPolling: jest.fn().mockResolvedValue(undefined),
    isPolling: jest.fn().mockReturnValue(false),
    getMe: jest.fn().mockResolvedValue({
      id: 123456,
      username: 'test_bot',
      first_name: 'Test Bot',
    }),
  }));
});

describe('TelegramBot', () => {
  let bot: TelegramBot;
  const mockConfig: TelegramConfig = {
    token: 'test-token-12345',
    username: 'test_bot',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    bot = new TelegramBot(mockConfig);
  });

  afterEach(() => {
    bot.destroy();
  });

  describe('Initialization', () => {
    it('should create bot with config', () => {
      expect(bot).toBeDefined();
      expect(bot.isRunning()).toBe(false);
    });

    it('should throw error without token', () => {
      expect(() => new TelegramBot({} as TelegramConfig)).toThrow('Token is required');
    });

    it('should initialize successfully', async () => {
      await bot.initialize();
      expect(bot.isRunning()).toBe(true);
    });

    it('should not reinitialize if already running', async () => {
      await bot.initialize();
      await bot.initialize();
      expect(bot.isRunning()).toBe(true);
    });
  });

  describe('Message Handling', () => {
    it('should register message handler', async () => {
      await bot.initialize();

      const handler = jest.fn();
      bot.onMessage(handler);

      expect(bot.hasMessageHandler(handler)).toBe(true);
    });

    it('should unregister message handler', async () => {
      await bot.initialize();

      const handler = jest.fn();
      bot.onMessage(handler);
      bot.offMessage(handler);

      expect(bot.hasMessageHandler(handler)).toBe(false);
    });

    it('should handle text messages', async () => {
      await bot.initialize();

      const handler = jest.fn();
      bot.onMessage(handler);

      // Simulate message
      const mockMessage: any = {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        from: { id: 456, username: 'testuser', is_bot: false, first_name: 'Test' },
        text: 'Hello bot',
        date: Date.now(),
      };

      await bot.simulateMessage(mockMessage);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Hello bot',
        userId: '456',
        chatId: 123,
      }));
    });
  });

  describe('Command Handling', () => {
    it('should register command handler', async () => {
      await bot.initialize();

      const handler = jest.fn();
      bot.onCommand('start', handler);

      expect(bot.hasCommandHandler('start')).toBe(true);
    });

    it('should handle /start command', async () => {
      await bot.initialize();

      const handler = jest.fn();
      bot.onCommand('start', handler);

      const mockMessage: any = {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        from: { id: 456, username: 'testuser', is_bot: false, first_name: 'Test' },
        text: '/start',
        date: Date.now(),
      };

      await bot.simulateMessage(mockMessage);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Sending Messages', () => {
    it('should send text message', async () => {
      await bot.initialize();

      const result = await bot.sendMessage(123, 'Hello user');

      expect(result).toBeDefined();
      expect(result.messageId).toBe(123);
    });

    it('should send message with options', async () => {
      await bot.initialize();

      await bot.sendMessage(123, 'Hello', {
        replyToMessageId: 456,
        parseMode: 'HTML',
      });
    });

    it('should throw error when not initialized', async () => {
      await expect(bot.sendMessage(123, 'Hello')).rejects.toThrow('Bot not initialized');
    });
  });

  describe('Session Management', () => {
    it('should create session for user', async () => {
      await bot.initialize();

      const session = bot.getOrCreateSession(456, 123);

      expect(session).toBeDefined();
      expect(session.userId).toBe('456');
      expect(session.chatId).toBe(123);
    });

    it('should return existing session', async () => {
      await bot.initialize();

      const session1 = bot.getOrCreateSession(456, 123);
      const session2 = bot.getOrCreateSession(456, 123);

      expect(session1).toBe(session2);
    });

    it('should clear session', async () => {
      await bot.initialize();

      bot.getOrCreateSession(456, 123);
      bot.clearSession(456, 123);

      expect(bot.hasSession(456, 123)).toBe(false);
    });
  });

  describe('Integration with Emotion System', () => {
    it('should set emotion provider', async () => {
      const mockProvider = {
        analyze: jest.fn().mockResolvedValue({ state: 'happy' }),
      };

      bot.setEmotionProvider(mockProvider);

      expect(bot.getEmotionProvider()).toBe(mockProvider);
    });

    it('should analyze emotion on message', async () => {
      const mockProvider = {
        analyze: jest.fn().mockResolvedValue({
          state: 'positive',
          intensity: 0.8,
        }),
      };

      bot.setEmotionProvider(mockProvider);
      await bot.initialize();

      const mockMessage: any = {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        from: { id: 456, username: 'testuser', is_bot: false, first_name: 'Test' },
        text: 'Great!',
        date: Date.now(),
      };

      await bot.simulateMessage(mockMessage);

      expect(mockProvider.analyze).toHaveBeenCalledWith('Great!');
    });
  });

  describe('Integration with Memory System', () => {
    it('should set memory provider', () => {
      const mockProvider = {
        get: jest.fn(),
        set: jest.fn(),
      };

      bot.setMemoryProvider(mockProvider);

      expect(bot.getMemoryProvider()).toBe(mockProvider);
    });
  });

  describe('Stop/Destroy', () => {
    it('should stop polling', async () => {
      await bot.initialize();
      await bot.stop();

      expect(bot.isRunning()).toBe(false);
    });

    it('should destroy and clean up', async () => {
      await bot.initialize();
      await bot.destroy();

      expect(bot.isRunning()).toBe(false);
    });
  });
});
