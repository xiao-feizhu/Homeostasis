import {
  HITLAuditLog,
  Breakpoint,
  InterventionResult,
  InterventionAction,
  OperatorInfo
} from '../entities/hitl.entity';

export interface AuditLogStorage {
  save(log: HITLAuditLog): Promise<void>;
  query(filters: AuditLogQueryFilters): Promise<{ logs: HITLAuditLog[]; total: number }>;
  getById(logId: string): Promise<HITLAuditLog | null>;
  delete?(logId: string): Promise<void>;
}

export interface AuditLogQueryFilters {
  actionType?: 'breakpoint' | 'intervention' | 'approval' | 'config';
  action?: string;
  executionId?: string;
  userId?: string;
  startTime?: Date;
  endTime?: Date;
  result?: 'success' | 'failure';
  limit?: number;
  offset?: number;
}

export interface LogResult {
  success: boolean;
  logId?: string;
  error?: string;
}

export interface QueryResult {
  success: boolean;
  logs?: HITLAuditLog[];
  total?: number;
  error?: string;
}

export interface GetLogResult {
  success: boolean;
  log?: HITLAuditLog;
  error?: string;
}

export interface ReportResult {
  success: boolean;
  summary?: {
    totalActions: number;
    successCount: number;
    failureCount: number;
    breakdown: {
      breakpoint: number;
      intervention: number;
      approval: number;
      config: number;
    };
    topUsers: { userId: string; userName: string; count: number }[];
  };
  error?: string;
}

export interface RetentionResult {
  success: boolean;
  deletedCount?: number;
  error?: string;
}

export interface AnonymizeResult {
  success: boolean;
  anonymizedCount?: number;
  error?: string;
}

export class AuditLogger {
  constructor(private storage: AuditLogStorage) {}

  /**
   * 记录审计日志
   */
  async log(log: HITLAuditLog): Promise<LogResult> {
    try {
      // 生成 logId 如果没有提供
      if (!log.logId) {
        log.logId = this.generateLogId();
      }

      // 设置时间戳如果没有提供
      if (!log.timestamp) {
        log.timestamp = new Date();
      }

      await this.storage.save(log);

      return { success: true, logId: log.logId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save log'
      };
    }
  }

  /**
   * 记录断点事件
   */
  async logBreakpointEvent(
    action: string,
    breakpoint: Breakpoint,
    operator: OperatorInfo,
    details?: Record<string, any>
  ): Promise<LogResult> {
    const log: HITLAuditLog = {
      logId: this.generateLogId(),
      timestamp: new Date(),
      action,
      actionType: 'breakpoint',
      target: {
        type: 'breakpoint',
        id: breakpoint.breakpointId,
        executionId: breakpoint.executionId,
        workflowId: breakpoint.workflowId
      },
      operator,
      details: details || {},
      result: 'success'
    };

    return this.log(log);
  }

  /**
   * 记录干预操作
   */
  async logIntervention(
    action: InterventionAction,
    intervention: InterventionResult,
    operator: OperatorInfo,
    params?: {
      nodeId?: string;
      targetNodeId?: string;
      modifications?: Record<string, any>;
      reason?: string;
    }
  ): Promise<LogResult> {
    const log: HITLAuditLog = {
      logId: this.generateLogId(),
      timestamp: new Date(),
      action,
      actionType: 'intervention',
      target: {
        type: 'execution',
        id: intervention.executionId,
        executionId: intervention.executionId
      },
      operator,
      details: {
        nodeId: params?.nodeId,
        targetNodeId: params?.targetNodeId,
        modifications: params?.modifications,
        reason: params?.reason,
        rolledBackNodes: intervention.rolledBackNodes,
        resumedFrom: intervention.resumedFrom
      },
      result: intervention.success ? 'success' : 'failure',
      error: intervention.error
    };

    return this.log(log);
  }

  /**
   * 记录审批操作
   */
  async logApproval(
    action: string,
    breakpointId: string,
    operator: OperatorInfo,
    details: {
      action?: 'approve' | 'reject' | 'transfer' | 'delegate';
      comment?: string;
      approvers?: string[];
      before?: any;
      after?: any;
    }
  ): Promise<LogResult> {
    const logDetails: Record<string, any> = {
      approvalAction: details.action,
      comment: details.comment,
      approvers: details.approvers
    };

    // 计算变更
    if (details.before && details.after) {
      logDetails.changes = this.calculateChanges(details.before, details.after);
      logDetails.before = details.before;
      logDetails.after = details.after;
    }

    const log: HITLAuditLog = {
      logId: this.generateLogId(),
      timestamp: new Date(),
      action,
      actionType: 'approval',
      target: {
        type: 'breakpoint',
        id: breakpointId
      },
      operator,
      details: logDetails,
      result: 'success'
    };

    return this.log(log);
  }

  /**
   * 查询日志
   */
  async query(filters: AuditLogQueryFilters): Promise<QueryResult> {
    try {
      const { logs, total } = await this.storage.query(filters);
      return { success: true, logs, total };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }

  /**
   * 获取单条日志
   */
  async getLogById(logId: string): Promise<GetLogResult> {
    try {
      const log = await this.storage.getById(logId);
      if (!log) {
        return { success: false, error: `Log ${logId} not found` };
      }
      return { success: true, log };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get log'
      };
    }
  }

  /**
   * 获取执行相关的日志
   */
  async getExecutionLogs(executionId: string): Promise<QueryResult> {
    return this.query({ executionId });
  }

  /**
   * 获取用户活动日志
   */
  async getUserActivity(
    userId: string,
    options: { startTime?: Date; endTime?: Date }
  ): Promise<QueryResult> {
    return this.query({
      userId,
      startTime: options.startTime,
      endTime: options.endTime
    });
  }

  /**
   * 生成活动报告
   */
  async generateReport(options: {
    startTime: Date;
    endTime: Date;
  }): Promise<ReportResult> {
    try {
      const { logs } = await this.query({
        startTime: options.startTime,
        endTime: options.endTime,
        limit: 10000
      });

      if (!logs) {
        return { success: true, summary: this.getEmptySummary() };
      }

      const summary = {
        totalActions: logs.length,
        successCount: logs.filter(l => l.result === 'success').length,
        failureCount: logs.filter(l => l.result === 'failure').length,
        breakdown: {
          breakpoint: logs.filter(l => l.actionType === 'breakpoint').length,
          intervention: logs.filter(l => l.actionType === 'intervention').length,
          approval: logs.filter(l => l.actionType === 'approval').length,
          config: logs.filter(l => l.actionType === 'config').length
        },
        topUsers: this.calculateTopUsers(logs)
      };

      return { success: true, summary };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed'
      };
    }
  }

  /**
   * 匿名化用户日志 (GDPR 合规)
   */
  async anonymizeUserLogs(userId: string): Promise<AnonymizeResult> {
    try {
      const { logs } = await this.query({ userId });

      if (!logs || logs.length === 0) {
        return { success: true, anonymizedCount: 0 };
      }

      for (const log of logs) {
        log.operator.userName = '[REDACTED]';
        log.operator.ip = undefined;
        log.operator.userAgent = undefined;
        await this.storage.save(log);
      }

      return { success: true, anonymizedCount: logs.length };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Anonymization failed'
      };
    }
  }

  /**
   * 应用保留策略
   */
  async applyRetentionPolicy(retentionDays: number): Promise<RetentionResult> {
    try {
      if (!this.storage.delete) {
        return { success: false, error: 'Storage does not support deletion' };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { logs } = await this.query({
        endTime: cutoffDate,
        limit: 10000
      });

      if (!logs || logs.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      for (const log of logs) {
        await this.storage.delete!(log.logId);
      }

      return { success: true, deletedCount: logs.length };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Retention policy failed'
      };
    }
  }

  /**
   * 计算变更
   */
  private calculateChanges(before: any, after: any): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = {
          from: before[key],
          to: after[key]
        };
      }
    }

    return changes;
  }

  /**
   * 计算活跃用户
   */
  private calculateTopUsers(logs: HITLAuditLog[]): { userId: string; userName: string; count: number }[] {
    const userCounts = new Map<string, { userId: string; userName: string; count: number }>();

    for (const log of logs) {
      const { userId, userName } = log.operator;
      const existing = userCounts.get(userId);
      if (existing) {
        existing.count++;
      } else {
        userCounts.set(userId, { userId, userName, count: 1 });
      }
    }

    return Array.from(userCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * 获取空摘要
   */
  private getEmptySummary() {
    return {
      totalActions: 0,
      successCount: 0,
      failureCount: 0,
      breakdown: {
        breakpoint: 0,
        intervention: 0,
        approval: 0,
        config: 0
      },
      topUsers: []
    };
  }

  /**
   * 生成日志ID
   */
  private generateLogId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
