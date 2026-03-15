# 增强型 Agent 系统 - 电商+自媒体运营模块设计文档

**版本**: v1.0
**日期**: 2026-03-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 模块定位

电商+自媒体运营模块是系统的核心业务层，通过工作流编排实现：

1. **电商运营**: 商品选品、竞品分析、定价策略、库存预警
2. **自媒体运营**: 内容创作、热点追踪、多平台发布、数据监测

### 1.2 业务架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         电商+自媒体运营模块                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        电商运营系统                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   商品分析    │  │   竞品分析    │  │       定价策略           │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 信息采集   │  │ • 价格监控   │  │ • 成本分析               │  │   │
│  │  │ • 卖点提取   │  │ • 销量追踪   │  │ • 竞品对比               │  │   │
│  │  │ • 类目分析   │  │ • 评价分析   │  │ • 利润预测               │  │   │
│  │  │ • 趋势预测   │  │ • 差异化分析 │  │ • 动态调价               │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   库存管理    │  │   订单辅助    │  │       数据报表           │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 库存预警   │  │ • 订单分析   │  │ • 销售看板               │  │   │
│  │  │ • 补货建议   │  │ • 物流跟踪   │  │ • 趋势分析               │  │   │
│  │  │ • 周转分析   │  │ • 售后辅助   │  │ • 异常监测               │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        自媒体运营系统                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   热点发现    │  │   选题策划    │  │       内容创作           │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 趋势监测   │  │ • 选题库     │  │ • 标题生成               │  │   │
│  │  │ • 热点分析   │  │ • 内容规划   │  │ • 文案撰写               │  │   │
│  │  │ • 竞品追踪   │  │ • 排期建议   │  │ • 图文生成               │  │   │
│  │  │ • 预警通知   │  │ • 系列策划   │  │ • 视频脚本               │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   多平台发布  │  │   互动管理    │  │       数据分析           │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ • 内容适配   │  │ • 评论回复   │  │ • 流量分析               │  │   │
│  │  │ • 定时发布   │  │ • 私信处理   │  │ • 粉丝画像               │  │   │
│  │  │ • 发布监控   │  │ • 舆情监测   │  │ • 转化追踪               │  │   │
│  │  │ • 账号管理   │  │ • 危机预警   │  │ • ROI计算                │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 电商运营模块

### 2.1 商品选品分析工作流

```typescript
const productSelectionWorkflow = {
  workflowId: 'ecommerce-product-selection',
  name: '商品选品分析',
  description: '分析市场数据，提供选品建议',

  nodes: [
    {
      nodeId: 'input',
      type: 'start',
      output: ['category', 'budget', 'targetPlatforms']
    },
    {
      nodeId: 'data-crawl',
      type: 'automatic',
      agentId: 'data-crawler',
      dependencies: ['input'],
      config: {
        tools: ['web-scraper', 'api-connector'],
        targets: ['${input.targetPlatforms}']
      },
      output: ['marketData', 'competitorData']
    },
    {
      nodeId: 'market-analysis',
      type: 'automatic',
      agentId: 'market-analyst',
      dependencies: ['data-crawl'],
      config: {
        analysisDimensions: ['trend', 'demand', 'competition']
      },
      output: ['marketReport']
    },
    {
      nodeId: 'product-scoring',
      type: 'automatic',
      agentId: 'scoring-agent',
      dependencies: ['market-analysis'],
      config: {
        scoringModel: 'comprehensive-v2',
        weights: {
          profit: 0.3,
          demand: 0.25,
          competition: 0.2,
          trend: 0.15,
          risk: 0.1
        }
      },
      output: ['scoredProducts']
    },
    {
      nodeId: 'pricing-recommendation',
      type: 'automatic',
      agentId: 'pricing-agent',
      dependencies: ['product-scoring'],
      config: {
        strategy: 'competitive-with-margin',
        minMargin: 0.2
      },
      hitlConfig: {
        enabled: true,
        condition: '${output.minMargin} < 0.25',
        type: 'approval',
        approvers: ['category-manager']
      },
      output: ['pricingStrategy']
    },
    {
      nodeId: 'report-generation',
      type: 'automatic',
      agentId: 'report-agent',
      dependencies: ['pricing-recommendation'],
      output: ['selectionReport']
    },
    {
      nodeId: 'hitl-review',
      type: 'hitl',
      dependencies: ['report-generation'],
      config: {
        type: 'review',
        description: '请审核选品报告',
        editableFields: ['recommendations', 'pricing']
      }
    },
    {
      nodeId: 'save-to-library',
      type: 'automatic',
      agentId: 'storage-agent',
      dependencies: ['hitl-review'],
      output: ['savedRecord']
    }
  ]
};
```

### 2.2 核心 Agent 定义

```typescript
// 数据采集 Agent
const dataCrawlerAgent: AgentDefinition = {
  agentId: 'data-crawler',
  name: '数据采集Agent',
  type: 'specialist',
  capabilities: {
    inputs: ['targetPlatforms', 'category', 'keywords'],
    outputs: ['marketData', 'competitorData', 'trendData'],
    tools: [
      'web-scraper',
      'api-connector',
      'data-cleaner',
      'rate-limiter'
    ]
  },
  promptConfig: {
    systemPrompt: `你是电商数据采集专家。你的任务是：
1. 从指定平台采集商品数据
2. 提取关键信息：价格、销量、评价、图片
3. 清洗和标准化数据
4. 遵守平台规则，控制采集频率

输出格式：JSON，包含以下字段：
- products: 商品列表
- statistics: 统计信息
- timestamp: 采集时间`,
    outputFormat: { type: 'json' }
  },
  executionConfig: {
    timeout: 120000,
    retryPolicy: { maxRetries: 3, retryInterval: 5000 }
  }
};

// 市场分析 Agent
const marketAnalystAgent: AgentDefinition = {
  agentId: 'market-analyst',
  name: '市场分析Agent',
  type: 'specialist',
  capabilities: {
    inputs: ['marketData', 'competitorData'],
    outputs: ['marketReport', 'insights', 'recommendations']
  },
  promptConfig: {
    systemPrompt: `你是市场分析专家。分析维度包括：
1. 市场趋势：增长/下降趋势
2. 需求分析：季节性、周期性
3. 竞争格局：集中度、主要玩家
4. 机会识别：蓝海市场、细分机会

分析要求：
- 数据驱动，引用具体数字
- 多维度交叉分析
- 给出可执行的建议`,
    outputFormat: { type: 'json' }
  }
};

// 定价策略 Agent
const pricingAgent: AgentDefinition = {
  agentId: 'pricing-agent',
  name: '定价策略Agent',
  type: 'specialist',
  capabilities: {
    inputs: ['cost', 'competitorPrices', 'targetMargin', 'priceElasticity'],
    outputs: ['recommendedPrice', 'priceRange', 'pricingStrategy']
  },
  promptConfig: {
    systemPrompt: `你是定价策略专家。制定定价策略时考虑：
1. 成本加成：确保目标利润率
2. 竞争定位：与竞品的关系
3. 价格弹性：对销量的影响
4. 心理定价：锚定效应、整数效应

输出：建议价格、价格区间、策略说明`,
    outputFormat: { type: 'json' }
  }
};
```

### 2.3 数据模型

```typescript
// 商品信息
interface Product {
  productId: string;
  name: string;
  description: string;
  category: ProductCategory;

  // 平台数据
  platformData: {
    [platform: string]: {
      platformId: string;
      url: string;
      price: Price;
      sales: SalesData;
      ratings: RatingData;
      lastUpdated: Date;
    };
  };

  // 分析结果
  analysis: {
    marketPosition: 'leader' | 'follower' | 'niche' | 'newcomer';
    competitiveness: number;  // 0-100
    priceElasticity: number;
    seasonality: SeasonalityPattern;
    trendDirection: 'up' | 'down' | 'stable';
  };

  // 选品评分
  selectionScore: {
    overall: number;
    dimensions: {
      profit: number;
      demand: number;
      competition: number;
      trend: number;
      risk: number;
    };
  };
}

// 竞品信息
interface Competitor {
  competitorId: string;
  name: string;
  platform: string;
  products: CompetitorProduct[];

  // 表现数据
  performance: {
    totalSales: number;
    avgPrice: number;
    rating: number;
    growthRate: number;
  };

  // 策略分析
  strategy: {
    positioning: string;
    pricingStrategy: string;
    marketingChannels: string[];
    strengths: string[];
    weaknesses: string[];
  };
}

// 定价策略
interface PricingStrategy {
  strategyId: string;
  productId: string;

  // 成本结构
  costStructure: {
    procurement: number;
    shipping: number;
    platform: number;
    marketing: number;
    other: number;
    total: number;
  };

  // 定价建议
  recommendations: {
    targetPrice: number;
    priceRange: { min: number; max: number };
    suggestedMargin: number;
    breakEvenVolume: number;
  };

  // 策略说明
  strategy: {
    type: 'penetration' | 'skimming' | 'competitive' | 'premium';
    rationale: string;
    risks: string[];
    contingencyPlans: string[];
  };

  // 动态调价规则
  dynamicPricingRules?: {
    condition: string;
    adjustment: number;  // 百分比
    priority: number;
  }[];
}
```

---

## 3. 自媒体运营模块

### 3.1 内容创作工作流

```typescript
const contentCreationWorkflow = {
  workflowId: 'content-creation',
  name: '内容创作工作流',
  description: '从选题到发布的完整内容创作流程',

  nodes: [
    {
      nodeId: 'topic-input',
      type: 'start',
      output: ['theme', 'targetPlatforms', 'contentType', 'deadline']
    },
    {
      nodeId: 'hot-topic-check',
      type: 'automatic',
      agentId: 'trend-monitor',
      dependencies: ['topic-input'],
      output: ['trendingTopics', 'recommendations']
    },
    {
      nodeId: 'content-planning',
      type: 'automatic',
      agentId: 'content-planner',
      dependencies: ['hot-topic-check'],
      config: {
        outputFormats: ['${input.contentType}'],
        angleSuggestions: 3
      },
      output: ['contentPlan', 'angles']
    },
    {
      nodeId: 'angle-selection-hitl',
      type: 'hitl',
      dependencies: ['content-planning'],
      config: {
        type: 'input',
        description: '请选择或修改内容角度',
        fields: [
          { name: 'selectedAngle', type: 'select', options: '${context.angles}' },
          { name: 'customizations', type: 'textarea' }
        ]
      }
    },
    {
      nodeId: 'content-generation',
      type: 'automatic',
      agentId: 'content-generator',
      dependencies: ['angle-selection-hitl'],
      config: {
        generateOptions: {
          titles: 5,
          outlines: 1,
          fullContent: true
        }
      },
      output: ['titles', 'outline', 'content']
    },
    {
      nodeId: 'media-generation',
      type: 'automatic',
      agentId: 'media-generator',
      dependencies: ['content-generation'],
      parallel: true,
      config: {
        generate: ['cover', 'illustrations', 'video-script']
      }
    },
    {
      nodeId: 'platform-adaptation',
      type: 'parallel',
      dependencies: ['content-generation', 'media-generation'],
      branches: [
        {
          name: 'douyin',
          nodes: ['adapt-douyin']
        },
        {
          name: 'xiaohongshu',
          nodes: ['adapt-xiaohongshu']
        },
        {
          name: 'weibo',
          nodes: ['adapt-weibo']
        }
      ]
    },
    {
      nodeId: 'content-review',
      type: 'hitl',
      dependencies: ['platform-adaptation'],
      config: {
        type: 'review',
        description: '请审核内容，可进行修改',
        checkItems: ['原创性', '合规性', '品牌调性']
      }
    },
    {
      nodeId: 'schedule-publish',
      type: 'automatic',
      agentId: 'publish-scheduler',
      dependencies: ['content-review'],
      config: {
        optimalTiming: true,
        crossPlatform: true
      }
    }
  ]
};
```

### 3.2 核心 Agent 定义

```typescript
// 热点监测 Agent
const trendMonitorAgent: AgentDefinition = {
  agentId: 'trend-monitor',
  name: '热点监测Agent',
  type: 'specialist',
  capabilities: {
    inputs: ['keywords', 'platforms', 'timeRange'],
    outputs: ['trendingTopics', 'trendAnalysis', 'alerts']
  },
  promptConfig: {
    systemPrompt: `你是社交媒体热点监测专家。任务是：
1. 监测各平台热搜、热门话题
2. 分析话题热度趋势
3. 评估话题与品牌的关联度
4. 识别可参与的热点机会

监测维度：
- 热度值（搜索量、讨论量）
- 趋势（上升/下降/稳定）
- 情感倾向（正面/负面/中性）
- 生命周期（萌芽/爆发/衰退）`,
    tools: ['social-listening', 'trend-api', 'sentiment-analyzer']
  }
};

// 内容生成 Agent
const contentGeneratorAgent: AgentDefinition = {
  agentId: 'content-generator',
  name: '内容生成Agent',
  type: 'specialist',
  capabilities: {
    inputs: ['topic', 'angle', 'platform', 'contentType', 'tone'],
    outputs: ['titles', 'content', 'hashtags', 'suggestions']
  },
  promptConfig: {
    systemPrompt: `你是资深内容创作者。创作要求：

1. 标题：吸引眼球，引发好奇，包含关键词
2. 开头：前3秒抓住注意力
3. 结构：清晰的小标题，逻辑流畅
4. 语言：符合平台调性，有网感
5. 结尾：引导互动（点赞/评论/关注）

平台适配：
- 抖音：口语化、节奏快、有钩子
- 小红书：真实感、干货多、emoji
- 微博：话题性、观点鲜明、互动性强`,
    outputFormat: { type: 'json' }
  }
};

// 多平台适配 Agent
const platformAdapterAgent: AgentDefinition = {
  agentId: 'platform-adapter',
  name: '平台适配Agent',
  type: 'specialist',
  capabilities: {
    inputs: ['content', 'sourcePlatform', 'targetPlatform'],
    outputs: ['adaptedContent', 'formatAdjustments']
  },
  promptConfig: {
    systemPrompt: `你是多平台内容适配专家。适配规则：

抖音：
- 字数：300-800字
- 风格：口语化、短句、有节奏
- 格式：段落短，多用换行
- 标签：3-5个相关标签

小红书：
- 字数：500-1500字
- 风格：真实分享、干货满满
- 格式：多分段，emoji点缀
- 标签：10-15个标签，含热门标签

微博：
- 字数：100-500字
- 风格：观点鲜明、引发讨论
- 格式：简洁有力
- 标签：2-3个核心话题标签`,
    outputFormat: { type: 'json' }
  }
};
```

### 3.3 数据模型

```typescript
// 内容计划
interface ContentPlan {
  planId: string;
  name: string;
  description: string;

  // 内容日历
  calendar: {
    date: Date;
    slots: ContentSlot[];
  }[];

  // 主题规划
  themes: {
    name: string;
    keywords: string[];
    targetPlatforms: string[];
    estimatedPublishDate: Date;
  }[];
}

interface ContentSlot {
  slotId: string;
  time: string;                 // 发布时间
  platform: string;
  contentType: 'post' | 'video' | 'article' | 'story';
  status: 'planned' | 'creating' | 'reviewing' | 'scheduled' | 'published';
  contentId?: string;
}

// 内容作品
interface Content {
  contentId: string;
  type: 'post' | 'video' | 'article';

  // 基础信息
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  mediaUrls: string[];

  // 平台版本
  platformVersions: {
    [platform: string]: {
      adaptedContent: string;
      hashtags: string[];
      mentions: string[];
      scheduledTime?: Date;
      publishedTime?: Date;
      status: string;
      url?: string;
    };
  };

  // 分析数据
  analytics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clickThroughRate: number;
    engagementRate: number;
  };

  // AI 生成信息
  generationInfo: {
    originalTopic: string;
    selectedAngle: string;
    generationParams: Record<string, any>;
    humanEdits: EditRecord[];
  };
}

// 热点话题
interface HotTopic {
  topicId: string;
  name: string;
  keywords: string[];

  // 热度数据
  heat: {
    score: number;              // 热度分 0-100
    searchVolume: number;
    discussionVolume: number;
    trendingPlatforms: string[];
  };

  // 趋势
  trend: {
    direction: 'rising' | 'stable' | 'falling';
    growthRate: number;         // 增长率
    predictedPeak?: Date;
    lifecycle: 'emerging' | 'peaking' | 'declining';
  };

  // 情感分析
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    distribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };

  // 关联建议
  recommendations: {
    relevanceScore: number;     // 与品牌的关联度
    suggestedAngles: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
}
```

---

## 4. 集成接口

### 4.1 电商平台接口

```typescript
// 商品分析
interface ProductAnalysisAPI {
  // POST /api/v1/ecommerce/products/analyze
  analyzeProduct(request: {
    productUrl?: string;
    productInfo?: ProductInfoInput;
    analysisTypes: AnalysisType[];
    platforms: string[];
  }): Promise<{
    executionId: string;
    estimatedTime: number;
  }>;

  // GET /api/v1/ecommerce/products/analysis/{executionId}
  getAnalysisResult(executionId: string): Promise<ProductAnalysisResult>;

  // GET /api/v1/ecommerce/competitors
  listCompetitors(query: {
    category?: string;
    platform?: string;
    page?: number;
  }): Promise<Competitor[]>;

  // POST /api/v1/ecommerce/pricing/recommend
  getPricingRecommendation(request: {
    productId: string;
    targetMargin: number;
    strategy: PricingStrategyType;
  }): Promise<PricingStrategy>;
}
```

### 4.2 自媒体平台接口

```typescript
// 内容创作
interface ContentCreationAPI {
  // POST /api/v1/content/create
  createContent(request: {
    topic: string;
    contentType: ContentType;
    platforms: string[];
    style?: string;
    tone?: string;
    hitlReview?: boolean;
  }): Promise<{
    executionId: string;
    status: string;
  }>;

  // GET /api/v1/content/trending
  getTrendingTopics(query: {
    platforms?: string[];
    category?: string;
    timeRange?: TimeRange;
  }): Promise<HotTopic[]>;

  // POST /api/v1/content/publish
  publishContent(request: {
    contentId: string;
    platforms: string[];
    schedule?: Date;
    hitlApproval?: boolean;
  }): Promise<{
    publishJobs: PublishJob[];
  }>>;

  // GET /api/v1/content/analytics
  getContentAnalytics(query: {
    contentIds?: string[];
    dateRange?: DateRange;
    platforms?: string[];
  }): Promise<ContentAnalytics>;
}
```

---

## 5. HITL 集成点

### 5.1 电商模块 HITL

| 节点 | 触发条件 | 审批人 | 操作 |
|------|----------|--------|------|
| 定价确认 | 利润率<25% | 品类经理 | 批准/修改/拒绝 |
| 选品审核 | 风险评分>7 | 运营总监 | 批准/拒绝 |
| 库存预警 | 库存<安全线 | 采购经理 | 确认补货 |
| 竞品报告 | 涉及核心竞品 | 市场经理 | 审核发布 |

### 5.2 自媒体模块 HITL

| 节点 | 触发条件 | 审批人 | 操作 |
|------|----------|--------|------|
| 角度选择 | 所有创作 | 内容运营 | 选择/修改 |
| 内容审核 | 所有生成内容 | 品牌经理 | 批准/修改/拒绝 |
| 热点追投 | 预算>1000 | 营销总监 | 批准/调整 |
| 危机内容 | 情感负面>70% | 公关经理 | 确认/撤回 |

---

## 6. 附录

### 6.1 平台支持列表

| 平台 | 电商功能 | 自媒体功能 |
|------|----------|------------|
| 淘宝/天猫 | 商品分析、订单管理 | 内容发布、直播 |
| 京东 | 商品分析、库存管理 | 内容发布 |
| 拼多多 | 商品分析 | 内容发布 |
| 抖音 | 商品分析、直播数据 | 视频发布、直播 |
| 小红书 | - | 笔记发布、种草 |
| 微信 | - | 公众号、视频号 |
| 微博 | - | 博文发布 |

### 6.2 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-10 | 初始版本 |
