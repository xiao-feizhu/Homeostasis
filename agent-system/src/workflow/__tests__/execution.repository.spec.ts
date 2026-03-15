import { ExecutionRepository, InMemoryExecutionRepository } from '../repositories/execution.repository';
import { WorkflowExecution, ExecutionStatus, WorkflowEvent, WorkflowEventType } from '../entities/workflow-definition.entity';

describe('ExecutionRepository', () => {
  let repository: ExecutionRepository;

  beforeEach(() => {
    repository = new InMemoryExecutionRepository();
  });

  const createMockExecution = (overrides: Partial<WorkflowExecution> = {}): WorkflowExecution => ({
    executionId: 'exec-001',
    workflowId: 'wf-001',
    userId: 'user-001',
    status: ExecutionStatus.PENDING,
    context: {},
    nodeExecutions: [],
    executionPath: [],
    timing: {
      scheduledAt: new Date('2024-01-01')
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  });

  const createMockEvent = (overrides: Partial<WorkflowEvent> = {}): WorkflowEvent => ({
    eventId: 'evt-001',
    eventType: WorkflowEventType.EXECUTION_STARTED,
    executionId: 'exec-001',
    workflowId: 'wf-001',
    timestamp: new Date(),
    version: 1,
    payload: {},
    metadata: { correlationId: 'corr-001' },
    ...overrides
  });

  describe('saveExecution', () => {
    it('should save execution', async () => {
      const execution = createMockExecution();
      const result = await repository.saveExecution(execution);

      expect(result.success).toBe(true);
    });

    it('should update existing execution', async () => {
      const execution = createMockExecution();
      await repository.saveExecution(execution);

      const updated = { ...execution, status: ExecutionStatus.COMPLETED };
      const result = await repository.saveExecution(updated);

      expect(result.success).toBe(true);
      const retrieved = await repository.findExecutionById('exec-001');
      expect(retrieved?.status).toBe(ExecutionStatus.COMPLETED);
    });
  });

  describe('findExecutionById', () => {
    it('should find execution by id', async () => {
      const execution = createMockExecution();
      await repository.saveExecution(execution);

      const found = await repository.findExecutionById('exec-001');
      expect(found).not.toBeNull();
      expect(found?.executionId).toBe('exec-001');
    });

    it('should return null for non-existent execution', async () => {
      const found = await repository.findExecutionById('exec-999');
      expect(found).toBeNull();
    });
  });

  describe('findExecutionsByWorkflow', () => {
    it('should find executions by workflow', async () => {
      await repository.saveExecution(createMockExecution({ executionId: 'exec-001', workflowId: 'wf-001' }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-002', workflowId: 'wf-001' }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-003', workflowId: 'wf-002' }));

      const executions = await repository.findExecutionsByWorkflow('wf-001');
      expect(executions).toHaveLength(2);
    });

    it('should support pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        await repository.saveExecution(createMockExecution({ executionId: `exec-00${i}` }));
      }

      const executions = await repository.findExecutionsByWorkflow('wf-001', { limit: 2, offset: 0 });
      expect(executions).toHaveLength(2);
    });

    it('should filter by status', async () => {
      await repository.saveExecution(createMockExecution({ executionId: 'exec-001', status: ExecutionStatus.RUNNING }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-002', status: ExecutionStatus.COMPLETED }));

      const executions = await repository.findExecutionsByWorkflow('wf-001', { status: ExecutionStatus.RUNNING });
      expect(executions).toHaveLength(1);
      expect(executions[0].executionId).toBe('exec-001');
    });
  });

  describe('findExecutionsByUser', () => {
    it('should find executions by user', async () => {
      await repository.saveExecution(createMockExecution({ executionId: 'exec-001', userId: 'user-001' }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-002', userId: 'user-001' }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-003', userId: 'user-002' }));

      const executions = await repository.findExecutionsByUser('user-001');
      expect(executions).toHaveLength(2);
    });
  });

  describe('saveEvent', () => {
    it('should save event', async () => {
      const event = createMockEvent();
      const result = await repository.saveEvent(event);

      expect(result.success).toBe(true);
    });

    it('should auto-increment version', async () => {
      const event1 = createMockEvent({ version: undefined as any });
      const result1 = await repository.saveEvent(event1);

      expect(result1.version).toBe(1);

      const event2 = createMockEvent({ version: undefined as any });
      const result2 = await repository.saveEvent(event2);

      expect(result2.version).toBe(2);
    });
  });

  describe('getEvents', () => {
    it('should get events for execution', async () => {
      await repository.saveEvent(createMockEvent({ eventId: 'evt-001', executionId: 'exec-001' }));
      await repository.saveEvent(createMockEvent({ eventId: 'evt-002', executionId: 'exec-001' }));
      await repository.saveEvent(createMockEvent({ eventId: 'evt-003', executionId: 'exec-002' }));

      const events = await repository.getEvents('exec-001');
      expect(events).toHaveLength(2);
    });

    it('should return events sorted by version', async () => {
      await repository.saveEvent(createMockEvent({ eventId: 'evt-001', version: 3 }));
      await repository.saveEvent(createMockEvent({ eventId: 'evt-002', version: 1 }));
      await repository.saveEvent(createMockEvent({ eventId: 'evt-003', version: 2 }));

      const events = await repository.getEvents('exec-001');
      expect(events[0].version).toBe(1);
      expect(events[1].version).toBe(2);
      expect(events[2].version).toBe(3);
    });

    it('should support afterVersion filter', async () => {
      await repository.saveEvent(createMockEvent({ eventId: 'evt-001', version: 1 }));
      await repository.saveEvent(createMockEvent({ eventId: 'evt-002', version: 2 }));
      await repository.saveEvent(createMockEvent({ eventId: 'evt-003', version: 3 }));

      const events = await repository.getEvents('exec-001', { afterVersion: 1 });
      expect(events).toHaveLength(2);
      expect(events[0].version).toBe(2);
    });
  });

  describe('deleteExecution', () => {
    it('should delete execution and its events', async () => {
      const execution = createMockExecution();
      await repository.saveExecution(execution);
      await repository.saveEvent(createMockEvent());

      const result = await repository.deleteExecution('exec-001');
      expect(result.success).toBe(true);

      const found = await repository.findExecutionById('exec-001');
      expect(found).toBeNull();

      const events = await repository.getEvents('exec-001');
      expect(events).toHaveLength(0);
    });
  });

  describe('getExecutionCount', () => {
    it('should return total execution count for workflow', async () => {
      await repository.saveExecution(createMockExecution({ executionId: 'exec-001' }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-002' }));

      const count = await repository.getExecutionCount('wf-001');
      expect(count).toBe(2);
    });
  });

  describe('getExecutionStats', () => {
    it('should return execution statistics', async () => {
      await repository.saveExecution(createMockExecution({ executionId: 'exec-001', status: ExecutionStatus.COMPLETED }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-002', status: ExecutionStatus.COMPLETED }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-003', status: ExecutionStatus.FAILED }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-004', status: ExecutionStatus.RUNNING }));

      const stats = await repository.getExecutionStats('wf-001');
      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.running).toBe(1);
    });
  });

  describe('findExecutionsByStatus', () => {
    it('should find executions by status', async () => {
      await repository.saveExecution(createMockExecution({ executionId: 'exec-001', status: ExecutionStatus.PENDING }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-002', status: ExecutionStatus.RUNNING }));
      await repository.saveExecution(createMockExecution({ executionId: 'exec-003', status: ExecutionStatus.PENDING }));

      const pending = await repository.findExecutionsByStatus(ExecutionStatus.PENDING);
      expect(pending).toHaveLength(2);
    });
  });
});
