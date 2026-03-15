import {
  ApprovalFlow,
  ApprovalStep,
  ApprovalMode,
  Breakpoint,
  BreakpointStatus,
  ApprovalRecord
} from '../entities/hitl.entity';

export interface RegisterFlowResult {
  success: boolean;
  error?: string;
}

export interface StartApprovalResult {
  success: boolean;
  currentStep?: ApprovalStep;
  pendingApprovers: string[];
  error?: string;
}

export interface ProcessApprovalParams {
  approverId: string;
  action: 'approve' | 'reject' | 'transfer' | 'delegate';
  comment?: string;
  modifications?: Record<string, any>;
}

export interface ProcessApprovalResult {
  success: boolean;
  isComplete: boolean;
  breakpoint: Breakpoint;
  nextStep?: ApprovalStep;
  error?: string;
}

export interface EscalationResult {
  success: boolean;
  currentStep?: ApprovalStep;
  error?: string;
}

export interface DelegationResult {
  success: boolean;
  delegatedTo: string;
}

export interface BatchApprovalResult {
  success: boolean;
  processed: number;
  failed: number;
}

export class ApprovalEngine {
  private flows: Map<string, ApprovalFlow> = new Map();

  /**
   * 注册审批流
   */
  registerFlow(flow: ApprovalFlow): RegisterFlowResult {
    // 检查重复
    if (this.flows.has(flow.flowId)) {
      return { success: false, error: `Flow ${flow.flowId} already exists` };
    }

    // 验证至少有一个步骤
    if (!flow.steps || flow.steps.length === 0) {
      return { success: false, error: 'Flow must have at least one step' };
    }

    // 验证步骤顺序
    const sortedSteps = [...flow.steps].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedSteps.length; i++) {
      if (sortedSteps[i].order !== i + 1) {
        return { success: false, error: 'Step orders must be sequential starting from 1' };
      }
    }

    this.flows.set(flow.flowId, flow);
    return { success: true };
  }

  /**
   * 获取审批流
   */
  getFlow(flowId: string): ApprovalFlow | undefined {
    return this.flows.get(flowId);
  }

  /**
   * 查找匹配的审批流
   */
  findMatchingFlow(
    workflowId: string,
    nodeId: string,
    context: Record<string, any>
  ): ApprovalFlow | null {
    for (const flow of this.flows.values()) {
      if (!flow.enabled) continue;

      const trigger = flow.trigger;

      switch (trigger.type) {
        case 'workflow_node':
          if (trigger.workflowIds?.includes(workflowId) &&
              trigger.nodeIds?.includes(nodeId)) {
            return flow;
          }
          break;

        case 'condition':
          if (trigger.condition && this.evaluateCondition(trigger.condition, context)) {
            return flow;
          }
          break;

        case 'manual':
          // Manual flows are not auto-triggered
          break;
      }
    }

    return null;
  }

  /**
   * 启动审批流程
   */
  startApproval(breakpoint: Breakpoint, flow: ApprovalFlow): StartApprovalResult {
    const firstStep = this.findNextApplicableStep(flow, 0, breakpoint.context);

    if (!firstStep) {
      return { success: false, pendingApprovers: [], error: 'No applicable step found' };
    }

    const approvers = this.resolveApprovers(firstStep, breakpoint.context);

    return {
      success: true,
      currentStep: firstStep,
      pendingApprovers: approvers
    };
  }

  /**
   * 处理审批决定
   */
  processApproval(
    breakpoint: Breakpoint,
    params: ProcessApprovalParams
  ): ProcessApprovalResult {
    const { approverId, action, comment, modifications } = params;

    // 检查是否已审批
    const existingApproval = breakpoint.approvals.find(a => a.approverId === approverId);
    if (existingApproval) {
      throw new Error(`Approver ${approverId} has already submitted`);
    }

    // 记录审批
    const record: ApprovalRecord = {
      recordId: this.generateRecordId(),
      approverId,
      approverName: approverId,
      action,
      comment,
      modifications,
      timestamp: new Date()
    };

    breakpoint.approvals.push(record);
    breakpoint.updatedAt = new Date();

    // 处理不同动作
    if (action === 'reject') {
      breakpoint.status = BreakpointStatus.REJECTED;
      breakpoint.resolvedAt = new Date();
      breakpoint.resolvedBy = approverId;
      breakpoint.resolution = { action: 'reject', comment };
      return { success: true, isComplete: true, breakpoint };
    }

    // 获取当前步骤
    const flow = this.getFlowForBreakpoint(breakpoint);
    const currentStep = flow ? this.getCurrentStep(breakpoint, flow) : undefined;

    // 检查是否完成当前步骤
    const isStepComplete = this.isStepComplete(breakpoint, action, currentStep);

    if (isStepComplete) {
      // 获取当前步骤顺序（从断点配置或审批记录推断）
      const currentStepOrder = this.getCurrentStepOrderFromApprovals(breakpoint);

      // 查找下一步
      let nextStep: ApprovalStep | undefined;
      if (flow) {
        nextStep = this.findNextApplicableStep(flow, currentStepOrder, breakpoint.context);
      }

      if (nextStep) {
        return { success: true, isComplete: false, breakpoint, nextStep };
      } else {
        // 审批完成
        breakpoint.status = BreakpointStatus.APPROVED;
        breakpoint.resolvedAt = new Date();
        breakpoint.resolvedBy = approverId;
        breakpoint.resolution = { action: 'approve', comment };
        return { success: true, isComplete: true, breakpoint };
      }
    }

    breakpoint.status = BreakpointStatus.IN_REVIEW;
    return { success: true, isComplete: false, breakpoint };
  }

  /**
   * 升级处理
   */
  escalate(breakpoint: Breakpoint, flow: ApprovalFlow): EscalationResult {
    // 找到当前步骤并升级到下一步
    const currentStepOrder = this.getCurrentStepOrder(breakpoint, flow);
    const nextStep = this.findNextApplicableStep(flow, currentStepOrder, breakpoint.context);

    if (!nextStep) {
      return { success: false, error: 'No escalation step available' };
    }

    breakpoint.status = BreakpointStatus.ESCALATED;
    breakpoint.updatedAt = new Date();

    return {
      success: true,
      currentStep: nextStep
    };
  }

  /**
   * 处理超时
   */
  handleTimeout(breakpoint: Breakpoint, flow?: ApprovalFlow): ProcessApprovalResult {
    const currentStep = flow ? this.getCurrentStep(breakpoint, flow) : undefined;
    if (flow && !currentStep) {
      return { success: false, isComplete: false, breakpoint, error: 'No current step' };
    }

    const autoAction = currentStep?.timeout?.autoAction || 'escalate';

    switch (autoAction) {
      case 'approve':
        return this.processApproval(breakpoint, {
          approverId: 'system',
          action: 'approve',
          comment: 'Auto-approved due to timeout'
        });

      case 'reject':
        return this.processApproval(breakpoint, {
          approverId: 'system',
          action: 'reject',
          comment: 'Auto-rejected due to timeout'
        });

      case 'escalate':
        if (flow) {
          const escalationResult = this.escalate(breakpoint, flow);
          return {
            success: escalationResult.success,
            isComplete: false,
            breakpoint,
            nextStep: escalationResult.currentStep,
            error: escalationResult.error
          };
        }
        return { success: false, isComplete: false, breakpoint, error: 'No flow for escalation' };

      default:
        return { success: true, isComplete: false, breakpoint };
    }
  }

  /**
   * 委托审批
   */
  delegate(
    breakpoint: Breakpoint,
    fromUserId: string,
    toUserId: string
  ): DelegationResult {
    if (fromUserId === toUserId) {
      throw new Error('Cannot delegate to self');
    }

    // 记录委托
    breakpoint.approvals.push({
      recordId: this.generateRecordId(),
      approverId: fromUserId,
      approverName: fromUserId,
      action: 'delegate',
      comment: `Delegated to ${toUserId}`,
      timestamp: new Date()
    });

    return { success: true, delegatedTo: toUserId };
  }

  /**
   * 批量审批
   */
  batchApprove(breakpointIds: string[], _approverId: string, allowBatch: boolean = false): BatchApprovalResult {
    if (!allowBatch) {
      throw new Error('Batch approval not enabled');
    }
    // This is a placeholder - actual implementation would need breakpoint storage
    return { success: true, processed: breakpointIds.length, failed: 0 };
  }

  /**
   * 计算提醒时间
   */
  calculateReminderTimes(step: ApprovalStep, startTime: Date): Date[] {
    return step.notifications.reminderIntervals.map(minutes =>
      new Date(startTime.getTime() + minutes * 60 * 1000)
    );
  }

  /**
   * 检查是否需要提醒
   */
  isReminderDue(breakpoint: Breakpoint, step: ApprovalStep): boolean {
    const reminders = this.calculateReminderTimes(step, breakpoint.createdAt);
    const now = new Date();

    return reminders.some(time => time <= now);
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(expression: string, context: Record<string, any>): boolean {
    try {
      // Simple expression evaluation - in production, use a proper expression parser
      // Support format: ${field} operator value or context.field operator value
      let match = expression.match(/\$\{([^}]+)\}\s*(>|<|=|>=|<=)\s*(.+)/);

      if (!match) {
        // Try alternate format: context.field operator value
        match = expression.match(/context\.([^\s]+)\s*(>|<|=|>=|<=)\s*(.+)/);
      }

      if (!match) return false;

      const [, field, operator, valueStr] = match;
      const fieldValue = this.getNestedValue(context, field);
      const value = this.parseValue(valueStr.trim());

      switch (operator) {
        case '>': return fieldValue > value;
        case '<': return fieldValue < value;
        case '=': return fieldValue === value;
        case '>=': return fieldValue >= value;
        case '<=': return fieldValue <= value;
        default: return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 解析值
   */
  private parseValue(value: string): any {
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    return isNaN(num) ? value : num;
  }

  /**
   * 查找下一个适用的步骤
   */
  private findNextApplicableStep(
    flow: ApprovalFlow,
    currentOrder: number,
    context: Record<string, any>
  ): ApprovalStep | undefined {
    const sortedSteps = [...flow.steps].sort((a, b) => a.order - b.order);

    for (const step of sortedSteps) {
      if (step.order <= currentOrder) continue;

      if (!step.condition || this.evaluateCondition(step.condition, context)) {
        return step;
      }
    }

    return undefined;
  }

  /**
   * 解析审批人
   */
  private resolveApprovers(
    step: ApprovalStep,
    context: Record<string, any>
  ): string[] {
    switch (step.approvers.type) {
      case 'user':
        return step.approvers.values;

      case 'role':
        // In production, lookup users by role
        return step.approvers.values;

      case 'dynamic':
        if (step.approvers.dynamicExpression) {
          const dynamicValue = this.getNestedValue(
            context,
            step.approvers.dynamicExpression.replace(/\$\{([^}]+)\}/, '$1')
          );
          return dynamicValue ? [dynamicValue] : [];
        }
        return [];

      default:
        return [];
    }
  }

  /**
   * 检查步骤是否完成
   */
  private isStepComplete(
    breakpoint: Breakpoint,
    action: string,
    currentStep?: ApprovalStep
  ): boolean {
    if (action === 'reject') return true;

    // 优先使用步骤配置，否则回退到 breakpoint config
    const config = breakpoint.config;
    const mode = currentStep?.mode ?? config.approvalMode ?? ApprovalMode.ANY;
    const requiredApprovals = config.requiredApprovals || 1;

    const approvedCount = breakpoint.approvals.filter(a => a.action === 'approve').length;

    switch (mode) {
      case ApprovalMode.ANY:
        return approvedCount >= 1;
      case ApprovalMode.ALL: {
        // 优先使用步骤中的审批人数量
        const approvers = currentStep?.approvers?.values ?? config.approvers?.users ?? [];
        return approvedCount >= approvers.length;
      }
      case ApprovalMode.VOTE:
        return approvedCount >= requiredApprovals;
      default:
        return approvedCount >= 1;
    }
  }

  /**
   * 获取当前步骤
   */
  private getCurrentStep(breakpoint: Breakpoint, flow: ApprovalFlow): ApprovalStep | undefined {
    const order = this.getCurrentStepOrder(breakpoint, flow);
    return flow.steps.find(s => s.order === order);
  }

  /**
   * 从审批记录推断当前步骤顺序
   */
  private getCurrentStepOrderFromApprovals(breakpoint: Breakpoint): number {
    // Simplified - assumes single step for now
    // In production, track current step explicitly in breakpoint
    return breakpoint.approvals.length > 0 ? 1 : 0;
  }

  /**
   * 获取当前步骤顺序
   */
  private getCurrentStepOrder(_breakpoint: Breakpoint, _flow: ApprovalFlow): number {
    // Simplified - in production, track current step in breakpoint
    return 1;
  }

  /**
   * 获取断点对应的审批流
   */
  private getFlowForBreakpoint(breakpoint: Breakpoint): ApprovalFlow | undefined {
    // In production, store flowId reference in breakpoint to directly look it up
    // For now, find first matching flow by workflowId or return first available flow as fallback
    for (const flow of this.flows.values()) {
      const trigger = flow.trigger;
      if (trigger.type === 'workflow_node' &&
          trigger.workflowIds?.includes(breakpoint.workflowId)) {
        return flow;
      }
    }
    // Fallback: return first registered flow if no match found
    return this.flows.values().next().value;
  }

  /**
   * 生成记录ID
   */
  private generateRecordId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
