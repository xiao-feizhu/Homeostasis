/**
 * HITL (Human-in-the-Loop) 实体定义
 * 支持断点管理、审批工作流和实时干预
 */

/**
 * 断点类型
 */
export enum BreakpointType {
  /** 审批型：需要人工批准才能继续 */
  APPROVAL = 'approval',

  /** 审阅型：需人工查看确认，可修改 */
  REVIEW = 'review',

  /** 输入型：需要人工提供输入 */
  INPUT = 'input',

  /** 升级型：自动触发，需更高级别处理 */
  ESCALATION = 'escalation',

  /** 错误解决型：执行错误，需人工介入 */
  ERROR_RESOLUTION = 'error_resolution'
}

/**
 * 断点触发模式
 */
export enum BreakpointTriggerMode {
  /** 静态断点：工作流定义时配置 */
  STATIC = 'static',

  /** 动态断点：运行时根据条件触发 */
  DYNAMIC = 'dynamic',

  /** 手动断点：运行时人工插入 */
  MANUAL = 'manual'
}

/**
 * 断点状态
 */
export enum BreakpointStatus {
  /** 待处理 */
  PENDING = 'pending',

  /** 审批中 */
  IN_REVIEW = 'in_review',

  /** 已升级 */
  ESCALATED = 'escalated',

  /** 已过期 */
  EXPIRED = 'expired',

  /** 超时关闭 */
  TIMEOUT = 'timeout',

  /** 已解决 */
  RESOLVED = 'resolved',

  /** 已批准 */
  APPROVED = 'approved',

  /** 已拒绝 */
  REJECTED = 'rejected',

  /** 已修改 */
  MODIFIED = 'modified',

  /** 已取消 */
  CANCELLED = 'cancelled'
}

/**
 * 审批模式
 */
export enum ApprovalMode {
  /** 或签：任意一人审批通过即生效 */
  ANY = 'any',

  /** 会签：所有人必须审批通过 */
  ALL = 'all',

  /** 顺序签：按顺序审批 */
  SEQUENTIAL = 'sequential',

  /** 投票：达到设定票数即通过 */
  VOTE = 'vote'
}

/**
 * 干预操作类型
 */
export enum InterventionAction {
  /** 暂停执行 */
  PAUSE = 'pause',

  /** 恢复执行 */
  RESUME = 'resume',

  /** 跳过当前/指定节点 */
  SKIP = 'skip',

  /** 重试当前/指定节点 */
  RETRY = 'retry',

  /** 修改参数后重试 */
  RETRY_WITH_MODIFICATIONS = 'retry_with_modifications',

  /** 回滚到指定节点 */
  ROLLBACK = 'rollback',

  /** 强制完成 */
  FORCE_COMPLETE = 'force_complete',

  /** 强制失败 */
  FORCE_FAIL = 'force_fail',

  /** 插入断点 */
  INSERT_BREAKPOINT = 'insert_breakpoint'
}

/**
 * UI 字段配置
 */
export interface UIField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date';
  required: boolean;
  editable: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

/**
 * 升级级别配置
 */
export interface EscalationLevel {
  level: number;
  condition: string;
  approvers: string[];
  notifyChannels: string[];
  autoEscalateAfterMinutes: number;
}

/**
 * 断点配置
 */
export interface BreakpointConfig {
  /** 是否启用 */
  enabled: boolean;

  /** 断点类型 */
  type: BreakpointType;

  /** 触发模式 */
  mode: BreakpointTriggerMode;

  /** 触发条件（动态断点） */
  condition?: {
    expression?: string;
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
    field: string;
    value: any;
  };

  /** 审批人配置 */
  approvers?: {
    users?: string[];
    roles?: string[];
    departments?: string[];
    dynamicResolver?: string;
  };

  /** 审批模式 */
  approvalMode?: ApprovalMode;

  /** 需要多少票（投票模式） */
  requiredApprovals?: number;

  /** 超时配置 */
  timeout?: {
    duration: number;
    reminderIntervals: number[];
    autoAction?: 'escalate' | 'reject' | 'approve';
  };

  /** 升级配置 */
  escalation?: {
    enabled: boolean;
    levels: EscalationLevel[];
  };

  /** 上下文捕获配置 */
  contextCapture?: {
    input: boolean;
    output: boolean;
    logs: boolean;
    executionPath: boolean;
  };

  /** UI 配置 */
  uiConfig?: {
    title: string;
    description: string;
    fields: UIField[];
    attachments: boolean;
  };
}

/**
 * 断点实例
 */
export interface Breakpoint {
  /** 断点唯一ID */
  breakpointId: string;

  /** 所属工作流执行ID */
  executionId: string;

  /** 工作流ID */
  workflowId: string;

  /** 节点ID */
  nodeId: string;

  /** 断点类型 */
  type: BreakpointType;

  /** 触发模式 */
  mode: BreakpointTriggerMode;

  /** 当前状态 */
  status: BreakpointStatus;

  /** 断点配置 */
  config: BreakpointConfig;

  /** 上下文数据 */
  context: {
    input?: any;
    output?: any;
    logs?: string[];
    executionPath?: string[];
    [key: string]: any;
  };

  /** 审批记录 */
  approvals: ApprovalRecord[];

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;

  /** 过期时间 */
  expiresAt?: Date;

  /** 解决时间 */
  resolvedAt?: Date;

  /** 创建者 */
  createdBy?: string;

  /** 解决者 */
  resolvedBy?: string;

  /** 解决结果 */
  resolution?: {
    action: 'approve' | 'reject' | 'modify';
    comment?: string;
    modifications?: Record<string, any>;
  };
}

/**
 * 审批记录
 */
export interface ApprovalRecord {
  /** 记录ID */
  recordId: string;

  /** 审批人ID */
  approverId: string;

  /** 审批人名称 */
  approverName: string;

  /** 审批动作 */
  action: 'approve' | 'reject' | 'transfer' | 'delegate';

  /** 审批意见 */
  comment?: string;

  /** 修改的数据 */
  modifications?: Record<string, any>;

  /** 审批时间 */
  timestamp: Date;

  /** 审批步骤（顺序审批用） */
  step?: number;
}

/**
 * 审批步骤
 */
export interface ApprovalStep {
  /** 步骤ID */
  stepId: string;

  /** 步骤名称 */
  name: string;

  /** 步骤顺序 */
  order: number;

  /** 审批人配置 */
  approvers: {
    type: 'user' | 'role' | 'department' | 'dynamic';
    values: string[];
    dynamicExpression?: string;
  };

  /** 审批模式 */
  mode: ApprovalMode;

  /** 投票模式需要票数 */
  requiredCount?: number;

  /** 进入条件 */
  condition?: string;

  /** 超时配置 */
  timeout: {
    duration: number;
    autoAction: 'escalate' | 'reject' | 'approve' | 'remind';
    escalationStep?: string;
  };

  /** 通知配置 */
  notifications: {
    channels: string[];
    template: string;
    reminderIntervals: number[];
  };
}

/**
 * 审批流定义
 */
export interface ApprovalFlow {
  /** 流程ID */
  flowId: string;

  /** 流程名称 */
  name: string;

  /** 描述 */
  description?: string;

  /** 触发条件 */
  trigger: {
    type: 'workflow_node' | 'condition' | 'manual';
    workflowIds?: string[];
    nodeIds?: string[];
    condition?: string;
  };

  /** 审批步骤 */
  steps: ApprovalStep[];

  /** 全局配置 */
  config: {
    timeout: number;
    allowTransfer: boolean;
    allowDelegate: boolean;
    allowBatch: boolean;
    requireComment: boolean;
  };

  /** 是否启用 */
  enabled: boolean;

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 干预参数
 */
export interface InterventionParams {
  /** 目标节点ID */
  nodeId?: string;

  /** 回滚目标节点ID */
  targetNodeId?: string;

  /** 修改的数据 */
  modifications?: Record<string, any>;

  /** 回退值（跳过时使用） */
  fallbackValue?: any;

  /** 是否保留上下文 */
  preserveContext?: boolean;

  /** 干预原因 */
  reason?: string;
}

/**
 * 干预结果
 */
export interface InterventionResult {
  /** 是否成功 */
  success: boolean;

  /** 执行ID */
  executionId: string;

  /** 回滚的节点列表 */
  rolledBackNodes?: string[];

  /** 恢复执行的节点 */
  resumedFrom?: string;

  /** 错误信息 */
  error?: string;

  /** 操作时间 */
  timestamp: Date;
}

/**
 * 补偿配置
 */
export interface CompensationConfig {
  /** 是否启用 */
  enabled: boolean;

  /** 补偿类型 */
  type: 'automatic' | 'manual' | 'custom';

  /** 自动补偿操作 */
  automaticAction?: {
    type: 'api_call' | 'message' | 'webhook';
    config: Record<string, any>;
  };

  /** 自定义补偿脚本 */
  customScript?: string;

  /** 补偿超时 */
  timeout: number;

  /** 补偿失败处理 */
  onFailure: 'ignore' | 'retry' | 'alert' | 'block';
}

/**
 * 操作人信息
 */
export interface OperatorInfo {
  userId: string;
  userName: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

/**
 * 审计日志
 */
export interface HITLAuditLog {
  /** 日志ID */
  logId: string;

  /** 时间戳 */
  timestamp: Date;

  /** 操作类型 */
  action: string;

  /** 操作分类 */
  actionType: 'breakpoint' | 'intervention' | 'approval' | 'config';

  /** 操作对象 */
  target: {
    type: string;
    id: string;
    executionId?: string;
    workflowId?: string;
  };

  /** 操作人 */
  operator: OperatorInfo;

  /** 操作详情 */
  details: {
    before?: any;
    after?: any;
    changes?: Record<string, { from: any; to: any }>;
    reason?: string;
    [key: string]: any;
  };

  /** 结果 */
  result: 'success' | 'failure';

  /** 错误信息 */
  error?: string;
}

/**
 * 通知模板
 */
export interface NotificationTemplate {
  /** 模板ID */
  templateId: string;

  /** 模板名称 */
  name: string;

  /** 支持的渠道 */
  channels: string[];

  /** 各渠道内容 */
  content: {
    [channel: string]: {
      title: string;
      body: string;
      actionUrl?: string;
      actionText?: string;
    };
  };

  /** 变量定义 */
  variables: {
    name: string;
    description: string;
    source: 'context' | 'execution' | 'breakpoint' | 'user';
    path: string;
  }[];
}
