/**
 * 缓存优化器
 *
 * 提供高效的LRU缓存实现，支持TTL和标签管理
 */

export interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
  tags: string[];
  accessedAt: number;
}

export interface SetOptions {
  ttl?: number;
  tags?: string[];
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * 缓存优化器
 *
 * 基于LRU (Least Recently Used) 算法的缓存实现
 */
export class CacheOptimizer {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private options: CacheOptions = {
    maxSize: 1000,
    defaultTTL: 60000,
  };
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  /**
   * 配置缓存选项
   */
  configure(options: CacheOptions): void {
    this.options = { ...this.options, ...options };

    // 如果新的大小限制小于当前大小，执行清理
    if (options.maxSize && this.cache.size > options.maxSize) {
      this.evictToSize(options.maxSize);
    }
  }

  /**
   * 设置缓存值
   */
  set<T>(key: string, value: T, options?: SetOptions): void {
    const ttl = options?.ttl ?? this.options.defaultTTL ?? 0;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttl && ttl > 0 ? now + ttl : undefined,
      tags: options?.tags ?? [],
      accessedAt: now,
    };

    // 如果达到最大大小，先清理
    if (this.cache.size >= (this.options.maxSize ?? 1000) && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  /**
   * 获取缓存值
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // 检查是否过期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // 更新访问时间并移动到最新位置（LRU）
    entry.accessedAt = Date.now();
    this.stats.hits++;

    // 删除并重新插入以更新Map顺序（将此项移到最后/最新位置）
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 根据标签清理缓存
   */
  clearByTag(tag: string): void {
    for (const [key, entry] of this.cache) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 根据标签获取所有键
   */
  getKeysByTag(tag: string): string[] {
    const keys: string[] = [];
    for (const [key, entry] of this.cache) {
      if (entry.tags.includes(tag)) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize ?? 1000,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
    };
  }

  /**
   * 如果不存在则计算并设置
   */
  computeIfAbsent<T>(key: string, factory: () => T): T {
    const existing = this.get<T>(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = factory();
    this.set(key, value);
    return value;
  }

  /**
   * 获取或设置值
   */
  getOrSet<T>(key: string, factory: () => T, options?: SetOptions): T {
    const existing = this.get<T>(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = factory();
    this.set(key, value, options);
    return value;
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    this.cleanupExpired();
    return Array.from(this.cache.keys());
  }

  /**
   * 获取所有值
   */
  values<T>(): T[] {
    this.cleanupExpired();
    return Array.from(this.cache.values()).map(e => e.value);
  }

  /**
   * 获取缓存项数量
   */
  size(): number {
    this.cleanupExpired();
    return this.cache.size;
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * 清理过期项
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 执行LRU清理 - 驱逐第一个条目（最久未访问的）
   * 由于get()会将访问的条目移到最后，第一个条目就是最久未访问的
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;

    // Map保持插入顺序，get()会将访问的条目移到最后
    // 因此第一个条目就是最久未访问的（LRU）
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  /**
   * 清理到指定大小
   */
  private evictToSize(targetSize: number): void {
    while (this.cache.size > targetSize) {
      this.evictLRU();
    }
  }
}
