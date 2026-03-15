import {
  Breakpoint,
  BreakpointStatus,
  BreakpointTriggerMode,
  BreakpointConfig,
  ApprovalMode,
  ApprovalRecord
} from '../entities/hitl.entity';
import { WorkflowEvent, WorkflowEventType } from '../entities/workflow-definition.entity';

export interface CreateBreakpointParams {
  executionId: string;
  workflowId: string;
  nodeId: string;
  config: BreakpointConfig;
  context: Record<string, any>;
  createdBy?: string;
}

export interface SubmitApprovalParams {
  approverId: string;
  approverName: string;
  action: 'approve' | 'reject' | 'transfer' | 'delegate';
  comment?: string;
  modifications?: Record<string, any>;
}

export interface SubmitApprovalResult {
  success: boolean;
  breakpoint: Breakpoint;
  isComplete: boolean;
}

export interface CancelBreakpointResult {
  success: boolean;
  breakpoint: Breakpoint;
}

export class BreakpointManager {
  private breakpoints: Map<string, Breakpoint> = new Map();
  private events: WorkflowEvent[] = [];
  private eventIdCounter = 0;

  /**
   * 创建断点
   */
  createBreakpoint(params: CreateBreakpointParams): Breakpoint {
    const { executionId, workflowId, nodeId, config, context, createdBy } = params;

    // Check for duplicate breakpoint
    for (const bp of this.breakpoints.values()) {
      if (bp.executionId === executionId && bp.nodeId === nodeId) {
        if (bp.status === BreakpointStatus.PENDING || bp.status === BreakpointStatus.IN_REVIEW) {
          throw new Error(`Breakpoint already exists for node ${nodeId} in execution ${executionId}`);
        }
      }
    }

    const now = new Date();
    const breakpointId = this.generateBreakpointId();

    const breakpoint: Breakpoint = {
      breakpointId,
      executionId,
      workflowId,
      nodeId,
      type: config.type,
      mode: config.mode,
      status: BreakpointStatus.PENDING,
      config,
      context: this.captureContext(context, config),
      approvals: [],
      createdAt: now,
      updatedAt: now,
      createdBy
    };

    // Set expiration if timeout is configured
    if (config.timeout?.duration) {
      breakpoint.expiresAt = new Date(now.getTime() + config.timeout.duration * 60 * 1000);
    }

    this.breakpoints.set(breakpointId, breakpoint);

    // Emit event
    this.emitEvent({
      eventType: WorkflowEventType.BREAKPOINT_HIT,
      executionId,
      workflowId,
      payload: {
        nodeId,
        breakpointId,
        type: config.type
      }
    });

    return breakpoint;
  }

  /**
   * 评估条件表达式
   */
  evaluateCondition(
    context: Record<string, any>,
    condition: { field: string; operator: string; value: any }
  ): boolean {
    const { field, operator, value } = condition;

    // Get field value (supports nested paths like "order.customer.tier")
    const fieldValue = this.getNestedValue(context, field);

    switch (operator) {
      case 'eq':
        return fieldValue === value;
      case 'gt':
        return fieldValue > value;
      case 'lt':
        return fieldValue < value;
      case 'gte':
        return fieldValue >= value;
      case 'lte':
        return fieldValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'contains':
        return Array.isArray(fieldValue) && fieldValue.includes(value);
      default:
        return false;
    }
  }

  /**
   * 判断是否应触发断点
   */
  shouldTriggerBreakpoint(
    config: BreakpointConfig,
    context: Record<string, any>
  ): boolean {
    if (!config.enabled) {
      return false;
    }

    // Static breakpoints always trigger if enabled
    if (config.mode === BreakpointTriggerMode.STATIC) {
      return true;
    }

    // Manual breakpoints don't auto-trigger
    if (config.mode === BreakpointTriggerMode.MANUAL) {
      return false;
    }

    // Dynamic breakpoints evaluate condition
    if (config.mode === BreakpointTriggerMode.DYNAMIC && config.condition) {
      return this.evaluateCondition(context, config.condition);
    }

    return true;
  }

  /**
   * 提交审批
   */
  submitApproval(
    breakpointId: string,
    params: SubmitApprovalParams
  ): SubmitApprovalResult {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (!breakpoint) {
      throw new Error(`Breakpoint not found: ${breakpointId}`);
    }

    if (breakpoint.status !== BreakpointStatus.PENDING &&
        breakpoint.status !== BreakpointStatus.IN_REVIEW) {
      throw new Error('Breakpoint is already resolved');
    }

    const record: ApprovalRecord = {
      recordId: this.generateRecordId(),
      approverId: params.approverId,
      approverName: params.approverName,
      action: params.action,
      comment: params.comment,
      modifications: params.modifications,
      timestamp: new Date(),
      step: breakpoint.approvals.length + 1
    };

    breakpoint.approvals.push(record);

    // Update status based on action
    if (params.action === 'reject') {
      breakpoint.status = BreakpointStatus.REJECTED;
      breakpoint.resolvedAt = new Date();
      breakpoint.resolvedBy = params.approverId;
      breakpoint.resolution = {
        action: 'reject',
        comment: params.comment
      };
    } else if (params.action === 'approve') {
      const approvalMode = breakpoint.config.approvalMode || ApprovalMode.ANY;
      const approvers = breakpoint.config.approvers?.users || [];

      if (approvalMode === ApprovalMode.ANY) {
        // Any approval completes the breakpoint
        breakpoint.status = BreakpointStatus.APPROVED;
        breakpoint.resolvedAt = new Date();
        breakpoint.resolvedBy = params.approverId;
        breakpoint.resolution = {
          action: 'approve',
          comment: params.comment
        };
      } else if (approvalMode === ApprovalMode.ALL) {
        // Need all approvers
        const approvedCount = breakpoint.approvals.filter(a => a.action === 'approve').length;
        if (approvedCount >= approvers.length) {
          breakpoint.status = BreakpointStatus.APPROVED;
          breakpoint.resolvedAt = new Date();
          breakpoint.resolvedBy = params.approverId;
          breakpoint.resolution = {
            action: 'approve',
            comment: params.comment
          };
        } else {
          breakpoint.status = BreakpointStatus.IN_REVIEW;
        }
      } else {
        breakpoint.status = BreakpointStatus.IN_REVIEW;
      }
    }

    breakpoint.updatedAt = new Date();

    // Emit events
    this.emitEvent({
      eventType: WorkflowEventType.APPROVAL_SUBMITTED,
      executionId: breakpoint.executionId,
      workflowId: breakpoint.workflowId,
      payload: {
        breakpointId,
        nodeId: breakpoint.nodeId,
        approverId: params.approverId,
        action: params.action
      }
    });

    if (breakpoint.status === BreakpointStatus.APPROVED ||
        breakpoint.status === BreakpointStatus.REJECTED) {
      this.emitEvent({
        eventType: WorkflowEventType.APPROVAL_COMPLETED,
        executionId: breakpoint.executionId,
        workflowId: breakpoint.workflowId,
        payload: {
          breakpointId,
          nodeId: breakpoint.nodeId,
          status: breakpoint.status,
          resolution: breakpoint.resolution
        }
      });

      this.emitEvent({
        eventType: WorkflowEventType.BREAKPOINT_RESOLVED,
        executionId: breakpoint.executionId,
        workflowId: breakpoint.workflowId,
        payload: {
          breakpointId,
          nodeId: breakpoint.nodeId,
          status: breakpoint.status
        }
      });
    }

    return {
      success: true,
      breakpoint,
      isComplete: breakpoint.status === BreakpointStatus.APPROVED ||
                  breakpoint.status === BreakpointStatus.REJECTED
    };
  }

  /**
   * 取消断点
   */
  cancelBreakpoint(breakpointId: string, cancelledBy: string): CancelBreakpointResult {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (!breakpoint) {
      throw new Error(`Breakpoint not found: ${breakpointId}`);
    }

    if (breakpoint.status !== BreakpointStatus.PENDING &&
        breakpoint.status !== BreakpointStatus.IN_REVIEW) {
      throw new Error('Cannot cancel resolved breakpoint');
    }

    breakpoint.status = BreakpointStatus.CANCELLED;
    breakpoint.resolvedAt = new Date();
    breakpoint.resolvedBy = cancelledBy;
    breakpoint.updatedAt = new Date();

    this.emitEvent({
      eventType: WorkflowEventType.BREAKPOINT_CANCELLED,
      executionId: breakpoint.executionId,
      workflowId: breakpoint.workflowId,
      payload: {
        breakpointId,
        nodeId: breakpoint.nodeId
      }
    });

    return { success: true, breakpoint };
  }

  /**
   * 获取断点
   */
  getBreakpoint(breakpointId: string): Breakpoint | undefined {
    return this.breakpoints.get(breakpointId);
  }

  /**
   * 获取执行的所有断点
   */
  getBreakpointsByExecution(executionId: string): Breakpoint[] {
    return Array.from(this.breakpoints.values())
      .filter(bp => bp.executionId === executionId);
  }

  /**
   * 获取待处理的断点
   */
  getPendingBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values())
      .filter(bp => bp.status === BreakpointStatus.PENDING || bp.status === BreakpointStatus.IN_REVIEW);
  }

  /**
   * 检查并处理超时断点
   */
  checkTimeout(): Breakpoint[] {
    const now = new Date();
    const expired: Breakpoint[] = [];

    for (const breakpoint of this.breakpoints.values()) {
      if (breakpoint.expiresAt &&
          breakpoint.expiresAt < now &&
          (breakpoint.status === BreakpointStatus.PENDING || breakpoint.status === BreakpointStatus.IN_REVIEW)) {
        breakpoint.status = BreakpointStatus.TIMEOUT;
        breakpoint.resolvedAt = now;
        breakpoint.updatedAt = now;
        expired.push(breakpoint);

        this.emitEvent({
          eventType: WorkflowEventType.BREAKPOINT_EXPIRED,
          executionId: breakpoint.executionId,
          workflowId: breakpoint.workflowId,
          payload: {
            breakpointId: breakpoint.breakpointId,
            nodeId: breakpoint.nodeId
          }
        });
      }
    }

    return expired;
  }

  /**
   * 获取所有事件
   */
  getEvents(): WorkflowEvent[] {
    return [...this.events];
  }

  /**
   * 生成断点ID
   */
  private generateBreakpointId(): string {
    return `bp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成记录ID
   */
  private generateRecordId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 捕获上下文
   */
  private captureContext(
    context: Record<string, any>,
    config: BreakpointConfig
  ): Breakpoint['context'] {
    const capture = config.contextCapture || {
      input: true,
      output: false,
      logs: false,
      executionPath: false
    };

    return {
      input: capture.input ? context.input : undefined,
      output: capture.output ? context.output : undefined,
      logs: capture.logs ? context.logs : undefined,
      executionPath: capture.executionPath ? context.executionPath : undefined
    };
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * 发送事件
   */
  private emitEvent(params: {
    eventType: WorkflowEventType;
    executionId: string;
    workflowId: string;
    payload: any;
  }): void {
    this.eventIdCounter++;
    const event: WorkflowEvent = {
      eventId: `evt-${Date.now()}-${this.eventIdCounter}`,
      eventType: params.eventType,
      executionId: params.executionId,
      workflowId: params.workflowId,
      timestamp: new Date(),
      version: this.eventIdCounter,
      payload: params.payload,
      metadata: {
        correlationId: params.executionId
      }
    };

    this.events.push(event);
  }
}
