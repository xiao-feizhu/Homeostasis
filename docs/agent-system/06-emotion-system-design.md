# 增强型 Agent 系统 - 情感反馈系统设计文档

**版本**: v1.0
**日期**: 2026-03-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 设计目标

情感反馈系统旨在通过实时检测和分析用户情感状态，动态调整 AI 交互策略，从而：

1. **提升用户体验**: 根据情感状态调整语气和内容
2. **预防用户流失**: 及时发现挫败感并进行干预
3. **增强信任度**: 建立情感连接，提升用户满意度
4. **优化服务策略**: 基于情感数据分析改进产品

### 1.2 核心能力

| 能力 | 说明 |
|------|------|
| **多模态情感检测** | 支持文本、语音、图像等多模态输入 |
| **实时情感分析** | 毫秒级情感指标计算 |
| **情感趋势追踪** | 长期情感画像构建 |
| **动态策略调整** | 基于情感状态实时调整交互策略 |
| **预警与升级** | 情感异常自动预警和人工升级 |

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           情感反馈系统架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      输入层 (Input Layer)                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐  │   │
│  │  │   文本    │  │   语音    │  │   图像    │  │      行为信号        │  │   │
│  │  │  输入    │  │  输入    │  │  输入    │  │  (点击/停留/滚动)    │  │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┬──────────┘  │   │
│  │       │             │             │                   │             │   │
│  └───────┼─────────────┼─────────────┼───────────────────┼─────────────┘   │
│          │             │             │                   │                 │
│          ▼             ▼             ▼                   ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   分析层 (Analysis Layer)                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   文本情感    │  │   语音情感    │  │       多模态融合          │  │   │
│  │  │   分析器     │  │   分析器     │  │                          │  │   │
│  │  │              │  │              │  │  • 特征对齐               │  │   │
│  │  │ • 情感极性   │  │ • 语调分析   │  │  • 权重融合               │  │   │
│  │  │ • 情绪分类   │  │ • 语速检测   │  │  • 置信度计算             │  │   │
│  │  │ • 强度评估   │  │ • 停顿模式   │  │  • 冲突消解               │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │   │
│  │         │                 │                       │                │   │
│  └─────────┼─────────────────┼───────────────────────┼────────────────┘   │
│            │                 │                       │                    │
│            └─────────────────┼───────────────────────┘                    │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                   决策层 (Decision Layer)                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │   情感状态    │  │   策略选择    │  │       行动建议            │  │ │
│  │  │   评估器     │  │   引擎       │  │                          │  │ │
│  │  │              │  │              │  │  • 语气调整建议           │  │ │
│  │  │ • 短期状态   │  │ • 规则匹配   │  │  • 内容修改建议           │  │ │
│  │  │ • 长期趋势   │  │ • 模型预测   │  │  • 升级建议               │  │ │
│  │  │ • 异常检测   │  │ • 策略生成   │  │  • 补偿措施               │  │ │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │ │
│  │         │                 │                       │                │ │
│  └─────────┼─────────────────┼───────────────────────┼────────────────┘ │
│            │                 │                       │                  │
│            └─────────────────┼───────────────────────┘                  │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                   输出层 (Output Layer)                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │   情感指标    │  │   交互策略    │  │       预警通知            │  │ │
│  │  │   输出       │  │   输出       │  │                          │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           存储层 (Storage)                                  │
│  MongoDB (情感画像) │ Redis (实时状态) │ ClickHouse (历史分析)              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 | 输入 | 输出 |
|------|------|------|------|
| TextAnalyzer | 文本情感分析 | 文本 | 情感指标 |
| VoiceAnalyzer | 语音情感分析 | 音频 | 情感指标 |
| MultimodalFusion | 多模态融合 | 多维度指标 | 综合情感 |
| EmotionEvaluator | 情感状态评估 | 综合情感 | 状态分类 |
| StrategyEngine | 策略选择 | 情感状态 | 交互策略 |
| ActionRecommender | 行动建议 | 策略+上下文 | 具体行动 |

---

## 3. 情感指标模型

### 3.1 情感维度

```typescript
// 核心情感指标
interface EmotionMetrics {
  // 满意度 (0-100)
  // 高 = 用户满意，低 = 用户不满
  satisfaction: number;

  // 信任度 (0-100)
  // 高 = 用户信任AI，低 = 用户怀疑
  trust: number;

  // 挫败感 (0-100)
  // 高 = 用户感到沮丧，低 = 用户轻松
  frustration: number;

  // 紧急度 (0-100)
  // 高 = 用户急需解决，低 = 用户耐心
  urgency: number;

  // 参与度 (0-100)
  // 高 = 用户积极参与，低 = 用户被动/分心
  engagement: number;

  // 困惑度 (0-100)
  // 高 = 用户感到困惑，低 = 用户理解清晰
  confusion: number;
}

// 细粒度情绪标签
enum EmotionLabel {
  HAPPY = 'happy',
  SATISFIED = 'satisfied',
  NEUTRAL = 'neutral',
  CONFUSED = 'confused',
  FRUSTRATED = 'frustrated',
  ANGRY = 'angry',
  ANXIOUS = 'anxious',
  EXCITED = 'excited',
  BORED = 'bored',
  SURPRISED = 'surprised'
}

// 情感状态
enum EmotionState {
  POSITIVE = 'positive',       // 积极状态
  NEUTRAL = 'neutral',         // 中性状态
  NEGATIVE = 'negative',       // 负面状态
  CRITICAL = 'critical',       // 危机状态（需立即干预）
  ESCALATION = 'escalation'    // 需升级处理
}
```

### 3.2 情感状态评估

```typescript
interface EmotionStateAssessment {
  // 当前状态
  currentState: EmotionState;

  // 综合得分 (-100 到 +100)
  // 负值表示负面情绪，正值表示正面
  compositeScore: number;

  // 主导情绪
  dominantEmotion: EmotionLabel;

  // 情绪强度 (0-1)
  intensity: number;

  // 置信度 (0-1)
  confidence: number;

  // 趋势
  trend: 'improving' | 'stable' | 'declining';

  // 风险评估
  riskLevel: 'none' | 'low' | 'medium' | 'high';

  // 触发因素分析
  triggers: EmotionTrigger[];
}

interface EmotionTrigger {
  type: 'response_delay' | 'incorrect_answer' | 'repetition' | 'complexity' | 'external';
  description: string;
  impact: number;  // 影响程度
  timestamp: Date;
}
```

---

## 4. 分析引擎实现

### 4.1 文本情感分析

```typescript
@Injectable()
export class TextEmotionAnalyzer {
  constructor(
    private llmService: LLMService,
    private emotionClassifier: EmotionClassifier
  ) {}

  async analyze(
    text: string,
    context?: MessageContext[]
  ): Promise<TextEmotionAnalysis> {
    // 1. 基于 LLM 的情感分析
    const llmResult = await this.llmBasedAnalysis(text, context);

    // 2. 基于规则的情感分析
    const ruleResult = this.ruleBasedAnalysis(text);

    // 3. 融合结果
    const fusedResult = this.fuseResults(llmResult, ruleResult);

    // 4. 检测触发因素
    const triggers = this.detectTriggers(text, context);

    return {
      metrics: fusedResult.metrics,
      label: fusedResult.label,
      confidence: fusedResult.confidence,
      triggers,
      keyPhrases: this.extractKeyPhrases(text),
      sentiment: fusedResult.sentiment  // 整体情感倾向
    };
  }

  private async llmBasedAnalysis(
    text: string,
    context?: MessageContext[]
  ): Promise<LLMEmotionResult> {
    const prompt = `分析以下用户输入的情感状态。输出 JSON 格式：
{
  "satisfaction": 0-100,
  "trust": 0-100,
  "frustration": 0-100,
  "urgency": 0-100,
  "engagement": 0-100,
  "confusion": 0-100,
  "label": "情绪标签",
  "explanation": "分析说明"
}

用户输入: "${text}"
${context ? `上下文: ${JSON.stringify(context)}` : ''}`;

    const response = await this.llmService.generate({
      model: 'deepseek-v3',
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' }
    });

    return JSON.parse(response.content);
  }

  private ruleBasedAnalysis(text: string): RuleEmotionResult {
    const metrics: Partial<EmotionMetrics> = {};
    const indicators: EmotionIndicator[] = [];

    // 满意度指标
    const satisfactionWords = ['好', '棒', '满意', '谢谢', '赞'];
    const dissatisfactionWords = ['差', '糟', '失望', '不满', '烂'];

    for (const word of satisfactionWords) {
      if (text.includes(word)) {
        indicators.push({ type: 'satisfaction', word, polarity: 'positive' });
      }
    }

    for (const word of dissatisfactionWords) {
      if (text.includes(word)) {
        indicators.push({ type: 'satisfaction', word, polarity: 'negative' });
      }
    }

    // 挫败感指标
    const frustrationPatterns = [
      /怎么还是.*/, /又错了/, /不行/, /搞不定/, /为什么.*不/,
      /重复.*遍/, /说了.*遍/
    ];

    for (const pattern of frustrationPatterns) {
      if (pattern.test(text)) {
        indicators.push({ type: 'frustration', pattern: pattern.source });
      }
    }

    // 紧急度指标
    const urgencyPatterns = [
      /急/, /马上/, /立刻/, /现在/, /快点/, /尽快/,
      /来不及/, / deadline/, /截止/
    ];

    // 计算各维度得分
    metrics.satisfaction = this.calculateScore(indicators, 'satisfaction');
    metrics.frustration = this.calculateScore(indicators, 'frustration');
    metrics.urgency = this.calculateScore(indicators, 'urgency');

    return { metrics, indicators };
  }

  private detectTriggers(
    text: string,
    context?: MessageContext[]
  ): EmotionTrigger[] {
    const triggers: EmotionTrigger[] = [];

    // 检测重复
    if (context && context.length >= 2) {
      const lastMessages = context.slice(-2);
      if (this.isRepetition(lastMessages[0].content, lastMessages[1].content)) {
        triggers.push({
          type: 'repetition',
          description: '用户重复提问',
          impact: 0.7,
          timestamp: new Date()
        });
      }
    }

    // 检测否定词
    const negationWords = ['不', '没', '无', '错误', '不对'];
    const negationCount = negationWords.filter(w => text.includes(w)).length;
    if (negationCount >= 2) {
      triggers.push({
        type: 'incorrect_answer',
        description: '多次否定，可能对回答不满意',
        impact: 0.6,
        timestamp: new Date()
      });
    }

    return triggers;
  }
}
```

### 4.2 语音情感分析

```typescript
@Injectable()
export class VoiceEmotionAnalyzer {
  constructor(
    private asrService: ASRService,
    private audioFeatureExtractor: AudioFeatureExtractor
  ) {}

  async analyze(audioBuffer: Buffer): Promise<VoiceEmotionAnalysis> {
    // 1. 提取声学特征
    const features = await this.audioFeatureExtractor.extract(audioBuffer);

    // 2. 分析语音特征
    const analysis = {
      pitch: this.analyzePitch(features.pitch),
      energy: this.analyzeEnergy(features.energy),
      tempo: this.analyzeTempo(features.tempo),
      voiceQuality: this.analyzeVoiceQuality(features)
    };

    // 3. 映射到情感指标
    return this.mapToEmotionMetrics(analysis);
  }

  private analyzePitch(pitchData: number[]): PitchAnalysis {
    const mean = this.calculateMean(pitchData);
    const variance = this.calculateVariance(pitchData);
    const range = Math.max(...pitchData) - Math.min(...pitchData);

    // 高音调通常表示兴奋或紧张
    // 低音调通常表示平静或沮丧
    return {
      mean,
      variance,
      range,
      stability: 1 - variance / mean,
      interpretation: mean > 200 ? 'high_arousal' : 'low_arousal'
    };
  }

  private analyzeTempo(tempoData: number[]): TempoAnalysis {
    const speechRate = this.calculateSpeechRate(tempoData);
    const pauses = this.detectPauses(tempoData);

    // 语速快通常表示紧急或兴奋
    // 语速慢通常表示犹豫或沮丧
    // 停顿多可能表示思考或困惑
    return {
      speechRate,
      pauseCount: pauses.length,
      avgPauseDuration: this.calculateMean(pauses.map(p => p.duration)),
      interpretation: speechRate > 150 ? 'fast' : speechRate < 100 ? 'slow' : 'normal'
    };
  }

  private mapToEmotionMetrics(analysis: VoiceAnalysis): EmotionMetrics {
    return {
      satisfaction: this.inferFromFeatures(analysis, 'satisfaction'),
      trust: this.inferFromFeatures(analysis, 'trust'),
      frustration: this.inferFromFeatures(analysis, 'frustration'),
      urgency: analysis.tempo.speechRate > 150 ? 70 : 30,
      engagement: analysis.pitch.stability < 0.5 ? 60 : 40,
      confusion: analysis.tempo.pauseCount > 5 ? 60 : 20
    };
  }
}
```

### 4.3 多模态融合

```typescript
@Injectable()
export class MultimodalEmotionFusion {
  // 权重配置（可动态调整）
  private weights = {
    text: 0.5,
    voice: 0.3,
    image: 0.1,
    behavior: 0.1
  };

  fuse(
    modalities: EmotionAnalysisResult[]
  ): FusedEmotionResult {
    // 1. 归一化各模态置信度
    const normalized = modalities.map(m => ({
      ...m,
      normalizedConfidence: this.normalizeConfidence(m.confidence)
    }));

    // 2. 加权融合
    const fusedMetrics: EmotionMetrics = {
      satisfaction: this.weightedAverage(normalized, 'satisfaction'),
      trust: this.weightedAverage(normalized, 'trust'),
      frustration: this.weightedAverage(normalized, 'frustration'),
      urgency: this.weightedAverage(normalized, 'urgency'),
      engagement: this.weightedAverage(normalized, 'engagement'),
      confusion: this.weightedAverage(normalized, 'confusion')
    };

    // 3. 置信度聚合
    const overallConfidence = this.aggregateConfidence(normalized);

    // 4. 冲突检测与消解
    const conflicts = this.detectConflicts(normalized);
    if (conflicts.length > 0) {
      return this.resolveConflicts(fusedMetrics, conflicts, normalized);
    }

    // 5. 确定主导情绪
    const dominantEmotion = this.determineDominantEmotion(fusedMetrics);

    return {
      metrics: fusedMetrics,
      confidence: overallConfidence,
      dominantEmotion,
      contributingModalities: normalized.map(m => m.modality)
    };
  }

  private weightedAverage(
    modalities: NormalizedResult[],
    metric: keyof EmotionMetrics
  ): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const m of modalities) {
      const weight = this.weights[m.modality] * m.normalizedConfidence;
      totalWeight += weight;
      weightedSum += m.metrics[metric] * weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 50;
  }

  private detectConflicts(
    modalities: NormalizedResult[]
  ): EmotionConflict[] {
    const conflicts: EmotionConflict[] = [];

    // 检测极端差异
    for (let i = 0; i < modalities.length; i++) {
      for (let j = i + 1; j < modalities.length; j++) {
        const m1 = modalities[i];
        const m2 = modalities[j];

        const diff = Math.abs(m1.metrics.satisfaction - m2.metrics.satisfaction);
        if (diff > 50) {
          conflicts.push({
            between: [m1.modality, m2.modality],
            metric: 'satisfaction',
            difference: diff
          });
        }
      }
    }

    return conflicts;
  }

  private resolveConflicts(
    fusedMetrics: EmotionMetrics,
    conflicts: EmotionConflict[],
    modalities: NormalizedResult[]
  ): FusedEmotionResult {
    // 优先使用置信度最高的模态
    const highestConfidence = modalities.reduce((max, m) =>
      m.normalizedConfidence > max.normalizedConfidence ? m : max
    );

    // 降低冲突模态的权重，重新融合
    const adjustedWeights = { ...this.weights };
    for (const conflict of conflicts) {
      for (const modality of conflict.between) {
        if (modality !== highestConfidence.modality) {
          adjustedWeights[modality] *= 0.5;
        }
      }
    }

    // 使用调整后的权重重新融合
    // ...

    return {
      metrics: fusedMetrics,
      confidence: highestConfidence.normalizedConfidence * 0.8,
      dominantEmotion: this.determineDominantEmotion(fusedMetrics),
      conflicts,
      resolutionStrategy: 'confidence_priority'
    };
  }
}
```

---

## 5. 策略引擎

### 5.1 交互策略

```typescript
interface InteractionStrategy {
  // 语气风格
  tone: 'professional' | 'friendly' | 'empathetic' | 'urgent' | 'casual';

  // 回应节奏
  pace: 'immediate' | 'normal' | 'considered' | 'delayed';

  // 详细程度
  detail: 'minimal' | 'brief' | 'moderate' | 'detailed' | 'comprehensive';

  // 主动程度
  proactivity: 'reactive' | 'suggestive' | 'proactive' | 'intrusive';

  // 确认频率
  confirmation: 'never' | 'critical_only' | 'frequently';

  // 升级建议
  escalation?: {
    shouldEscalate: boolean;
    reason?: string;
    suggestedAction?: string;
  };

  // 特殊处理
  specialHandling?: {
    type: string;
    instructions: string;
  }[];
}

// 策略规则
const EMOTION_STRATEGY_RULES: StrategyRule[] = [
  // 挫败感高
  {
    condition: (e: EmotionMetrics) => e.frustration > 70,
    strategy: {
      tone: 'empathetic',
      pace: 'immediate',
      detail: 'brief',
      proactivity: 'proactive',
      confirmation: 'frequently',
      specialHandling: [{
        type: 'acknowledge_frustration',
        instructions: '首先承认用户的不满，表达歉意'
      }]
    },
    priority: 10
  },

  // 紧急度高
  {
    condition: (e: EmotionMetrics) => e.urgency > 80,
    strategy: {
      tone: 'urgent',
      pace: 'immediate',
      detail: 'brief',
      proactivity: 'proactive',
      confirmation: 'critical_only'
    },
    priority: 9
  },

  // 信任度低
  {
    condition: (e: EmotionMetrics) => e.trust < 30,
    strategy: {
      tone: 'professional',
      pace: 'considered',
      detail: 'comprehensive',
      proactivity: 'suggestive',
      confirmation: 'frequently',
      specialHandling: [{
        type: 'build_credibility',
        instructions: '提供数据来源，解释推理过程'
      }]
    },
    priority: 8
  },

  // 困惑度高
  {
    condition: (e: EmotionMetrics) => e.confusion > 60,
    strategy: {
      tone: 'friendly',
      pace: 'normal',
      detail: 'detailed',
      proactivity: 'suggestive',
      confirmation: 'frequently',
      specialHandling: [{
        type: 'simplify',
        instructions: '使用更简单易懂的语言，分步骤解释'
      }]
    },
    priority: 7
  },

  // 满意度高
  {
    condition: (e: EmotionMetrics) => e.satisfaction > 80,
    strategy: {
      tone: 'friendly',
      pace: 'normal',
      detail: 'moderate',
      proactivity: 'suggestive'
    },
    priority: 1
  }
];
```

### 5.2 策略引擎实现

```typescript
@Injectable()
export class EmotionStrategyEngine {
  constructor(
    private emotionProfileService: EmotionProfileService,
    private actionRecommender: ActionRecommender
  ) {}

  async selectStrategy(
    emotionState: EmotionStateAssessment,
    userId: string,
    context: StrategyContext
  ): Promise<InteractionStrategy> {
    // 1. 获取用户长期偏好
    const userProfile = await this.emotionProfileService.getProfile(userId);

    // 2. 匹配规则
    const matchedRules = EMOTION_STRATEGY_RULES
      .filter(rule => rule.condition(emotionState.metrics))
      .sort((a, b) => b.priority - a.priority);

    // 3. 合并策略
    let strategy = this.mergeStrategies(matchedRules.map(r => r.strategy));

    // 4. 应用用户偏好覆盖
    strategy = this.applyUserPreferences(strategy, userProfile);

    // 5. 应用上下文覆盖
    strategy = this.applyContextOverride(strategy, context);

    // 6. 添加升级建议（如需要）
    if (emotionState.riskLevel === 'high') {
      strategy.escalation = {
        shouldEscalate: true,
        reason: `用户处于高风险情绪状态: ${emotionState.dominantEmotion}`,
        suggestedAction: '立即转人工客服'
      };
    }

    // 7. 生成行动建议
    strategy.actions = await this.actionRecommender.recommend(
      emotionState,
      strategy,
      context
    );

    return strategy;
  }

  private mergeStrategies(strategies: Partial<InteractionStrategy>[]): InteractionStrategy {
    // 按优先级合并策略
    const merged: InteractionStrategy = {
      tone: 'professional',
      pace: 'normal',
      detail: 'moderate',
      proactivity: 'reactive',
      confirmation: 'critical_only'
    };

    for (const strategy of strategies) {
      Object.assign(merged, strategy);
    }

    return merged;
  }
}
```

---

## 6. 数据模型

### 6.1 情感画像

```typescript
// Collection: emotion_profiles
@Schema({ collection: 'emotion_profiles' })
export class EmotionProfile {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  // 基线情感（长期平均）
  @Prop({
    type: {
      satisfaction: { type: Number, default: 50 },
      trust: { type: Number, default: 50 },
      frustration: { type: Number, default: 20 },
      urgency: { type: Number, default: 30 },
      engagement: { type: Number, default: 50 },
      confusion: { type: Number, default: 20 }
    }
  })
  baseline: EmotionMetrics;

  // 情感特征
  @Prop({
    type: {
      volatility: { type: Number, default: 0.3 },
      trend: { type: String, enum: ['improving', 'stable', 'declining'] },
      recoverySpeed: Number  // 从负面情绪恢复的速度
    }
  })
  characteristics: EmotionCharacteristics;

  // 交互偏好
  @Prop({
    type: {
      preferredTone: String,
      preferredDetail: String,
      preferredPace: String,
      sensitiveTopics: [String],
      effectiveStrategies: [String]  // 历史上有效的策略
    }
  })
  preferences: InteractionPreferences;

  // 历史记录（摘要）
  @Prop({
    type: [{
      date: Date,
      avgEmotion: EmotionMetrics,
      interactionCount: Number,
      escalationCount: Number,
      satisfactionTrend: String
    }]
  })
  history: DailyEmotionSummary[];

  // 统计
  @Prop({
    type: {
      totalInteractions: Number,
      positiveInteractions: Number,
      negativeInteractions: Number,
      escalations: Number,
      lastInteractionAt: Date
    }
  })
  stats: EmotionStats;
}
```

### 6.2 会话情感记录

```typescript
// Collection: emotion_sessions
@Schema({ collection: 'emotion_sessions' })
export class EmotionSession {
  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  userId: string;

  // 实时情感轨迹
  @Prop({
    type: [{
      timestamp: Date,
      metrics: EmotionMetrics,
      label: String,
      trigger: String,
      context: String  // 触发上下文
    }]
  })
  emotionTrajectory: EmotionPoint[];

  // 当前状态
  @Prop({
    type: {
      metrics: EmotionMetrics,
      state: String,
      strategy: String,
      escalationLevel: Number
    }
  })
  current: CurrentEmotionState;

  // 应用策略历史
  @Prop({
    type: [{
      timestamp: Date,
      strategy: String,
      emotionBefore: EmotionMetrics,
      emotionAfter: EmotionMetrics,
      effectiveness: Number  // 策略效果评分
    }]
  })
  strategyHistory: StrategyApplication[];

  @Prop()
  expiresAt: Date;  // TTL 24小时
}
```

---

## 7. 性能与优化

### 7.1 性能目标

| 指标 | 目标 |
|------|------|
| 文本分析延迟 | < 100ms |
| 语音分析延迟 | < 500ms |
| 融合分析延迟 | < 50ms |
| 策略选择延迟 | < 20ms |

### 7.2 优化策略

1. **缓存**: 常见情感表达结果缓存
2. **预计算**: 情感基线定期更新而非实时计算
3. **增量更新**: 会话内情感轨迹增量计算
4. **异步**: 非关键情感分析异步处理

---

## 8. 附录

### 8.1 API 接口

```typescript
// POST /api/v1/emotion/analyze
interface AnalyzeEmotionRequest {
  sessionId: string;
  userId: string;
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  behaviorSignals?: BehaviorSignal[];
}

interface AnalyzeEmotionResponse {
  metrics: EmotionMetrics;
  state: EmotionState;
  label: EmotionLabel;
  confidence: number;
  strategy: InteractionStrategy;
  shouldEscalate: boolean;
  triggers: EmotionTrigger[];
}

// GET /api/v1/emotion/profiles/{userId}
interface GetEmotionProfileResponse {
  userId: string;
  baseline: EmotionMetrics;
  characteristics: EmotionCharacteristics;
  preferences: InteractionPreferences;
  trends: EmotionTrend[];
}
```

### 8.2 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-10 | 初始版本 |
