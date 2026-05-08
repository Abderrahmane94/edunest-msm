import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse, paginatedResponse } from './response';

describe('response utilities', () => {
  describe('successResponse', () => {
    it('should create a success response with data', () => {
      const result = successResponse({ id: '123', name: 'Test' });

      expect(result).toEqual({
        success: true,
        data: { id: '123', name: 'Test' },
      });
    });

    it('should include meta when provided', () => {
      const meta = { pagination: { page: 1, pageSize: 20, total: 50, totalPages: 3 } };
      const result = successResponse([1, 2, 3], meta);

      expect(result).toEqual({
        success: true,
        data: [1, 2, 3],
        meta,
      });
    });

    it('should not include meta key when not provided', () => {
      const result = successResponse('hello');

      expect(result).not.toHaveProperty('meta');
    });
  });

  describe('errorResponse', () => {
    it('should create an error response with code and message', () => {
      const result = errorResponse('NOT_FOUND', 'Resource not found');

      expect(result).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
    });

    it('should include field-level details when provided', () => {
      const details = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'name', message: 'Name is required' },
      ];
      const result = errorResponse('VALIDATION_ERROR', 'Validation failed', details);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
      });
    });

    it('should not include details key when not provided', () => {
      const result = errorResponse('SERVER_ERROR', 'Internal error');

      expect(result.error).not.toHaveProperty('details');
    });
  });

  describe('paginatedResponse', () => {
    it('should create a paginated response with correct meta', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = paginatedResponse(data, 1, 20, 50);

      expect(result).toEqual({
        success: true,
        data,
        meta: {
          pagination: {
            page: 1,
            pageSize: 20,
            total: 50,
            totalPages: 3,
          },
        },
      });
    });

    it('should calculate totalPages correctly with exact division', () => {
      const result = paginatedResponse([], 1, 10, 30);

      expect(result.meta?.pagination.totalPages).toBe(3);
    });

    it('should round up totalPages for partial pages', () => {
      const result = paginatedResponse([], 1, 10, 25);

      expect(result.meta?.pagination.totalPages).toBe(3);
    });

    it('should handle zero total items', () => {
      const result = paginatedResponse([], 1, 20, 0);

      expect(result.meta?.pagination.totalPages).toBe(0);
    });
  });
});
