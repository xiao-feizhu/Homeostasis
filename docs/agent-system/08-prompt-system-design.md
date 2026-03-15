# 增强型 Agent 系统 - 提示词与上下文增强系统设计文档

**版本**: v1.0
**日期**: 2026-03-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 设计目标

提示词与上下文增强系统负责动态组装、优化和管理 LLM 提示词，实现：

1. **动态组装**: 基于上下文动态组合最优提示词
2. **RAG 增强**: 结合检索结果丰富上下文
3. **效果追踪**: 监控提示词效果，持续优化
4. **版本管理**: 支持 A/B 测试和灰度发布

### 1.2 核心能力

| 能力 | 说明 |
|------|------|
| 模板管理 | 支持变量替换、条件渲染、循环 |
| 上下文优化 | 智能压缩、去噪、优先级排序 |
| RAG 集成 | 多知识源检索、重排序、融合 |
| 版本控制 | 版本管理、回滚、对比 |
| A/B 测试 | 分组实验、效果对比 |

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        提示词增强系统架构                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     模板管理层 (Template Layer)                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   模板定义    │  │   变量管理    │  │       模板渲染            │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 版本控制   │  │ • 类型校验   │  │ • 变量替换               │  │   │
│  │  │ • 继承复用   │  │ • 默认值     │  │ • 条件渲染               │  │   │
│  │  │ • 分类标签   │  │ • 验证规则   │  │ • 循环处理               │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     上下文层 (Context Layer)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   会话上下文  │  │   用户上下文  │  │       系统上下文          │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 历史对话   │  │ • 用户画像   │  │ • 角色设定               │  │   │
│  │  │ • 当前话题   │  │ • 偏好设置   │  │ • 知识库                 │  │   │
│  │  │ • 临时变量   │  │ • 历史交互   │  │ • 工具定义               │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     RAG 层 (Retrieval Layer)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   知识源管理  │  │   检索引擎    │  │       重排序             │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 多源接入   │  │ • 向量检索   │  │ • 相关性评分            │  │   │
│  │  │ • 权限控制   │  │ • 混合搜索   │  │ • 多样性优化            │  │   │
│  │  │ • 增量更新   │  │ • 过滤聚合   │  │ • 重排序模型            │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     组装层 (Assembly Layer)                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   智能组装    │  │   窗口管理    │  │       优化压缩          │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 策略选择   │  │ • Token计算  │  │ • 摘要生成              │  │   │
│  │  │ • 组件拼接   │  │ • 优先级排序 │  │ • 冗余消除              │  │   │
│  │  │ • 格式验证   │  │ • 动态截断   │  │ • 信息密度优化          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     优化层 (Optimization Layer)                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   效果追踪    │  │   A/B测试    │  │       自动优化          │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 指标采集   │  │ • 分组实验   │  │ • 参数调优              │  │   │
│  │  │ • 反馈收集   │  │ • 效果对比   │  │ • 模板进化              │  │   │
│  │  │ • 归因分析   │  │ • 统计分析   │  │ • 知识更新              │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 模板系统

### 3.1 模板定义

```typescript
interface PromptTemplate {
  templateId: string;
  name: string;
  description: string;

  // 版本信息
  version: string;
  parentVersion?: string;       // 继承自哪个版本

  // 模板内容
  content: string;              // 使用 Handlebars/Mustache 语法

  // 变量定义
  variables: TemplateVariable[];

  // 模板配置
  config: {
    maxTokens: number;          // 最大 Token 数限制
    escapeHtml: boolean;        // 是否转义 HTML
    strict: boolean;            // 严格模式（变量缺失报错）
  };

  // 元数据
  metadata: {
    category: string;
    tags: string[];
    author: string;
    createdAt: Date;
    updatedAt: Date;
  };

  // 性能统计
  stats: {
    usageCount: number;
    avgLatency: number;
    successRate: number;
    userSatisfaction: number;
  };
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'template';
  description: string;
  required: boolean;
  defaultValue?: any;

  // 验证规则
  validation?: {
    pattern?: string;           // 正则
    min?: number;
    max?: number;
    enum?: any[];
    custom?: string;            // 自定义验证函数名
  };

  // 数据源
  source?: {
    type: 'static' | 'dynamic' | 'memory' | 'rag' | 'user_input';
    config?: Record<string, any>;
  };
}
```

### 3.2 模板示例

```handlebars
{{! 商品分析模板 }}
{{#system}}
你是电商运营专家，擅长商品选品和竞品分析。
{{/system}}

{{#context}}
用户画像：
- 经验水平：{{user.expertiseLevel}}
- 主营品类：{{user.mainCategories}}
- 历史偏好：{{user.preferences}}

当前任务：{{task.description}}
{{/context}}

{{#rag}}
{{#each retrievedKnowledge}}
- {{this.content}}
{{/each}}
{{/rag}}

{{#if productInfo}}
商品信息：
- 名称：{{productInfo.name}}
- 品类：{{productInfo.category}}
- 价格：{{productInfo.price}}
- 描述：{{productInfo.description}}
{{/if}}

{{#user}}
{{userInput}}
{{/user}}

{{#assistant}}
请从以下几个方面分析该商品：
1. 市场定位
2. 竞品对比
3. 定价建议
4. 风险提示

以 JSON 格式输出：
{
  "marketPosition": "...",
  "competitorAnalysis": "...",
  "pricingSuggestion": "...",
  "riskAssessment": "..."
}
{{/assistant}}
```

### 3.3 模板引擎

```typescript
@Injectable()
export class TemplateEngine {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  private registerHelpers(): void {
    // 条件渲染
    this.handlebars.registerHelper('if_eq', (a, b, options) => {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    // 循环限制
    this.handlebars.registerHelper('each_limit', (arr, limit, options) => {
      if (!arr || arr.length === 0) return options.inverse(this);
      const result = [];
      for (let i = 0; i < Math.min(arr.length, limit); i++) {
        result.push(options.fn(arr[i]));
      }
      return result.join('');
    });

    // 字符串截断
    this.handlebars.registerHelper('truncate', (str, length) => {
      if (!str || str.length <= length) return str;
      return str.substring(0, length) + '...';
    });

    // JSON 格式化
    this.handlebars.registerHelper('json', (obj) => {
      return JSON.stringify(obj, null, 2);
    });

    // Token 计数
    this.handlebars.registerHelper('token_count', (str) => {
      return estimateTokenCount(str);
    });
  }

  async render(
    template: PromptTemplate,
    variables: Record<string, any>,
    options?: RenderOptions
  ): Promise<RenderResult> {
    // 1. 验证变量
    const validation = this.validateVariables(template, variables);
    if (!validation.valid) {
      throw new VariableValidationError(validation.errors);
    }

    // 2. 应用默认值
    const mergedVars = this.applyDefaults(template, variables);

    // 3. 编译模板
    const compiled = this.handlebars.compile(template.content, {
      strict: template.config.strict
    });

    // 4. 渲染
    const rendered = compiled(mergedVars);

    // 5. 后处理
    const processed = await this.postProcess(rendered, options);

    // 6. 计算 Token
    const tokenCount = estimateTokenCount(processed);

    return {
      content: processed,
      tokenCount,
      variables: mergedVars,
      truncated: tokenCount > template.config.maxTokens
    };
  }

  private validateVariables(
    template: PromptTemplate,
    variables: Record<string, any>
  ): ValidationResult {
    const errors: string[] = [];

    for (const varDef of template.variables) {
      const value = variables[varDef.name];

      // 检查必填
      if (varDef.required && (value === undefined || value === null)) {
        errors.push(`Missing required variable: ${varDef.name}`);
        continue;
      }

      if (value === undefined) continue;

      // 类型检查
      if (!this.checkType(value, varDef.type)) {
        errors.push(`Invalid type for ${varDef.name}: expected ${varDef.type}`);
      }

      // 验证规则
      if (varDef.validation) {
        const validationError = this.validateValue(value, varDef.validation);
        if (validationError) {
          errors.push(`${varDef.name}: ${validationError}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

---

## 4. 上下文管理

### 4.1 上下文组装策略

```typescript
interface ContextAssemblyStrategy {
  // 策略名称
  name: string;

  // 组件优先级（按优先级排序）
  componentPriority: ContextComponentType[];

  // 预留 Token 配置
  tokenBudget: {
    system: number;             // 系统提示词
    context: number;            // 上下文
    rag: number;                // RAG 结果
    history: number;            // 历史对话
    userInput: number;          // 用户输入保留
    reserve: number;            // 预留空间
  };

  // 截断策略
  truncation: {
    method: 'truncate' | 'summarize' | 'selective';
    preserveRecent: number;     // 保留最近 N 条
  };
}

// 默认策略
const DEFAULT_STRATEGY: ContextAssemblyStrategy = {
  name: 'balanced',
  componentPriority: [
    'system',
    'user_input',
    'rag',
    'context',
    'history'
  ],
  tokenBudget: {
    system: 500,
    context: 1000,
    rag: 1500,
    history: 2000,
    userInput: 500,
    reserve: 500
  },
  truncation: {
    method: 'summarize',
    preserveRecent: 5
  }
};
```

### 4.2 上下文组装器

```typescript
@Injectable()
export class ContextAssembler {
  constructor(
    private memoryService: MemoryService,
    private ragService: RAGService,
    private compressor: ContextCompressor,
    private tokenCounter: TokenCounter
  ) {}

  async assemble(
    params: AssemblyParams
  ): Promise<AssembledContext> {
    const { userId, sessionId, userInput, strategy } = params;

    const components: ContextComponent[] = [];
    let remainingTokens = strategy.tokenBudget.system +
                          strategy.tokenBudget.context +
                          strategy.tokenBudget.rag +
                          strategy.tokenBudget.history;

    // 1. 系统提示词（最高优先级，不压缩）
    const systemPrompt = await this.getSystemPrompt(params);
    components.push({
      type: 'system',
      content: systemPrompt,
      priority: 1,
      compressible: false
    });

    // 2. 用户输入（保留）
    components.push({
      type: 'user_input',
      content: userInput,
      priority: 2,
      compressible: false
    });

    // 3. RAG 检索
    if (strategy.tokenBudget.rag > 0) {
      const ragResults = await this.ragService.retrieve({
        query: userInput,
        userId,
        topK: 5,
        maxTokens: strategy.tokenBudget.rag
      });

      const ragContent = this.formatRAGResults(ragResults);
      components.push({
        type: 'rag',
        content: ragContent,
        priority: 3,
        compressible: true,
        originalTokens: estimateTokenCount(ragContent)
      });
    }

    // 4. 会话上下文
    if (strategy.tokenBudget.context > 0) {
      const sessionContext = await this.memoryService.getShortTermMemory(
        sessionId
      );

      const contextContent = this.formatSessionContext(sessionContext);
      components.push({
        type: 'context',
        content: contextContent,
        priority: 4,
        compressible: true,
        originalTokens: estimateTokenCount(contextContent)
      });
    }

    // 5. 历史对话
    if (strategy.tokenBudget.history > 0) {
      const history = await this.getConversationHistory(
        sessionId,
        strategy.truncation.preserveRecent
      );

      const historyContent = this.formatHistory(history);
      components.push({
        type: 'history',
        content: historyContent,
        priority: 5,
        compressible: true,
        originalTokens: estimateTokenCount(historyContent)
      });
    }

    // 6. 智能压缩
    const compressed = await this.compressComponents(
      components,
      remainingTokens,
      strategy
    );

    // 7. 组装最终提示词
    const finalPrompt = this.buildFinalPrompt(compressed);

    return {
      prompt: finalPrompt,
      components: compressed.map(c => ({
        type: c.type,
        tokenCount: estimateTokenCount(c.content),
        compressed: c.compressed || false
      })),
      totalTokens: estimateTokenCount(finalPrompt),
      metadata: {
        strategy: strategy.name,
        ragResults: components.find(c => c.type === 'rag')?.sourceCount
      }
    };
  }

  private async compressComponents(
    components: ContextComponent[],
    budget: number,
    strategy: ContextAssemblyStrategy
  ): Promise<ContextComponent[]> {
    // 按优先级排序
    const sorted = components.sort((a, b) => a.priority - b.priority);

    let usedTokens = 0;
    const result: ContextComponent[] = [];

    for (const component of sorted) {
      const componentTokens = estimateTokenCount(component.content);

      if (!component.compressible) {
        // 不可压缩，直接保留
        result.push(component);
        usedTokens += componentTokens;
      } else if (usedTokens + componentTokens <= budget) {
        // 预算充足，保留完整内容
        result.push(component);
        usedTokens += componentTokens;
      } else {
        // 需要压缩
        const remainingBudget = budget - usedTokens;
        if (remainingBudget > 100) {  // 最少保留 100 tokens
          const compressed = await this.compressor.compress(
            component.content,
            remainingBudget
          );
          result.push({
            ...component,
            content: compressed,
            compressed: true
          });
          usedTokens += estimateTokenCount(compressed);
        }
      }
    }

    return result;
  }
}
```

---

## 5. RAG 集成

### 5.1 RAG 流程

```typescript
@Injectable()
export class RAGService {
  constructor(
    private vectorStore: VectorStore,
    private elasticsearch: ElasticsearchService,
    private reranker: RerankerService,
    private queryOptimizer: QueryOptimizer
  ) {}

  async retrieve(params: RetrieveParams): Promise<RAGResult> {
    const { query, userId, knowledgeSources, topK = 5 } = params;

    // 1. 查询优化
    const optimizedQuery = await this.queryOptimizer.optimize(query);

    // 2. 并行检索
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(optimizedQuery, userId, knowledgeSources, topK * 2),
      this.keywordSearch(optimizedQuery, userId, knowledgeSources, topK * 2)
    ]);

    // 3. 融合结果
    const fused = this.reciprocalRankFusion(vectorResults, keywordResults);

    // 4. 重排序
    const reranked = await this.reranker.rerank(
      query,
      fused.slice(0, topK * 2)
    );

    // 5. 格式化输出
    return {
      results: reranked.slice(0, topK).map(r => ({
        content: r.content,
        source: r.source,
        relevanceScore: r.score,
        metadata: r.metadata
      })),
      query: optimizedQuery,
      totalFound: fused.length,
      retrievalTime: Date.now() - startTime
    };
  }

  private async vectorSearch(
    query: string,
    userId: string,
    sources: string[],
    topK: number
  ): Promise<SearchResult[]> {
    const queryVector = await this.embeddingService.embed(query);

    return this.vectorStore.search({
      vector: queryVector,
      filter: {
        source: { $in: sources },
        $or: [
          { userId },
          { isPublic: true }
        ]
      },
      topK
    });
  }
}
```

---

## 6. 版本管理与 A/B 测试

### 6.1 版本控制

```typescript
interface PromptVersion {
  templateId: string;
  version: string;              // SemVer
  parentVersion?: string;

  // 变更记录
  changes: {
    type: 'added' | 'modified' | 'removed';
    field: string;
    description: string;
  }[];

  // 发布状态
  status: 'draft' | 'staging' | 'production' | 'deprecated';

  // 灰度配置
  rollout: {
    percentage: number;         // 灰度比例
    targetUsers?: string[];     // 指定用户
    targetSegments?: string[];  // 指定群体
  };
}
```

### 6.2 A/B 测试

```typescript
interface ABTest {
  testId: string;
  name: string;
  hypothesis: string;

  // 对照组配置
  control: {
    templateId: string;
    version: string;
    trafficPercentage: number;
  };

  // 实验组配置
  variants: {
    variantId: string;
    name: string;
    templateId: string;
    version: string;
    trafficPercentage: number;
  }[];

  // 成功指标
  metrics: {
    primary: string;            // 主要指标
    secondary: string[];        // 次要指标
    guardrails: string[];       // 防护指标
  };

  // 样本量计算
  sampleSize: {
    required: number;
    perVariant: number;
    duration: number;           // 预计天数
  };
}
```

---

## 7. API 接口

```typescript
// POST /api/v1/prompt/assemble
interface AssemblePromptRequest {
  templateId: string;
  variables: Record<string, any>;
  context?: {
    userId?: string;
    sessionId?: string;
    enableRAG?: boolean;
    enableMemory?: boolean;
  };
  options?: {
    maxTokens?: number;
    strategy?: string;
  };
}

interface AssemblePromptResponse {
  prompt: string;
  tokenCount: number;
  components: {
    type: string;
    tokenCount: number;
    compressed: boolean;
  }[];
  ragResults?: {
    query: string;
    results: RetrievedDocument[];
  };
}

// POST /api/v1/prompt/templates
interface CreateTemplateRequest {
  name: string;
  description: string;
  content: string;
  variables: TemplateVariableInput[];
  config?: TemplateConfig;
}

// POST /api/v1/prompt/ab-tests
interface CreateABTestRequest {
  name: string;
  hypothesis: string;
  controlTemplateId: string;
  variantTemplateIds: string[];
  trafficSplit: number[];
  metrics: string[];
  duration: number;
}
```

---

## 8. 附录

### 8.1 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-10 | 初始版本 |
