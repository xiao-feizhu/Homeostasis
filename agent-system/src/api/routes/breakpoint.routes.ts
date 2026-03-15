/**
 * HITL 断点 API 路由
 *
 * 审批、输入提交和断点管理
 */

import { Router } from 'express';
import { BreakpointManager, SubmitApprovalParams } from '../../workflow/hitl/breakpoint.manager';
import { createSuccessResponse } from '../types';
import {
  asyncHandler,
  NotFoundError,
  ValidationError
} from '../middleware';

/**
 * 创建断点路由
 */
export function createBreakpointRoutes(
  breakpointManager: BreakpointManager
): Router {
  const router = Router();

  /**
   * GET /api/breakpoints
   * 获取断点列表
   */
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const executionId = req.query.executionId as string | undefined;

      // 根据执行 ID 获取断点，或获取所有待处理断点
      const breakpoints = executionId
        ? breakpointManager.getBreakpointsByExecution(executionId)
        : breakpointManager.getPendingBreakpoints();

      res.json(createSuccessResponse(breakpoints));
    })
  );

  /**
   * GET /api/breakpoints/pending
   * 获取待处理断点
   * 注意：这个路由必须放在 /:id 之前
   */
  router.get(
    '/pending',
    asyncHandler(async (_req, res) => {
      const breakpoints = breakpointManager.getPendingBreakpoints();

      res.json(createSuccessResponse(breakpoints));
    })
  );

  /**
   * GET /api/breakpoints/:id
   * 获取断点详情
   */
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const breakpointId = req.params.id as string;
      const breakpoint = breakpointManager.getBreakpoint(breakpointId);

      if (!breakpoint) {
        throw new NotFoundError('Breakpoint');
      }

      res.json(createSuccessResponse(breakpoint));
    })
  );

  /**
   * POST /api/breakpoints/:id/approve
   * 审批通过
   */
  router.post(
    '/:id/approve',
    asyncHandler(async (req, res) => {
      const breakpointId = req.params.id as string;
      const { userId, comment } = req.body;

      if (!userId) {
        throw new ValidationError('Missing required field: userId');
      }

      const params: SubmitApprovalParams = {
        approverId: userId,
        approverName: userId, // 使用 ID 作为名称
        action: 'approve',
        comment
      };

      const result = breakpointManager.submitApproval(breakpointId, params);

      res.json(createSuccessResponse({
        breakpointId,
        status: result.breakpoint.status,
        isComplete: result.isComplete
      }));
    })
  );

  /**
   * POST /api/breakpoints/:id/reject
   * 审批拒绝
   */
  router.post(
    '/:id/reject',
    asyncHandler(async (req, res) => {
      const breakpointId = req.params.id as string;
      const { userId, comment } = req.body;

      if (!userId) {
        throw new ValidationError('Missing required field: userId');
      }

      const params: SubmitApprovalParams = {
        approverId: userId,
        approverName: userId,
        action: 'reject',
        comment
      };

      const result = breakpointManager.submitApproval(breakpointId, params);

      res.json(createSuccessResponse({
        breakpointId,
        status: result.breakpoint.status,
        isComplete: result.isComplete
      }));
    })
  );

  /**
   * POST /api/breakpoints/:id/cancel
   * 取消断点
   */
  router.post(
    '/:id/cancel',
    asyncHandler(async (req, res) => {
      const breakpointId = req.params.id as string;
      const { userId } = req.body;

      const breakpoint = breakpointManager.getBreakpoint(breakpointId);
      if (!breakpoint) {
        throw new NotFoundError('Breakpoint');
      }

      const cancelledBy = userId || 'system';
      const result = breakpointManager.cancelBreakpoint(breakpointId, cancelledBy);

      res.json(createSuccessResponse({
        breakpointId,
        status: result.breakpoint.status
      }));
    })
  );

  /**
   * GET /api/breakpoints/:id/events
   * 获取断点相关事件
   */
  router.get(
    '/:id/events',
    asyncHandler(async (req, res) => {
      const breakpointId = req.params.id as string;
      const breakpoint = breakpointManager.getBreakpoint(breakpointId);

      if (!breakpoint) {
        throw new NotFoundError('Breakpoint');
      }

      const events = breakpointManager.getEvents().filter(
        e => (e.payload as any)?.breakpointId === breakpointId
      );

      res.json(createSuccessResponse(events));
    })
  );

  return router;
}
