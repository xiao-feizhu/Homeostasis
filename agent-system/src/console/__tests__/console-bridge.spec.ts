/**
 * Console Bridge Tests
 * TDD for console bridge service
 */

// Mock browser APIs
global.document = {
  getElementById: jest.fn(() => ({
    getContext: jest.fn(),
    width: 800,
    height: 600,
  })),
} as any;

import { ConsoleBridge, ConsoleConfig } from '../services/console-bridge';
import { ExpressionType } from '../../avatar/entities/avatar.entity';

// Mock dependencies
jest.mock('../../avatar/adapters/airi-live2d/airi-live2d.adapter', () => ({
  AiriLive2DAdapter: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    loadModel: jest.fn().mockResolvedValue(undefined),
    setExpression: jest.fn().mockResolvedValue(undefined),
    startTalking: jest.fn(),
    stopTalking: jest.fn(),
    setLipSync: jest.fn(),
    destroy: jest.fn(),
    setEventHandlers: jest.fn(),
  })),
}));

jest.mock('../../emotion/pipeline/character-pipeline', () => ({
  CharacterPipeline: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
  })),
}));

jest.mock('../../audio/pipeline/transcription-pipeline', () => ({
  TranscriptionPipeline: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    onEvent: jest.fn().mockReturnValue(() => {}),
    destroy: jest.fn(),
  })),
}));

jest.mock('../../audio/output/tts-playback', () => ({
  TTSPlayback: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    speak: jest.fn().mockResolvedValue({
      audioUrl: 'test.mp3',
      duration: 1000,
      audioBuffer: new ArrayBuffer(1024),
    }),
    onEvent: jest.fn().mockReturnValue(() => {}),
    destroy: jest.fn(),
  })),
}));

describe('ConsoleBridge', () => {
  let bridge: ConsoleBridge;
  const mockConfig: ConsoleConfig = {
    canvasId: 'live2d-canvas',
    enableLive2D: true,
    enableAudio: true,
    enablePipeline: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    bridge = new ConsoleBridge(mockConfig);
  });

  afterEach(() => {
    bridge.destroy();
  });

  describe('Initialization', () => {
    it('should create bridge with config', () => {
      expect(bridge).toBeDefined();
    });

    it('should initialize successfully', async () => {
      await bridge.initialize();
      const state = bridge.getState();

      expect(state.isInitialized).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await bridge.initialize();
      await bridge.initialize();

      const state = bridge.getState();
      expect(state.isInitialized).toBe(true);
    });
  });

  describe('Live2D', () => {
    it('should load Live2D model', async () => {
      await bridge.initialize();
      await bridge.loadLive2DModel('/path/to/model.json');

      const state = bridge.getState();
      expect(state.isLive2DLoaded).toBe(true);
    });

    it('should throw error when loading model without Live2D', async () => {
      const bridgeWithoutLive2D = new ConsoleBridge({
        canvasId: 'test',
        enableLive2D: false,
      });

      await expect(bridgeWithoutLive2D.loadLive2DModel('/path/to/model.json'))
        .rejects.toThrow('Live2D not initialized');
    });

    it('should set expression', async () => {
      await bridge.initialize();
      await bridge.loadLive2DModel('/path/to/model.json');
      await bridge.setExpression(ExpressionType.HAPPY);

      const state = bridge.getState();
      expect(state.currentExpression).toBe(ExpressionType.HAPPY);
    });
  });

  describe('Messaging', () => {
    it('should send message and add to state', async () => {
      await bridge.initialize();

      const messagePromise = bridge.sendMessage('Hello AI');

      // Fast-forward timers for AI response
      jest.advanceTimersByTime(1500);

      await messagePromise;

      const state = bridge.getState();
      expect(state.messages.length).toBeGreaterThanOrEqual(1);
      expect(state.messages[0].content).toBe('Hello AI');
    }, 10000);

    it('should emit message events', async () => {
      await bridge.initialize();

      const messageHandler = jest.fn();
      bridge.onMessage(messageHandler);

      bridge.sendMessage('Test message');
      jest.advanceTimersByTime(100);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messageHandler).toHaveBeenCalled();
    }, 10000);
  });

  describe('Voice Input', () => {
    it('should start voice input', async () => {
      await bridge.initialize();
      await bridge.startVoiceInput();

      const state = bridge.getState();
      expect(state.isRecording).toBe(true);
    });

    it('should stop voice input', async () => {
      await bridge.initialize();
      await bridge.startVoiceInput();
      bridge.stopVoiceInput();

      const state = bridge.getState();
      expect(state.isRecording).toBe(false);
    });

    it('should throw error when starting voice without audio', async () => {
      const bridgeWithoutAudio = new ConsoleBridge({
        canvasId: 'test',
        enableAudio: false,
      });
      await bridgeWithoutAudio.initialize();

      await expect(bridgeWithoutAudio.startVoiceInput())
        .rejects.toThrow('Audio not initialized');
    });
  });

  describe('State Management', () => {
    it('should get current state', async () => {
      await bridge.initialize();

      const state = bridge.getState();

      expect(state).toHaveProperty('isInitialized');
      expect(state).toHaveProperty('isLive2DLoaded');
      expect(state).toHaveProperty('isRecording');
      expect(state).toHaveProperty('isSpeaking');
      expect(state).toHaveProperty('currentExpression');
      expect(state).toHaveProperty('currentEmotion');
      expect(state).toHaveProperty('messages');
    });

    it('should emit state changes', async () => {
      const stateHandler = jest.fn();
      bridge.onStateChange(stateHandler);

      await bridge.initialize();

      expect(stateHandler).toHaveBeenCalled();
    });
  });

  describe('Destroy', () => {
    it('should clean up on destroy', async () => {
      await bridge.initialize();
      bridge.destroy();

      const state = bridge.getState();
      expect(state.isInitialized).toBe(false);
    });
  });
});
