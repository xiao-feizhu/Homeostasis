/**
 * RetryExecutor 重试执行器
 *
 * 包装节点执行，支持重试策略和死信队列集成
 */

import { ErrorClassifier } from './error.classifier';
import { RetryPolicy } from './retry.policy';
import { DeadLetterQueue } from './dead.letter.queue';
import {
  NodeExecutor,
  NodeExecutionContext,
  NodeExecutionResult,
  createErrorResult
} from '../executors/node.executor';
import { WorkflowNode } from '../entities/workflow-definition.entity';

/**
 * 重试执行选项
 */
export interface RetryExecuteOptions {
  retryPolicy?: RetryPolicy;
  sendToDlq?: boolean;
}

/**
 * 执行元数据
 */
export interface ExecutionMetadata {
  retryCount: number;
  totalAttempts: number;
  duration: number;
  startTime: Date;
  endTime: Date;
}

/**
 * 重试执行器
 */
export class RetryExecutor {
  constructor(
    private errorClassifier: ErrorClassifier,
    private dlq: DeadLetterQueue
  ) {}

  /**
   * 执行节点，支持重试
   */
  async execute(
    node: WorkflowNode,
    context: NodeExecutionContext,
    executor: NodeExecutor,
    options: RetryExecuteOptions = {}
  ): Promise<NodeExecutionResult & { metadata?: ExecutionMetadata }> {
    const startTime = Date.now();
    const startDate = new Date();

    // 如果没有配置重试策略，直接执行
    if (!options.retryPolicy) {
      try {
        const result = await executor.execute(node, context);
        return {
          ...result,
          metadata: {
            retryCount: 0,
            totalAttempts: 1,
            duration: Date.now() - startTime,
            startTime: startDate,
            endTime: new Date()
          }
        };
      } catch (error) {
        return this.handleExecutionError(error as Error, node, context, startTime, startDate);
      }
    }

    // 使用重试策略执行
    return this.executeWithRetry(
      node,
      context,
      executor,
      options,
      startTime,
      startDate
    );
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry(
    node: WorkflowNode,
    context: NodeExecutionContext,
    executor: NodeExecutor,
    options: RetryExecuteOptions,
    startTime: number,
    startDate: Date
  ): Promise<NodeExecutionResult & { metadata?: ExecutionMetadata }> {
    const policy = options.retryPolicy!;
    const maxRetries = policy.config.maxRetries;
    let lastError: Error | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await executor.execute(node, context);

        // 调用成功回调
        if (policy.config.onSuccess) {
          policy.config.onSuccess({
            success: true,
            result,
            attempts: attempt + 1,
            totalDuration: Date.now() - startTime
          });
        }

        return {
          ...result,
          metadata: {
            retryCount,
            totalAttempts: attempt + 1,
            duration: Date.now() - startTime,
            startTime: startDate,
            endTime: new Date()
          }
        };
      } catch (error) {
        lastError = error as Error;

        // 检查错误是否可重试
        if (!this.errorClassifier.isRetryable(lastError)) {
          return this.handleExecutionError(
            lastError,
            node,
            context,
            startTime,
            startDate
          );
        }

        // 检查是否应该继续重试
        const retryContext = {
          attempt: attempt + 1,
          error: lastError,
          startTime
        };

        if (attempt >= maxRetries || !policy.shouldRetry(attempt + 1, retryContext)) {
          break;
        }

        // 重试计数
        retryCount++;

        // 调用重试回调
        if (policy.config.onRetry) {
          policy.config.onRetry(retryContext);
        }

        // 等待延迟时间
        const delay = policy.calculateDelay(attempt + 1);
        await this.sleep(delay);
      }
    }

    // 重试耗尽
    return this.handleRetryExhausted(
      lastError!,
      node,
      context,
      retryCount,
      options.sendToDlq ?? true,
      startTime,
      startDate,
      policy
    );
  }

  /**
   * 处理执行错误
   */
  private handleExecutionError(
    error: Error,
    node: WorkflowNode,
    _context: NodeExecutionContext,
    startTime: number,
    startDate: Date
  ): NodeExecutionResult & { metadata?: ExecutionMetadata } {
    const duration = Date.now() - startTime;

    // 提取错误代码
    const errorCode = (error as any).code ||
      error.name.replace('Error', '').toUpperCase() ||
      'NODE_EXECUTION_FAILED';

    return {
      ...createErrorResult(
        errorCode,
        error.message,
        {
          nodeId: node.nodeId,
          nodeType: node.type,
          stack: error.stack
        }
      ),
      metadata: {
        retryCount: 0,
        totalAttempts: 1,
        duration,
        startTime: startDate,
        endTime: new Date()
      }
    };
  }

  /**
   * 处理重试耗尽
   */
  private async handleRetryExhausted(
    error: Error,
    node: WorkflowNode,
    context: NodeExecutionContext,
    retryCount: number,
    sendToDlq: boolean,
    startTime: number,
    startDate: Date,
    policy?: RetryPolicy
  ): Promise<NodeExecutionResult & { metadata?: ExecutionMetadata }> {
    const duration = Date.now() - startTime;

    // 调用耗尽回调
    if (policy?.config.onExhausted) {
      policy.config.onExhausted(error, retryCount + 1);
    }

    // 发送到死信队列
    if (sendToDlq) {
      await this.dlq.add({
        executionId: context.executionId,
        workflowId: context.workflowId,
        nodeId: node.nodeId,
        error,
        timestamp: new Date(),
        context: {
          input: context.input,
          state: context.state
        },
        retryCount
      });
    }

    return {
      ...createErrorResult(
        'MAX_RETRIES_EXCEEDED',
        `Max retries exceeded: ${error.message}`,
        {
          nodeId: node.nodeId,
          nodeType: node.type,
          originalError: error.message,
          retryCount
        }
      ),
      metadata: {
        retryCount,
        totalAttempts: retryCount + 1,
        duration,
        startTime: startDate,
        endTime: new Date()
      }
    };
  }

  /**
   * 休眠指定毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
