import { LoopNodeExecutor } from '../executors/loop.executor';
import { NodeType, WorkflowNode } from '../entities/workflow-definition.entity';
import { NodeExecutionContextImpl } from '../executors/node.executor';
import { NodeExecutorRegistry } from '../executors/executor.registry';
import { StartNodeExecutor, EndNodeExecutor } from '../executors/start-end.executor';

describe('LoopNodeExecutor', () => {
  let executor: LoopNodeExecutor;
  let context: NodeExecutionContextImpl;
  let registry: NodeExecutorRegistry;

  beforeEach(() => {
    registry = new NodeExecutorRegistry();
    registry.register(new StartNodeExecutor());
    registry.register(new EndNodeExecutor());
    executor = new LoopNodeExecutor(registry);
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'loop-node',
      { items: ['a', 'b', 'c'], count: 5 },
      { counter: 0 }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('type', () => {
    it('should have LOOP type', () => {
      expect(executor.type).toBe(NodeType.LOOP);
    });
  });

  describe('execute - for loop', () => {
    it('should execute child node N times', async () => {
      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Increment Counter',
        type: NodeType.END,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: 3
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.iterationsCompleted).toBe(3);
    });

    it('should expose loop index variable', async () => {
      const results: number[] = [];

      class MockCodeExecutor {
        readonly type = NodeType.CODE;
        async execute(_node: WorkflowNode, ctx: NodeExecutionContextImpl) {
          results.push(ctx.getVariable('index'));
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockCodeExecutor() as any);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Record Index',
        type: NodeType.CODE,
        dependencies: [],
        dependents: [],
        config: { code: 'results.push(index)' }
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: 3,
            loopVariableName: 'index'
          },
          childNode
        }
      };

      await executor.execute(node, context);

      expect(results).toContain(0);
      expect(results).toContain(1);
      expect(results).toContain(2);
    });

    it('should support template rendering in iteration count', async () => {
      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Child',
        type: NodeType.END,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: '${count}'
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.iterationsCompleted).toBe(5);
    });

    it('should handle zero iterations', async () => {
      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Child',
        type: NodeType.END,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: 0
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.iterationsCompleted).toBe(0);
    });

    it('should enforce maximum iteration limit', async () => {
      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Child',
        type: NodeType.END,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: 15000
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MAX_ITERATIONS_EXCEEDED');
    });
  });

  describe('execute - foreach loop', () => {
    it('should iterate over array', async () => {
      const items: string[] = [];

      class MockCodeExecutor {
        readonly type = NodeType.CODE;
        async execute(_node: WorkflowNode, ctx: NodeExecutionContextImpl) {
          items.push(ctx.getVariable('item'));
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockCodeExecutor() as any);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Record Item',
        type: NodeType.CODE,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Foreach Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'foreach',
          foreachConfig: {
            arrayExpression: 'items',
            itemVariableName: 'item'
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(items).toEqual(['a', 'b', 'c']);
      expect(result.output?.iterationsCompleted).toBe(3);
    });

    it('should expose index variable in foreach', async () => {
      const indices: number[] = [];

      class MockCodeExecutor {
        readonly type = NodeType.CODE;
        async execute(_node: WorkflowNode, ctx: NodeExecutionContextImpl) {
          indices.push(ctx.getVariable('idx'));
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockCodeExecutor() as any);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Record Index',
        type: NodeType.CODE,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Foreach Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'foreach',
          foreachConfig: {
            arrayExpression: 'items',
            itemVariableName: 'item',
            indexVariableName: 'idx'
          },
          childNode
        }
      };

      await executor.execute(node, context);

      expect(indices).toEqual([0, 1, 2]);
    });

    it('should handle empty array', async () => {
      context.setVariable('emptyArray', []);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Child',
        type: NodeType.END,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Foreach Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'foreach',
          foreachConfig: {
            arrayExpression: 'emptyArray'
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.iterationsCompleted).toBe(0);
    });

    it('should handle null/undefined array', async () => {
      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Child',
        type: NodeType.END,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Foreach Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'foreach',
          foreachConfig: {
            arrayExpression: 'nonExistentArray'
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ARRAY');
    });
  });

  describe('execute - while loop', () => {
    it('should loop while condition is true', async () => {
      let executionCount = 0;

      class MockCounterExecutor {
        readonly type = NodeType.CODE;
        async execute() {
          executionCount++;
          context.setVariable('counter', executionCount);
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockCounterExecutor() as any);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Increment',
        type: NodeType.CODE,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'While Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'while',
          whileConfig: {
            condition: 'counter < 5',
            maxIterations: 100
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.iterationsCompleted).toBe(5);
    });

    it('should prevent infinite loops with maxIterations', async () => {
      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Child',
        type: NodeType.END,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Infinite Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'while',
          whileConfig: {
            condition: 'true',
            maxIterations: 10
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MAX_ITERATIONS_EXCEEDED');
    });

    it('should handle while condition with complex expression', async () => {
      context.setVariable('limit', 3);
      let executionCount = 0;

      class MockCounterExecutor {
        readonly type = NodeType.CODE;
        async execute() {
          executionCount++;
          context.setVariable('counter', executionCount);
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockCounterExecutor() as any);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Increment',
        type: NodeType.CODE,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'While Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'while',
          whileConfig: {
            condition: 'counter < limit',
            maxIterations: 100
          },
          childNode
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.iterationsCompleted).toBe(3);
    });
  });

  describe('execute - result aggregation', () => {
    it('should aggregate all iteration results', async () => {
      class MockCodeExecutor {
        readonly type = NodeType.CODE;
        async execute(_node: WorkflowNode, ctx: NodeExecutionContextImpl) {
          const index = ctx.getVariable('index');
          return {
            success: true,
            status: 'completed' as const,
            output: { value: index * 2 }
          };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockCodeExecutor() as any);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Double',
        type: NodeType.CODE,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: 3
          },
          childNode,
          outputMapping: {
            aggregateResults: true,
            resultsVariablePath: 'loopResults'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.results).toHaveLength(3);
    });
  });

  describe('execute - error handling', () => {
    it('should stop loop on child error when breakOnError is true', async () => {
      let callCount = 0;

      class MockFailingExecutor {
        readonly type = NodeType.CODE;
        async execute() {
          callCount++;
          if (callCount === 2) {
            return {
              success: false,
              status: 'failed' as const,
              error: { code: 'ERROR', message: 'Failed' }
            };
          }
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockFailingExecutor() as any);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Sometimes Fails',
        type: NodeType.CODE,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: 5
          },
          childNode,
          breakOnError: true
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(callCount).toBe(2);
      expect(result.error?.details?.iterationsFailed).toBe(1);
    });

    it('should continue on error when continueOnError is true', async () => {
      let callCount = 0;

      class MockFailingExecutor {
        readonly type = NodeType.CODE;
        async execute() {
          callCount++;
          if (callCount === 2) {
            return {
              success: false,
              status: 'failed' as const,
              error: { code: 'ERROR', message: 'Failed' }
            };
          }
          return { success: true, status: 'completed' as const, output: {} };
        }
        validate() {
          return { valid: true };
        }
      }

      registry.register(new MockFailingExecutor() as any);

      const childNode: WorkflowNode = {
        nodeId: 'child-1',
        name: 'Sometimes Fails',
        type: NodeType.CODE,
        dependencies: [],
        dependents: [],
        config: {}
      };

      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: 5
          },
          childNode,
          continueOnError: true
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(callCount).toBe(5);
      expect(result.output?.iterationsFailed).toBe(1);
    });
  });

  describe('validate', () => {
    it('should validate valid for loop node', () => {
      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'For Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {
            iterations: 5
          },
          childNode: {
            nodeId: 'child-1',
            name: 'Child',
            type: NodeType.END,
            dependencies: [],
            dependents: [],
            config: {}
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(true);
    });

    it('should require loop type', () => {
      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          childNode: {
            nodeId: 'child-1',
            name: 'Child',
            type: NodeType.END,
            dependencies: [],
            dependents: [],
            config: {}
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('loopType is required');
    });

    it('should require child node', () => {
      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('childNode is required');
    });

    it('should validate for loop has iterations', () => {
      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'for',
          forConfig: {},
          childNode: {
            nodeId: 'child-1',
            name: 'Child',
            type: NodeType.END,
            dependencies: [],
            dependents: [],
            config: {}
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('iterations'))).toBe(true);
    });

    it('should validate foreach loop has arrayExpression', () => {
      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'foreach',
          foreachConfig: {},
          childNode: {
            nodeId: 'child-1',
            name: 'Child',
            type: NodeType.END,
            dependencies: [],
            dependents: [],
            config: {}
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('arrayExpression'))).toBe(true);
    });

    it('should validate while loop has condition', () => {
      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'while',
          whileConfig: {},
          childNode: {
            nodeId: 'child-1',
            name: 'Child',
            type: NodeType.END,
            dependencies: [],
            dependents: [],
            config: {}
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('condition'))).toBe(true);
    });

    it('should validate loop type values', () => {
      const node: WorkflowNode = {
        nodeId: 'loop-1',
        name: 'Loop',
        type: NodeType.LOOP,
        dependencies: [],
        dependents: [],
        config: {
          loopType: 'invalid',
          childNode: {
            nodeId: 'child-1',
            name: 'Child',
            type: NodeType.END,
            dependencies: [],
            dependents: [],
            config: {}
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('Invalid loop type'))).toBe(true);
    });
  });
});
