import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';

/**
 * 未知节点类型错误
 */
export class UnknownNodeTypeError extends Error {
  constructor(public type: NodeType) {
    super(`Unknown node type: ${type}`);
    this.name = 'UnknownNodeTypeError';
  }
}

/**
 * 执行器已存在错误
 */
export class ExecutorAlreadyExistsError extends Error {
  constructor(public type: NodeType) {
    super(`Executor for type ${type} already exists`);
    this.name = 'ExecutorAlreadyExistsError';
  }
}

/**
 * 节点执行器注册表
 */
export class NodeExecutorRegistry {
  private executors = new Map<NodeType, NodeExecutor>();

  /**
   * 注册执行器
   */
  register(executor: NodeExecutor): void {
    if (this.executors.has(executor.type)) {
      throw new ExecutorAlreadyExistsError(executor.type);
    }
    this.executors.set(executor.type, executor);
  }

  /**
   * 注销执行器
   */
  unregister(type: NodeType): boolean {
    return this.executors.delete(type);
  }

  /**
   * 获取执行器
   */
  get(type: NodeType): NodeExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new UnknownNodeTypeError(type);
    }
    return executor;
  }

  /**
   * 检查执行器是否存在
   */
  has(type: NodeType): boolean {
    return this.executors.has(type);
  }

  /**
   * 获取所有已注册的类型
   */
  getRegisteredTypes(): NodeType[] {
    return Array.from(this.executors.keys());
  }

  /**
   * 清空所有执行器
   */
  clear(): void {
    this.executors.clear();
  }

  /**
   * 执行节点
   */
  async execute(node: WorkflowNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const executor = this.get(node.type);
    return executor.execute(node, context);
  }

  /**
   * 验证节点配置
   */
  validate(node: WorkflowNode): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.has(node.type)) {
      errors.push(`No executor registered for node type: ${node.type}`);
      return { valid: false, errors };
    }

    const executor = this.get(node.type);
    if (executor.validate) {
      const result = executor.validate(node);
      if (!result.valid && result.errors) {
        errors.push(...result.errors);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const globalExecutorRegistry = new NodeExecutorRegistry();
