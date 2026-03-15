# 增强型 Agent 系统 - 记忆系统设计文档

**版本**: v1.0
**日期**: 2026-03-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 设计目标

记忆系统为 AI Agent 提供长期和短期的信息存储与检索能力，实现：

1. **上下文连续性**: 跨会话保持对话连贯性
2. **个性化体验**: 基于历史偏好提供定制服务
3. **知识积累**: 从交互中学习并积累知识
4. **语义关联**: 通过知识图谱建立概念关联

### 1.2 记忆层次

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          记忆层次架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      短期记忆 (Short-term)                           │   │
│  │  • 会话级上下文                                                     │   │
│  │  • 当前话题追踪                                                     │   │
│  │  • 待澄清问题                                                       │   │
│  │  • TTL: 24小时                                                     │   │
│  │  • 存储: Redis                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      长期记忆 (Long-term)                            │   │
│  │  • 用户画像                                                         │   │
│  │  • 历史偏好                                                         │   │
│  │  • 关键事件                                                         │   │
│  │  • 学习到的知识                                                     │   │
│  │  • 存储: MongoDB                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      语义记忆 (Semantic)                             │   │
│  │  • 知识图谱                                                         │   │
│  │  • 概念关联                                                         │   │
│  │  • 关系推理                                                         │   │
│  │  • 存储: Milvus (向量) + MongoDB (图谱)                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              记忆系统架构                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        记忆管理器 (Memory Manager)                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   写入接口    │  │   查询接口    │  │       管理接口            │  │   │
│  │  │  save()      │  │  retrieve()  │  │  consolidate()           │  │   │
│  │  │  update()    │  │  search()    │  │  forget()                │  │   │
│  │  │  batchSave() │  │  query()     │  │  compress()              │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│        ┌───────────────────────────┼───────────────────────────┐            │
│        │                           │                           │            │
│        ▼                           ▼                           ▼            │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │  编码器      │          │  检索器      │          │  压缩器      │      │
│  │  Encoder     │          │  Retriever   │          │  Compressor  │      │
│  │              │          │              │          │              │      │
│  │ • Embedding  │          │ • Vector     │          │ • Summarize  │      │
│  │ • Normalize  │          │ • Keyword    │          │ • Deduplicate│      │
│  │ • Extract    │          │ • Hybrid     │          │ • Merge      │      │
│  └──────────────┘          └──────────────┘          └──────────────┘      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              存储层                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Redis Cache  │  │   MongoDB    │  │    Milvus    │  │ Elasticsearch│    │
│  │ (短期记忆)   │  │  (长期记忆)  │  │ (向量检索)   │  │ (全文检索)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 | 关键算法/技术 |
|------|------|---------------|
| MemoryManager | 记忆生命周期管理 | CRUD 操作 |
| Encoder | 记忆编码向量化 | Embedding 模型 |
| Retriever | 多策略记忆检索 | 向量+关键词+混合 |
| Compressor | 记忆压缩与摘要 | LLM 摘要 |
| Consolidator | 记忆整合与去重 | 聚类算法 |

---

## 3. 记忆模型

### 3.1 短期记忆 (STM)

```typescript
interface ShortTermMemory {
  sessionId: string;
  userId: string;

  // 上下文窗口
  contextWindow: {
    messageId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    embedding?: number[];
    emotion?: EmotionMetrics;
    entities?: string[];
  }[];

  // 最大窗口大小
  maxWindowSize: number;

  // 会话摘要
  sessionSummary: string;

  // 当前话题
  currentTopic?: string;

  // 待澄清问题
  pendingClarifications: string[];

  // 临时变量
  tempVariables: Record<string, any>;

  // 最后更新时间
  lastUpdated: Date;
}
```

### 3.2 长期记忆 (LTM)

```typescript
interface LongTermMemory {
  userId: string;

  // 用户画像
  userProfile: {
    // 基础偏好
    preferences: {
      communicationStyle?: string;
      detailLevel?: 'minimal' | 'brief' | 'detailed';
      preferredLanguage?: string;
      timezone?: string;
    };

    // 行为模式
    behaviorPatterns: {
      pattern: string;
      frequency: number;
      lastObserved: Date;
    }[];

    // 话题兴趣
    topicInterests: {
      topic: string;
      level: number;        // 1-10
      lastMentioned: Date;
    }[];

    // 各领域专业度
    expertise: {
      domain: string;
      level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    }[];

    // 目标
    goals: {
      id: string;
      description: string;
      priority: number;
      status: 'active' | 'completed' | 'abandoned';
      progress: number;
      deadline?: Date;
    }[];
  };

  // 交互统计
  interactionStats: {
    totalSessions: number;
    totalMessages: number;
    avgSessionDuration: number;
    avgResponseTime: number;
    preferredChannels: string[];
    activeHours: number[];    // 24小时制活跃时段
    lastSessionAt: Date;
  };

  // 关键事件
  keyEvents: {
    eventId: string;
    date: Date;
    type: 'milestone' | 'preference_change' | 'complaint' | 'praise' | 'goal_achieved';
    description: string;
    impact: number;          // -10 到 +10
    relatedWorkflows?: string[];
  }[];

  // 学习到的知识
  learnedFacts: {
    factId: string;
    content: string;
    category: string;
    confidence: number;
    source: string;
    learnedAt: Date;
    lastConfirmedAt: Date;
    confirmationCount: number;
  }[];
}
```

### 3.3 语义记忆 (Semantic Memory)

```typescript
interface SemanticMemory {
  memoryId: string;

  // 概念信息
  concept: string;
  type: 'entity' | 'event' | 'fact' | 'relation' | 'concept';

  // 向量表示
  vector: number[];
  vectorId: string;

  // 属性
  attributes: Record<string, any>;

  // 关系（知识图谱）
  relationships: {
    relationId: string;
    type: RelationType;
    targetId: string;
    targetConcept: string;
    strength: number;         // 0-1
    bidirectional: boolean;
    metadata?: Record<string, any>;
  }[];

  // 来源
  source: {
    type: 'user_input' | 'inferred' | 'external' | 'system';
    sourceId?: string;
    userId?: string;
    confidence: number;
  };

  // 访问统计
  accessStats: {
    accessCount: number;
    lastAccessedAt: Date;
    createdAt: Date;
    importanceScore: number;
  };
}

enum RelationType {
  IS_A = 'is_a',             // 属于
  PART_OF = 'part_of',       // 部分
  RELATED_TO = 'related_to', // 相关
  CAUSES = 'causes',         // 导致
  CAUSED_BY = 'caused_by',   // 被导致
  USES = 'uses',             // 使用
  USED_BY = 'used_by',       // 被使用
  LOCATED_IN = 'located_in', // 位于
  HAS_PART = 'has_part',     // 拥有部分
  PRECEDES = 'precedes',     // 先于
  FOLLOWS = 'follows'        // 后于
}
```

---

## 4. 记忆编码

### 4.1 编码流程

```typescript
@Injectable()
export class MemoryEncoder {
  constructor(
    private embeddingService: EmbeddingService,
    private entityExtractor: EntityExtractor,
    private summarizer: Summarizer
  ) {}

  // 编码交互记忆
  async encodeInteraction(
    message: Message,
    context: ConversationContext
  ): Promise<MemoryEncoding> {
    // 1. 提取关键信息
    const entities = await this.entityExtractor.extract(message.content);

    // 2. 生成摘要
    const summary = await this.summarizer.summarize(message.content, {
      maxLength: 100,
      includeKeyPoints: true
    });

    // 3. 生成向量嵌入
    const embedding = await this.embeddingService.embed(
      `${summary.content} ${entities.map(e => e.name).join(' ')}`
    );

    // 4. 提取主题
    const topics = await this.extractTopics(message.content);

    // 5. 检测意图
    const intent = await this.detectIntent(message.content);

    return {
      originalContent: message.content,
      summary: summary.content,
      embedding,
      entities,
      topics,
      intent,
      timestamp: new Date(),
      importance: this.calculateImportance(message, entities)
    };
  }

  // 编码事实知识
  async encodeFact(
    fact: string,
    source: MemorySource
  ): Promise<SemanticMemory> {
    // 1. 标准化
    const normalizedFact = this.normalizeFact(fact);

    // 2. 分类
    const category = await this.classifyFact(normalizedFact);

    // 3. 生成向量
    const vector = await this.embeddingService.embed(normalizedFact);

    // 4. 提取关系
    const relationships = await this.extractRelationships(normalizedFact);

    return {
      memoryId: generateId(),
      concept: normalizedFact,
      type: 'fact',
      vector,
      attributes: { category },
      relationships,
      source,
      accessStats: {
        accessCount: 0,
        importanceScore: 0.5,
        createdAt: new Date()
      }
    };
  }

  private calculateImportance(
    message: Message,
    entities: Entity[]
  ): number {
    let importance = 0.5;

    // 包含实体的更重要
    importance += entities.length * 0.05;

    // 用户明确强调的词
    if (/重要|关键|记住|别忘了/.test(message.content)) {
      importance += 0.2;
    }

    // 长度适中的更重要（太短可能不重要，太长可能是闲聊）
    const length = message.content.length;
    if (length > 20 && length < 200) {
      importance += 0.1;
    }

    return Math.min(importance, 1.0);
  }
}
```

---

## 5. 记忆检索

### 5.1 检索策略

```typescript
interface MemoryRetrievalStrategy {
  // 短期记忆检索
  retrieveShortTerm(
    sessionId: string,
    query: string,
    options?: RetrievalOptions
  ): Promise<ShortTermMemory[]>;

  // 长期记忆检索
  retrieveLongTerm(
    userId: string,
    query: string,
    options?: RetrievalOptions
  ): Promise<LongTermMemory[]>;

  // 语义记忆检索
  retrieveSemantic(
    query: string,
    filters?: SemanticFilters
  ): Promise<SemanticMemory[]>;

  // 混合检索
  hybridRetrieve(
    query: string,
    userId?: string,
    options?: HybridRetrievalOptions
  ): Promise<RetrievedMemory[]>;
}
```

### 5.2 检索实现

```typescript
@Injectable()
export class MemoryRetriever {
  constructor(
    private vectorStore: VectorStore,
    private mongoClient: MongoClient,
    private elasticsearch: ElasticsearchService,
    private cacheService: CacheService
  ) {}

  async hybridRetrieve(
    params: HybridRetrieveParams
  ): Promise<RetrievedMemory[]> {
    const { query, userId, sessionId, topK = 5 } = params;

    // 1. 检查缓存
    const cacheKey = `memory:${userId}:${hashQuery(query)}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. 并行执行多种检索
    const [
      vectorResults,
      keywordResults,
      recentResults
    ] = await Promise.all([
      this.vectorSearch(query, userId, topK * 2),
      this.keywordSearch(query, userId, topK * 2),
      this.retrieveRecent(userId, sessionId, topK)
    ]);

    // 3. 融合结果 (Reciprocal Rank Fusion)
    const fused = this.reciprocalRankFusion(
      vectorResults,
      keywordResults,
      recentResults
    );

    // 4. 重排序 (可选，使用轻量级模型)
    const reranked = await this.rerankResults(query, fused);

    // 5. 过滤和去重
    const filtered = this.deduplicateAndFilter(reranked, topK);

    // 6. 缓存结果
    await this.cacheService.set(cacheKey, JSON.stringify(filtered), 600);

    return filtered;
  }

  private async vectorSearch(
    query: string,
    userId: string,
    topK: number
  ): Promise<SearchResult[]> {
    // 生成查询向量
    const queryVector = await this.embeddingService.embed(query);

    // Milvus 向量检索
    const results = await this.vectorStore.search({
      vector: queryVector,
      filter: {
        userIds: { $in: [userId, null] }  // 用户专属或公共记忆
      },
      topK,
      metric: 'cosine'
    });

    return results.map(r => ({
      memoryId: r.id,
      content: r.entity.concept,
      score: r.score,
      type: 'semantic',
      source: 'vector'
    }));
  }

  private async keywordSearch(
    query: string,
    userId: string,
    topK: number
  ): Promise<SearchResult[]> {
    // Elasticsearch 全文检索
    const results = await this.elasticsearch.search({
      index: 'memories',
      query: {
        bool: {
          must: [
            { multi_match: {
              query,
              fields: ['concept^3', 'content', 'keywords'],
              type: 'best_fields'
            }}
          ],
          filter: [
            { bool: {
              should: [
                { term: { userId } },
                { bool: { must_not: { exists: { field: 'userId' } } } }
              ]
            }}
          ]
        }
      },
      size: topK
    });

    return results.hits.hits.map(h => ({
      memoryId: h._id,
      content: h._source.concept || h._source.content,
      score: h._score,
      type: h._source.type,
      source: 'keyword'
    }));
  }

  private reciprocalRankFusion(
    ...resultSets: SearchResult[][]
  ): SearchResult[] {
    const k = 60;  // RRF 常数
    const scores = new Map<string, number>();
    const details = new Map<string, SearchResult>();

    for (const results of resultSets) {
      for (let rank = 0; rank < results.length; rank++) {
        const result = results[rank];
        const rrfScore = 1 / (k + rank + 1);

        scores.set(
          result.memoryId,
          (scores.get(result.memoryId) || 0) + rrfScore
        );
        details.set(result.memoryId, result);
      }
    }

    // 排序
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({
        ...details.get(id)!,
        rrfScore: score
      }));
  }
}
```

---

## 6. 记忆整合

### 6.1 整合流程

```typescript
@Injectable()
export class MemoryConsolidator {
  constructor(
    private memoryRepo: MemoryRepository,
    private deduplicator: DeduplicationService,
    private summarizer: Summarizer
  ) {}

  // 定期整合任务
  async consolidateUserMemories(userId: string): Promise<void> {
    // 1. 加载用户所有短期记忆
    const shortTermMemories = await this.memoryRepo.getShortTermMemories(userId);

    // 2. 去重
    const uniqueMemories = await this.deduplicator.deduplicate(
      shortTermMemories
    );

    // 3. 摘要生成
    for (const memory of uniqueMemories) {
      if (memory.contextWindow.length > 10) {
        const summary = await this.summarizer.summarizeConversation(
          memory.contextWindow
        );
        memory.sessionSummary = summary;
      }
    }

    // 4. 提取长期记忆
    const longTermUpdates = await this.extractLongTermMemories(
      userId,
      uniqueMemories
    );

    // 5. 更新长期记忆
    await this.memoryRepo.updateLongTermMemory(userId, longTermUpdates);

    // 6. 清理过期短期记忆
    await this.memoryRepo.cleanupExpiredMemories(userId);

    // 7. 构建/更新知识图谱
    await this.updateKnowledgeGraph(userId, uniqueMemories);
  }

  private async extractLongTermMemories(
    userId: string,
    memories: ShortTermMemory[]
  ): Promise<Partial<LongTermMemory>> {
    const updates: Partial<LongTermMemory> = {};

    // 提取偏好变化
    const preferenceChanges = this.detectPreferenceChanges(memories);
    if (preferenceChanges.length > 0) {
      updates.userProfile = { preferences: preferenceChanges };
    }

    // 提取新话题兴趣
    const newInterests = this.extractTopicInterests(memories);
    if (newInterests.length > 0) {
      updates.userProfile = {
        ...updates.userProfile,
        topicInterests: newInterests
      };
    }

    // 提取关键事件
    const keyEvents = this.extractKeyEvents(memories);
    if (keyEvents.length > 0) {
      updates.keyEvents = keyEvents;
    }

    // 提取学习到的知识
    const learnedFacts = await this.extractLearnedFacts(memories);
    if (learnedFacts.length > 0) {
      updates.learnedFacts = learnedFacts;
    }

    return updates;
  }
}
```

### 6.2 去重策略

```typescript
@Injectable()
export class DeduplicationService {
  constructor(
    private embeddingService: EmbeddingService,
    private similarityCalculator: SimilarityCalculator
  ) {}

  async deduplicate<T extends Memory>(
    memories: T[],
    threshold = 0.85
  ): Promise<T[]> {
    const unique: T[] = [];

    for (const memory of memories) {
      const embedding = await this.getOrCreateEmbedding(memory);

      // 检查是否与已有记忆重复
      let isDuplicate = false;
      for (const existing of unique) {
        const existingEmbedding = await this.getOrCreateEmbedding(existing);
        const similarity = this.similarityCalculator.cosine(
          embedding,
          existingEmbedding
        );

        if (similarity > threshold) {
          // 合并重复记忆
          this.mergeMemories(existing, memory);
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(memory);
      }
    }

    return unique;
  }

  private mergeMemories<T extends Memory>(
    existing: T,
    duplicate: T
  ): void {
    // 保留更完整的描述
    if (duplicate.content.length > existing.content.length) {
      existing.content = duplicate.content;
    }

    // 合并来源信息
    existing.sources = [...(existing.sources || []), duplicate.source];

    // 更新置信度
    existing.confidence = Math.min(
      1.0,
      (existing.confidence || 0.5) + 0.1
    );

    // 更新时间
    existing.lastUpdated = new Date();
  }
}
```

---

## 7. API 接口

```typescript
// POST /api/v1/memory/save
interface SaveMemoryRequest {
  userId: string;
  sessionId?: string;
  type: 'interaction' | 'fact' | 'preference' | 'event';
  content: string;
  metadata?: Record<string, any>;
  importance?: number;
}

// POST /api/v1/memory/retrieve
interface RetrieveMemoryRequest {
  query: string;
  userId?: string;
  sessionId?: string;
  types?: ('short_term' | 'long_term' | 'semantic')[];
  topK?: number;
  filters?: {
    timeRange?: { start: string; end: string };
    topics?: string[];
    minImportance?: number;
  };
}

interface RetrieveMemoryResponse {
  memories: {
    id: string;
    type: string;
    content: string;
    relevanceScore: number;
    timestamp: string;
    metadata?: Record<string, any>;
  }[];
  retrievalTime: number;
  strategy: string;
}

// POST /api/v1/memory/consolidate
interface ConsolidateMemoryRequest {
  userId: string;
  options?: {
    includeShortTerm?: boolean;
    generateSummaries?: boolean;
    updateKnowledgeGraph?: boolean;
  };
}

// DELETE /api/v1/memory/forget
interface ForgetMemoryRequest {
  memoryIds?: string[];
  userId?: string;
  before?: string;  // 删除某个日期前的记忆
  condition?: string;  // 条件删除
}
```

---

## 8. 性能优化

| 策略 | 实现 | 效果 |
|------|------|------|
| 分层缓存 | Redis + 应用缓存 | 减少 80% DB 查询 |
| 向量索引 | HNSW | 检索速度 < 50ms |
| 异步编码 | 消息队列 | 不阻塞主流程 |
| 批量处理 | 批量 Embedding | 降低 API 成本 |
| 增量更新 | 只更新变化部分 | 减少写入量 |

---

## 9. 附录

### 9.1 存储配额

| 用户类型 | 短期记忆 | 长期记忆 | 语义记忆 |
|----------|----------|----------|----------|
| 免费用户 | 100条 | 1000条 | 500条 |
| 付费用户 | 500条 | 10000条 | 5000条 |
| 企业用户 | 无限制 | 无限制 | 无限制 |

### 9.2 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-10 | 初始版本 |
