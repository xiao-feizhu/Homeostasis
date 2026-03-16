/**
 * 记忆系统实体定义
 *
 * 基于 "Memory as File System" 理念设计：
 * - MemoryCategory = 文件夹 (🏷️ Categories)
 * - MemoryItem = 文件 (🧠 Memory Items)
 * - Cross-references = 符号链接 (🔄 Cross-references)
 * - Resource = 挂载点 (📥 Resources)
 *
 * Licensed under Apache 2.0 - Inspired by memU architecture
 */

/** 记忆类型 */
export type MemoryType =
  | 'profile'      // 用户画像
  | 'event'        // 事件记忆
  | 'knowledge'    // 知识记忆
  | 'behavior'     // 行为习惯
  | 'skill'        // 技能记忆
  | 'tool'         // 工具调用
  | 'preference';  // 用户偏好

/** 基础记录接口 */
export interface BaseRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 工具调用结果 */
export interface ToolCallResult {
  toolName: string;
  input: Record<string, unknown> | string;
  output: string;
  success: boolean;
  timeCost: number;      // 秒
  tokenCost: number;     // -1 表示未知
  score: number;         // 0.0 - 1.0
  callHash: string;      // 用于去重
  createdAt: Date;
}

/** 资源（原始数据） */
export interface Resource extends BaseRecord {
  url: string;                    // 资源标识
  modality: string;               // 类型: text/image/audio
  localPath?: string;             // 本地存储路径
  caption?: string;               // 描述
  embedding?: number[];           // 向量嵌入
  metadata?: Record<string, unknown>;
}

/** 记忆项 */
export interface MemoryItem extends BaseRecord {
  resourceId?: string;            // 关联的资源ID
  categoryIds: string[];          // 所属分类ID列表
  memoryType: MemoryType;
  summary: string;                // 记忆摘要
  content: string;                // 完整内容
  embedding?: number[];           // 向量嵌入
  happenedAt?: Date;              // 事件发生时间

  // 强化跟踪字段
  contentHash: string;            // 内容哈希（去重）
  reinforcementCount: number;     // 强化次数
  lastReinforcedAt?: Date;        // 最后强化时间

  // 工具记忆特有字段
  whenToUse?: string;             // 使用提示
  toolCalls?: ToolCallResult[];   // 工具调用历史

  // 通用扩展字段
  extra: Record<string, unknown>;
}

/** 记忆分类 */
export interface MemoryCategory extends BaseRecord {
  name: string;                   // 分类名称
  description: string;            // 描述
  parentId?: string;              // 父分类ID（层级结构）
  embedding?: number[];           // 向量嵌入
  summary?: string;               // 分类摘要
  itemCount: number;              // 包含的记忆项数量
}

/** 分类-记忆关联 */
export interface CategoryItem extends BaseRecord {
  itemId: string;
  categoryId: string;
}

/** 记忆引用（跨引用） */
export interface MemoryReference extends BaseRecord {
  sourceItemId: string;
  targetItemId: string;
  relationType: string;           // 关系类型: related, derived, contradicts 等
  strength: number;               // 关联强度 0.0-1.0
}

/** 记忆检索结果 */
export interface MemoryRetrievalResult {
  item: MemoryItem;
  score: number;                  // 相关性分数
  matchedCategory?: MemoryCategory;
  relationPath?: string[];        // 关系路径
}

/** 记忆查询条件 */
export interface MemoryQuery {
  memoryTypes?: MemoryType[];
  categoryIds?: string[];
  keywords?: string[];
  happenedAfter?: Date;
  happenedBefore?: Date;
  embedding?: number[];           // 语义搜索
  similarityThreshold?: number;   // 相似度阈值
  limit?: number;
  offset?: number;
}

/** 记忆统计 */
export interface MemoryStats {
  totalItems: number;
  totalCategories: number;
  itemsByType: Record<MemoryType, number>;
  recentItems: MemoryItem[];
  topCategories: MemoryCategory[];
  reinforcedItems: number;
}

/** 用户记忆画像 */
export interface UserMemoryProfile {
  userId: string;
  summary: string;                // 画像摘要
  keyFacts: MemoryItem[];         // 关键事实
  preferences: Record<string, unknown>;  // 偏好设置
  behaviorPatterns: string[];     // 行为模式
  lastUpdated: Date;
}

/**
 * 计算内容哈希（用于去重）
 */
export function computeContentHash(summary: string, memoryType: MemoryType): string {
  // 标准化：小写、去除多余空格
  const normalized = summary.toLowerCase().replace(/\s+/g, ' ').trim();
  const content = `${memoryType}:${normalized}`;

  // 简单的哈希实现（实际项目使用 crypto）
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}
