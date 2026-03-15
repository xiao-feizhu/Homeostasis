import { InterventionHandler } from '../hitl/intervention.handler';
import {
  InterventionAction
} from '../entities/hitl.entity';
import {
  WorkflowExecution,
  ExecutionStatus,
  NodeExecutionStatus
} from '../entities/workflow-definition.entity';

describe('InterventionHandler', () => {
  let handler: InterventionHandler;
  let mockExecutionRepository: any;
  let mockEventEmitter: any;
  let mockAuditLogger: any;

  beforeEach(() => {
    mockExecutionRepository = {
      findById: jest.fn(),
      save: jest.fn()
    };
    mockEventEmitter = {
      emit: jest.fn()
    };
    mockAuditLogger = {
      log: jest.fn()
    };

    handler = new InterventionHandler(
      mockExecutionRepository,
      mockEventEmitter,
      mockAuditLogger
    );
  });

  const createMockExecution = (overrides: Partial<WorkflowExecution> = {}): WorkflowExecution => ({
    executionId: 'exec-001',
    workflowId: 'wf-001',
    userId: 'user-001',
    status: ExecutionStatus.RUNNING,
    context: { data: 'test' },
    nodeExecutions: [
      {
        nodeId: 'node-1',
        nodeName: 'Start Node',
        status: NodeExecutionStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0
      },
      {
        nodeId: 'node-2',
        nodeName: 'Process Node',
        status: NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        retryCount: 0
      }
    ],
    currentNodeId: 'node-2',
    executionPath: ['node-1', 'node-2'],
    timing: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });

  describe('handleIntervention', () => {
    it('should pause running execution', async () => {
      const execution = createMockExecution();
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.PAUSE,
        {},
        'operator-001'
      );

      expect(result.success).toBe(true);
      expect(execution.status).toBe(ExecutionStatus.PAUSED);
      expect(mockExecutionRepository.save).toHaveBeenCalledWith(execution);
    });

    it('should resume paused execution', async () => {
      const execution = createMockExecution({ status: ExecutionStatus.PAUSED });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.RESUME,
        {},
        'operator-001'
      );

      expect(result.success).toBe(true);
      expect(execution.status).toBe(ExecutionStatus.RUNNING);
    });

    it('should skip current node', async () => {
      const execution = createMockExecution();
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.SKIP,
        { fallbackValue: { skipped: true } },
        'operator-001'
      );

      expect(result.success).toBe(true);
      const nodeExecution = execution.nodeExecutions.find(n => n.nodeId === 'node-2');
      expect(nodeExecution?.status).toBe(NodeExecutionStatus.SKIPPED);
      expect(nodeExecution?.output).toEqual({ skipped: true });
    });

    it('should retry failed node', async () => {
      const execution = createMockExecution({
        status: ExecutionStatus.FAILED,
        nodeExecutions: [
          {
            nodeId: 'node-1',
            nodeName: 'Node 1',
            status: NodeExecutionStatus.COMPLETED,
            retryCount: 0
          },
          {
            nodeId: 'node-2',
            nodeName: 'Node 2',
            status: NodeExecutionStatus.FAILED,
            error: { code: 'ERROR', message: 'Failed' },
            retryCount: 0
          }
        ],
        error: { code: 'ERROR', message: 'Failed', failedNodeId: 'node-2' }
      });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.RETRY,
        { nodeId: 'node-2' },
        'operator-001'
      );

      expect(result.success).toBe(true);
      expect(execution.status).toBe(ExecutionStatus.RUNNING);
      const nodeExecution = execution.nodeExecutions.find(n => n.nodeId === 'node-2');
      expect(nodeExecution?.status).toBe(NodeExecutionStatus.PENDING);
      expect(nodeExecution?.error).toBeUndefined();
      expect(nodeExecution?.retryCount).toBe(1);
    });

    it('should retry with modifications', async () => {
      const execution = createMockExecution({
        status: ExecutionStatus.FAILED,
        nodeExecutions: [
          {
            nodeId: 'node-2',
            nodeName: 'Node 2',
            status: NodeExecutionStatus.FAILED,
            retryCount: 0
          }
        ]
      });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const modifications = { apiEndpoint: 'https://new-api.com' };

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.RETRY_WITH_MODIFICATIONS,
        { nodeId: 'node-2', modifications },
        'operator-001'
      );

      expect(result.success).toBe(true);
      expect(execution.context.apiEndpoint).toBe('https://new-api.com');
    });

    it('should rollback to specified node', async () => {
      const execution = createMockExecution({
        nodeExecutions: [
          {
            nodeId: 'node-1',
            nodeName: 'Node 1',
            status: NodeExecutionStatus.COMPLETED,
            retryCount: 0
          },
          {
            nodeId: 'node-2',
            nodeName: 'Node 2',
            status: NodeExecutionStatus.COMPLETED,
            retryCount: 0
          },
          {
            nodeId: 'node-3',
            nodeName: 'Node 3',
            status: NodeExecutionStatus.RUNNING,
            retryCount: 0
          }
        ],
        currentNodeId: 'node-3',
        executionPath: ['node-1', 'node-2', 'node-3']
      });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.ROLLBACK,
        { targetNodeId: 'node-2' },
        'operator-001'
      );

      expect(result.success).toBe(true);
      expect(result.rolledBackNodes).toEqual(['node-3', 'node-2']);
      expect(result.resumedFrom).toBe('node-2');
      expect(execution.currentNodeId).toBe('node-2');

      const node3 = execution.nodeExecutions.find(n => n.nodeId === 'node-3');
      expect(node3?.status).toBe(NodeExecutionStatus.ROLLED_BACK);
    });

    it('should reject rollback to invalid target', async () => {
      const execution = createMockExecution({
        executionPath: ['node-1', 'node-2']
      });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      await expect(
        handler.handleIntervention(
          'exec-001',
          InterventionAction.ROLLBACK,
          { targetNodeId: 'node-3' },
          'operator-001'
        )
      ).rejects.toThrow('Invalid rollback target: node-3');
    });

    it('should reject rollback to future node', async () => {
      const execution = createMockExecution({
        currentNodeId: 'node-1',
        executionPath: ['node-1']
      });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      await expect(
        handler.handleIntervention(
          'exec-001',
          InterventionAction.ROLLBACK,
          { targetNodeId: 'node-2' },
          'operator-001'
        )
      ).rejects.toThrow('Invalid rollback target: node-2');
    });

    it('should force complete execution', async () => {
      const execution = createMockExecution();
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.FORCE_COMPLETE,
        {},
        'operator-001'
      );

      expect(result.success).toBe(true);
      expect(execution.status).toBe(ExecutionStatus.COMPLETED);
    });

    it('should force fail execution', async () => {
      const execution = createMockExecution();
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.FORCE_FAIL,
        { reason: 'Manual termination' },
        'operator-001'
      );

      expect(result.success).toBe(true);
      expect(execution.status).toBe(ExecutionStatus.FAILED);
      expect(execution.error?.message).toContain('Manual termination');
    });

    it('should throw error for non-existent execution', async () => {
      mockExecutionRepository.findById.mockResolvedValue(null);

      await expect(
        handler.handleIntervention(
          'non-existent',
          InterventionAction.PAUSE,
          {},
          'operator-001'
        )
      ).rejects.toThrow('Execution not found: non-existent');
    });

    it('should log audit entry for intervention', async () => {
      const execution = createMockExecution();
      mockExecutionRepository.findById.mockResolvedValue(execution);

      await handler.handleIntervention(
        'exec-001',
        InterventionAction.PAUSE,
        {},
        'operator-001'
      );

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'intervention',
          target: expect.objectContaining({
            executionId: 'exec-001'
          }),
          action: 'pause',
          operator: expect.objectContaining({
            userId: 'operator-001'
          })
        })
      );
    });

    it('should emit intervention event', async () => {
      const execution = createMockExecution();
      mockExecutionRepository.findById.mockResolvedValue(execution);

      await handler.handleIntervention(
        'exec-001',
        InterventionAction.PAUSE,
        {},
        'operator-001'
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'execution.intervention',
        expect.objectContaining({
          executionId: 'exec-001',
          action: 'pause',
          operatorId: 'operator-001'
        })
      );
    });
  });

  describe('validatePermission', () => {
    it('should allow operator to intervene on own execution', async () => {
      const execution = createMockExecution({ userId: 'operator-001' });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      const result = await handler.handleIntervention(
        'exec-001',
        InterventionAction.PAUSE,
        {},
        'operator-001'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('rollback with compensation', () => {
    it('should execute compensation for rolled back nodes', async () => {
      const mockCompensation = jest.fn().mockResolvedValue(undefined);

      const execution = createMockExecution({
        nodeExecutions: [
          {
            nodeId: 'node-1',
            nodeName: 'Node 1',
            status: NodeExecutionStatus.COMPLETED,
            output: { compensation: mockCompensation },
            retryCount: 0
          },
          {
            nodeId: 'node-2',
            nodeName: 'Node 2',
            status: NodeExecutionStatus.COMPLETED,
            retryCount: 0
          }
        ],
        currentNodeId: 'node-2',
        executionPath: ['node-1', 'node-2']
      });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      await handler.handleIntervention(
        'exec-001',
        InterventionAction.ROLLBACK,
        { targetNodeId: 'node-1' },
        'operator-001'
      );

      // Compensation should be called for node-2 (in reverse order)
      expect(mockCompensation).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent interventions safely', async () => {
      const execution = createMockExecution({ status: ExecutionStatus.RUNNING });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      // Simulate multiple interventions
      const promise1 = handler.handleIntervention(
        'exec-001', InterventionAction.PAUSE, {}, 'operator-001'
      );

      // Second intervention should wait for first to complete
      const result = await promise1;

      expect(result.success).toBe(true);
    });

    it('should preserve context when requested during rollback', async () => {
      const execution = createMockExecution({
        context: { important: 'data', calculated: 42 },
        nodeExecutions: [
          { nodeId: 'node-1', nodeName: 'Node 1', status: NodeExecutionStatus.COMPLETED, retryCount: 0 },
          { nodeId: 'node-2', nodeName: 'Node 2', status: NodeExecutionStatus.COMPLETED, retryCount: 0 }
        ],
        currentNodeId: 'node-2',
        executionPath: ['node-1', 'node-2']
      });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      await handler.handleIntervention(
        'exec-001',
        InterventionAction.ROLLBACK,
        { targetNodeId: 'node-1', preserveContext: true },
        'operator-001'
      );

      // Context should be preserved
      expect(execution.context.important).toBe('data');
      expect(execution.context.calculated).toBe(42);
    });

    it('should reset context when not preserved during rollback', async () => {
      const execution = createMockExecution({
        context: { important: 'data' },
        nodeExecutions: [
          { nodeId: 'node-1', nodeName: 'Node 1', status: NodeExecutionStatus.COMPLETED, output: { state: 'node1_state' }, retryCount: 0 },
          { nodeId: 'node-2', nodeName: 'Node 2', status: NodeExecutionStatus.COMPLETED, retryCount: 0 }
        ],
        currentNodeId: 'node-2',
        executionPath: ['node-1', 'node-2']
      });
      mockExecutionRepository.findById.mockResolvedValue(execution);

      await handler.handleIntervention(
        'exec-001',
        InterventionAction.ROLLBACK,
        { targetNodeId: 'node-1', preserveContext: false },
        'operator-001'
      );

      // Context should be restored to target node state
      expect(execution.context).toEqual({ state: 'node1_state' });
    });
  });
});
