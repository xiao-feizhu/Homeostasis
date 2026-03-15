import {
  WorkflowExecution,
  ExecutionId,
  WorkflowId,
  NodeId,
  NodeStatus,
  WorkflowStatus,
} from '../types/workflow.types';

export interface StateEvent {
  id: string;
  executionId: ExecutionId;
  nodeId?: NodeId;
  type: 'workflow_started' | 'workflow_completed' | 'workflow_failed' | 'node_started' | 'node_completed' | 'node_failed';
  timestamp: Date;
  payload: Record<string, unknown>;
}

export interface IStateManager {
  createExecution(workflowId: WorkflowId, initialContext: Record<string, unknown>): Promise<WorkflowExecution>;
  getExecution(executionId: ExecutionId): Promise<WorkflowExecution | null>;
  updateNodeStatus(
    executionId: ExecutionId,
    nodeId: NodeId,
    status: NodeStatus,
    output?: Record<string, unknown>,
    error?: string,
  ): Promise<void>;
  updateWorkflowStatus(
    executionId: ExecutionId,
    status: WorkflowStatus,
    error?: string,
  ): Promise<void>;
  getEvents(executionId: ExecutionId): Promise<StateEvent[]>;
  appendEvent(event: StateEvent): Promise<void>;
}
