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

/**
 * 创建 Avatar 路由
 */
export function createAvatarRoutes(): Router {
  const router = Router();

  // 会话管理
  router.post('/sessions', createAvatarSession);
  router.get('/sessions/:sessionId', getAvatarState);
  router.delete('/sessions/:sessionId', deleteAvatarSession);

  // 表情控制
  router.post('/sessions/:sessionId/expression', setExpression);
  router.post('/sessions/:sessionId/emotion', setExpressionByEmotion);

  // 口型同步
  router.post('/sessions/:sessionId/speak', speak);
  router.post('/sessions/:sessionId/stop-speaking', stopSpeaking);

  // 动画控制
  router.post('/sessions/:sessionId/animation', playAnimation);

  // 元数据
  router.get('/expressions', getExpressionTypes);
  router.get('/animations', getAnimationTypes);

  return router;
}
