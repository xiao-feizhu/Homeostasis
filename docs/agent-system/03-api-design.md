# 增强型 Agent 系统 - API 接口设计文档

**版本**: v1.0
**日期**: 2026-03-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 设计原则

1. **RESTful 设计**: 使用标准 HTTP 方法和状态码
2. **版本控制**: URL 路径包含版本号 `/api/v1/...`
3. **一致性**: 统一的请求/响应格式
4. **幂等性**: 关键操作支持幂等（使用 Idempotency-Key）
5. **安全性**: 全链路 HTTPS，敏感操作需二次验证

### 1.2 基础信息

**Base URL**: `https://api.agent-system.com`

**认证方式**:
- Header: `Authorization: Bearer {jwt_token}`
- 可选: `X-API-Key: {api_key}`

---

## 2. 通用规范

### 2.1 标准响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationInfo;
  };
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### 2.2 标准 HTTP 状态码

| 状态码 | 使用场景 |
|--------|----------|
| 200 | GET/PUT/PATCH 成功 |
| 201 | POST 创建成功 |
| 204 | DELETE 成功（无返回体）|
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复创建）|
| 422 | 业务逻辑验证失败 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 2.3 错误码规范

| 错误码 | 说明 |
|--------|------|
| `AUTH_001` | Token 无效或过期 |
| `AUTH_002` | 无操作权限 |
| `VALID_001` | 参数验证失败 |
| `VALID_002` | 缺少必填参数 |
| `WF_001` | 工作流不存在 |
| `WF_002` | 工作流执行失败 |
| `WF_003` | 工作流版本冲突 |
| `AGENT_001` | Agent 未找到 |
| `AGENT_002` | Agent 调用超时 |
| `AGENT_003` | Agent 调用频率超限 |
| `HITL_001` | 断点不存在或已过期 |
| `HITL_002` | 无审批权限 |
| `HITL_003` | 断点已处理 |
| `MEMORY_001` | 记忆检索失败 |
| `EMOTION_001` | 情感分析失败 |
| `SYSTEM_001` | 系统内部错误 |

---

## 3. 工作流管理 API

### 3.1 工作流定义管理

#### 创建工作流
```http
POST /api/v1/workflows
```

**请求体**:
```typescript
interface CreateWorkflowRequest {
  name: string;                          // 工作流名称
  description?: string;                  // 描述
  nodes: WorkflowNodeInput[];            // 节点定义
  variables?: WorkflowVariableInput[];   // 变量定义
  trigger?: WorkflowTriggerInput;        // 触发器配置
  hitlConfig?: HITLGlobalConfigInput;    // HITL 全局配置
  tags?: string[];                       // 标签
  metadata?: Record<string, any>;        // 元数据
}

interface WorkflowNodeInput {
  nodeId: string;
  name: string;
  description?: string;
  type: 'automatic' | 'manual' | 'hitl' | 'parallel' | 'condition';
  agentConfig?: AgentConfigInput;
  dependencies?: string[];               // 前置节点ID
  inputMapping?: Record<string, string>; // 参数映射
  outputMapping?: Record<string, string>;
  retryPolicy?: RetryPolicyInput;
  timeout?: number;                      // ms
  hitlConfig?: NodeHITLConfigInput;
  errorHandling?: ErrorHandlingInput;
  condition?: ConditionConfigInput;      // 条件节点配置
}

interface AgentConfigInput {
  agentId: string;
  modelConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

interface RetryPolicyInput {
  maxRetries?: number;       // 默认 3
  retryInterval?: number;    // 默认 1000ms
  backoffMultiplier?: number; // 默认 2
}

interface NodeHITLConfigInput {
  enabled: boolean;
  type?: 'approval' | 'review' | 'input' | 'escalation';
  condition?: string;        // 触发条件表达式
  approvers?: string[];      // 审批人ID列表
  timeout?: number;          // 分钟
  escalationRule?: {
    enabled: boolean;
    escalateTo?: string;
    afterMinutes?: number;
  };
}
```

**响应**:
```typescript
interface CreateWorkflowResponse {
  workflowId: string;
  name: string;
  version: string;
  status: 'draft';
  createdAt: string;
}
```

#### 获取工作流列表
```http
GET /api/v1/workflows
```

**查询参数**:
```typescript
interface ListWorkflowsQuery {
  page?: number;           // 默认 1
  pageSize?: number;       // 默认 20, 最大 100
  status?: 'draft' | 'active' | 'deprecated';
  tags?: string[];         // 标签筛选
  search?: string;         // 名称搜索
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}
```

**响应**:
```typescript
interface ListWorkflowsResponse {
  workflows: WorkflowSummary[];
  pagination: PaginationInfo;
}

interface WorkflowSummary {
  workflowId: string;
  name: string;
  description?: string;
  status: string;
  version: string;
  nodeCount: number;
  stats: {
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

#### 获取工作流详情
```http
GET /api/v1/workflows/{workflowId}
```

**响应**: 完整 WorkflowDefinition 对象

#### 更新工作流
```http
PUT /api/v1/workflows/{workflowId}
```

**请求体**: CreateWorkflowRequest（完整替换）

**说明**: 更新会创建新版本，原有版本保留

#### 删除工作流
```http
DELETE /api/v1/workflows/{workflowId}
```

**查询参数**:
- `force`: boolean - 是否强制删除（即使有执行记录）

#### 激活/停用工作流
```http
POST /api/v1/workflows/{workflowId}/activate
POST /api/v1/workflows/{workflowId}/deactivate
```

#### 克隆工作流
```http
POST /api/v1/workflows/{workflowId}/clone
```

**请求体**:
```typescript
interface CloneWorkflowRequest {
  name?: string;           // 新名称，默认原名称+"Copy"
  ownerId?: string;        // 新所有者
}
```

### 3.2 工作流执行管理

#### 执行工作流
```http
POST /api/v1/workflows/{workflowId}/execute
```

**请求头**:
- `Idempotency-Key`: string - 幂等键（防止重复执行）

**请求体**:
```typescript
interface ExecuteWorkflowRequest {
  input: Record<string, any>;           // 输入参数
  context?: Record<string, any>;        // 执行上下文
  hitlEnabled?: boolean;                // 是否启用 HITL
  callbackUrl?: string;                 // 完成回调
  priority?: 'low' | 'normal' | 'high' | 'urgent';  // 执行优先级
  timeout?: number;                     // 总超时时间（秒）
}
```

**响应**:
```typescript
interface ExecuteWorkflowResponse {
  executionId: string;
  status: 'pending' | 'running';
  estimatedCompletionTime?: string;
  websocketUrl?: string;    // 实时状态推送地址
}
```

#### 获取执行列表
```http
GET /api/v1/workflows/executions
```

**查询参数**:
```typescript
interface ListExecutionsQuery {
  workflowId?: string;
  status?: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  userId?: string;
  startTime?: string;      // ISO 8601
  endTime?: string;
  page?: number;
  pageSize?: number;
}
```

#### 获取执行详情
```http
GET /api/v1/workflows/executions/{executionId}
```

**响应**:
```typescript
interface WorkflowExecutionDetail {
  executionId: string;
  workflowId: string;
  workflowName: string;
  status: string;
  progress: number;         // 0-100
  input: Record<string, any>;
  output?: Record<string, any>;
  context: Record<string, any>;
  currentNodeId?: string;
  nodes: NodeExecutionDetail[];
  timing: {
    scheduledAt: string;
    startedAt?: string;
    completedAt?: string;
    totalDuration?: number;
  };
  error?: ExecutionError;
  breakpointIds: string[];
}

interface NodeExecutionDetail {
  nodeId: string;
  nodeName: string;
  status: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: ExecutionError;
  retryCount: number;
  hitlBreakpointId?: string;
}
```

#### 取消执行
```http
POST /api/v1/workflows/executions/{executionId}/cancel
```

**请求体**:
```typescript
interface CancelExecutionRequest {
  reason?: string;
  force?: boolean;         // 强制取消（即使正在执行）
}
```

#### 重试失败节点
```http
POST /api/v1/workflows/executions/{executionId}/retry
```

**请求体**:
```typescript
interface RetryExecutionRequest {
  nodeId?: string;         // 指定节点重试，不传则重试所有失败节点
  resetContext?: boolean;  // 是否重置上下文
}
```

---

## 4. HITL API

### 4.1 断点管理

#### 获取待处理断点
```http
GET /api/v1/hitl/pending
```

**查询参数**:
```typescript
interface ListPendingBreakpointsQuery {
  type?: 'approval' | 'review' | 'input' | 'escalation';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  executionId?: string;
  urgent?: boolean;        // 即将超时
  page?: number;
  pageSize?: number;
}
```

**响应**:
```typescript
interface ListPendingBreakpointsResponse {
  breakpoints: BreakpointSummary[];
  stats: {
    total: number;
    urgent: number;        // 1小时内到期
    byType: Record<string, number>;
  };
  pagination: PaginationInfo;
}

interface BreakpointSummary {
  breakpointId: string;
  executionId: string;
  workflowName: string;
  nodeName: string;
  type: string;
  priority: string;
  status: string;
  deadline: string;
  preview: {
    title: string;
    description: string;
  };
  createdAt: string;
}
```

#### 获取断点详情
```http
GET /api/v1/hitl/breakpoints/{breakpointId}
```

**响应**:
```typescript
interface BreakpointDetail {
  breakpointId: string;
  executionId: string;
  workflowId: string;
  workflowName: string;
  nodeId: string;
  nodeName: string;
  type: string;
  priority: string;
  status: string;
  context: {
    input: Record<string, any>;
    output?: Record<string, any>;
    logs: string[];
    executionPath: string[];
    preview: {
      title: string;
      description: string;
      data: Record<string, any>;
      attachments: Attachment[];
    };
  };
  approverConfig: {
    requiredApprovals: number;
    currentApprovals: number;
    approvers: ApproverInfo[];
  };
  approvals: ApprovalRecord[];
  deadline: string;
  timeRemaining: number;    // 剩余秒数
  escalation?: EscalationInfo;
  createdAt: string;
}

interface ApproverInfo {
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

#### 处理断点（审批/拒绝/修改）
```http
POST /api/v1/hitl/breakpoints/{breakpointId}/resolve
```

**请求体**:
```typescript
interface ResolveBreakpointRequest {
  decision: 'approve' | 'reject' | 'modify' | 'comment';
  comment?: string;
  modifications?: Record<string, any>;  // 修改后的参数
  delegateTo?: string;                  // 转交给其他人
}

// approve - 批准继续执行
// reject - 拒绝，执行失败处理
// modify - 修改参数后继续
// comment - 仅评论，不改变状态
```

**响应**:
```typescript
interface ResolveBreakpointResponse {
  breakpointId: string;
  status: string;
  executionId: string;
  nextAction: 'continue' | 'rollback' | 'fail';
}
```

#### 批量处理断点
```http
POST /api/v1/hitl/breakpoints/batch-resolve
```

**请求体**:
```typescript
interface BatchResolveRequest {
  breakpointIds: string[];
  decision: 'approve' | 'reject';
  comment?: string;
}
```

### 4.2 实时干预

#### 暂停执行
```http
POST /api/v1/hitl/executions/{executionId}/pause
```

#### 恢复执行
```http
POST /api/v1/hitl/executions/{executionId}/resume
```

#### 跳过当前节点
```http
POST /api/v1/hitl/executions/{executionId}/skip
```

**请求体**:
```typescript
interface SkipNodeRequest {
  nodeId?: string;              // 不传则跳过当前节点
  useFallback?: boolean;        // 使用默认值
  fallbackValue?: any;          // 指定回退值
}
```

#### 修改参数重试
```http
POST /api/v1/hitl/executions/{executionId}/retry-with-modifications
```

**请求体**:
```typescript
interface RetryWithModificationsRequest {
  nodeId: string;
  modifications: Record<string, any>;
  resetFromNode?: boolean;      // 从该节点重新开始
}
```

#### 回滚执行
```http
POST /api/v1/hitl/executions/{executionId}/rollback
```

**请求体**:
```typescript
interface RollbackExecutionRequest {
  targetNodeId: string;         // 回滚到指定节点
  preserveContext?: boolean;    // 保留当前上下文
}
```

### 4.3 审批流管理

#### 创建审批流模板
```http
POST /api/v1/hitl/approval-flows
```

**请求体**:
```typescript
interface CreateApprovalFlowRequest {
  name: string;
  description?: string;
  mode: 'sequential' | 'parallel' | 'any';  // 顺序/并行/或签
  steps: ApprovalStepInput[];
}

interface ApprovalStepInput {
  order: number;
  name: string;
  approvers: string[];          // 审批人ID
  approverRoles?: string[];     // 或按角色
  condition?: string;           // 触发条件
  timeout: number;              // 分钟
  escalationRule?: {
    enabled: boolean;
    escalateTo: string;
    afterMinutes: number;
  };
}
```

#### 应用审批流到工作流
```http
POST /api/v1/workflows/{workflowId}/approval-flows/{flowId}/bind
```

**请求体**:
```typescript
interface BindApprovalFlowRequest {
  nodeIds: string[];            // 应用到哪些节点
  condition?: string;           // 触发条件
}
```

---

## 5. Agent 管理 API

### 5.1 Agent 定义管理

#### 获取 Agent 列表
```http
GET /api/v1/agents
```

**查询参数**:
```typescript
interface ListAgentsQuery {
  type?: 'planner' | 'executor' | 'reviewer' | 'coordinator' | 'specialist';
  status?: 'active' | 'inactive';
  capabilities?: string[];      // 能力筛选
  search?: string;
  page?: number;
  pageSize?: number;
}
```

**响应**:
```typescript
interface ListAgentsResponse {
  agents: AgentSummary[];
  pagination: PaginationInfo;
}

interface AgentSummary {
  agentId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  capabilities: string[];
  stats: {
    totalInvocations: number;
    successRate: number;
    avgExecutionTime: number;
  };
  lastInvokedAt?: string;
}
```

#### 获取 Agent 详情
```http
GET /api/v1/agents/{agentId}
```

**响应**: 完整 AgentDefinition

#### 注册 Agent
```http
POST /api/v1/agents
```

**请求体**: AgentDefinitionInput

#### 更新 Agent
```http
PUT /api/v1/agents/{agentId}
```

#### 注销 Agent
```http
DELETE /api/v1/agents/{agentId}
```

### 5.2 Agent 调用

#### 直接调用 Agent
```http
POST /api/v1/agents/{agentId}/invoke
```

**请求体**:
```typescript
interface InvokeAgentRequest {
  input: Record<string, any>;
  context?: {
    sessionId?: string;
    userId?: string;
    executionId?: string;
  };
  streaming?: boolean;          // 是否流式返回
  timeout?: number;
}
```

**响应（非流式）**:
```typescript
interface InvokeAgentResponse {
  output: Record<string, any>;
  executionTime: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: string;
}
```

**流式响应**: SSE (Server-Sent Events)
```
event: delta
data: {"content": "部分输出", "isComplete": false}

event: complete
data: {"content": "完整输出", "tokenUsage": {...}}
```

### 5.3 规划 Agent

#### 分析需求并生成工作流方案
```http
POST /api/v1/agents/plan
```

**请求体**:
```typescript
interface PlanRequest {
  userInput: string;            // 用户需求描述
  context?: {
    userId?: string;
    sessionId?: string;
    availableWorkflows?: string[];
  };
  constraints?: {
    maxNodes?: number;
    requiredAgents?: string[];
    timeLimit?: number;
    costLimit?: number;
  };
}
```

**响应**:
```typescript
interface PlanResponse {
  planId: string;
  analysis: {
    intent: string;
    entities: Entity[];
    complexity: 'simple' | 'medium' | 'complex';
    estimatedTime: number;
    estimatedCost: number;
  };
  workflowProposal: {
    name: string;
    description: string;
    nodes: PlannedNode[];
    requiredApprovals: string[];
  };
  alternativePlans?: PlannedWorkflow[];
  confidence: number;
  explanation: string;
}

interface PlannedNode {
  nodeId: string;
  name: string;
  description: string;
  agentId: string;
  purpose: string;
  dependencies: string[];
  estimatedTime: number;
  requiresHitl: boolean;
}
```

#### 确认并创建工作流
```http
POST /api/v1/agents/plan/{planId}/confirm
```

**请求体**:
```typescript
interface ConfirmPlanRequest {
  modifications?: {
    nodeChanges?: NodeModification[];
    addHitlNodes?: string[];
    removeNodes?: string[];
  };
  executeImmediately?: boolean;
  input?: Record<string, any>;
}
```

---

## 6. 增强系统 API

### 6.1 情感反馈系统

#### 分析情感状态
```http
POST /api/v1/emotion/analyze
```

**请求体**:
```typescript
interface AnalyzeEmotionRequest {
  sessionId: string;
  userId: string;
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  context?: MessageContext[];
}

interface MessageContext {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

**响应**:
```typescript
interface AnalyzeEmotionResponse {
  emotion: {
    satisfaction: number;     // 0-100
    trust: number;
    frustration: number;
    urgency: number;
    engagement: number;
  };
  strategy: {
    tone: string;
    pace: string;
    detail: string;
    proactivity: string;
  };
  shouldEscalate: boolean;
  suggestedActions: string[];
  confidence: number;
}
```

#### 获取用户情感画像
```http
GET /api/v1/emotion/profiles/{userId}
```

**响应**:
```typescript
interface EmotionProfileResponse {
  userId: string;
  baselineEmotion: EmotionMetrics;
  emotionCharacteristics: {
    volatility: number;
    trend: string;
    triggerSensitivity: Record<string, number>;
  };
  interactionPreferences: {
    preferredTone: string;
    preferredPace: string;
    preferredDetail: string;
    preferredProactivity: string;
  };
  sensitiveTopics: string[];
  recentHistory: EmotionHistoryRecord[];
  stats: {
    totalInteractions: number;
    positiveRate: number;
    escalationsCount: number;
  };
}
```

### 6.2 记忆系统

#### 检索记忆
```http
POST /api/v1/memory/retrieve
```

**请求体**:
```typescript
interface RetrieveMemoryRequest {
  query: string;
  userId: string;
  sessionId?: string;
  types?: ('short_term' | 'long_term' | 'semantic')[];
  topK?: number;                // 默认 5
  filters?: {
    timeRange?: { start: string; end: string };
    topics?: string[];
    minConfidence?: number;
  };
}
```

**响应**:
```typescript
interface RetrieveMemoryResponse {
  memories: RetrievedMemory[];
  queryEmbedding?: number[];
  retrievalTime: number;
}

interface RetrievedMemory {
  memoryId: string;
  type: string;
  content: string;
  relevanceScore: number;
  timestamp?: string;
  metadata?: Record<string, any>;
}
```

#### 保存记忆
```http
POST /api/v1/memory/save
```

**请求体**:
```typescript
interface SaveMemoryRequest {
  userId: string;
  type: 'fact' | 'preference' | 'event' | 'feedback';
  content: string;
  confidence?: number;
  source?: string;
  metadata?: Record<string, any>;
}
```

### 6.3 提示词增强系统

#### 组装提示词
```http
POST /api/v1/prompt/assemble
```

**请求体**:
```typescript
interface AssemblePromptRequest {
  templateId: string;
  variables: Record<string, any>;
  userId?: string;
  sessionId?: string;
  context?: {
    enableRAG?: boolean;
    ragQuery?: string;
    enableEmotion?: boolean;
    enableMemory?: boolean;
  };
}
```

**响应**:
```typescript
interface AssemblePromptResponse {
  prompt: string;
  usedTemplates: string[];
  ragContext?: RetrievedMemory[];
  memoryContext?: string;
  emotionContext?: string;
  tokenCount: number;
}
```

### 6.4 虚拟形象系统

#### 获取形象列表
```http
GET /api/v1/avatars
```

**查询参数**:
- `type`: 2d | 3d | photo_realistic
- `scene`: 适用场景

#### 生成语音+动画
```http
POST /api/v1/avatars/{avatarId}/speak
```

**请求体**:
```typescript
interface AvatarSpeakRequest {
  text: string;
  emotion?: string;             // 情绪表达
  animation?: string;           // 指定动画
  streaming?: boolean;          // 流式返回
}
```

**响应**:
- 非流式: `{ audioUrl: string, lipSyncData: any, duration: number }`
- 流式: SSE 返回音频片段和唇形数据

#### 创建会话
```http
POST /api/v1/avatars/sessions
```

**请求体**:
```typescript
interface CreateAvatarSessionRequest {
  avatarId: string;
  userId: string;
  scene?: string;
}
```

**响应**:
```typescript
interface CreateAvatarSessionResponse {
  sessionId: string;
  websocketUrl: string;         // WebSocket 连接地址
  iceServers: RTCIceServer[];   // WebRTC 配置（如需要）
}
```

---

## 7. 业务模块 API

### 7.1 电商运营

#### 商品分析
```http
POST /api/v1/ecommerce/products/analyze
```

**请求体**:
```typescript
interface ProductAnalysisRequest {
  productUrl?: string;
  productInfo?: {
    name: string;
    description: string;
    category: string;
    price: number;
    images?: string[];
  };
  analysisType: ('competitor' | 'pricing' | 'trend' | 'all')[];
  platforms?: string[];         // 分析哪些平台
}
```

**响应**: 异步返回 executionId

#### 获取选品推荐
```http
GET /api/v1/ecommerce/products/recommendations
```

**查询参数**:
- `category`: 品类
- `priceRange`: 价格区间
- `platforms`: 目标平台

### 7.2 自媒体运营

#### 内容创作
```http
POST /api/v1/content/create
```

**请求体**:
```typescript
interface ContentCreateRequest {
  topic: string;
  contentType: 'article' | 'video_script' | 'post' | 'title';
  platforms: string[];
  style?: string;
  keywords?: string[];
  length?: 'short' | 'medium' | 'long';
  tone?: string;
  hitlReview?: boolean;         // 是否需要人工审核
}
```

**响应**:
```typescript
interface ContentCreateResponse {
  executionId: string;
  status: string;
  estimatedTime: number;
  preview?: {
    title?: string;
    outline?: string[];
  };
}
```

#### 热点发现
```http
GET /api/v1/content/trending
```

**查询参数**:
- `platforms`: 平台筛选
- `category`: 内容分类
- `timeRange`: 时间范围

#### 发布内容
```http
POST /api/v1/content/publish
```

**请求体**:
```typescript
interface PublishRequest {
  contentId: string;
  platforms: string[];
  schedule?: string;            // 定时发布
  accountIds?: string[];
  hitlApproval?: boolean;       // 发布前人工确认
}
```

---

## 8. WebSocket API

### 8.1 工作流实时状态

**连接**: `wss://api.agent-system.com/ws/executions/{executionId}`

**认证**: 连接时携带 JWT Token

```javascript
const ws = new WebSocket('wss://api.agent-system.com/ws/executions/{executionId}', [], {
  headers: { Authorization: 'Bearer {token}' }
});
```

**消息类型**:

```typescript
// 服务器 -> 客户端
interface WorkflowStatusMessage {
  type: 'status_update' | 'node_started' | 'node_completed' | 'hitl_breakpoint' | 'completed' | 'error';
  timestamp: string;
  payload: {
    executionId: string;
    status?: string;
    currentNodeId?: string;
    progress?: number;
    nodeExecution?: NodeExecutionDetail;
    breakpointId?: string;
    error?: ExecutionError;
  };
}

// 客户端 -> 服务器
interface ClientMessage {
  type: 'ping' | 'request_intervention';
  payload?: Record<string, any>;
}
```

### 8.2 数字人会话

**连接**: `wss://api.agent-system.com/ws/avatar-sessions/{sessionId}`

**消息类型**:
- `audio_chunk`: 音频片段
- `lip_sync`: 唇形同步数据
- `emotion_update`: 表情更新
- `state_change`: 状态变更

---

## 9. 附录

### 9.1 Postman 集合

建议创建以下集合：
1. Workflow Management
2. HITL Operations
3. Agent Management
4. Enhancement Systems
5. Business Modules

### 9.2 SDK 示例

```typescript
// TypeScript SDK 示例
import { AgentSystemClient } from '@agent-system/sdk';

const client = new AgentSystemClient({
  baseURL: 'https://api.agent-system.com',
  apiKey: 'your-api-key'
});

// 执行工作流
const execution = await client.workflows.execute('wf-123', {
  input: { query: '分析夏季女装T恤选品' },
  hitlEnabled: true
});

// 监听实时状态
client.workflows.watch(execution.executionId, {
  onStatusChange: (status) => console.log(status),
  onBreakpoint: (breakpoint) => {
    // 弹出审批UI
  }
});
```

### 9.3 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-10 | 初始版本 |
