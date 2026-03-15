import {
  DeadLetterQueue,
  DeadLetterEntry,
} from '../errors/dead.letter.queue';

describe('DeadLetterQueue', () => {
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    dlq = new DeadLetterQueue();
  });

  describe('add', () => {
    it('should add failed execution to DLQ', async () => {
      const entry: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Execution failed'),
        timestamp: new Date(),
        context: { userId: '123' },
        retryCount: 3,
      };

      const id = await dlq.add(entry);

      expect(id).toBeDefined();
      expect(await dlq.size()).toBe(1);
    });

    it('should generate unique IDs for each entry', async () => {
      const entry1: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 1'),
        timestamp: new Date(),
      };

      const entry2: DeadLetterEntry = {
        executionId: 'exec-002',
        workflowId: 'wf-001',
        nodeId: 'node-002',
        error: new Error('Error 2'),
        timestamp: new Date(),
      };

      const id1 = await dlq.add(entry1);
      const id2 = await dlq.add(entry2);

      expect(id1).not.toBe(id2);
    });

    it('should store error details correctly', async () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      const entry: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error,
        timestamp: new Date(),
        context: { data: 'test' },
        retryCount: 3,
      };

      const id = await dlq.add(entry);
      const retrieved = await dlq.get(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.error.message).toBe('Test error');
      expect(retrieved?.retryCount).toBe(3);
      expect(retrieved?.context).toEqual({ data: 'test' });
    });
  });

  describe('get', () => {
    it('should retrieve entry by ID', async () => {
      const entry: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Test error'),
        timestamp: new Date(),
      };

      const id = await dlq.add(entry);
      const retrieved = await dlq.get(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.executionId).toBe('exec-001');
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await dlq.get('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('list', () => {
    it('should return all entries', async () => {
      const entry1: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 1'),
        timestamp: new Date(),
      };

      const entry2: DeadLetterEntry = {
        executionId: 'exec-002',
        workflowId: 'wf-002',
        nodeId: 'node-002',
        error: new Error('Error 2'),
        timestamp: new Date(),
      };

      await dlq.add(entry1);
      await dlq.add(entry2);

      const entries = await dlq.list();

      expect(entries).toHaveLength(2);
    });

    it('should support pagination', async () => {
      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        await dlq.add({
          executionId: `exec-${i}`,
          workflowId: 'wf-001',
          nodeId: 'node-001',
          error: new Error(`Error ${i}`),
          timestamp: new Date(),
        });
      }

      const page1 = await dlq.list({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = await dlq.list({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = await dlq.list({ limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);
    });

    it('should filter by workflowId', async () => {
      const entry1: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 1'),
        timestamp: new Date(),
      };

      const entry2: DeadLetterEntry = {
        executionId: 'exec-002',
        workflowId: 'wf-002',
        nodeId: 'node-001',
        error: new Error('Error 2'),
        timestamp: new Date(),
      };

      await dlq.add(entry1);
      await dlq.add(entry2);

      const filtered = await dlq.list({ workflowId: 'wf-001' });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].workflowId).toBe('wf-001');
    });
  });

  describe('remove', () => {
    it('should remove entry by ID', async () => {
      const entry: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Test error'),
        timestamp: new Date(),
      };

      const id = await dlq.add(entry);
      expect(await dlq.size()).toBe(1);

      const removed = await dlq.remove(id);
      expect(removed).toBe(true);
      expect(await dlq.size()).toBe(0);
    });

    it('should return false for non-existent ID', async () => {
      const removed = await dlq.remove('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('retry', () => {
    it('should mark entry for retry', async () => {
      const entry: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Test error'),
        timestamp: new Date(),
      };

      const id = await dlq.add(entry);
      const retried = await dlq.retry(id);

      expect(retried).toBe(true);

      const retrieved = await dlq.get(id);
      expect(retrieved?.status).toBe('retrying');
    });

    it('should return false for non-existent entry', async () => {
      const retried = await dlq.retry('non-existent-id');
      expect(retried).toBe(false);
    });

    it('should call onRetry callback when provided', async () => {
      const onRetry = jest.fn();
      dlq = new DeadLetterQueue({ onRetry });

      const entry: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Test error'),
        timestamp: new Date(),
      };

      const id = await dlq.add(entry);
      await dlq.retry(id);

      expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
        executionId: 'exec-001',
      }));
    });
  });

  describe('archive', () => {
    it('should archive an entry', async () => {
      const entry: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Test error'),
        timestamp: new Date(),
      };

      const id = await dlq.add(entry);
      const archived = await dlq.archive(id);

      expect(archived).toBe(true);

      const retrieved = await dlq.get(id);
      expect(retrieved?.status).toBe('archived');
      expect(retrieved?.archivedAt).toBeInstanceOf(Date);
    });

    it('should return false for non-existent entry', async () => {
      const archived = await dlq.archive('non-existent-id');
      expect(archived).toBe(false);
    });

    it('should call onArchive callback when provided', async () => {
      const onArchive = jest.fn();
      dlq = new DeadLetterQueue({ onArchive });

      const entry: DeadLetterEntry = {
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Test error'),
        timestamp: new Date(),
      };

      const id = await dlq.add(entry);
      await dlq.archive(id);

      expect(onArchive).toHaveBeenCalledWith(expect.objectContaining({
        executionId: 'exec-001',
        status: 'archived',
      }));
    });
  });

  describe('stats', () => {
    it('should return statistics for all entries', async () => {
      // Add pending entry
      await dlq.add({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 1'),
        timestamp: new Date(),
      });

      // Add and retry another entry
      const id2 = await dlq.add({
        executionId: 'exec-002',
        workflowId: 'wf-001',
        nodeId: 'node-002',
        error: new Error('Error 2'),
        timestamp: new Date(),
      });
      await dlq.retry(id2);

      // Add and archive another entry
      const id3 = await dlq.add({
        executionId: 'exec-003',
        workflowId: 'wf-001',
        nodeId: 'node-003',
        error: new Error('Error 3'),
        timestamp: new Date(),
      });
      await dlq.archive(id3);

      const stats = await dlq.stats();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.retrying).toBe(1);
      expect(stats.archived).toBe(1);
    });

    it('should return zero stats for empty queue', async () => {
      const stats = await dlq.stats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.retrying).toBe(0);
      expect(stats.archived).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries based on retentionDays', async () => {
      dlq = new DeadLetterQueue({ retentionDays: 7 });

      // Add a recent entry
      await dlq.add({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Recent error'),
        timestamp: new Date(),
      });

      // Add an old entry (8 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      await dlq.add({
        executionId: 'exec-002',
        workflowId: 'wf-001',
        nodeId: 'node-002',
        error: new Error('Old error'),
        timestamp: oldDate,
      });

      expect(await dlq.size()).toBe(2);

      const removed = await dlq.cleanup();

      expect(removed).toBe(1);
      expect(await dlq.size()).toBe(1);

      const remaining = await dlq.list();
      expect(remaining[0].executionId).toBe('exec-001');
    });

    it('should return 0 when retentionDays is not set', async () => {
      dlq = new DeadLetterQueue({ retentionDays: 0 });

      await dlq.add({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error'),
        timestamp: new Date(Date.now() - 86400000 * 30), // 30 days ago
      });

      const removed = await dlq.cleanup();
      expect(removed).toBe(0);
    });
  });

  describe('list filtering', () => {
    it('should filter by status', async () => {
      // Add pending entry
      await dlq.add({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 1'),
        timestamp: new Date(),
      });

      // Add and retry another entry
      const id2 = await dlq.add({
        executionId: 'exec-002',
        workflowId: 'wf-001',
        nodeId: 'node-002',
        error: new Error('Error 2'),
        timestamp: new Date(),
      });
      await dlq.retry(id2);

      // Add and archive another entry
      const id3 = await dlq.add({
        executionId: 'exec-003',
        workflowId: 'wf-001',
        nodeId: 'node-003',
        error: new Error('Error 3'),
        timestamp: new Date(),
      });
      await dlq.archive(id3);

      const pending = await dlq.list({ status: 'pending' });
      expect(pending).toHaveLength(1);
      expect(pending[0].executionId).toBe('exec-001');

      const retrying = await dlq.list({ status: 'retrying' });
      expect(retrying).toHaveLength(1);
      expect(retrying[0].executionId).toBe('exec-002');

      const archived = await dlq.list({ status: 'archived' });
      expect(archived).toHaveLength(1);
      expect(archived[0].executionId).toBe('exec-003');
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await dlq.add({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 1'),
        timestamp: new Date(),
      });

      await dlq.add({
        executionId: 'exec-002',
        workflowId: 'wf-002',
        nodeId: 'node-002',
        error: new Error('Error 2'),
        timestamp: new Date(),
      });

      expect(await dlq.size()).toBe(2);

      await dlq.clear();

      expect(await dlq.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return number of entries', async () => {
      expect(await dlq.size()).toBe(0);

      await dlq.add({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 1'),
        timestamp: new Date(),
      });

      expect(await dlq.size()).toBe(1);
    });
  });

  describe('retention', () => {
    it('should respect maxSize option', async () => {
      dlq = new DeadLetterQueue({ maxSize: 2 });

      await dlq.add({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 1'),
        timestamp: new Date(),
      });

      await dlq.add({
        executionId: 'exec-002',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 2'),
        timestamp: new Date(),
      });

      await dlq.add({
        executionId: 'exec-003',
        workflowId: 'wf-001',
        nodeId: 'node-001',
        error: new Error('Error 3'),
        timestamp: new Date(),
      });

      // Oldest entry should be removed
      expect(await dlq.size()).toBe(2);
    });
  });
});
