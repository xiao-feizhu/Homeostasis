import {
  InterventionAction,
  InterventionParams,
  InterventionResult,
  HITLAuditLog
} from '../entities/hitl.entity';
import {
  WorkflowExecution,
  ExecutionStatus,
  NodeExecutionStatus
} from '../entities/workflow-definition.entity';

export interface HITLExecutionRepository {
  findById(executionId: string): Promise<WorkflowExecution | null>;
  save(execution: WorkflowExecution): Promise<void>;
}

export interface EventEmitter {
  emit(event: string, data: any): void;
}

export interface HITLAuditLogger {
  log(entry: Partial<HITLAuditLog>): Promise<void>;
}

export class InterventionHandler {
  constructor(
    private executionRepository: HITLExecutionRepository,
    private eventEmitter: EventEmitter,
    private auditLogger: HITLAuditLogger
  ) {}

  /**
   * 处理干预请求
   */
  async handleIntervention(
    executionId: string,
    action: InterventionAction,
    params: InterventionParams,
    operatorId: string
  ): Promise<InterventionResult> {
    // 1. 验证执行状态
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // 2. 验证操作权限
    await this.validatePermission(execution, operatorId, action);

    // 3. 执行干预
    const result = await this.executeIntervention(execution, action, params);

    // 4. 记录审计日志
    await this.auditLogger.log({
      action: action.toString(),
      actionType: 'intervention',
      target: {
        type: 'execution',
        id: executionId,
        executionId,
        workflowId: execution.workflowId
      },
      operator: {
        userId: operatorId,
        userName: '',
        role: ''
      },
      details: {
        reason: params.reason
      },
      result: result.success ? 'success' : 'failure',
      error: result.error
    });

    // 5. 发送事件
    this.eventEmitter.emit('execution.intervention', {
      executionId,
      action,
      operatorId,
      result
    });

    return result;
  }

  /**
   * 执行具体的干预操作
   */
  private async executeIntervention(
    execution: WorkflowExecution,
    action: InterventionAction,
    params: InterventionParams
  ): Promise<InterventionResult> {
    switch (action) {
      case InterventionAction.PAUSE:
        return this.pauseExecution(execution);

      case InterventionAction.RESUME:
        return this.resumeExecution(execution);

      case InterventionAction.SKIP:
        return this.skipNode(execution, params.nodeId, params.fallbackValue);

      case InterventionAction.RETRY:
        return this.retryNode(execution, params.nodeId);

      case InterventionAction.RETRY_WITH_MODIFICATIONS:
        return this.retryWithModifications(
          execution,
          params.nodeId,
          params.modifications
        );

      case InterventionAction.ROLLBACK:
        return this.rollbackExecution(
          execution,
          params.targetNodeId,
          params.preserveContext
        );

      case InterventionAction.FORCE_COMPLETE:
        return this.forceComplete(execution);

      case InterventionAction.FORCE_FAIL:
        return this.forceFail(execution, params.reason);

      default:
        throw new Error(`Unsupported intervention action: ${action}`);
    }
  }

  /**
   * 暂停执行
   */
  private async pauseExecution(
    execution: WorkflowExecution
  ): Promise<InterventionResult> {
    if (execution.status !== ExecutionStatus.RUNNING) {
      return {
        success: false,
        executionId: execution.executionId,
        timestamp: new Date(),
        error: `Cannot pause execution in status: ${execution.status}`
      };
    }

    execution.status = ExecutionStatus.PAUSED;
    execution.updatedAt = new Date();
    await this.executionRepository.save(execution);

    return {
      success: true,
      executionId: execution.executionId,
      timestamp: new Date()
    };
  }

  /**
   * 恢复执行
   */
  private async resumeExecution(
    execution: WorkflowExecution
  ): Promise<InterventionResult> {
    if (execution.status !== ExecutionStatus.PAUSED) {
      return {
        success: false,
        executionId: execution.executionId,
        timestamp: new Date(),
        error: `Cannot resume execution in status: ${execution.status}`
      };
    }

    execution.status = ExecutionStatus.RUNNING;
    execution.updatedAt = new Date();
    await this.executionRepository.save(execution);

    return {
      success: true,
      executionId: execution.executionId,
      timestamp: new Date()
    };
  }

  /**
   * 跳过节点
   */
  private async skipNode(
    execution: WorkflowExecution,
    nodeId?: string,
    fallbackValue?: any
  ): Promise<InterventionResult> {
    const targetNodeId = nodeId || execution.currentNodeId;
    if (!targetNodeId) {
      return {
        success: false,
        executionId: execution.executionId,
        timestamp: new Date(),
        error: 'No current node to skip'
      };
    }

    const nodeExecution = execution.nodeExecutions.find(
      ne => ne.nodeId === targetNodeId
    );

    if (nodeExecution) {
      nodeExecution.status = NodeExecutionStatus.SKIPPED;
      nodeExecution.output = fallbackValue;
      nodeExecution.completedAt = new Date();
    }

    execution.updatedAt = new Date();
    await this.executionRepository.save(execution);

    return {
      success: true,
      executionId: execution.executionId,
      timestamp: new Date()
    };
  }

  /**
   * 重试节点
   */
  private async retryNode(
    execution: WorkflowExecution,
    nodeId?: string
  ): Promise<InterventionResult> {
    const targetNodeId = nodeId || execution.error?.failedNodeId || execution.currentNodeId;
    if (!targetNodeId) {
      return {
        success: false,
        executionId: execution.executionId,
        timestamp: new Date(),
        error: 'No node specified for retry'
      };
    }

    const nodeExecution = execution.nodeExecutions.find(
      ne => ne.nodeId === targetNodeId
    );

    if (nodeExecution) {
      nodeExecution.status = NodeExecutionStatus.PENDING;
      nodeExecution.error = undefined;
      nodeExecution.retryCount += 1;
      nodeExecution.scheduledAt = new Date();
    }

    execution.status = ExecutionStatus.RUNNING;
    execution.error = undefined;
    execution.updatedAt = new Date();
    await this.executionRepository.save(execution);

    return {
      success: true,
      executionId: execution.executionId,
      timestamp: new Date()
    };
  }

  /**
   * 带修改的重试
   */
  private async retryWithModifications(
    execution: WorkflowExecution,
    nodeId?: string,
    modifications?: Record<string, any>
  ): Promise<InterventionResult> {
    if (modifications) {
      execution.context = { ...execution.context, ...modifications };
    }

    return this.retryNode(execution, nodeId);
  }

  /**
   * 回滚执行
   */
  private async rollbackExecution(
    execution: WorkflowExecution,
    targetNodeId?: string,
    preserveContext?: boolean
  ): Promise<InterventionResult> {
    if (!targetNodeId) {
      return {
        success: false,
        executionId: execution.executionId,
        timestamp: new Date(),
        error: 'Target node ID is required for rollback'
      };
    }

    // 验证目标节点
    const targetIndex = execution.executionPath.indexOf(targetNodeId);
    if (targetIndex === -1) {
      throw new Error(`Invalid rollback target: ${targetNodeId}`);
    }

    const currentIndex = execution.executionPath.indexOf(
      execution.currentNodeId || ''
    );

    if (targetIndex > currentIndex) {
      throw new Error(`Invalid rollback target: ${targetNodeId}`);
    }

    // 确定回滚范围（从目标节点到当前节点）
    const nodesToRollback = execution.executionPath.slice(
      targetIndex,
      currentIndex + 1
    ).reverse(); // 反向，从当前节点开始回滚

    // 执行补偿操作（nodesToRollback 已经是反向的）
    for (const nodeId of nodesToRollback) {
      const nodeExecution = execution.nodeExecutions.find(
        ne => ne.nodeId === nodeId
      );

      if (nodeExecution?.output?.compensation) {
        await this.executeCompensation(nodeExecution);
      }

      if (nodeExecution) {
        nodeExecution.status = NodeExecutionStatus.ROLLED_BACK;
        nodeExecution.completedAt = new Date();
      }
    }

    // 恢复上下文到目标节点状态
    if (!preserveContext) {
      const targetNodeExecution = execution.nodeExecutions.find(
        ne => ne.nodeId === targetNodeId
      );
      if (targetNodeExecution?.output) {
        execution.context = { ...targetNodeExecution.output };
      }
    }

    // 更新执行状态
    execution.currentNodeId = targetNodeId;
    execution.status = ExecutionStatus.RUNNING;
    execution.updatedAt = new Date();

    await this.executionRepository.save(execution);

    return {
      success: true,
      executionId: execution.executionId,
      rolledBackNodes: nodesToRollback,
      resumedFrom: targetNodeId,
      timestamp: new Date()
    };
  }

  /**
   * 强制完成执行
   */
  private async forceComplete(
    execution: WorkflowExecution
  ): Promise<InterventionResult> {
    execution.status = ExecutionStatus.COMPLETED;
    execution.timing.completedAt = new Date();
    execution.updatedAt = new Date();

    await this.executionRepository.save(execution);

    return {
      success: true,
      executionId: execution.executionId,
      timestamp: new Date()
    };
  }

  /**
   * 强制失败执行
   */
  private async forceFail(
    execution: WorkflowExecution,
    reason?: string
  ): Promise<InterventionResult> {
    execution.status = ExecutionStatus.FAILED;
    execution.error = {
      code: 'FORCE_FAILED',
      message: reason || 'Manually failed by operator'
    };
    execution.updatedAt = new Date();

    await this.executionRepository.save(execution);

    return {
      success: true,
      executionId: execution.executionId,
      timestamp: new Date()
    };
  }

  /**
   * 执行补偿操作
   */
  private async executeCompensation(nodeExecution: any): Promise<void> {
    const compensation = nodeExecution.output?.compensation;
    if (typeof compensation === 'function') {
      try {
        await compensation();
      } catch (error) {
        console.error(`Compensation failed for node ${nodeExecution.nodeId}:`, error);
      }
    }
  }

  /**
   * 验证操作权限
   */
  private async validatePermission(
    execution: WorkflowExecution,
    operatorId: string,
    _action: InterventionAction
  ): Promise<void> {
    // Basic validation - owner can intervene
    // More sophisticated permission checks can be added here
    if (execution.userId !== operatorId) {
      // TODO: Check role-based permissions
    }
  }
}
