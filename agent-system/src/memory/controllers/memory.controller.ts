/**
 * 记忆系统 API 控制器
 * Licensed under Apache 2.0
 */

import { Request, Response } from 'express';
import { MemoryService } from '../services/memory.service';
import { MemoryType, MemoryQuery } from '../entities/memory.entity';
import { InMemoryMemoryRepository } from '../repositories/memory.repository';

// 全局记忆服务实例 (实际应用中使用依赖注入)
const repository = new InMemoryMemoryRepository();
const memoryService = new MemoryService(repository);
memoryService.initialize().catch(console.error);

/**
 * 保存记忆
 * POST /api/memory/memorize
 */
export async function memorize(req: Request, res: Response): Promise<void> {
  try {
    const { content, summary, memoryType, categoryNames, happenedAt, extra } = req.body;

    if (!content || !summary || !memoryType) {
      res.status(400).json({
        success: false,
        error: { code: 'MEMORY_001', message: 'content, summary, and memoryType are required' },
      });
      return;
    }

    const item = await memoryService.memorize(content, summary, memoryType as MemoryType, {
      categoryNames,
      happenedAt: happenedAt ? new Date(happenedAt) : undefined,
      extra,
    });

    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_002',
        message: error instanceof Error ? error.message : 'Failed to save memory',
      },
    });
  }
}

/**
 * 检索记忆
 * POST /api/memory/retrieve
 */
export async function retrieve(req: Request, res: Response): Promise<void> {
  try {
    const query: MemoryQuery = {
      memoryTypes: req.body.memoryTypes,
      categoryIds: req.body.categoryIds,
      keywords: req.body.keywords,
      happenedAfter: req.body.happenedAfter ? new Date(req.body.happenedAfter) : undefined,
      happenedBefore: req.body.happenedBefore ? new Date(req.body.happenedBefore) : undefined,
      limit: req.body.limit || 20,
      offset: req.body.offset || 0,
    };

    const results = await memoryService.retrieve(query);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_003',
        message: error instanceof Error ? error.message : 'Failed to retrieve memories',
      },
    });
  }
}

/**
 * 获取相关上下文
 * POST /api/memory/context
 */
export async function getContext(req: Request, res: Response): Promise<void> {
  try {
    const { query, userId, maxItems, memoryTypes } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        error: { code: 'MEMORY_004', message: 'query is required' },
      });
      return;
    }

    const memories = await memoryService.getRelevantContext(query, userId || 'default', {
      maxItems,
      memoryTypes,
    });

    res.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_005',
        message: error instanceof Error ? error.message : 'Failed to get context',
      },
    });
  }
}

/**
 * 获取用户画像
 * GET /api/memory/profile/:userId
 */
export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.userId as string;
    const profile = await memoryService.buildUserProfile(userId);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_006',
        message: error instanceof Error ? error.message : 'Failed to build user profile',
      },
    });
  }
}

/**
 * 强化记忆
 * POST /api/memory/reinforce/:itemId
 */
export async function reinforce(req: Request, res: Response): Promise<void> {
  try {
    const itemId = req.params.itemId as string;
    await memoryService.reinforce(itemId);

    res.json({
      success: true,
      data: { message: 'Memory reinforced' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_007',
        message: error instanceof Error ? error.message : 'Failed to reinforce memory',
      },
    });
  }
}

/**
 * 创建分类
 * POST /api/memory/categories
 */
export async function createCategory(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, parentId } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        error: { code: 'MEMORY_008', message: 'name is required' },
      });
      return;
    }

    const category = await memoryService.createCategory(name, description || '', parentId);

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_009',
        message: error instanceof Error ? error.message : 'Failed to create category',
      },
    });
  }
}

/**
 * 获取记忆统计
 * GET /api/memory/stats
 */
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await memoryService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_010',
        message: error instanceof Error ? error.message : 'Failed to get stats',
      },
    });
  }
}

/**
 * 删除记忆
 * DELETE /api/memory/:itemId
 */
export async function forget(req: Request, res: Response): Promise<void> {
  try {
    const itemId = req.params.itemId as string;
    const success = await memoryService.forget(itemId);

    if (!success) {
      res.status(404).json({
        success: false,
        error: { code: 'MEMORY_011', message: 'Memory not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { message: 'Memory deleted' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_012',
        message: error instanceof Error ? error.message : 'Failed to delete memory',
      },
    });
  }
}
