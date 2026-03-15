import { NodeExecutor, ValidationResult, createSuccessResult, createErrorResult, NodeExecutionContext, NodeExecutionResult } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutorRegistry } from './executor.registry';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { DAGExecutor, DAGExecutionContext } from './dag.executor';

/**
 * Subflow 节点执行器
 *
 * 调用其他工作流作为子流程
 */
export class SubflowNodeExecutor implements NodeExecutor {
  readonly type = NodeType.SUBFLOW;

  constructor(
    private registry: NodeExecutorRegistry,
    private workflowRepo: WorkflowRepository,
    private dagExecutor: DAGExecutor
  ) {}

  async execute(node: WorkflowNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const config = node.config || {};

    // 验证配置
    if (!config.subflowId) {
      return createErrorResult('CONFIG_ERROR', 'subflowId is required');
    }

    try {
      // 查找子流程定义
      const subflow = await this.workflowRepo.findById(config.subflowId);
      if (!subflow) {
        return createErrorResult(
          'SUBFLOW_NOT_FOUND',
          `Subflow not found: ${config.subflowId}`
        );
      }

      // 准备参数
      const subflowContext = this.prepareSubflowContext(config, context);

      // 执行子流程
      const invocationMode = config.invocationMode || 'sync';

      // Node executor callback for DAG execution
      const nodeExecutor = (n: WorkflowNode, ctx: DAGExecutionContext) =>
        this.registry.get(n.type).execute(n, ctx as any);

      if (invocationMode === 'async') {
        // 异步调用 - 启动子流程并返回引用
        const executionId = `subflow-exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 启动异步执行（不等待完成）
        this.dagExecutor.execute(subflow, subflowContext, nodeExecutor).catch(() => {});

        return createSuccessResult({
          subflowExecutionId: executionId,
          status: 'started',
          subflowId: config.subflowId
        });
      } else {
        // 同步调用 - 等待子流程完成
        const subflowResult = await this.dagExecutor.execute(subflow, subflowContext, nodeExecutor);

        // 处理结果
        return this.handleSubflowResult(subflowResult, config, context);
      }
    } catch (error) {
      return createErrorResult(
        'SUBFLOW_EXECUTION_ERROR',
        `Subflow execution failed: ${(error as Error).message}`
      );
    }
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const config = node.config || {};

    if (!config.subflowId) {
      errors.push('subflowId is required');
    }

    if (!config.parameters) {
      errors.push('parameters is required');
    }

    if (!config.resultMapping) {
      errors.push('resultMapping is required');
    }

    if (config.invocationMode) {
      const validModes = ['sync', 'async'];
      if (!validModes.includes(config.invocationMode)) {
        errors.push(`Invalid invocationMode: ${config.invocationMode}. Must be one of: ${validModes.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 准备子流程上下文
   */
  private prepareSubflowContext(config: any, parentContext: NodeExecutionContext): any {
    const { NodeExecutionContextImpl } = require('./node.executor');

    const subflowContext = new NodeExecutionContextImpl(
      `subflow-${Date.now()}`,
      config.subflowId,
      'subflow-start',
      {},
      {}
    );

    // 映射参数
    if (config.parameters?.mapping) {
      for (const { source, target, transform } of config.parameters.mapping) {
        let value = parentContext.getVariable(source);

        if (transform && typeof transform === 'string') {
          value = this.applyTransform(value, transform, parentContext);
        }

        subflowContext.setVariable(target, value);
      }
    }

    // 静态参数
    if (config.parameters?.staticParams) {
      for (const [key, value] of Object.entries(config.parameters.staticParams)) {
        subflowContext.setVariable(key, value);
      }
    }

    // 继承父上下文（如果配置）
    if (config.options?.inheritContext) {
      const parentState = (parentContext as any).state || {};
      for (const [key, value] of Object.entries(parentState)) {
        if (subflowContext.getVariable(key) === undefined) {
          subflowContext.setVariable(key, value);
        }
      }
    }

    return subflowContext;
  }

  /**
   * 应用转换
   */
  private applyTransform(value: any, transform: string, context: NodeExecutionContext): any {
    try {
      // 支持简单的转换表达式
      // 例如: "value.toUpperCase()", "value * 2", "value ? 'yes' : 'no'"
      const fn = new Function('value', 'context', `return ${transform}`);
      return fn(value, context);
    } catch {
      return value;
    }
  }

  /**
   * 处理子流程结果
   */
  private handleSubflowResult(
    subflowResult: any,
    config: any,
    parentContext: NodeExecutionContext
  ): NodeExecutionResult {
    const errorHandling = config.errorHandling || { strategy: 'propagate' };

    // 处理错误
    if (!subflowResult.success) {
      switch (errorHandling.strategy) {
        case 'catch':
          // 捕获错误并存储到变量
          if (errorHandling.errorVariablePath) {
            parentContext.setVariable(errorHandling.errorVariablePath, {
              code: subflowResult.error?.code,
              message: subflowResult.error?.message,
              details: subflowResult.error?.details
            });
          }
          return createSuccessResult({
            results: {},
            error: subflowResult.error
          });

        case 'fallback':
          // 使用回退值
          return createSuccessResult({
            results: errorHandling.fallbackValue || {}
          });

        case 'propagate':
        default:
          // 传播错误
          return createErrorResult(
            subflowResult.error?.code || 'SUBFLOW_ERROR',
            subflowResult.error?.message || 'Subflow execution failed',
            subflowResult.error?.details
          );
      }
    }

    // 映射结果
    const results: Record<string, any> = {};

    if (config.resultMapping?.outputs) {
      for (const { source, target } of config.resultMapping.outputs) {
        const value = this.getNestedValue(subflowResult.output || {}, source);
        parentContext.setVariable(target, value);
        results[target] = value;
      }
    }

    // 映射整个输出（如果配置）
    if (config.resultMapping?.mapEntireOutput && config.resultMapping?.outputVariablePath) {
      parentContext.setVariable(config.resultMapping.outputVariablePath, subflowResult.output);
    }

    return createSuccessResult({
      results,
      subflowOutput: subflowResult.output
    });
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, obj);
  }
}
