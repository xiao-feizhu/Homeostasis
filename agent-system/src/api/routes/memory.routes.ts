/**
 * 记忆系统 API 路由
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware';
import {
  memorize,
  retrieve,
  getContext,
  getUserProfile,
  reinforce,
  createCategory,
  getStats,
  forget,
} from '../../memory/controllers/memory.controller';

/**
 * 创建记忆系统路由
 */
export function createMemoryRoutes(): Router {
  const router = Router();

  // 记忆 CRUD
  router.post('/memorize', asyncHandler(memorize));
  router.post('/retrieve', asyncHandler(retrieve));
  router.delete('/:itemId', asyncHandler(forget));

  // 上下文检索
  router.post('/context', asyncHandler(getContext));

  // 用户画像
  router.get('/profile/:userId', asyncHandler(getUserProfile));

  // 记忆强化
  router.post('/reinforce/:itemId', asyncHandler(reinforce));

  // 分类管理
  router.post('/categories', asyncHandler(createCategory));

  // 统计
  router.get('/stats', asyncHandler(getStats));

  return router;
}
