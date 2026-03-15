/**
 * 工作流执行 API 路由
 *
 * 启动/暂停/恢复/停止执行，查询状态和事件
 */

import { Router } from 'express';
import { StateManager } from '../../workflow/stores/state.manager';
import { WorkflowRepository } from '../../workflow/repositories/workflow.repository';
import { DAGExecutor } from '../../workflow/executors/dag.executor';
import { NodeExecutorRegistry } from '../../workflow/executors/executor.registry';
import {
  WorkflowExecution,
  ExecutionStatus
} from '../../workflow/entities/workflow-definition.entity';
import {
  createSuccessResponse
} from '../types';
import {
  asyncHandler,
  NotFoundError,
  ValidationError
} from '../middleware';

// 执行存储（简化版）
const executionsStore = new Map<string, WorkflowExecution>();

/**
 * 创建执行路由
 */
export function createExecutionRoutes(
  stateManager: StateManager,
  repository: WorkflowRepository,
  _executor: DAGExecutor,
  _registry: NodeExecutorRegistry
): Router {
  const router = Router();

  /**
   * GET /api/executions
   * 获取执行列表
   */
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const workflowId = req.query.workflowId as string | undefined;
      const status = req.query.status as ExecutionStatus | undefined;

      let executions = Array.from(executionsStore.values());

      if (workflowId) {
        executions = executions.filter(e => e.workflowId === workflowId);
      }

      if (status) {
        executions = executions.filter(e => e.status === status);
      }

      res.json(createSuccessResponse(executions));
    })
  );

  /**
   * GET /api/executions/:id
   * 获取执行详情
   */
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const executionId = req.params.id as string;

      // 首先尝试从存储中获取
      let execution = executionsStore.get(executionId);

      // 如果没有，尝试从 StateManager 重建
      if (!execution) {
        const reconstructed = stateManager.reconstructState(executionId);
        if (reconstructed) {
          execution = reconstructed;
          executionsStore.set(executionId, execution);
        }
      }

      if (!execution) {
        throw new NotFoundError('Execution');
      }

      res.json(createSuccessResponse(execution));
    })
  );

  /**
   * POST /api/executions
   * 启动执行
   */
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { workflowId, variables, options } = req.body;

      if (!workflowId) {
        throw new ValidationError('Missing required field: workflowId');
      }

      const workflow = await repository.findById(workflowId);
      if (!workflow) {
        throw new NotFoundError('Workflow');
      }

      const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const userId = options?.userId || 'anonymous';

      // 创建执行
      const execution = stateManager.createExecution(
        executionId,
        workflowId,
        userId,
        variables
      );

      executionsStore.set(executionId, execution);

      res.status(201).json(createSuccessResponse({
        executionId,
        status: ExecutionStatus.PENDING,
        workflowId
      }));
    })
  );

  /**
   * POST /api/executions/:id/cancel
   * 取消执行
   */
  router.post(
    '/:id/cancel',
    asyncHandler(async (req, res) => {
      const executionId = req.params.id as string;
      const execution = executionsStore.get(executionId);

      if (!execution) {
        throw new NotFoundError('Execution');
      }

      if (
        execution.status !== ExecutionStatus.RUNNING &&
        execution.status !== ExecutionStatus.PENDING &&
        execution.status !== ExecutionStatus.SCHEDULED
      ) {
        throw new ValidationError(`Cannot cancel execution with status: ${execution.status}`);
      }

      // 更新状态
      execution.status = ExecutionStatus.CANCELLED;
      execution.timing.completedAt = new Date();

      res.json(createSuccessResponse({
        executionId,
        status: ExecutionStatus.CANCELLED
      }));
    })
  );

  /**
   * GET /api/executions/:id/snapshot
   * 获取状态快照
   */
  router.get(
    '/:id/snapshot',
    asyncHandler(async (req, res) => {
      const executionId = req.params.id as string;

      const execution = executionsStore.get(executionId);
      if (!execution) {
        throw new NotFoundError('Execution');
      }

      // 如果 StateManager 中没有事件，使用当前执行状态创建简单快照
      let snapshot;
      try {
        snapshot = stateManager.createSnapshot(executionId);
      } catch {
        // 如果没有事件历史，创建基于当前执行状态的快照
        snapshot = {
          version: 0,
          state: execution,
          createdAt: new Date()
        };
      }

      res.json(createSuccessResponse(snapshot));
    })
  );

  return router;
}
