/**
 * Avatar API 控制器
 * 提供虚拟形象的 HTTP API 接口
 */

import { Request, Response } from 'express';
import { AvatarService } from '../services/avatar.service';
import {
  ExpressionType,
  AnimationType,
} from '../entities/avatar.entity';

/** 活跃的 Avatar 会话映射 */
const activeAvatars: Map<string, AvatarService> = new Map();

/**
 * 创建 Avatar 会话
 * POST /api/v1/avatar/sessions
 */
export async function createAvatarSession(req: Request, res: Response): Promise<void> {
  try {
    const { userId, config } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { code: 'AVATAR_001', message: 'userId is required' },
      });
      return;
    }

    const sessionId = `avatar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const avatarService = new AvatarService(
      `avatar-${userId}`,
      sessionId,
      config
    );

    activeAvatars.set(sessionId, avatarService);

    res.status(201).json({
      success: true,
      data: {
        sessionId,
        avatarId: avatarService.getState().avatarId,
        state: avatarService.getState(),
        config: avatarService.getConfig(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AVATAR_002',
        message: error instanceof Error ? error.message : 'Failed to create avatar session',
      },
    });
  }
}

/**
 * 获取 Avatar 状态
 * GET /api/v1/avatar/sessions/:sessionId
 */
export async function getAvatarState(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const avatarService = activeAvatars.get(sessionId);

    if (!avatarService) {
      res.status(404).json({
        success: false,
        error: { code: 'AVATAR_003', message: 'Avatar session not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: avatarService.getState(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AVATAR_004',
        message: error instanceof Error ? error.message : 'Failed to get avatar state',
      },
    });
  }
}

/**
 * 设置表情
 * POST /api/v1/avatar/sessions/:sessionId/expression
 */
export async function setExpression(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const { expression, duration } = req.body;

    const avatarService = activeAvatars.get(sessionId);
    if (!avatarService) {
      res.status(404).json({
        success: false,
        error: { code: 'AVATAR_003', message: 'Avatar session not found' },
      });
      return;
    }

    avatarService.setExpression(expression, duration || 300);

    res.json({
      success: true,
      data: {
        expression,
        state: avatarService.getState(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AVATAR_005',
        message: error instanceof Error ? error.message : 'Failed to set expression',
      },
    });
  }
}

/**
 * 根据情感标签设置表情
 * POST /api/v1/avatar/sessions/:sessionId/emotion
 */
export async function setExpressionByEmotion(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const { emotionLabel, duration, emotionMetrics } = req.body;

    const avatarService = activeAvatars.get(sessionId);
    if (!avatarService) {
      res.status(404).json({
        success: false,
        error: { code: 'AVATAR_003', message: 'Avatar session not found' },
      });
      return;
    }

    // 如果提供了情感指标，使用指标计算
    if (emotionMetrics) {
      avatarService.updateExpressionFromEmotionMetrics(emotionMetrics);
    } else if (emotionLabel) {
      avatarService.setExpressionByEmotion(emotionLabel, duration || 300);
    } else {
      res.status(400).json({
        success: false,
        error: { code: 'AVATAR_006', message: 'emotionLabel or emotionMetrics is required' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        state: avatarService.getState(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AVATAR_007',
        message: error instanceof Error ? error.message : 'Failed to update expression',
      },
    });
  }
}

/**
 * 说话（带口型同步）
 * POST /api/v1/avatar/sessions/:sessionId/speak
 */
export async function speak(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const { text, duration } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        error: { code: 'AVATAR_008', message: 'text is required' },
      });
      return;
    }

    const avatarService = activeAvatars.get(sessionId);
    if (!avatarService) {
      res.status(404).json({
        success: false,
        error: { code: 'AVATAR_003', message: 'Avatar session not found' },
      });
      return;
    }

    avatarService.speak(text, duration);

    res.json({
      success: true,
      data: {
        text,
        estimatedDuration: duration || text.length * 180,
        state: avatarService.getState(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AVATAR_009',
        message: error instanceof Error ? error.message : 'Failed to start speaking',
      },
    });
  }
}

/**
 * 停止说话
 * POST /api/v1/avatar/sessions/:sessionId/stop-speaking
 */
export async function stopSpeaking(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const avatarService = activeAvatars.get(sessionId);

    if (!avatarService) {
      res.status(404).json({
        success: false,
        error: { code: 'AVATAR_003', message: 'Avatar session not found' },
      });
      return;
    }

    avatarService.stopSpeaking();

    res.json({
      success: true,
      data: { state: avatarService.getState() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AVATAR_010',
        message: error instanceof Error ? error.message : 'Failed to stop speaking',
      },
    });
  }
}

/**
 * 播放动画
 * POST /api/v1/avatar/sessions/:sessionId/animation
 */
export async function playAnimation(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const { animationType, animationName } = req.body;

    const avatarService = activeAvatars.get(sessionId);
    if (!avatarService) {
      res.status(404).json({
        success: false,
        error: { code: 'AVATAR_003', message: 'Avatar session not found' },
      });
      return;
    }

    avatarService.playAnimation(animationType as AnimationType, animationName);

    res.json({
      success: true,
      data: {
        animationType,
        animationName,
        state: avatarService.getState(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AVATAR_011',
        message: error instanceof Error ? error.message : 'Failed to play animation',
      },
    });
  }
}

/**
 * 删除 Avatar 会话
 * DELETE /api/v1/avatar/sessions/:sessionId
 */
export async function deleteAvatarSession(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    const avatarService = activeAvatars.get(sessionId);

    if (!avatarService) {
      res.status(404).json({
        success: false,
        error: { code: 'AVATAR_003', message: 'Avatar session not found' },
      });
      return;
    }

    avatarService.destroy();
    activeAvatars.delete(sessionId as string);

    res.json({
      success: true,
      data: { message: 'Avatar session deleted' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AVATAR_012',
        message: error instanceof Error ? error.message : 'Failed to delete session',
      },
    });
  }
}

/**
 * 获取所有表情类型列表
 * GET /api/v1/avatar/expressions
 */
export async function getExpressionTypes(_req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: Object.keys(ExpressionType).map(key => ({
      name: key,
      value: ExpressionType[key as keyof typeof ExpressionType],
    })),
  });
}

/**
 * 获取所有动画类型列表
 * GET /api/v1/avatar/animations
 */
export async function getAnimationTypes(_req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: Object.keys(AnimationType).map(key => ({
      name: key,
      value: AnimationType[key as keyof typeof AnimationType],
    })),
  });
}

/**
 * 清理不活跃的会话（内部方法）
 */
export function cleanupInactiveSessions(maxAgeMs: number = 30 * 60 * 1000): void {
  // 这里可以实现会话过期清理逻辑
  console.log(`Cleanup called with maxAge: ${maxAgeMs}ms`);
}
