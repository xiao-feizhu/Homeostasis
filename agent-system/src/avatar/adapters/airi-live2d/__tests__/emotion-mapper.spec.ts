/**
 * 表情映射器测试
 */

import { ExpressionType } from '../../../entities/avatar.entity';
import {
  EmotionMapper,
  createDefaultEmotionMapper,
  AiriEmotion,
} from '../emotion-mapper';

describe('EmotionMapper', () => {
  describe('Default Mappings', () => {
    it('should create default mapper with all expressions', () => {
      const mapper = createDefaultEmotionMapper();

      // 检查所有现有系统表情都被映射
      expect(mapper.supportsExpression(ExpressionType.NEUTRAL)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.HAPPY)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.SAD)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.ANGRY)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.SURPRISED)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.CONFUSED)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.THINKING)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.CONCERNED)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.EXCITED)).toBe(true);
      expect(mapper.supportsExpression(ExpressionType.WORRIED)).toBe(true);
    });

    it('should map basic emotions to correct Airi motion names', () => {
      const mapper = createDefaultEmotionMapper();

      expect(mapper.mapToAiriMotion(ExpressionType.NEUTRAL)).toBe('Idle');
      expect(mapper.mapToAiriMotion(ExpressionType.HAPPY)).toBe('Happy');
      expect(mapper.mapToAiriMotion(ExpressionType.SAD)).toBe('Sad');
      expect(mapper.mapToAiriMotion(ExpressionType.ANGRY)).toBe('Angry');
      expect(mapper.mapToAiriMotion(ExpressionType.SURPRISED)).toBe('Surprise');
    });

    it('should map complex emotions correctly', () => {
      const mapper = createDefaultEmotionMapper();

      // CONFUSED 和 THINKING 都映射到 'Think'
      expect(mapper.mapToAiriMotion(ExpressionType.CONFUSED)).toBe('Think');
      expect(mapper.mapToAiriMotion(ExpressionType.THINKING)).toBe('Think');

      // CONCERNED 映射到 'Awkward'
      expect(mapper.mapToAiriMotion(ExpressionType.CONCERNED)).toBe('Awkward');

      // EXCITED 映射到 'Happy'（与 HAPPY 相同）
      expect(mapper.mapToAiriMotion(ExpressionType.EXCITED)).toBe('Happy');

      // WORRIED 映射到 'Sad'（与 SAD 相同）
      expect(mapper.mapToAiriMotion(ExpressionType.WORRIED)).toBe('Sad');
    });

    it('should return Idle for unsupported expressions', () => {
      // 创建一个不支持的表情（通过空映射）
      const emptyMapper = new EmotionMapper([]);
      expect(emptyMapper.mapToAiriMotion(ExpressionType.HAPPY)).toBe('Idle');
    });
  });

  describe('Custom Mappings', () => {
    it('should use custom mappings when provided', () => {
      const customMappings = [
        { sourceExpression: ExpressionType.HAPPY, airiMotionName: 'Joy' },
        { sourceExpression: ExpressionType.SAD, airiMotionName: 'Cry' },
      ];
      const mapper = new EmotionMapper(customMappings);

      expect(mapper.mapToAiriMotion(ExpressionType.HAPPY)).toBe('Joy');
      expect(mapper.mapToAiriMotion(ExpressionType.SAD)).toBe('Cry');
    });

    it('should update mapping correctly', () => {
      const mapper = createDefaultEmotionMapper();

      mapper.updateMapping(ExpressionType.HAPPY, 'Joy', 'happy_face');

      expect(mapper.mapToAiriMotion(ExpressionType.HAPPY)).toBe('Joy');
      expect(mapper.mapToAiriExpression(ExpressionType.HAPPY)).toBe('happy_face');
    });
  });

  describe('getAllMappings', () => {
    it('should return all mappings', () => {
      const mapper = createDefaultEmotionMapper();
      const mappings = mapper.getAllMappings();

      expect(mappings).toHaveLength(10);
      expect(mappings.map(m => m.sourceExpression)).toContain(ExpressionType.HAPPY);
      expect(mappings.map(m => m.sourceExpression)).toContain(ExpressionType.SAD);
    });
  });

  describe('AiriEmotion Enum', () => {
    it('should have correct Airi emotion values', () => {
      expect(AiriEmotion.Happy).toBe('happy');
      expect(AiriEmotion.Sad).toBe('sad');
      expect(AiriEmotion.Angry).toBe('angry');
      expect(AiriEmotion.Surprise).toBe('surprised');
      expect(AiriEmotion.Neutral).toBe('neutral');
    });
  });
});
