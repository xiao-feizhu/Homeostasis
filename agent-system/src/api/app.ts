/**
 * API 应用程序入口
 *
 * Express 应用配置和路由注册
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server } from 'http';

import { InMemoryWorkflowRepository } from '../workflow/repositories/workflow.repository';
import { WorkflowValidator } from '../workflow/validators/workflow.validator';
import { StateManager } from '../workflow/stores/state.manager';
import { DAGExecutor } from '../workflow/executors/dag.executor';
import { NodeExecutorRegistry } from '../workflow/executors/executor.registry';
import { BreakpointManager } from '../workflow/hitl/breakpoint.manager';
import { MetricsCollector } from '../workflow/monitoring/metrics.collector';

import { errorHandler, notFoundHandler, requestLogger, asyncHandler } from './middleware';
import {
  createWorkflowRoutes,
  createExecutionRoutes,
  createBreakpointRoutes,
  createMetricsRoutes,
  createAvatarRoutes,
  createMemoryRoutes
} from './routes';
import { createSuccessResponse } from './types';
import { WebSocketNotificationServer } from './websocket';

/**
 * API 应用配置选项
 */
export interface ApiAppOptions {
  port?: number;
  corsOrigin?: string | string[];
  enableLogging?: boolean;
}

/**
 * API 应用程序
 */
export class ApiApplication {
  public app: Application;
  public server: Server;
  public wsServer: WebSocketNotificationServer;

  // 依赖
  private workflowRepo!: InMemoryWorkflowRepository;
  private workflowValidator!: WorkflowValidator;
  private stateManager!: StateManager;
  private dagExecutor!: DAGExecutor;
  private executorRegistry!: NodeExecutorRegistry;
  private breakpointManager!: BreakpointManager;
  private metricsCollector!: MetricsCollector;

  constructor(options: ApiAppOptions = {}) {
    this.app = express();
    this.setupMiddleware(options);
    this.setupDependencies();
    this.setupRoutes();
    this.setupErrorHandling();

    this.server = createServer(this.app);
    this.wsServer = new WebSocketNotificationServer();
    this.wsServer.initialize(this.server);
  }

  /**
   * 配置中间件
   */
  private setupMiddleware(options: ApiAppOptions): void {
    // 安全头部（允许静态资源）
    this.app.use(helmet({
      contentSecurityPolicy: false
    }));

    // CORS
    this.app.use(cors({
      origin: options.corsOrigin || '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // 请求解析
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // 静态文件服务
    this.app.use(express.static('public'));

    // 日志
    if (options.enableLogging !== false) {
      this.app.use(requestLogger());
    }
  }

  /**
   * 设置依赖
   */
  private setupDependencies(): void {
    this.workflowRepo = new InMemoryWorkflowRepository();
    this.workflowValidator = new WorkflowValidator();
    this.stateManager = new StateManager();
    this.dagExecutor = new DAGExecutor();
    this.executorRegistry = new NodeExecutorRegistry();
    this.breakpointManager = new BreakpointManager();
    this.metricsCollector = new MetricsCollector();
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 工作流路由
    this.app.use('/api/workflows', createWorkflowRoutes(
      this.workflowRepo,
      this.workflowValidator
    ));

    // 执行路由
    this.app.use('/api/executions', createExecutionRoutes(
      this.stateManager,
      this.workflowRepo,
      this.dagExecutor,
      this.executorRegistry
    ));

    // 断点路由
    this.app.use('/api/breakpoints', createBreakpointRoutes(
      this.breakpointManager
    ));

    // 指标路由
    this.app.use('/api/metrics', createMetricsRoutes(
      this.metricsCollector
    ));

    // 虚拟形象路由
    this.app.use('/api/avatar', createAvatarRoutes());

    // 记忆系统路由
    this.app.use('/api/memory', createMemoryRoutes());

    // 健康检查路由（独立挂载）
    this.app.get('/api/health', (_req, res) => {
      res.json(createSuccessResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      }));
    });

    this.app.get('/api/health/ready', asyncHandler(async (_req, res) => {
      const isReady = true; // 简化版，总是就绪
      if (!isReady) {
        res.status(503).json(createSuccessResponse({
          status: 'not_ready',
          timestamp: new Date().toISOString()
        }));
        return;
      }
      res.json(createSuccessResponse({
        status: 'ready',
        timestamp: new Date().toISOString()
      }));
    }));

    this.app.get('/api/health/live', (_req, res) => {
      res.json(createSuccessResponse({
        status: 'alive',
        timestamp: new Date().toISOString()
      }));
    });

    // 根路径
    this.app.get('/', (_req, res) => {
      res.json(createSuccessResponse({
        name: 'Agent System API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          workflows: '/api/workflows',
          executions: '/api/executions',
          breakpoints: '/api/breakpoints',
          metrics: '/api/metrics',
          health: '/api/health'
        }
      }));
    });
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  /**
   * 启动服务器
   */
  start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`API server running on port ${port}`);
        console.log(`WebSocket server available at ws://localhost:${port}/ws`);
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wsServer.stop();
      this.server.close(() => {
        console.log('API server stopped');
        resolve();
      });
    });
  }

  /**
   * 获取依赖（用于测试）
   */
  getDependencies() {
    return {
      workflowRepo: this.workflowRepo,
      workflowValidator: this.workflowValidator,
      stateManager: this.stateManager,
      dagExecutor: this.dagExecutor,
      executorRegistry: this.executorRegistry,
      breakpointManager: this.breakpointManager,
      metricsCollector: this.metricsCollector
    };
  }
}
