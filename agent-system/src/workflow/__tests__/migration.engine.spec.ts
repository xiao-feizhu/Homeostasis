/**
 * MigrationEngine 测试
 */

import { MigrationEngine, MigrationStrategy } from '../versioning/migration.engine';
import { VersionManager } from '../versioning/version.manager';
import { VersionComparator } from '../versioning/version.comparator';
import { WorkflowDefinition, WorkflowStatus, NodeType } from '../entities/workflow-definition.entity';

describe('MigrationEngine', () => {
  let migrationEngine: MigrationEngine;
  let versionManager: VersionManager;
  let comparator: VersionComparator;

  const createMockWorkflow = (id: string, version: string, nodes?: any[]): WorkflowDefinition => ({
    workflowId: id,
    name: `Workflow ${id}`,
    version,
    status: WorkflowStatus.ACTIVE,
    ownerId: 'user-001',
    nodes: nodes || [
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
        dependents: ['end']
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
    comparator = new VersionComparator();
    migrationEngine = new MigrationEngine(versionManager, comparator);
  });

  describe('evaluateMigration', () => {
    it('should recommend FORCE_MIGRATE for compatible versions', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-001', '1.1.0', [
        ...workflow1.nodes,
        {
          nodeId: 'new-node',
          name: 'New Node',
          type: NodeType.CODE,
          dependencies: ['process'],
          dependents: ['end']
        }
      ]);

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow1,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow2,
        createdBy: 'user-001',
        version: '1.1.0'
      });

      const evaluation = await migrationEngine.evaluateMigration('wf-001', '1.0.0', '1.1.0');

      expect(evaluation.canMigrate).toBe(true);
      expect(evaluation.isCompatible).toBe(true);
      expect(evaluation.recommendation).toBe(MigrationStrategy.FORCE_MIGRATE);
    });

    it('should recommend MANUAL_APPROVAL for breaking changes', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      // workflow2 removes a node - breaking change
      const workflow2 = createMockWorkflow('wf-001', '2.0.0', [
        workflow1.nodes[0],
        workflow1.nodes[2] // Skip process node
      ]);

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow1,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow2,
        createdBy: 'user-001',
        version: '2.0.0'
      });

      const evaluation = await migrationEngine.evaluateMigration('wf-001', '1.0.0', '2.0.0');

      expect(evaluation.isCompatible).toBe(false);
      expect(evaluation.breakingChanges).toBeGreaterThan(0);
      expect(evaluation.recommendation).toBe(MigrationStrategy.MANUAL_APPROVAL);
    });

    it('should return cannot migrate when version not found', async () => {
      const evaluation = await migrationEngine.evaluateMigration('wf-001', '1.0.0', '2.0.0');

      expect(evaluation.canMigrate).toBe(false);
      expect(evaluation.reason).toContain('not found');
    });
  });

  describe('migrate', () => {
    it('should succeed with CONTINUE_OLD_VERSION strategy', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      const result = await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '1.0.0',
        { strategy: MigrationStrategy.CONTINUE_OLD_VERSION }
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(MigrationStrategy.CONTINUE_OLD_VERSION);
      expect(result.contextPreserved).toBe(true);
    });

    it('should succeed with FORCE_MIGRATE strategy', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-001', '1.1.0');

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow1,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow2,
        createdBy: 'user-001',
        version: '1.1.0'
      });

      const result = await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '1.1.0',
        { strategy: MigrationStrategy.FORCE_MIGRATE }
      );

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(MigrationStrategy.FORCE_MIGRATE);
    });

    it('should fail with MANUAL_APPROVAL strategy', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-001', '2.0.0');

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow1,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow2,
        createdBy: 'user-001',
        version: '2.0.0'
      });

      const result = await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '2.0.0',
        { strategy: MigrationStrategy.MANUAL_APPROVAL }
      );

      expect(result.success).toBe(false);
      expect(result.strategy).toBe(MigrationStrategy.MANUAL_APPROVAL);
      expect(result.error).toContain('manual approval');
    });

    it('should fail when cannot migrate and allowBreakingChanges is false', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-001', '2.0.0', [
        workflow1.nodes[0],
        workflow1.nodes[2]
      ]);

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow1,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow2,
        createdBy: 'user-001',
        version: '2.0.0'
      });

      const result = await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '2.0.0',
        {
          strategy: MigrationStrategy.FORCE_MIGRATE,
          allowBreakingChanges: false
        }
      );

      expect(result.success).toBe(false);
    });

    it('should succeed with allowBreakingChanges=true even with breaking changes', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-001', '2.0.0', [
        workflow1.nodes[0],
        workflow1.nodes[2]
      ]);

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow1,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow2,
        createdBy: 'user-001',
        version: '2.0.0'
      });

      const result = await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '2.0.0',
        {
          strategy: MigrationStrategy.FORCE_MIGRATE,
          allowBreakingChanges: true
        }
      );

      expect(result.success).toBe(true);
    });

    it('should call onMigrationStart callback', async () => {
      const onMigrationStart = jest.fn();

      await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '2.0.0',
        {
          strategy: MigrationStrategy.CONTINUE_OLD_VERSION,
          onMigrationStart
        }
      );

      expect(onMigrationStart).toHaveBeenCalledWith('exec-001', '1.0.0', '2.0.0');
    });

    it('should call onMigrationComplete callback on success', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      const onMigrationComplete = jest.fn();

      await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '1.0.0',
        {
          strategy: MigrationStrategy.CONTINUE_OLD_VERSION,
          onMigrationComplete
        }
      );

      expect(onMigrationComplete).toHaveBeenCalledWith('exec-001', true);
    });

    it('should call onMigrationComplete callback on failure', async () => {
      const onMigrationComplete = jest.fn();

      await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '2.0.0',
        {
          strategy: MigrationStrategy.MANUAL_APPROVAL,
          onMigrationComplete
        }
      );

      expect(onMigrationComplete).toHaveBeenCalledWith('exec-001', false);
    });
  });

  describe('context preservation', () => {
    it('should preserve context when preserveContext is true', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-001', '1.1.0');

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow1,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow2,
        createdBy: 'user-001',
        version: '1.1.0'
      });

      const context = { variables: { count: 5 } };

      const result = await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '1.1.0',
        {
          strategy: MigrationStrategy.FORCE_MIGRATE,
          preserveContext: true
        },
        context
      );

      expect(result.contextPreserved).toBe(true);
    });

    it('should not preserve context when preserveContext is false', async () => {
      const workflow1 = createMockWorkflow('wf-001', '1.0.0');
      const workflow2 = createMockWorkflow('wf-001', '1.1.0');

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow1,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow2,
        createdBy: 'user-001',
        version: '1.1.0'
      });

      const context = { variables: { count: 5 } };

      const result = await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '1.1.0',
        {
          strategy: MigrationStrategy.FORCE_MIGRATE,
          preserveContext: false
        },
        context
      );

      expect(result.contextPreserved).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle unknown strategy', async () => {
      const workflow = createMockWorkflow('wf-001', '1.0.0');
      await versionManager.createVersion({
        workflowId: 'wf-001',
        definition: workflow,
        createdBy: 'user-001',
        version: '1.0.0'
      });

      const result = await migrationEngine.migrate(
        'exec-001',
        'wf-001',
        '1.0.0',
        '1.0.0',
        {
          strategy: 'unknown' as MigrationStrategy
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown migration strategy');
    });
  });
});
