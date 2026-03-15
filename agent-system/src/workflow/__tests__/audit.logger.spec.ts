import { AuditLogger, AuditLogStorage } from '../hitl/audit.logger';
import {
  HITLAuditLog,
  Breakpoint,
  BreakpointType,
  BreakpointStatus,
  BreakpointTriggerMode,
  InterventionResult,
  InterventionAction
} from '../entities/hitl.entity';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let mockStorage: jest.Mocked<AuditLogStorage>;

  beforeEach(() => {
    mockStorage = {
      save: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
      getById: jest.fn().mockResolvedValue(null)
    };

    logger = new AuditLogger(mockStorage);
  });

  const createMockLog = (overrides: Partial<HITLAuditLog> = {}): HITLAuditLog => ({
    logId: 'log-001',
    timestamp: new Date(),
    action: 'BREAKPOINT_CREATED',
    actionType: 'breakpoint',
    target: {
      type: 'breakpoint',
      id: 'bp-001',
      executionId: 'exec-001',
      workflowId: 'wf-001'
    },
    operator: {
      userId: 'user-001',
      userName: '张三',
      role: 'admin'
    },
    details: {
      reason: '手动创建断点'
    },
    result: 'success',
    ...overrides
  });

  describe('log', () => {
    it('should save audit log', async () => {
      const log = createMockLog();
      const result = await logger.log(log);

      expect(result.success).toBe(true);
      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({
        logId: 'log-001',
        action: 'BREAKPOINT_CREATED'
      }));
    });

    it('should generate logId if not provided', async () => {
      const log = createMockLog({ logId: undefined as any });
      const result = await logger.log(log);

      expect(result.success).toBe(true);
      const savedLog = mockStorage.save.mock.calls[0][0];
      expect(savedLog.logId).toBeDefined();
      expect(savedLog.logId).toContain('log-');
    });

    it('should set timestamp if not provided', async () => {
      const log = createMockLog({ timestamp: undefined as any });
      const result = await logger.log(log);

      expect(result.success).toBe(true);
      const savedLog = mockStorage.save.mock.calls[0][0];
      expect(savedLog.timestamp).toBeInstanceOf(Date);
    });

    it('should handle storage failure', async () => {
      mockStorage.save.mockRejectedValueOnce(new Error('DB error'));

      const log = createMockLog();
      const result = await logger.log(log);

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });
  });

  describe('logBreakpointEvent', () => {
    it('should log breakpoint creation', async () => {
      const breakpoint: Breakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC,
        status: BreakpointStatus.PENDING,
        config: { enabled: true, type: BreakpointType.APPROVAL, mode: BreakpointTriggerMode.STATIC },
        context: {},
        approvals: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await logger.logBreakpointEvent(
        'BREAKPOINT_CREATED',
        breakpoint,
        { userId: 'user-001', userName: '张三', role: 'admin' }
      );

      expect(result.success).toBe(true);
      const savedLog = mockStorage.save.mock.calls[0][0];
      expect(savedLog.actionType).toBe('breakpoint');
      expect(savedLog.target.id).toBe('bp-001');
    });
  });

  describe('logIntervention', () => {
    it('should log intervention action', async () => {
      const intervention: InterventionResult = {
        success: true,
        executionId: 'exec-001',
        timestamp: new Date()
      };

      const result = await logger.logIntervention(
        InterventionAction.PAUSE,
        intervention,
        { userId: 'user-001', userName: '张三', role: 'operator' },
        { nodeId: 'node-1' }
      );

      expect(result.success).toBe(true);
      const savedLog = mockStorage.save.mock.calls[0][0];
      expect(savedLog.actionType).toBe('intervention');
      expect(savedLog.action).toBe('pause');
    });

    it('should include modifications in details', async () => {
      const intervention: InterventionResult = {
        success: true,
        executionId: 'exec-001',
        rolledBackNodes: ['node-2', 'node-3'],
        timestamp: new Date()
      };

      await logger.logIntervention(
        InterventionAction.ROLLBACK,
        intervention,
        { userId: 'user-001', userName: '张三', role: 'operator' },
        {
          targetNodeId: 'node-1',
          modifications: { amount: 100 },
          reason: '数据错误'
        }
      );

      const savedLog = mockStorage.save.mock.calls[0][0];
      expect(savedLog.details.modifications).toEqual({ amount: 100 });
      expect(savedLog.details.reason).toBe('数据错误');
    });
  });

  describe('logApproval', () => {
    it('should log approval action', async () => {
      const result = await logger.logApproval(
        'APPROVAL_SUBMITTED',
        'bp-001',
        { userId: 'user-001', userName: '张三', role: 'manager' },
        {
          action: 'approve',
          comment: '同意',
          approvers: ['user-001', 'user-002']
        }
      );

      expect(result.success).toBe(true);
      const savedLog = mockStorage.save.mock.calls[0][0];
      expect(savedLog.actionType).toBe('approval');
      expect(savedLog.action).toBe('APPROVAL_SUBMITTED');
      expect(savedLog.details.approvalAction).toBe('approve');
    });

    it('should calculate changes from before/after', async () => {
      const before = { status: 'pending', assignee: 'user-001' };
      const after = { status: 'approved', assignee: 'user-001' };

      await logger.logApproval(
        'STATUS_CHANGED',
        'bp-001',
        { userId: 'user-001', userName: '张三', role: 'manager' },
        { before, after }
      );

      const savedLog = mockStorage.save.mock.calls[0][0];
      expect(savedLog.details.changes).toEqual({
        status: { from: 'pending', to: 'approved' }
      });
    });
  });

  describe('query', () => {
    it('should query logs with filters', async () => {
      const mockLogs = [createMockLog(), createMockLog({ logId: 'log-002' })];
      mockStorage.query.mockResolvedValueOnce({ logs: mockLogs, total: 2 });

      const result = await logger.query({
        actionType: 'breakpoint',
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-12-31'),
        limit: 10,
        offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should handle query without filters', async () => {
      mockStorage.query.mockResolvedValueOnce({ logs: [], total: 0 });

      const result = await logger.query({});

      expect(result.success).toBe(true);
      expect(result.logs).toEqual([]);
    });

    it('should handle query failure', async () => {
      mockStorage.query.mockRejectedValueOnce(new Error('Query failed'));

      const result = await logger.query({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query failed');
    });
  });

  describe('getLogById', () => {
    it('should retrieve log by ID', async () => {
      const mockLog = createMockLog();
      mockStorage.getById.mockResolvedValueOnce(mockLog);

      const result = await logger.getLogById('log-001');

      expect(result.success).toBe(true);
      expect(result.log?.logId).toBe('log-001');
    });

    it('should return error for non-existent log', async () => {
      mockStorage.getById.mockResolvedValueOnce(null);

      const result = await logger.getLogById('log-999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getExecutionLogs', () => {
    it('should retrieve logs for specific execution', async () => {
      const mockLogs = [
        createMockLog({ target: { type: 'breakpoint', id: 'bp-001', executionId: 'exec-001' } }),
        createMockLog({ target: { type: 'breakpoint', id: 'bp-002', executionId: 'exec-001' } })
      ];
      mockStorage.query.mockResolvedValueOnce({ logs: mockLogs, total: 2 });

      const result = await logger.getExecutionLogs('exec-001');

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
      expect(mockStorage.query).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: 'exec-001' })
      );
    });
  });

  describe('getUserActivity', () => {
    it('should retrieve activity for specific user', async () => {
      const mockLogs = [
        createMockLog({ operator: { userId: 'user-001', userName: '张三', role: 'admin' } })
      ];
      mockStorage.query.mockResolvedValueOnce({ logs: mockLogs, total: 1 });

      const result = await logger.getUserActivity('user-001', {
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-12-31')
      });

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(1);
      expect(mockStorage.query).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001' })
      );
    });
  });

  describe('generateReport', () => {
    it('should generate activity report', async () => {
      const mockLogs = [
        createMockLog({ actionType: 'breakpoint', result: 'success' }),
        createMockLog({ actionType: 'intervention', result: 'success' }),
        createMockLog({ actionType: 'approval', result: 'failure' })
      ];
      mockStorage.query.mockResolvedValueOnce({ logs: mockLogs, total: 3 });

      const result = await logger.generateReport({
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-12-31')
      });

      expect(result.success).toBe(true);
      expect(result.summary?.totalActions).toBe(3);
      expect(result.summary?.successCount).toBe(2);
      expect(result.summary?.failureCount).toBe(1);
      expect(result.summary?.breakdown).toEqual({
        breakpoint: 1,
        intervention: 1,
        approval: 1,
        config: 0
      });
    });

    it('should calculate top users', async () => {
      const mockLogs = [
        createMockLog({ operator: { userId: 'user-001', userName: '张三', role: 'admin' } }),
        createMockLog({ operator: { userId: 'user-001', userName: '张三', role: 'admin' } }),
        createMockLog({ operator: { userId: 'user-002', userName: '李四', role: 'operator' } })
      ];
      mockStorage.query.mockResolvedValueOnce({ logs: mockLogs, total: 3 });

      const result = await logger.generateReport({
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-12-31')
      });

      expect(result.success).toBe(true);
      expect(result.summary?.topUsers).toEqual([
        { userId: 'user-001', userName: '张三', count: 2 },
        { userId: 'user-002', userName: '李四', count: 1 }
      ]);
    });
  });

  describe('anonymizeUserLogs', () => {
    it('should anonymize user data in logs', async () => {
      const mockLogs = [
        createMockLog({ logId: 'log-001', operator: { userId: 'user-001', userName: '张三', role: 'admin' } }),
        createMockLog({ logId: 'log-002', operator: { userId: 'user-001', userName: '张三', role: 'admin' } })
      ];
      mockStorage.query.mockResolvedValueOnce({ logs: mockLogs, total: 2 });

      const result = await logger.anonymizeUserLogs('user-001');

      expect(result.success).toBe(true);
      expect(result.anonymizedCount).toBe(2);
      // 验证保存的日志中用户名被替换
      const savedCalls = mockStorage.save.mock.calls;
      expect(savedCalls.length).toBe(2);
      expect(savedCalls[0][0].operator.userName).toBe('[REDACTED]');
    });
  });

  describe('retention policy', () => {
    it('should delete logs older than retention period', async () => {
      const oldLogs = [
        createMockLog({ logId: 'old-001', timestamp: new Date('2020-01-01') }),
        createMockLog({ logId: 'old-002', timestamp: new Date('2020-02-01') })
      ];
      mockStorage.query.mockResolvedValueOnce({ logs: oldLogs, total: 2 });

      // 模拟存储有删除方法
      mockStorage.delete = jest.fn().mockResolvedValue(undefined);

      const result = await logger.applyRetentionPolicy(365); // 365 days

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
    });
  });
});
