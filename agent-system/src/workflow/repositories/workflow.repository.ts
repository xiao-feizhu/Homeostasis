import { WorkflowDefinition, WorkflowStatus } from '../entities/workflow-definition.entity';

export interface WorkflowSaveResult {
  success: boolean;
  workflowId?: string;
  error?: string;
}

export interface WorkflowDeleteResult {
  success: boolean;
  error?: string;
}

export interface FindAllOptions {
  ownerId?: string;
  status?: WorkflowStatus;
  limit?: number;
  offset?: number;
}

export interface WorkflowRepository {
  save(workflow: WorkflowDefinition): Promise<WorkflowSaveResult>;
  findById(workflowId: string): Promise<WorkflowDefinition | null>;
  findByVersion(workflowId: string, version: string): Promise<WorkflowDefinition | null>;
  findAll(options?: FindAllOptions): Promise<WorkflowDefinition[]>;
  delete(workflowId: string): Promise<WorkflowDeleteResult>;
  exists(workflowId: string): Promise<boolean>;
  findByTags(tags: string[]): Promise<WorkflowDefinition[]>;
  getVersions(workflowId: string): Promise<string[]>;
  softDelete(workflowId: string): Promise<WorkflowDeleteResult>;
}

export class InMemoryWorkflowRepository implements WorkflowRepository {
  private workflows: Map<string, WorkflowDefinition[]> = new Map();

  async save(workflow: WorkflowDefinition): Promise<WorkflowSaveResult> {
    try {
      const now = new Date();

      // Auto-set createdAt if not provided
      if (!workflow.createdAt) {
        workflow.createdAt = now;
      }

      // Always update updatedAt
      workflow.updatedAt = now;

      const versions = this.workflows.get(workflow.workflowId) || [];
      const existingIndex = versions.findIndex(v => v.version === workflow.version);

      if (existingIndex >= 0) {
        versions[existingIndex] = workflow;
      } else {
        versions.push(workflow);
      }

      this.workflows.set(workflow.workflowId, versions);

      return { success: true, workflowId: workflow.workflowId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save workflow'
      };
    }
  }

  async findById(workflowId: string): Promise<WorkflowDefinition | null> {
    const versions = this.workflows.get(workflowId);
    if (!versions || versions.length === 0) {
      return null;
    }

    // Return the latest version (highest semver)
    return versions.sort((a, b) => this.compareVersions(b.version, a.version))[0];
  }

  async findByVersion(workflowId: string, version: string): Promise<WorkflowDefinition | null> {
    const versions = this.workflows.get(workflowId);
    if (!versions) {
      return null;
    }

    return versions.find(v => v.version === version) || null;
  }

  async findAll(options: FindAllOptions = {}): Promise<WorkflowDefinition[]> {
    const allWorkflows: WorkflowDefinition[] = [];

    for (const versions of this.workflows.values()) {
      const latest = versions.sort((a, b) => this.compareVersions(b.version, a.version))[0];
      allWorkflows.push(latest);
    }

    let filtered = allWorkflows;

    if (options.ownerId) {
      filtered = filtered.filter(w => w.ownerId === options.ownerId);
    }

    if (options.status) {
      filtered = filtered.filter(w => w.status === options.status);
    }

    // Sort by updatedAt desc
    filtered = filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || filtered.length;

    return filtered.slice(offset, offset + limit);
  }

  async delete(workflowId: string): Promise<WorkflowDeleteResult> {
    if (!this.workflows.has(workflowId)) {
      return { success: false, error: `Workflow ${workflowId} not found` };
    }

    this.workflows.delete(workflowId);
    return { success: true };
  }

  async exists(workflowId: string): Promise<boolean> {
    const versions = this.workflows.get(workflowId);
    return versions !== undefined && versions.length > 0;
  }

  async findByTags(tags: string[]): Promise<WorkflowDefinition[]> {
    const allWorkflows: WorkflowDefinition[] = [];

    for (const versions of this.workflows.values()) {
      const latest = versions.sort((a, b) => this.compareVersions(b.version, a.version))[0];
      allWorkflows.push(latest);
    }

    return allWorkflows.filter(w => {
      if (!w.tags) return false;
      return tags.some(tag => w.tags!.includes(tag));
    });
  }

  async getVersions(workflowId: string): Promise<string[]> {
    const versions = this.workflows.get(workflowId);
    if (!versions) {
      return [];
    }

    return versions.map(v => v.version).sort((a, b) => this.compareVersions(b, a));
  }

  async softDelete(workflowId: string): Promise<WorkflowDeleteResult> {
    const workflow = await this.findById(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow ${workflowId} not found` };
    }

    workflow.status = WorkflowStatus.ARCHIVED;
    workflow.updatedAt = new Date();

    return this.save(workflow);
  }

  /**
   * Compare semantic versions
   * Returns positive if v1 > v2, negative if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }
}
