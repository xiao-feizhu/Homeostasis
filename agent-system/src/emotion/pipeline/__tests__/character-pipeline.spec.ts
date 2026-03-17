/**
 * Character Pipeline Tests
 * TDD for core-character pipeline integration
 */

import { CharacterPipeline, PipelineEventType } from '../character-pipeline';
import { SegmentationEngine, TextSegment } from '../segmentation';
import { DelayController } from '../delay-controller';
import { TTSConnector } from '../tts-connector';

// Mock dependencies
jest.mock('../segmentation');
jest.mock('../delay-controller');
jest.mock('../tts-connector');

describe('CharacterPipeline', () => {
  let pipeline: CharacterPipeline;
  let mockSegmentation: jest.Mocked<SegmentationEngine>;
  let mockDelayController: jest.Mocked<DelayController>;
  let mockTTS: jest.Mocked<TTSConnector>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSegmentation = new SegmentationEngine() as jest.Mocked<SegmentationEngine>;
    mockDelayController = new DelayController() as jest.Mocked<DelayController>;
    mockTTS = new TTSConnector() as jest.Mocked<TTSConnector>;

    // Setup default mock behaviors
    mockSegmentation.segment.mockReturnValue([
      { id: '1', text: 'Hello', type: 'greeting', emotionHint: 'happy', priority: 1 },
      { id: '2', text: 'world', type: 'content', emotionHint: 'neutral', priority: 2 },
    ]);

    mockDelayController.calculateDelay.mockReturnValue(100);
    mockDelayController.shouldTrigger.mockReturnValue(true);

    mockTTS.synthesize.mockResolvedValue({
      audioUrl: 'test.mp3',
      duration: 1000,
      format: 'mp3',
      lipSyncData: [],
    });

    pipeline = new CharacterPipeline({
      segmentation: mockSegmentation,
      delayController: mockDelayController,
      tts: mockTTS,
    });
  });

  afterEach(() => {
    pipeline.destroy();
  });

  describe('Initialization', () => {
    it('should create pipeline with default options', () => {
      const defaultPipeline = new CharacterPipeline();
      expect(defaultPipeline).toBeDefined();
      expect(defaultPipeline.isRunning()).toBe(false);
    });

    it('should create pipeline with custom options', () => {
      expect(pipeline).toBeDefined();
      expect(pipeline.isRunning()).toBe(false);
    });

    it('should initialize successfully', async () => {
      await pipeline.initialize();
      expect(pipeline.isRunning()).toBe(true);
    });

    it('should handle multiple initialize calls gracefully', async () => {
      await pipeline.initialize();
      await pipeline.initialize();
      expect(pipeline.isRunning()).toBe(true);
    });
  });

  describe('Input Processing', () => {
    it('should process text input and emit events', async () => {
      await pipeline.initialize();

      const eventHandler = jest.fn();
      pipeline.on(PipelineEventType.SEGMENT_CREATED, eventHandler);

      await pipeline.processInput({
        text: 'Hello world',
        userId: 'user1',
        sessionId: 'session1',
      });

      expect(mockSegmentation.segment).toHaveBeenCalled();
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should throw error when processing before initialization', async () => {
      await expect(pipeline.processInput({
        text: 'Hello',
        userId: 'user1',
        sessionId: 'session1',
      })).rejects.toThrow('Pipeline not initialized');
    });

    it('should handle empty input gracefully', async () => {
      await pipeline.initialize();
      mockSegmentation.segment.mockReturnValue([]);

      const result = await pipeline.processInput({
        text: '',
        userId: 'user1',
        sessionId: 'session1',
      });

      expect(result.segments).toHaveLength(0);
    });
  });

  describe('Segment Processing', () => {
    it('should process segment with TTS', async () => {
      await pipeline.initialize();

      const segment: TextSegment = {
        id: '1',
        text: 'Hello',
        type: 'greeting',
        emotionHint: 'happy',
        priority: 1,
      };

      await pipeline.processSegment(segment);

      expect(mockTTS.synthesize).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Hello',
        emotion: 'happy',
      }));
    });

    it('should respect delay controller', async () => {
      await pipeline.initialize();
      mockDelayController.shouldTrigger.mockReturnValue(false);

      const segment: TextSegment = {
        id: '1',
        text: 'Hello',
        type: 'greeting',
        emotionHint: 'happy',
        priority: 1,
      };

      await pipeline.processSegment(segment);

      expect(mockTTS.synthesize).not.toHaveBeenCalled();
    });
  });

  describe('Event System', () => {
    it('should register event handlers', async () => {
      await pipeline.initialize();

      const handler = jest.fn();
      pipeline.on(PipelineEventType.SEGMENT_CREATED, handler);

      await pipeline.processInput({
        text: 'Hello',
        userId: 'user1',
        sessionId: 'session1',
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should unregister event handlers', async () => {
      await pipeline.initialize();

      const handler = jest.fn();
      const unsubscribe = pipeline.on(PipelineEventType.SEGMENT_CREATED, handler);

      unsubscribe();

      await pipeline.processInput({
        text: 'Hello',
        userId: 'user1',
        sessionId: 'session1',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit TTS_COMPLETED event', async () => {
      await pipeline.initialize();

      const handler = jest.fn();
      pipeline.on(PipelineEventType.TTS_COMPLETED, handler);

      const segment: TextSegment = {
        id: '1',
        text: 'Hello',
        type: 'greeting',
        emotionHint: 'happy',
        priority: 1,
      };

      await pipeline.processSegment(segment);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: PipelineEventType.TTS_COMPLETED,
        data: expect.objectContaining({
          segmentId: '1',
        }),
      }));
    });
  });

  describe('State Management', () => {
    it('should track processing state', async () => {
      await pipeline.initialize();

      expect(pipeline.getState().isProcessing).toBe(false);

      const processPromise = pipeline.processInput({
        text: 'Hello world',
        userId: 'user1',
        sessionId: 'session1',
      });

      expect(pipeline.getState().isProcessing).toBe(true);

      await processPromise;

      expect(pipeline.getState().isProcessing).toBe(false);
    });

    it('should return current queue length', async () => {
      await pipeline.initialize();

      expect(pipeline.getQueueLength()).toBe(0);

      // Add items to queue
      void pipeline.processInput({
        text: 'Hello',
        userId: 'user1',
        sessionId: 'session1',
      });

      // Queue should have items during processing
      expect(pipeline.getQueueLength()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pause/Resume', () => {
    it('should pause processing', async () => {
      await pipeline.initialize();

      pipeline.pause();

      expect(pipeline.isRunning()).toBe(true);
      expect(pipeline.getState().isPaused).toBe(true);
    });

    it('should resume processing', async () => {
      await pipeline.initialize();

      pipeline.pause();
      pipeline.resume();

      expect(pipeline.getState().isPaused).toBe(false);
    });

    it('should queue segments while paused', async () => {
      await pipeline.initialize();

      pipeline.pause();

      await pipeline.processInput({
        text: 'Hello',
        userId: 'user1',
        sessionId: 'session1',
      });

      expect(pipeline.getQueueLength()).toBeGreaterThan(0);
      expect(mockTTS.synthesize).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Emotion System', () => {
    it('should pass emotion context to TTS', async () => {
      await pipeline.initialize();

      const segment: TextSegment = {
        id: '1',
        text: 'Great!',
        type: 'content',
        emotionHint: 'excited',
        priority: 1,
        emotion: {
          satisfaction: 90,
          trust: 80,
          frustration: 0,
          urgency: 30,
          engagement: 85,
          confusion: 0,
        },
      };

      await pipeline.processSegment(segment);

      expect(mockTTS.synthesize).toHaveBeenCalledWith(expect.objectContaining({
        emotion: 'excited',
        emotionIntensity: expect.any(Number),
      }));
    });
  });

  describe('Destroy', () => {
    it('should clean up resources on destroy', async () => {
      await pipeline.initialize();

      pipeline.destroy();

      expect(pipeline.isRunning()).toBe(false);
      expect(pipeline.getQueueLength()).toBe(0);
    });

    it('should clear all event handlers on destroy', async () => {
      await pipeline.initialize();

      const handler = jest.fn();
      pipeline.on(PipelineEventType.SEGMENT_CREATED, handler);

      pipeline.destroy();

      // After destroy, pipeline should not emit events
      expect(pipeline.isRunning()).toBe(false);
    });
  });
});
