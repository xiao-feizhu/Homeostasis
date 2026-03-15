import { CodeNodeExecutor } from '../executors/code.executor';
import { NodeType, WorkflowNode } from '../entities/workflow-definition.entity';
import { NodeExecutionContextImpl } from '../executors/node.executor';

describe('CodeNodeExecutor', () => {
  let executor: CodeNodeExecutor;
  let context: NodeExecutionContextImpl;

  beforeEach(() => {
    executor = new CodeNodeExecutor();
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'code-node',
      { input: 'hello' },
      {}
    );
  });

  describe('type', () => {
    it('should have CODE type', () => {
      expect(executor.type).toBe(NodeType.CODE);
    });
  });

  describe('execute - basic code execution', () => {
    it('should execute simple code and return result', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Process Data',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const result = input.toUpperCase();
            return { result };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: 'HELLO' });
    });

    it('should access input variables', async () => {
      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'code-node',
        { a: 10, b: 20 },
        {}
      );

      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Calculate',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const sum = a + b;
            const product = a * b;
            return { sum, product };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ sum: 30, product: 200 });
    });

    it('should access state variables', async () => {
      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'code-node',
        {},
        { counter: 5, message: 'test' }
      );

      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Process State',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const doubled = counter * 2;
            const upperMessage = message.toUpperCase();
            return { doubled, upperMessage };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ doubled: 10, upperMessage: 'TEST' });
    });

    it('should handle nested object access', async () => {
      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'code-node',
        { user: { name: 'John', age: 30 } },
        {}
      );

      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Extract User Info',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const greeting = 'Hello, ' + user.name;
            const isAdult = user.age >= 18;
            return { greeting, isAdult };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ greeting: 'Hello, John', isAdult: true });
    });
  });

  describe('execute - error handling', () => {
    it('should handle syntax errors', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Broken Code',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: 'this is not valid javascript }{'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CODE_ERROR');
    });

    it('should handle runtime errors', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Runtime Error',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const obj = null;
            return obj.something;
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CODE_ERROR');
    });

    it('should handle missing return', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'No Return',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: 'const x = 42;'
        }
      };

      const result = await executor.execute(node, context);

      // Should still succeed but with undefined output
      expect(result.success).toBe(true);
      expect(result.output).toEqual({});
    });
  });

  describe('execute - security restrictions', () => {
    it('should not allow require', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Security Test',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const fs = require('fs');
            return { result: 'should not work' };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CODE_ERROR');
    });

    it('should not allow eval', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Security Test',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            eval('const x = 1');
            return { result: 'should not work' };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CODE_ERROR');
    });

    it('should not allow Function constructor', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Security Test',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const fn = new Function('return 1');
            return { result: fn() };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CODE_ERROR');
    });

    it('should not allow accessing process', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Security Test',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            return { env: process.env };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CODE_ERROR');
    });

    it('should not allow accessing global', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Security Test',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            return { globalExists: typeof global !== 'undefined' };
          `
        }
      };

      const result = await executor.execute(node, context);

      // global should be undefined in sandbox
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ globalExists: false });
    });
  });

  describe('execute - timeout', () => {
    it('should timeout long-running code', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Slow Code',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            // Simulate long running task
            let count = 0;
            for (let i = 0; i < 1000000000; i++) {
              count++;
            }
            return { count };
          `,
          timeout: 100 // 100ms timeout
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });
  });

  describe('execute - available built-ins', () => {
    it('should allow JSON operations', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'JSON Parse',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const obj = JSON.parse('{"name":"test","value":42}');
            const str = JSON.stringify({ result: obj.value });
            return { parsed: obj, stringified: str };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.parsed).toEqual({ name: 'test', value: 42 });
      expect(result.output?.stringified).toBe('{"result":42}');
    });

    it('should allow Math operations', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Math Calc',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const sqrt = Math.sqrt(16);
            const floor = Math.floor(3.7);
            const max = Math.max(1, 5, 3);
            return { sqrt, floor, max };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ sqrt: 4, floor: 3, max: 5 });
    });

    it('should allow Date operations', async () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Date Test',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const now = new Date('2024-01-15');
            const year = now.getFullYear();
            const timestamp = now.getTime();
            return { year, timestamp };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.year).toBe(2024);
      expect(typeof result.output?.timestamp).toBe('number');
    });

    it('should allow array operations', async () => {
      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'code-node',
        { items: [1, 2, 3, 4, 5] },
        {}
      );

      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Array Ops',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const doubled = items.map(x => x * 2);
            const sum = items.reduce((a, b) => a + b, 0);
            const filtered = items.filter(x => x > 2);
            return { doubled, sum, filtered };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        doubled: [2, 4, 6, 8, 10],
        sum: 15,
        filtered: [3, 4, 5]
      });
    });

    it('should allow Object operations', async () => {
      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'code-node',
        { data: { a: 1, b: 2, c: 3 } },
        {}
      );

      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Object Ops',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: `
            const keys = Object.keys(data);
            const values = Object.values(data);
            const entries = Object.entries(data);
            return { keys, values, entries };
          `
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.keys).toEqual(['a', 'b', 'c']);
      expect(result.output?.values).toEqual([1, 2, 3]);
    });
  });

  describe('validate', () => {
    it('should validate valid code node', () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Valid Code',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: 'return { result: 42 };'
        }
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(true);
    });

    it('should require code config', () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Missing Code',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {}
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is required');
    });

    it('should require non-empty code', () => {
      const node: WorkflowNode = {
        nodeId: 'code-1',
        name: 'Empty Code',
        type: NodeType.CODE,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          code: '   '
        }
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is required');
    });
  });
});
