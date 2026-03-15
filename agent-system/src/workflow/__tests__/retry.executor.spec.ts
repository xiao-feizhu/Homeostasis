/**
 * RetryExecutor 测试
 *
 * TDD 开发 - 先写测试再实现
 */

import { RetryExecutor } from '../errors/retry.executor';
import { ErrorClassifier, NetworkError, ValidationError } from '../errors/error.classifier';
import {
  ExponentialBackoffRetryPolicy,
  FixedIntervalRetryPolicy
} from '../errors/retry.policy';
import {
  NodeExecutor,
  NodeExecutionContext,
  NodeExecutionResult,
  createSuccessResult
} from '../executors/node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { DeadLetterQueue } from '../errors/dead.letter.queue';

// 模拟节点执行器
class MockNodeExecutor implements NodeExecutor {
  readonly type = NodeType.CODE;
  executeCount = 0;
  shouldFail = false;
  failCount = 0;
  failTimes = 0;

  async execute(_node: WorkflowNode, _context: NodeExecutionContext): Promise<NodeExecutionResult> {
    this.executeCount++;

    if (this.shouldFail || (this.failTimes > 0 && this.failCount < this.failTimes)) {
      this.failCount++;
      throw new Error('Execution failed');
    }

    return createSuccessResult({ executed: true });
  }

  validate(): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  reset(): void {
    this.executeCount = 0;
    this.failCount = 0;
    this.shouldFail = false;
  }
}

// 模拟执行上下文
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

const createMockNode = (): WorkflowNode => ({
  nodeId: 'node-1',
  name: 'Test Node',
  type: NodeType.CODE,
  dependencies: [],
  dependents: [],
  config: { code: 'return {};' }
});

describe('RetryExecutor', () => {
  let retryExecutor: RetryExecutor;
  let mockExecutor: MockNodeExecutor;
  let errorClassifier: ErrorClassifier;
  let dlq: DeadLetterQueue;
  let mockNode: WorkflowNode;
  let mockContext: NodeExecutionContext;

  beforeEach(() => {
    errorClassifier = new ErrorClassifier();
    dlq = new DeadLetterQueue();
    retryExecutor = new RetryExecutor(errorClassifier, dlq);
    mockExecutor = new MockNodeExecutor();
    mockNode = createMockNode();
    mockContext = createMockContext();
  });

  afterEach(() => {
    mockExecutor.reset();
  });

  describe('execute without retry policy', () => {
    it('should execute node successfully without retry', async () => {
      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor
      );

      expect(result.success).toBe(true);
      expect(mockExecutor.executeCount).toBe(1);
    });

    it('should return error result when execution fails', async () => {
      mockExecutor.shouldFail = true;

      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NODE_EXECUTION_FAILED');
    });
  });

  describe('execute with retry policy', () => {
    it('should succeed on first attempt without retry', async () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 100
      });

      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy }
      );

      expect(result.success).toBe(true);
      expect(mockExecutor.executeCount).toBe(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      mockExecutor.failTimes = 2;
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10
      });

      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy }
      );

      expect(result.success).toBe(true);
      expect(mockExecutor.executeCount).toBe(3);
    });

    it('should fail after max retries exceeded', async () => {
      mockExecutor.shouldFail = true;
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 2,
        intervalMs: 10
      });

      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy }
      );

      expect(result.success).toBe(false);
      expect(mockExecutor.executeCount).toBe(3); // initial + 2 retries
      expect(result.error?.code).toBe('MAX_RETRIES_EXCEEDED');
    });

    it('should use exponential backoff between retries', async () => {
      mockExecutor.failTimes = 2;
      const policy = new ExponentialBackoffRetryPolicy({
        maxRetries: 3,
        baseDelayMs: 10,
        multiplier: 2
      });

      const startTime = Date.now();
      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy }
      );
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Should have at least 10ms + 20ms = 30ms of delay
      expect(duration).toBeGreaterThanOrEqual(25);
    });
  });

  describe('retryable error detection', () => {
    it('should not retry non-retryable errors', async () => {
      let callCount = 0;
      const validationExecutor: NodeExecutor = {
        type: NodeType.CODE,
        async execute() {
          callCount++;
          throw new ValidationError('Invalid input');
        },
        validate() {
          return { valid: true };
        }
      };

      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10
      });

      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        validationExecutor,
        { retryPolicy: policy }
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NON_RETRYABLE_ERROR'); // Error name with underscores
      expect(callCount).toBe(1); // Should not retry
    });

    it('should retry network errors', async () => {
      let callCount = 0;
      const networkExecutor: NodeExecutor = {
        type: NodeType.CODE,
        async execute() {
          callCount++;
          if (callCount < 2) {
            throw new NetworkError('Connection failed');
          }
          return createSuccessResult({ fixed: true });
        },
        validate() {
          return { valid: true };
        }
      };

      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10
      });

      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        networkExecutor,
        { retryPolicy: policy }
      );

      expect(result.success).toBe(true);
      expect(callCount).toBe(2);
    });
  });

  describe('retry callbacks', () => {
    it('should call onRetry callback on each retry', async () => {
      mockExecutor.failTimes = 2;
      const onRetry = jest.fn();

      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10,
        onRetry
      });

      await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy }
      );

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: expect.any(Number),
          error: expect.any(Error)
        })
      );
    });

    it('should call onSuccess callback on success', async () => {
      const onSuccess = jest.fn();

      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10,
        onSuccess
      });

      await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy }
      );

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          attempts: 1
        })
      );
    });

    it('should call onExhausted callback when retries exhausted', async () => {
      mockExecutor.shouldFail = true;
      const onExhausted = jest.fn();

      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 2,
        intervalMs: 10,
        onExhausted
      });

      await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy }
      );

      expect(onExhausted).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Number)
      );
    });
  });

  describe('dead letter queue integration', () => {
    it('should send failed execution to DLQ after max retries', async () => {
      mockExecutor.shouldFail = true;
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 1,
        intervalMs: 10
      });

      await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy, sendToDlq: true }
      );

      const items = await dlq.list({ status: 'pending' });
      expect(items).toHaveLength(1);
      expect(items[0].nodeId).toBe(mockNode.nodeId);
    });

    it('should not send to DLQ when sendToDlq is false', async () => {
      mockExecutor.shouldFail = true;
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 1,
        intervalMs: 10
      });

      await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy, sendToDlq: false }
      );

      const items = await dlq.list({ status: 'pending' });
      expect(items).toHaveLength(0);
    });
  });

  describe('execution metadata', () => {
    it('should include retry count in successful result', async () => {
      mockExecutor.failTimes = 2;
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10
      });

      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor,
        { retryPolicy: policy }
      );

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual(
        expect.objectContaining({
          retryCount: 2,
          totalAttempts: 3
        })
      );
    });

    it('should include execution duration in result', async () => {
      const result = await retryExecutor.execute(
        mockNode,
        mockContext,
        mockExecutor
      );

      expect(result.metadata).toEqual(
        expect.objectContaining({
          duration: expect.any(Number)
        })
      );
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
