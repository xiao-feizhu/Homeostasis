/**
 * WorkflowSnapshot 工作流快照系统
 *
 * 管理工作流定义的版本化快照
 */

import { VersionManager } from './version.manager';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { VersionComparator, ChangeType } from './version.comparator';

/**
 * 快照状态
 */
export enum SnapshotStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

/**
 * 工作流快照
 */
export interface WorkflowSnapshotData {
  snapshotId: string;
  workflowId: string;
  version: string;
  definition: WorkflowDefinition;
  createdAt: Date;
  status: SnapshotStatus;
  description?: string;
  tags?: string[];
  keep?: boolean;
}

/**
 * 创建快照选项
 */
export interface CreateSnapshotOptions {
  description?: string;
  tags?: string[];
  keep?: boolean;
}

/**
 * 列表查询选项
 */
export interface ListSnapshotsOptions {
  status?: SnapshotStatus;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * 恢复快照选项
 */
export interface RestoreSnapshotOptions {
  includeArchived?: boolean;
}

/**
 * 清理选项
 */
export interface CleanupOptions {
  retentionDays: number;
}

/**
 * 快照差异
 */
export interface SnapshotDiff {
  addedNodes: Array<{ nodeId: string; type: string }>;
  removedNodes: Array<{ nodeId: string; type: string }>;
  modifiedNodes: Array<{ nodeId: string; changes: string[] }>;
}

/**
 * 工作流快照管理器
 */
export class WorkflowSnapshot {
  private snapshots: Map<string, WorkflowSnapshotData> = new Map();

  constructor(_versionManager: VersionManager) {
    // VersionManager reserved for future use (e.g., validating versions before snapshot)
  }

  /**
   * 创建工作流快照
   */
  async createSnapshot(
    workflow: WorkflowDefinition,
    options: CreateSnapshotOptions = {}
  ): Promise<WorkflowSnapshotData> {
    const snapshotId = this.generateSnapshotId();

    const snapshot: WorkflowSnapshotData = {
      snapshotId,
      workflowId: workflow.workflowId,
      version: workflow.version,
      definition: JSON.parse(JSON.stringify(workflow)), // 深拷贝
      createdAt: new Date(),
      status: SnapshotStatus.ACTIVE,
      description: options.description,
      tags: options.tags,
      keep: options.keep,
    };

    this.snapshots.set(snapshotId, snapshot);

    return snapshot;
  }

  /**
   * 获取快照
   */
  async getSnapshot(snapshotId: string): Promise<WorkflowSnapshotData | null> {
    const snapshot = this.snapshots.get(snapshotId);
    return snapshot ? { ...snapshot } : null;
  }

  /**
   * 列出工作流的快照
   */
  async listSnapshots(
    workflowId: string,
    options: ListSnapshotsOptions = {}
  ): Promise<WorkflowSnapshotData[]> {
    let results = Array.from(this.snapshots.values()).filter(
      (s) => s.workflowId === workflowId
    );

    // 按状态过滤
    if (options.status) {
      results = results.filter((s) => s.status === options.status);
    }

    // 按标签过滤
    if (options.tags && options.tags.length > 0) {
      results = results.filter((s) =>
        options.tags!.some((tag) => s.tags?.includes(tag))
      );
    }

    // 按时间排序（最新的在前）
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 分页
    const offset = options.offset ?? 0;
    const limit = options.limit ?? results.length;

    return results.slice(offset, offset + limit).map((s) => ({ ...s }));
  }

  /**
   * 从快照恢复工作流
   */
  async restoreSnapshot(
    snapshotId: string,
    options: RestoreSnapshotOptions = {}
  ): Promise<WorkflowDefinition | null> {
    const snapshot = this.snapshots.get(snapshotId);

    if (!snapshot) {
      return null;
    }

    // 检查快照状态
    if (snapshot.status === SnapshotStatus.ARCHIVED && !options.includeArchived) {
      return null;
    }

    // 返回深拷贝
    return JSON.parse(JSON.stringify(snapshot.definition));
  }

  /**
   * 比较两个快照
   */
  async compareSnapshots(
    snapshotId1: string,
    snapshotId2: string
  ): Promise<SnapshotDiff | null> {
    const snapshot1 = this.snapshots.get(snapshotId1);
    const snapshot2 = this.snapshots.get(snapshotId2);

    if (!snapshot1 || !snapshot2) {
      return null;
    }

    const comparator = new VersionComparator();
    const workflowDiff = comparator.compare(
      snapshot1.definition.nodes || [],
      snapshot2.definition.nodes || []
    );

    // Convert WorkflowDiff to SnapshotDiff format
    return {
      addedNodes: workflowDiff.changes
        .filter(c => c.type === ChangeType.ADDED)
        .map(c => ({ nodeId: c.nodeId, type: c.nodeName || 'unknown' })),
      removedNodes: workflowDiff.changes
        .filter(c => c.type === ChangeType.REMOVED)
        .map(c => ({ nodeId: c.nodeId, type: c.nodeName || 'unknown' })),
      modifiedNodes: workflowDiff.changes
        .filter(c => c.type === ChangeType.MODIFIED)
        .map(c => ({ nodeId: c.nodeId, changes: c.details ? c.details.split(', ') : [] }))
    };
  }

  /**
   * 归档快照
   */
  async archiveSnapshot(snapshotId: string): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId);

    if (!snapshot) {
      return false;
    }

    snapshot.status = SnapshotStatus.ARCHIVED;
    return true;
  }

  /**
   * 删除快照
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    return this.snapshots.delete(snapshotId);
  }

  /**
   * 清理旧快照
   */
  async cleanup(options: CleanupOptions): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.retentionDays);

    let removedCount = 0;

    for (const [id, snapshot] of this.snapshots) {
      // 跳过标记为保留的快照
      if (snapshot.keep) {
        continue;
      }

      // 删除过期快照 (使用 <= 允许 retentionDays=0 删除当天创建的快照)
      if (snapshot.createdAt <= cutoff) {
        this.snapshots.delete(id);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * 获取最新快照
   */
  async getLatestSnapshot(workflowId: string): Promise<WorkflowSnapshotData | null> {
    const snapshots = await this.listSnapshots(workflowId);
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
   * 生成快照 ID
   */
  private generateSnapshotId(): string {
    return `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
