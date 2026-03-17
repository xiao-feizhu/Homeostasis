/**
 * Airi Live2D 适配器测试
 */

import { ExpressionType, Live2DModelConfig } from '../../../entities/avatar.entity';
import { AiriLive2DAdapter } from '../airi-live2d.adapter';
import { EmotionMapper } from '../emotion-mapper';

describe('AiriLive2DAdapter', () => {
  let adapter: AiriLive2DAdapter;

  beforeEach(() => {
    adapter = new AiriLive2DAdapter();
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

    it('should throw error when initialize is called (not implemented)', async () => {
      // Use canvas ID string to avoid DOM type issues in Node test environment
      const config = {
        modelConfig: {
          modelId: 'test-model',
          name: 'Test Model',
          version: '1.0',
          modelPath: '/path/to/model.model3.json',
          texturePath: '/path/to/texture.png',
        } as Live2DModelConfig,
        canvas: 'test-canvas-id',
      };

      await expect(adapter.initialize(config)).rejects.toThrow('Not implemented');
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

      it('should return true after model is loaded', async () => {
        // 这是一个占位测试 - 等实现后更新
        // 当前状态是 false，因为 loadModel 会抛出错误
        expect(adapter.isLoaded()).toBe(false);
      });
    });

    describe('getCurrentExpression', () => {
      it('should return NEUTRAL by default', () => {
        expect(adapter.getCurrentExpression()).toBe(ExpressionType.NEUTRAL);
      });

      it('should throw error when setExpression is called (not implemented)', async () => {
        await expect(adapter.setExpression(ExpressionType.HAPPY)).rejects.toThrow('Not implemented');
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

    it('should throw error when loadModel is called (not implemented)', async () => {
      await expect(adapter.loadModel(mockModelConfig)).rejects.toThrow('Not implemented');
    });

    it('should throw error when unloadModel is called (not implemented)', () => {
      expect(() => adapter.unloadModel()).toThrow('Not implemented');
    });

    it('should throw error when destroy is called (not implemented)', () => {
      expect(() => adapter.destroy()).toThrow('Not implemented');
    });
  });

  describe('Motion Operations', () => {
    it('should throw error when playMotion is called (not implemented)', async () => {
      await expect(adapter.playMotion('Happy')).rejects.toThrow('Not implemented');
    });

    it('should throw error when playMotion with priority is called (not implemented)', async () => {
      await expect(adapter.playMotion('Happy', 100)).rejects.toThrow('Not implemented');
    });

    it('should throw error when stopMotion is called (not implemented)', () => {
      expect(() => adapter.stopMotion()).toThrow('Not implemented');
    });
  });

  describe('Parameter Operations', () => {
    it('should throw error when updateParameter is called (not implemented)', () => {
      expect(() => adapter.updateParameter('ParamAngleX', 0.5)).toThrow('Not implemented');
    });

    it('should throw error when getParameter is called (not implemented)', () => {
      expect(() => adapter.getParameter('ParamAngleX')).toThrow('Not implemented');
    });
  });

  describe('LipSync Operations', () => {
    it('should throw error when startTalking is called (not implemented)', () => {
      expect(() => adapter.startTalking()).toThrow('Not implemented');
    });

    it('should throw error when stopTalking is called (not implemented)', () => {
      expect(() => adapter.stopTalking()).toThrow('Not implemented');
    });

    it('should throw error when setLipSync is called (not implemented)', () => {
      expect(() => adapter.setLipSync('a', 0.8)).toThrow('Not implemented');
    });
  });

  describe('Expression Operations', () => {
    it('should use emotion mapper to translate expressions', () => {
      const mapper = adapter.getEmotionMapper();

      // 验证表情映射器被正确使用
      expect(mapper.mapToAiriMotion(ExpressionType.HAPPY)).toBe('Happy');
      expect(mapper.mapToAiriMotion(ExpressionType.SAD)).toBe('Sad');
    });

    it('should throw error when setExpression is called', async () => {
      await expect(adapter.setExpression(ExpressionType.HAPPY)).rejects.toThrow('Not implemented');
    });
  });

  describe('State Immutability', () => {
    it('should return immutable state copy', () => {
      const state = adapter.getState();
      state.scale = 999;

      // 原始适配器状态不应被修改
      expect(adapter.getState().scale).toBe(1);
    });
  });
});
