import { BreakpointRepository, InMemoryBreakpointRepository } from '../repositories/breakpoint.repository';
import {
  Breakpoint,
  BreakpointType,
  BreakpointStatus,
  BreakpointTriggerMode,
  ApprovalMode
} from '../entities/hitl.entity';

describe('BreakpointRepository', () => {
  let repository: BreakpointRepository;

  beforeEach(() => {
    repository = new InMemoryBreakpointRepository();
  });

  const createMockBreakpoint = (overrides: Partial<Breakpoint> = {}): Breakpoint => ({
    breakpointId: 'bp-001',
    executionId: 'exec-001',
    workflowId: 'wf-001',
    nodeId: 'node-1',
    type: BreakpointType.APPROVAL,
    mode: BreakpointTriggerMode.STATIC,
    status: BreakpointStatus.PENDING,
    config: {
      enabled: true,
      type: BreakpointType.APPROVAL,
      mode: BreakpointTriggerMode.STATIC,
      approvers: { users: ['user-1', 'user-2'] },
      approvalMode: ApprovalMode.ANY
    },
    context: {},
    approvals: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  });

  describe('save', () => {
    it('should save breakpoint', async () => {
      const breakpoint = createMockBreakpoint();
      const result = await repository.save(breakpoint);

      expect(result.success).toBe(true);
    });

    it('should update existing breakpoint', async () => {
      const breakpoint = createMockBreakpoint();
      await repository.save(breakpoint);

      const updated = { ...breakpoint, status: BreakpointStatus.APPROVED };
      const result = await repository.save(updated);

      expect(result.success).toBe(true);
      const retrieved = await repository.findById('bp-001');
      expect(retrieved?.status).toBe(BreakpointStatus.APPROVED);
    });
  });

  describe('findById', () => {
    it('should find breakpoint by id', async () => {
      const breakpoint = createMockBreakpoint();
      await repository.save(breakpoint);

      const found = await repository.findById('bp-001');
      expect(found).not.toBeNull();
      expect(found?.breakpointId).toBe('bp-001');
    });

    it('should return null for non-existent breakpoint', async () => {
      const found = await repository.findById('bp-999');
      expect(found).toBeNull();
    });
  });

  describe('findByExecution', () => {
    it('should find breakpoints by execution', async () => {
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-001', executionId: 'exec-001' }));
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-002', executionId: 'exec-001' }));
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-003', executionId: 'exec-002' }));

      const breakpoints = await repository.findByExecution('exec-001');
      expect(breakpoints).toHaveLength(2);
    });
  });

  describe('findByStatus', () => {
    it('should find breakpoints by status', async () => {
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-001', status: BreakpointStatus.PENDING }));
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-002', status: BreakpointStatus.APPROVED }));
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-003', status: BreakpointStatus.PENDING }));

      const pending = await repository.findByStatus(BreakpointStatus.PENDING);
      expect(pending).toHaveLength(2);
    });
  });

  describe('findPendingByWorkflow', () => {
    it('should find pending breakpoints by workflow', async () => {
      await repository.save(createMockBreakpoint({
        breakpointId: 'bp-001',
        workflowId: 'wf-001',
        status: BreakpointStatus.PENDING
      }));
      await repository.save(createMockBreakpoint({
        breakpointId: 'bp-002',
        workflowId: 'wf-001',
        status: BreakpointStatus.APPROVED
      }));

      const pending = await repository.findPendingByWorkflow('wf-001');
      expect(pending).toHaveLength(1);
      expect(pending[0].breakpointId).toBe('bp-001');
    });
  });

  describe('findByApprover', () => {
    it('should find breakpoints by approver', async () => {
      await repository.save(createMockBreakpoint({
        breakpointId: 'bp-001',
        config: {
          enabled: true,
          type: BreakpointType.APPROVAL,
          mode: BreakpointTriggerMode.STATIC,
          approvers: { users: ['user-1', 'user-2'] }
        }
      }));
      await repository.save(createMockBreakpoint({
        breakpointId: 'bp-002',
        config: {
          enabled: true,
          type: BreakpointType.APPROVAL,
          mode: BreakpointTriggerMode.STATIC,
          approvers: { users: ['user-2', 'user-3'] }
        }
      }));

      const user2Breakpoints = await repository.findByApprover('user-2');
      expect(user2Breakpoints).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete breakpoint', async () => {
      const breakpoint = createMockBreakpoint();
      await repository.save(breakpoint);

      const result = await repository.delete('bp-001');
      expect(result.success).toBe(true);

      const found = await repository.findById('bp-001');
      expect(found).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return breakpoint statistics', async () => {
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-001', status: BreakpointStatus.PENDING }));
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-002', status: BreakpointStatus.APPROVED }));
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-003', status: BreakpointStatus.REJECTED }));
      await repository.save(createMockBreakpoint({ breakpointId: 'bp-004', status: BreakpointStatus.PENDING }));

      const stats = await repository.getStats('wf-001');
      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(2);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
    });
  });

  describe('findExpired', () => {
    it('should find expired breakpoints', async () => {
      const pastDate = new Date(Date.now() - 1000);
      await repository.save(createMockBreakpoint({
        breakpointId: 'bp-001',
        expiresAt: pastDate
      }));
      await repository.save(createMockBreakpoint({
        breakpointId: 'bp-002',
        expiresAt: new Date(Date.now() + 3600000)
      }));

      const expired = await repository.findExpired();
      expect(expired).toHaveLength(1);
      expect(expired[0].breakpointId).toBe('bp-001');
    });
  });
});
