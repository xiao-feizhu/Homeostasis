import {
  FixedIntervalRetryPolicy,
  ExponentialBackoffRetryPolicy,
  LinearRetryPolicy,
  CustomRetryPolicy,
  RetryContext,
  RetryExhaustedError,
} from '../errors/retry.policy';
import { jest } from '@jest/globals';

describe('Retry Policies', () => {
  describe('FixedIntervalRetryPolicy', () => {
    it('should calculate fixed retry delays', () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 1000,
      });

      expect(policy.calculateDelay(1)).toBe(1000);
      expect(policy.calculateDelay(2)).toBe(1000);
      expect(policy.calculateDelay(3)).toBe(1000);
    });

    it('should respect maxRetries limit', () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 2,
        intervalMs: 1000,
      });

      expect(policy.shouldRetry(1)).toBe(true);
      expect(policy.shouldRetry(2)).toBe(true);
      expect(policy.shouldRetry(3)).toBe(false);
    });

    it('should respect maxDurationMs limit', async () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 10,
        intervalMs: 100,
        maxDurationMs: 250,
      });

      const context: RetryContext = {
        attempt: 1,
        error: new Error('test'),
        startTime: Date.now() - 300, // Started 300ms ago
      };

      expect(policy.shouldRetry(1, context)).toBe(false);
    });

    it('should execute async function with retries', async () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10,
      });

      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await policy.execute(fn);

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw RetryExhaustedError when all retries fail', async () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 2,
        intervalMs: 10,
      });

      const fn = async () => {
        throw new Error('Persistent failure');
      };

      await expect(policy.execute(fn)).rejects.toThrow(RetryExhaustedError);
    });

    it('should call onRetry callback before each retry', async () => {
      const onRetry = jest.fn();
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10,
        onRetry,
      });

      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      await policy.execute(fn);

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          error: expect.any(Error),
        })
      );
    });

    it('should not retry non-retryable errors when configured', async () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10,
        retryableErrorTest: (error: Error) => error.message.includes('[RETRYABLE]'),
      });

      const fn = async () => {
        throw new Error('Configuration error');
      };

      await expect(policy.execute(fn)).rejects.toThrow('Configuration error');
    });
  });

  describe('ExponentialBackoffRetryPolicy', () => {
    it('should calculate exponential retry delays', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        maxRetries: 5,
        baseDelayMs: 100,
        maxDelayMs: 5000,
      });

      expect(policy.calculateDelay(1)).toBe(100);
      expect(policy.calculateDelay(2)).toBe(200);
      expect(policy.calculateDelay(3)).toBe(400);
      expect(policy.calculateDelay(4)).toBe(800);
    });

    it('should respect maxDelayMs cap', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        maxRetries: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
      });

      expect(policy.calculateDelay(1)).toBe(1000);
      expect(policy.calculateDelay(2)).toBe(2000);
      expect(policy.calculateDelay(3)).toBe(4000);
      expect(policy.calculateDelay(4)).toBe(5000); // Capped
      expect(policy.calculateDelay(5)).toBe(5000); // Capped
    });

    it('should add jitter to delay when configured', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        maxRetries: 5,
        baseDelayMs: 100,
        jitter: true,
      });

      const delay = policy.calculateDelay(2);

      // With jitter (0% to +25%), delay should be between base (200) and 250
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThanOrEqual(250);
    });

    it('should use multiplier for custom backoff factor', () => {
      const policy = new ExponentialBackoffRetryPolicy({
        maxRetries: 5,
        baseDelayMs: 100,
        multiplier: 3,
      });

      expect(policy.calculateDelay(1)).toBe(100);
      expect(policy.calculateDelay(2)).toBe(300);
      expect(policy.calculateDelay(3)).toBe(900);
    });
  });

  describe('LinearRetryPolicy', () => {
    it('should calculate linearly increasing delays', () => {
      const policy = new LinearRetryPolicy({
        maxRetries: 5,
        baseDelayMs: 100,
        incrementMs: 50,
      });

      expect(policy.calculateDelay(1)).toBe(100);
      expect(policy.calculateDelay(2)).toBe(150);
      expect(policy.calculateDelay(3)).toBe(200);
      expect(policy.calculateDelay(4)).toBe(250);
    });

    it('should respect maxDelayMs cap', () => {
      const policy = new LinearRetryPolicy({
        maxRetries: 10,
        baseDelayMs: 100,
        incrementMs: 100,
        maxDelayMs: 300,
      });

      expect(policy.calculateDelay(1)).toBe(100);
      expect(policy.calculateDelay(2)).toBe(200);
      expect(policy.calculateDelay(3)).toBe(300);
      expect(policy.calculateDelay(4)).toBe(300); // Capped
    });
  });

  describe('CustomRetryPolicy', () => {
    it('should use custom delay function', () => {
      const policy = new CustomRetryPolicy({
        maxRetries: 5,
        delayFn: (attempt) => attempt * 100,
      });

      expect(policy.calculateDelay(1)).toBe(100);
      expect(policy.calculateDelay(2)).toBe(200);
      expect(policy.calculateDelay(3)).toBe(300);
    });

    it('should use custom shouldRetry function', () => {
      const policy = new CustomRetryPolicy({
        maxRetries: 10,
        delayFn: () => 100,
        shouldRetryFn: (context: RetryContext) => context.error.message.includes('[RETRY]'),
      });

      const shouldRetryContext: RetryContext = {
        attempt: 1,
        error: new Error('Error [RETRY]'),
        startTime: Date.now(),
      };

      const shouldNotRetryContext: RetryContext = {
        attempt: 1,
        error: new Error('Fatal configuration error'),
        startTime: Date.now(),
      };

      expect(policy.shouldRetry(1, shouldRetryContext)).toBe(true);
      expect(policy.shouldRetry(1, shouldNotRetryContext)).toBe(false);
    });
  });

  describe('RetryExhaustedError', () => {
    it('should contain retry history', async () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 2,
        intervalMs: 10,
      });

      // maxRetries=2 意味着初始尝试 + 2 次重试 = 3 次尝试
      const errors = [new Error('Error 1'), new Error('Error 2'), new Error('Error 3')];
      let index = 0;

      const fn = async () => {
        throw errors[index++];
      };

      try {
        await policy.execute(fn);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExhaustedError);
        expect((error as RetryExhaustedError).attempts).toBe(3);
        expect((error as RetryExhaustedError).lastError.message).toBe('Error 3');
        expect((error as RetryExhaustedError).errors).toHaveLength(3);
      }
    });
  });

  describe('execute with retry condition', () => {
    it('should only retry matching errors', async () => {
      const policy = new FixedIntervalRetryPolicy({
        maxRetries: 3,
        intervalMs: 10,
        retryableErrorTest: (error: Error) => error.message.includes('[RETRYABLE]'),
      });

      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Error [RETRYABLE]');
        }
        if (attempts === 2) {
          throw new Error('Fatal configuration error');
        }
        return 'success';
      };

      // Should throw 'Fatal configuration error' on second attempt without retrying
      await expect(policy.execute(fn)).rejects.toThrow('Fatal configuration error');
      expect(attempts).toBe(2);
    });
  });
});
