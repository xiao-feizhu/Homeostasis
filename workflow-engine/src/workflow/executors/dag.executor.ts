import { IDAGExecutor, NodeExecutor, ExecutionContext } from '../interfaces/dag-executor.interface';
import {
  WorkflowDefinition,
  WorkflowExecution,
  NodeId,
  NodeStatus,
  WorkflowStatus,
  NodeExecution,
} from '../types/workflow.types';
import { v4 as uuidv4 } from 'uuid';

export class DAGExecutor implements IDAGExecutor {
  async execute(
    definition: WorkflowDefinition,
    input: Record<string, unknown>,
    nodeExecutor: NodeExecutor,
  ): Promise<WorkflowExecution> {
    if (!definition) {
      throw new Error('Workflow definition is required');
    }

    const executionId = uuidv4();
    const nodeExecutions = new Map<NodeId, NodeExecution>();
    const sortedNodes = this.topologicalSort(definition);

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: definition.id,
      status: WorkflowStatus.RUNNING,
      context: input || {},
      nodeExecutions,
      startedAt: new Date(),
    };

    const executionContext: ExecutionContext = {
      workflowId: definition.id,
      executionId,
      input: input || {},
    };

    try {
      for (const nodeId of sortedNodes) {
        const node = definition.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        const dependencies = this.resolveDependencies(definition, nodeId);
        const nodeInput = this.aggregateInputs(nodeExecutions, dependencies);

        const nodeExecution: NodeExecution = {
          nodeId,
          status: NodeStatus.RUNNING,
          input: nodeInput,
          startedAt: new Date(),
        };
        nodeExecutions.set(nodeId, nodeExecution);

        try {
          const output = await nodeExecutor.execute(nodeId, nodeInput, executionContext);

          nodeExecution.status = NodeStatus.COMPLETED;
          nodeExecution.output = output || {};
          nodeExecution.completedAt = new Date();
        } catch (error) {
          nodeExecution.status = NodeStatus.FAILED;
          nodeExecution.error = error instanceof Error ? error.message : String(error);
          nodeExecution.completedAt = new Date();

          execution.status = WorkflowStatus.FAILED;
          execution.error = `Node ${nodeId} failed: ${nodeExecution.error}`;
          execution.completedAt = new Date();

          return execution;
        }
      }

      execution.status = WorkflowStatus.COMPLETED;
      execution.completedAt = new Date();
    } catch (error) {
      execution.status = WorkflowStatus.FAILED;
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date();
    }

    return execution;
  }

  topologicalSort(definition: WorkflowDefinition): NodeId[] {
    if (!definition || !definition.nodes || definition.nodes.length === 0) {
      return [];
    }

    const nodeIds = new Set(definition.nodes.map((n) => n.id));
    const inDegree = new Map<NodeId, number>();
    const adjacencyList = new Map<NodeId, NodeId[]>();

    nodeIds.forEach((id) => {
      inDegree.set(id, 0);
      adjacencyList.set(id, []);
    });

    for (const edge of definition.edges || []) {
      if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        adjacencyList.get(edge.from)!.push(edge.to);
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      }
    }

    const queue: NodeId[] = [];
    const result: NodeId[] = [];

    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = adjacencyList.get(current) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== nodeIds.size) {
      throw new Error('Cycle detected in workflow');
    }

    return result;
  }

  resolveDependencies(definition: WorkflowDefinition, nodeId: NodeId): NodeId[] {
    if (!definition || !definition.edges) {
      return [];
    }

    const dependencies: NodeId[] = [];
    for (const edge of definition.edges) {
      if (edge.to === nodeId) {
        dependencies.push(edge.from);
      }
    }

    return dependencies;
  }

  private aggregateInputs(
    nodeExecutions: Map<NodeId, NodeExecution>,
    dependencyIds: NodeId[],
  ): Record<string, unknown> {
    const aggregated: Record<string, unknown> = {};

    for (const depId of dependencyIds) {
      const depExecution = nodeExecutions.get(depId);
      if (depExecution?.output) {
        aggregated[depId] = depExecution.output;
      }
    }

    return aggregated;
  }
}
