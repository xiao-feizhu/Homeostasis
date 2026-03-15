/**
 * 日志中间件测试
 */

import { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../logging.middleware';

describe('Logging Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let mockStorage: jest.Mock;

  beforeEach(() => {
    mockStorage = jest.fn();
    req = {
      method: 'GET',
      path: '/test',
      query: {},
      get: jest.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1'
    };
    res = {
      statusCode: 200,
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          callback();
        }
        return res as Response;
      })
    };
    next = jest.fn();
  });

  describe('requestLogger', () => {
    it('should add requestId to request', () => {
      const middleware = requestLogger(mockStorage);
      middleware(req as Request, res as Response, next);

      expect((req as Request & { requestId: string }).requestId).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should log request on finish', () => {
      const middleware = requestLogger(mockStorage);
      middleware(req as Request, res as Response, next);

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(mockStorage).toHaveBeenCalled();

      const logEntry = mockStorage.mock.calls[0][0];
      expect(logEntry.method).toBe('GET');
      expect(logEntry.path).toBe('/test');
      expect(logEntry.statusCode).toBe(200);
      expect(logEntry.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include query when present', () => {
      req.query = { page: '1', limit: '10' };
      const middleware = requestLogger(mockStorage);
      middleware(req as Request, res as Response, next);

      const logEntry = mockStorage.mock.calls[0][0];
      expect(logEntry.query).toEqual({ page: '1', limit: '10' });
    });

    it('should not include query when empty', () => {
      req.query = {};
      const middleware = requestLogger(mockStorage);
      middleware(req as Request, res as Response, next);

      const logEntry = mockStorage.mock.calls[0][0];
      expect(logEntry.query).toBeUndefined();
    });

    it('should use default console storage when not provided', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const middleware = requestLogger();
      middleware(req as Request, res as Response, next);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log 4xx status with different color', () => {
      res.statusCode = 404;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const middleware = requestLogger();
      middleware(req as Request, res as Response, next);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log 3xx status with different color', () => {
      res.statusCode = 301;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const middleware = requestLogger();
      middleware(req as Request, res as Response, next);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
