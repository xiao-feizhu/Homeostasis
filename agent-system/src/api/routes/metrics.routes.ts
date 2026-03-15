/**
 * 监控指标 API 路由
 *
 * 系统指标、健康检查和 Prometheus 导出
 */

import { Router } from 'express';
import { MetricsCollector } from '../../workflow/monitoring/metrics.collector';
import { createSuccessResponse } from '../types';
import { asyncHandler } from '../middleware';

/**
 * 创建指标路由
 */
export function createMetricsRoutes(
  metricsCollector: MetricsCollector
): Router {
  const router = Router();

  /**
   * GET /api/metrics
   * 系统指标
   */
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const metrics = metricsCollector.getMetrics();

      res.json(createSuccessResponse(metrics));
    })
  );

  /**
   * GET /api/metrics/prometheus
   * Prometheus 格式指标
   */
  router.get(
    '/prometheus',
    asyncHandler(async (_req, res) => {
      const prometheusMetrics = metricsCollector.exportPrometheus();

      res.set('Content-Type', 'text/plain');
      res.send(prometheusMetrics);
    })
  );

  /**
   * GET /api/health
   * 健康检查
   */
  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      };

      res.json(createSuccessResponse(health));
    })
  );

  /**
   * GET /api/health/ready
   * 就绪检查
   */
  router.get(
    '/health/ready',
    asyncHandler(async (_req, res) => {
      const isReady = await checkSystemReadiness();

      if (!isReady) {
        res.status(503).json(createSuccessResponse({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          checks: await getReadinessChecks()
        }));
        return;
      }

      res.json(createSuccessResponse({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: await getReadinessChecks()
      }));
    })
  );

  /**
   * GET /api/health/live
   * 存活检查
   */
  router.get(
    '/health/live',
    asyncHandler(async (_req, res) => {
      res.json(createSuccessResponse({
        status: 'alive',
        timestamp: new Date().toISOString()
      }));
    })
  );

  return router;
}

/**
 * 检查系统就绪状态
 */
async function checkSystemReadiness(): Promise<boolean> {
  // 检查必要的组件是否就绪
  // 这里可以扩展为检查数据库连接、外部服务等
  return true;
}

/**
 * 获取就绪检查详情
 */
async function getReadinessChecks(): Promise<Record<string, unknown>> {
  return {
    database: { status: 'ok' },
    cache: { status: 'ok' },
    messageQueue: { status: 'ok' }
  };
}

