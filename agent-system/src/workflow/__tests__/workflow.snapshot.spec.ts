/**
 * WorkflowSnapshot 测试
 *
 * TDD 开发 - 先写测试再实现
 */

import { WorkflowSnapshot, SnapshotStatus, WorkflowSnapshotData } from '../versioning/workflow.snapshot';
import { VersionManager } from '../versioning/version.manager';
import { WorkflowDefinition, WorkflowStatus, NodeType } from '../entities/workflow-definition.entity';

describe('WorkflowSnapshot', () => {
  let snapshotManager: WorkflowSnapshot;
  let versionManager: VersionManager;

  const createMockWorkflow = (id: string, version: string): WorkflowDefinition => ({
    workflowId: id,
    name: `Workflow ${id}`,
    version,
    status: WorkflowStatus.ACTIVE,
    ownerId: 'user-001',
    nodes: [
      {
        nodeId: 'start',
        name: 'Start',
        type: NodeType.START,
        dependencies: [],
        dependents: ['process']
      },
      {
        nodeId: 'process',
        name: 'Process',
        type: NodeType.CODE,
        dependencies: ['start'],
        dependents: ['end'],
        config: { code: 'return {};' }
      },
      {
        nodeId: 'end',
        name: 'End',
        type: NodeType.END,
        dependencies: ['process'],
        dependents: []
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1
  });

  beforeEach(() => {
    versionManager = new VersionManager();
    snapshotManager = new WorkflowSnapshot(versionManager);
  });

  describe('createSnapshot', () => {
    it('should create a snapshot of workflow definition', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');

      const snapshot = await snapshotManager.createSnapshot(workflow, {
        description: 'Initial snapshot',
        tags: ['release', 'v1']
      });

      expect(snapshot).toBeDefined();
      expect(snapshot.workflowId).toBe('wf-001');
      expect(snapshot.version).toBe('1.0.0');
      expect(snapshot.status).toBe(SnapshotStatus.ACTIVE);
      expect(snapshot.description).toBe('Initial snapshot');
      expect(snapshot.tags).toEqual(['release', 'v1']);
      // Note: definition is deep-cloned, so dates are serialized to strings
      expect(snapshot.definition.workflowId).toEqual(workflow.workflowId);
      expect(snapshot.definition.name).toEqual(workflow.name);
    });

    it('should generate unique snapshot IDs', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');

      const snapshot1 = await snapshotManager.createSnapshot(workflow);
      const snapshot2 = await snapshotManager.createSnapshot(workflow);

      expect(snapshot1.snapshotId).not.toBe(snapshot2.snapshotId);
    });

    it('should include timestamp in snapshot', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      const before = new Date();

      const snapshot = await snapshotManager.createSnapshot(workflow);

      const after = new Date();
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(snapshot.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getSnapshot', () => {
    it('should retrieve snapshot by ID', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      const created = await snapshotManager.createSnapshot(workflow);

      const retrieved = await snapshotManager.getSnapshot(created.snapshotId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.snapshotId).toBe(created.snapshotId);
      expect(retrieved?.workflowId).toBe('wf-001');
    });

    it('should return null for non-existent snapshot', async () => {
      const snapshot = await snapshotManager.getSnapshot('non-existent-id');
      expect(snapshot).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    it('should list all snapshots for a workflow', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-002', '1.0.0');

      await snapshotManager.createSnapshot(workflow1, { tags: ['wf1'] });
      await snapshotManager.createSnapshot(workflow1, { tags: ['wf1'] });
      await snapshotManager.createSnapshot(workflow2, { tags: ['wf2'] });

      const snapshots = await snapshotManager.listSnapshots('wf-001');

      expect(snapshots).toHaveLength(2);
      expect(snapshots.every((s: WorkflowSnapshotData) => s.workflowId === 'wf-001')).toBe(true);
    });

    it('should filter snapshots by status', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');

      await snapshotManager.createSnapshot(workflow);
      const archived = await snapshotManager.createSnapshot(workflow);
      await snapshotManager.archiveSnapshot(archived.snapshotId);

      const activeSnapshots = await snapshotManager.listSnapshots('wf-001', {
        status: SnapshotStatus.ACTIVE
      });

      expect(activeSnapshots).toHaveLength(1);
      expect(activeSnapshots[0].status).toBe(SnapshotStatus.ACTIVE);
    });

    it('should filter snapshots by tags', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');

      await snapshotManager.createSnapshot(workflow, { tags: ['release', 'v1'] });
      await snapshotManager.createSnapshot(workflow, { tags: ['release', 'v2'] });
      await snapshotManager.createSnapshot(workflow, { tags: ['draft'] });

      const releaseSnapshots = await snapshotManager.listSnapshots('wf-001', {
        tags: ['release']
      });

      expect(releaseSnapshots).toHaveLength(2);
    });

    it('should support pagination', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');

      for (let i = 0; i < 5; i++) {
        await snapshotManager.createSnapshot(workflow);
      }

      const page1 = await snapshotManager.listSnapshots('wf-001', { limit: 2, offset: 0 });
      const page2 = await snapshotManager.listSnapshots('wf-001', { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].snapshotId).not.toBe(page2[0].snapshotId);
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore workflow from snapshot', async () => {
      const original = createMockWorkflow('wf-001', '1.0.0');
      original.nodes[0].name = 'Original Name';

      const snapshot = await snapshotManager.createSnapshot(original);

      // Modify the "current" workflow
      const modified = createMockWorkflow('wf-001', '1.0.0');
      modified.nodes[0].name = 'Modified Name';

      const restored = await snapshotManager.restoreSnapshot(snapshot.snapshotId);

      expect(restored).toBeDefined();
      expect(restored?.nodes[0].name).toBe('Original Name');
    });

    it('should return null for non-existent snapshot', async () => {
      const restored = await snapshotManager.restoreSnapshot('non-existent-id');
      expect(restored).toBeNull();
    });

    it('should not restore archived snapshot by default', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      const snapshot = await snapshotManager.createSnapshot(workflow);
      await snapshotManager.archiveSnapshot(snapshot.snapshotId);

      const restored = await snapshotManager.restoreSnapshot(snapshot.snapshotId);
      expect(restored).toBeNull();
    });

    it('should restore archived snapshot when includeArchived is true', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      const snapshot = await snapshotManager.createSnapshot(workflow);
      await snapshotManager.archiveSnapshot(snapshot.snapshotId);

      const restored = await snapshotManager.restoreSnapshot(snapshot.snapshotId, {
        includeArchived: true
      });
      expect(restored).toBeDefined();
    });
  });

  describe('compareSnapshots', () => {
    it('should compare two snapshots and return differences', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-001', '1.1.0');
      workflow2.nodes.push({
        nodeId: 'new-node',
        name: 'New Node',
        type: NodeType.CODE,
        dependencies: ['process'],
        dependents: ['end']
      });

      const snapshot1 = await snapshotManager.createSnapshot(workflow1);
      const snapshot2 = await snapshotManager.createSnapshot(workflow2);

      const diff = await snapshotManager.compareSnapshots(
        snapshot1.snapshotId,
        snapshot2.snapshotId
      );

      expect(diff).toBeDefined();
      expect(diff!.addedNodes).toHaveLength(1);
      expect(diff!.addedNodes[0].nodeId).toBe('new-node');
    });

    it('should return null if either snapshot does not exist', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      const snapshot = await snapshotManager.createSnapshot(workflow);

      const diff = await snapshotManager.compareSnapshots(
        snapshot.snapshotId,
        'non-existent-id'
      );

      expect(diff).toBeNull();
    });
  });

  describe('archiveSnapshot', () => {
    it('should archive a snapshot', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      const snapshot = await snapshotManager.createSnapshot(workflow);

      const result = await snapshotManager.archiveSnapshot(snapshot.snapshotId);

      expect(result).toBe(true);

      const retrieved = await snapshotManager.getSnapshot(snapshot.snapshotId);
      expect(retrieved?.status).toBe(SnapshotStatus.ARCHIVED);
    });

    it('should return false for non-existent snapshot', async () => {
      const result = await snapshotManager.archiveSnapshot('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete a snapshot', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      const snapshot = await snapshotManager.createSnapshot(workflow);

      const result = await snapshotManager.deleteSnapshot(snapshot.snapshotId);

      expect(result).toBe(true);

      const retrieved = await snapshotManager.getSnapshot(snapshot.snapshotId);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent snapshot', async () => {
      const result = await snapshotManager.deleteSnapshot('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove old snapshots based on retention policy', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');

      // Create some snapshots
      await snapshotManager.createSnapshot(workflow, { tags: ['old'] });
      await snapshotManager.createSnapshot(workflow, { tags: ['new'] });

      // Cleanup with 0 days retention (remove all)
      const removed = await snapshotManager.cleanup({ retentionDays: 0 });

      expect(removed).toBeGreaterThan(0);

      const remaining = await snapshotManager.listSnapshots('wf-001');
      expect(remaining).toHaveLength(0);
    });

    it('should keep snapshots with keep=true', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');

      const keepSnapshot = await snapshotManager.createSnapshot(workflow, {
        tags: ['important'],
        keep: true
      });
      await snapshotManager.createSnapshot(workflow, { tags: ['temp'] });

      // Cleanup with 0 days retention
      await snapshotManager.cleanup({ retentionDays: 0 });

      const remaining = await snapshotManager.listSnapshots('wf-001');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].snapshotId).toBe(keepSnapshot.snapshotId);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return the most recent snapshot', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');

      await snapshotManager.createSnapshot(workflow, { tags: ['first'] });
      await new Promise(resolve => setTimeout(resolve, 10));
      const latest = await snapshotManager.createSnapshot(workflow, { tags: ['latest'] });

      const retrieved = await snapshotManager.getLatestSnapshot('wf-001');

      expect(retrieved?.snapshotId).toBe(latest.snapshotId);
      expect(retrieved?.tags).toEqual(['latest']);
    });

    it('should return null if no snapshots exist', async () => {
      const snapshot = await snapshotManager.getLatestSnapshot('non-existent-wf');
      expect(snapshot).toBeNull();
    });
  });
});
