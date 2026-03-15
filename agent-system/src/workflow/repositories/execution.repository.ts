import {
  WorkflowExecution,
  ExecutionStatus,
  WorkflowEvent
} from '../entities/workflow-definition.entity';

export interface SaveExecutionResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

export interface SaveEventResult {
  success: boolean;
  eventId?: string;
  version?: number;
  error?: string;
}

export interface ExecutionDeleteResult {
  success: boolean;
  error?: string;
}

export interface FindExecutionsOptions {
  limit?: number;
  offset?: number;
  status?: ExecutionStatus;
}

export interface GetEventsOptions {
  afterVersion?: number;
}

export interface ExecutionStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
}

export interface ExecutionRepository {
  saveExecution(execution: WorkflowExecution): Promise<SaveExecutionResult>;
  findExecutionById(executionId: string): Promise<WorkflowExecution | null>;
  findExecutionsByWorkflow(
    workflowId: string,
    options?: FindExecutionsOptions
  ): Promise<WorkflowExecution[]>;
  findExecutionsByUser(
    userId: string,
    options?: FindExecutionsOptions
  ): Promise<WorkflowExecution[]>;
  saveEvent(event: WorkflowEvent): Promise<SaveEventResult>;
  getEvents(executionId: string, options?: GetEventsOptions): Promise<WorkflowEvent[]>;
  deleteExecution(executionId: string): Promise<ExecutionDeleteResult>;
  getExecutionCount(workflowId: string): Promise<number>;
  getExecutionStats(workflowId: string): Promise<ExecutionStats>;
  findExecutionsByStatus(status: ExecutionStatus): Promise<WorkflowExecution[]>;
}

export class InMemoryExecutionRepository implements ExecutionRepository {
  private executions: Map<string, WorkflowExecution> = new Map();
  private events: Map<string, WorkflowEvent[]> = new Map();
  private versionCounter: Map<string, number> = new Map();

  async saveExecution(execution: WorkflowExecution): Promise<SaveExecutionResult> {
    try {
      execution.updatedAt = new Date();

      if (!execution.createdAt) {
        execution.createdAt = new Date();
      }

      this.executions.set(execution.executionId, { ...execution });

      return { success: true, executionId: execution.executionId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save execution'
      };
    }
  }

  async findExecutionById(executionId: string): Promise<WorkflowExecution | null> {
    const execution = this.executions.get(executionId);
    return execution ? { ...execution } : null;
  }

  async findExecutionsByWorkflow(
    workflowId: string,
    options: FindExecutionsOptions = {}
  ): Promise<WorkflowExecution[]> {
    let results: WorkflowExecution[] = [];

    for (const execution of this.executions.values()) {
      if (execution.workflowId === workflowId) {
        results.push({ ...execution });
      }
    }

    if (options.status) {
      results = results.filter(e => e.status === options.status);
    }

    // Sort by createdAt desc
    results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options.offset || 0;
    const limit = options.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  async findExecutionsByUser(
    userId: string,
    options: FindExecutionsOptions = {}
  ): Promise<WorkflowExecution[]> {
    let results: WorkflowExecution[] = [];

    for (const execution of this.executions.values()) {
      if (execution.userId === userId) {
        results.push({ ...execution });
      }
    }

    if (options.status) {
      results = results.filter(e => e.status === options.status);
    }

    results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options.offset || 0;
    const limit = options.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  async saveEvent(event: WorkflowEvent): Promise<SaveEventResult> {
    try {
      // Auto-increment version if not provided
      if (!event.version) {
        const currentVersion = this.versionCounter.get(event.executionId) || 0;
        event.version = currentVersion + 1;
        this.versionCounter.set(event.executionId, event.version);
      } else {
        this.versionCounter.set(event.executionId, event.version);
      }

      const events = this.events.get(event.executionId) || [];
      events.push({ ...event });
      this.events.set(event.executionId, events);

      return {
        success: true,
        eventId: event.eventId,
        version: event.version
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save event'
      };
    }
  }

  async getEvents(
    executionId: string,
    options: GetEventsOptions = {}
  ): Promise<WorkflowEvent[]> {
    let events = this.events.get(executionId) || [];

    // Return copies to prevent mutation
    events = events.map(e => ({ ...e }));

    // Sort by version
    events = events.sort((a, b) => a.version - b.version);

    if (options.afterVersion) {
      events = events.filter(e => e.version > options.afterVersion!);
    }

    return events;
  }

  async deleteExecution(executionId: string): Promise<ExecutionDeleteResult> {
    if (!this.executions.has(executionId)) {
      return { success: false, error: `Execution ${executionId} not found` };
    }

    this.executions.delete(executionId);
    this.events.delete(executionId);
    this.versionCounter.delete(executionId);

    return { success: true };
  }

  async getExecutionCount(workflowId: string): Promise<number> {
    let count = 0;
    for (const execution of this.executions.values()) {
      if (execution.workflowId === workflowId) {
        count++;
      }
    }
    return count;
  }

  async getExecutionStats(workflowId: string): Promise<ExecutionStats> {
    const stats: ExecutionStats = {
      total: 0,
      completed: 0,
      failed: 0,
      running: 0,
      pending: 0
    };

    for (const execution of this.executions.values()) {
      if (execution.workflowId === workflowId) {
        stats.total++;

        switch (execution.status) {
          case ExecutionStatus.COMPLETED:
            stats.completed++;
            break;
          case ExecutionStatus.FAILED:
            stats.failed++;
            break;
          case ExecutionStatus.RUNNING:
            stats.running++;
            break;
          case ExecutionStatus.PENDING:
            stats.pending++;
            break;
        }
      }
    }

    return stats;
  }

  async findExecutionsByStatus(status: ExecutionStatus): Promise<WorkflowExecution[]> {
    const results: WorkflowExecution[] = [];

    for (const execution of this.executions.values()) {
      if (execution.status === status) {
        results.push({ ...execution });
      }
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
