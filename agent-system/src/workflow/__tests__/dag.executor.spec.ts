import { DAGExecutor, DAGExecutionContext } from '../executors/dag.executor';
import {
  WorkflowDefinition,
  WorkflowNode,
  NodeType,
  WorkflowStatus
} from '../entities/workflow-definition.entity';

describe('DAGExecutor', () => {
  let executor: DAGExecutor;
  let mockNodeExecutor: jest.Mock;

  beforeEach(() => {
    executor = new DAGExecutor();
    mockNodeExecutor = jest.fn().mockResolvedValue(undefined);
  });

  describe('topologicalSort', () => {
    it('should return empty array for empty nodes', () => {
      const result = executor.topologicalSort([]);

      expect(result).toEqual([]);
    });

    it('should return single node for single node workflow', () => {
      const node = createNode('node-1', NodeType.START, []);

      const result = executor.topologicalSort([node]);

      expect(result).toHaveLength(1);
      expect(result![0].nodeId).toBe('node-1');
    });

    it('should sort nodes in correct dependency order', () => {
      // A -> B -> C
      const nodeA = createNode('node-a', NodeType.START, []);
      const nodeB = createNode('node-b', NodeType.CODE, ['node-a']);
      const nodeC = createNode('node-c', NodeType.END, ['node-b']);

      const result = executor.topologicalSort([nodeC, nodeA, nodeB]);

      expect(result).toHaveLength(3);
      expect(result![0].nodeId).toBe('node-a');
      expect(result![1].nodeId).toBe('node-b');
      expect(result![2].nodeId).toBe('node-c');
    });

    it('should handle complex DAG with multiple branches', () => {
      //    A
      //   / \
      //  B   C
      //   \ /
      //    D
      const nodeA = createNode('node-a', NodeType.START, []);
      const nodeB = createNode('node-b', NodeType.CODE, ['node-a']);
      const nodeC = createNode('node-c', NodeType.CODE, ['node-a']);
      const nodeD = createNode('node-d', NodeType.END, ['node-b', 'node-c']);

      const result = executor.topologicalSort([nodeD, nodeC, nodeA, nodeB]);

      expect(result).toHaveLength(4);
      expect(result![0].nodeId).toBe('node-a');
      expect(result![3].nodeId).toBe('node-d');
      // B and C can be in any order relative to each other
      const middleNodes = result!.slice(1, 3).map(n => n.nodeId);
      expect(middleNodes).toContain('node-b');
      expect(middleNodes).toContain('node-c');
    });

    it('should return null for circular dependency', () => {
      // A -> B -> C -> A
      const nodeA = createNode('node-a', NodeType.START, ['node-c']);
      const nodeB = createNode('node-b', NodeType.CODE, ['node-a']);
      const nodeC = createNode('node-c', NodeType.CODE, ['node-b']);

      const result = executor.topologicalSort([nodeA, nodeB, nodeC]);

      expect(result).toBeNull();
    });

    it('should handle diamond-shaped DAG', () => {
      //    A
      //   / \
      //  B   C
      //  |   |
      //  D   E
      //   \ /
      //    F
      const nodeA = createNode('node-a', NodeType.START, []);
      const nodeB = createNode('node-b', NodeType.CODE, ['node-a']);
      const nodeC = createNode('node-c', NodeType.CODE, ['node-a']);
      const nodeD = createNode('node-d', NodeType.CODE, ['node-b']);
      const nodeE = createNode('node-e', NodeType.CODE, ['node-c']);
      const nodeF = createNode('node-f', NodeType.END, ['node-d', 'node-e']);

      const result = executor.topologicalSort([nodeF, nodeE, nodeD, nodeC, nodeB, nodeA]);

      expect(result).toHaveLength(6);
      expect(result![0].nodeId).toBe('node-a');
      expect(result![5].nodeId).toBe('node-f');
    });
  });

  describe('execute', () => {
    it('should execute nodes in correct order', async () => {
      const definition = createLinearWorkflow();
      const context = createExecutionContext();

      const result = await executor.execute(definition, context, mockNodeExecutor);

      expect(result.success).toBe(true);
      expect(result.executionPath).toEqual(['start', 'node-a', 'node-b', 'end']);
      expect(mockNodeExecutor).toHaveBeenCalledTimes(4);
    });

    it('should pass correct context to node executor', async () => {
      const definition = createLinearWorkflow();
      const context = createExecutionContext();

      await executor.execute(definition, context, mockNodeExecutor);

      expect(mockNodeExecutor).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: 'start' }),
        context
      );
    });

    it('should fail when node execution throws error', async () => {
      const definition = createLinearWorkflow();
      const context = createExecutionContext();
      mockNodeExecutor.mockRejectedValueOnce(new Error('Execution failed'));

      const result = await executor.execute(definition, context, mockNodeExecutor);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NODE_EXECUTION_FAILED');
      expect(result.error?.nodeId).toBe('start');
    });

    it('should fail when workflow has circular dependency', async () => {
      const definition = createCircularWorkflow();
      const context = createExecutionContext();

      const result = await executor.execute(definition, context, mockNodeExecutor);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CIRCULAR_DEPENDENCY');
    });

    it('should skip nodes that cannot execute due to unmet dependencies', async () => {
      const definition = createPartialDependencyWorkflow();
      const context = createExecutionContext();

      const result = await executor.execute(definition, context, mockNodeExecutor);

      expect(result.success).toBe(true);
      // Only start and node-a should execute
      expect(result.executionPath).toContain('start');
      expect(result.executionPath).toContain('node-a');
    });
  });

  describe('getParallelExecutionGroups', () => {
    it('should return single group for linear workflow', () => {
      const nodes = [
        createNode('node-a', NodeType.START, []),
        createNode('node-b', NodeType.CODE, ['node-a']),
        createNode('node-c', NodeType.END, ['node-b'])
      ];

      const groups = executor.getParallelExecutionGroups(nodes);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toHaveLength(1);
      expect(groups[0][0].nodeId).toBe('node-a');
    });

    it('should group parallel nodes together', () => {
      const nodes = [
        createNode('node-a', NodeType.START, []),
        createNode('node-b', NodeType.CODE, ['node-a']),
        createNode('node-c', NodeType.CODE, ['node-a']),
        createNode('node-d', NodeType.END, ['node-b', 'node-c'])
      ];

      const groups = executor.getParallelExecutionGroups(nodes);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toHaveLength(1); // node-a
      expect(groups[1]).toHaveLength(2); // node-b, node-c (parallel)
      expect(groups[2]).toHaveLength(1); // node-d
    });

    it('should handle multiple parallel branches', () => {
      const nodes = [
        createNode('start', NodeType.START, []),
        createNode('branch-1', NodeType.CODE, ['start']),
        createNode('branch-2', NodeType.CODE, ['start']),
        createNode('branch-3', NodeType.CODE, ['start']),
        createNode('end', NodeType.END, ['branch-1', 'branch-2', 'branch-3'])
      ];

      const groups = executor.getParallelExecutionGroups(nodes);

      expect(groups).toHaveLength(3);
      expect(groups[1]).toHaveLength(3); // Three parallel branches
    });
  });

  describe('findAllPaths', () => {
    it('should find single path for linear workflow', () => {
      const nodes = [
        createNode('node-a', NodeType.START, []),
        createNode('node-b', NodeType.CODE, ['node-a']),
        createNode('node-c', NodeType.END, ['node-b'])
      ];

      const paths = executor.findAllPaths(nodes, 'node-a', 'node-c');

      expect(paths).toHaveLength(1);
      expect(paths[0]).toEqual(['node-a', 'node-b', 'node-c']);
    });

    it('should find multiple paths for branched workflow', () => {
      const nodes = [
        createNode('start', NodeType.START, []),
        createNode('path-1', NodeType.CODE, ['start']),
        createNode('path-2', NodeType.CODE, ['start']),
        createNode('join', NodeType.CODE, ['path-1']),
        createNode('end', NodeType.END, ['path-2', 'join'])
      ];

      const paths = executor.findAllPaths(nodes, 'start', 'end');

      expect(paths.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when no path exists', () => {
      const nodes = [
        createNode('node-a', NodeType.START, []),
        createNode('node-b', NodeType.END, [])
      ];

      const paths = executor.findAllPaths(nodes, 'node-a', 'node-b');

      expect(paths).toHaveLength(0);
    });
  });

  describe('getNodeDepth', () => {
    it('should return 0 for start node', () => {
      const nodes = [
        createNode('start', NodeType.START, []),
        createNode('node-a', NodeType.CODE, ['start'])
      ];

      const depth = executor.getNodeDepth(nodes, 'start');

      expect(depth).toBe(0);
    });

    it('should return correct depth for dependent node', () => {
      const nodes = [
        createNode('node-a', NodeType.START, []),
        createNode('node-b', NodeType.CODE, ['node-a']),
        createNode('node-c', NodeType.END, ['node-b'])
      ];

      expect(executor.getNodeDepth(nodes, 'node-a')).toBe(0);
      expect(executor.getNodeDepth(nodes, 'node-b')).toBe(1);
      expect(executor.getNodeDepth(nodes, 'node-c')).toBe(2);
    });

    it('should handle multiple dependencies (return max depth)', () => {
      const nodes = [
        createNode('node-a', NodeType.CODE, []),
        createNode('node-b', NodeType.CODE, ['node-a']),
        createNode('node-c', NodeType.CODE, ['node-a']),
        createNode('node-d', NodeType.CODE, ['node-b', 'node-c'])
      ];

      expect(executor.getNodeDepth(nodes, 'node-d')).toBe(2);
    });
  });
});

// Helper functions
function createNode(
  nodeId: string,
  type: NodeType,
  dependencies: string[]
): WorkflowNode {
  return {
    nodeId,
    name: `Node ${nodeId}`,
    type,
    dependencies,
    dependents: []
  };
}

function createLinearWorkflow(): WorkflowDefinition {
  return {
    workflowId: 'wf-linear',
    name: 'Linear Workflow',
    version: '1.0.0',
    status: WorkflowStatus.DRAFT,
    ownerId: 'user-001',
    nodes: [
      createNode('start', NodeType.START, []),
      createNode('node-a', NodeType.CODE, ['start']),
      createNode('node-b', NodeType.CODE, ['node-a']),
      createNode('end', NodeType.END, ['node-b'])
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1
  };
}

function createCircularWorkflow(): WorkflowDefinition {
  return {
    workflowId: 'wf-circular',
    name: 'Circular Workflow',
    version: '1.0.0',
    status: WorkflowStatus.DRAFT,
    ownerId: 'user-001',
    nodes: [
      { ...createNode('node-a', NodeType.START, []), dependencies: ['node-c'] },
      createNode('node-b', NodeType.CODE, ['node-a']),
      createNode('node-c', NodeType.CODE, ['node-b'])
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1
  };
}

function createPartialDependencyWorkflow(): WorkflowDefinition {
  return {
    workflowId: 'wf-partial',
    name: 'Partial Dependency Workflow',
    version: '1.0.0',
    status: WorkflowStatus.DRAFT,
    ownerId: 'user-001',
    nodes: [
      createNode('start', NodeType.START, []),
      createNode('node-a', NodeType.CODE, ['start']),
      createNode('node-b', NodeType.CODE, ['start', 'missing-node'])
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1
  };
}

function createExecutionContext(): DAGExecutionContext {
  return {
    executionId: 'exec-test-001',
    workflowId: 'wf-test-001',
    userId: 'user-001',
    variables: {}
  };
}
