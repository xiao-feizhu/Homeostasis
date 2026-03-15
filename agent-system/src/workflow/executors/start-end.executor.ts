import { NodeExecutor, ValidationResult, createSuccessResult } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutionContext } from './node.executor';

/**
 * Start 节点执行器
 *
 * 工作流入口节点，接收初始输入并启动执行
 */
export class StartNodeExecutor implements NodeExecutor {
  readonly type = NodeType.START;

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};

    // 合并默认值与输入
    const output: Record<string, any> = {
      ...config.defaults,
      ...context.input
    };

    return createSuccessResult(output);
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];

    // Start 节点不应该有依赖
    if (node.dependencies && node.dependencies.length > 0) {
      errors.push('Start node should not have dependencies');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

/**
 * End 节点执行器
 *
 * 工作流出口节点，返回最终结果
 */
export class EndNodeExecutor implements NodeExecutor {
  readonly type = NodeType.END;

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};

    let output: Record<string, any>;

    if (config.outputFields && Array.isArray(config.outputFields)) {
      // 只返回指定的字段
      output = {};
      for (const field of config.outputFields) {
        const value = context.getVariable(field);
        if (value !== undefined) {
          output[field] = value;
        }
      }
    } else {
      // 返回整个状态
      output = { ...context.state };
    }

    return createSuccessResult(output);
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];

    // End 节点不应该有后置节点
    if (node.dependents && node.dependents.length > 0) {
      errors.push('End node should not have dependents');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
