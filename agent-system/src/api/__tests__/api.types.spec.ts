/**
 * API 类型测试
 */

import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  PaginatedResult
} from '../types/api.types';

describe('API Types', () => {
  describe('createSuccessResponse', () => {
    it('should create success response with data', () => {
      const data = { id: '123', name: 'Test' };
      const response = createSuccessResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeNull();
      expect(response.meta).toBeUndefined();
    });

    it('should create success response with meta', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const meta = {
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false
      };

      const response = createSuccessResponse(data, meta);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toEqual(meta);
    });

    it('should handle null data', () => {
      const response = createSuccessResponse(null);

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
      expect(response.error).toBeNull();
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response', () => {
      const response = createErrorResponse('NOT_FOUND', 'Resource not found');

      expect(response.success).toBe(false);
      expect(response.data).toBeNull();
      expect(response.error).toEqual({
        code: 'NOT_FOUND',
        message: 'Resource not found',
        details: undefined
      });
    });

    it('should create error response with details', () => {
      const details = { field: 'email', issue: 'invalid format' };
      const response = createErrorResponse('VALIDATION_ERROR', 'Validation failed', details);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
      expect(response.error?.message).toBe('Validation failed');
      expect(response.error?.details).toEqual(details);
    });

    it('should include stack trace when requested', () => {
      const response = createErrorResponse('ERROR', 'Something went wrong', undefined, true);

      expect(response.success).toBe(false);
      expect(response.error?.stack).toBeDefined();
      expect(response.error?.stack).toContain('Error');
    });

    it('should not include stack trace by default', () => {
      const response = createErrorResponse('ERROR', 'Something went wrong');

      expect(response.success).toBe(false);
      expect(response.error?.stack).toBeUndefined();
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create paginated response', () => {
      const result: PaginatedResult<{ id: string }> = {
        items: [{ id: '1' }, { id: '2' }],
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
          totalPages: 10
        }
      };

      const response = createPaginatedResponse(result);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(result.items);
      expect(response.error).toBeNull();
      expect(response.meta).toEqual({
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false
      });
    });

    it('should set hasNext to false on last page', () => {
      const result: PaginatedResult<{ id: string }> = {
        items: [{ id: '1' }],
        pagination: {
          page: 10,
          limit: 10,
          total: 100,
          totalPages: 10
        }
      };

      const response = createPaginatedResponse(result);

      expect(response.meta?.hasNext).toBe(false);
      expect(response.meta?.hasPrev).toBe(true);
    });

    it('should set hasPrev to false on first page', () => {
      const result: PaginatedResult<{ id: string }> = {
        items: [{ id: '1' }],
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
          totalPages: 10
        }
      };

      const response = createPaginatedResponse(result);

      expect(response.meta?.hasPrev).toBe(false);
      expect(response.meta?.hasNext).toBe(true);
    });

    it('should handle empty items', () => {
      const result: PaginatedResult<{ id: string }> = {
        items: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      };

      const response = createPaginatedResponse(result);

      expect(response.data).toEqual([]);
      expect(response.meta?.hasNext).toBe(false);
      expect(response.meta?.hasPrev).toBe(false);
    });
  });
});
