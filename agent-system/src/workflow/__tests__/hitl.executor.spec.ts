import { HITLNodeExecutor } from '../executors/hitl.executor';
import { NodeType, WorkflowNode } from '../entities/workflow-definition.entity';
import { NodeExecutionContextImpl } from '../executors/node.executor';
import { BreakpointManager } from '../hitl/breakpoint.manager';
import { BreakpointType, BreakpointStatus, BreakpointTriggerMode } from '../entities/hitl.entity';

// Mock BreakpointManager
jest.mock('../hitl/breakpoint.manager');

describe('HITLNodeExecutor', () => {
  let executor: HITLNodeExecutor;
  let context: NodeExecutionContextImpl;
  let mockBreakpointManager: jest.Mocked<BreakpointManager>;

  beforeEach(() => {
    mockBreakpointManager = new BreakpointManager() as jest.Mocked<BreakpointManager>;
    executor = new HITLNodeExecutor(mockBreakpointManager);
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'hitl-node',
      { userInput: 'Hello' },
      { currentValue: 42 }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('type', () => {
    it('should have HITL type', () => {
      expect(executor.type).toBe(NodeType.HITL);
    });
  });

  describe('execute - manual breakpoint', () => {
    it('should create manual breakpoint', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.REVIEW,
        status: BreakpointStatus.PENDING,
        context: { input: { userInput: 'Hello' } },
        createdAt: new Date(),
        approvals: [],
        config: {
          enabled: true,
          type: BreakpointType.REVIEW,
          mode: BreakpointTriggerMode.STATIC
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        updatedAt: new Date()
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce({
        ...mockBreakpoint,
        status: BreakpointStatus.APPROVED
      });

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Manual Review',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'review',
          description: 'Please review the data',
          approvers: ['user@example.com']
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(mockBreakpointManager.createBreakpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: 'exec-001',
          nodeId: 'hitl-1',
          config: expect.objectContaining({
            type: BreakpointType.REVIEW
          })
        })
      );
    });

    it('should wait for approval', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.APPROVAL,
        status: BreakpointStatus.PENDING,
        context: {},
        approvals: [],
        config: {
          enabled: true,
          type: BreakpointType.APPROVAL,
          mode: BreakpointTriggerMode.STATIC
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint
        .mockReturnValueOnce({ ...mockBreakpoint, status: BreakpointStatus.PENDING })
        .mockReturnValueOnce({ ...mockBreakpoint, status: BreakpointStatus.PENDING })
        .mockReturnValueOnce({ ...mockBreakpoint, status: BreakpointStatus.APPROVED });

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Approval Required',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'approval',
          description: 'Approve to continue'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(mockBreakpointManager.getBreakpoint).toHaveBeenCalledTimes(3);
    });

    it('should include context snapshot', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.REVIEW,
        status: BreakpointStatus.APPROVED,
        context: {
          input: { userInput: 'Hello' },
          output: { currentValue: 42 }
        },
        approvals: [],
        config: {
          enabled: true,
          type: BreakpointType.REVIEW,
          mode: BreakpointTriggerMode.STATIC,
          contextCapture: {
            input: true,
            output: true,
            logs: false,
            executionPath: false
          }
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce(mockBreakpoint);

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Review',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'review',
          captureContext: true
        }
      };

      await executor.execute(node, context);

      expect(mockBreakpointManager.createBreakpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            input: { userInput: 'Hello' },
            state: expect.objectContaining({ currentValue: 42 })
          })
        })
      );
    });
  });

  describe('execute - input collection', () => {
    it('should collect user input', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.INPUT,
        status: BreakpointStatus.RESOLVED,
        context: {
          userInput: { approved: true, comments: 'Looks good' }
        },
        approvals: [],
        resolution: {
          action: 'approve' as const,
          modifications: { approved: true, comments: 'Looks good' }
        },
        config: {
          enabled: true,
          type: BreakpointType.INPUT,
          mode: BreakpointTriggerMode.STATIC,
          inputSchema: {
            approved: 'boolean',
            comments: 'string'
          }
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: new Date(),
        resolvedBy: 'user-001'
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce(mockBreakpoint);

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Collect Input',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'input',
          inputSchema: {
            approved: 'boolean',
            comments: 'string'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toMatchObject({
        userInput: { approved: true, comments: 'Looks good' }
      });
    });

    it('should validate required input fields', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.INPUT,
        status: BreakpointStatus.RESOLVED,
        context: {
          userInput: { approved: true }
        },
        approvals: [],
        resolution: {
          action: 'approve' as const,
          modifications: { approved: true }
        },
        config: {
          enabled: true,
          type: BreakpointType.INPUT,
          mode: BreakpointTriggerMode.STATIC
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce(mockBreakpoint);

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Validate Input',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'input',
          requiredFields: ['approved', 'comments']
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });
  });

  describe('execute - timeout handling', () => {
    it('should handle timeout', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.APPROVAL,
        status: BreakpointStatus.TIMEOUT,
        context: {},
        approvals: [],
        config: {
          enabled: true,
          type: BreakpointType.APPROVAL,
          mode: BreakpointTriggerMode.STATIC
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce(mockBreakpoint);

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Timeout Test',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'approval',
          timeout: 3600
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });

    it('should use default timeout if not specified', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.APPROVAL,
        status: BreakpointStatus.APPROVED,
        context: {},
        approvals: [],
        config: {
          enabled: true,
          type: BreakpointType.APPROVAL,
          mode: BreakpointTriggerMode.STATIC,
          timeout: {
            duration: 60,
            reminderIntervals: [],
            autoAction: 'escalate' as const
          }
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce(mockBreakpoint);

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Default Timeout',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'approval'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(mockBreakpointManager.createBreakpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            timeout: expect.objectContaining({
              duration: expect.any(Number)
            })
          })
        })
      );
    });
  });

  describe('execute - rejection handling', () => {
    it('should handle rejected breakpoint', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.APPROVAL,
        status: BreakpointStatus.REJECTED,
        context: {},
        approvals: [{
          recordId: 'rec-001',
          approverId: 'user-001',
          approverName: 'Test User',
          action: 'reject' as const,
          comment: 'Data is incorrect',
          timestamp: new Date()
        }],
        resolution: {
          action: 'reject' as const,
          comment: 'Data is incorrect'
        },
        config: {
          enabled: true,
          type: BreakpointType.APPROVAL,
          mode: BreakpointTriggerMode.STATIC
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: new Date(),
        resolvedBy: 'user-001'
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce(mockBreakpoint);

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Approval Node',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'approval'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REJECTED');
      expect(result.error?.message).toContain('Data is incorrect');
    });
  });

  describe('execute - escalation', () => {
    it('should trigger escalation when configured', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.ESCALATION,
        status: BreakpointStatus.ESCALATED,
        context: {},
        approvals: [],
        config: {
          enabled: true,
          type: BreakpointType.ESCALATION,
          mode: BreakpointTriggerMode.STATIC,
          escalation: {
            enabled: true,
            levels: [{
              level: 1,
              condition: 'timeout',
              approvers: ['manager@example.com'],
              notifyChannels: ['email'],
              autoEscalateAfterMinutes: 30
            }]
          }
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce(mockBreakpoint);

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Escalation Test',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'escalation',
          escalation: {
            enabled: true,
            afterMinutes: 30,
            to: ['manager@example.com']
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ESCALATED');
    });
  });

  describe('execute - notification', () => {
    it('should send notification to approvers', async () => {
      const mockBreakpoint = {
        breakpointId: 'bp-001',
        executionId: 'exec-001',
        nodeId: 'hitl-1',
        type: BreakpointType.APPROVAL,
        status: BreakpointStatus.APPROVED,
        context: {},
        approvals: [],
        config: {
          enabled: true,
          type: BreakpointType.APPROVAL,
          mode: BreakpointTriggerMode.STATIC,
          approvers: {
            users: ['user1@example.com', 'user2@example.com']
          }
        },
        workflowId: 'wf-001',
        mode: BreakpointTriggerMode.STATIC,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockBreakpointManager.createBreakpoint.mockReturnValueOnce(mockBreakpoint);
      mockBreakpointManager.getBreakpoint.mockReturnValueOnce(mockBreakpoint);

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Notify Test',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'approval',
          approvers: ['user1@example.com', 'user2@example.com'],
          notification: {
            channels: ['email', 'slack'],
            template: 'approval_required'
          }
        }
      };

      await executor.execute(node, context);

      // Notification is sent during breakpoint creation
      expect(mockBreakpointManager.createBreakpoint).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle missing breakpoint type', async () => {
      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Invalid',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {}
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIG_ERROR');
    });

    it('should handle breakpoint manager errors', async () => {
      mockBreakpointManager.createBreakpoint.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Error Test',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'review'
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BREAKPOINT_ERROR');
    });
  });

  describe('validate', () => {
    it('should validate valid HITL node', () => {
      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Valid HITL',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'review'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(true);
    });

    it('should require breakpoint type', () => {
      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Invalid',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {}
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('breakpointType is required');
    });

    it('should validate breakpoint type values', () => {
      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Invalid Type',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'invalid_type'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('Invalid breakpoint type'))).toBe(true);
    });

    it('should validate approval configuration', () => {
      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Missing Approvers',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'approval'
          // Missing approvers
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Approval breakpoints require approvers');
    });

    it('should validate timeout is positive', () => {
      const node: WorkflowNode = {
        nodeId: 'hitl-1',
        name: 'Invalid Timeout',
        type: NodeType.HITL,
        dependencies: ['node-1'],
        dependents: ['node-2'],
        config: {
          breakpointType: 'review',
          timeout: -1
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be positive');
    });
  });
});
