/**
 * 错误处理中间件测试
 */

import { Request, Response, NextFunction } from 'express';
import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  errorHandler,
  notFoundHandler,
  asyncHandler
} from '../error.middleware';

describe('Error Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      method: 'GET',
      path: '/test'
    };
    res = {
      status: statusMock
    };
    next = jest.fn();
  });

  describe('ApiError classes', () => {
    it('should create ApiError with default status code', () => {
      const error = new ApiError('TEST', 'Test message');
      expect(error.code).toBe('TEST');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('ApiError');
    });

    it('should create ApiError with custom status code', () => {
      const error = new ApiError('TEST', 'Test message', 400);
      expect(error.statusCode).toBe(400);
    });

    it('should create ApiError with details', () => {
      const details = { field: 'name' };
      const error = new ApiError('TEST', 'Test message', 400, details);
      expect(error.details).toEqual(details);
    });

    it('should create BadRequestError', () => {
      const error = new BadRequestError('Invalid input');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.statusCode).toBe(400);
    });

    it('should create BadRequestError with details', () => {
      const details = { field: 'email' };
      const error = new BadRequestError('Invalid input', details);
      expect(error.details).toEqual(details);
    });

    it('should create UnauthorizedError', () => {
      const error = new UnauthorizedError();
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });

    it('should create UnauthorizedError with custom message', () => {
      const error = new UnauthorizedError('Custom auth error');
      expect(error.message).toBe('Custom auth error');
    });

    it('should create ForbiddenError', () => {
      const error = new ForbiddenError();
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });

    it('should create NotFoundError', () => {
      const error = new NotFoundError('User');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
    });

    it('should create ConflictError', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
    });

    it('should create ValidationError', () => {
      const error = new ValidationError('Invalid data');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(422);
    });

    it('should create ValidationError with details', () => {
      const details = { fields: ['name'] };
      const error = new ValidationError('Invalid data', details);
      expect(error.details).toEqual(details);
    });

    it('should create TooManyRequestsError', () => {
      const error = new TooManyRequestsError();
      expect(error.code).toBe('TOO_MANY_REQUESTS');
      expect(error.statusCode).toBe(429);
    });

    it('should create TooManyRequestsError with custom message', () => {
      const error = new TooManyRequestsError('Rate limit exceeded');
      expect(error.message).toBe('Rate limit exceeded');
    });
  });

  describe('errorHandler', () => {
    it('should handle ApiError', () => {
      const error = new BadRequestError('Bad request');
      errorHandler(error, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'BAD_REQUEST',
            message: 'Bad request'
          })
        })
      );
    });

    it('should handle SyntaxError', () => {
      const error = new SyntaxError('Unexpected token');
      (error as any).body = '{}';
      errorHandler(error, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_JSON'
          })
        })
      );
    });

    it('should handle regular SyntaxError without body', () => {
      const error = new SyntaxError('Unexpected token');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      errorHandler(error, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });

    it('should handle unknown errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Something went wrong');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      errorHandler(error, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal server error'
          })
        })
      );

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle unknown errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Something went wrong');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      errorHandler(error, req as Request, res as Response, next);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Something went wrong'
          })
        })
      );

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 for unknown routes', () => {
      req = {
        method: 'GET',
        path: '/unknown'
      };

      notFoundHandler(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Route GET /unknown not found'
          })
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should pass successful async function', async () => {
      const asyncFn = jest.fn().mockResolvedValue(undefined);
      const wrapped = asyncHandler(asyncFn);

      await wrapped(req as Request, res as Response, next);

      expect(asyncFn).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and pass errors to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrapped = asyncHandler(asyncFn);

      await wrapped(req as Request, res as Response, next);

      expect(asyncFn).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
