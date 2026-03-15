import { DAGExecutor } from './dag.executor';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowStatus,
  NodeStatus,
} from '../types/workflow.types';
import { NodeExecutor, ExecutionContext } from '../interfaces/dag-executor.interface';

describe('DAGExecutor', () => {
  let executor: DAGExecutor;
  let mockNodeExecutor: jest.Mocked<NodeExecutor>;

  beforeEach(() => {
    executor = new DAGExecutor();
    mockNodeExecutor = {
      execute: jest.fn(),
    };
  });

  describe('topologicalSort', () => {
    it('should return nodes in topological order for linear workflow', () => {
      const definition = createLinearWorkflow();

      const result = executor.topologicalSort(definition);

      expect(result).toEqual(['start', 'task1', 'task2', 'end']);
    });

    it('should handle workflow with parallel branches', () => {
      const definition = createBranchingWorkflow();

      const result = executor.topologicalSort(definition);

      expect(result.indexOf('start')).toBe(0);
      expect(result.indexOf('branch1')).toBeLessThan(result.indexOf('merge'));
      expect(result.indexOf('branch2')).toBeLessThan(result.indexOf('merge'));
      expect(result.indexOf('merge')).toBeLessThan(result.indexOf('end'));
      expect(result[result.length - 1]).toBe('end');
    });

    it('should return empty array for empty workflow', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = [];
      definition.edges = [];

      const result = executor.topologicalSort(definition);

      expect(result).toEqual([]);
    });

    it('should handle single node workflow', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = [
        { id: 'start', type: WorkflowNodeType.START, name: 'Start', dependencies: [] },
      ];
      definition.edges = [];

      const result = executor.topologicalSort(definition);

      expect(result).toEqual(['start']);
    });

    it('should handle complex DAG with multiple levels', () => {
      const definition = createComplexWorkflow();

      const result = executor.topologicalSort(definition);

      expect(result.indexOf('start')).toBeLessThan(result.indexOf('a'));
      expect(result.indexOf('start')).toBeLessThan(result.indexOf('b'));
      expect(result.indexOf('a')).toBeLessThan(result.indexOf('c'));
      expect(result.indexOf('b')).toBeLessThan(result.indexOf('c'));
      expect(result.indexOf('c')).toBeLessThan(result.indexOf('d'));
      expect(result.indexOf('d')).toBeLessThan(result.indexOf('end'));
    });

    it('should throw error for cyclic workflow', () => {
      const definition = createCyclicWorkflow();

      expect(() => executor.topologicalSort(definition)).toThrow('Cycle detected in workflow');
    });
  });

  describe('resolveDependencies', () => {
    it('should return direct dependencies for a node', () => {
      const definition = createLinearWorkflow();

      const result = executor.resolveDependencies(definition, 'task2');

      expect(result).toEqual(['task1']);
    });

    it('should return empty array for start node', () => {
      const definition = createLinearWorkflow();

      const result = executor.resolveDependencies(definition, 'start');

      expect(result).toEqual([]);
    });

    it('should return all dependencies for node with multiple dependencies', () => {
      const definition = createBranchingWorkflow();

      const result = executor.resolveDependencies(definition, 'merge');

      expect(result).toContain('branch1');
      expect(result).toContain('branch2');
      expect(result).toHaveLength(2);
    });

    it('should return empty array for non-existent node', () => {
      const definition = createLinearWorkflow();

      const result = executor.resolveDependencies(definition, 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should execute linear workflow successfully', async () => {
      const definition = createLinearWorkflow();
      const input = { value: 'test' };

      mockNodeExecutor.execute.mockResolvedValue({ processed: true });

      const result = await executor.execute(definition, input, mockNodeExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.workflowId).toBe(definition.id);
      expect(result.nodeExecutions.size).toBe(4);
      expect(mockNodeExecutor.execute).toHaveBeenCalledTimes(4);
    });

    it('should pass correct input to each node', async () => {
      const definition = createLinearWorkflow();
      const input = { initial: 'data' };

      mockNodeExecutor.execute.mockImplementation((nodeId, nodeInput) => {
        return Promise.resolve({ ...nodeInput, [nodeId]: true });
      });

      await executor.execute(definition, input, mockNodeExecutor);

      expect(mockNodeExecutor.execute).toHaveBeenNthCalledWith(
        1,
        'start',
        input,
        expect.any(Object),
      );
    });

    it('should aggregate outputs from multiple dependencies', async () => {
      const definition = createBranchingWorkflow();

      mockNodeExecutor.execute.mockImplementation((nodeId) => {
        return Promise.resolve({ [nodeId]: `output_${nodeId}` });
      });

      const result = await executor.execute(definition, {}, mockNodeExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      const mergeExecution = result.nodeExecutions.get('merge');
      expect(mergeExecution?.input).toEqual({
        branch1: 'output_branch1',
        branch2: 'output_branch2',
      });
    });

    it('should mark workflow as failed when node execution fails', async () => {
      const definition = createLinearWorkflow();

      mockNodeExecutor.execute.mockRejectedValue(new Error('Node execution failed'));

      const result = await executor.execute(definition, {}, mockNodeExecutor);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(result.error).toContain('Node execution failed');
    });

    it('should set correct timestamps', async () => {
      const definition = createLinearWorkflow();
      const beforeExecution = new Date();

      mockNodeExecutor.execute.mockResolvedValue({});

      const result = await executor.execute(definition, {}, mockNodeExecutor);

      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.startedAt.getTime()).toBeGreaterThanOrEqual(beforeExecution.getTime());
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.completedAt!.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
    });

    it('should skip remaining nodes after failure', async () => {
      const definition = createLinearWorkflow();

      mockNodeExecutor.execute.mockImplementation((nodeId) => {
        if (nodeId === 'task1') {
          throw new Error('Task 1 failed');
        }
        return Promise.resolve({});
      });

      const result = await executor.execute(definition, {}, mockNodeExecutor);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(mockNodeExecutor.execute).toHaveBeenCalledTimes(2);
    });

    it('should handle empty workflow', async () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = [];
      definition.edges = [];

      const result = await executor.execute(definition, {}, mockNodeExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.nodeExecutions.size).toBe(0);
    });

    it('should propagate context through execution', async () => {
      const definition = createLinearWorkflow();
      const input = { key: 'value' };

      mockNodeExecutor.execute.mockImplementation((nodeId, nodeInput, context) => {
        return Promise.resolve({ ...nodeInput, contextKeys: Object.keys(context) });
      });

      await executor.execute(definition, input, mockNodeExecutor);

      expect(mockNodeExecutor.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ workflowId: definition.id }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle null definition', async () => {
      await expect(
        executor.execute(null as unknown as WorkflowDefinition, {}, mockNodeExecutor),
      ).rejects.toThrow();
    });

    it('should handle undefined input', async () => {
      const definition = createLinearWorkflow();
      mockNodeExecutor.execute.mockResolvedValue({});

      const result = await executor.execute(definition, undefined as unknown as Record<string, unknown>, mockNodeExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
    });

    it('should handle node returning null output', async () => {
      const definition = createLinearWorkflow();
      mockNodeExecutor.execute.mockResolvedValue(null as unknown as Record<string, unknown>);

      const result = await executor.execute(definition, {}, mockNodeExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
    });

    it('should handle deeply nested workflow', async () => {
      const definition = createDeepWorkflow(100);
      mockNodeExecutor.execute.mockResolvedValue({});

      const result = await executor.execute(definition, {}, mockNodeExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.nodeExecutions.size).toBe(102);
    });
  });
});

// Helper functions
function createNode(
  id: string,
  type: WorkflowNodeType,
  dependencies: string[],
): WorkflowNode {
  return {
    id,
    type,
    name: `${type} Node ${id}`,
    dependencies,
  };
}

function createValidWorkflowDefinition(): WorkflowDefinition {
  return {
    id: 'test-workflow',
    name: 'Test Workflow',
    version: '1.0.0',
    nodes: [],
    edges: [],
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
  };
}

function createLinearWorkflow(): WorkflowDefinition {
  return {
    id: 'linear-workflow',
    name: 'Linear Workflow',
    version: '1.0.0',
    nodes: [
      createNode('start', WorkflowNodeType.START, []),
      createNode('task1', WorkflowNodeType.TASK, ['start']),
      createNode('task2', WorkflowNodeType.TASK, ['task1']),
      createNode('end', WorkflowNodeType.END, ['task2']),
    ],
    edges: [
      { from: 'start', to: 'task1' },
      { from: 'task1', to: 'task2' },
      { from: 'task2', to: 'end' },
    ],
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
  };
}

function createBranchingWorkflow(): WorkflowDefinition {
  return {
    id: 'branching-workflow',
    name: 'Branching Workflow',
    version: '1.0.0',
    nodes: [
      createNode('start', WorkflowNodeType.START, []),
      createNode('branch1', WorkflowNodeType.TASK, ['start']),
      createNode('branch2', WorkflowNodeType.TASK, ['start']),
      createNode('merge', WorkflowNodeType.TASK, ['branch1', 'branch2']),
      createNode('end', WorkflowNodeType.END, ['merge']),
    ],
    edges: [
      { from: 'start', to: 'branch1' },
      { from: 'start', to: 'branch2' },
      { from: 'branch1', to: 'merge' },
      { from: 'branch2', to: 'merge' },
      { from: 'merge', to: 'end' },
    ],
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
  };
}

function createComplexWorkflow(): WorkflowDefinition {
  return {
    id: 'complex-workflow',
    name: 'Complex Workflow',
    version: '1.0.0',
    nodes: [
      createNode('start', WorkflowNodeType.START, []),
      createNode('a', WorkflowNodeType.TASK, ['start']),
      createNode('b', WorkflowNodeType.TASK, ['start']),
      createNode('c', WorkflowNodeType.TASK, ['a', 'b']),
      createNode('d', WorkflowNodeType.TASK, ['c']),
      createNode('end', WorkflowNodeType.END, ['d']),
    ],
    edges: [
      { from: 'start', to: 'a' },
      { from: 'start', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
      { from: 'd', to: 'end' },
    ],
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
  };
}

function createCyclicWorkflow(): WorkflowDefinition {
  return {
    id: 'cyclic-workflow',
    name: 'Cyclic Workflow',
    version: '1.0.0',
    nodes: [
      createNode('a', WorkflowNodeType.START, []),
      createNode('b', WorkflowNodeType.TASK, ['a']),
      createNode('c', WorkflowNodeType.TASK, ['b']),
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ],
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
  };
}

function createDeepWorkflow(depth: number): WorkflowDefinition {
  const nodes: WorkflowNode[] = [
    createNode('start', WorkflowNodeType.START, []),
  ];
  const edges: Array<{ from: string; to: string }> = [];

  for (let i = 0; i < depth; i++) {
    const prevId = i === 0 ? 'start' : `task${i}`;
    const currId = `task${i + 1}`;
    nodes.push(createNode(currId, WorkflowNodeType.TASK, [prevId]));
    edges.push({ from: prevId, to: currId });
  }

  const lastTaskId = `task${depth}`;
  nodes.push(createNode('end', WorkflowNodeType.END, [lastTaskId]));
  edges.push({ from: lastTaskId, to: 'end' });

  return {
    id: 'deep-workflow',
    name: 'Deep Workflow',
    version: '1.0.0',
    nodes,
    edges,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
  };
}
