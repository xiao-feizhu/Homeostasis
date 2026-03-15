import {
  NodeExecutorRegistry,
  UnknownNodeTypeError,
  ExecutorAlreadyExistsError
} from '../executors/executor.registry';
import { NodeExecutor, NodeExecutionContext, createSuccessResult } from '../executors/node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';

describe('NodeExecutorRegistry', () => {
  let registry: NodeExecutorRegistry;

  beforeEach(() => {
    registry = new NodeExecutorRegistry();
  });

  const createMockExecutor = (type: NodeType): NodeExecutor => ({
    type,
    execute: jest.fn().mockResolvedValue(
      createSuccessResult({ result: 'ok' })
    ),
    validate: jest.fn().mockReturnValue({ valid: true })
  });

  const createMockNode = (type: NodeType): WorkflowNode => ({
    nodeId: 'node-1',
    name: 'Test Node',
    type,
    dependencies: [],
    dependents: []
  });

  const createMockContext = (): NodeExecutionContext => ({
    executionId: 'exec-001',
    workflowId: 'wf-001',
    nodeId: 'node-1',
    input: {},
    state: {},
    getVariable: jest.fn(),
    setVariable: jest.fn(),
    getSecret: jest.fn()
  });

  describe('register', () => {
    it('should register executor', () => {
      const executor = createMockExecutor(NodeType.CODE);
      registry.register(executor);

      expect(registry.has(NodeType.CODE)).toBe(true);
    });

    it('should throw error for duplicate registration', () => {
      const executor = createMockExecutor(NodeType.CODE);
      registry.register(executor);

      expect(() => registry.register(executor)).toThrow(ExecutorAlreadyExistsError);
    });
  });

  describe('unregister', () => {
    it('should unregister executor', () => {
      const executor = createMockExecutor(NodeType.CODE);
      registry.register(executor);

      const result = registry.unregister(NodeType.CODE);

      expect(result).toBe(true);
      expect(registry.has(NodeType.CODE)).toBe(false);
    });

    it('should return false for non-existent executor', () => {
      const result = registry.unregister(NodeType.CODE);
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should get registered executor', () => {
      const executor = createMockExecutor(NodeType.CODE);
      registry.register(executor);

      const retrieved = registry.get(NodeType.CODE);

      expect(retrieved).toBe(executor);
    });

    it('should throw error for unknown type', () => {
      expect(() => registry.get(NodeType.CODE)).toThrow(UnknownNodeTypeError);
    });
  });

  describe('has', () => {
    it('should return true for registered executor', () => {
      registry.register(createMockExecutor(NodeType.CODE));
      expect(registry.has(NodeType.CODE)).toBe(true);
    });

    it('should return false for unregistered executor', () => {
      expect(registry.has(NodeType.CODE)).toBe(false);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return all registered types', () => {
      registry.register(createMockExecutor(NodeType.CODE));
      registry.register(createMockExecutor(NodeType.API));
      registry.register(createMockExecutor(NodeType.LLM));

      const types = registry.getRegisteredTypes();

      expect(types).toHaveLength(3);
      expect(types).toContain(NodeType.CODE);
      expect(types).toContain(NodeType.API);
      expect(types).toContain(NodeType.LLM);
    });
  });

  describe('clear', () => {
    it('should clear all executors', () => {
      registry.register(createMockExecutor(NodeType.CODE));
      registry.register(createMockExecutor(NodeType.API));

      registry.clear();

      expect(registry.has(NodeType.CODE)).toBe(false);
      expect(registry.has(NodeType.API)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute node with registered executor', async () => {
      const executor = createMockExecutor(NodeType.CODE);
      registry.register(executor);

      const node = createMockNode(NodeType.CODE);
      const context = createMockContext();

      const result = await registry.execute(node, context);

      expect(executor.execute).toHaveBeenCalledWith(node, context);
      expect(result.success).toBe(true);
    });

    it('should throw error for unknown node type', async () => {
      const node = createMockNode(NodeType.CODE);
      const context = createMockContext();

      await expect(registry.execute(node, context)).rejects.toThrow(UnknownNodeTypeError);
    });
  });

  describe('validate', () => {
    it('should validate node with registered executor', () => {
      const executor = createMockExecutor(NodeType.CODE);
      registry.register(executor);

      const node = createMockNode(NodeType.CODE);
      const result = registry.validate(node);

      expect(executor.validate).toHaveBeenCalledWith(node);
      expect(result.valid).toBe(true);
    });

    it('should return error for unknown node type', () => {
      const node = createMockNode(NodeType.CODE);
      const result = registry.validate(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No executor registered for node type: code');
    });

    it('should include executor validation errors', () => {
      const executor = createMockExecutor(NodeType.CODE);
      executor.validate = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Missing config', 'Invalid timeout']
      });
      registry.register(executor);

      const node = createMockNode(NodeType.CODE);
      const result = registry.validate(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing config');
      expect(result.errors).toContain('Invalid timeout');
    });
  });
});
