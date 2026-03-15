import {
  WorkflowExecution,
  ExecutionStatus,
  NodeExecution,
  NodeExecutionStatus,
  WorkflowEvent,
  WorkflowEventType
} from '../entities/workflow-definition.entity';

export interface StateSnapshot {
  version: number;
  state: WorkflowExecution;
  createdAt: Date;
}

/**
 * 状态管理器
 * 基于事件溯源的工作流状态管理
 */
export class StateManager {
  private events: Map<string, WorkflowEvent[]> = new Map();
  private snapshots: Map<string, StateSnapshot[]> = new Map();
  private currentVersion: Map<string, number> = new Map();

  /**
   * 创建新的执行实例
   */
  createExecution(
    executionId: string,
    workflowId: string,
    userId: string,
    input?: Record<string, any>
  ): WorkflowExecution {
    const execution: WorkflowExecution = {
      executionId,
      workflowId,
      userId,
      status: ExecutionStatus.PENDING,
      context: {},
      nodeExecutions: [],
      executionPath: [],
      input,
      timing: {
        scheduledAt: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 初始化版本为0，第一个applyEvent将使用版本1
    this.currentVersion.set(executionId, 0);

    return execution;
  }

  /**
   * 应用事件到执行实例
   */
  applyEvent(
    execution: WorkflowExecution,
    event: WorkflowEvent
  ): WorkflowExecution {
    // 验证事件版本
    const currentVersion = this.currentVersion.get(execution.executionId) || 0;
    if (event.version !== currentVersion + 1) {
      throw new Error(
        `Version mismatch: expected ${currentVersion + 1}, got ${event.version}`
      );
    }

    // 记录事件
    this.appendEvent(execution.executionId, event);

    // 更新版本
    this.currentVersion.set(execution.executionId, event.version);

    return this._applyEventInternal(execution, event);
  }

  /**
   * 内部方法：应用事件（不检查版本）
   * 用于 reconstructState
   */
  private _applyEventInternal(
    execution: WorkflowExecution,
    event: WorkflowEvent
  ): WorkflowExecution {
    const updatedExecution = { ...execution };

    switch (event.eventType) {
      case WorkflowEventType.EXECUTION_SCHEDULED:
        updatedExecution.status = ExecutionStatus.SCHEDULED;
        updatedExecution.timing.scheduledAt = event.timestamp;
        break;

      case WorkflowEventType.EXECUTION_STARTED:
        updatedExecution.status = ExecutionStatus.RUNNING;
        updatedExecution.timing.startedAt = event.timestamp;
        break;

      case WorkflowEventType.NODE_SCHEDULED:
        this.applyNodeScheduled(updatedExecution, event);
        break;

      case WorkflowEventType.NODE_STARTED:
        this.applyNodeStarted(updatedExecution, event);
        break;

      case WorkflowEventType.NODE_COMPLETED:
        this.applyNodeCompleted(updatedExecution, event);
        break;

      case WorkflowEventType.NODE_FAILED:
        this.applyNodeFailed(updatedExecution, event);
        break;

      case WorkflowEventType.NODE_SKIPPED:
        this.applyNodeSkipped(updatedExecution, event);
        break;

      case WorkflowEventType.EXECUTION_COMPLETED:
        updatedExecution.status = ExecutionStatus.COMPLETED;
        updatedExecution.timing.completedAt = event.timestamp;
        updatedExecution.output = event.payload.output;
        break;

      case WorkflowEventType.EXECUTION_FAILED:
        updatedExecution.status = ExecutionStatus.FAILED;
        updatedExecution.timing.completedAt = event.timestamp;
        updatedExecution.error = event.payload.error;
        break;

      case WorkflowEventType.CONTEXT_UPDATED:
        updatedExecution.context = {
          ...updatedExecution.context,
          ...event.payload.context
        };
        break;
    }

    updatedExecution.updatedAt = event.timestamp;
    this.currentVersion.set(execution.executionId, event.version);

    return updatedExecution;
  }

  /**
   * 通过重放事件重建执行状态
   */
  reconstructState(executionId: string): WorkflowExecution | null {
    const events = this.events.get(executionId);
    if (!events || events.length === 0) {
      return null;
    }

    // 按版本排序
    const sortedEvents = [...events].sort((a, b) => a.version - b.version);

    // 获取初始状态
    const firstEvent = sortedEvents[0];
    let execution: WorkflowExecution = {
      executionId: firstEvent.executionId,
      workflowId: firstEvent.workflowId,
      userId: firstEvent.metadata.userId || '',
      status: ExecutionStatus.PENDING,
      context: {},
      nodeExecutions: [],
      executionPath: [],
      timing: {},
      createdAt: firstEvent.timestamp,
      updatedAt: firstEvent.timestamp
    };

    // 重放所有事件（不检查版本）
    for (const event of sortedEvents) {
      execution = this._applyEventInternal(execution, event);
    }

    return execution;
  }

  /**
   * 创建状态快照
   */
  createSnapshot(executionId: string): StateSnapshot {
    const execution = this.reconstructState(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const version = this.currentVersion.get(executionId) || 0;
    const snapshot: StateSnapshot = {
      version,
      state: execution,
      createdAt: new Date()
    };

    const snapshots = this.snapshots.get(executionId) || [];
    snapshots.push(snapshot);
    this.snapshots.set(executionId, snapshots);

    return snapshot;
  }

  /**
   * 从快照恢复状态
   */
  restoreFromSnapshot(
    executionId: string,
    targetVersion?: number
  ): WorkflowExecution | null {
    const snapshots = this.snapshots.get(executionId);
    if (!snapshots || snapshots.length === 0) {
      return null;
    }

    // 找到目标版本的快照
    let snapshot: StateSnapshot | undefined;
    if (targetVersion) {
      snapshot = snapshots.find(s => s.version <= targetVersion);
    } else {
      snapshot = snapshots[snapshots.length - 1];
    }

    if (!snapshot) {
      return null;
    }

    // 如果有更新的版本，重放后续事件（不检查版本）
    const events = this.events.get(executionId) || [];
    const subsequentEvents = events.filter(e => e.version > snapshot!.version);

    let execution = snapshot.state;
    for (const event of subsequentEvents.sort((a, b) => a.version - b.version)) {
      execution = this._applyEventInternal(execution, event);
    }

    return execution;
  }

  /**
   * 获取节点执行状态
   */
  getNodeExecution(
    execution: WorkflowExecution,
    nodeId: string
  ): NodeExecution | undefined {
    return execution.nodeExecutions.find(ne => ne.nodeId === nodeId);
  }

  /**
   * 更新节点状态
   */
  updateNodeStatus(
    executionId: string,
    nodeId: string,
    status: NodeExecutionStatus,
    metadata?: {
      output?: any;
      error?: any;
      input?: any;
    }
  ): WorkflowEvent {
    const version = (this.currentVersion.get(executionId) || 0) + 1;

    let eventType: WorkflowEventType;
    switch (status) {
      case NodeExecutionStatus.SCHEDULED:
        eventType = WorkflowEventType.NODE_SCHEDULED;
        break;
      case NodeExecutionStatus.RUNNING:
        eventType = WorkflowEventType.NODE_STARTED;
        break;
      case NodeExecutionStatus.COMPLETED:
        eventType = WorkflowEventType.NODE_COMPLETED;
        break;
      case NodeExecutionStatus.FAILED:
        eventType = WorkflowEventType.NODE_FAILED;
        break;
      case NodeExecutionStatus.SKIPPED:
        eventType = WorkflowEventType.NODE_SKIPPED;
        break;
      default:
        throw new Error(`Unsupported status transition: ${status}`);
    }

    const event: WorkflowEvent = {
      eventId: this.generateEventId(),
      eventType,
      executionId,
      workflowId: '', // 会在 apply 时填充
      timestamp: new Date(),
      version,
      payload: {
        nodeId,
        ...metadata
      },
      metadata: {
        correlationId: executionId
      }
    };

    this.appendEvent(executionId, event);
    return event;
  }

  /**
   * 追加事件到事件流
   */
  private appendEvent(executionId: string, event: WorkflowEvent): void {
    const events = this.events.get(executionId) || [];
    events.push(event);
    this.events.set(executionId, events);
  }

  /**
   * 应用节点计划事件
   */
  private applyNodeScheduled(execution: WorkflowExecution, event: WorkflowEvent): void {
    const nodeId = event.payload.nodeId;
    if (!nodeId) return;

    const existingExecution = execution.nodeExecutions.find(ne => ne.nodeId === nodeId);

    if (!existingExecution) {
      execution.nodeExecutions.push({
        nodeId,
        nodeName: nodeId,
        status: NodeExecutionStatus.SCHEDULED,
        scheduledAt: event.timestamp,
        retryCount: 0
      });
    }
  }

  /**
   * 应用节点开始事件
   */
  private applyNodeStarted(execution: WorkflowExecution, event: WorkflowEvent): void {
    const { nodeId, input } = event.payload;
    const nodeExecution = execution.nodeExecutions.find(ne => ne.nodeId === nodeId);

    if (nodeExecution) {
      nodeExecution.status = NodeExecutionStatus.RUNNING;
      nodeExecution.startedAt = event.timestamp;
      nodeExecution.input = input;
    }

    execution.currentNodeId = nodeId;
  }

  /**
   * 应用节点完成事件
   */
  private applyNodeCompleted(execution: WorkflowExecution, event: WorkflowEvent): void {
    const { nodeId, output } = event.payload;
    if (!nodeId) return;

    const nodeExecution = execution.nodeExecutions.find(ne => ne.nodeId === nodeId);

    if (nodeExecution) {
      nodeExecution.status = NodeExecutionStatus.COMPLETED;
      nodeExecution.completedAt = event.timestamp;
      nodeExecution.output = output;
    }

    execution.executionPath.push(nodeId);
  }

  /**
   * 应用节点失败事件
   */
  private applyNodeFailed(execution: WorkflowExecution, event: WorkflowEvent): void {
    const { nodeId, error } = event.payload;
    const nodeExecution = execution.nodeExecutions.find(ne => ne.nodeId === nodeId);

    if (nodeExecution) {
      nodeExecution.status = NodeExecutionStatus.FAILED;
      nodeExecution.completedAt = event.timestamp;
      nodeExecution.error = error;
    }

    execution.status = ExecutionStatus.FAILED;
    execution.error = {
      code: 'NODE_EXECUTION_FAILED',
      message: error?.message || 'Node execution failed',
      failedNodeId: nodeId
    };
  }

  /**
   * 应用节点跳过事件
   */
  private applyNodeSkipped(execution: WorkflowExecution, event: WorkflowEvent): void {
    const { nodeId } = event.payload;
    const nodeExecution = execution.nodeExecutions.find(ne => ne.nodeId === nodeId);

    if (nodeExecution) {
      nodeExecution.status = NodeExecutionStatus.SKIPPED;
      nodeExecution.completedAt = event.timestamp;
    }
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
