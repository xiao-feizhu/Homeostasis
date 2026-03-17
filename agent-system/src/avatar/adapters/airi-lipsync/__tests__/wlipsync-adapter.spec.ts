/**
 * Wlipsync Adapter Tests
 * TDD: Write failing tests first
 */

// Mock browser APIs
global.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number;
global.cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as NodeJS.Timeout);

import { WlipsyncAdapter, createWLipSyncNode } from '../wlipsync-adapter';

// Mock wlipsync module
jest.mock('wlipsync', () => ({
  __esModule: true,
  createWLipSyncNode: jest.fn().mockResolvedValue({
    weights: [0.8, 0.1, 0.05, 0.03, 0.02, 0],
    volume: 0.8,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
  parseBinaryProfile: jest.fn().mockImplementation(() => ({
    targetSampleRate: 16000,
    sampleCount: 1024,
    melFilterBankChannels: 26,
    compareMethod: 0,
    mfccNum: 12,
    mfccDataCount: 256,
    useStandardization: true,
    mfccs: [],
  })),
}));

describe('WlipsyncAdapter', () => {
  let adapter: WlipsyncAdapter;
  let mockAudioContext: any;
  let mockProfile: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock AudioContext
    mockAudioContext = {
      sampleRate: 48000,
      state: 'running',
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Setup mock profile
    mockProfile = {
      targetSampleRate: 16000,
      sampleCount: 1024,
      melFilterBankChannels: 26,
      compareMethod: 0,
      mfccNum: 12,
      mfccDataCount: 256,
      useStandardization: true,
      mfccs: [],
    };

    adapter = new WlipsyncAdapter();
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('Initialization', () => {
    it('should create adapter with default options', () => {
      expect(adapter).toBeDefined();
      expect(adapter.isInitialized()).toBe(false);
    });

    it('should create adapter with custom sample rate', () => {
      const customAdapter = new WlipsyncAdapter({ sampleRate: 48000 });
      expect(customAdapter).toBeDefined();
    });

    it('should initialize successfully', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);
      await adapter.initialize(mockAudioContext, mockProfile); // Second call should not throw
      expect(adapter.isInitialized()).toBe(true);
      expect(createWLipSyncNode).toHaveBeenCalledTimes(1);
    });

    it('should throw error without AudioContext', async () => {
      await expect(adapter.initialize()).rejects.toThrow('AudioContext is required');
    });

    it('should throw error without profile', async () => {
      await expect(adapter.initialize(mockAudioContext)).rejects.toThrow('Profile is required');
    });
  });

  describe('Audio Analysis', () => {
    it('should analyze audio buffer and return results', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);

      const mockAudioBuffer = new ArrayBuffer(1024);
      const results = await adapter.analyze(mockAudioBuffer);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('phoneme');
      expect(results[0]).toHaveProperty('volume');
    });

    it('should throw error when analyzing before initialization', async () => {
      const mockAudioBuffer = new ArrayBuffer(1024);

      await expect(adapter.analyze(mockAudioBuffer)).rejects.toThrow('Adapter not initialized');
    });

    it('should handle empty audio buffer', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);

      const emptyBuffer = new ArrayBuffer(0);
      const results = await adapter.analyze(emptyBuffer);

      expect(results).toEqual([]);
    });
  });

  describe('Real-time Analysis', () => {
    it('should process audio chunk in real-time', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);

      const mockChunk = new Float32Array(512);
      for (let i = 0; i < mockChunk.length; i++) {
        mockChunk[i] = Math.sin(i * 0.1) * 0.5;
      }

      const result = await adapter.processChunk(mockChunk);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('phoneme');
      expect(result).toHaveProperty('volume');
    });

    it('should throw error when processing chunk before initialization', async () => {
      const mockChunk = new Float32Array(512);

      await expect(adapter.processChunk(mockChunk)).rejects.toThrow('Adapter not initialized');
    });
  });

  describe('Phoneme Mapping', () => {
    it('should map phonemes to lip sync vowels', () => {
      const testCases = [
        { input: 'A', expected: 'a' },
        { input: 'I', expected: 'i' },
        { input: 'U', expected: 'u' },
        { input: 'E', expected: 'e' },
        { input: 'O', expected: 'o' },
        { input: 'SIL', expected: 'sil' },
        { input: 'N', expected: 'a' }, // Default fallback
      ];

      for (const testCase of testCases) {
        const result = adapter.mapPhonemeToVowel(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle unknown phonemes gracefully', () => {
      const result = adapter.mapPhonemeToVowel('UNKNOWN');
      expect(result).toBe('sil');
    });
  });

  describe('Stream Processing', () => {
    it('should start and stop stream processing', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);

      const onResult = jest.fn();
      adapter.startStream(onResult);

      expect(adapter.isStreaming()).toBe(true);

      adapter.stopStream();
      expect(adapter.isStreaming()).toBe(false);
    });

    it('should throw when starting stream without initialization', () => {
      const onResult = jest.fn();

      expect(() => adapter.startStream(onResult)).toThrow('Adapter not initialized');
    });
  });

  describe('Configuration', () => {
    it('should update configuration', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);

      adapter.setConfig({
        sampleRate: 48000,
      });

      // Config update should not throw
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should get current configuration', () => {
      const config = adapter.getConfig();

      expect(config).toHaveProperty('sampleRate');
    });
  });

  describe('Current Phonemes', () => {
    it('should return SIL when not initialized', () => {
      const phonemes = adapter.getCurrentPhonemes();

      expect(phonemes).toHaveLength(1);
      expect(phonemes[0].phoneme).toBe('SIL');
    });

    it('should return phoneme with highest weight when initialized', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);

      const phonemes = adapter.getCurrentPhonemes();

      expect(phonemes).toHaveLength(1);
      expect(phonemes[0].phoneme).toBe('A'); // Highest weight in mock
      expect(phonemes[0].volume).toBe(0.8);
    });
  });

  describe('Destroy', () => {
    it('should clean up resources on destroy', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);
      adapter.destroy();

      expect(adapter.isInitialized()).toBe(false);
    });

    it('should handle destroy when not initialized', () => {
      expect(() => adapter.destroy()).not.toThrow();
    });

    it('should stop streaming on destroy', async () => {
      await adapter.initialize(mockAudioContext, mockProfile);
      adapter.startStream(jest.fn());

      adapter.destroy();

      expect(adapter.isStreaming()).toBe(false);
    });
  });
});
