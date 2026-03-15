/**
 * 请求验证中间件
 *
 * 输入验证和清洗
 */

import { Request, Response, NextFunction } from 'express';
import { createErrorResponse } from '../types';

/**
 * 验证函数类型
 */
export type ValidatorFn = (data: unknown) => { valid: boolean; errors?: string[] };

/**
 * 请求体验证中间件
 */
export function validateBody(validator: ValidatorFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.body);

    if (!result.valid) {
      res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', 'Request validation failed', {
          errors: result.errors
        })
      );
      return;
    }

    next();
  };
}

/**
 * 查询参数验证中间件
 */
export function validateQuery(validator: ValidatorFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.query);

    if (!result.valid) {
      res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', 'Query validation failed', {
          errors: result.errors
        })
      );
      return;
    }

    next();
  };
}

/**
 * 分页参数解析和验证中间件
 */
export function parsePagination(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

  if (page < 1) {
    res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', 'Page must be greater than 0')
    );
    return;
  }

  if (limit < 1) {
    res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', 'Limit must be greater than 0')
    );
    return;
  }

  req.pagination = { page, limit };
  next();
}

/**
 * 参数类型声明
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      pagination?: {
        page: number;
        limit: number;
      };
    }
  }
}

/**
 * 必填字段验证
 */
export function requiredFields(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing: string[] = [];

    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', 'Missing required fields', {
          missing
        })
      );
      return;
    }

    next();
  };
}

/**
 * 字符串字段清理
 */
export function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim();
}

/**
 * 对象字段清理
 */
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 请求体清理中间件
 */
export function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}
