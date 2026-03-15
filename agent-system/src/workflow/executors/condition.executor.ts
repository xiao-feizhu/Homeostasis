import { NodeExecutor, ValidationResult, createSuccessResult, createErrorResult } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutionContext } from './node.executor';

/**
 * Condition 节点执行器
 *
 * 条件分支节点，根据表达式求值结果选择执行路径
 */
export class ConditionNodeExecutor implements NodeExecutor {
  readonly type = NodeType.CONDITION;

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};
    const condition = config.condition;

    if (!condition || !condition.expression) {
      return createErrorResult(
        'MISSING_CONDITION',
        'Condition configuration is required'
      );
    }

    try {
      const result = this.evaluateExpression(condition.expression, context);
      const isTrue = Boolean(result);

      return createSuccessResult(
        { condition: isTrue, branch: isTrue ? 'true' : 'false' },
        undefined,
        isTrue ? condition.trueBranch : condition.falseBranch
      );
    } catch (error) {
      return createErrorResult(
        'EVAL_ERROR',
        `Failed to evaluate condition: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const config = node.config || {};

    if (!config.condition) {
      errors.push('Condition configuration is required');
    } else {
      if (!config.condition.expression) {
        errors.push('Condition expression is required');
      }
    }

    if (!node.dependents || node.dependents.length < 2) {
      errors.push('Condition node should have at least 2 dependents for true/false branches');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 求值条件表达式
   *
   * 支持的语法：
   * - 变量访问: variable, nested.property
   * - 比较: ==, !=, <, >, <=, >=
   * - 逻辑: &&, ||, !
   * - 数组长度: array.length
   */
  private evaluateExpression(expression: string, context: NodeExecutionContext): unknown {
    // 简单表达式求值器
    // 为了安全，不使用 eval，而是手动解析

    const tokens = this.tokenize(expression);
    return this.parseAndEvaluate(tokens, context);
  }

  private tokenize(expression: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      // 跳过空白
      if (/\s/.test(char)) {
        if (current) {
          this.validateAndPushToken(tokens, current);
          current = '';
        }
        continue;
      }

      // 双字符运算符
      if (i + 1 < expression.length) {
        const twoChar = char + expression[i + 1];
        if (twoChar === '==' || twoChar === '!=' || twoChar === '<=' || twoChar === '>=' || twoChar === '&&' || twoChar === '||') {
          if (current) {
            this.validateAndPushToken(tokens, current);
            current = '';
          }
          tokens.push(twoChar);
          i++;
          continue;
        }
      }

      // 单字符运算符和括号
      if (char === '(' || char === ')' || char === '!' || char === '<' || char === '>') {
        if (current) {
          this.validateAndPushToken(tokens, current);
          current = '';
        }
        tokens.push(char);
        continue;
      }

      // 检查无效字符
      if (!/[a-zA-Z0-9_.\-'"]/.test(char)) {
        throw new Error(`Invalid character in expression: ${char}`);
      }

      // 字符串字面量
      if (char === '"' || char === "'") {
        if (current) {
          tokens.push(current);
          current = '';
        }
        const quote = char;
        let str = '';
        i++;
        while (i < expression.length && expression[i] !== quote) {
          if (expression[i] === '\\' && i + 1 < expression.length) {
            i++;
          }
          str += expression[i];
          i++;
        }
        tokens.push(`"${str}"`);
        continue;
      }

      current += char;
    }

    if (current) {
      this.validateAndPushToken(tokens, current);
    }

    return tokens;
  }

  private validateAndPushToken(tokens: string[], token: string): void {
    // 验证变量名只包含有效字符
    if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(token)) {
      tokens.push(token);
    } else if (/^-?\d+(\.\d+)?$/.test(token)) {
      // 数字
      tokens.push(token);
    } else if (token === 'true' || token === 'false') {
      // 布尔值
      tokens.push(token);
    } else {
      throw new Error(`Invalid token: ${token}`);
    }
  }

  private parseAndEvaluate(tokens: string[], context: NodeExecutionContext): unknown {
    // 简化的表达式解析器
    // 支持逻辑运算符优先级: ! > && > ||

    return this.parseOr(tokens, context, 0).value;
  }

  private parseOr(tokens: string[], context: NodeExecutionContext, pos: number): { value: unknown; nextPos: number } {
    let left = this.parseAnd(tokens, context, pos);

    while (left.nextPos < tokens.length && tokens[left.nextPos] === '||') {
      const right = this.parseAnd(tokens, context, left.nextPos + 1);
      left = {
        value: Boolean(left.value) || Boolean(right.value),
        nextPos: right.nextPos
      };
    }

    return left;
  }

  private parseAnd(tokens: string[], context: NodeExecutionContext, pos: number): { value: unknown; nextPos: number } {
    let left = this.parseComparison(tokens, context, pos);

    while (left.nextPos < tokens.length && tokens[left.nextPos] === '&&') {
      const right = this.parseComparison(tokens, context, left.nextPos + 1);
      left = {
        value: Boolean(left.value) && Boolean(right.value),
        nextPos: right.nextPos
      };
    }

    return left;
  }

  private parseComparison(tokens: string[], context: NodeExecutionContext, pos: number): { value: unknown; nextPos: number } {
    let left = this.parseUnary(tokens, context, pos);

    if (left.nextPos < tokens.length) {
      const op = tokens[left.nextPos];
      if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
        const right = this.parseUnary(tokens, context, left.nextPos + 1);
        let result: boolean;

        switch (op) {
          case '==':
            result = left.value == right.value;
            break;
          case '!=':
            result = left.value != right.value;
            break;
          case '<':
            result = Number(left.value) < Number(right.value);
            break;
          case '>':
            result = Number(left.value) > Number(right.value);
            break;
          case '<=':
            result = Number(left.value) <= Number(right.value);
            break;
          case '>=':
            result = Number(left.value) >= Number(right.value);
            break;
          default:
            result = false;
        }

        return { value: result, nextPos: right.nextPos };
      }
    }

    return left;
  }

  private parseUnary(tokens: string[], context: NodeExecutionContext, pos: number): { value: unknown; nextPos: number } {
    if (pos < tokens.length && tokens[pos] === '!') {
      const operand = this.parseUnary(tokens, context, pos + 1);
      return { value: !Boolean(operand.value), nextPos: operand.nextPos };
    }

    return this.parsePrimary(tokens, context, pos);
  }

  private parsePrimary(tokens: string[], context: NodeExecutionContext, pos: number): { value: unknown; nextPos: number } {
    if (pos >= tokens.length) {
      return { value: undefined, nextPos: pos };
    }

    const token = tokens[pos];

    // 括号表达式
    if (token === '(') {
      const result = this.parseOr(tokens, context, pos + 1);
      if (result.nextPos < tokens.length && tokens[result.nextPos] === ')') {
        return { value: result.value, nextPos: result.nextPos + 1 };
      }
      throw new Error('Missing closing parenthesis');
    }

    // 字符串字面量
    if (token.startsWith('"') || token.startsWith("'")) {
      return { value: token.slice(1, -1), nextPos: pos + 1 };
    }

    // 数字
    if (/^-?\d+(\.\d+)?$/.test(token)) {
      return { value: Number(token), nextPos: pos + 1 };
    }

    // 布尔值
    if (token === 'true') {
      return { value: true, nextPos: pos + 1 };
    }
    if (token === 'false') {
      return { value: false, nextPos: pos + 1 };
    }

    // 变量访问
    const value = this.resolveVariable(token, context);
    return { value, nextPos: pos + 1 };
  }

  private resolveVariable(path: string, context: NodeExecutionContext): unknown {
    // 支持嵌套属性访问，如 user.profile.verified
    return context.getVariable(path);
  }
}
