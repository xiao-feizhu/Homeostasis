import { InMemoryCacheService, CachedRepository } from '../repositories/cache.service';

describe('CacheService', () => {
  let cache: InMemoryCacheService;

  beforeEach(() => {
    cache = new InMemoryCacheService();
  });

  describe('set and get', () => {
    it('should store and retrieve value', async () => {
      await cache.set('key1', { data: 'value1' });
      const result = await cache.get('key1');
      expect(result).toEqual({ data: 'value1' });
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should expire value after TTL', async () => {
      await cache.set('key1', 'value1', { ttl: 0.01 }); // 10ms

      expect(await cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20));

      const result = await cache.get('key1');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete value', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');

      const result = await cache.get('key1');
      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.exists('key1')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await cache.exists('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      await cache.set('key1', 'value1', { ttl: 0.01 });
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(await cache.exists('key1')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('getMany and setMany', () => {
    it('should get multiple values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const results = await cache.getMany(['key1', 'key2', 'key3']);

      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
      expect(results.has('key3')).toBe(false);
    });

    it('should set multiple values', async () => {
      const entries = new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
      ]);

      await cache.setMany(entries);

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      await cache.set('key1', 'value1', { ttl: 0.01 });
      await cache.set('key2', 'value2'); // No TTL

      await new Promise(resolve => setTimeout(resolve, 20));

      cache.cleanup();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBe('value2');
    });
  });
});

describe('CachedRepository', () => {
  let cache: InMemoryCacheService;
  let mockRepository: any;
  let cachedRepo: CachedRepository<any>;

  beforeEach(() => {
    cache = new InMemoryCacheService();
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn()
    };
    cachedRepo = new CachedRepository(mockRepository, cache, 'test', 60);
  });

  describe('findById', () => {
    it('should return cached value if available', async () => {
      await cache.set('test:entity-1', { id: 'entity-1', name: 'Cached' });

      const result = await cachedRepo.findById('entity-1');

      expect(result).toEqual({ id: 'entity-1', name: 'Cached' });
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from repository if not cached', async () => {
      mockRepository.findById.mockResolvedValue({ id: 'entity-1', name: 'Fresh' });

      const result = await cachedRepo.findById('entity-1');

      expect(result).toEqual({ id: 'entity-1', name: 'Fresh' });
      expect(mockRepository.findById).toHaveBeenCalledWith('entity-1');
    });

    it('should cache value after fetching from repository', async () => {
      mockRepository.findById.mockResolvedValue({ id: 'entity-1', name: 'Fresh' });

      await cachedRepo.findById('entity-1');
      const cached = await cache.get('test:entity-1');

      expect(cached).toEqual({ id: 'entity-1', name: 'Fresh' });
    });
  });

  describe('save', () => {
    it('should save and invalidate cache', async () => {
      await cache.set('test:entity-1', { id: 'entity-1', name: 'Old' });
      mockRepository.save.mockResolvedValue({ success: true });

      await cachedRepo.save({ id: 'entity-1', name: 'New' });

      const cached = await cache.get('test:entity-1');
      expect(cached).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete and invalidate cache', async () => {
      await cache.set('test:entity-1', { id: 'entity-1', name: 'Cached' });
      mockRepository.delete.mockResolvedValue({ success: true });

      await cachedRepo.delete('entity-1');

      const cached = await cache.get('test:entity-1');
      expect(cached).toBeNull();
    });
  });
});
