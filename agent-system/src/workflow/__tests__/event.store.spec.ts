import {
  InMemoryEventStore,
  InMemorySnapshotStore
} from '../repositories/event.store';
import { WorkflowEvent, WorkflowEventType } from '../entities/workflow-definition.entity';

describe('EventStore', () => {
  let eventStore: InMemoryEventStore;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
  });

  const createMockEvent = (
    executionId: string,
    version: number,
    overrides: Partial<WorkflowEvent> = {}
  ): WorkflowEvent => ({
    eventId: `evt-${version}`,
    eventType: WorkflowEventType.NODE_COMPLETED,
    executionId,
    workflowId: 'wf-001',
    timestamp: new Date(),
    version,
    payload: {},
    metadata: { correlationId: 'corr-001' },
    ...overrides
  });

  describe('append', () => {
    it('should append single event', async () => {
      const event = createMockEvent('exec-001', 1);
      await eventStore.append(event);

      const events = await eventStore.getAllEvents('exec-001');
      expect(events).toHaveLength(1);
      expect(events[0].version).toBe(1);
    });

    it('should append multiple events to same execution', async () => {
      await eventStore.append(createMockEvent('exec-001', 1));
      await eventStore.append(createMockEvent('exec-001', 2));

      const events = await eventStore.getAllEvents('exec-001');
      expect(events).toHaveLength(2);
    });
  });

  describe('appendMany', () => {
    it('should append multiple events at once', async () => {
      const events = [
        createMockEvent('exec-001', 1),
        createMockEvent('exec-001', 2),
        createMockEvent('exec-001', 3)
      ];

      await eventStore.appendMany(events);

      const stored = await eventStore.getAllEvents('exec-001');
      expect(stored).toHaveLength(3);
    });
  });

  describe('getEvents', () => {
    it('should get events from specific version', async () => {
      for (let i = 1; i <= 5; i++) {
        await eventStore.append(createMockEvent('exec-001', i));
      }

      const events = await eventStore.getEvents('exec-001', 2);

      expect(events).toHaveLength(3); // versions 3, 4, 5
      expect(events[0].version).toBe(3);
      expect(events[2].version).toBe(5);
    });

    it('should return empty array if no events after version', async () => {
      await eventStore.append(createMockEvent('exec-001', 1));

      const events = await eventStore.getEvents('exec-001', 1);

      expect(events).toHaveLength(0);
    });
  });

  describe('getAllEvents', () => {
    it('should return all events sorted by version', async () => {
      // Append out of order
      await eventStore.append(createMockEvent('exec-001', 3));
      await eventStore.append(createMockEvent('exec-001', 1));
      await eventStore.append(createMockEvent('exec-001', 2));

      const events = await eventStore.getAllEvents('exec-001');

      expect(events[0].version).toBe(1);
      expect(events[1].version).toBe(2);
      expect(events[2].version).toBe(3);
    });
  });

  describe('getLatestVersion', () => {
    it('should return latest version', async () => {
      await eventStore.append(createMockEvent('exec-001', 1));
      await eventStore.append(createMockEvent('exec-001', 5));
      await eventStore.append(createMockEvent('exec-001', 3));

      const version = await eventStore.getLatestVersion('exec-001');

      expect(version).toBe(5);
    });

    it('should return 0 for non-existent execution', async () => {
      const version = await eventStore.getLatestVersion('exec-999');

      expect(version).toBe(0);
    });
  });
});

describe('SnapshotStore', () => {
  let snapshotStore: InMemorySnapshotStore;

  beforeEach(() => {
    snapshotStore = new InMemorySnapshotStore();
  });

  describe('save and getLatest', () => {
    it('should save and retrieve latest snapshot', async () => {
      await snapshotStore.save('exec-001', {
        version: 1,
        state: { data: 'v1' },
        timestamp: new Date()
      });

      await snapshotStore.save('exec-001', {
        version: 3,
        state: { data: 'v3' },
        timestamp: new Date()
      });

      const latest = await snapshotStore.getLatest('exec-001');

      expect(latest?.version).toBe(3);
      expect(latest?.state.data).toBe('v3');
    });

    it('should return null for non-existent execution', async () => {
      const latest = await snapshotStore.getLatest('exec-999');
      expect(latest).toBeNull();
    });
  });

  describe('getAtVersion', () => {
    it('should return snapshot at or before version', async () => {
      await snapshotStore.save('exec-001', {
        version: 5,
        state: { data: 'v5' },
        timestamp: new Date()
      });

      await snapshotStore.save('exec-001', {
        version: 10,
        state: { data: 'v10' },
        timestamp: new Date()
      });

      const snapshot = await snapshotStore.getAtVersion('exec-001', 8);

      expect(snapshot?.version).toBe(5);
    });

    it('should return null if no snapshot before version', async () => {
      await snapshotStore.save('exec-001', {
        version: 10,
        state: { data: 'v10' },
        timestamp: new Date()
      });

      const snapshot = await snapshotStore.getAtVersion('exec-001', 5);

      expect(snapshot).toBeNull();
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete snapshots older than version', async () => {
      for (let i = 1; i <= 5; i++) {
        await snapshotStore.save('exec-001', {
          version: i,
          state: { version: i },
          timestamp: new Date()
        });
      }

      await snapshotStore.deleteOlderThan('exec-001', 3);

      const latest = await snapshotStore.getLatest('exec-001');
      expect(latest?.version).toBe(5);

      const atVersion2 = await snapshotStore.getAtVersion('exec-001', 2);
      expect(atVersion2).toBeNull();
    });
  });
});
