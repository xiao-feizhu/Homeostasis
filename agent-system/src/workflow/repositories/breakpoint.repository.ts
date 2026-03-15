import { Breakpoint, BreakpointStatus } from '../entities/hitl.entity';

export interface BreakpointSaveResult {
  success: boolean;
  error?: string;
}

export interface BreakpointDeleteResult {
  success: boolean;
  error?: string;
}

export interface BreakpointStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  escalated: number;
}

export interface BreakpointRepository {
  save(breakpoint: Breakpoint): Promise<BreakpointSaveResult>;
  findById(breakpointId: string): Promise<Breakpoint | null>;
  findByExecution(executionId: string): Promise<Breakpoint[]>;
  findByStatus(status: BreakpointStatus): Promise<Breakpoint[]>;
  findPendingByWorkflow(workflowId: string): Promise<Breakpoint[]>;
  findByApprover(userId: string): Promise<Breakpoint[]>;
  delete(breakpointId: string): Promise<BreakpointDeleteResult>;
  getStats(workflowId: string): Promise<BreakpointStats>;
  findExpired(): Promise<Breakpoint[]>;
}

export class InMemoryBreakpointRepository implements BreakpointRepository {
  private breakpoints: Map<string, Breakpoint> = new Map();

  async save(breakpoint: Breakpoint): Promise<BreakpointSaveResult> {
    try {
      breakpoint.updatedAt = new Date();
      this.breakpoints.set(breakpoint.breakpointId, { ...breakpoint });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save breakpoint'
      };
    }
  }

  async findById(breakpointId: string): Promise<Breakpoint | null> {
    const breakpoint = this.breakpoints.get(breakpointId);
    return breakpoint ? { ...breakpoint } : null;
  }

  async findByExecution(executionId: string): Promise<Breakpoint[]> {
    const results: Breakpoint[] = [];
    for (const breakpoint of this.breakpoints.values()) {
      if (breakpoint.executionId === executionId) {
        results.push({ ...breakpoint });
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByStatus(status: BreakpointStatus): Promise<Breakpoint[]> {
    const results: Breakpoint[] = [];
    for (const breakpoint of this.breakpoints.values()) {
      if (breakpoint.status === status) {
        results.push({ ...breakpoint });
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findPendingByWorkflow(workflowId: string): Promise<Breakpoint[]> {
    const results: Breakpoint[] = [];
    for (const breakpoint of this.breakpoints.values()) {
      if (breakpoint.workflowId === workflowId && breakpoint.status === BreakpointStatus.PENDING) {
        results.push({ ...breakpoint });
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByApprover(userId: string): Promise<Breakpoint[]> {
    const results: Breakpoint[] = [];
    for (const breakpoint of this.breakpoints.values()) {
      const approvers = breakpoint.config.approvers?.users || [];
      if (approvers.includes(userId)) {
        results.push({ ...breakpoint });
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async delete(breakpointId: string): Promise<BreakpointDeleteResult> {
    if (!this.breakpoints.has(breakpointId)) {
      return { success: false, error: `Breakpoint ${breakpointId} not found` };
    }
    this.breakpoints.delete(breakpointId);
    return { success: true };
  }

  async getStats(workflowId: string): Promise<BreakpointStats> {
    const stats: BreakpointStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      escalated: 0
    };

    for (const breakpoint of this.breakpoints.values()) {
      if (breakpoint.workflowId === workflowId) {
        stats.total++;
        switch (breakpoint.status) {
          case BreakpointStatus.PENDING:
          case BreakpointStatus.IN_REVIEW:
            stats.pending++;
            break;
          case BreakpointStatus.APPROVED:
            stats.approved++;
            break;
          case BreakpointStatus.REJECTED:
            stats.rejected++;
            break;
          case BreakpointStatus.ESCALATED:
            stats.escalated++;
            break;
        }
      }
    }

    return stats;
  }

  async findExpired(): Promise<Breakpoint[]> {
    const now = new Date();
    const results: Breakpoint[] = [];
    for (const breakpoint of this.breakpoints.values()) {
      if (breakpoint.expiresAt && breakpoint.expiresAt <= now) {
        results.push({ ...breakpoint });
      }
    }
    return results.sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime());
  }
}
