import { NodeExecutor, ValidationResult, createSuccessResult, createErrorResult } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutionContext } from './node.executor';

/**
 * API 节点执行器
 *
 * 执行 HTTP 请求调用外部 API
 */
export class APINodeExecutor implements NodeExecutor {
  readonly type = NodeType.API;

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};

    // 验证配置
    if (!config.url || typeof config.url !== 'string') {
      return createErrorResult(
        'CONFIG_ERROR',
        'URL is required'
      );
    }

    // 验证 URL 格式
    try {
      new URL(config.url);
    } catch {
      return createErrorResult(
        'CONFIG_ERROR',
        `Invalid URL: ${config.url}`
      );
    }

    const method = config.method || 'GET';
    const timeout = config.timeout || 30000;
    const retryConfig = config.retryConfig || { maxRetries: 0, retryDelay: 1000 };

    // 渲染 URL 模板
    const renderedUrl = this.renderTemplate(config.url, context);

    // 构建请求头
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...config.headers
    };

    // 渲染请求头中的模板
    for (const [key, value] of Object.entries(headers)) {
      headers[key] = this.renderTemplate(value, context);
    }

    // 构建查询参数
    let finalUrl: string = renderedUrl;
    if (config.queryParams) {
      const urlObj = new URL(renderedUrl);
      for (const [key, value] of Object.entries(config.queryParams)) {
        const stringValue = typeof value === 'string' ? value : String(value);
        urlObj.searchParams.append(key, this.renderTemplate(stringValue, context));
      }
      finalUrl = urlObj.toString();
    }

    // 构建请求体
    let body: string | undefined;
    if (config.body) {
      if (typeof config.body === 'string') {
        body = this.renderTemplate(config.body, context);
      } else {
        const renderedBody = this.renderObjectTemplates(config.body, context);
        body = JSON.stringify(renderedBody);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    // 执行请求（带重试）
    let lastError: Error | undefined;
    const maxAttempts = retryConfig.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(finalUrl.toString(), {
          method,
          headers,
          body,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // 处理响应
        const responseData = await this.parseResponse(response);

        if (!response.ok) {
          return createErrorResult(
            'HTTP_ERROR',
            `HTTP ${response.status}: ${response.statusText}`,
            {
              statusCode: response.status,
              body: responseData
            }
          );
        }

        // 构建输出
        const output: Record<string, any> = {
          statusCode: response.status,
          body: responseData
        };

        // 包含响应头（如果配置）
        if (config.includeHeaders) {
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          output.headers = responseHeaders;
        }

        return createSuccessResult(output);
      } catch (error) {
        lastError = error as Error;

        // 检查是否是超时
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt === maxAttempts) {
            return createErrorResult(
              'TIMEOUT',
              `Request timed out after ${timeout}ms`
            );
          }
        }

        // 检查是否是网络错误
        if (attempt === maxAttempts) {
          return createErrorResult(
            'NETWORK_ERROR',
            `Request failed: ${lastError.message}`
          );
        }

        // 等待后重试
        if (attempt < maxAttempts) {
          await this.sleep(retryConfig.retryDelay * attempt);
        }
      }
    }

    // 所有重试都失败了
    return createErrorResult(
      'NETWORK_ERROR',
      `Request failed after ${maxAttempts} attempts: ${lastError?.message}`
    );
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const config = node.config || {};

    if (!config.url || typeof config.url !== 'string') {
      errors.push('URL is required');
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (config.method && !validMethods.includes(config.method)) {
      errors.push(`Invalid HTTP method: ${config.method}`);
    }

    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout <= 0) {
        errors.push('Timeout must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 解析响应
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return text;
  }

  /**
   * 渲染模板字符串
   */
  private renderTemplate(template: string, context: NodeExecutionContext): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = context.getVariable(path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * 递归渲染对象中的模板
   */
  private renderObjectTemplates(obj: any, context: NodeExecutionContext): any {
    if (typeof obj === 'string') {
      return this.renderTemplate(obj, context);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.renderObjectTemplates(item, context));
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.renderObjectTemplates(value, context);
      }
      return result;
    }
    return obj;
  }

  /**
   * 延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
