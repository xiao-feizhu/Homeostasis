# 增强型 Agent 系统 - 数据模型设计文档

**版本**: v1.0
**日期**: 2026-03-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 设计原则

1. **Schema 版本化**：所有集合支持版本字段，支持平滑升级
2. **软删除**：使用 `isDeleted` + `deletedAt` 而非物理删除
3. **时间戳**：所有文档包含 `createdAt` 和 `updatedAt`
4. **分区策略**：按 `userId` 分片，支持多租户
5. **索引策略**：每个集合必须定义查询所需索引

### 1.2 数据库选型

| 数据类型 | 存储方案 | 理由 |
|----------|----------|------|
| 业务数据 | MongoDB | 灵活 Schema，适合工作流定义 |
| 缓存数据 | Redis | 高速读写，支持 TTL |
| 向量数据 | Milvus | 专业向量检索，高性能 |
| 全文检索 | Elasticsearch | 强大的搜索能力 |
| 文件存储 | MinIO | S3 兼容，私有化部署 |

---

## 2. 核心数据模型

### 2.1 工作流定义 (WorkflowDefinition)

```typescript
// Collection: workflow_definitions
@Schema({
  collection: 'workflow_definitions',
  timestamps: true,
  versionKey: 'schemaVersion'
})
export class WorkflowDefinition {
  @Prop({ required: true, unique: true, index: true })
  workflowId: string;  // WF-{timestamp}-{hash}

  @Prop({ required: true, index: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  version: string;  // SemVer: 1.0.0

  @Prop({ enum: ['draft', 'active', 'deprecated', 'archived'], default: 'draft' })
  status: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ type: [String], index: true })
  tags: string[];

  // 节点定义
  @Prop({
    type: [{
      nodeId: { type: String, required: true },
      name: String,
      description: String,
      type: { type: String, enum: ['automatic', 'manual', 'hitl', 'parallel', 'condition'] },

      // Agent 配置
      agentConfig: {
        agentId: String,
        agentType: String,
        modelConfig: {
          model: String,
          temperature: Number,
          maxTokens: Number
        }
      },

      // 依赖关系
      dependencies: [String],  // 前置节点ID列表

      // 输入输出定义
      inputMapping: Schema.Types.Mixed,  // 参数映射
      outputMapping: Schema.Types.Mixed,

      // 重试策略
      retryPolicy: {
        maxRetries: { type: Number, default: 3 },
        retryInterval: { type: Number, default: 1000 },
        backoffMultiplier: { type: Number, default: 2 },
        retryOn: [String]  // 错误类型
      },

      // 超时配置
      timeout: { type: Number, default: 30000 },  // ms

      // HITL 配置
      hitlConfig: {
        enabled: { type: Boolean, default: false },
        type: { type: String, enum: ['approval', 'review', 'input', 'escalation'] },
        condition: String,  // 触发条件表达式
        approvers: [String],  // 审批人ID列表
        timeout: Number,
        escalationRule: {
          enabled: Boolean,
          escalateTo: String,
          afterMinutes: Number
        }
      },

      // 错误处理
      errorHandling: {
        strategy: { type: String, enum: ['fail', 'retry', 'skip', 'rollback', 'continue'] },
        rollbackTarget: String,  // 回滚目标节点
        fallbackValue: Schema.Types.Mixed
      },

      // 执行条件
      condition: {
        expression: String,  // 条件表达式
        trueBranch: String,  // 真分支目标
        falseBranch: String  // 假分支目标
      }
    }],
    required: true
  })
  nodes: WorkflowNode[];

  // 变量定义
  @Prop({
    type: [{
      name: { type: String, required: true },
      type: { type: String, enum: ['string', 'number', 'boolean', 'array', 'object', 'date'] },
      required: { type: Boolean, default: false },
      defaultValue: Schema.Types.Mixed,
      description: String,
      validation: {
        pattern: String,  // 正则
        min: Number,
        max: Number,
        enum: [Schema.Types.Mixed]
      }
    }]
  })
  variables: WorkflowVariable[];

  // 触发器配置
  @Prop({
    type: {
      type: { type: String, enum: ['manual', 'scheduled', 'event', 'api'] },
      config: Schema.Types.Mixed,  // 根据类型变化
      enabled: { type: Boolean, default: true }
    }
  })
  trigger: WorkflowTrigger;

  // HITL 全局配置
  @Prop({
    type: {
      defaultApprovers: [String],
      escalationRules: [{
        level: Number,
        condition: String,
        notifyChannels: [String],
        escalateTo: String
      }]
    }
  })
  hitlGlobalConfig: HITLGlobalConfig;

  // 元数据
  @Prop({ type: Schema.Types.Mixed })
  metadata: Record<string, any>;

  // 统计信息
  @Prop({
    type: {
      totalExecutions: { type: Number, default: 0 },
      successfulExecutions: { type: Number, default: 0 },
      failedExecutions: { type: Number, default: 0 },
      avgExecutionTime: { type: Number, default: 0 }
    }
  })
  stats: WorkflowStats;

  // 软删除
  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;

  // Schema 版本
  @Prop({ default: 1 })
  schemaVersion: number;
}

// 索引
// db.workflow_definitions.createIndex({ workflowId: 1 }, { unique: true })
// db.workflow_definitions.createIndex({ ownerId: 1, status: 1 })
// db.workflow_definitions.createIndex({ tags: 1 })
// db.workflow_definitions.createIndex({ "nodes.nodeId": 1 })
```

### 2.2 工作流执行实例 (WorkflowExecution)

```typescript
// Collection: workflow_executions
@Schema({
  collection: 'workflow_executions',
  timestamps: true
})
export class WorkflowExecution {
  @Prop({ required: true, unique: true, index: true })
  executionId: string;  // WE-{timestamp}-{random}

  @Prop({ required: true, index: true })
  workflowId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({
    enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled', 'rolled_back'],
    default: 'pending',
    index: true
  })
  status: string;

  // 执行上下文（变量值）
  @Prop({ type: Schema.Types.Mixed })
  context: Record<string, any>;

  // 节点执行记录
  @Prop({
    type: [{
      nodeId: { type: String, required: true },
      nodeName: String,
      status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped', 'rolled_back'] },

      // 时间戳
      scheduledAt: Date,
      startedAt: Date,
      completedAt: Date,

      // 输入输出
      input: Schema.Types.Mixed,
      output: Schema.Types.Mixed,

      // 执行详情
      executionLog: [{
        timestamp: Date,
        level: { type: String, enum: ['debug', 'info', 'warn', 'error'] },
        message: String,
        metadata: Schema.Types.Mixed
      }],

      // 重试记录
      retryCount: { type: Number, default: 0 },
      retryHistory: [{
        attempt: Number,
        timestamp: Date,
        error: String
      }],

      // HITL 记录
      hitlBreakpointId: String,

      // 错误信息
      error: {
        code: String,
        message: String,
        stack: String,
        details: Schema.Types.Mixed
      }
    }]
  })
  nodeExecutions: NodeExecution[];

  // 当前节点
  @Prop()
  currentNodeId: string;

  // 执行路径（用于回滚）
  @Prop({ type: [String] })
  executionPath: string[];

  // 输入输出
  @Prop({ type: Schema.Types.Mixed })
  input: Record<string, any>;

  @Prop({ type: Schema.Types.Mixed })
  output: Record<string, any>;

  // 错误信息
  @Prop({
    type: {
      code: String,
      message: String,
      failedNodeId: String,
      failedAt: Date
    }
  })
  error: ExecutionError;

  // 性能指标
  @Prop({
    type: {
      scheduledAt: Date,
      startedAt: Date,
      completedAt: Date,
      totalDuration: Number,  // ms
      nodeDurations: Schema.Types.Mixed  // { nodeId: duration }
    }
  })
  timing: ExecutionTiming;

  // 关联的 HITL 断点
  @Prop({ type: [String] })
  breakpointIds: string[];

  // 父执行（子流程）
  @Prop()
  parentExecutionId: string;

  @Prop()
  parentNodeId: string;

  // 触发信息
  @Prop({
    type: {
      type: String,
      triggeredBy: String,
      triggerData: Schema.Types.Mixed
    }
  })
  triggerInfo: TriggerInfo;
}

// 索引
// db.workflow_executions.createIndex({ executionId: 1 }, { unique: true })
// db.workflow_executions.createIndex({ workflowId: 1, status: 1 })
// db.workflow_executions.createIndex({ userId: 1, createdAt: -1 })
// db.workflow_executions.createIndex({ status: 1, "timing.scheduledAt": 1 })
// TTL 索引：自动清理 90 天前的完成记录
// db.workflow_executions.createIndex({ "timing.completedAt": 1 }, { expireAfterSeconds: 7776000 })
```

### 2.3 Agent 定义 (AgentDefinition)

```typescript
// Collection: agent_definitions
@Schema({
  collection: 'agent_definitions',
  timestamps: true
})
export class AgentDefinition {
  @Prop({ required: true, unique: true, index: true })
  agentId: string;  // AG-{type}-{name}

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({
    enum: ['planner', 'executor', 'reviewer', 'coordinator', 'specialist'],
    required: true,
    index: true
  })
  type: string;

  // 能力声明
  @Prop({
    type: {
      inputs: [{
        name: String,
        type: String,
        description: String,
        required: Boolean
      }],
      outputs: [{
        name: String,
        type: String,
        description: String
      }],
      tools: [String],  // 可用工具列表
      supportedPlatforms: [String],  // 支持的平台
      maxConcurrency: { type: Number, default: 10 }
    }
  })
  capabilities: AgentCapabilities;

  // LLM 配置
  @Prop({
    type: {
      provider: { type: String, enum: ['openai', 'anthropic', 'aliyun', 'deepseek'] },
      model: String,
      temperature: { type: Number, default: 0.7 },
      maxTokens: { type: Number, default: 2000 },
      topP: { type: Number, default: 1 },
      frequencyPenalty: { type: Number, default: 0 },
      presencePenalty: { type: Number, default: 0 }
    }
  })
  llmConfig: LLMConfig;

  // 提示词配置
  @Prop({
    type: {
      systemPrompt: { type: String, required: true },
      promptTemplate: String,  // 使用 {{variable}} 语法
      fewShotExamples: [{
        input: Schema.Types.Mixed,
        output: Schema.Types.Mixed,
        explanation: String
      }],
      outputFormat: {
        type: { type: String, enum: ['json', 'text', 'markdown'] },
        schema: Schema.Types.Mixed  // JSON Schema
      }
    }
  })
  promptConfig: PromptConfig;

  // 执行配置
  @Prop({
    type: {
      timeout: { type: Number, default: 60000 },
      retryPolicy: {
        maxRetries: { type: Number, default: 3 },
        retryInterval: { type: Number, default: 1000 }
      },
      errorHandling: {
        strategy: { type: String, enum: ['fail', 'retry', 'fallback'] },
        fallbackAgentId: String
      },
      rateLimit: {
        requestsPerMinute: { type: Number, default: 60 },
        tokensPerMinute: { type: Number, default: 10000 }
      }
    }
  })
  executionConfig: ExecutionConfig;

  // 注册信息
  @Prop({
    type: {
      endpoint: String,  // 服务端点
      healthCheckUrl: String,
      authType: { type: String, enum: ['none', 'api_key', 'oauth', 'jwt'] },
      metadata: Schema.Types.Mixed
    }
  })
  registration: AgentRegistration;

  @Prop({ enum: ['active', 'inactive', 'deprecated'], default: 'active' })
  status: string;

  // 使用统计
  @Prop({
    type: {
      totalInvocations: { type: Number, default: 0 },
      successfulInvocations: { type: Number, default: 0 },
      failedInvocations: { type: Number, default: 0 },
      avgExecutionTime: { type: Number, default: 0 },
      avgTokenUsage: { type: Number, default: 0 },
      lastInvokedAt: Date
    }
  })
  stats: AgentStats;
}

// 索引
// db.agent_definitions.createIndex({ agentId: 1 }, { unique: true })
// db.agent_definitions.createIndex({ type: 1, status: 1 })
// db.agent_definitions.createIndex({ "capabilities.tools": 1 })
```

### 2.4 HITL 断点 (HITLBreakpoint)

```typescript
// Collection: hitl_breakpoints
@Schema({
  collection: 'hitl_breakpoints',
  timestamps: true
})
export class HITLBreakpoint {
  @Prop({ required: true, unique: true, index: true })
  breakpointId: string;  // BP-{timestamp}-{random}

  @Prop({ required: true, index: true })
  executionId: string;

  @Prop({ required: true })
  workflowId: string;

  @Prop({ required: true })
  nodeId: string;

  @Prop({
    enum: ['pending', 'in_review', 'approved', 'rejected', 'modified', 'timeout', 'cancelled', 'escalated'],
    default: 'pending',
    index: true
  })
  status: string;

  @Prop({
    enum: ['approval', 'review', 'input', 'escalation', 'error_resolution'],
    required: true
  })
  type: string;

  // 优先级
  @Prop({
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  })
  priority: string;

  // 上下文信息
  @Prop({
    type: {
      input: Schema.Types.Mixed,  // 节点输入
      output: Schema.Types.Mixed,  // 节点输出（如有）
      logs: [String],
      executionPath: [String],  // 执行路径
      preview: {  // 预览数据
        title: String,
        description: String,
        data: Schema.Types.Mixed,
        attachments: [{
          name: String,
          type: String,
          url: String
        }]
      }
    }
  })
  context: BreakpointContext;

  // 审批人配置
  @Prop({
    type: {
      requiredApprovals: { type: Number, default: 1 },
      approverIds: [String],
      approverRoles: [String],  // 按角色审批
      currentApprovers: [String]  // 当前待审批人
    }
  })
  approverConfig: ApproverConfig;

  // 审批记录
  @Prop({
    type: [{
      userId: { type: String, required: true },
      decision: { type: String, enum: ['approved', 'rejected', 'commented', 'delegated'] },
      comment: String,
      modifications: Schema.Types.Mixed,  // 修改的参数
      timestamp: { type: Date, default: Date.now },
      delegatedTo: String  // 转交给谁
    }]
  })
  approvals: ApprovalRecord[];

  // 超时配置
  @Prop()
  deadline: Date;

  @Prop({ default: 1440 })  // 默认24小时（分钟）
  timeoutMinutes: number;

  // 升级记录
  @Prop({
    type: {
      level: { type: Number, default: 0 },
      escalatedAt: Date,
      escalatedTo: String,
      reason: String,
      escalatedBy: String
    }
  })
  escalation: EscalationInfo;

  // 提醒记录
  @Prop({
    type: [{
      sentAt: Date,
      channel: String,
      recipients: [String],
      content: String
    }]
  })
  reminders: ReminderRecord[];

  // 发起信息
  @Prop()
  createdBy: string;  // 系统或用户ID

  @Prop()
  resolvedAt: Date;

  @Prop()
  resolvedBy: string;
}

// 索引
// db.hitl_breakpoints.createIndex({ breakpointId: 1 }, { unique: true })
// db.hitl_breakpoints.createIndex({ executionId: 1, status: 1 })
// db.hitl_breakpoints.createIndex({ status: 1, priority: 1, deadline: 1 })
// db.hitl_breakpoints.createIndex({ "approverConfig.currentApprovers": 1, status: 1 })
// TTL 索引
// db.hitl_breakpoints.createIndex({ resolvedAt: 1 }, { expireAfterSeconds: 2592000 })
```

### 2.5 用户情感画像 (EmotionProfile)

```typescript
// Collection: emotion_profiles
@Schema({
  collection: 'emotion_profiles',
  timestamps: true
})
export class EmotionProfile {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  // 基线情感指标（长期平均值）
  @Prop({
    type: {
      satisfaction: { type: Number, min: 0, max: 100, default: 50 },
      trust: { type: Number, min: 0, max: 100, default: 50 },
      frustration: { type: Number, min: 0, max: 100, default: 0 },
      urgency: { type: Number, min: 0, max: 100, default: 30 },
      engagement: { type: Number, min: 0, max: 100, default: 50 }
    }
  })
  baselineEmotion: EmotionMetrics;

  // 情感波动特征
  @Prop({
    type: {
      volatility: { type: Number, default: 0.3 },  // 波动率 0-1
      trend: { type: String, enum: ['improving', 'stable', 'declining'] },
      triggerSensitivity: Schema.Types.Mixed  // 各类触发器敏感度
    }
  })
  emotionCharacteristics: EmotionCharacteristics;

  // 交互偏好
  @Prop({
    type: {
      preferredTone: { type: String, enum: ['professional', 'friendly', 'empathetic', 'casual'] },
      preferredPace: { type: String, enum: ['slow', 'normal', 'fast'] },
      preferredDetail: { type: String, enum: ['brief', 'moderate', 'detailed'] },
      preferredProactivity: { type: String, enum: ['reactive', 'suggestive', 'proactive'] }
    }
  })
  interactionPreferences: InteractionPreferences;

  // 敏感话题
  @Prop({ type: [String] })
  sensitiveTopics: string[];

  // 情感历史（压缩存储，最近30天详细数据）
  @Prop({
    type: [{
      timestamp: Date,
      sessionId: String,
      emotion: EmotionMetrics,
      trigger: String,  // 触发因素
      context: String,  // 上下文摘要
      actionTaken: String,  // 系统采取的行动
      effectiveness: Number  // 行动效果评分
    }]
  })
  emotionHistory: EmotionHistoryRecord[];

  // 会话级情感（实时更新）
  @Prop({
    type: [{
      sessionId: String,
      startedAt: Date,
      currentEmotion: EmotionMetrics,
      strategy: String,
      escalationLevel: Number
    }]
  })
  activeSessions: ActiveSessionEmotion[];

  // 统计信息
  @Prop({
    type: {
      totalInteractions: Number,
      positiveInteractions: Number,
      negativeInteractions: Number,
      escalationsCount: Number,
      lastInteractionAt: Date
    }
  })
  stats: EmotionStats;
}

// 索引
// db.emotion_profiles.createIndex({ userId: 1 }, { unique: true })
```

### 2.6 记忆系统 (MemorySystem)

```typescript
// Collection: short_term_memories
@Schema({
  collection: 'short_term_memories',
  timestamps: true
})
export class ShortTermMemory {
  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  userId: string;

  // 上下文窗口
  @Prop({
    type: [{
      messageId: String,
      role: { type: String, enum: ['user', 'assistant', 'system'] },
      content: String,
      timestamp: Date,
      emotion: EmotionMetrics,
      intent: String,
      entities: [String]
    }]
  })
  contextWindow: ContextMessage[];

  @Prop({ default: 20 })
  maxWindowSize: number;

  // 会话摘要（增量更新）
  @Prop()
  sessionSummary: string;

  // 关键事实（会话中提取）
  @Prop({ type: [String] })
  extractedFacts: string[];

  // 当前话题
  @Prop()
  currentTopic: string;

  // 待澄清问题
  @Prop({ type: [String] })
  pendingClarifications: string[];

  @Prop()
  expiresAt: Date;  // TTL 24小时
}

// TTL 索引
// db.short_term_memories.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Collection: long_term_memories
@Schema({
  collection: 'long_term_memories',
  timestamps: true
})
export class LongTermMemory {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  // 用户画像
  @Prop({
    type: {
      preferences: Schema.Types.Mixed,  // 各类偏好
      behaviorPatterns: [String],  // 行为模式标签
      topicInterests: [String],
      communicationStyle: String,
      expertiseLevel: Schema.Types.Mixed,  // 各领域专业度
      goals: [{
        type: String,
        description: String,
        priority: Number,
        progress: Number
      }]
    }
  })
  userProfile: UserProfile;

  // 交互历史统计
  @Prop({
    type: {
      totalSessions: Number,
      totalMessages: Number,
      avgSessionDuration: Number,
      avgResponseTime: Number,
      preferredChannels: [String],
      activeHours: [Number],  // 活跃时段（小时）
      lastSessionAt: Date
    }
  })
  interactionStats: InteractionStats;

  // 关键事件
  @Prop({
    type: [{
      eventId: String,
      date: Date,
      type: String,  // milestone, preference_change, complaint, praise
      description: String,
      impact: Number,  // -10 到 +10
      relatedWorkflows: [String]
    }]
  })
  keyEvents: KeyEvent[];

  // 学习到的知识
  @Prop({
    type: [{
      fact: String,
      category: String,
      confidence: { type: Number, min: 0, max: 1 },
      source: String,
      learnedAt: Date,
      lastConfirmedAt: Date,
      confirmationCount: Number
    }]
  })
  learnedFacts: LearnedFact[];

  // 关联记忆ID（用于图谱）
  @Prop({ type: [String] })
  semanticMemoryIds: string[];
}

// Collection: semantic_memories (知识图谱)
@Schema({
  collection: 'semantic_memories',
  timestamps: true
})
export class SemanticMemory {
  @Prop({ required: true, unique: true, index: true })
  memoryId: string;

  @Prop({ required: true })
  concept: string;  // 概念/实体名称

  @Prop({ enum: ['entity', 'event', 'fact', 'relation'], required: true })
  type: string;

  // 向量嵌入（存储在 Milvus，这里是引用）
  @Prop()
  vectorId: string;

  // 属性
  @Prop({ type: Schema.Types.Mixed })
  attributes: Record<string, any>;

  // 关系
  @Prop({
    type: [{
      type: {
        type: String,
        enum: ['is_a', 'part_of', 'related_to', 'causes', 'used_for', 'located_in', 'created_by']
      },
      targetId: String,  // 目标记忆ID
      targetConcept: String,
      strength: { type: Number, min: 0, max: 1 },
      bidirectional: Boolean
    }]
  })
  relationships: SemanticRelationship[];

  // 来源
  @Prop({
    type: {
      sourceType: { type: String, enum: ['user_input', 'inferred', 'external'] },
      sourceId: String,
      confidence: Number
    }
  })
  source: MemorySource;

  @Prop({ type: [String], index: true })
  userIds: string[];  // 关联的用户（可选）

  // 访问统计
  @Prop({
    type: {
      accessCount: Number,
      lastAccessedAt: Date,
      importanceScore: Number  // 动态计算的重要性
    }
  })
  accessStats: AccessStats;
}

// 索引
// db.semantic_memories.createIndex({ concept: 1, type: 1 })
// db.semantic_memories.createIndex({ "relationships.targetId": 1 })
```

### 2.7 虚拟形象 (AvatarSystem)

```typescript
// Collection: avatars
@Schema({
  collection: 'avatars',
  timestamps: true
})
export class Avatar {
  @Prop({ required: true, unique: true, index: true })
  avatarId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: ['2d', '3d', 'photo_realistic'], required: true })
  type: string;

  // 外观配置
  @Prop({
    type: {
      modelUrl: String,
      thumbnailUrl: String,
      face: Schema.Types.Mixed,
      hair: Schema.Types.Mixed,
      clothing: Schema.Types.Mixed,
      accessories: Schema.Types.Mixed,
      background: Schema.Types.Mixed
    }
  })
  appearance: AvatarAppearance;

  // 语音配置
  @Prop({
    type: {
      ttsProvider: String,
      voiceId: String,
      pitch: { type: Number, default: 1.0 },
      speed: { type: Number, default: 1.0 },
      emotion: { type: String, default: 'neutral' },
      language: { type: String, default: 'zh-CN' }
    }
  })
  voice: VoiceConfig;

  // 动画库
  @Prop({
    type: [{
      name: String,
      type: { type: String, enum: ['idle', 'talking', 'gesture', 'emotion', 'custom'] },
      trigger: String,  // 触发条件
      animationUrl: String,
      duration: Number,
      loop: Boolean
    }]
  })
  animations: AvatarAnimation[];

  // 表情映射
  @Prop({ type: Schema.Types.Mixed })
  expressions: Record<string, string>;  // { happy: 'url', sad: 'url' }

  // 适用场景
  @Prop({ type: [String] })
  suitableScenes: string[];

  // 权限配置
  @Prop({
    type: {
      ownerId: String,
      visibility: { type: String, enum: ['private', 'team', 'public'] },
      allowedUsers: [String],
      allowedRoles: [String]
    }
  })
  permissions: AvatarPermissions;

  @Prop({ enum: ['active', 'inactive', 'deprecated'], default: 'active' })
  status: string;
}

// Collection: avatar_sessions
@Schema({ collection: 'avatar_sessions' })
export class AvatarSession {
  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  avatarId: string;

  // 当前状态
  @Prop({
    type: {
      expression: String,
      animation: String,
      position: {
        x: Number, y: Number, z: Number
      },
      scale: { type: Number, default: 1.0 }
    }
  })
  currentState: AvatarState;

  @Prop({ default: false })
  isSpeaking: boolean;

  // 唇形同步数据
  @Prop({ type: Schema.Types.Mixed })
  lipSyncData: any;

  // 当前播放的音频
  @Prop({
    type: {
      audioUrl: String,
      duration: Number,
      text: String,
      startedAt: Date
    }
  })
  currentAudio: CurrentAudioInfo;

  @Prop()
  expiresAt: Date;
}

// TTL 索引
// db.avatar_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

---

## 3. Redis 缓存设计

### 3.1 Key 命名规范

```
{namespace}:{entity}:{id}:{field}
```

### 3.2 核心缓存结构

```typescript
// 会话上下文缓存（短期记忆）
// Key: session:{sessionId}:context
// Type: Hash
// TTL: 24小时
interface SessionContextCache {
  userId: string;
  workflowId?: string;
  executionId?: string;
  currentEmotion: string;  // JSON
  contextWindow: string;   // JSON array
  lastActivity: string;    // timestamp
}

// 工作流执行状态缓存
// Key: execution:{executionId}:status
// Type: Hash
// TTL: 7天
interface ExecutionStatusCache {
  status: string;
  currentNodeId: string;
  progress: number;  // 0-100
  startedAt: string;
  updatedAt: string;
  contextSnapshot: string;  // JSON
}

// HITL 断点锁（防止重复处理）
// Key: breakpoint:{breakpointId}:lock
// Type: String
// TTL: 5分钟
// Value: processor_id

// Agent 调用限流
// Key: agent:{agentId}:ratelimit:{userId}
// Type: String (使用 Redis Cell 或 Lua 脚本)
// Window: 1分钟

// 用户情感状态（实时）
// Key: emotion:{userId}:current
// Type: Hash
// TTL: 1小时
interface CurrentEmotionCache {
  satisfaction: number;
  trust: number;
  frustration: number;
  urgency: number;
  lastUpdated: string;
  strategy: string;
}

// 记忆检索缓存
// Key: memory:{userId}:query:{hash(query)}
// Type: String
// TTL: 10分钟
// Value: JSON array of memory IDs
```

---

## 4. 向量数据库设计 (Milvus)

### 4.1 Collection: semantic_memories

```yaml
Collection: semantic_memories
Fields:
  - name: memory_id
    type: VARCHAR(64)
    is_primary: true

  - name: concept
    type: VARCHAR(256)

  - name: concept_vector
    type: FLOAT_VECTOR
    dim: 1536  # text-embedding-3-large

  - name: type
    type: VARCHAR(32)

  - name: user_id
    type: VARCHAR(64)

  - name: attributes
    type: JSON

  - name: importance_score
    type: FLOAT

  - name: created_at
    type: INT64  # timestamp

Indexes:
  - field: concept_vector
    index_type: IVF_FLAT  # 或 HNSW 用于大规模数据
    metric_type: COSINE

Partitions:
  - _default
  # 可按 user_id 分区实现多租户
```

### 4.2 Collection: prompt_templates

```yaml
Collection: prompt_templates
Fields:
  - name: template_id
    type: VARCHAR(64)
    is_primary: true

  - name: description
    type: VARCHAR(512)

  - name: description_vector
    type: FLOAT_VECTOR
    dim: 1536

  - name: category
    type: VARCHAR(64)

  - name: tags
    type: ARRAY<VARCHAR(32)>

  - name: usage_count
    type: INT32

Indexes:
  - field: description_vector
    index_type: IVF_FLAT
    metric_type: COSINE
```

---

## 5. 数据一致性策略

### 5.1 强一致性场景

- 工作流状态变更
- HITL 断点状态
- 财务相关操作

**策略**: 使用 MongoDB 事务 + 乐观锁（version 字段）

### 5.2 最终一致性场景

- 统计数据更新
- 情感历史记录
- 搜索索引更新

**策略**: 事件驱动 + 异步补偿

### 5.3 缓存一致性

```typescript
// Cache-Aside 模式
async function getWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  // 1. 查缓存
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // 2. 查数据库
  const data = await fetcher();

  // 3. 写缓存
  await redis.setex(key, ttl, JSON.stringify(data));

  return data;
}

// 更新时失效缓存
async function updateAndInvalidate(
  id: string,
  update: UpdateQuery,
  cacheKeys: string[]
): Promise<void> {
  // 1. 更新数据库
  await db.collection.updateOne({ _id: id }, update);

  // 2. 删除缓存
  await redis.del(...cacheKeys);

  // 3. 发送缓存失效事件
  await eventBus.publish('cache.invalidate', { keys: cacheKeys });
}
```

---

## 6. 索引策略汇总

### 6.1 MongoDB 索引

```javascript
// workflow_definitions
db.workflow_definitions.createIndex({ workflowId: 1 }, { unique: true });
db.workflow_definitions.createIndex({ ownerId: 1, status: 1 });
db.workflow_definitions.createIndex({ tags: 1 });
db.workflow_definitions.createIndex({ status: 1, updatedAt: -1 });

// workflow_executions
db.workflow_executions.createIndex({ executionId: 1 }, { unique: true });
db.workflow_executions.createIndex({ workflowId: 1, status: 1 });
db.workflow_executions.createIndex({ userId: 1, createdAt: -1 });
db.workflow_executions.createIndex({ status: 1, "timing.scheduledAt": 1 });
db.workflow_executions.createIndex({
  "timing.completedAt": 1
}, {
  expireAfterSeconds: 7776000  // 90天
});

// hitl_breakpoints
db.hitl_breakpoints.createIndex({ breakpointId: 1 }, { unique: true });
db.hitl_breakpoints.createIndex({ executionId: 1, status: 1 });
db.hitl_breakpoints.createIndex({ status: 1, priority: 1, deadline: 1 });
db.hitl_breakpoints.createIndex({
  "approverConfig.currentApprovers": 1,
  status: 1
});

// agent_definitions
db.agent_definitions.createIndex({ agentId: 1 }, { unique: true });
db.agent_definitions.createIndex({ type: 1, status: 1 });
db.agent_definitions.createIndex({ "capabilities.tools": 1 });

// emotion_profiles
db.emotion_profiles.createIndex({ userId: 1 }, { unique: true });

// long_term_memories
db.long_term_memories.createIndex({ userId: 1 }, { unique: true });
db.long_term_memories.createIndex({ "userProfile.topicInterests": 1 });

// semantic_memories
db.semantic_memories.createIndex({ memoryId: 1 }, { unique: true });
db.semantic_memories.createIndex({ concept: 1, type: 1 });
db.semantic_memories.createIndex({ userIds: 1 });
```

### 6.2 Redis Key 模式

```
# 会话相关
session:{sessionId}:context          # Hash, TTL 24h
session:{sessionId}:emotion          # Hash, TTL 1h
session:{sessionId}:lock             # String, TTL 5m

# 执行相关
execution:{executionId}:status       # Hash, TTL 7d
execution:{executionId}:context      # String, TTL 7d
execution:{executionId}:lock         # String, TTL 5m

# 用户相关
user:{userId}:emotion:current        # Hash, TTL 1h
user:{userId}:memory:cache           # Hash, TTL 10m
user:{userId}:rate_limit:{action}    # String, TTL 1m

# Agent 相关
agent:{agentId}:status               # Hash
agent:{agentId}:stats                # Hash
agent:{agentId}:ratelimit:{userId}   # String, TTL 1m

# HITL 相关
breakpoint:{breakpointId}:lock       # String, TTL 5m
hitl:pending:{userId}                # Set
hitl:urgent                          # Sorted Set (by deadline)
```

---

## 7. 附录

### 7.1 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-10 | 初始版本 |

### 7.2 待决策事项

1. **数据保留策略**：工作流执行历史保留多久？
2. **向量维度**：是否使用 1536 维还是 3072 维 embedding？
3. **分片策略**：是否按 userId 进行 MongoDB 分片？
4. **冷热分离**：历史数据是否需要归档到廉价存储？
