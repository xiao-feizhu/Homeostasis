/**
 * 缓存服务接口
 * 支持多种缓存后端 (Redis, Memory)
 */

export interface CacheServiceOptions {
  ttl?: number; // Time to live in seconds
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheServiceOptions): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getMany<T>(keys: string[]): Promise<Map<string, T>>;
  setMany<T>(entries: Map<string, T>, options?: CacheServiceOptions): Promise<void>;
}

export class InMemoryCacheService implements CacheService {
  private cache: Map<string, { value: any; expiresAt?: number }> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheServiceOptions): Promise<void> {
    const expiresAt = options?.ttl
      ? Date.now() + options.ttl * 1000
      : undefined;

    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }

    return results;
  }

  async setMany<T>(
    entries: Map<string, T>,
    options?: CacheServiceOptions
  ): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, options);
    }
  }

  /**
   * 清理过期条目 (用于定时任务)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * 带缓存装饰器的存储库
 */
export class CachedRepository<T> {
  constructor(
    private repository: any,
    private cache: CacheService,
    private keyPrefix: string,
    private defaultTTL: number = 300 // 5 minutes
  ) {}

  private cacheKey(id: string): string {
    return `${this.keyPrefix}:${id}`;
  }

  async findById(id: string): Promise<T | null> {
    const key = this.cacheKey(id);

    // Try cache first
    const cached = await this.cache.get<T>(key);
    if (cached) {
      return cached;
    }

    // Fall back to repository
    const entity = await this.repository.findById(id);
    if (entity) {
      await this.cache.set(key, entity, { ttl: this.defaultTTL });
    }

    return entity;
  }

  async save(entity: any & { id?: string }): Promise<any> {
    const result = await this.repository.save(entity);

    // Invalidate cache
    if (entity.id) {
      await this.cache.delete(this.cacheKey(entity.id));
    }

    return result;
  }

  async delete(id: string): Promise<any> {
    const result = await this.repository.delete(id);

    // Invalidate cache
    await this.cache.delete(this.cacheKey(id));

    return result;
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}
