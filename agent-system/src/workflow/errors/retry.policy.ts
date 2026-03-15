/**
 * 重试策略系统
 *
 * 支持多种重试策略：固定间隔、指数退避、线性增长、自定义
 */

export interface RetryContext {
  attempt: number;
  error: Error;
  startTime: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

export interface RetryPolicyConfig {
  maxRetries: number;
  maxDurationMs?: number;
  retryableErrorTest?: (error: Error) => boolean;
  onRetry?: (context: RetryContext) => void;
  onSuccess?: (result: RetryResult<any>) => void;
  onExhausted?: (error: Error, attempts: number) => void;
}

/**
 * 重试耗尽错误
 */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
    public readonly errors: Error[]
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
    Object.setPrototypeOf(this, RetryExhaustedError.prototype);
  }
}

/**
 * 重试策略接口
 */
export interface RetryPolicy {
  readonly config: RetryPolicyConfig;

  /**
   * 计算第 N 次重试的延迟时间（毫秒）
   */
  calculateDelay(attempt: number): number;

  /**
   * 判断是否还应该继续重试
   */
  shouldRetry(attempt: number, context?: RetryContext): boolean;

  /**
   * 执行函数，自动进行重试
   */
  execute<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * 基础重试策略
 */
abstract class BaseRetryPolicy implements RetryPolicy {
  readonly config: RetryPolicyConfig;
  protected readonly errors: Error[] = [];

  constructor(config: RetryPolicyConfig) {
    this.config = config;
  }

  abstract calculateDelay(attempt: number): number;

  shouldRetry(attempt: number, context?: RetryContext): boolean {
    // 检查最大重试次数（attempt > maxRetries 时停止重试）
    if (attempt > this.config.maxRetries) {
      return false;
    }

    // 检查最大持续时间
    if (this.config.maxDurationMs && context) {
      const elapsed = Date.now() - context.startTime;
      if (elapsed >= this.config.maxDurationMs) {
        return false;
      }
    }

    // 检查错误是否可重试
    if (context?.error && this.config.retryableErrorTest) {
      return this.config.retryableErrorTest(context.error);
    }

    return true;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.errors.length = 0; // Clear previous errors

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        const result = await fn();

        if (this.config.onSuccess) {
          this.config.onSuccess({
            success: true,
            result,
            attempts: attempt,
            totalDuration: Date.now() - startTime,
          });
        }

        return result;
      } catch (error) {
        const err = error as Error;
        this.errors.push(err);

        const context: RetryContext = {
          attempt,
          error: err,
          startTime,
        };

        // 检查错误是否可重试（如果配置了 retryableErrorTest）
        if (this.config.retryableErrorTest && !this.config.retryableErrorTest(err)) {
          // 错误不可重试，直接抛出原始错误
          throw err;
        }

        // 检查是否应该重试
        if (!this.shouldRetry(attempt, context)) {
          if (this.config.onExhausted) {
            this.config.onExhausted(err, attempt);
          }
          throw this.createExhaustedError();
        }

        // 如果这是最后一次尝试，抛出错误
        if (attempt > this.config.maxRetries) {
          if (this.config.onExhausted) {
            this.config.onExhausted(err, attempt);
          }
          throw this.createExhaustedError();
        }

        // 调用重试回调
        if (this.config.onRetry) {
          this.config.onRetry(context);
        }

        // 等待延迟时间
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    // 不应该到达这里，但为了类型安全
    throw this.createExhaustedError();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createExhaustedError(): RetryExhaustedError {
    const lastError = this.errors[this.errors.length - 1];
    return new RetryExhaustedError(
      `All ${this.errors.length} retry attempts failed`,
      this.errors.length,
      lastError,
      [...this.errors]
    );
  }
}

/**
 * 固定间隔重试策略
 */
export class FixedIntervalRetryPolicy extends BaseRetryPolicy {
  private readonly intervalMs: number;

  constructor(config: RetryPolicyConfig & { intervalMs: number }) {
    super(config);
    this.intervalMs = config.intervalMs;
  }

  calculateDelay(_attempt: number): number {
    return this.intervalMs;
  }
}

/**
 * 指数退避重试策略
 */
export class ExponentialBackoffRetryPolicy extends BaseRetryPolicy {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly multiplier: number;
  private readonly jitter: boolean;

  constructor(config: RetryPolicyConfig & {
    baseDelayMs: number;
    maxDelayMs?: number;
    multiplier?: number;
    jitter?: boolean;
  }) {
    super(config);
    this.baseDelayMs = config.baseDelayMs;
    this.maxDelayMs = config.maxDelayMs ?? Infinity;
    this.multiplier = config.multiplier ?? 2;
    this.jitter = config.jitter ?? false;
  }

  calculateDelay(attempt: number): number {
    // 计算指数延迟: baseDelay * multiplier^(attempt-1)
    let delay = this.baseDelayMs * Math.pow(this.multiplier, attempt - 1);

    // 应用最大值限制
    delay = Math.min(delay, this.maxDelayMs);

    // 应用随机抖动 (0% 到 +25%，确保不超过 maxDelayMs)
    if (this.jitter) {
      const jitterFactor = 1 + Math.random() * 0.25;
      delay = Math.min(Math.floor(delay * jitterFactor), this.maxDelayMs);
    }

    return delay;
  }
}

/**
 * 线性增长重试策略
 */
export class LinearRetryPolicy extends BaseRetryPolicy {
  private readonly baseDelayMs: number;
  private readonly incrementMs: number;
  private readonly maxDelayMs: number;

  constructor(config: RetryPolicyConfig & {
    baseDelayMs: number;
    incrementMs: number;
    maxDelayMs?: number;
  }) {
    super(config);
    this.baseDelayMs = config.baseDelayMs;
    this.incrementMs = config.incrementMs;
    this.maxDelayMs = config.maxDelayMs ?? Infinity;
  }

  calculateDelay(attempt: number): number {
    // 计算线性延迟: baseDelay + (attempt-1) * increment
    const delay = this.baseDelayMs + (attempt - 1) * this.incrementMs;
    return Math.min(delay, this.maxDelayMs);
  }
}

/**
 * 自定义重试策略
 */
export class CustomRetryPolicy extends BaseRetryPolicy {
  private readonly delayFn: (attempt: number) => number;
  private readonly shouldRetryFn?: (context: RetryContext) => boolean;

  constructor(config: RetryPolicyConfig & {
    delayFn: (attempt: number) => number;
    shouldRetryFn?: (context: RetryContext) => boolean;
  }) {
    super(config);
    this.delayFn = config.delayFn;
    this.shouldRetryFn = config.shouldRetryFn;
  }

  calculateDelay(attempt: number): number {
    return this.delayFn(attempt);
  }

  shouldRetry(attempt: number, context?: RetryContext): boolean {
    // 先检查基础条件（最大重试次数和最大持续时间）
    if (attempt > this.config.maxRetries) {
      return false;
    }

    if (this.config.maxDurationMs && context) {
      const elapsed = Date.now() - context.startTime;
      if (elapsed >= this.config.maxDurationMs) {
        return false;
      }
    }

    // 应用自定义条件
    if (this.shouldRetryFn && context) {
      return this.shouldRetryFn(context);
    }

    // 检查错误是否可重试
    if (context?.error && this.config.retryableErrorTest) {
      return this.config.retryableErrorTest(context.error);
    }

    return true;
  }
}
