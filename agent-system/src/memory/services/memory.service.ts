/**
 * 记忆服务
 * 核心记忆管理逻辑
 * Licensed under Apache 2.0 - Inspired by memU architecture
 */

import {
  MemoryItem,
  MemoryCategory,
  MemoryType,
  MemoryQuery,
  MemoryStats,
  MemoryRetrievalResult,
  computeContentHash,
  UserMemoryProfile,
} from '../entities/memory.entity';
import { IMemoryRepository } from '../repositories/memory.repository';

export interface MemoryServiceConfig {
  enableDeduplication: boolean;
  enableReinforcement: boolean;
  defaultCategories: string[];
  maxContextMemories: number;
  similarityThreshold: number;
}

/**
 * 记忆服务
 * 提供记忆存储、检索、强化等核心功能
 */
export class MemoryService {
  private config: MemoryServiceConfig;

  constructor(
    private repository: IMemoryRepository,
    config?: Partial<MemoryServiceConfig>
  ) {
    this.config = {
      enableDeduplication: true,
      enableReinforcement: true,
      defaultCategories: ['general', 'preferences', 'events'],
      maxContextMemories: 10,
      similarityThreshold: 0.8,
      ...config,
    };
  }

  /**
   * 初始化默认分类
   */
  async initialize(): Promise<void> {
    for (const categoryName of this.config.defaultCategories) {
      const existing = await this.repository.getCategoryByName(categoryName);
      if (!existing) {
        await this.repository.createCategory({
          name: categoryName,
          description: `Default category for ${categoryName}`,
          parentId: undefined,
          summary: undefined,
        });
      }
    }
  }

  /**
   * 保存记忆
   * 自动去重和分类
   */
  async memorize(
    content: string,
    summary: string,
    memoryType: MemoryType,
    options: {
      categoryNames?: string[];
      happenedAt?: Date;
      extra?: Record<string, unknown>;
      resourceUrl?: string;
    } = {}
  ): Promise<MemoryItem> {
    const { categoryNames = ['general'], happenedAt, extra = {} } = options;

    // 计算内容哈希（用于去重）
    const contentHash = computeContentHash(summary, memoryType);

    // 检查重复（如果启用）
    if (this.config.enableDeduplication) {
      const existing = await this.findByContentHash(contentHash);
      if (existing) {
        // 强化已有记忆
        if (this.config.enableReinforcement) {
          await this.repository.reinforceItem(existing.id);
        }
        return existing;
      }
    }

    // 获取或创建分类
    const categoryIds: string[] = [];
    for (const name of categoryNames) {
      let category = await this.repository.getCategoryByName(name);
      if (!category) {
        category = await this.repository.createCategory({
          name,
          description: `Category for ${name}`,
        });
      }
      categoryIds.push(category.id);
    }

    // 创建资源（如果提供了URL）
    let resourceId: string | undefined;
    if (options.resourceUrl) {
      const resource = await this.repository.createResource({
        url: options.resourceUrl,
        modality: 'text',
        localPath: undefined,
        caption: summary,
        embedding: undefined,
        metadata: {},
      });
      resourceId = resource.id;
    }

    // 创建记忆项
    const item = await this.repository.createItem({
      resourceId,
      categoryIds,
      memoryType,
      summary,
      content,
      embedding: undefined, // TODO: 计算向量嵌入
      happenedAt,
      contentHash,
      reinforcementCount: 1,
      extra,
    });

    return item;
  }

  /**
   * 检索记忆
   */
  async retrieve(query: MemoryQuery): Promise<MemoryRetrievalResult[]> {
    const { items } = await this.repository.listItems(query);

    return items.map(item => ({
      item,
      score: 1.0, // 基础分数
    }));
  }

  /**
   * 语义搜索
   */
  async semanticSearch(embedding: number[], limit = 10): Promise<MemoryRetrievalResult[]> {
    const items = await this.repository.searchByEmbedding(
      embedding,
      this.config.similarityThreshold,
      limit
    );

    return items.map(item => ({
      item,
      score: 0.9, // 语义匹配基础分数
    }));
  }

  /**
   * 获取相关记忆（上下文构建）
   */
  async getRelevantContext(
    query: string,
    _userId: string,
    options: {
      maxItems?: number;
      memoryTypes?: MemoryType[];
    } = {}
  ): Promise<MemoryItem[]> {
    const { maxItems = this.config.maxContextMemories, memoryTypes } = options;

    // 关键词搜索
    const keywords = query.split(/\s+/).filter(w => w.length > 2);
    let results: MemoryItem[] = [];

    if (keywords.length > 0) {
      results = await this.repository.searchByKeywords(keywords, maxItems * 2);
    }

    // 过滤类型
    if (memoryTypes?.length) {
      results = results.filter(item => memoryTypes.includes(item.memoryType));
    }

    // 强化次数排序
    results.sort((a, b) => {
      const scoreA = a.reinforcementCount * 0.3 + (a.lastReinforcedAt ? 1 : 0) * 0.7;
      const scoreB = b.reinforcementCount * 0.3 + (b.lastReinforcedAt ? 1 : 0) * 0.7;
      return scoreB - scoreA;
    });

    return results.slice(0, maxItems);
  }

  /**
   * 获取用户记忆画像
   */
  async buildUserProfile(userId: string): Promise<UserMemoryProfile> {
    // 获取用户的所有记忆
    const { items } = await this.repository.listItems({ limit: 1000 });

    // 筛选关键事实
    const keyFacts = items
      .filter(i => i.memoryType === 'profile' || i.reinforcementCount > 2)
      .slice(0, 20);

    // 提取偏好
    const preferences: Record<string, unknown> = {};
    for (const item of items.filter(i => i.memoryType === 'preference')) {
      Object.assign(preferences, item.extra);
    }

    // 行为模式
    const behaviorPatterns = items
      .filter(i => i.memoryType === 'behavior')
      .map(i => i.summary)
      .slice(0, 10);

    // 生成画像摘要
    const summary = this.generateProfileSummary(keyFacts, preferences);

    return {
      userId,
      summary,
      keyFacts,
      preferences,
      behaviorPatterns,
      lastUpdated: new Date(),
    };
  }

  /**
   * 强化记忆（用户确认或重复提及）
   */
  async reinforce(itemId: string): Promise<void> {
    await this.repository.reinforceItem(itemId);
  }

  /**
   * 创建分类
   */
  async createCategory(
    name: string,
    description: string,
    parentId?: string
  ): Promise<MemoryCategory> {
    const existing = await this.repository.getCategoryByName(name);
    if (existing) {
      throw new Error(`Category '${name}' already exists`);
    }

    return this.repository.createCategory({
      name,
      description,
      parentId,
      summary: undefined,
    });
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<MemoryStats> {
    return this.repository.getStats();
  }

  /**
   * 删除记忆
   */
  async forget(itemId: string): Promise<boolean> {
    return this.repository.deleteItem(itemId);
  }

  /**
   * 关联两个记忆
   */
  async linkMemories(
    sourceId: string,
    targetId: string,
    relationType: string,
    strength?: number
  ): Promise<void> {
    await this.repository.createReference(sourceId, targetId, relationType, strength);
  }

  /**
   * 通过内容哈希查找记忆
   */
  private async findByContentHash(contentHash: string): Promise<MemoryItem | null> {
    const { items } = await this.repository.listItems({ limit: 1000 });
    return items.find(i => i.contentHash === contentHash) || null;
  }

  /**
   * 生成画像摘要
   */
  private generateProfileSummary(
    keyFacts: MemoryItem[],
    preferences: Record<string, unknown>
  ): string {
    const parts: string[] = [];

    if (keyFacts.length > 0) {
      parts.push(`Key facts: ${keyFacts.slice(0, 3).map(f => f.summary).join(', ')}`);
    }

    const prefKeys = Object.keys(preferences);
    if (prefKeys.length > 0) {
      parts.push(`Preferences: ${prefKeys.slice(0, 3).join(', ')}`);
    }

    return parts.join('; ') || 'New user, building profile...';
  }
}
