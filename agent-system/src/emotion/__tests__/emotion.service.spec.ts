/**
 * 情感分析服务测试
 * TDD: 先写测试，再实现
 */

import { EmotionAnalyzer } from '../services/emotion.analyzer';
import { EmotionHistoryService } from '../services/emotion.history.service';
import { EmotionMetrics, EmotionState, EmotionAnalysisConfig } from '../entities/emotion.entity';

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

describe('EmotionAnalyzer', () => {
  let analyzer: EmotionAnalyzer;
  let defaultConfig: EmotionAnalysisConfig;

  beforeEach(() => {
    defaultConfig = {
      enableRuleAnalysis: true,
      enableLLMAnalysis: false,
      hybridWeights: { rule: 1.0, llm: 0 },
      confidenceThreshold: 0.6,
      historyRetentionHours: 24,
    };
    analyzer = new EmotionAnalyzer(defaultConfig);
  });

  describe('analyzeText', () => {
    it('should analyze positive sentiment correctly', async () => {
      const result = await analyzer.analyzeText({
        text: '太好了！非常感谢你的帮助，我很满意！',
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result).toBeDefined();
      expect(result.metrics.satisfaction).toBeGreaterThan(60);
      expect(result.metrics.trust).toBeGreaterThan(40);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should analyze negative sentiment correctly', async () => {
      const result = await analyzer.analyzeText({
        text: '太糟糕了，完全听不懂你在说什么，很失望',
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result.metrics.satisfaction).toBeLessThan(60);
      expect(result.metrics.frustration).toBeGreaterThan(50);
      expect([EmotionState.NEGATIVE, EmotionState.CRITICAL]).toContain(result.dominantState);
    });

    it('should analyze confused sentiment correctly', async () => {
      const result = await analyzer.analyzeText({
        text: '我不太明白，能再解释一下吗？有点困惑',
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result.metrics.confusion).toBeGreaterThan(40);
      // 可能是 clarify 或 empathize，取决于整体情绪状态
      expect(['clarify', 'empathize']).toContain(result.suggestedResponse.type);
    });

    it('should analyze urgent sentiment correctly', async () => {
      const result = await analyzer.analyzeText({
        text: '非常紧急！请立即帮我处理这个问题！',
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result.metrics.urgency).toBeGreaterThan(70);
      expect(result.suggestedResponse.priority).toBe('high');
    });

    it('should handle empty text gracefully', async () => {
      const result = await analyzer.analyzeText({
        text: '',
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.confidence).toBeLessThanOrEqual(0.3);
    });

    it('should handle very long text', async () => {
      const longText = '这是一个很长的文本'.repeat(100);
      const result = await analyzer.analyzeText({
        text: longText,
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(result).toBeDefined();
      expect(result.sourceText.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('determineEmotionState', () => {
    it('should return CRITICAL for high frustration', () => {
      const metrics: EmotionMetrics = {
        satisfaction: 20,
        trust: 30,
        frustration: 80,
        urgency: 50,
        engagement: 40,
        confusion: 30,
      };

      const state = analyzer.determineEmotionState(metrics);
      expect(state).toBe(EmotionState.CRITICAL);
    });

    it('should return POSITIVE for high satisfaction', () => {
      const metrics: EmotionMetrics = {
        satisfaction: 80,
        trust: 75,
        frustration: 10,
        urgency: 20,
        engagement: 80,
        confusion: 5,
      };

      const state = analyzer.determineEmotionState(metrics);
      expect(state).toBe(EmotionState.POSITIVE);
    });

    it('should return NEGATIVE for low satisfaction', () => {
      const metrics: EmotionMetrics = {
        satisfaction: 25,
        trust: 40,
        frustration: 55,
        urgency: 30,
        engagement: 20,
        confusion: 30,
      };

      const state = analyzer.determineEmotionState(metrics);
      expect(state).toBe(EmotionState.NEGATIVE);
    });

    it('should return NEUTRAL for balanced metrics', () => {
      const metrics: EmotionMetrics = {
        satisfaction: 50,
        trust: 50,
        frustration: 20,
        urgency: 30,
        engagement: 50,
        confusion: 20,
      };

      const state = analyzer.determineEmotionState(metrics);
      expect(state).toBe(EmotionState.NEUTRAL);
    });
  });

  describe('generateResponseStrategy', () => {
    it('should suggest escalate for critical state', () => {
      const strategy = analyzer.generateResponseStrategy(
        EmotionState.CRITICAL,
        { satisfaction: 20, trust: 30, frustration: 80, urgency: 50, engagement: 40, confusion: 30 },
        85
      );

      expect(strategy.type).toBe('escalate');
      expect(strategy.priority).toBe('critical');
      expect(strategy.tone).toBe('urgent');
    });

    it('should suggest clarify for confused user', () => {
      const strategy = analyzer.generateResponseStrategy(
        EmotionState.NEUTRAL,
        { satisfaction: 50, trust: 50, frustration: 20, urgency: 30, engagement: 60, confusion: 70 },
        60
      );

      expect(strategy.type).toBe('clarify');
      expect(strategy.shouldAsk).toBe(true);
    });

    it('should suggest celebrate for positive state', () => {
      const strategy = analyzer.generateResponseStrategy(
        EmotionState.POSITIVE,
        { satisfaction: 80, trust: 70, frustration: 5, urgency: 20, engagement: 75, confusion: 5 },
        70
      );

      expect(strategy.type).toBe('celebrate');
      expect(strategy.tone).toBe('warm');
    });

    it('should handle negation keywords', async () => {
      // 测试否定修饰效果：对比"开心"和"不开心"
      const positiveResult = await analyzer.analyzeText({
        text: '开心',
        userId: 'user-1',
        sessionId: 'session-1',
      });

      const negatedResult = await analyzer.analyzeText({
        text: '不开心',
        userId: 'user-1',
        sessionId: 'session-2',
      });

      // 否定的情绪应该满意度更低
      expect(negatedResult.metrics.satisfaction).toBeLessThan(positiveResult.metrics.satisfaction);
    });

    it('should use default metrics when rule analysis is disabled', async () => {
      const config: EmotionAnalysisConfig = {
        enableRuleAnalysis: false,
        enableLLMAnalysis: false,
        hybridWeights: { rule: 0, llm: 0 },
        confidenceThreshold: 0.6,
        historyRetentionHours: 24,
      };
      const disabledAnalyzer = new EmotionAnalyzer(config);

      const result = await disabledAnalyzer.analyzeText({
        text: '这是一个非常开心的好消息！',
        userId: 'user-1',
        sessionId: 'session-1',
      });

      // 禁用规则分析时应该使用默认指标
      expect(result.metrics.satisfaction).toBe(50);
      expect(result.metrics.trust).toBe(50);
      expect(result.confidence).toBe(0.3);
      expect(result.analysisMethod).toBe('rule');
    });

    it('should generate clarify strategy for confused negative state', () => {
      const strategy = analyzer.generateResponseStrategy(
        EmotionState.NEGATIVE,
        { satisfaction: 40, trust: 45, frustration: 30, urgency: 20, engagement: 50, confusion: 60 },
        60
      );

      expect(strategy.type).toBe('clarify');
      expect(strategy.tone).toBe('gentle');
    });
  });
});

describe('EmotionHistoryService', () => {
  let historyService: EmotionHistoryService;

  beforeEach(() => {
    historyService = new EmotionHistoryService();
  });

  describe('recordSnapshot', () => {
    it('should create new history on first record', async () => {
      const metrics: EmotionMetrics = {
        satisfaction: 60,
        trust: 55,
        frustration: 10,
        urgency: 30,
        engagement: 70,
        confusion: 5,
      };

      const history = await historyService.recordSnapshot({
        sessionId: 'session-1',
        userId: 'user-1',
        metrics,
        state: EmotionState.POSITIVE,
        triggerText: '很高兴认识你',
      });

      expect(history).toBeDefined();
      expect(history.sessionId).toBe('session-1');
      expect(history.timeline).toHaveLength(1);
      expect(history.timeline[0].metrics.satisfaction).toBe(60);
    });

    it('should append to existing history', async () => {
      const metrics1: EmotionMetrics = {
        satisfaction: 60,
        trust: 55,
        frustration: 10,
        urgency: 30,
        engagement: 70,
        confusion: 5,
      };

      const metrics2: EmotionMetrics = {
        satisfaction: 70,
        trust: 65,
        frustration: 5,
        urgency: 20,
        engagement: 75,
        confusion: 0,
      };

      await historyService.recordSnapshot({
        sessionId: 'session-2',
        userId: 'user-1',
        metrics: metrics1,
        state: EmotionState.POSITIVE,
        triggerText: '你好',
      });

      const history = await historyService.recordSnapshot({
        sessionId: 'session-2',
        userId: 'user-1',
        metrics: metrics2,
        state: EmotionState.POSITIVE,
        triggerText: '谢谢',
      });

      expect(history.timeline).toHaveLength(2);
      expect(history.timeline[1].metrics.satisfaction).toBe(70);
    });
  });

  describe('getHistory', () => {
    it('should return history for existing session', async () => {
      const metrics: EmotionMetrics = {
        satisfaction: 50,
        trust: 50,
        frustration: 0,
        urgency: 30,
        engagement: 50,
        confusion: 0,
      };

      await historyService.recordSnapshot({
        sessionId: 'session-3',
        userId: 'user-1',
        metrics,
        state: EmotionState.NEUTRAL,
        triggerText: '测试',
      });

      const history = await historyService.getHistory('session-3');
      expect(history).toBeDefined();
      expect(history?.sessionId).toBe('session-3');
    });

    it('should return null for non-existent session', async () => {
      const history = await historyService.getHistory('non-existent');
      expect(history).toBeNull();
    });
  });

  describe('calculateTrend', () => {
    it('should detect improving trend', async () => {
      for (let i = 0; i < 5; i++) {
        await historyService.recordSnapshot({
          sessionId: 'session-improving',
          userId: 'user-1',
          metrics: {
            satisfaction: 40 + i * 10,
            trust: 40 + i * 10,
            frustration: 30 - i * 5,
            urgency: 30,
            engagement: 50 + i * 5,
            confusion: 20 - i * 3,
          },
          state: EmotionState.POSITIVE,
          triggerText: `消息 ${i}`,
        });
      }

      const trend = await historyService.calculateTrend('session-improving');
      expect(trend).toBe('improving');
    });

    it('should detect declining trend', async () => {
      for (let i = 0; i < 5; i++) {
        await historyService.recordSnapshot({
          sessionId: 'session-declining',
          userId: 'user-1',
          metrics: {
            satisfaction: 80 - i * 10,
            trust: 80 - i * 10,
            frustration: 10 + i * 10,
            urgency: 30,
            engagement: 70 - i * 10,
            confusion: 10 + i * 8,
          },
          state: EmotionState.NEGATIVE,
          triggerText: `消息 ${i}`,
        });
      }

      const trend = await historyService.calculateTrend('session-declining');
      expect(trend).toBe('declining');
    });
  });

  describe('getPeakEmotions', () => {
    it('should identify peak emotions correctly', async () => {
      const emotions = [
        { satisfaction: 90, frustration: 5, confusion: 5 },
        { satisfaction: 50, frustration: 50, confusion: 10 },
        { satisfaction: 20, frustration: 80, confusion: 20 },
      ];

      for (let i = 0; i < emotions.length; i++) {
        await historyService.recordSnapshot({
          sessionId: 'session-peaks',
          userId: 'user-1',
          metrics: {
            satisfaction: emotions[i].satisfaction,
            trust: 50,
            frustration: emotions[i].frustration,
            urgency: 30,
            engagement: 50,
            confusion: emotions[i].confusion,
          },
          state: i === 0 ? EmotionState.POSITIVE : EmotionState.NEGATIVE,
          triggerText: `消息 ${i}`,
        });
      }

      const peaks = await historyService.getPeakEmotions('session-peaks');
      expect(peaks.length).toBeGreaterThan(0);
    });
  });
});
