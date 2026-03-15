import { ParallelNodeExecutor } from '../executors/parallel.executor';
import { NodeType, WorkflowNode } from '../entities/workflow-definition.entity';
import { NodeExecutionContextImpl } from '../executors/node.executor';
import { NodeExecutorRegistry } from '../executors/executor.registry';
import { StartNodeExecutor, EndNodeExecutor } from '../executors/start-end.executor';

describe('ParallelNodeExecutor', () => {
  let executor: ParallelNodeExecutor;
  let context: NodeExecutionContextImpl;
  let registry: NodeExecutorRegistry;

  beforeEach(() => {
    registry = new NodeExecutorRegistry();
    registry.register(new StartNodeExecutor());
    registry.register(new EndNodeExecutor());
    executor = new ParallelNodeExecutor(registry);
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'parallel-node',
      { items: ['a', 'b', 'c'] },
      { counter: 0 }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('type', () => {
    it('should have PARALLEL type', () => {
      expect(executor.type).toBe(NodeType.PARALLEL);
    });
  });

  describe('execute - completion strategies', () => {
    it('should wait for all branches with "all" strategy', async () => {
      const executionOrder: string[] = [];

      class MockDelayExecutor {
        readonly type = NodeType.CODE;
        async execute(node: WorkflowNode) {
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push(node.nodeId);
          return { success: true, status: 'completed' as const, output: { nodeId: node.nodeId } };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockDelayExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel All',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Node A',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-b',
              node: {
                nodeId: 'node-b',
                name: 'Node B',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.completedBranches).toContain('branch-a');
      expect(result.output?.completedBranches).toContain('branch-b');
    });

    it('should return first success with "any" strategy', async () => {
      let callCount = 0;

      class MockDelayExecutor {
        readonly type = NodeType.CODE;
        async execute(node: WorkflowNode) {
          callCount++;
          const delay = node.nodeId === 'node-a' ? 10 : 50;
          await new Promise(resolve => setTimeout(resolve, delay));
          return { success: true, status: 'completed' as const, output: { nodeId: node.nodeId } };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockDelayExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel Any',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Fast Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-b',
              node: {
                nodeId: 'node-b',
                name: 'Slow Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'any',
          errorHandling: 'fail_fast'
        }
      };

      const startTime = Date.now();
      const result = await executor.execute(node, context);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100);
    });

    it('should return first completed with "race" strategy', async () => {
      class MockDelayExecutor {
        readonly type = NodeType.CODE;
        async execute(node: WorkflowNode) {
          const delay = node.nodeId === 'node-a' ? 10 : 5;
          await new Promise(resolve => setTimeout(resolve, delay));
          return { success: true, status: 'completed' as const, output: { nodeId: node.nodeId } };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockDelayExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel Race',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Slower Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-b',
              node: {
                nodeId: 'node-b',
                name: 'Faster Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'race',
          errorHandling: 'fail_fast'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.completedBranches.length).toBeGreaterThanOrEqual(1);
    });

    it('should support n_of_m strategy', async () => {
      class MockExecutor {
        readonly type = NodeType.CODE;
        async execute(node: WorkflowNode) {
          if (node.nodeId === 'node-c') {
            return { success: false, status: 'failed' as const, error: { code: 'ERROR', message: 'Failed' } };
          }
          return { success: true, status: 'completed' as const, output: { nodeId: node.nodeId } };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel N of M',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Node A',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-b',
              node: {
                nodeId: 'node-b',
                name: 'Node B',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-c',
              node: {
                nodeId: 'node-c',
                name: 'Failing Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'n_of_m',
          strategyConfig: {
            requiredCount: 2
          },
          errorHandling: 'ignore_errors'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
    });
  });

  describe('execute - error handling', () => {
    it('should fail fast when configured', async () => {
      let callCount = 0;

      class MockFailingExecutor {
        readonly type = NodeType.CODE;
        async execute(node: WorkflowNode) {
          callCount++;
          if (node.nodeId === 'node-b') {
            return { success: false, status: 'failed' as const, error: { code: 'ERROR', message: 'Failed' } };
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockFailingExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel Fail Fast',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Slow Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-b',
              node: {
                nodeId: 'node-b',
                name: 'Failing Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(callCount).toBe(2);
    });

    it('should ignore errors when configured', async () => {
      class MockFailingExecutor {
        readonly type = NodeType.CODE;
        async execute(node: WorkflowNode) {
          if (node.nodeId === 'node-b') {
            return { success: false, status: 'failed' as const, error: { code: 'ERROR', message: 'Failed' } };
          }
          return { success: true, status: 'completed' as const, output: { nodeId: node.nodeId } };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockFailingExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel Ignore Errors',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Success Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-b',
              node: {
                nodeId: 'node-b',
                name: 'Failing Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'ignore_errors'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.failedBranches).toContain('branch-b');
      expect(result.output?.completedBranches).toContain('branch-a');
    });
  });

  describe('execute - timeout', () => {
    it('should timeout slow branches', async () => {
      class MockSlowExecutor {
        readonly type = NodeType.CODE;
        async execute() {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockSlowExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel Timeout',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Slow Node',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast',
          timeout: 50
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });
  });

  describe('execute - result aggregation', () => {
    it('should aggregate branch results as array', async () => {
      class MockExecutor {
        readonly type = NodeType.CODE;
        async execute(node: WorkflowNode) {
          return { success: true, status: 'completed' as const, output: { value: node.nodeId } };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel Results',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Node A',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-b',
              node: {
                nodeId: 'node-b',
                name: 'Node B',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast',
          resultAggregation: {
            includeBranchResults: true,
            mergeStrategy: 'array'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.branchResults).toBeDefined();
    });

    it('should aggregate branch results as object', async () => {
      class MockExecutor {
        readonly type = NodeType.CODE;
        async execute(node: WorkflowNode) {
          return { success: true, status: 'completed' as const, output: { value: node.nodeId } };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel Results',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Node A',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast',
          resultAggregation: {
            includeBranchResults: true,
            mergeStrategy: 'object'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.branchResults['branch-a']).toBeDefined();
    });
  });

  describe('execute - condition', () => {
    it('should skip branch based on condition', async () => {
      context.setVariable('skipBranch', true);

      class MockExecutor {
        readonly type = NodeType.CODE;
        async execute() {
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockExecutor() as any);

      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel Conditional',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Always Run',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-b',
              node: {
                nodeId: 'node-b',
                name: 'Conditional Skip',
                type: NodeType.CODE,
                dependencies: [],
                dependents: [],
                config: {}
              },
              condition: '!skipBranch'
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.completedBranches).toContain('branch-a');
      expect(result.output?.completedBranches).not.toContain('branch-b');
    });

    it('should handle all branches skipped', async () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Parallel All Skipped',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Node A',
                type: NodeType.END,
                dependencies: [],
                dependents: [],
                config: {}
              },
              condition: 'false'
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.completedBranches).toHaveLength(0);
    });
  });

  describe('execute - edge cases', () => {
    it('should handle single branch', async () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Single Branch',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Node A',
                type: NodeType.END,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.completedBranches).toEqual(['branch-a']);
    });

    it('should handle zero branches', async () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'No Branches',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [],
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.completedBranches).toHaveLength(0);
    });

    it('should error on duplicate branch ID', async () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Duplicate Branches',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Node A',
                type: NodeType.END,
                dependencies: [],
                dependents: [],
                config: {}
              }
            },
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-b',
                name: 'Node B',
                type: NodeType.END,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIG_ERROR');
    });
  });

  describe('validate', () => {
    it('should validate valid parallel node', () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Valid Parallel',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            {
              branchId: 'branch-a',
              node: {
                nodeId: 'node-a',
                name: 'Node A',
                type: NodeType.END,
                dependencies: [],
                dependents: [],
                config: {}
              }
            }
          ],
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(true);
    });

    it('should require branches', () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'No Branches',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          completionStrategy: 'all',
          errorHandling: 'fail_fast'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('branches is required');
    });

    it('should require completion strategy', () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'No Strategy',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: []
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('completionStrategy is required');
    });

    it('should validate completion strategy values', () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'Invalid Strategy',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [],
          completionStrategy: 'invalid'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('completionStrategy'))).toBe(true);
    });

    it('should require error handling', () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'No Error Handling',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [],
          completionStrategy: 'all'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('errorHandling is required');
    });

    it('should validate n_of_m has requiredCount', () => {
      const node: WorkflowNode = {
        nodeId: 'parallel-1',
        name: 'N of M Missing Count',
        type: NodeType.PARALLEL,
        dependencies: [],
        dependents: [],
        config: {
          branches: [
            { branchId: 'a', node: { nodeId: 'a', name: 'A', type: NodeType.END, dependencies: [], dependents: [], config: {} } }
          ],
          completionStrategy: 'n_of_m',
          errorHandling: 'fail_fast'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('requiredCount'))).toBe(true);
    });
  });
});
