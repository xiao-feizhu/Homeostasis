/**
 * 补偿事务管理器 (Saga 模式)
 *
 * 执行一系列步骤，如果失败则按相反顺序执行补偿操作
 */

export interface CompensationStep {
  name: string;
  execute: (context?: any) => Promise<any>;
  compensate: (result: any) => Promise<void>;
}

export interface SagaResult {
  success: boolean;
  results: Record<string, any>;
  compensatedSteps: string[];
  failedStep?: string;
  error?: Error;
  compensationErrors?: Error[];
}

export interface CompensationOptions {
  partialCompensation?: boolean;
  onStepComplete?: (stepName: string, result: any) => void;
  onCompensate?: (stepName: string, result: any) => void;
  onError?: (stepName: string, error: Error) => void;
}

/**
 * 补偿错误
 */
export class CompensationError extends Error {
  constructor(
    message: string,
    public readonly stepName: string,
    public readonly originalError: Error,
    public readonly compensationErrors?: Error[]
  ) {
    super(message);
    this.name = 'CompensationError';
    Object.setPrototypeOf(this, CompensationError.prototype);
  }
}

/**
 * 补偿事务管理器
 */
export class CompensationManager {
  private options: CompensationOptions;

  constructor(options: CompensationOptions = {}) {
    this.options = options;
  }

  /**
   * 执行 Saga 步骤
   */
  async execute(steps: CompensationStep[], context?: any): Promise<SagaResult> {
    const results: Record<string, any> = {};
    const executedSteps: { name: string; result: any; step: CompensationStep }[] = [];

    try {
      for (const step of steps) {
        try {
          const result = await step.execute(context);
          results[step.name] = result;
          executedSteps.push({ name: step.name, result, step });

          if (this.options.onStepComplete) {
            this.options.onStepComplete(step.name, result);
          }
        } catch (error) {
          const err = error as Error;

          if (this.options.onError) {
            this.options.onError(step.name, err);
          }

          // 执行补偿
          const { compensatedSteps, errors } = await this.compensate(executedSteps);

          return {
            success: false,
            results,
            compensatedSteps,
            failedStep: step.name,
            error: err,
            compensationErrors: errors,
          };
        }
      }

      return {
        success: true,
        results,
        compensatedSteps: [],
      };
    } catch (error) {
      // 意外错误
      return {
        success: false,
        results,
        compensatedSteps: [],
        error: error as Error,
      };
    }
  }

  /**
   * 执行补偿
   */
  private async compensate(
    executedSteps: { name: string; result: any; step: CompensationStep }[]
  ): Promise<{ compensatedSteps: string[]; errors: Error[] }> {
    const compensatedSteps: string[] = [];
    const errors: Error[] = [];

    // 按相反顺序执行补偿
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const { name, result, step } = executedSteps[i];

      try {
        await step.compensate(result);
        compensatedSteps.push(name);

        if (this.options.onCompensate) {
          this.options.onCompensate(name, result);
        }
      } catch (error) {
        const err = error as Error;
        errors.push(err);
        console.error(`Compensation failed for step ${name}:`, err);

        if (!this.options.partialCompensation) {
          // 如果不是部分补偿模式，停止补偿
          break;
        }
      }
    }

    return { compensatedSteps, errors };
  }
}

/**
 * 改进的补偿事务管理器
 *
 * 支持更好的补偿函数管理
 */
export class SagaOrchestrator {
  private steps: Map<string, CompensationStep> = new Map();
  private options: CompensationOptions;

  constructor(options: CompensationOptions = {}) {
    this.options = options;
  }

  /**
   * 注册步骤
   */
  registerStep(step: CompensationStep): void {
    this.steps.set(step.name, step);
  }

  /**
   * 执行 Saga
   */
  async execute(stepNames: string[], context?: any): Promise<SagaResult> {
    const results: Record<string, any> = {};
    const executedSteps: { name: string; result: any }[] = [];

    try {
      for (const stepName of stepNames) {
        const step = this.steps.get(stepName);
        if (!step) {
          throw new Error(`Step not found: ${stepName}`);
        }

        try {
          const result = await step.execute(context);
          results[step.name] = result;
          executedSteps.push({ name: step.name, result });

          if (this.options.onStepComplete) {
            this.options.onStepComplete(step.name, result);
          }
        } catch (error) {
          const err = error as Error;

          if (this.options.onError) {
            this.options.onError(step.name, err);
          }

          // 执行补偿
          const { compensatedSteps, errors } = await this.compensate(executedSteps);

          return {
            success: false,
            results,
            compensatedSteps,
            failedStep: step.name,
            error: err,
            compensationErrors: errors,
          };
        }
      }

      return {
        success: true,
        results,
        compensatedSteps: [],
      };
    } catch (error) {
      return {
        success: false,
        results,
        compensatedSteps: [],
        error: error as Error,
      };
    }
  }

  /**
   * 执行补偿
   */
  private async compensate(
    executedSteps: { name: string; result: any }[]
  ): Promise<{ compensatedSteps: string[]; errors: Error[] }> {
    const compensatedSteps: string[] = [];
    const errors: Error[] = [];

    // 按相反顺序执行补偿
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const { name, result } = executedSteps[i];
      const step = this.steps.get(name);

      if (!step) {
        errors.push(new Error(`Step definition not found for compensation: ${name}`));
        continue;
      }

      try {
        await step.compensate(result);
        compensatedSteps.push(name);

        if (this.options.onCompensate) {
          this.options.onCompensate(name, result);
        }
      } catch (error) {
        const err = error as Error;
        errors.push(err);
        console.error(`Compensation failed for step ${name}:`, err);

        if (!this.options.partialCompensation) {
          // 如果不是部分补偿模式，停止补偿
          break;
        }
      }
    }

    return { compensatedSteps, errors };
  }
}
