/**
 * 记忆存储仓库接口
 *
 * 基于 "Memory as File System" 理念的分层存储
 * Licensed under Apache 2.0
 */

import {
  MemoryItem,
  MemoryCategory,
  Resource,
  MemoryReference,
  MemoryQuery,
  MemoryStats,
} from '../entities/memory.entity';

/**
 * 记忆存储仓库接口
 * 支持多种后端实现 (内存、PostgreSQL、SQLite)
 */
export interface IMemoryRepository {
  // ========== MemoryItem CRUD ==========
  createItem(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem>;
  getItem(id: string): Promise<MemoryItem | null>;
  updateItem(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem | null>;
  deleteItem(id: string): Promise<boolean>;
  listItems(query: MemoryQuery): Promise<{ items: MemoryItem[]; total: number }>;

  // ========== MemoryCategory CRUD ==========
  createCategory(category: Omit<MemoryCategory, 'id' | 'createdAt' | 'updatedAt' | 'itemCount'>): Promise<MemoryCategory>;
  getCategory(id: string): Promise<MemoryCategory | null>;
  getCategoryByName(name: string): Promise<MemoryCategory | null>;
  updateCategory(id: string, updates: Partial<MemoryCategory>): Promise<MemoryCategory | null>;
  deleteCategory(id: string): Promise<boolean>;
  listCategories(parentId?: string): Promise<MemoryCategory[]>;

  // ========== Resource CRUD ==========
  createResource(resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource>;
  getResource(id: string): Promise<Resource | null>;
  deleteResource(id: string): Promise<boolean>;

  // ========== Category-Item Association ==========
  addItemToCategory(itemId: string, categoryId: string): Promise<void>;
  removeItemFromCategory(itemId: string, categoryId: string): Promise<void>;
  getItemsByCategory(categoryId: string, limit?: number): Promise<MemoryItem[]>;

  // ========== Cross References ==========
  createReference(sourceId: string, targetId: string, relationType: string, strength?: number): Promise<MemoryReference>;
  getReferences(itemId: string): Promise<MemoryReference[]>;
  deleteReference(id: string): Promise<boolean>;

  // ========== Semantic Search ==========
  searchByEmbedding(embedding: number[], threshold: number, limit: number): Promise<MemoryItem[]>;
  searchByKeywords(keywords: string[], limit: number): Promise<MemoryItem[]>;

  // ========== Statistics ==========
  getStats(): Promise<MemoryStats>;

  // ========== Reinforcement ==========
  reinforceItem(itemId: string): Promise<void>;
  getReinforcedItems(limit: number): Promise<MemoryItem[]>;

  // ========== Cleanup ==========
  close(): Promise<void>;
}

/**
 * 内存存储实现 (用于开发和测试)
 */
export class InMemoryMemoryRepository implements IMemoryRepository {
  private items: Map<string, MemoryItem> = new Map();
  private categories: Map<string, MemoryCategory> = new Map();
  private resources: Map<string, Resource> = new Map();
  private categoryItems: Map<string, Set<string>> = new Map(); // categoryId -> itemIds
  private references: Map<string, MemoryReference> = new Map();

  // ========== MemoryItem CRUD ==========
  async createItem(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem> {
    const newItem: MemoryItem = {
      ...item,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.set(newItem.id, newItem);

    // 更新分类的 itemCount
    for (const categoryId of item.categoryIds) {
      await this.addItemToCategory(newItem.id, categoryId);
    }

    return newItem;
  }

  async getItem(id: string): Promise<MemoryItem | null> {
    return this.items.get(id) || null;
  }

  async updateItem(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    const updated = { ...item, ...updates, updatedAt: new Date() };
    this.items.set(id, updated);
    return updated;
  }

  async deleteItem(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;

    // 从分类中移除
    for (const categoryId of item.categoryIds) {
      const itemSet = this.categoryItems.get(categoryId);
      if (itemSet) {
        itemSet.delete(id);
        // 更新分类计数
        const category = this.categories.get(categoryId);
        if (category) {
          category.itemCount = itemSet.size;
        }
      }
    }

    this.items.delete(id);
    return true;
  }

  async listItems(query: MemoryQuery): Promise<{ items: MemoryItem[]; total: number }> {
    let items = Array.from(this.items.values());

    // 过滤
    if (query.memoryTypes?.length) {
      items = items.filter(i => query.memoryTypes!.includes(i.memoryType));
    }
    if (query.categoryIds?.length) {
      items = items.filter(i => i.categoryIds.some(cid => query.categoryIds!.includes(cid)));
    }
    if (query.happenedAfter) {
      items = items.filter(i => i.happenedAt && i.happenedAt >= query.happenedAfter!);
    }
    if (query.happenedBefore) {
      items = items.filter(i => i.happenedAt && i.happenedAt <= query.happenedBefore!);
    }
    if (query.keywords?.length) {
      items = items.filter(i =>
        query.keywords!.some(kw =>
          i.summary.toLowerCase().includes(kw.toLowerCase()) ||
          i.content.toLowerCase().includes(kw.toLowerCase())
        )
      );
    }

    // 排序（按更新时间倒序）
    items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const total = items.length;

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  // ========== MemoryCategory CRUD ==========
  async createCategory(
    category: Omit<MemoryCategory, 'id' | 'createdAt' | 'updatedAt' | 'itemCount'>
  ): Promise<MemoryCategory> {
    const newCategory: MemoryCategory = {
      ...category,
      id: this.generateId(),
      itemCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.categories.set(newCategory.id, newCategory);
    this.categoryItems.set(newCategory.id, new Set());
    return newCategory;
  }

  async getCategory(id: string): Promise<MemoryCategory | null> {
    return this.categories.get(id) || null;
  }

  async getCategoryByName(name: string): Promise<MemoryCategory | null> {
    return Array.from(this.categories.values()).find(c => c.name === name) || null;
  }

  async updateCategory(id: string, updates: Partial<MemoryCategory>): Promise<MemoryCategory | null> {
    const category = this.categories.get(id);
    if (!category) return null;

    const updated = { ...category, ...updates, updatedAt: new Date() };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    // 检查是否有子分类
    const hasChildren = Array.from(this.categories.values()).some(c => c.parentId === id);
    if (hasChildren) {
      throw new Error('Cannot delete category with children');
    }

    this.categoryItems.delete(id);
    return this.categories.delete(id);
  }

  async listCategories(parentId?: string): Promise<MemoryCategory[]> {
    let categories = Array.from(this.categories.values());
    if (parentId !== undefined) {
      categories = categories.filter(c => c.parentId === parentId);
    }
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ========== Resource CRUD ==========
  async createResource(resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource> {
    const newResource: Resource = {
      ...resource,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.resources.set(newResource.id, newResource);
    return newResource;
  }

  async getResource(id: string): Promise<Resource | null> {
    return this.resources.get(id) || null;
  }

  async deleteResource(id: string): Promise<boolean> {
    return this.resources.delete(id);
  }

  // ========== Category-Item Association ==========
  async addItemToCategory(itemId: string, categoryId: string): Promise<void> {
    const itemSet = this.categoryItems.get(categoryId);
    if (itemSet) {
      itemSet.add(itemId);
      // 更新分类计数
      const category = this.categories.get(categoryId);
      if (category) {
        category.itemCount = itemSet.size;
        category.updatedAt = new Date();
      }
    }

    // 更新 item 的 categoryIds
    const item = this.items.get(itemId);
    if (item && !item.categoryIds.includes(categoryId)) {
      item.categoryIds.push(categoryId);
      item.updatedAt = new Date();
    }
  }

  async removeItemFromCategory(itemId: string, categoryId: string): Promise<void> {
    const itemSet = this.categoryItems.get(categoryId);
    if (itemSet) {
      itemSet.delete(itemId);
      const category = this.categories.get(categoryId);
      if (category) {
        category.itemCount = itemSet.size;
      }
    }

    const item = this.items.get(itemId);
    if (item) {
      item.categoryIds = item.categoryIds.filter(cid => cid !== categoryId);
      item.updatedAt = new Date();
    }
  }

  async getItemsByCategory(categoryId: string, limit = 20): Promise<MemoryItem[]> {
    const itemSet = this.categoryItems.get(categoryId);
    if (!itemSet) return [];

    const items = Array.from(itemSet)
      .map(id => this.items.get(id))
      .filter((item): item is MemoryItem => item !== undefined)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    return items;
  }

  // ========== Cross References ==========
  async createReference(
    sourceId: string,
    targetId: string,
    relationType: string,
    strength = 0.5
  ): Promise<MemoryReference> {
    const reference: MemoryReference = {
      id: this.generateId(),
      sourceItemId: sourceId,
      targetItemId: targetId,
      relationType,
      strength,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.references.set(reference.id, reference);
    return reference;
  }

  async getReferences(itemId: string): Promise<MemoryReference[]> {
    return Array.from(this.references.values()).filter(
      ref => ref.sourceItemId === itemId || ref.targetItemId === itemId
    );
  }

  async deleteReference(id: string): Promise<boolean> {
    return this.references.delete(id);
  }

  // ========== Semantic Search (简化版) ==========
  async searchByEmbedding(embedding: number[], threshold: number, limit: number): Promise<MemoryItem[]> {
    // 简化实现：计算余弦相似度
    const items = Array.from(this.items.values()).filter(i => i.embedding);

    const scored = items.map(item => ({
      item,
      score: this.cosineSimilarity(embedding, item.embedding!),
    }));

    return scored
      .filter(s => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.item);
  }

  async searchByKeywords(keywords: string[], limit: number): Promise<MemoryItem[]> {
    const items = Array.from(this.items.values()).filter(item =>
      keywords.some(kw =>
        item.summary.toLowerCase().includes(kw.toLowerCase()) ||
        item.content.toLowerCase().includes(kw.toLowerCase())
      )
    );
    return items.slice(0, limit);
  }

  // ========== Statistics ==========
  async getStats(): Promise<MemoryStats> {
    const items = Array.from(this.items.values());
    const categories = Array.from(this.categories.values());

    const itemsByType: Record<string, number> = {};
    for (const item of items) {
      itemsByType[item.memoryType] = (itemsByType[item.memoryType] || 0) + 1;
    }

    return {
      totalItems: items.length,
      totalCategories: categories.length,
      itemsByType: itemsByType as Record<string, number>,
      recentItems: items.slice(0, 5),
      topCategories: categories.sort((a, b) => b.itemCount - a.itemCount).slice(0, 5),
      reinforcedItems: items.filter(i => i.reinforcementCount > 1).length,
    };
  }

  // ========== Reinforcement ==========
  async reinforceItem(itemId: string): Promise<void> {
    const item = this.items.get(itemId);
    if (item) {
      item.reinforcementCount += 1;
      item.lastReinforcedAt = new Date();
      item.updatedAt = new Date();
    }
  }

  async getReinforcedItems(limit: number): Promise<MemoryItem[]> {
    return Array.from(this.items.values())
      .filter(i => i.reinforcementCount > 0)
      .sort((a, b) => (b.lastReinforcedAt?.getTime() || 0) - (a.lastReinforcedAt?.getTime() || 0))
      .slice(0, limit);
  }

  // ========== Cleanup ==========
  async close(): Promise<void> {
    this.items.clear();
    this.categories.clear();
    this.resources.clear();
    this.categoryItems.clear();
    this.references.clear();
  }

  // ========== Helpers ==========
  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
