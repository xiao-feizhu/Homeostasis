import { StartNodeExecutor, EndNodeExecutor } from '../executors/start-end.executor';
import { NodeType, WorkflowNode } from '../entities/workflow-definition.entity';
import { NodeExecutionContextImpl } from '../executors/node.executor';

describe('StartNodeExecutor', () => {
  let executor: StartNodeExecutor;
  let context: NodeExecutionContextImpl;

  beforeEach(() => {
    executor = new StartNodeExecutor();
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'start-node',
      { initial: 'value' },
      {}
    );
  });

  describe('type', () => {
    it('should have START type', () => {
      expect(executor.type).toBe(NodeType.START);
    });
  });

  describe('execute', () => {
    it('should pass through input as output', async () => {
      const node: WorkflowNode = {
        nodeId: 'start-1',
        name: 'Start',
        type: NodeType.START,
        dependencies: [],
        dependents: ['node-2']
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ initial: 'value' });
    });

    it('should merge config defaults with input', async () => {
      const node: WorkflowNode = {
        nodeId: 'start-1',
        name: 'Start',
        type: NodeType.START,
        dependencies: [],
        dependents: ['node-2'],
        config: {
          defaults: {
            userName: 'Anonymous',
            region: 'default'
          }
        }
      };

      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'start-node',
        { userName: 'John' },
        {}
      );

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        userName: 'John',
        region: 'default'
      });
    });

    it('should handle empty input', async () => {
      const node: WorkflowNode = {
        nodeId: 'start-1',
        name: 'Start',
        type: NodeType.START,
        dependencies: [],
        dependents: ['node-2']
      };

      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'start-node',
        {},
        {}
      );

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({});
    });
  });

  describe('validate', () => {
    it('should validate start node with no dependencies', () => {
      const node: WorkflowNode = {
        nodeId: 'start-1',
        name: 'Start',
        type: NodeType.START,
        dependencies: [],
        dependents: ['node-2']
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(true);
    });

    it('should warn if start node has dependencies', () => {
      const node: WorkflowNode = {
        nodeId: 'start-1',
        name: 'Start',
        type: NodeType.START,
        dependencies: ['some-node'],
        dependents: ['node-2']
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Start node should not have dependencies');
    });
  });
});

describe('EndNodeExecutor', () => {
  let executor: EndNodeExecutor;
  let context: NodeExecutionContextImpl;

  beforeEach(() => {
    executor = new EndNodeExecutor();
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'end-node',
      {},
      { result: 'success', data: { value: 42 } }
    );
  });

  describe('type', () => {
    it('should have END type', () => {
      expect(executor.type).toBe(NodeType.END);
    });
  });

  describe('execute', () => {
    it('should return state as final output', async () => {
      const node: WorkflowNode = {
        nodeId: 'end-1',
        name: 'End',
        type: NodeType.END,
        dependencies: ['node-2'],
        dependents: []
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        result: 'success',
        data: { value: 42 }
      });
    });

    it('should select output fields based on config', async () => {
      const node: WorkflowNode = {
        nodeId: 'end-1',
        name: 'End',
        type: NodeType.END,
        dependencies: ['node-2'],
        dependents: [],
        config: {
          outputFields: ['result', 'summary']
        }
      };

      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'end-node',
        {},
        {
          result: 'completed',
          summary: 'Task done',
          internal: 'should not appear'
        }
      );

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        result: 'completed',
        summary: 'Task done'
      });
    });

    it('should return empty object if no state', async () => {
      const node: WorkflowNode = {
        nodeId: 'end-1',
        name: 'End',
        type: NodeType.END,
        dependencies: ['node-2'],
        dependents: []
      };

      context = new NodeExecutionContextImpl(
        'exec-001',
        'wf-001',
        'end-node',
        {},
        {}
      );

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({});
    });
  });

  describe('validate', () => {
    it('should validate end node with no dependents', () => {
      const node: WorkflowNode = {
        nodeId: 'end-1',
        name: 'End',
        type: NodeType.END,
        dependencies: ['node-2'],
        dependents: []
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(true);
    });

    it('should warn if end node has dependents', () => {
      const node: WorkflowNode = {
        nodeId: 'end-1',
        name: 'End',
        type: NodeType.END,
        dependencies: ['node-2'],
        dependents: ['some-node']
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('End node should not have dependents');
    });
  });
});
