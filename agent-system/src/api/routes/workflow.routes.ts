/**
 * 工作流定义 API 路由
 *
 * CRUD 操作和版本管理
 */

import { Router } from 'express';
import { WorkflowRepository } from '../../workflow/repositories/workflow.repository';
import { WorkflowValidator } from '../../workflow/validators/workflow.validator';
import { WorkflowStatus } from '../../workflow/entities/workflow-definition.entity';
import {
  createSuccessResponse
} from '../types';
import {
  asyncHandler,
  NotFoundError,
  ConflictError,
  ValidationError
} from '../middleware';

/**
 * 创建工作流路由
 */
export function createWorkflowRoutes(
  repository: WorkflowRepository,
  validator: WorkflowValidator
): Router {
  const router = Router();

  /**
   * GET /api/workflows
   * 获取工作流列表（分页）
   */
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const statusParam = req.query.status as string | undefined;

      // 转换 status 为 WorkflowStatus
      let status: WorkflowStatus | undefined;
      if (statusParam && Object.values(WorkflowStatus).includes(statusParam as WorkflowStatus)) {
        status = statusParam as WorkflowStatus;
      }

      const result = await repository.findAll({
        limit,
        offset: (page - 1) * limit,
        status
      });

      res.json(createSuccessResponse(result));
    })
  );

  /**
   * GET /api/workflows/:id
   * 获取工作流详情
   */
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const workflowId = req.params.id as string;
      const workflow = await repository.findById(workflowId);

      if (!workflow) {
        throw new NotFoundError('Workflow');
      }

      res.json(createSuccessResponse(workflow));
    })
  );

  /**
   * POST /api/workflows
   * 创建工作流
   */
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const definition = req.body;

      // 验证工作流定义
      const validationResult = validator.validate(definition);
      if (!validationResult.valid) {
        throw new ValidationError('Workflow validation failed', {
          errors: validationResult.errors
        });
      }

      // 检查 ID 是否已存在
      if (definition.workflowId) {
        const existing = await repository.findById(definition.workflowId);
        if (existing) {
          throw new ConflictError(`Workflow with ID ${definition.workflowId} already exists`);
        }
      }

      const saved = await repository.save(definition);

      if (!saved.success) {
        throw new ValidationError(saved.error || 'Failed to save workflow');
      }

      res.status(201).json(createSuccessResponse(saved));
    })
  );

  /**
   * PUT /api/workflows/:id
   * 更新工作流
   */
  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const workflowId = req.params.id as string;
      const definition = req.body;

      // 验证工作流定义
      const validationResult = validator.validate(definition);
      if (!validationResult.valid) {
        throw new ValidationError('Workflow validation failed', {
          errors: validationResult.errors
        });
      }

      // 检查是否存在
      const existing = await repository.findById(workflowId);
      if (!existing) {
        throw new NotFoundError('Workflow');
      }

      const saved = await repository.save({
        ...definition,
        workflowId: workflowId
      });

      if (!saved.success) {
        throw new ValidationError(saved.error || 'Failed to save workflow');
      }

      res.json(createSuccessResponse(saved));
    })
  );

  /**
   * DELETE /api/workflows/:id
   * 删除工作流
   */
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const workflowId = req.params.id as string;

      // 检查是否存在
      const existing = await repository.findById(workflowId);
      if (!existing) {
        throw new NotFoundError('Workflow');
      }

      await repository.delete(workflowId);

      res.status(204).send();
    })
  );

  /**
   * GET /api/workflows/:id/versions
   * 获取版本列表
   */
  router.get(
    '/:id/versions',
    asyncHandler(async (req, res) => {
      const workflowId = req.params.id as string;
      const versions = await repository.getVersions(workflowId);

      res.json(createSuccessResponse(versions));
    })
  );

  /**
   * GET /api/workflows/:id/validate
   * 验证工作流
   */
  router.get(
    '/:id/validate',
    asyncHandler(async (req, res) => {
      const workflowId = req.params.id as string;
      const workflow = await repository.findById(workflowId);

      if (!workflow) {
        throw new NotFoundError('Workflow');
      }

      const result = validator.validate(workflow);

      res.json(
        createSuccessResponse({
          valid: result.valid,
          errors: result.errors || []
        })
      );
    })
  );

  return router;
}
