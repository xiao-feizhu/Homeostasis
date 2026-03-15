/**
 * 迁移引擎
 *
 * 处理工作流版本迁移，包括执行中工作流的处理
 */

import { VersionManager } from './version.manager';
import { VersionComparator } from './version.comparator';

export enum MigrationStrategy {
  CONTINUE_OLD_VERSION = 'continue_old_version',
  FORCE_MIGRATE = 'force_migrate',
  MANUAL_APPROVAL = 'manual_approval',
}

export interface MigrationOptions {
  strategy: MigrationStrategy;
  allowBreakingChanges?: boolean;
  preserveContext?: boolean;
  onMigrationStart?: (executionId: string, fromVersion: string, toVersion: string) => void;
  onMigrationComplete?: (executionId: string, success: boolean) => void;
}

export interface MigrationResult {
  success: boolean;
  executionId: string;
  fromVersion: string;
  toVersion: string;
  strategy: MigrationStrategy;
  error?: string;
  contextPreserved?: boolean;
}

/**
 * 迁移引擎
 */
export class MigrationEngine {
  constructor(
    private versionManager: VersionManager,
    private comparator: VersionComparator
  ) {}

  /**
   * 评估迁移可行性
   */
  async evaluateMigration(
    workflowId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<{
    canMigrate: boolean;
    isCompatible: boolean;
    breakingChanges: number;
    recommendation: MigrationStrategy;
    reason: string;
  }> {
    const fromMeta = await this.versionManager.getVersion(workflowId, fromVersion);
    const toMeta = await this.versionManager.getVersion(workflowId, toVersion);

    if (!fromMeta || !toMeta) {
      return {
        canMigrate: false,
        isCompatible: false,
        breakingChanges: 0,
        recommendation: MigrationStrategy.CONTINUE_OLD_VERSION,
        reason: 'Source or target version not found',
      };
    }

    const diff = this.comparator.compare(
      fromMeta.definition.nodes || [],
      toMeta.definition.nodes || []
    );

    const isCompatible = diff.isCompatible;
    const hasBreakingChanges = diff.breakingChanges > 0;

    let recommendation: MigrationStrategy;
    let reason: string;

    if (isCompatible) {
      recommendation = MigrationStrategy.FORCE_MIGRATE;
      reason = 'Versions are compatible, automatic migration recommended';
    } else if (hasBreakingChanges) {
      recommendation = MigrationStrategy.MANUAL_APPROVAL;
      reason = `Breaking changes detected (${diff.breakingChanges}), manual approval required`;
    } else {
      recommendation = MigrationStrategy.CONTINUE_OLD_VERSION;
      reason = 'Incompatible changes detected, continuing with old version recommended';
    }

    return {
      canMigrate: isCompatible || !hasBreakingChanges,
      isCompatible,
      breakingChanges: diff.breakingChanges,
      recommendation,
      reason,
    };
  }

  /**
   * 执行迁移
   */
  async migrate(
    executionId: string,
    workflowId: string,
    fromVersion: string,
    toVersion: string,
    options: MigrationOptions,
    currentContext?: any
  ): Promise<MigrationResult> {
    if (options.onMigrationStart) {
      options.onMigrationStart(executionId, fromVersion, toVersion);
    }

    try {
      // 评估迁移
      const evaluation = await this.evaluateMigration(workflowId, fromVersion, toVersion);

      if (!evaluation.canMigrate && !options.allowBreakingChanges) {
        const result: MigrationResult = {
          success: false,
          executionId,
          fromVersion,
          toVersion,
          strategy: options.strategy,
          error: evaluation.reason,
        };

        if (options.onMigrationComplete) {
          options.onMigrationComplete(executionId, false);
        }

        return result;
      }

      // 根据策略处理
      switch (options.strategy) {
        case MigrationStrategy.CONTINUE_OLD_VERSION:
          return this.handleContinueOldVersion(
            executionId,
            fromVersion,
            toVersion,
            options,
            currentContext
          );

        case MigrationStrategy.FORCE_MIGRATE:
          return this.handleForceMigrate(
            executionId,
            fromVersion,
            toVersion,
            options,
            currentContext
          );

        case MigrationStrategy.MANUAL_APPROVAL:
          return this.handleManualApproval(
            executionId,
            fromVersion,
            toVersion,
            options,
            currentContext
          );

        default:
          throw new Error(`Unknown migration strategy: ${options.strategy}`);
      }
    } catch (error) {
      const result: MigrationResult = {
        success: false,
        executionId,
        fromVersion,
        toVersion,
        strategy: options.strategy,
        error: (error as Error).message,
      };

      if (options.onMigrationComplete) {
        options.onMigrationComplete(executionId, false);
      }

      return result;
    }
  }

  /**
   * 继续使用旧版本
   */
  private async handleContinueOldVersion(
    executionId: string,
    fromVersion: string,
    toVersion: string,
    options: MigrationOptions,
    _currentContext?: any
  ): Promise<MigrationResult> {
    // 不迁移，继续使用旧版本
    const result: MigrationResult = {
      success: true,
      executionId,
      fromVersion,
      toVersion,
      strategy: MigrationStrategy.CONTINUE_OLD_VERSION,
      contextPreserved: true,
    };

    if (options.onMigrationComplete) {
      options.onMigrationComplete(executionId, true);
    }

    return result;
  }

  /**
   * 强制迁移
   */
  private async handleForceMigrate(
    executionId: string,
    fromVersion: string,
    toVersion: string,
    options: MigrationOptions,
    _currentContext?: any
  ): Promise<MigrationResult> {
    // 执行迁移逻辑
    // 这里可以添加实际的上下文转换逻辑

    const result: MigrationResult = {
      success: true,
      executionId,
      fromVersion,
      toVersion,
      strategy: MigrationStrategy.FORCE_MIGRATE,
      contextPreserved: options.preserveContext ?? true,
    };

    if (options.onMigrationComplete) {
      options.onMigrationComplete(executionId, true);
    }

    return result;
  }

  /**
   * 手动审批迁移
   */
  private async handleManualApproval(
    executionId: string,
    fromVersion: string,
    toVersion: string,
    options: MigrationOptions,
    _currentContext?: any
  ): Promise<MigrationResult> {
    // 记录需要手动审批的迁移
    // 实际应用中应该创建一个审批流程

    const result: MigrationResult = {
      success: false,
      executionId,
      fromVersion,
      toVersion,
      strategy: MigrationStrategy.MANUAL_APPROVAL,
      error: 'Migration requires manual approval',
      contextPreserved: true,
    };

    if (options.onMigrationComplete) {
      options.onMigrationComplete(executionId, false);
    }

    return result;
  }
}
