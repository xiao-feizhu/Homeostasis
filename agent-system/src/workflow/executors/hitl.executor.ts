import { NodeExecutor, ValidationResult, createSuccessResult, createErrorResult } from './node.executor';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';
import { NodeExecutionContext } from './node.executor';
import { BreakpointManager } from '../hitl/breakpoint.manager';
import {
  BreakpointType,
  BreakpointStatus,
  BreakpointTriggerMode,
  BreakpointConfig,
  ApprovalMode
} from '../entities/hitl.entity';

/**
 * HITL (Human-in-the-Loop) 节点执行器
 *
 * 支持人工审批、输入收集、审阅等交互式断点
 */
export class HITLNodeExecutor implements NodeExecutor {
  readonly type = NodeType.HITL;

  constructor(private breakpointManager: BreakpointManager) {}

  async execute(node: WorkflowNode, context: NodeExecutionContext) {
    const config = node.config || {};

    // 验证配置
    if (!config.breakpointType) {
      return createErrorResult(
        'CONFIG_ERROR',
        'breakpointType is required'
      );
    }

    // 映射 breakpointType 到 BreakpointType
    const breakpointType = this.mapBreakpointType(config.breakpointType);
    if (!breakpointType) {
      return createErrorResult(
        'CONFIG_ERROR',
        `Invalid breakpoint type: ${config.breakpointType}`
      );
    }

    try {
      // 构建 BreakpointConfig
      const breakpointConfig: BreakpointConfig = {
        enabled: true,
        type: breakpointType,
        mode: BreakpointTriggerMode.STATIC,
        approvers: config.approvers ? {
          users: Array.isArray(config.approvers) ? config.approvers : [config.approvers]
        } : undefined,
        approvalMode: config.approvalMode || ApprovalMode.ANY,
        timeout: {
          duration: config.timeout || 3600,
          reminderIntervals: [],
          autoAction: 'escalate'
        },
        escalation: config.escalation?.enabled ? {
          enabled: true,
          levels: [{
            level: 1,
            condition: 'timeout',
            approvers: config.escalation.to || [],
            notifyChannels: config.notification?.channels || ['email'],
            autoEscalateAfterMinutes: config.escalation.afterMinutes || 30
          }]
        } : undefined,
        contextCapture: config.captureContext !== false ? {
          input: true,
          output: true,
          logs: false,
          executionPath: false
        } : undefined,
        uiConfig: config.inputSchema ? {
          title: config.description || 'Input Required',
          description: config.description || '',
          fields: this.buildUIFields(config.inputSchema, config.requiredFields),
          attachments: false
        } : undefined
      };

      // 准备上下文数据
      const contextData = {
        input: context.input,
        state: context.state,
        nodeId: node.nodeId,
        nodeName: node.name
      };

      // 创建断点
      const breakpoint = this.breakpointManager.createBreakpoint({
        executionId: context.executionId,
        workflowId: context.workflowId,
        nodeId: node.nodeId,
        config: breakpointConfig,
        context: contextData
      });

      // 等待断点解决（轮询）
      const result = await this.waitForBreakpointResolution(
        breakpoint.breakpointId,
        config.timeout || 3600
      );

      // 处理结果
      return this.handleBreakpointResult(result, config);
    } catch (error) {
      return createErrorResult(
        'BREAKPOINT_ERROR',
        `Failed to create or process breakpoint: ${(error as Error).message}`
      );
    }
  }

  validate(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const config = node.config || {};

    if (!config.breakpointType) {
      errors.push('breakpointType is required');
    } else {
      const validTypes = ['approval', 'review', 'input', 'escalation', 'error_resolution'];
      if (!validTypes.includes(config.breakpointType)) {
        errors.push(`Invalid breakpoint type: ${config.breakpointType}. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    // 审批类型需要审批人
    if (config.breakpointType === 'approval' && !config.approvers) {
      errors.push('Approval breakpoints require approvers');
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
   * 映射字符串类型到 BreakpointType 枚举
   */
  private mapBreakpointType(type: string): BreakpointType | undefined {
    const typeMap: Record<string, BreakpointType> = {
      'approval': BreakpointType.APPROVAL,
      'review': BreakpointType.REVIEW,
      'input': BreakpointType.INPUT,
      'escalation': BreakpointType.ESCALATION,
      'error_resolution': BreakpointType.ERROR_RESOLUTION
    };
    return typeMap[type];
  }

  /**
   * 构建 UI 字段配置
   */
  private buildUIFields(
    inputSchema: Record<string, string>,
    requiredFields?: string[]
  ) {
    return Object.entries(inputSchema).map(([name, type]) => ({
      name,
      label: name.charAt(0).toUpperCase() + name.slice(1),
      type: this.mapFieldType(type),
      required: requiredFields?.includes(name) || false,
      editable: true
    }));
  }

  /**
   * 映射字段类型
   */
  private mapFieldType(type: string): 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' {
    const typeMap: Record<string, any> = {
      'string': 'text',
      'boolean': 'checkbox',
      'number': 'number',
      'text': 'textarea',
      'select': 'select'
    };
    return typeMap[type] || 'text';
  }

  /**
   * 等待断点解决
   */
  private async waitForBreakpointResolution(
    breakpointId: string,
    timeoutSeconds: number
  ): Promise<{
    status: BreakpointStatus;
    breakpoint: any;
  }> {
    const startTime = Date.now();
    const maxWaitTime = timeoutSeconds * 1000;
    const pollInterval = 500; // 500ms

    while (Date.now() - startTime < maxWaitTime) {
      const breakpoint = this.breakpointManager.getBreakpoint(breakpointId);

      if (!breakpoint) {
        throw new Error(`Breakpoint not found: ${breakpointId}`);
      }

      // 检查是否已解决
      if (this.isResolvedStatus(breakpoint.status)) {
        return {
          status: breakpoint.status,
          breakpoint
        };
      }

      // 等待后重试
      await this.sleep(pollInterval);
    }

    // 超时
    return {
      status: BreakpointStatus.TIMEOUT,
      breakpoint: this.breakpointManager.getBreakpoint(breakpointId)
    };
  }

  /**
   * 检查状态是否已解决
   */
  private isResolvedStatus(status: BreakpointStatus): boolean {
    const resolvedStatuses = [
      BreakpointStatus.APPROVED,
      BreakpointStatus.REJECTED,
      BreakpointStatus.RESOLVED,
      BreakpointStatus.MODIFIED,
      BreakpointStatus.CANCELLED,
      BreakpointStatus.TIMEOUT,
      BreakpointStatus.EXPIRED,
      BreakpointStatus.ESCALATED
    ];
    return resolvedStatuses.includes(status);
  }

  /**
   * 处理断点结果
   */
  private handleBreakpointResult(
    result: { status: BreakpointStatus; breakpoint: any },
    config: any
  ) {
    const { status, breakpoint } = result;

    switch (status) {
      case BreakpointStatus.APPROVED:
      case BreakpointStatus.RESOLVED:
      case BreakpointStatus.MODIFIED:
        // 成功完成 - 返回用户输入或修改
        const output: Record<string, any> = {};

        if (breakpoint.resolution?.modifications) {
          output.userInput = breakpoint.resolution.modifications;
        } else if (breakpoint.context?.userInput) {
          output.userInput = breakpoint.context.userInput;
        }

        if (breakpoint.approvals?.length > 0) {
          output.approvals = breakpoint.approvals;
        }

        // 验证必填字段
        if (config.requiredFields && output.userInput) {
          const missingFields = config.requiredFields.filter(
            (field: string) => output.userInput[field] === undefined
          );
          if (missingFields.length > 0) {
            return createErrorResult(
              'INVALID_INPUT',
              `Missing required fields: ${missingFields.join(', ')}`
            );
          }
        }

        return createSuccessResult(output);

      case BreakpointStatus.REJECTED:
        return createErrorResult(
          'REJECTED',
          `Breakpoint rejected: ${breakpoint.resolution?.comment || 'No reason provided'}`,
          {
            rejectionReason: breakpoint.resolution?.comment,
            rejectedBy: breakpoint.resolvedBy,
            rejectedAt: breakpoint.resolvedAt
          }
        );

      case BreakpointStatus.TIMEOUT:
      case BreakpointStatus.EXPIRED:
        return createErrorResult(
          'TIMEOUT',
          `Breakpoint timed out after ${config.timeout || 3600} seconds`,
          { status }
        );

      case BreakpointStatus.ESCALATED:
        return createErrorResult(
          'ESCALATED',
          'Breakpoint has been escalated to higher authority',
          { escalationLevel: breakpoint.config.escalation?.levels?.[0]?.level }
        );

      case BreakpointStatus.CANCELLED:
        return createErrorResult(
          'CANCELLED',
          'Breakpoint was cancelled',
          { cancelledBy: breakpoint.resolvedBy }
        );

      default:
        return createErrorResult(
          'UNEXPECTED_STATUS',
          `Unexpected breakpoint status: ${status}`
        );
    }
  }

  /**
   * 延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
