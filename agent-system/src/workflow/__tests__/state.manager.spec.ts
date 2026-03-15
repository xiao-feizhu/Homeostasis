import { StateManager } from '../stores/state.manager';
import {
  ExecutionStatus,
  NodeExecutionStatus,
  WorkflowEventType,
  WorkflowEvent
} from '../entities/workflow-definition.entity';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('createExecution', () => {
    it('should create execution with correct initial state', () => {
      const execution = stateManager.createExecution(
        'exec-001',
        'wf-001',
        'user-001',
        { key: 'value' }
      );

      expect(execution.executionId).toBe('exec-001');
      expect(execution.workflowId).toBe('wf-001');
      expect(execution.userId).toBe('user-001');
      expect(execution.status).toBe(ExecutionStatus.PENDING);
      expect(execution.input).toEqual({ key: 'value' });
      expect(execution.nodeExecutions).toHaveLength(0);
      expect(execution.executionPath).toHaveLength(0);
    });

    it('should record EXECUTION_STARTED event', () => {
      const execution = stateManager.createExecution(
        'exec-001',
        'wf-001',
        'user-001'
      );

      // Apply an event to record it
      stateManager.applyEvent(
        execution,
        createMockEvent('exec-001', 1, WorkflowEventType.EXECUTION_STARTED, {})
      );

      const reconstructed = stateManager.reconstructState('exec-001');
      expect(reconstructed).not.toBeNull();
    });
  });

  describe('applyEvent', () => {
    it('should apply EXECUTION_STARTED event', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');
      const event = createMockEvent('exec-001', 1, WorkflowEventType.EXECUTION_STARTED, {});

      const updated = stateManager.applyEvent(execution, event);

      expect(updated.status).toBe(ExecutionStatus.RUNNING);
      expect(updated.timing.startedAt).toBeDefined();
    });

    it('should apply NODE_SCHEDULED event', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');
      const event = createMockEvent('exec-001', 1, WorkflowEventType.NODE_SCHEDULED, {
        nodeId: 'node-a'
      });

      const updated = stateManager.applyEvent(execution, event);

      expect(updated.nodeExecutions).toHaveLength(1);
      expect(updated.nodeExecutions[0].nodeId).toBe('node-a');
      expect(updated.nodeExecutions[0].status).toBe(NodeExecutionStatus.SCHEDULED);
    });

    it('should apply NODE_STARTED event', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');
      const scheduledEvent = createMockEvent('exec-001', 1, WorkflowEventType.NODE_SCHEDULED, {
        nodeId: 'node-a'
      });
      stateManager.applyEvent(execution, scheduledEvent);

      const startedEvent = createMockEvent('exec-001', 2, WorkflowEventType.NODE_STARTED, {
        nodeId: 'node-a',
        input: { data: 'test' }
      });
      const updated = stateManager.applyEvent(execution, startedEvent);

      expect(updated.nodeExecutions[0].status).toBe(NodeExecutionStatus.RUNNING);
      expect(updated.nodeExecutions[0].input).toEqual({ data: 'test' });
      expect(updated.currentNodeId).toBe('node-a');
    });

    it('should apply NODE_COMPLETED event', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      // First schedule and start the node
      stateManager.applyEvent(execution, createMockEvent('exec-001', 1, WorkflowEventType.NODE_SCHEDULED, { nodeId: 'node-a' }));
      stateManager.applyEvent(execution, createMockEvent('exec-001', 2, WorkflowEventType.NODE_STARTED, { nodeId: 'node-a' }));

      const completedEvent = createMockEvent('exec-001', 3, WorkflowEventType.NODE_COMPLETED, {
        nodeId: 'node-a',
        output: { result: 'success' }
      });
      const updated = stateManager.applyEvent(execution, completedEvent);

      expect(updated.nodeExecutions[0].status).toBe(NodeExecutionStatus.COMPLETED);
      expect(updated.nodeExecutions[0].output).toEqual({ result: 'success' });
      expect(updated.executionPath).toContain('node-a');
    });

    it('should apply NODE_FAILED event', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      stateManager.applyEvent(execution, createMockEvent('exec-001', 1, WorkflowEventType.NODE_SCHEDULED, { nodeId: 'node-a' }));
      stateManager.applyEvent(execution, createMockEvent('exec-001', 2, WorkflowEventType.NODE_STARTED, { nodeId: 'node-a' }));

      const failedEvent = createMockEvent('exec-001', 3, WorkflowEventType.NODE_FAILED, {
        nodeId: 'node-a',
        error: { code: 'ERR_001', message: 'Execution failed' }
      });
      const updated = stateManager.applyEvent(execution, failedEvent);

      expect(updated.nodeExecutions[0].status).toBe(NodeExecutionStatus.FAILED);
      expect(updated.status).toBe(ExecutionStatus.FAILED);
      expect(updated.error?.failedNodeId).toBe('node-a');
    });

    it('should apply CONTEXT_UPDATED event', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');
      const event = createMockEvent('exec-001', 1, WorkflowEventType.CONTEXT_UPDATED, {
        context: { newVar: 'value' }
      });

      const updated = stateManager.applyEvent(execution, event);

      expect(updated.context).toEqual({ newVar: 'value' });
    });

    it('should throw error when version is not sequential', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');
      stateManager.applyEvent(execution, createMockEvent('exec-001', 1, WorkflowEventType.EXECUTION_STARTED, {}));

      const invalidEvent = createMockEvent('exec-001', 3, WorkflowEventType.NODE_SCHEDULED, { nodeId: 'node-a' });

      expect(() => stateManager.applyEvent(execution, invalidEvent)).toThrow('Version mismatch');
    });
  });

  describe('reconstructState', () => {
    it('should reconstruct state from events', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      // Simulate a sequence of events
      const events: WorkflowEvent[] = [
        createMockEvent('exec-001', 1, WorkflowEventType.EXECUTION_STARTED, {}),
        createMockEvent('exec-001', 2, WorkflowEventType.NODE_SCHEDULED, { nodeId: 'node-a' }),
        createMockEvent('exec-001', 3, WorkflowEventType.NODE_STARTED, { nodeId: 'node-a' }),
        createMockEvent('exec-001', 4, WorkflowEventType.NODE_COMPLETED, { nodeId: 'node-a', output: { result: 'ok' } }),
        createMockEvent('exec-001', 5, WorkflowEventType.EXECUTION_COMPLETED, { output: { final: 'result' } })
      ];

      // Apply all events manually to the original execution
      let currentExecution = execution;
      for (const event of events) {
        currentExecution = stateManager.applyEvent(currentExecution, event);
      }

      const reconstructed = stateManager.reconstructState('exec-001');

      expect(reconstructed).not.toBeNull();
      expect(reconstructed?.status).toBe(ExecutionStatus.COMPLETED);
      expect(reconstructed?.nodeExecutions).toHaveLength(1);
      expect(reconstructed?.executionPath).toContain('node-a');
    });

    it('should return null for non-existent execution', () => {
      const result = stateManager.reconstructState('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('createSnapshot and restoreFromSnapshot', () => {
    it('should create snapshot and restore from it', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      // Apply some events
      stateManager.applyEvent(execution, createMockEvent('exec-001', 1, WorkflowEventType.EXECUTION_STARTED, {}));
      stateManager.applyEvent(execution, createMockEvent('exec-001', 2, WorkflowEventType.NODE_SCHEDULED, { nodeId: 'node-a' }));

      // Create snapshot
      const snapshot = stateManager.createSnapshot('exec-001');
      expect(snapshot.version).toBe(2);
      expect(snapshot.state.status).toBe(ExecutionStatus.RUNNING);

      // Apply more events
      stateManager.applyEvent(execution, createMockEvent('exec-001', 3, WorkflowEventType.NODE_STARTED, { nodeId: 'node-a' }));
      stateManager.applyEvent(execution, createMockEvent('exec-001', 4, WorkflowEventType.NODE_COMPLETED, { nodeId: 'node-a' }));

      // Restore from snapshot
      const restored = stateManager.restoreFromSnapshot('exec-001');
      expect(restored).not.toBeNull();
      expect(restored?.nodeExecutions[0].status).toBe(NodeExecutionStatus.COMPLETED);
    });

    it('should restore to specific version', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      // Apply events 1-3 and create snapshot at version 3
      for (let i = 1; i <= 3; i++) {
        stateManager.applyEvent(execution, createMockEvent('exec-001', i, WorkflowEventType.NODE_SCHEDULED, { nodeId: `node-${i}` }));
      }

      // Create snapshot at version 3
      stateManager.createSnapshot('exec-001');

      // Apply more events (4-6)
      for (let i = 4; i <= 6; i++) {
        stateManager.applyEvent(execution, createMockEvent('exec-001', i, WorkflowEventType.NODE_STARTED, { nodeId: `node-${i - 3}` }));
      }

      // Restore to version 3
      const restored = stateManager.restoreFromSnapshot('exec-001', 3);
      expect(restored?.nodeExecutions).toHaveLength(3);
    });
  });

  describe('updateNodeStatus', () => {
    it('should create SCHEDULED event', () => {
      stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      const event = stateManager.updateNodeStatus(
        'exec-001',
        'node-a',
        NodeExecutionStatus.SCHEDULED
      );

      expect(event.eventType).toBe(WorkflowEventType.NODE_SCHEDULED);
      expect(event.payload.nodeId).toBe('node-a');
    });

    it('should create COMPLETED event with output', () => {
      stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      const event = stateManager.updateNodeStatus(
        'exec-001',
        'node-a',
        NodeExecutionStatus.COMPLETED,
        { output: { result: 'success' } }
      );

      expect(event.eventType).toBe(WorkflowEventType.NODE_COMPLETED);
      expect(event.payload.output).toEqual({ result: 'success' });
    });
  });

  describe('getNodeExecution', () => {
    it('should return node execution if exists', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      // Schedule a node
      stateManager.applyEvent(
        execution,
        createMockEvent('exec-001', 1, WorkflowEventType.NODE_SCHEDULED, { nodeId: 'node-a' })
      );

      const nodeExecution = stateManager.getNodeExecution(
        stateManager.reconstructState('exec-001')!,
        'node-a'
      );

      expect(nodeExecution).not.toBeUndefined();
      expect(nodeExecution?.nodeId).toBe('node-a');
    });

    it('should return undefined for non-existent node', () => {
      const execution = stateManager.createExecution('exec-001', 'wf-001', 'user-001');

      const nodeExecution = stateManager.getNodeExecution(execution, 'non-existent');

      expect(nodeExecution).toBeUndefined();
    });
  });
});

// Helper function
function createMockEvent(
  executionId: string,
  version: number,
  eventType: WorkflowEventType,
  payload: any
): WorkflowEvent {
  return {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    executionId,
    workflowId: 'wf-001',
    timestamp: new Date(),
    version,
    payload,
    metadata: {
      correlationId: executionId,
      userId: 'user-001'
    }
  };
}
