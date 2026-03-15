import {
  WorkflowDefinition,
  WorkflowExecution,
  NodeId,
} from '../types/workflow.types';

export interface ExecutionContext {
  [key: string]: unknown;
}

export interface NodeExecutor {
  execute(
    nodeId: NodeId,
    input: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>>;
}

export interface IDAGExecutor {
  execute(
    definition: WorkflowDefinition,
    input: Record<string, unknown>,
    nodeExecutor: NodeExecutor,
  ): Promise<WorkflowExecution>;
  topologicalSort(definition: WorkflowDefinition): NodeId[];
  resolveDependencies(
    definition: WorkflowDefinition,
    nodeId: NodeId,
  ): NodeId[];
}
