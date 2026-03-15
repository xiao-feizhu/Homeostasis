import { NodeExecutor, ValidationResult, createSuccessResult, createErrorResult } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutionContext } from './node.executor';
import Anthropic from '@anthropic-ai/sdk';

/**
 * LLM 节点执行器
 *
 * 调用 Claude API 进行大语言模型推理
 */
export class LLMNodeExecutor implements NodeExecutor {
  readonly type = NodeType.LLM;

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};

    // 验证配置
    if (!config.userPrompt || typeof config.userPrompt !== 'string') {
      return createErrorResult(
        'CONFIG_ERROR',
        'userPrompt is required and must be a string'
      );
    }

    // 获取 API 密钥
    const apiKey = config.apiKey || context.getSecret('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createErrorResult(
        'CONFIG_ERROR',
        'Anthropic API key is required (set ANTHROPIC_API_KEY or provide in config)'
      );
    }

    try {
      // 创建 Anthropic 客户端
      const client = new Anthropic({
        apiKey,
      });

      // 渲染模板
      const userPrompt = this.renderTemplate(config.userPrompt, context);
      const systemPrompt = config.systemPrompt
        ? this.renderTemplate(config.systemPrompt, context)
        : undefined;

      // 构建请求参数
      const requestParams: Anthropic.MessageCreateParams = {
        model: config.model || 'claude-sonnet-4-6',
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature ?? 0.7,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        ...(systemPrompt && { system: systemPrompt }),
        ...(config.tools && { tools: config.tools }),
      };

      // 调用 API（非流式）
      const response = await client.messages.create({ ...requestParams, stream: false });

      // 提取文本内容
      const content = response.content
        .filter((block: Anthropic.ContentBlock): block is Anthropic.TextBlock => block.type === 'text')
        .map((block: Anthropic.TextBlock) => block.text)
        .join('');

      // 构建输出
      let output: Record<string, any> = {
        content,
        usage: {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
        },
        finishReason: response.stop_reason,
      };

      // 如果请求 JSON 格式，尝试解析
      if (config.responseFormat === 'json') {
        try {
          const parsedJson = JSON.parse(content);
          output.parsedJson = parsedJson;
        } catch {
          // JSON 解析失败，保留原始内容
        }
      }

      // 应用输出映射
      if (config.outputMapping && Array.isArray(config.outputMapping)) {
        output = this.applyOutputMapping(output, config.outputMapping);
      }

      return createSuccessResult(output);
    } catch (error) {
      return createErrorResult(
        'LLM_ERROR',
        `LLM call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const config = node.config || {};

    if (!config.userPrompt || typeof config.userPrompt !== 'string') {
      errors.push('userPrompt is required');
    }

    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 1) {
        errors.push('temperature must be between 0 and 1');
      }
    }

    if (config.maxTokens !== undefined) {
      if (typeof config.maxTokens !== 'number' || config.maxTokens <= 0) {
        errors.push('maxTokens must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 渲染模板字符串
   */
  private renderTemplate(template: string, context: NodeExecutionContext): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(context.state, path.trim());
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
   * 应用输出字段映射
   */
  private applyOutputMapping(output: Record<string, any>, mapping: string[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const field of mapping) {
      const value = this.getNestedValue(output, field);
      if (value !== undefined) {
        // 处理嵌套路径
        const keys = field.split('.');
        let target = result;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!(keys[i] in target)) {
            target[keys[i]] = {};
          }
          target = target[keys[i]];
        }
        target[keys[keys.length - 1]] = value;
      }
    }

    return result;
  }
}
