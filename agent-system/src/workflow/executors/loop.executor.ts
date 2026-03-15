import { NodeExecutor, ValidationResult, createSuccessResult, createErrorResult, NodeExecutionContext } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutorRegistry } from './executor.registry';

/**
 * Loop 节点执行器
 *
 * 支持 for/while/foreach 循环执行子节点
 */
export class LoopNodeExecutor implements NodeExecutor {
  readonly type = NodeType.LOOP;
  private readonly MAX_ITERATIONS_DEFAULT = 10000;

  constructor(private registry: NodeExecutorRegistry) {}

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};

    if (!config.loopType) {
      return createErrorResult('CONFIG_ERROR', 'loopType is required');
    }

    if (!config.childNode) {
      return createErrorResult('CONFIG_ERROR', 'childNode is required');
    }

    try {
      switch (config.loopType) {
        case 'for':
          return await this.executeForLoop(config, context);
        case 'foreach':
          return await this.executeForeachLoop(config, context);
        case 'while':
          return await this.executeWhileLoop(config, context);
        default:
          return createErrorResult('CONFIG_ERROR', `Invalid loop type: ${config.loopType}`);
      }
    } catch (error) {
      return createErrorResult(
        'LOOP_ERROR',
        `Loop execution failed: ${(error as Error).message}`
      );
    }
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const config = node.config || {};

    if (!config.loopType) {
      errors.push('loopType is required');
    } else {
      const validTypes = ['for', 'foreach', 'while'];
      if (!validTypes.includes(config.loopType)) {
        errors.push(`Invalid loop type: ${config.loopType}. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    if (!config.childNode) {
      errors.push('childNode is required');
    }

    // 验证特定循环类型的配置
    if (config.loopType === 'for') {
      if (!config.forConfig?.iterations && config.forConfig?.iterations !== 0) {
        errors.push('forConfig.iterations is required');
      }
    }

    if (config.loopType === 'foreach') {
      if (!config.foreachConfig?.arrayExpression) {
        errors.push('foreachConfig.arrayExpression is required');
      }
    }

    if (config.loopType === 'while') {
      if (!config.whileConfig?.condition) {
        errors.push('whileConfig.condition is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 执行 for 循环
   */
  private async executeForLoop(config: any, context: NodeExecutionContext) {
    const forConfig = config.forConfig || {};
    const iterations = this.renderTemplate(String(forConfig.iterations), context);
    const count = parseInt(iterations, 10);

    if (isNaN(count) || count < 0) {
      return createErrorResult('CONFIG_ERROR', `Invalid iteration count: ${iterations}`);
    }

    if (count > this.MAX_ITERATIONS_DEFAULT) {
      return createErrorResult(
        'MAX_ITERATIONS_EXCEEDED',
        `Iteration count ${count} exceeds maximum ${this.MAX_ITERATIONS_DEFAULT}`
      );
    }

    const loopVariableName = forConfig.loopVariableName || 'index';
    const results: any[] = [];
    let iterationsCompleted = 0;
    let iterationsFailed = 0;

    for (let i = 0; i < count; i++) {
      // 设置循环变量
      context.setVariable(loopVariableName, i);

      const result = await this.executeChildNode(config.childNode, context);

      if (result.success) {
        iterationsCompleted++;
        if (config.outputMapping?.aggregateResults) {
          results.push(result.output);
        }
      } else {
        iterationsFailed++;
        if (config.breakOnError !== false && !config.continueOnError) {
          return createErrorResult(
            'CHILD_EXECUTION_ERROR',
            `Child node failed at iteration ${i}: ${result.error?.message}`,
            {
              iteration: i,
              iterationsCompleted,
              iterationsFailed
            }
          );
        }
      }
    }

    const output: Record<string, any> = {
      iterationsCompleted,
      iterationsFailed,
      breakReason: 'completed'
    };

    if (config.outputMapping?.aggregateResults) {
      output.results = results;
      if (config.outputMapping.resultsVariablePath) {
        context.setVariable(config.outputMapping.resultsVariablePath, results);
      }
    }

    return createSuccessResult(output);
  }

  /**
   * 执行 foreach 循环
   */
  private async executeForeachLoop(config: any, context: NodeExecutionContext) {
    const foreachConfig = config.foreachConfig || {};
    const arrayExpression = foreachConfig.arrayExpression;

    // 获取数组
    const array = context.getVariable(arrayExpression);

    if (!Array.isArray(array)) {
      return createErrorResult(
        'INVALID_ARRAY',
        `Expression '${arrayExpression}' does not evaluate to an array`
      );
    }

    if (array.length > this.MAX_ITERATIONS_DEFAULT) {
      return createErrorResult(
        'MAX_ITERATIONS_EXCEEDED',
        `Array length ${array.length} exceeds maximum ${this.MAX_ITERATIONS_DEFAULT}`
      );
    }

    const itemVariableName = foreachConfig.itemVariableName || 'item';
    const indexVariableName = foreachConfig.indexVariableName || 'index';
    const results: any[] = [];
    let iterationsCompleted = 0;
    let iterationsFailed = 0;

    for (let i = 0; i < array.length; i++) {
      // 设置循环变量
      context.setVariable(itemVariableName, array[i]);
      context.setVariable(indexVariableName, i);

      const result = await this.executeChildNode(config.childNode, context);

      if (result.success) {
        iterationsCompleted++;
        if (config.outputMapping?.aggregateResults) {
          results.push(result.output);
        }
      } else {
        iterationsFailed++;
        if (config.breakOnError !== false && !config.continueOnError) {
          return createErrorResult(
            'CHILD_EXECUTION_ERROR',
            `Child node failed at iteration ${i}: ${result.error?.message}`,
            {
              iteration: i,
              iterationsCompleted,
              iterationsFailed
            }
          );
        }
      }
    }

    const output: Record<string, any> = {
      iterationsCompleted,
      iterationsFailed,
      breakReason: 'completed'
    };

    if (config.outputMapping?.aggregateResults) {
      output.results = results;
    }

    return createSuccessResult(output);
  }

  /**
   * 执行 while 循环
   */
  private async executeWhileLoop(config: any, context: NodeExecutionContext) {
    const whileConfig = config.whileConfig || {};
    const condition = whileConfig.condition;
    const maxIterations = whileConfig.maxIterations || this.MAX_ITERATIONS_DEFAULT;

    if (maxIterations > this.MAX_ITERATIONS_DEFAULT) {
      return createErrorResult(
        'CONFIG_ERROR',
        `maxIterations ${maxIterations} exceeds absolute maximum ${this.MAX_ITERATIONS_DEFAULT}`
      );
    }

    const results: any[] = [];
    let iterationsCompleted = 0;
    let iterationsFailed = 0;
    let iteration = 0;

    while (this.evaluateCondition(condition, context)) {
      if (iteration >= maxIterations) {
        return createErrorResult(
          'MAX_ITERATIONS_EXCEEDED',
          `While loop exceeded maximum iterations (${maxIterations})`
        );
      }

      // 设置迭代计数
      context.setVariable('iteration', iteration);

      const result = await this.executeChildNode(config.childNode, context);

      if (result.success) {
        iterationsCompleted++;
        if (config.outputMapping?.aggregateResults) {
          results.push(result.output);
        }
      } else {
        iterationsFailed++;
        if (config.breakOnError !== false && !config.continueOnError) {
          return createErrorResult(
            'CHILD_EXECUTION_ERROR',
            `Child node failed at iteration ${iteration}: ${result.error?.message}`,
            {
              iteration,
              iterationsCompleted,
              iterationsFailed
            }
          );
        }
      }

      iteration++;
    }

    const output: Record<string, any> = {
      iterationsCompleted,
      iterationsFailed,
      breakReason: 'condition_false'
    };

    if (config.outputMapping?.aggregateResults) {
      output.results = results;
    }

    return createSuccessResult(output);
  }

  /**
   * 执行子节点
   */
  private async executeChildNode(childNode: WorkflowNode, context: NodeExecutionContext) {
    const executor = this.registry.get(childNode.type);
    return await executor.execute(childNode, context);
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(expression: string, context: NodeExecutionContext): boolean {
    try {
      // 支持简单的比较表达式
      // 例如: "counter < 5", "count >= 10", "items.length > 0"

      // 替换变量引用
      const expandedExpression = expression.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b/g, (match) => {
        const value = context.getVariable(match);
        if (value === undefined) {
          // 保留操作符和关键字
          if (['true', 'false', 'null', 'undefined', '&&', '||', '===', '==', '!==', '!=', '<', '>', '<=', '>='].includes(match)) {
            return match;
          }
          return 'undefined';
        }
        return JSON.stringify(value);
      });

      // 安全评估
      return this.safeEvaluate(expandedExpression);
    } catch (error) {
      return false;
    }
  }

  /**
   * 安全评估表达式
   */
  private safeEvaluate(expression: string): boolean {
    // 只允许安全的操作符和值
    const sanitized = expression
      .replace(/[^\w\s\d<>=!&|()"'\.\[\]_$]/g, '');

    try {
      // 使用 Function 构造器在安全上下文中评估
      const fn = new Function('return ' + sanitized);
      return Boolean(fn());
    } catch {
      return false;
    }
  }

  /**
   * 渲染模板
   */
  private renderTemplate(template: string, context: NodeExecutionContext): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = context.getVariable(path.trim());
      return value !== undefined ? String(value) : match;
    });
  }
}
