/**
 * 日志中间件
 *
 * HTTP 请求日志记录
 */

import { Request, Response, NextFunction } from 'express';

/**
 * 日志条目
 */
interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  query?: Record<string, unknown>;
  statusCode: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  requestId?: string;
}

/**
 * 日志存储
 */
type LogStorage = (entry: LogEntry) => void;

/**
 * 控制台日志存储
 */
const consoleLogStorage: LogStorage = (entry) => {
  const { method, path, statusCode, duration } = entry;

  // 根据状态码选择颜色
  let statusColor = '\x1b[32m'; // 绿色 (2xx)
  if (statusCode >= 400) statusColor = '\x1b[31m'; // 红色 (4xx/5xx)
  else if (statusCode >= 300) statusColor = '\x1b[33m'; // 黄色 (3xx)

  const resetColor = '\x1b[0m';

  console.log(
    `[${entry.timestamp}] ${method} ${path} ${statusColor}${statusCode}${resetColor} - ${duration}ms`
  );
};

/**
 * 请求日志中间件
 */
export function requestLogger(storage: LogStorage = consoleLogStorage) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // 生成请求 ID
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    (req as Request & { requestId: string }).requestId = requestId;

    // 响应完成时记录日志
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('user-agent'),
        ip: req.ip,
        requestId
      };

      storage(entry);
    });

    next();
  };
}

/**
 * 扩展 Request 类型
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
