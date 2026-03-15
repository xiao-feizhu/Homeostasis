import {
  NodeExecutionContextImpl,
  createSuccessResult,
  createErrorResult,
  NodeExecutor
} from '../executors/node.executor';
import { NodeType, NodeExecutionStatus } from '../entities/workflow-definition.entity';

describe('NodeExecutionContextImpl', () => {
  let context: NodeExecutionContextImpl;

  beforeEach(() => {
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'node-1',
      { name: 'Test', value: 100 },
      { existing: 'state' }
    );
  });

  describe('getVariable', () => {
    it('should get variable from state', () => {
      expect(context.getVariable('name')).toBe('Test');
      expect(context.getVariable('value')).toBe(100);
    });

    it('should get nested variable', () => {
      context.setVariable('user.name', 'John');
      expect(context.getVariable('user.name')).toBe('John');
    });

    it('should return undefined for non-existent variable', () => {
      expect(context.getVariable('nonexistent')).toBeUndefined();
    });
  });

  describe('setVariable', () => {
    it('should set variable', () => {
      context.setVariable('newVar', 'newValue');
      expect(context.getVariable('newVar')).toBe('newValue');
    });

    it('should create nested objects', () => {
      context.setVariable('level1.level2.level3', 'deep');
      expect(context.getVariable('level1.level2.level3')).toBe('deep');
    });
  });

  describe('renderTemplate', () => {
    it('should render template with variables', () => {
      const result = context.renderTemplate('Hello ${name}, value is ${value}');
      expect(result).toBe('Hello Test, value is 100');
    });

    it('should keep placeholder for undefined variables', () => {
      const result = context.renderTemplate('Hello ${nonexistent}');
      expect(result).toBe('Hello ${nonexistent}');
    });

    it('should handle nested variables in template', () => {
      context.setVariable('user.name', 'Alice');
      const result = context.renderTemplate('User: ${user.name}');
      expect(result).toBe('User: Alice');
    });
  });

  describe('secrets', () => {
    it('should get and set secrets', () => {
      context.setSecret('apiKey', 'secret123');
      expect(context.getSecret('apiKey')).toBe('secret123');
    });

    it('should return undefined for non-existent secret', () => {
      expect(context.getSecret('nonexistent')).toBeUndefined();
    });
  });
});

describe('Result Helpers', () => {
  describe('createSuccessResult', () => {
    it('should create success result', () => {
      const result = createSuccessResult({ output: 'test' }, 100);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ output: 'test' });
      expect(result.status).toBe(NodeExecutionStatus.COMPLETED);
      expect(result.executionTime).toBe(100);
    });
  });

  describe('createErrorResult', () => {
    it('should create error result', () => {
      const result = createErrorResult('ERR_001', 'Something failed', { detail: 'info' });

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeExecutionStatus.FAILED);
      expect(result.error).toEqual({
        code: 'ERR_001',
        message: 'Something failed',
        details: { detail: 'info' }
      });
    });
  });
});

describe('NodeExecutor Interface', () => {
  it('should define executor interface', () => {
    const mockExecutor: NodeExecutor = {
      type: NodeType.CODE,
      execute: jest.fn(),
      validate: jest.fn()
    };

    expect(mockExecutor.type).toBe(NodeType.CODE);
    expect(typeof mockExecutor.execute).toBe('function');
    expect(typeof mockExecutor.validate).toBe('function');
  });
});
