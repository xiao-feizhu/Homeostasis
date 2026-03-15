import { NodeExecutor, ValidationResult, createSuccessResult, createErrorResult } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutionContext } from './node.executor';
import { Script, createContext } from 'vm';

/**
 * Code 节点执行器
 *
 * JavaScript 代码执行节点，带沙箱安全限制
 */
export class CodeNodeExecutor implements NodeExecutor {
  readonly type = NodeType.CODE;

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};
    const code = config.code;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return createErrorResult(
        'MISSING_CODE',
        'Code is required'
      );
    }

    const timeout = config.timeout || 5000; // 默认 5 秒超时

    try {
      const result = await this.executeInSandbox(code, context, timeout);
      return createSuccessResult(result || {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Node.js vm 模块超时错误包含特定消息
      if (errorMessage.includes('timed out') || errorMessage.includes('Timeout')) {
        return createErrorResult(
          'TIMEOUT',
          `Code execution exceeded ${timeout}ms timeout`
        );
      }

      return createErrorResult(
        'CODE_ERROR',
        `Code execution failed: ${errorMessage}`
      );
    }
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const config = node.config || {};

    if (!config.code || typeof config.code !== 'string' || config.code.trim().length === 0) {
      errors.push('Code is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 在沙箱中执行代码
   *
   * 安全限制：
   * - 禁用 require
   * - 禁用 eval/Function
   * - 禁用 process/global
   * - 超时控制
   */
  private executeInSandbox(
    code: string,
    context: NodeExecutionContext,
    timeout: number
  ): Record<string, any> | undefined {
    // 构建沙箱环境变量
    const sandbox: Record<string, any> = {};

    // 注入输入和状态变量
    const input = context.input;
    const state = context.state;

    // 合并所有可用变量到沙箱
    for (const [key, value] of Object.entries(input)) {
      sandbox[key] = value;
    }
    for (const [key, value] of Object.entries(state)) {
      if (!(key in sandbox)) {
        sandbox[key] = value;
      }
    }

    // 允许的安全内置对象
    sandbox.JSON = JSON;
    sandbox.Math = Math;
    sandbox.Date = Date;

    // 显式移除危险的全局函数（它们在 createContext 中默认可用）
    sandbox.eval = undefined;
    sandbox.Function = undefined;
    sandbox.Array = Array;
    sandbox.Object = Object;
    sandbox.String = String;
    sandbox.Number = Number;
    sandbox.Boolean = Boolean;
    sandbox.RegExp = RegExp;
    sandbox.Error = Error;
    sandbox.TypeError = TypeError;
    sandbox.RangeError = RangeError;
    sandbox.SyntaxError = SyntaxError;
    sandbox.ReferenceError = ReferenceError;
    sandbox.parseInt = parseInt;
    sandbox.parseFloat = parseFloat;
    sandbox.isNaN = isNaN;
    sandbox.isFinite = isFinite;
    sandbox.encodeURI = encodeURI;
    sandbox.decodeURI = decodeURI;
    sandbox.encodeURIComponent = encodeURIComponent;
    sandbox.decodeURIComponent = decodeURIComponent;
    sandbox.escape = escape;
    sandbox.unescape = unescape;
    sandbox.console = {
      log: (...args: any[]) => console.log('[Workflow Code]', ...args),
      error: (...args: any[]) => console.error('[Workflow Code]', ...args),
      warn: (...args: any[]) => console.warn('[Workflow Code]', ...args),
      info: (...args: any[]) => console.info('[Workflow Code]', ...args),
    };

    // 创建 VM 上下文
    const vmContext = createContext(sandbox);

    // 包装代码，确保有 return 语句
    const wrappedCode = this.wrapCode(code);

    // 创建脚本
    const script = new Script(wrappedCode);

    // 执行脚本（带超时）
    const result = script.runInContext(vmContext, {
      timeout,
    });

    return result;
  }

  /**
   * 包装用户代码
   *
   * 将用户代码包装在函数中，处理 return 语句
   */
  private wrapCode(code: string): string {
    // 清理代码
    const cleanCode = code.trim();

    // 检查是否已经包含 return 语句
    if (!cleanCode.includes('return')) {
      // 没有 return，尝试自动包装
      return `
        (function() {
          ${cleanCode}
        })()
      `;
    }

    // 有 return 语句，包装在函数中
    return `
      (function() {
        ${cleanCode}
      })()
    `;
  }
}
