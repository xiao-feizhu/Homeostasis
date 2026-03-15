import { WorkflowNode, NodeType, NodeExecutionStatus } from '../entities/workflow-definition.entity';

/**
 * 执行错误
 */
export interface ExecutionError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

/**
 * 节点执行结果
 */
export interface NodeExecutionResult {
  success: boolean;
  output?: Record<string, any>;
  error?: ExecutionError;
  nextNodeId?: string;
  status: NodeExecutionStatus;
  executionTime?: number;
}

/**
 * 执行上下文
 */
export interface NodeExecutionContext {
  executionId: string;
  workflowId: string;
  nodeId: string;
  input: Record<string, any>;
  state: Record<string, any>;
  getVariable(path: string): any;
  setVariable(path: string, value: any): void;
  getSecret(name: string): string | undefined;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * 节点执行器接口
 */
export interface NodeExecutor {
  readonly type: NodeType;

  /**
   * 执行节点
   */
  execute(node: WorkflowNode, context: NodeExecutionContext): Promise<NodeExecutionResult>;

  /**
   * 验证节点配置
   */
  validate?(node: WorkflowNode): ValidationResult;
}

/**
 * 执行上下文实现
 */
export class NodeExecutionContextImpl implements NodeExecutionContext {
  private secrets: Map<string, string> = new Map();

  constructor(
    public executionId: string,
    public workflowId: string,
    public nodeId: string,
    public input: Record<string, any>,
    initialState: Record<string, any> = {}
  ) {
    // Initialize state from input and initial state
    this.state = { ...input, ...initialState };
  }

  state: Record<string, any>;

  getVariable(path: string): any {
    return this.getNestedValue(this.state, path);
  }

  setVariable(path: string, value: any): void {
    this.setNestedValue(this.state, path, value);
  }

  getSecret(name: string): string | undefined {
    return this.secrets.get(name);
  }

  setSecret(name: string, value: string): void {
    this.secrets.set(name, value);
  }

  /**
   * 渲染模板字符串，替换变量
   */
  renderTemplate(template: string): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.getVariable(path.trim());
      return value !== undefined ? String(value) : match;
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

  /**
   * 设置嵌套值
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

/**
 * 创建成功结果
 */
export function createSuccessResult(
  output: Record<string, any>,
  executionTime?: number,
  nextNodeId?: string
): NodeExecutionResult {
  return {
    success: true,
    output,
    status: NodeExecutionStatus.COMPLETED,
    executionTime,
    nextNodeId
  };
}

/**
 * 创建失败结果
 */
export function createErrorResult(
  code: string,
  message: string,
  details?: Record<string, any>
): NodeExecutionResult {
  return {
    success: false,
    status: NodeExecutionStatus.FAILED,
    error: {
      code,
      message,
      details
    }
  };
}
