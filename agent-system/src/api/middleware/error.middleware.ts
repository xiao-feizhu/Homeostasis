/**
 * 错误处理中间件
 *
 * 统一的错误处理和响应格式
 */

import { Request, Response, NextFunction } from 'express';
import { createErrorResponse } from '../types';

/**
 * 自定义 API 错误类
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * HTTP 错误快捷创建
 */
export class BadRequestError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('BAD_REQUEST', message, 400, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message: string = 'Too many requests') {
    super('TOO_MANY_REQUESTS', message, 429);
  }
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isDev = process.env.NODE_ENV === 'development';

  // 处理已知 API 错误
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(
      createErrorResponse(err.code, err.message, err.details, isDev)
    );
    return;
  }

  // 处理 SyntaxError (JSON 解析错误)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(
      createErrorResponse('INVALID_JSON', 'Invalid JSON payload', undefined, isDev)
    );
    return;
  }

  // 处理其他错误
  console.error('Unhandled error:', err);

  res.status(500).json(
    createErrorResponse(
      'INTERNAL_ERROR',
      isDev ? err.message : 'Internal server error',
      undefined,
      isDev
    )
  );
}

/**
 * 404 错误处理中间件
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json(
    createErrorResponse('NOT_FOUND', `Route ${req.method} ${req.path} not found`)
  );
}

/**
 * 异步路由处理器包装器
 * 自动捕获 Promise 错误并传递给错误处理中间件
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
