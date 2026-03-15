import { NodeExecutor, ValidationResult, createSuccessResult, createErrorResult, NodeExecutionContext } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutorRegistry } from './executor.registry';

/**
 * Parallel 节点执行器
 *
 * 并行执行多个分支，支持多种完成策略
 */
export class ParallelNodeExecutor implements NodeExecutor {
  readonly type = NodeType.PARALLEL;

  constructor(private registry: NodeExecutorRegistry) {}

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};

    // 验证配置
    if (!config.branches || !Array.isArray(config.branches)) {
      return createErrorResult('CONFIG_ERROR', 'branches is required');
    }

    if (!config.completionStrategy) {
      return createErrorResult('CONFIG_ERROR', 'completionStrategy is required');
    }

    if (!config.errorHandling) {
      return createErrorResult('CONFIG_ERROR', 'errorHandling is required');
    }

    // 检查重复 branch ID
    const branchIds = config.branches.map((b: any) => b.branchId);
    if (new Set(branchIds).size !== branchIds.length) {
      return createErrorResult('CONFIG_ERROR', 'Duplicate branch IDs found');
    }

    // 过滤条件分支
    const activeBranches = config.branches.filter((branch: any) => {
      if (!branch.condition) return true;
      return this.evaluateCondition(branch.condition, context);
    });

    if (activeBranches.length === 0) {
      return createSuccessResult({
        completedBranches: [],
        failedBranches: [],
        timedOutBranches: [],
        branchResults: {}
      });
    }

    // 执行分支
    const timeout = config.timeout || 30000;

    try {
      const results = await this.executeBranches(
        activeBranches,
        context,
        config.completionStrategy,
        config.errorHandling,
        config.strategyConfig,
        timeout
      );

      // 检查结果
      const completedBranches: string[] = [];
      const failedBranches: string[] = [];
      const timedOutBranches: string[] = [];
      const branchResults: Record<string, any> = {};

      for (const [branchId, result] of results.entries()) {
        if (result.status === 'completed' && result.result?.success) {
          completedBranches.push(branchId);
          branchResults[branchId] = result.result.output;
        } else if (result.status === 'failed' || (result.result && !result.result.success)) {
          failedBranches.push(branchId);
          if (result.result?.output) {
            branchResults[branchId] = result.result.output;
          }
        } else if (result.status === 'timeout') {
          timedOutBranches.push(branchId);
        }
      }

      // 根据完成策略判断整体成功
      const success = this.isOverallSuccess(
        config.completionStrategy,
        config.strategyConfig,
        activeBranches.length,
        completedBranches.length,
        failedBranches.length
      );

      // 检查是否有超时
      if (timedOutBranches.length > 0 && config.errorHandling === 'fail_fast') {
        return createErrorResult(
          'TIMEOUT',
          `Parallel execution timed out. Timed out branches: ${timedOutBranches.length}`,
          { completedBranches, failedBranches, timedOutBranches, branchResults }
        );
      }

      if (!success && config.errorHandling === 'fail_fast') {
        return createErrorResult(
          'BRANCH_EXECUTION_ERROR',
          `Parallel execution failed. Completed: ${completedBranches.length}, Failed: ${failedBranches.length}`,
          { completedBranches, failedBranches, timedOutBranches, branchResults }
        );
      }

      // 结果聚合
      const output: Record<string, any> = {
        completedBranches,
        failedBranches,
        timedOutBranches,
        branchResults
      };

      if (config.resultAggregation?.includeBranchResults) {
        output.aggregatedResult = this.aggregateResults(
          branchResults,
          config.resultAggregation.mergeStrategy || 'object'
        );
      }

      return createSuccessResult(output);
    } catch (error) {
      return createErrorResult(
        'PARALLEL_EXECUTION_ERROR',
        `Parallel execution failed: ${(error as Error).message}`
      );
    }
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const config = node.config || {};

    if (!config.branches || !Array.isArray(config.branches)) {
      errors.push('branches is required');
    }

    if (!config.completionStrategy) {
      errors.push('completionStrategy is required');
    } else {
      const validStrategies = ['all', 'any', 'race', 'n_of_m'];
      if (!validStrategies.includes(config.completionStrategy)) {
        errors.push(`Invalid completionStrategy: ${config.completionStrategy}. Must be one of: ${validStrategies.join(', ')}`);
      }
    }

    if (!config.errorHandling) {
      errors.push('errorHandling is required');
    } else {
      const validHandlers = ['fail_fast', 'ignore_errors', 'wait_all'];
      if (!validHandlers.includes(config.errorHandling)) {
        errors.push(`Invalid errorHandling: ${config.errorHandling}. Must be one of: ${validHandlers.join(', ')}`);
      }
    }

    if (config.completionStrategy === 'n_of_m') {
      if (!config.strategyConfig?.requiredCount) {
        errors.push('strategyConfig.requiredCount is required for n_of_m strategy');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 执行分支
   */
  private async executeBranches(
    branches: any[],
    context: NodeExecutionContext,
    strategy: string,
    errorHandling: string,
    strategyConfig: any,
    timeout: number
  ): Promise<Map<string, { status: string; result?: any }>> {
    const results = new Map<string, { status: string; result?: any }>();
    const promises: Promise<void>[] = [];

    for (const branch of branches) {
      const promise = this.executeBranchWithTimeout(branch, context, timeout)
        .then(result => {
          results.set(branch.branchId, result);

          // 如果配置了 fail_fast 且有错误（但不是超时），抛出错误以停止其他分支
          if (errorHandling === 'fail_fast' && result.status !== 'timeout' && !result.result?.success) {
            throw new Error('Branch execution failed');
          }
        })
        .catch(error => {
          results.set(branch.branchId, { status: 'failed', result: { success: false, error: { message: error.message } } });

          if (errorHandling === 'fail_fast') {
            throw error;
          }
        });

      promises.push(promise);
    }

    // 根据策略等待结果
    if (strategy === 'any') {
      // 任意一个成功即返回
      await Promise.race(
        promises.map(p =>
          p.then(() => {
            const hasSuccess = Array.from(results.values()).some(r => r.result?.success);
            if (hasSuccess) return;
          })
        )
      ).catch(() => {});
    } else if (strategy === 'race') {
      // 第一个完成的（无论成功或失败）
      await Promise.race(promises).catch(() => {});
    } else if (strategy === 'n_of_m') {
      // 等待 N 个成功
      const requiredCount = strategyConfig?.requiredCount || 1;
      await Promise.race([
        Promise.all(promises).catch(() => {}),
        new Promise<void>((resolve) => {
          const check = () => {
            const successCount = Array.from(results.values()).filter(r => r.result?.success).length;
            if (successCount >= requiredCount) {
              resolve();
            } else {
              setTimeout(check, 10);
            }
          };
          check();
        })
      ]);
    } else {
      // all 策略 - 等待所有完成
      if (errorHandling === 'fail_fast') {
        await Promise.all(promises).catch(() => {});
      } else {
        await Promise.allSettled(promises);
      }
    }

    return results;
  }

  /**
   * 执行单个分支（带超时）
   */
  private async executeBranchWithTimeout(
    branch: any,
    context: NodeExecutionContext,
    timeout: number
  ): Promise<{ status: string; result?: any }> {
    const timeoutPromise = new Promise<{ status: string; result?: any }>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), timeout);
    });

    const executionPromise = this.executeBranch(branch, context);

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      return result;
    } catch (error) {
      if ((error as Error).message === 'TIMEOUT') {
        return { status: 'timeout' };
      }
      return { status: 'failed', result: { success: false, error: { message: (error as Error).message } } };
    }
  }

  /**
   * 执行单个分支
   */
  private async executeBranch(branch: any, context: NodeExecutionContext) {
    const executor = this.registry.get(branch.node.type);
    const result = await executor.execute(branch.node, context);
    return { status: result.success ? 'completed' : 'failed', result };
  }

  /**
   * 评估条件
   */
  private evaluateCondition(condition: string, context: NodeExecutionContext): boolean {
    try {
      const expandedCondition = condition.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b/g, (match) => {
        const value = context.getVariable(match);
        if (value === undefined) {
          if (['true', 'false', 'null', 'undefined', '&&', '||', '===', '==', '!==', '!=', '<', '>', '<=', '>='].includes(match)) {
            return match;
          }
          return 'undefined';
        }
        return JSON.stringify(value);
      });

      const fn = new Function('return ' + expandedCondition);
      return Boolean(fn());
    } catch {
      return false;
    }
  }

  /**
   * 判断整体是否成功
   */
  private isOverallSuccess(
    strategy: string,
    strategyConfig: any,
    _totalBranches: number,
    completedCount: number,
    failedCount: number
  ): boolean {
    switch (strategy) {
      case 'all':
        return failedCount === 0;
      case 'any':
        return completedCount > 0;
      case 'race':
        return completedCount + failedCount > 0;
      case 'n_of_m':
        const required = strategyConfig?.requiredCount || 1;
        return completedCount >= required;
      default:
        return false;
    }
  }

  /**
   * 聚合结果
   */
  private aggregateResults(branchResults: Record<string, any>, strategy: string): any {
    switch (strategy) {
      case 'array':
        return Object.values(branchResults);
      case 'object':
        return branchResults;
      case 'merge':
        return Object.values(branchResults).reduce((acc, val) => {
          if (typeof val === 'object' && val !== null) {
            return { ...acc, ...val };
          }
          return acc;
        }, {});
      default:
        return branchResults;
    }
  }
}
