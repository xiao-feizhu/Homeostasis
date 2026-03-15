/**
 * 验证中间件测试
 */

import { Request, Response, NextFunction } from 'express';
import {
  validateBody,
  validateQuery,
  parsePagination,
  requiredFields,
  sanitizeString,
  sanitizeObject,
  sanitizeBody
} from '../validation.middleware';

describe('Validation Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      body: {},
      query: {}
    };
    res = {
      status: statusMock
    };
    next = jest.fn();
  });

  describe('validateBody', () => {
    it('should pass validation when valid', () => {
      const validator = jest.fn().mockReturnValue({ valid: true });
      const middleware = validateBody(validator);

      req.body = { name: 'test' };
      middleware(req as Request, res as Response, next);

      expect(validator).toHaveBeenCalledWith({ name: 'test' });
      expect(next).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 400 when validation fails', () => {
      const validator = jest.fn().mockReturnValue({
        valid: false,
        errors: ['name is required']
      });
      const middleware = validateBody(validator);

      middleware(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    it('should pass validation when valid', () => {
      const validator = jest.fn().mockReturnValue({ valid: true });
      const middleware = validateQuery(validator);

      req.query = { page: '1' };
      middleware(req as Request, res as Response, next);

      expect(validator).toHaveBeenCalledWith({ page: '1' });
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when validation fails', () => {
      const validator = jest.fn().mockReturnValue({
        valid: false,
        errors: ['invalid page']
      });
      const middleware = validateQuery(validator);

      middleware(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('parsePagination', () => {
    it('should parse default pagination', () => {
      req.query = {};
      parsePagination(req as Request, res as Response, next);

      expect(req.pagination).toEqual({ page: 1, limit: 20 });
      expect(next).toHaveBeenCalled();
    });

    it('should parse custom pagination', () => {
      req.query = { page: '3', limit: '50' };
      parsePagination(req as Request, res as Response, next);

      expect(req.pagination).toEqual({ page: 3, limit: 50 });
    });

    it('should cap limit at 100', () => {
      req.query = { limit: '200' };
      parsePagination(req as Request, res as Response, next);

      expect(req.pagination?.limit).toBe(100);
    });

    it('should use default for zero page', () => {
      req.query = { page: '0' };
      parsePagination(req as Request, res as Response, next);

      // Zero is falsy, so || 1 defaults to 1
      expect(req.pagination).toEqual({ page: 1, limit: 20 });
      expect(next).toHaveBeenCalled();
    });

    it('should use default for zero limit', () => {
      req.query = { limit: '0' };
      parsePagination(req as Request, res as Response, next);

      // Zero is falsy, so || 20 defaults to 20
      expect(req.pagination).toEqual({ page: 1, limit: 20 });
      expect(next).toHaveBeenCalled();
    });

    it('should use default for invalid page string', () => {
      req.query = { page: 'invalid' };
      parsePagination(req as Request, res as Response, next);

      // Invalid strings are parsed as NaN, then || 1 defaults to 1
      expect(req.pagination).toEqual({ page: 1, limit: 20 });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requiredFields', () => {
    it('should pass when all required fields present', () => {
      const middleware = requiredFields('name', 'email');
      req.body = { name: 'test', email: 'test@example.com' };

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 400 when fields are missing', () => {
      const middleware = requiredFields('name', 'email');
      req.body = { name: 'test' };

      middleware(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        })
      );
    });

    it('should return 400 when field is null', () => {
      const middleware = requiredFields('name');
      req.body = { name: null };

      middleware(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 400 when field is undefined', () => {
      const middleware = requiredFields('name');
      req.body = { name: undefined };

      middleware(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should allow empty string as valid value', () => {
      const middleware = requiredFields('name');
      req.body = { name: '' };

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeString', () => {
    it('should trim string', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should return null for non-string', () => {
      expect(sanitizeString(123 as any)).toBeNull();
      expect(sanitizeString(null)).toBeNull();
      expect(sanitizeString(undefined)).toBeNull();
    });
  });

  describe('sanitizeObject', () => {
    it('should trim string values', () => {
      const input = { name: '  test  ' };
      const result = sanitizeObject(input);
      expect(result.name).toBe('test');
    });

    it('should recursively sanitize nested objects', () => {
      const input = {
        user: {
          name: '  test  ',
          email: '  email@example.com  '
        }
      };
      const result = sanitizeObject(input);
      expect(result.user).toEqual({
        name: 'test',
        email: 'email@example.com'
      });
    });

    it('should preserve non-string values', () => {
      const input = {
        count: 42,
        active: true,
        nested: null
      };
      const result = sanitizeObject(input);
      expect(result).toEqual(input);
    });
  });

  describe('sanitizeBody', () => {
    it('should sanitize request body', () => {
      req.body = { name: '  test  ' };
      sanitizeBody(req as Request, res as Response, next);

      expect(req.body.name).toBe('test');
      expect(next).toHaveBeenCalled();
    });

    it('should handle non-object body', () => {
      req.body = 'string body';
      sanitizeBody(req as Request, res as Response, next);

      expect(req.body).toBe('string body');
      expect(next).toHaveBeenCalled();
    });

    it('should handle null body', () => {
      req.body = null;
      sanitizeBody(req as Request, res as Response, next);

      expect(req.body).toBeNull();
      expect(next).toHaveBeenCalled();
    });
  });
});
