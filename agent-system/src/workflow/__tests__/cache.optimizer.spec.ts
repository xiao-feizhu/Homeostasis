import { CacheOptimizer } from '../monitoring/cache.optimizer';

describe('CacheOptimizer', () => {
  let optimizer: CacheOptimizer;

  beforeEach(() => {
    optimizer = new CacheOptimizer();
  });

  describe('configure', () => {
    it('should configure cache options', () => {
      optimizer.configure({
        maxSize: 1000,
        defaultTTL: 5000,
      });

      // Should not throw
      expect(() => optimizer.get('key')).not.toThrow();
    });
  });

  describe('set and get', () => {
    it('should store and retrieve value', () => {
      optimizer.set('key1', 'value1');

      const value = optimizer.get('key1');
      expect(value).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      const value = optimizer.get('non-existent');
      expect(value).toBeUndefined();
    });

    it('should store with TTL', async () => {
      optimizer.set('key1', 'value1', { ttl: 100 });

      expect(optimizer.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(optimizer.get('key1')).toBeUndefined();
    });

    it('should store with tags', () => {
      optimizer.set('key1', 'value1', { tags: ['tag1', 'tag2'] });

      const value = optimizer.get('key1');
      expect(value).toBe('value1');
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      optimizer.set('key1', 'value1');

      expect(optimizer.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(optimizer.has('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      optimizer.set('key1', 'value1', { ttl: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(optimizer.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove key', () => {
      optimizer.set('key1', 'value1');
      optimizer.delete('key1');

      expect(optimizer.get('key1')).toBeUndefined();
    });

    it('should return true if key existed', () => {
      optimizer.set('key1', 'value1');

      expect(optimizer.delete('key1')).toBe(true);
    });

    it('should return false if key did not exist', () => {
      expect(optimizer.delete('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all keys', () => {
      optimizer.set('key1', 'value1');
      optimizer.set('key2', 'value2');

      optimizer.clear();

      expect(optimizer.get('key1')).toBeUndefined();
      expect(optimizer.get('key2')).toBeUndefined();
    });
  });

  describe('clearByTag', () => {
    it('should remove keys with specific tag', () => {
      optimizer.set('key1', 'value1', { tags: ['tag1'] });
      optimizer.set('key2', 'value2', { tags: ['tag2'] });
      optimizer.set('key3', 'value3', { tags: ['tag1'] });

      optimizer.clearByTag('tag1');

      expect(optimizer.get('key1')).toBeUndefined();
      expect(optimizer.get('key2')).toBe('value2');
      expect(optimizer.get('key3')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      optimizer.set('key1', 'value1');
      optimizer.set('key2', 'value2');

      optimizer.get('key1'); // hit
      optimizer.get('key1'); // hit
      optimizer.get('non-existent'); // miss

      const stats = optimizer.getStats();

      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2 / 3);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used when max size reached', () => {
      optimizer.configure({ maxSize: 2 });

      optimizer.set('key1', 'value1');
      optimizer.set('key2', 'value2');
      optimizer.set('key3', 'value3'); // Should evict key1

      expect(optimizer.get('key1')).toBeUndefined();
      expect(optimizer.get('key2')).toBe('value2');
      expect(optimizer.get('key3')).toBe('value3');
    });

    it('should update access order on get', () => {
      optimizer.configure({ maxSize: 2 });

      optimizer.set('key1', 'value1');
      optimizer.set('key2', 'value2');

      optimizer.get('key1'); // Access key1, making key2 LRU

      optimizer.set('key3', 'value3'); // Should evict key2

      expect(optimizer.get('key1')).toBe('value1');
      expect(optimizer.get('key2')).toBeUndefined();
      expect(optimizer.get('key3')).toBe('value3');
    });
  });

  describe('computeIfAbsent', () => {
    it('should return existing value if present', () => {
      optimizer.set('key1', 'value1');

      const factory = jest.fn().mockReturnValue('computed');
      const value = optimizer.computeIfAbsent('key1', factory);

      expect(value).toBe('value1');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should compute and store value if not present', () => {
      const factory = jest.fn().mockReturnValue('computed');
      const value = optimizer.computeIfAbsent('key1', factory);

      expect(value).toBe('computed');
      expect(factory).toHaveBeenCalled();
      expect(optimizer.get('key1')).toBe('computed');
    });
  });

  describe('getOrSet', () => {
    it('should get existing value', () => {
      optimizer.set('key1', 'value1');

      const value = optimizer.getOrSet('key1', () => 'computed');

      expect(value).toBe('value1');
    });

    it('should set and return new value if not present', () => {
      const value = optimizer.getOrSet('key1', () => 'computed');

      expect(value).toBe('computed');
      expect(optimizer.get('key1')).toBe('computed');
    });

    it('should pass options when setting new value', () => {
      const value = optimizer.getOrSet('key1', () => 'computed', { ttl: 1000, tags: ['tag1'] });

      expect(value).toBe('computed');
      expect(optimizer.has('key1')).toBe(true);
    });
  });

  describe('configure', () => {
    it('should evict entries when reducing maxSize', () => {
      optimizer.configure({ maxSize: 5 });

      optimizer.set('key1', 'value1');
      optimizer.set('key2', 'value2');
      optimizer.set('key3', 'value3');

      expect(optimizer.size()).toBe(3);

      // Reduce max size to 2
      optimizer.configure({ maxSize: 2 });

      expect(optimizer.size()).toBe(2);
    });
  });

  describe('getKeysByTag', () => {
    it('should return keys with specific tag', () => {
      optimizer.set('key1', 'value1', { tags: ['tag1'] });
      optimizer.set('key2', 'value2', { tags: ['tag2'] });
      optimizer.set('key3', 'value3', { tags: ['tag1', 'tag2'] });
      optimizer.set('key4', 'value4');

      const keys = optimizer.getKeysByTag('tag1');

      expect(keys).toContain('key1');
      expect(keys).toContain('key3');
      expect(keys).not.toContain('key2');
      expect(keys).not.toContain('key4');
    });

    it('should return empty array when no keys have tag', () => {
      optimizer.set('key1', 'value1', { tags: ['tag1'] });

      const keys = optimizer.getKeysByTag('non-existent');

      expect(keys).toEqual([]);
    });
  });

  describe('keys', () => {
    it('should return all non-expired keys', async () => {
      optimizer.set('key1', 'value1');
      optimizer.set('key2', 'value2', { ttl: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      optimizer.set('key3', 'value3');

      const keys = optimizer.keys();

      expect(keys).toContain('key1');
      expect(keys).not.toContain('key2'); // expired
      expect(keys).toContain('key3');
    });
  });

  describe('values', () => {
    it('should return all non-expired values', async () => {
      optimizer.set('key1', 'value1');
      optimizer.set('key2', 'value2', { ttl: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      optimizer.set('key3', 'value3');

      const values = optimizer.values();

      expect(values).toContain('value1');
      expect(values).not.toContain('value2'); // expired
      expect(values).toContain('value3');
    });
  });

  describe('size', () => {
    it('should return count of non-expired entries', async () => {
      optimizer.set('key1', 'value1');
      optimizer.set('key2', 'value2', { ttl: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      optimizer.set('key3', 'value3');

      expect(optimizer.size()).toBe(2); // key1 and key3
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', () => {
      optimizer.set('key1', 'value1');
      optimizer.get('key1'); // hit
      optimizer.get('non-existent'); // miss

      expect(optimizer.getStats().hits).toBe(1);
      expect(optimizer.getStats().misses).toBe(1);

      optimizer.resetStats();

      expect(optimizer.getStats().hits).toBe(0);
      expect(optimizer.getStats().misses).toBe(0);
      expect(optimizer.getStats().evictions).toBe(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired entries and return count', async () => {
      optimizer.set('key1', 'value1', { ttl: 100 });
      optimizer.set('key2', 'value2', { ttl: 100 });
      optimizer.set('key3', 'value3'); // no TTL

      await new Promise(resolve => setTimeout(resolve, 150));

      const cleaned = optimizer.cleanupExpired();

      expect(cleaned).toBe(2);
      expect(optimizer.has('key1')).toBe(false);
      expect(optimizer.has('key2')).toBe(false);
      expect(optimizer.has('key3')).toBe(true);
    });

    it('should return 0 when no entries expired', () => {
      optimizer.set('key1', 'value1', { ttl: 10000 });
      optimizer.set('key2', 'value2');

      const cleaned = optimizer.cleanupExpired();

      expect(cleaned).toBe(0);
    });
  });
});
