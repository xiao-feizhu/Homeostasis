/**
 * 错误分类系统
 *
 * 用于区分可重试错误和不可重试错误，以及错误严重程度
 */

export enum ErrorCategory {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  BUSINESS = 'business',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  TRANSIENT = 'transient',   // 短暂性错误，通常可恢复
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  FATAL = 'fatal',           // 致命错误，不可恢复
  CLIENT = 'client',         // 客户端错误，通常需要修改请求
}

export interface ErrorClassification {
  category: ErrorCategory;
  retryable: boolean;
  severity: ErrorSeverity;
  suggestedRetryDelay?: number; // 建议重试延迟（毫秒）
}

/**
 * 基础工作流错误
 */
export class WorkflowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'WorkflowError';
    Object.setPrototypeOf(this, WorkflowError.prototype);
  }
}

/**
 * 可重试错误基类
 */
export class RetryableError extends WorkflowError {
  readonly retryable = true;

  constructor(message: string, cause?: Error) {
    super('RETRYABLE_ERROR', message, cause);
    this.name = 'RetryableError';
    Object.setPrototypeOf(this, RetryableError.prototype);
  }
}

/**
 * 不可重试错误基类
 */
export class NonRetryableError extends WorkflowError {
  readonly retryable = false;

  constructor(message: string, cause?: Error) {
    super('NON_RETRYABLE_ERROR', message, cause);
    this.name = 'NonRetryableError';
    Object.setPrototypeOf(this, NonRetryableError.prototype);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends RetryableError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'NetworkError';
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends RetryableError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'TimeoutError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends NonRetryableError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ValidationError';
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends NonRetryableError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ConfigurationError';
  }
}

/**
 * 错误分类器
 */
export class ErrorClassifier {
  private patterns: Array<{
    pattern: RegExp;
    category: ErrorCategory;
    retryable: boolean;
    severity: ErrorSeverity;
    retryDelay?: number;
  }> = [];

  constructor() {
    this.registerDefaultPatterns();
  }

  /**
   * 对错误进行分类
   */
  classify(error: Error): ErrorClassification {
    // 检查是否为 WorkflowError 子类（使用 name 属性作为备用）
    if (error instanceof WorkflowError || this.isWorkflowErrorByName(error)) {
      return this.classifyWorkflowError(error as WorkflowError);
    }

    // 基于错误消息模式匹配
    const message = error.message;
    const lowerMessage = message.toLowerCase();
    for (const { pattern, category, retryable, severity, retryDelay } of this.patterns) {
      // 同时检查原始消息和小写消息
      if (pattern.test(message) || pattern.test(lowerMessage)) {
        return {
          category,
          retryable,
          severity,
          suggestedRetryDelay: retryDelay,
        };
      }
    }

    // 默认保守策略：未知错误视为可重试
    return {
      category: ErrorCategory.UNKNOWN,
      retryable: true,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  /**
   * 通过 name 属性判断是否为 WorkflowError
   */
  private isWorkflowErrorByName(error: Error): boolean {
    const workflowErrorNames = [
      'WorkflowError',
      'RetryableError',
      'NonRetryableError',
      'NetworkError',
      'TimeoutError',
      'ValidationError',
      'ConfigurationError',
    ];
    return workflowErrorNames.includes(error.name);
  }

  /**
   * 判断错误是否可重试
   */
  isRetryable(error: Error): boolean {
    return this.classify(error).retryable;
  }

  /**
   * 注册自定义错误模式
   */
  registerPattern(
    pattern: RegExp,
    category: ErrorCategory,
    retryable: boolean,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    retryDelay?: number
  ): void {
    this.patterns.unshift({
      pattern,
      category,
      retryable,
      severity,
      retryDelay,
    });
  }

  /**
   * 分类 WorkflowError 子类
   */
  private classifyWorkflowError(error: WorkflowError): ErrorClassification {
    // 使用 error.name 进行判断，避免 instanceof 在跨模块时的 issues
    const errorName = error.name;

    if (errorName === 'NetworkError' || error instanceof NetworkError) {
      return {
        category: ErrorCategory.NETWORK,
        retryable: true,
        severity: ErrorSeverity.TRANSIENT,
        suggestedRetryDelay: 1000,
      };
    }

    if (errorName === 'TimeoutError' || error instanceof TimeoutError) {
      return {
        category: ErrorCategory.TIMEOUT,
        retryable: true,
        severity: ErrorSeverity.TRANSIENT,
        suggestedRetryDelay: 2000,
      };
    }

    if (errorName === 'ValidationError' || error instanceof ValidationError) {
      return {
        category: ErrorCategory.VALIDATION,
        retryable: false,
        severity: ErrorSeverity.CLIENT,
      };
    }

    if (errorName === 'ConfigurationError' || error instanceof ConfigurationError) {
      return {
        category: ErrorCategory.CONFIGURATION,
        retryable: false,
        severity: ErrorSeverity.FATAL,
      };
    }

    if (error instanceof RetryableError) {
      return {
        category: ErrorCategory.UNKNOWN,
        retryable: true,
        severity: ErrorSeverity.MEDIUM,
      };
    }

    if (error instanceof NonRetryableError) {
      return {
        category: ErrorCategory.UNKNOWN,
        retryable: false,
        severity: ErrorSeverity.HIGH,
      };
    }

    return {
      category: ErrorCategory.UNKNOWN,
      retryable: true,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  /**
   * 注册默认错误模式
   */
  private registerDefaultPatterns(): void {
    // 网络相关错误
    this.patterns.push(
      {
        pattern: /econnrefused|econnreset|enotfound|socket hang up|network error/i,
        category: ErrorCategory.NETWORK,
        retryable: true,
        severity: ErrorSeverity.TRANSIENT,
        retryDelay: 1000,
      },
      // 超时错误
      {
        pattern: /timeout|etimedout/i,
        category: ErrorCategory.TIMEOUT,
        retryable: true,
        severity: ErrorSeverity.TRANSIENT,
        retryDelay: 2000,
      },
      // 限流错误
      {
        pattern: /rate limit|429|too many requests/i,
        category: ErrorCategory.RATE_LIMIT,
        retryable: true,
        severity: ErrorSeverity.HIGH,
        retryDelay: 5000,
      },
      // 验证错误
      {
        pattern: /validation|invalid|bad request|400/i,
        category: ErrorCategory.VALIDATION,
        retryable: false,
        severity: ErrorSeverity.CLIENT,
      },
      // 配置错误
      {
        pattern: /configuration|config|missing.*key|api.*key/i,
        category: ErrorCategory.CONFIGURATION,
        retryable: false,
        severity: ErrorSeverity.FATAL,
      },
      // 认证错误
      {
        pattern: /unauthorized|401|forbidden|403/i,
        category: ErrorCategory.CONFIGURATION,
        retryable: false,
        severity: ErrorSeverity.FATAL,
      }
    );
  }
}
