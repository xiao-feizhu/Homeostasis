/**
 * Microphone Capture Tests
 * TDD for audio input capture
 */

// Mock browser APIs
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn(),
  },
} as any;

global.MediaStream = jest.fn().mockImplementation(() => ({
  getTracks: jest.fn().mockReturnValue([{
    stop: jest.fn(),
    enabled: true,
  }]),
  getAudioTracks: jest.fn().mockReturnValue([{
    stop: jest.fn(),
    enabled: true,
    getSettings: jest.fn().mockReturnValue({ sampleRate: 16000 }),
  }]),
})) as any;

import { MicrophoneCapture } from '../microphone-capture';

describe('MicrophoneCapture', () => {
  let capture: MicrophoneCapture;
  let mockAudioContext: any;
  let mockMediaStream: any;
  let mockScriptProcessor: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock ScriptProcessorNode
    mockScriptProcessor = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: null,
    };

    // Setup mock AudioContext
    mockAudioContext = {
      sampleRate: 16000,
      state: 'running',
      createScriptProcessor: jest.fn().mockReturnValue(mockScriptProcessor),
      createMediaStreamSource: jest.fn().mockReturnValue({
        connect: jest.fn(),
        disconnect: jest.fn(),
      }),
      close: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      suspend: jest.fn().mockResolvedValue(undefined),
    };

    // Setup mock MediaStream
    mockMediaStream = {
      getTracks: jest.fn().mockReturnValue([{
        stop: jest.fn(),
        enabled: true,
      }]),
      getAudioTracks: jest.fn().mockReturnValue([{
        stop: jest.fn(),
        enabled: true,
        getSettings: jest.fn().mockReturnValue({ sampleRate: 16000 }),
      }]),
    };

    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockMediaStream);

    capture = new MicrophoneCapture({
      audioContext: mockAudioContext,
    });
  });

  afterEach(() => {
    capture.destroy();
  });

  describe('Initialization', () => {
    it('should create capture with default options', () => {
      const defaultCapture = new MicrophoneCapture();
      expect(defaultCapture).toBeDefined();
      expect(defaultCapture.isInitialized()).toBe(false);
    });

    it('should create capture with custom options', () => {
      expect(capture).toBeDefined();
    });

    it('should initialize successfully', async () => {
      await capture.initialize();
      expect(capture.isInitialized()).toBe(true);
    });

    it('should handle multiple initialize calls', async () => {
      await capture.initialize();
      await capture.initialize();
      expect(capture.isInitialized()).toBe(true);
    });
  });

  describe('Capture Control', () => {
    it('should start capturing', async () => {
      await capture.initialize();
      await capture.start();

      expect(capture.isCapturing()).toBe(true);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should stop capturing', async () => {
      await capture.initialize();
      await capture.start();
      capture.stop();

      expect(capture.isCapturing()).toBe(false);
    });

    it('should throw error when starting without initialization', async () => {
      await expect(capture.start()).rejects.toThrow('Not initialized');
    });

    it('should handle getUserMedia failure', async () => {
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      await capture.initialize();
      await expect(capture.start()).rejects.toThrow('Permission denied');
    });
  });

  describe('Audio Data Callback', () => {
    it('should receive audio data when capturing', async () => {
      const onData = jest.fn();
      capture.onData(onData);

      await capture.initialize();
      await capture.start();

      // Simulate audio process event
      if (mockScriptProcessor.onaudioprocess) {
        const mockEvent = {
          inputBuffer: {
            getChannelData: jest.fn().mockReturnValue(new Float32Array(1024)),
          },
        };
        mockScriptProcessor.onaudioprocess(mockEvent);
      }

      expect(onData).toHaveBeenCalled();
    });

    it('should allow unregistering data callback', async () => {
      const onData = jest.fn();
      const unregister = capture.onData(onData);

      unregister();

      await capture.initialize();
      await capture.start();

      // Simulate audio process event
      if (mockScriptProcessor.onaudioprocess) {
        const mockEvent = {
          inputBuffer: {
            getChannelData: jest.fn().mockReturnValue(new Float32Array(1024)),
          },
        };
        mockScriptProcessor.onaudioprocess(mockEvent);
      }

      expect(onData).not.toHaveBeenCalled();
    });
  });

  describe('Pause/Resume', () => {
    it('should pause capturing', async () => {
      await capture.initialize();
      await capture.start();

      capture.pause();
      expect(capture.isPaused()).toBe(true);
    });

    it('should resume capturing', async () => {
      await capture.initialize();
      await capture.start();
      capture.pause();

      await capture.resume();
      expect(capture.isPaused()).toBe(false);
    });
  });

  describe('Volume Monitoring', () => {
    it('should get current volume level', async () => {
      await capture.initialize();
      await capture.start();

      const volume = capture.getVolume();
      expect(typeof volume).toBe('number');
      expect(volume).toBeGreaterThanOrEqual(0);
      expect(volume).toBeLessThanOrEqual(1);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      capture.setConfig({
        sampleRate: 48000,
        bufferSize: 2048,
      });

      const config = capture.getConfig();
      expect(config.sampleRate).toBe(48000);
      expect(config.bufferSize).toBe(2048);
    });
  });

  describe('Destroy', () => {
    it('should clean up resources on destroy', async () => {
      await capture.initialize();
      await capture.start();

      capture.destroy();

      expect(capture.isInitialized()).toBe(false);
      expect(capture.isCapturing()).toBe(false);
    });

    it('should handle destroy when not capturing', () => {
      expect(() => capture.destroy()).not.toThrow();
    });
  });
});
