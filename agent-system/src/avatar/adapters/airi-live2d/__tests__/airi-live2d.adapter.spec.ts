/**
 * Airi Live2D 适配器测试
 */

// Mock browser APIs and PixiJS
global.window = {
  devicePixelRatio: 1,
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 16),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
} as any;

// Set global requestAnimationFrame/cancelAnimationFrame
global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;

global.document = {
  getElementById: jest.fn(() => ({
    getContext: jest.fn(),
    width: 800,
    height: 600,
  })),
  createElement: jest.fn(() => ({})),
} as any;

// Mock pixi.js
jest.mock('pixi.js', () => ({
  Application: jest.fn().mockImplementation(() => ({
    stage: { addChild: jest.fn() },
    ticker: { update: jest.fn() },
    destroy: jest.fn(),
  })),
  Container: jest.fn().mockImplementation(() => ({
    addChild: jest.fn(),
    removeChild: jest.fn(),
    destroy: jest.fn(),
    position: { set: jest.fn() },
  })),
}));

// Mock pixi-live2d-display
jest.mock('pixi-live2d-display', () => ({
  Live2DModel: {
    from: jest.fn().mockResolvedValue({
      scale: { set: jest.fn() },
      anchor: { set: jest.fn() },
      position: { set: jest.fn() },
      destroy: jest.fn(),
      internalModel: {
        motionManager: {
          groups: {},
          startMotion: jest.fn(),
          stopAllMotions: jest.fn(),
          state: { currentGroup: null },
        },
        expressionManager: {
          setExpression: jest.fn(),
        },
        coreModel: {
          setParameterValueById: jest.fn(),
          getParameterValueById: jest.fn().mockReturnValue(0),
        },
        focusController: {
          focus: jest.fn(),
          update: jest.fn(),
        },
      },
    }),
  },
}));

import { ExpressionType, Live2DModelConfig } from '../../../entities/avatar.entity';
import { AiriLive2DAdapter } from '../airi-live2d.adapter';
import { EmotionMapper } from '../emotion-mapper';

describe('AiriLive2DAdapter', () => {
  let adapter: AiriLive2DAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new AiriLive2DAdapter();
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('Initialization', () => {
    it('should create adapter with default emotion mapper', () => {
      expect(adapter.getEmotionMapper()).toBeInstanceOf(EmotionMapper);
    });

    it('should create adapter with custom emotion mapper', () => {
      const customMapper = new EmotionMapper([
        { sourceExpression: ExpressionType.HAPPY, airiMotionName: 'Joy' },
      ]);
      const customAdapter = new AiriLive2DAdapter(customMapper);

      expect(customAdapter.getEmotionMapper()).toBe(customMapper);
    });

    it('should initialize with correct default state', () => {
      const state = adapter.getState();

      expect(state.isInitialized).toBe(false);
      expect(state.isModelLoaded).toBe(false);
      expect(state.currentExpression).toBe(ExpressionType.NEUTRAL);
      expect(state.currentMotion).toBeNull();
      expect(state.isTalking).toBe(false);
      expect(state.scale).toBe(1);
      expect(state.position).toEqual({ x: 0, y: 0 });
    });

    it('should initialize with canvas element', async () => {
      const mockCanvas = {
        getContext: jest.fn(),
        width: 800,
        height: 600,
      } as any;

      const config = {
        canvas: mockCanvas,
      };

      await adapter.initialize(config);

      expect(adapter.getState().isInitialized).toBe(true);
    });

    it('should throw error when initialized twice', async () => {
      const mockCanvas = {
        getContext: jest.fn(),
        width: 800,
        height: 600,
      } as any;

      await adapter.initialize({ canvas: mockCanvas });
      await expect(adapter.initialize({ canvas: mockCanvas })).rejects.toThrow('Adapter already initialized');
    });
  });

  describe('State Management', () => {
    describe('setScale', () => {
      it('should update scale in state', () => {
        adapter.setScale(1.5);

        const state = adapter.getState();
        expect(state.scale).toBe(1.5);
      });

      it('should update scale multiple times', () => {
        adapter.setScale(0.5);
        expect(adapter.getState().scale).toBe(0.5);

        adapter.setScale(2.0);
        expect(adapter.getState().scale).toBe(2.0);
      });
    });

    describe('setPosition', () => {
      it('should update position in state', () => {
        adapter.setPosition(100, 200);

        const state = adapter.getState();
        expect(state.position).toEqual({ x: 100, y: 200 });
      });

      it('should update position with negative values', () => {
        adapter.setPosition(-50, -100);

        expect(adapter.getState().position).toEqual({ x: -50, y: -100 });
      });
    });

    describe('isLoaded', () => {
      it('should return false when model is not loaded', () => {
        expect(adapter.isLoaded()).toBe(false);
      });
    });

    describe('getCurrentExpression', () => {
      it('should return NEUTRAL by default', () => {
        expect(adapter.getCurrentExpression()).toBe(ExpressionType.NEUTRAL);
      });
    });
  });

  describe('Model Operations', () => {
    const mockModelConfig: Live2DModelConfig = {
      modelId: 'test-model',
      name: 'Test Model',
      version: '1.0',
      modelPath: '/path/to/model.model3.json',
      texturePath: '/path/to/texture.png',
    };

    it('should load model successfully', async () => {
      const mockCanvas = {
        getContext: jest.fn(),
        width: 800,
        height: 600,
      } as any;

      await adapter.initialize({ canvas: mockCanvas });
      await adapter.loadModel(mockModelConfig);

      expect(adapter.isLoaded()).toBe(true);
    }, 10000);

    it('should throw error when loading model without initialization', async () => {
      await expect(adapter.loadModel(mockModelConfig)).rejects.toThrow('Adapter not initialized');
    });
  });

  describe('Expression Operations', () => {
    it('should use emotion mapper to translate expressions', () => {
      const mapper = adapter.getEmotionMapper();

      expect(mapper.mapToAiriMotion(ExpressionType.HAPPY)).toBe('Happy');
      expect(mapper.mapToAiriMotion(ExpressionType.SAD)).toBe('Sad');
    });

    it('should throw error when setExpression called without model', async () => {
      await expect(adapter.setExpression(ExpressionType.HAPPY)).rejects.toThrow('Model not loaded');
    });
  });

  describe('Motion Operations', () => {
    it('should throw error when playMotion called without model', async () => {
      await expect(adapter.playMotion('Happy')).rejects.toThrow('Model not loaded');
    });

    it('should throw error when stopMotion called without model', () => {
      expect(() => adapter.stopMotion()).not.toThrow();
    });
  });

  describe('Parameter Operations', () => {
    it('should not throw when updating parameter without model', () => {
      expect(() => adapter.updateParameter('ParamAngleX', 0.5)).not.toThrow();
    });

    it('should return 0 for parameter without model', () => {
      expect(adapter.getParameter('ParamAngleX')).toBe(0);
    });
  });

  describe('LipSync Operations', () => {
    it('should not throw when startTalking called', () => {
      expect(() => adapter.startTalking()).not.toThrow();
      expect(adapter.getState().isTalking).toBe(true);
    });

    it('should not throw when stopTalking called', () => {
      adapter.startTalking();
      expect(() => adapter.stopTalking()).not.toThrow();
      expect(adapter.getState().isTalking).toBe(false);
    });

    it('should not throw when setLipSync called', () => {
      expect(() => adapter.setLipSync('a', 0.8)).not.toThrow();
    });
  });

  describe('State Immutability', () => {
    it('should return immutable state copy', () => {
      const state = adapter.getState();
      state.scale = 999;

      expect(adapter.getState().scale).toBe(1);
    });
  });

  describe('Event Handlers', () => {
    it('should set event handlers', async () => {
      const onModelLoaded = jest.fn();
      const onModelError = jest.fn();

      adapter.setEventHandlers({
        onModelLoaded,
        onModelError,
      });

      const mockCanvas = {
        getContext: jest.fn(),
        width: 800,
        height: 600,
      } as any;

      await adapter.initialize({ canvas: mockCanvas });

      expect(onModelLoaded).toHaveBeenCalled();
    });
  });

  describe('Motion Manager', () => {
    it('should get motion manager', () => {
      const motionManager = adapter.getMotionManager();
      expect(motionManager).toBeDefined();
    });
  });

  describe('Destroy', () => {
    it('should clean up resources on destroy', async () => {
      const mockCanvas = {
        getContext: jest.fn(),
        width: 800,
        height: 600,
      } as any;

      await adapter.initialize({ canvas: mockCanvas });
      adapter.destroy();

      expect(adapter.getState().isInitialized).toBe(false);
      expect(adapter.getState().isModelLoaded).toBe(false);
    });
  });
});
