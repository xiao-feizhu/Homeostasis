/**
 * 工作流定义实体
 * 描述工作流的结构、节点和配置
 */

export enum NodeType {
  START = 'start',
  END = 'end',
  LLM = 'llm',
  API = 'api',
  CODE = 'code',
  CONDITION = 'condition',
  LOOP = 'loop',
  PARALLEL = 'parallel',
  SUBFLOW = 'subflow',
  HITL = 'hitl',
  EVENT = 'event',
  TIMER = 'timer',
  CUSTOM = 'custom'
}

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived'
}

export interface WorkflowNode {
  nodeId: string;
  name: string;
  type: NodeType;
  description?: string;

  /** 前置依赖节点ID列表 */
  dependencies: string[];

  /** 后置节点ID列表 */
  dependents: string[];

  /** 节点配置 */
  config?: Record<string, any>;

  /** 输入参数映射 */
  inputMapping?: Record<string, string>;

  /** 输出参数映射 */
  outputMapping?: Record<string, string>;

  /** 重试策略 */
  retryPolicy?: {
    maxRetries: number;
    retryInterval: number;
    backoffMultiplier: number;
  };

  /** 超时时间（毫秒） */
  timeout?: number;

  /** 错误处理策略 */
  errorHandling?: {
    strategy: 'fail' | 'retry' | 'skip' | 'rollback' | 'continue';
    rollbackTarget?: string;
    fallbackValue?: any;
  };

  /** 执行条件 */
  condition?: {
    expression: string;
    trueBranch?: string;
    falseBranch?: string;
  };
}

export interface WorkflowEdge {
  /** 源节点ID */
  from: string;

  /** 目标节点ID */
  to: string;

  /** 条件表达式 */
  condition?: string;

  /** 边类型 */
  type: 'normal' | 'error' | 'fallback';
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface WorkflowDefinition {
  workflowId: string;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  ownerId: string;
  tags?: string[];

  /** 节点列表 */
  nodes: WorkflowNode[];

  /** 边列表（依赖关系） */
  edges?: WorkflowEdge[];

  /** 变量定义 */
  variables?: WorkflowVariable[];

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;

  /** Schema 版本 */
  schemaVersion: number;
}

/**
 * 工作流执行实例
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ROLLED_BACK = 'rolled_back'
}

export enum NodeExecutionStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  ROLLED_BACK = 'rolled_back'
}

export interface NodeExecution {
  nodeId: string;
  nodeName: string;
  status: NodeExecutionStatus;

  /** 计划执行时间 */
  scheduledAt?: Date;

  /** 开始执行时间 */
  startedAt?: Date;

  /** 执行完成时间 */
  completedAt?: Date;

  /** 输入参数 */
  input?: any;

  /** 输出结果 */
  output?: any;

  /** 错误信息 */
  error?: {
    code: string;
    message: string;
    stack?: string;
  };

  /** 重试次数 */
  retryCount: number;

  /** 执行日志 */
  logs?: string[];
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  userId: string;
  status: ExecutionStatus;

  /** 执行上下文（变量值） */
  context: Record<string, any>;

  /** 节点执行记录 */
  nodeExecutions: NodeExecution[];

  /** 当前节点ID */
  currentNodeId?: string;

  /** 执行路径 */
  executionPath: string[];

  /** 输入参数 */
  input?: Record<string, any>;

  /** 输出结果 */
  output?: Record<string, any>;

  /** 错误信息 */
  error?: {
    code: string;
    message: string;
    failedNodeId?: string;
  };

  /** 时间记录 */
  timing: {
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
  };

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 工作流事件（事件溯源）
 */
export enum WorkflowEventType {
  EXECUTION_SCHEDULED = 'execution.scheduled',
  EXECUTION_STARTED = 'execution.started',
  EXECUTION_COMPLETED = 'execution.completed',
  EXECUTION_FAILED = 'execution.failed',
  EXECUTION_CANCELLED = 'execution.cancelled',
  EXECUTION_PAUSED = 'execution.paused',
  EXECUTION_RESUMED = 'execution.resumed',

  NODE_SCHEDULED = 'node.scheduled',
  NODE_STARTED = 'node.started',
  NODE_COMPLETED = 'node.completed',
  NODE_FAILED = 'node.failed',
  NODE_SKIPPED = 'node.skipped',
  NODE_RETRIED = 'node.retried',
  NODE_ROLLED_BACK = 'node.rolled_back',

  CONTEXT_UPDATED = 'context.updated',

  // HITL Events
  BREAKPOINT_HIT = 'hitl.breakpoint.hit',
  BREAKPOINT_RESOLVED = 'hitl.breakpoint.resolved',
  BREAKPOINT_CANCELLED = 'hitl.breakpoint.cancelled',
  BREAKPOINT_ESCALATED = 'hitl.breakpoint.escalated',
  BREAKPOINT_EXPIRED = 'hitl.breakpoint.expired',

  APPROVAL_SUBMITTED = 'hitl.approval.submitted',
  APPROVAL_COMPLETED = 'hitl.approval.completed',

  INTERVENTION_PERFORMED = 'hitl.intervention.performed'
}

export interface WorkflowEvent {
  eventId: string;
  eventType: WorkflowEventType;
  executionId: string;
  workflowId: string;
  timestamp: Date;
  version: number;

  payload: {
    nodeId?: string;
    status?: string;
    input?: any;
    output?: any;
    error?: any;
    context?: Record<string, any>;
  };

  metadata: {
    correlationId: string;
    userId?: string;
  };
}
