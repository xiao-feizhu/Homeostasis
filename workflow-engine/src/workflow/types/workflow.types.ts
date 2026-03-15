export type NodeId = string;
export type WorkflowId = string;
export type ExecutionId = string;

export enum WorkflowNodeType {
  START = 'start',
  END = 'end',
  TASK = 'task',
  CONDITION = 'condition',
  PARALLEL = 'parallel',
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum NodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface DataSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  properties?: Record<string, DataSchema>;
  items?: DataSchema;
  required?: string[];
}

export interface WorkflowNode {
  id: NodeId;
  type: WorkflowNodeType;
  name: string;
  dependencies: NodeId[];
  inputSchema?: DataSchema;
  outputSchema?: DataSchema;
  config?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  version: string;
  nodes: WorkflowNode[];
  edges: Array<{ from: NodeId; to: NodeId }>;
  inputSchema: DataSchema;
  outputSchema: DataSchema;
}

export interface NodeExecution {
  nodeId: NodeId;
  status: NodeStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkflowExecution {
  id: ExecutionId;
  workflowId: WorkflowId;
  status: WorkflowStatus;
  context: Record<string, unknown>;
  nodeExecutions: Map<NodeId, NodeExecution>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
