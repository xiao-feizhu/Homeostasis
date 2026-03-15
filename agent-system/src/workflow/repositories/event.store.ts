/**
 * 事件存储适配器
 * 基于事件溯源的工作流持久化
 */

import { WorkflowEvent } from '../entities/workflow-definition.entity';

export interface EventStore {
  append(event: WorkflowEvent): Promise<void>;
  appendMany(events: WorkflowEvent[]): Promise<void>;
  getEvents(executionId: string, fromVersion?: number): Promise<WorkflowEvent[]>;
  getAllEvents(executionId: string): Promise<WorkflowEvent[]>;
  getLatestVersion(executionId: string): Promise<number>;
}

export interface Snapshot {
  version: number;
  state: any;
  timestamp: Date;
}

export interface SnapshotStore {
  save(executionId: string, snapshot: Snapshot): Promise<void>;
  getLatest(executionId: string): Promise<Snapshot | null>;
  getAtVersion(executionId: string, version: number): Promise<Snapshot | null>;
  deleteOlderThan(executionId: string, version: number): Promise<void>;
}

export class InMemoryEventStore implements EventStore {
  private events: Map<string, WorkflowEvent[]> = new Map();

  async append(event: WorkflowEvent): Promise<void> {
    const events = this.events.get(event.executionId) || [];
    events.push(event);
    this.events.set(event.executionId, events);
  }

  async appendMany(events: WorkflowEvent[]): Promise<void> {
    for (const event of events) {
      await this.append(event);
    }
  }

  async getEvents(
    executionId: string,
    fromVersion: number = 0
  ): Promise<WorkflowEvent[]> {
    const events = this.events.get(executionId) || [];
    return events
      .filter(e => e.version > fromVersion)
      .sort((a, b) => a.version - b.version);
  }

  async getAllEvents(executionId: string): Promise<WorkflowEvent[]> {
    const events = this.events.get(executionId) || [];
    return [...events].sort((a, b) => a.version - b.version);
  }

  async getLatestVersion(executionId: string): Promise<number> {
    const events = this.events.get(executionId) || [];
    if (events.length === 0) {
      return 0;
    }
    return Math.max(...events.map(e => e.version));
  }
}

export class InMemorySnapshotStore implements SnapshotStore {
  private snapshots: Map<string, Snapshot[]> = new Map();

  async save(executionId: string, snapshot: Snapshot): Promise<void> {
    const snapshots = this.snapshots.get(executionId) || [];
    snapshots.push(snapshot);
    // Sort by version
    snapshots.sort((a, b) => a.version - b.version);
    this.snapshots.set(executionId, snapshots);
  }

  async getLatest(executionId: string): Promise<Snapshot | null> {
    const snapshots = this.snapshots.get(executionId);
    if (!snapshots || snapshots.length === 0) {
      return null;
    }
    return snapshots[snapshots.length - 1];
  }

  async getAtVersion(
    executionId: string,
    version: number
  ): Promise<Snapshot | null> {
    const snapshots = this.snapshots.get(executionId);
    if (!snapshots) {
      return null;
    }
    // Find the latest snapshot at or before the specified version
    return (
      snapshots.filter(s => s.version <= version).pop() || null
    );
  }

  async deleteOlderThan(executionId: string, version: number): Promise<void> {
    const snapshots = this.snapshots.get(executionId);
    if (!snapshots) {
      return;
    }
    const filtered = snapshots.filter(s => s.version >= version);
    this.snapshots.set(executionId, filtered);
  }
}
