/**
 * 死信队列 (Dead Letter Queue)
 *
 * 存储重试耗尽的任务，支持手动重新触发
 */

export interface DeadLetterEntry {
  id?: string;
  executionId: string;
  workflowId: string;
  nodeId: string;
  error: Error;
  timestamp: Date;
  context?: Record<string, any>;
  retryCount?: number;
  status?: 'pending' | 'retrying' | 'archived';
  archivedAt?: Date;
}

export interface DLQOptions {
  maxSize?: number;
  retentionDays?: number;
  onRetry?: (entry: DeadLetterEntry) => void;
  onArchive?: (entry: DeadLetterEntry) => void;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  workflowId?: string;
  status?: DeadLetterEntry['status'];
}

/**
 * 死信队列
 */
export class DeadLetterQueue {
  private entries: Map<string, DeadLetterEntry> = new Map();
  private options: DLQOptions;

  constructor(options: DLQOptions = {}) {
    this.options = {
      maxSize: 10000,
      retentionDays: 30,
      ...options,
    };
  }

  /**
   * 添加条目到死信队列
   */
  async add(entry: DeadLetterEntry): Promise<string> {
    const id = this.generateId();

    const entryWithDefaults: DeadLetterEntry = {
      ...entry,
      id,
      status: 'pending',
      retryCount: entry.retryCount ?? 0,
    };

    // 检查容量限制
    if (this.options.maxSize && this.entries.size >= this.options.maxSize) {
      // 移除最旧的条目
      const oldestId = this.findOldestEntryId();
      if (oldestId) {
        this.entries.delete(oldestId);
      }
    }

    this.entries.set(id, entryWithDefaults);

    return id;
  }

  /**
   * 获取条目
   */
  async get(id: string): Promise<DeadLetterEntry | null> {
    const entry = this.entries.get(id);
    return entry ? { ...entry } : null;
  }

  /**
   * 列出条目
   */
  async list(options: ListOptions = {}): Promise<DeadLetterEntry[]> {
    let entries = Array.from(this.entries.values());

    // 过滤
    if (options.workflowId) {
      entries = entries.filter(e => e.workflowId === options.workflowId);
    }

    if (options.status) {
      entries = entries.filter(e => e.status === options.status);
    }

    // 按时间排序（最新的在前）
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 分页
    const offset = options.offset ?? 0;
    const limit = options.limit ?? entries.length;

    return entries.slice(offset, offset + limit);
  }

  /**
   * 移除条目
   */
  async remove(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  /**
   * 标记条目为重试状态
   */
  async retry(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    entry.status = 'retrying';

    if (this.options.onRetry) {
      this.options.onRetry({ ...entry });
    }

    return true;
  }

  /**
   * 归档条目
   */
  async archive(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    entry.status = 'archived';
    entry.archivedAt = new Date();

    if (this.options.onArchive) {
      this.options.onArchive({ ...entry });
    }

    return true;
  }

  /**
   * 清空队列
   */
  async clear(): Promise<void> {
    this.entries.clear();
  }

  /**
   * 获取队列大小
   */
  async size(): Promise<number> {
    return this.entries.size;
  }

  /**
   * 清理过期条目
   */
  async cleanup(): Promise<number> {
    if (!this.options.retentionDays) {
      return 0;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.options.retentionDays);

    let count = 0;
    for (const [id, entry] of this.entries) {
      if (entry.timestamp < cutoff) {
        this.entries.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * 获取统计信息
   */
  async stats(): Promise<{
    total: number;
    pending: number;
    retrying: number;
    archived: number;
  }> {
    const entries = Array.from(this.entries.values());

    return {
      total: entries.length,
      pending: entries.filter(e => e.status === 'pending').length,
      retrying: entries.filter(e => e.status === 'retrying').length,
      archived: entries.filter(e => e.status === 'archived').length,
    };
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `dlq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 找到最旧的条目ID
   */
  private findOldestEntryId(): string | null {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.entries) {
      const time = entry.timestamp.getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }

    return oldestId;
  }
}
