import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, validateQuery, validateParams } from './validation.middleware';

function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('validation middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  describe('validate (body)', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email format'),
    });

    it('should call next() when body is valid', () => {
      const middleware = validate(schema);
      const req = createMockReq({ body: { name: 'John', email: 'john@example.com' } });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 with field-level errors when body is invalid', () => {
      const middleware = validate(schema);
      const req = createMockReq({ body: { name: '', email: 'not-an-email' } });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'name', message: expect.any(String) }),
            expect.objectContaining({ field: 'email', message: 'Invalid email format' }),
          ]),
        },
      });
    });

    it('should assign parsed body back to req.body', () => {
      const schemaWithTransform = z.object({
        count: z.string().transform((val) => parseInt(val, 10)),
      });
      const middleware = validate(schemaWithTransform);
      const req = createMockReq({ body: { count: '42' } });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ count: 42 });
    });

    it('should call next(error) for non-Zod errors', () => {
      const throwingSchema = {
        parse: () => {
          throw new Error('Unexpected error');
        },
      } as unknown as z.ZodSchema;
      const middleware = validate(throwingSchema);
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.string().optional().default('1'),
      search: z.string().optional(),
    });

    it('should call next() when query params are valid', () => {
      const middleware = validateQuery(schema);
      const req = createMockReq({ query: { page: '2', search: 'test' } });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 with field-level errors when query is invalid', () => {
      const strictSchema = z.object({
        page: z.string().regex(/^\d+$/, 'Page must be a number'),
      });
      const middleware = validateQuery(strictSchema);
      const req = createMockReq({ query: { page: 'abc' } });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'page', message: 'Page must be a number' }),
          ]),
        },
      });
    });

    it('should assign parsed query back to req.query', () => {
      const middleware = validateQuery(schema);
      const req = createMockReq({ query: {} });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.query).toEqual({ page: '1' });
    });
  });

  describe('validateParams', () => {
    const uuidSchema = z.object({
      id: z.string().regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        'Invalid UUID format',
      ),
    });

    it('should call next() when params are valid UUIDs', () => {
      const middleware = validateParams(uuidSchema);
      const req = createMockReq({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when param is not a valid UUID', () => {
      const middleware = validateParams(uuidSchema);
      const req = createMockReq({ params: { id: 'not-a-uuid' } });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Route parameter validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'id', message: 'Invalid UUID format' }),
          ]),
        },
      });
    });

    it('should return 400 for empty UUID param', () => {
      const middleware = validateParams(uuidSchema);
      const req = createMockReq({ params: { id: '' } });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
