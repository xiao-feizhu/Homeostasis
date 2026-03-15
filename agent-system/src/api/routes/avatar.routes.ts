/**
 * Avatar API 路由
 * 虚拟形象系统路由配置
 */

import { Router } from 'express';
import {
  createAvatarSession,
  getAvatarState,
  setExpression,
  setExpressionByEmotion,
  speak,
  stopSpeaking,
  playAnimation,
  deleteAvatarSession,
  getExpressionTypes,
  getAnimationTypes,
} from '../../avatar/controllers/avatar.controller';
import { asyncHandler } from '../middleware';

/**
 * 创建 Avatar 路由
 */
export function createAvatarRoutes(): Router {
  const router = Router();

  // 会话管理
  router.post('/sessions', asyncHandler(createAvatarSession));
  router.get('/sessions/:sessionId', asyncHandler(getAvatarState));
  router.delete('/sessions/:sessionId', asyncHandler(deleteAvatarSession));

  // 表情控制
  router.post('/sessions/:sessionId/expression', asyncHandler(setExpression));
  router.post('/sessions/:sessionId/emotion', asyncHandler(setExpressionByEmotion));

  // 口型同步
  router.post('/sessions/:sessionId/speak', asyncHandler(speak));
  router.post('/sessions/:sessionId/stop-speaking', asyncHandler(stopSpeaking));

  // 动画控制
  router.post('/sessions/:sessionId/animation', asyncHandler(playAnimation));

  // 元数据
  router.get('/expressions', asyncHandler(getExpressionTypes));
  router.get('/animations', asyncHandler(getAnimationTypes));

  return router;
}
