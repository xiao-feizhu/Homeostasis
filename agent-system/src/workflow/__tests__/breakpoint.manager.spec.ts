import {
  Breakpoint,
  BreakpointType,
  BreakpointStatus,
  BreakpointTriggerMode,
  ApprovalMode,
  BreakpointConfig
} from '../entities/hitl.entity';
import { BreakpointManager } from '../hitl/breakpoint.manager';
import { WorkflowEventType } from '../entities/workflow-definition.entity';

describe('BreakpointManager', () => {
  let manager: BreakpointManager;

  beforeEach(() => {
    manager = new BreakpointManager();
  });

  describe('createBreakpoint', () => {
    it('should create a breakpoint with basic configuration', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC,
        approvers: {
          users: ['user1', 'user2']
        },
        approvalMode: ApprovalMode.ANY
      };

      const breakpoint = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: { input: { amount: 1000 } }
      });

      expect(breakpoint.breakpointId).toBeDefined();
      expect(breakpoint.executionId).toBe('exec-001');
      expect(breakpoint.workflowId).toBe('wf-001');
      expect(breakpoint.nodeId).toBe('node-1');
      expect(breakpoint.type).toBe(BreakpointType.APPROVAL);
      expect(breakpoint.status).toBe(BreakpointStatus.PENDING);
      expect(breakpoint.approvals).toEqual([]);
    });

    it('should set expiresAt when timeout is configured', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC,
        timeout: {
          duration: 60,
          reminderIntervals: [15, 30, 45]
        }
      };

      const breakpoint = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      expect(breakpoint.expiresAt).toBeDefined();
      const expectedExpiry = new Date(breakpoint.createdAt.getTime() + 60 * 60 * 1000);
      expect(breakpoint.expiresAt!.getTime()).toBeCloseTo(expectedExpiry.getTime(), -3);
    });

    it('should capture context based on contextCapture config', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.REVIEW,
        mode: BreakpointTriggerMode.DYNAMIC,
        contextCapture: {
          input: true,
          output: false,
          logs: true,
          executionPath: true
        }
      };

      const context = {
        input: { data: 'test' },
        output: { result: 'done' },
        logs: ['log1', 'log2'],
        executionPath: ['start', 'node-1']
      };

      const breakpoint = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context
      });

      expect(breakpoint.context.input).toEqual({ data: 'test' });
      expect(breakpoint.context.logs).toEqual(['log1', 'log2']);
      expect(breakpoint.context.executionPath).toEqual(['start', 'node-1']);
      expect(breakpoint.context.output).toBeUndefined();
    });

    it('should throw error if breakpoint already exists for node', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC
      };

      manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      expect(() => {
        manager.createBreakpoint({
          executionId: 'exec-001',
          workflowId: 'wf-001',
          nodeId: 'node-1',
          config,
          context: {}
        });
      }).toThrow('Breakpoint already exists for node node-1 in execution exec-001');
    });
  });

  describe('evaluateCondition', () => {
    it('should return true when condition matches', () => {
      const context = { amount: 15000, priority: 'high' };

      const result = manager.evaluateCondition(context, {
        field: 'amount',
        operator: 'gt',
        value: 10000
      });

      expect(result).toBe(true);
    });

    it('should return false when condition does not match', () => {
      const context = { amount: 5000, priority: 'low' };

      const result = manager.evaluateCondition(context, {
        field: 'amount',
        operator: 'gt',
        value: 10000
      });

      expect(result).toBe(false);
    });

    it('should support eq operator', () => {
      const context = { status: 'pending' };

      expect(manager.evaluateCondition(context, {
        field: 'status',
        operator: 'eq',
        value: 'pending'
      })).toBe(true);

      expect(manager.evaluateCondition(context, {
        field: 'status',
        operator: 'eq',
        value: 'completed'
      })).toBe(false);
    });

    it('should support in operator', () => {
      const context = { category: 'electronics' };

      expect(manager.evaluateCondition(context, {
        field: 'category',
        operator: 'in',
        value: ['electronics', 'clothing', 'food']
      })).toBe(true);

      expect(manager.evaluateCondition(context, {
        field: 'category',
        operator: 'in',
        value: ['clothing', 'food']
      })).toBe(false);
    });

    it('should support contains operator', () => {
      const context = { tags: ['urgent', 'high-priority'] };

      expect(manager.evaluateCondition(context, {
        field: 'tags',
        operator: 'contains',
        value: 'urgent'
      })).toBe(true);

      expect(manager.evaluateCondition(context, {
        field: 'tags',
        operator: 'contains',
        value: 'low-priority'
      })).toBe(false);
    });

    it('should handle nested field paths', () => {
      const context = {
        order: {
          customer: {
            tier: 'premium'
          }
        }
      };

      expect(manager.evaluateCondition(context, {
        field: 'order.customer.tier',
        operator: 'eq',
        value: 'premium'
      })).toBe(true);
    });
  });

  describe('shouldTriggerBreakpoint', () => {
    it('should return true for static breakpoints', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC
      };

      expect(manager.shouldTriggerBreakpoint(config, {})).toBe(true);
    });

    it('should return false for disabled breakpoints', () => {
      const config: BreakpointConfig = {
        enabled: false,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC
      };

      expect(manager.shouldTriggerBreakpoint(config, {})).toBe(false);
    });

    it('should evaluate condition for dynamic breakpoints', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.DYNAMIC,
        condition: {
          field: 'amount',
          operator: 'gt',
          value: 10000
        }
      };

      expect(manager.shouldTriggerBreakpoint(config, { amount: 15000 })).toBe(true);
      expect(manager.shouldTriggerBreakpoint(config, { amount: 5000 })).toBe(false);
    });
  });

  describe('submitApproval', () => {
    let breakpoint: Breakpoint;

    beforeEach(() => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC,
        approvers: {
          users: ['user1', 'user2']
        },
        approvalMode: ApprovalMode.ANY
      };

      breakpoint = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });
    });

    it('should add approval record', () => {
      const result = manager.submitApproval(breakpoint.breakpointId, {
        approverId: 'user1',
        approverName: 'User One',
        action: 'approve',
        comment: 'Looks good'
      });

      expect(result.success).toBe(true);
      expect(result.breakpoint.approvals).toHaveLength(1);
      expect(result.breakpoint.approvals[0].approverId).toBe('user1');
      expect(result.breakpoint.approvals[0].action).toBe('approve');
    });

    it('should resolve breakpoint with ANY mode on first approval', () => {
      const result = manager.submitApproval(breakpoint.breakpointId, {
        approverId: 'user1',
        approverName: 'User One',
        action: 'approve'
      });

      expect(result.breakpoint.status).toBe(BreakpointStatus.APPROVED);
      expect(result.breakpoint.resolvedAt).toBeDefined();
    });

    it('should require all approvals for ALL mode', () => {
      breakpoint.config.approvalMode = ApprovalMode.ALL;

      let result = manager.submitApproval(breakpoint.breakpointId, {
        approverId: 'user1',
        approverName: 'User One',
        action: 'approve'
      });

      expect(result.breakpoint.status).toBe(BreakpointStatus.IN_REVIEW);

      result = manager.submitApproval(breakpoint.breakpointId, {
        approverId: 'user2',
        approverName: 'User Two',
        action: 'approve'
      });

      expect(result.breakpoint.status).toBe(BreakpointStatus.APPROVED);
    });

    it('should reject breakpoint', () => {
      const result = manager.submitApproval(breakpoint.breakpointId, {
        approverId: 'user1',
        approverName: 'User One',
        action: 'reject',
        comment: 'Not acceptable'
      });

      expect(result.breakpoint.status).toBe(BreakpointStatus.REJECTED);
    });

    it('should throw error for non-existent breakpoint', () => {
      expect(() => {
        manager.submitApproval('non-existent', {
          approverId: 'user1',
          approverName: 'User One',
          action: 'approve'
        });
      }).toThrow('Breakpoint not found: non-existent');
    });

    it('should throw error if breakpoint is already resolved', () => {
      manager.submitApproval(breakpoint.breakpointId, {
        approverId: 'user1',
        approverName: 'User One',
        action: 'approve'
      });

      expect(() => {
        manager.submitApproval(breakpoint.breakpointId, {
          approverId: 'user2',
          approverName: 'User Two',
          action: 'approve'
        });
      }).toThrow('Breakpoint is already resolved');
    });
  });

  describe('cancelBreakpoint', () => {
    it('should cancel pending breakpoint', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC
      };

      const breakpoint = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      const result = manager.cancelBreakpoint(breakpoint.breakpointId, 'user1');

      expect(result.success).toBe(true);
      expect(result.breakpoint.status).toBe(BreakpointStatus.CANCELLED);
    });

    it('should throw error for already resolved breakpoint', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC,
        approvers: { users: ['user1'] },
        approvalMode: ApprovalMode.ANY
      };

      const breakpoint = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      manager.submitApproval(breakpoint.breakpointId, {
        approverId: 'user1',
        approverName: 'User One',
        action: 'approve'
      });

      expect(() => {
        manager.cancelBreakpoint(breakpoint.breakpointId, 'user1');
      }).toThrow('Cannot cancel resolved breakpoint');
    });
  });

  describe('getPendingBreakpoints', () => {
    it('should return only pending breakpoints', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC,
        approvers: { users: ['user1'] },
        approvalMode: ApprovalMode.ANY
      };

      const bp1 = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      const bp2 = manager.createBreakpoint({
        executionId: 'exec-002',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      manager.submitApproval(bp1.breakpointId, {
        approverId: 'user1',
        approverName: 'User One',
        action: 'approve'
      });

      const pending = manager.getPendingBreakpoints();

      expect(pending).toHaveLength(1);
      expect(pending[0].breakpointId).toBe(bp2.breakpointId);
    });
  });

  describe('checkTimeout', () => {
    it('should mark expired breakpoints as timeout', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC,
        timeout: {
          duration: 1, // 1 minute
          reminderIntervals: [],
          autoAction: 'reject'
        }
      };

      const breakpoint = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      // Simulate expired breakpoint
      breakpoint.expiresAt = new Date(Date.now() - 1000);

      const expired = manager.checkTimeout();

      expect(expired).toHaveLength(1);
      expect(expired[0].status).toBe(BreakpointStatus.TIMEOUT);
    });
  });

  describe('generateEvents', () => {
    it('should generate BREAKPOINT_HIT event on creation', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC
      };

      const events = manager.getEvents();
      const initialCount = events.length;

      manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      const newEvents = manager.getEvents().slice(initialCount);

      expect(newEvents).toHaveLength(1);
      expect(newEvents[0].eventType).toBe(WorkflowEventType.BREAKPOINT_HIT);
    });

    it('should generate APPROVAL_COMPLETED event on resolution', () => {
      const config: BreakpointConfig = {
        enabled: true,
        type: BreakpointType.APPROVAL,
        mode: BreakpointTriggerMode.STATIC,
        approvers: { users: ['user1'] },
        approvalMode: ApprovalMode.ANY
      };

      const breakpoint = manager.createBreakpoint({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-1',
        config,
        context: {}
      });

      const eventsBefore = manager.getEvents().length;

      manager.submitApproval(breakpoint.breakpointId, {
        approverId: 'user1',
        approverName: 'User One',
        action: 'approve'
      });

      const newEvents = manager.getEvents().slice(eventsBefore);

      expect(newEvents.some(e => e.eventType === WorkflowEventType.APPROVAL_COMPLETED)).toBe(true);
    });
  });
});
