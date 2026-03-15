import { LLMNodeExecutor } from '../executors/llm.executor';
import { NodeType, WorkflowNode } from '../entities/workflow-definition.entity';
import { NodeExecutionContextImpl } from '../executors/node.executor';

// Simple mock for Anthropic SDK
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }))
}));

describe('LLMNodeExecutor', () => {
  let executor: LLMNodeExecutor;
  let context: NodeExecutionContextImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReset();

    executor = new LLMNodeExecutor();
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'llm-node',
      { userInput: 'Hello' },
      {}
    );
    context.setSecret('ANTHROPIC_API_KEY', 'test-api-key');
  });

  describe('type', () => {
    it('should have LLM type', () => {
      expect(executor.type).toBe(NodeType.LLM);
    });
  });

  describe('execute - basic completion', () => {
    it('should call LLM with correct parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        usage: { input_tokens: 10, output_tokens: 20 },
        stop_reason: 'end_turn'
      });

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Greeting',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          model: 'claude-sonnet-4-6',
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'User says: ${userInput}',
          temperature: 0.7,
          maxTokens: 1000
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        temperature: 0.7,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'User says: Hello' }],
        stream: false
      }));
    });

    it('should return LLM response in output', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'The answer is 42' }],
        usage: { input_tokens: 15, output_tokens: 25 },
        stop_reason: 'end_turn'
      });

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Answer',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          model: 'claude-sonnet-4-6',
          userPrompt: 'What is the meaning of life?'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toMatchObject({
        content: 'The answer is 42',
        usage: { inputTokens: 15, outputTokens: 25 },
        finishReason: 'end_turn'
      });
    });

    it('should work without system prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 10 },
        stop_reason: 'stop_sequence'
      });

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Simple',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          model: 'claude-sonnet-4-6',
          userPrompt: 'Simple question'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('system');
    });
  });

  describe('execute - template rendering', () => {
    it('should render template variables', async () => {
      context.setVariable('userName', 'Alice');

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello Alice!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn'
      });

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Personalize',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          model: 'claude-sonnet-4-6',
          userPrompt: 'Hello ${userName}'
        }
      };

      await executor.execute(node, context);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        messages: [{ role: 'user', content: 'Hello Alice' }]
      }));
    });
  });

  describe('execute - response formats', () => {
    it('should handle JSON response format', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"result": "success"}' }],
        usage: { input_tokens: 10, output_tokens: 30 },
        stop_reason: 'end_turn'
      });

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'JSON',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          model: 'claude-sonnet-4-6',
          userPrompt: 'Return JSON',
          responseFormat: 'json'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.parsedJson).toEqual({ result: 'success' });
    });
  });

  describe('execute - error handling', () => {
    it('should handle missing config', async () => {
      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Broken',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {}
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIG_ERROR');
    });

    it('should handle missing userPrompt', async () => {
      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Broken',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: { model: 'claude-sonnet-4-6' }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIG_ERROR');
    });

    it('should handle missing API key', async () => {
      // Clear env variable and context secret
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      context = new NodeExecutionContextImpl('exec-001', 'wf-001', 'llm-node', {}, {});
      // No API key set

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'No Key',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          model: 'claude-sonnet-4-6',
          userPrompt: 'Hello'
        }
      };

      const result = await executor.execute(node, context);

      // Restore env
      if (originalEnv) process.env.ANTHROPIC_API_KEY = originalEnv;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIG_ERROR');
    });

    it('should handle API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limit'));

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Error',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          model: 'claude-sonnet-4-6',
          userPrompt: 'Hello'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LLM_ERROR');
    });
  });

  describe('execute - model defaults', () => {
    it('should use default model', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn'
      });

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Default',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: { userPrompt: 'Hello' }
      };

      await executor.execute(node, context);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'claude-sonnet-4-6'
      }));
    });

    it('should use default temperature', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn'
      });

      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Default',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: { model: 'claude-sonnet-4-6', userPrompt: 'Hello' }
      };

      await executor.execute(node, context);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7
      }));
    });
  });

  describe('validate', () => {
    it('should validate valid LLM node', () => {
      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Valid',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: { model: 'claude-sonnet-4-6', userPrompt: 'Hello' }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(true);
    });

    it('should require userPrompt', () => {
      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Invalid',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: { model: 'claude-sonnet-4-6' }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('userPrompt is required');
    });

    it('should validate temperature range', () => {
      const node: WorkflowNode = {
        nodeId: 'llm-1',
        name: 'Invalid',
        type: NodeType.LLM,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: { model: 'claude-sonnet-4-6', userPrompt: 'Hello', temperature: 1.5 }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('temperature must be between 0 and 1');
    });
  });
});
