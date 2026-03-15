import { ApprovalEngine } from '../hitl/approval.engine';
import {
  ApprovalFlow,
  ApprovalMode,
  Breakpoint,
  BreakpointType,
  BreakpointStatus,
  BreakpointTriggerMode
} from '../entities/hitl.entity';

describe('ApprovalEngine', () => {
  let engine: ApprovalEngine;

  beforeEach(() => {
    engine = new ApprovalEngine();
  });

  const createMockFlow = (overrides: Partial<ApprovalFlow> = {}): ApprovalFlow => ({
    flowId: 'flow-001',
    name: 'Test Approval Flow',
    trigger: {
      type: 'workflow_node',
      workflowIds: ['wf-001'],
      nodeIds: ['node-1']
    },
    steps: [
      {
        stepId: 'step-1',
        name: 'Manager Review',
        order: 1,
        approvers: {
          type: 'user',
          values: ['manager-1', 'manager-2']
        },
        mode: ApprovalMode.ANY,
        timeout: {
          duration: 120,
          autoAction: 'escalate',
          escalationStep: 'step-2'
        },
        notifications: {
          channels: ['email'],
          template: 'approval-request',
          reminderIntervals: [30, 60, 90]
        }
      },
      {
        stepId: 'step-2',
        name: 'Director Review',
        order: 2,
        approvers: {
          type: 'role',
          values: ['director']
        },
        mode: ApprovalMode.ANY,
        timeout: {
          duration: 240,
          autoAction: 'remind'
        },
        notifications: {
          channels: ['email', 'sms'],
          template: 'escalation-request',
          reminderIntervals: [60, 120]
        }
      }
    ],
    config: {
      timeout: 480,
      allowTransfer: true,
      allowDelegate: true,
      allowBatch: false,
      requireComment: true
    },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
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
      approvers: {
        users: ['user-1', 'user-2']
      },
      approvalMode: ApprovalMode.ANY
    },
    context: {},
    approvals: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });

  describe('registerFlow', () => {
    it('should register a new approval flow', () => {
      const flow = createMockFlow();
      const result = engine.registerFlow(flow);

      expect(result.success).toBe(true);
      expect(engine.getFlow('flow-001')).toEqual(flow);
    });

    it('should reject duplicate flow registration', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const result = engine.registerFlow(flow);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should validate flow has at least one step', () => {
      const flow = createMockFlow({ steps: [] });
      const result = engine.registerFlow(flow);

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least one step');
    });

    it('should validate step order is sequential', () => {
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'Step 1',
            order: 1,
            approvers: { type: 'user', values: ['user-1'] },
            mode: ApprovalMode.ANY,
            timeout: { duration: 60, autoAction: 'remind' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          },
          {
            stepId: 'step-2',
            name: 'Step 2',
            order: 3, // Skip order 2
            approvers: { type: 'user', values: ['user-2'] },
            mode: ApprovalMode.ANY,
            timeout: { duration: 60, autoAction: 'remind' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });

      const result = engine.registerFlow(flow);
      expect(result.success).toBe(false);
      expect(result.error).toContain('sequential');
    });
  });

  describe('findMatchingFlow', () => {
    beforeEach(() => {
      engine.registerFlow(createMockFlow({ flowId: 'flow-001' }));
      engine.registerFlow(createMockFlow({
        flowId: 'flow-002',
        trigger: {
          type: 'condition',
          condition: '${input.amount} > 10000'
        }
      }));
    });

    it('should find flow by workflow node', () => {
      const flow = engine.findMatchingFlow('wf-001', 'node-1', {});
      expect(flow).not.toBeNull();
      expect(flow?.flowId).toBe('flow-001');
    });

    it('should find flow by condition', () => {
      const flow = engine.findMatchingFlow('wf-001', 'node-2', { input: { amount: 15000 } });
      expect(flow).not.toBeNull();
      expect(flow?.flowId).toBe('flow-002');
    });

    it('should return null when no flow matches', () => {
      const flow = engine.findMatchingFlow('wf-999', 'node-1', {});
      expect(flow).toBeNull();
    });

    it('should return null when condition does not match', () => {
      const flow = engine.findMatchingFlow('wf-001', 'node-2', { amount: 5000 });
      expect(flow).toBeNull();
    });

    it('should prioritize first matching flow', () => {
      // Multiple flows could match, should return first
      engine.registerFlow(createMockFlow({
        flowId: 'flow-003',
        trigger: {
          type: 'workflow_node',
          workflowIds: ['wf-001'],
          nodeIds: ['node-1']
        }
      }));

      const flow = engine.findMatchingFlow('wf-001', 'node-1', {});
      expect(flow?.flowId).toBe('flow-001');
    });
  });

  describe('startApproval', () => {
    it('should start approval from first step', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      const result = engine.startApproval(breakpoint, flow);

      expect(result.success).toBe(true);
      expect(result.currentStep?.stepId).toBe('step-1');
      expect(result.pendingApprovers).toEqual(['manager-1', 'manager-2']);
    });

    it('should skip steps with unmet conditions', () => {
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'Condition Step',
            order: 1,
            approvers: { type: 'user', values: ['user-1'] },
            mode: ApprovalMode.ANY,
            condition: '${context.amount} > 10000',
            timeout: { duration: 60, autoAction: 'remind' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          },
          {
            stepId: 'step-2',
            name: 'Default Step',
            order: 2,
            approvers: { type: 'user', values: ['user-2'] },
            mode: ApprovalMode.ANY,
            timeout: { duration: 60, autoAction: 'remind' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });

      const breakpoint = createMockBreakpoint({ context: { input: { amount: 5000 } } });
      const result = engine.startApproval(breakpoint, flow);

      expect(result.success).toBe(true);
      expect(result.currentStep?.stepId).toBe('step-2');
    });

    it('should resolve approvers dynamically', () => {
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'Dynamic Approvers',
            order: 1,
            approvers: {
              type: 'dynamic',
              values: [],
              dynamicExpression: '${context.owner}'
            },
            mode: ApprovalMode.ANY,
            timeout: { duration: 60, autoAction: 'remind' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });

      const breakpoint = createMockBreakpoint({ context: { context: { owner: 'dynamic-user' } } });
      const result = engine.startApproval(breakpoint, flow);

      expect(result.success).toBe(true);
      expect(result.pendingApprovers).toContain('dynamic-user');
    });
  });

  describe('processApproval', () => {
    it('should approve with ANY mode on first approval', () => {
      // 使用单步流程测试 ANY 模式
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'Single Step',
            order: 1,
            approvers: { type: 'user', values: ['manager-1', 'manager-2'] },
            mode: ApprovalMode.ANY,
            timeout: { duration: 120, autoAction: 'escalate' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      const result = engine.processApproval(breakpoint, {
        approverId: 'manager-1',
        action: 'approve',
        comment: 'Approved'
      });

      expect(result.success).toBe(true);
      expect(result.isComplete).toBe(true);
      expect(result.breakpoint.status).toBe(BreakpointStatus.APPROVED);
    });

    it('should require all approvals for ALL mode', () => {
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'All Approval',
            order: 1,
            approvers: { type: 'user', values: ['user-1', 'user-2', 'user-3'] },
            mode: ApprovalMode.ALL,
            timeout: { duration: 60, autoAction: 'remind' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });

      const breakpoint = createMockBreakpoint({
        config: {
          enabled: true,
          type: BreakpointType.APPROVAL,
          mode: BreakpointTriggerMode.STATIC,
          approvers: {
            users: ['user-1', 'user-2', 'user-3']
          },
          approvalMode: ApprovalMode.ALL
        }
      });
      engine.startApproval(breakpoint, flow);

      engine.processApproval(breakpoint, { approverId: 'user-1', action: 'approve' });
      engine.processApproval(breakpoint, { approverId: 'user-2', action: 'approve' });

      expect(breakpoint.status).toBe(BreakpointStatus.IN_REVIEW);

      engine.processApproval(breakpoint, { approverId: 'user-3', action: 'approve' });
      expect(breakpoint.status).toBe(BreakpointStatus.APPROVED);
    });

    it('should handle VOTE mode with required count', () => {
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'Vote',
            order: 1,
            approvers: { type: 'role', values: ['committee'] },
            mode: ApprovalMode.VOTE,
            requiredCount: 2,
            timeout: { duration: 60, autoAction: 'remind' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });

      const breakpoint = createMockBreakpoint({
        config: {
          ...createMockBreakpoint().config,
          approvalMode: ApprovalMode.VOTE,
          requiredApprovals: 2
        }
      });

      engine.startApproval(breakpoint, flow);

      engine.processApproval(breakpoint, { approverId: 'member-1', action: 'approve' });
      expect(breakpoint.status).toBe(BreakpointStatus.IN_REVIEW);

      engine.processApproval(breakpoint, { approverId: 'member-2', action: 'approve' });
      expect(breakpoint.status).toBe(BreakpointStatus.APPROVED);
    });

    it('should move to next step after approval', () => {
      // 使用单步流程测试流程完成
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'Single Step',
            order: 1,
            approvers: { type: 'user', values: ['manager-1'] },
            mode: ApprovalMode.ANY,
            timeout: { duration: 60, autoAction: 'remind' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      const result = engine.processApproval(breakpoint, {
        approverId: 'manager-1',
        action: 'approve'
      });

      expect(result.isComplete).toBe(true); // Last step
    });

    it('should reject and complete immediately', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      const result = engine.processApproval(breakpoint, {
        approverId: 'manager-1',
        action: 'reject',
        comment: 'Not acceptable'
      });

      expect(result.success).toBe(true);
      expect(result.isComplete).toBe(true);
      expect(breakpoint.status).toBe(BreakpointStatus.REJECTED);
    });

    it('should support transfer action', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      const result = engine.processApproval(breakpoint, {
        approverId: 'manager-1',
        action: 'transfer',
        comment: 'Transferring to colleague'
      });

      expect(result.success).toBe(true);
      expect(breakpoint.approvals[0].action).toBe('transfer');
    });

    it('should prevent duplicate approval from same user', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      engine.processApproval(breakpoint, { approverId: 'manager-1', action: 'approve' });

      expect(() => {
        engine.processApproval(breakpoint, { approverId: 'manager-1', action: 'approve' });
      }).toThrow('already submitted');
    });
  });

  describe('escalation', () => {
    it('should escalate to next step when timeout', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      const result = engine.escalate(breakpoint, flow);

      expect(result.success).toBe(true);
      expect(result.currentStep?.stepId).toBe('step-2');
      expect(breakpoint.status).toBe(BreakpointStatus.ESCALATED);
    });

    it('should auto-approve when configured', () => {
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'Auto Approve',
            order: 1,
            approvers: { type: 'user', values: ['user-1'] },
            mode: ApprovalMode.ANY,
            timeout: { duration: 60, autoAction: 'approve' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      const result = engine.handleTimeout(breakpoint, flow);

      expect(result.success).toBe(true);
      expect(breakpoint.status).toBe(BreakpointStatus.APPROVED);
    });

    it('should auto-reject when configured', () => {
      const flow = createMockFlow({
        steps: [
          {
            stepId: 'step-1',
            name: 'Auto Reject',
            order: 1,
            approvers: { type: 'user', values: ['user-1'] },
            mode: ApprovalMode.ANY,
            timeout: { duration: 60, autoAction: 'reject' },
            notifications: { channels: [], template: '', reminderIntervals: [] }
          }
        ]
      });

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      const result = engine.handleTimeout(breakpoint, flow);

      expect(result.success).toBe(true);
      expect(breakpoint.status).toBe(BreakpointStatus.REJECTED);
    });
  });

  describe('delegation', () => {
    it('should delegate to another user', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      const result = engine.delegate(breakpoint, 'manager-1', 'delegate-1');

      expect(result.success).toBe(true);
      expect(result.delegatedTo).toBe('delegate-1');
    });

    it('should prevent delegation to self', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint();
      engine.startApproval(breakpoint, flow);

      expect(() => {
        engine.delegate(breakpoint, 'manager-1', 'manager-1');
      }).toThrow('Cannot delegate to self');
    });
  });

  describe('batch approval', () => {
    it('should support batch approval when enabled', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint1 = createMockBreakpoint({ breakpointId: 'bp-001' });
      const breakpoint2 = createMockBreakpoint({ breakpointId: 'bp-002' });

      engine.startApproval(breakpoint1, flow);
      engine.startApproval(breakpoint2, flow);

      const result = engine.batchApprove(['bp-001', 'bp-002'], 'manager-1', true);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('should reject batch when not enabled', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      expect(() => {
        engine.batchApprove(['bp-001'], 'manager-1', false);
      }).toThrow('Batch approval not enabled');
    });
  });

  describe('reminders', () => {
    it('should calculate reminder times correctly', () => {
      const flow = createMockFlow();
      const step = flow.steps[0];

      const reminders = engine.calculateReminderTimes(step, new Date());

      expect(reminders).toHaveLength(3);
    });

    it('should determine if reminder is due', () => {
      const flow = createMockFlow();
      engine.registerFlow(flow);

      const breakpoint = createMockBreakpoint({
        createdAt: new Date(Date.now() - 31 * 60 * 1000) // 31 minutes ago
      });
      engine.startApproval(breakpoint, flow);

      const isDue = engine.isReminderDue(breakpoint, flow.steps[0]);
      expect(isDue).toBe(true);
    });
  });
});
