import { WorkflowRepository, InMemoryWorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowDefinition, WorkflowStatus, NodeType } from '../entities/workflow-definition.entity';

describe('WorkflowRepository', () => {
  let repository: WorkflowRepository;

  beforeEach(() => {
    repository = new InMemoryWorkflowRepository();
  });

  const createMockWorkflow = (overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
    workflowId: 'wf-001',
    name: 'Test Workflow',
    version: '1.0.0',
    ownerId: 'user-001',
    nodes: [
      {
        nodeId: 'start',
        type: NodeType.START,
        name: 'Start',
        dependencies: [],
        dependents: ['end']
      },
      {
        nodeId: 'end',
        type: NodeType.END,
        name: 'End',
        dependencies: ['start'],
        dependents: []
      }
    ],
    status: WorkflowStatus.DRAFT,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    schemaVersion: 1,
    ...overrides
  });

  describe('save', () => {
    it('should save a new workflow', async () => {
      const workflow = createMockWorkflow();
      const result = await repository.save(workflow);

      expect(result.success).toBe(true);
      expect(result.workflowId).toBe('wf-001');
    });

    it('should update existing workflow', async () => {
      const workflow = createMockWorkflow();
      await repository.save(workflow);

      const updated = { ...workflow, name: 'Updated Name' };
      const result = await repository.save(updated);

      expect(result.success).toBe(true);
      const retrieved = await repository.findById('wf-001');
      expect(retrieved?.name).toBe('Updated Name');
    });

    it('should auto-set createdAt for new workflow', async () => {
      const workflow = createMockWorkflow({ createdAt: undefined as any });
      await repository.save(workflow);

      const retrieved = await repository.findById('wf-001');
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on save', async () => {
      const workflow = createMockWorkflow();
      await repository.save(workflow);

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = { ...workflow, name: 'New Name' };
      await repository.save(updated);

      const retrieved = await repository.findById('wf-001');
      expect(retrieved?.updatedAt.getTime()).toBeGreaterThan(workflow.updatedAt.getTime());
    });
  });

  describe('findById', () => {
    it('should find workflow by id', async () => {
      const workflow = createMockWorkflow();
      await repository.save(workflow);

      const found = await repository.findById('wf-001');
      expect(found).not.toBeNull();
      expect(found?.workflowId).toBe('wf-001');
    });

    it('should return null for non-existent workflow', async () => {
      const found = await repository.findById('wf-999');
      expect(found).toBeNull();
    });
  });

  describe('findByVersion', () => {
    it('should find specific version of workflow', async () => {
      const v1 = createMockWorkflow({ version: '1.0.0' });
      const v2 = createMockWorkflow({ version: '2.0.0', name: 'Version 2' });
      await repository.save(v1);
      await repository.save(v2);

      const found = await repository.findByVersion('wf-001', '2.0.0');
      expect(found?.version).toBe('2.0.0');
      expect(found?.name).toBe('Version 2');
    });
  });

  describe('findAll', () => {
    it('should return all workflows', async () => {
      await repository.save(createMockWorkflow({ workflowId: 'wf-001' }));
      await repository.save(createMockWorkflow({ workflowId: 'wf-002' }));

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
    });

    it('should support pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        await repository.save(createMockWorkflow({ workflowId: `wf-00${i}` }));
      }

      const page1 = await repository.findAll({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = await repository.findAll({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
    });

    it('should filter by owner', async () => {
      await repository.save(createMockWorkflow({ workflowId: 'wf-001', ownerId: 'user-001' }));
      await repository.save(createMockWorkflow({ workflowId: 'wf-002', ownerId: 'user-002' }));

      const user1Workflows = await repository.findAll({ ownerId: 'user-001' });
      expect(user1Workflows).toHaveLength(1);
      expect(user1Workflows[0].workflowId).toBe('wf-001');
    });

    it('should filter by status', async () => {
      await repository.save(createMockWorkflow({ workflowId: 'wf-001', status: WorkflowStatus.ACTIVE }));
      await repository.save(createMockWorkflow({ workflowId: 'wf-002', status: WorkflowStatus.DRAFT }));

      const activeWorkflows = await repository.findAll({ status: WorkflowStatus.ACTIVE });
      expect(activeWorkflows).toHaveLength(1);
      expect(activeWorkflows[0].workflowId).toBe('wf-001');
    });
  });

  describe('delete', () => {
    it('should delete workflow', async () => {
      const workflow = createMockWorkflow();
      await repository.save(workflow);

      const result = await repository.delete('wf-001');
      expect(result.success).toBe(true);

      const found = await repository.findById('wf-001');
      expect(found).toBeNull();
    });

    it('should return error for non-existent workflow', async () => {
      const result = await repository.delete('wf-999');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('exists', () => {
    it('should return true for existing workflow', async () => {
      await repository.save(createMockWorkflow());
      const exists = await repository.exists('wf-001');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent workflow', async () => {
      const exists = await repository.exists('wf-999');
      expect(exists).toBe(false);
    });
  });

  describe('findByTags', () => {
    it('should find workflows by tags', async () => {
      await repository.save(createMockWorkflow({
        workflowId: 'wf-001',
        tags: ['ecommerce', 'order']
      }));
      await repository.save(createMockWorkflow({
        workflowId: 'wf-002',
        tags: ['content', 'publish']
      }));

      const ecommerceWorkflows = await repository.findByTags(['ecommerce']);
      expect(ecommerceWorkflows).toHaveLength(1);
      expect(ecommerceWorkflows[0].workflowId).toBe('wf-001');
    });

    it('should find workflows with any of the tags', async () => {
      await repository.save(createMockWorkflow({
        workflowId: 'wf-001',
        tags: ['ecommerce', 'order']
      }));
      await repository.save(createMockWorkflow({
        workflowId: 'wf-002',
        tags: ['content', 'order']
      }));

      const workflows = await repository.findByTags(['ecommerce', 'content']);
      expect(workflows).toHaveLength(2);
    });
  });

  describe('getVersions', () => {
    it('should return all versions of a workflow', async () => {
      await repository.save(createMockWorkflow({ workflowId: 'wf-001', version: '1.0.0' }));
      await repository.save(createMockWorkflow({ workflowId: 'wf-001', version: '1.1.0' }));
      await repository.save(createMockWorkflow({ workflowId: 'wf-001', version: '2.0.0' }));

      const versions = await repository.getVersions('wf-001');
      expect(versions).toHaveLength(3);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('1.1.0');
      expect(versions).toContain('2.0.0');
    });
  });

  describe('softDelete', () => {
    it('should soft delete workflow', async () => {
      const workflow = createMockWorkflow();
      await repository.save(workflow);

      const result = await repository.softDelete('wf-001');
      expect(result.success).toBe(true);

      const found = await repository.findById('wf-001');
      expect(found?.status).toBe(WorkflowStatus.ARCHIVED);
    });
  });
});
