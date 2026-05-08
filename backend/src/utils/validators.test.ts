import { describe, it, expect } from 'vitest';
import { uuidSchema, paginationSchema, idParamSchema } from './validators';

describe('validators', () => {
  describe('uuidSchema', () => {
    it('should accept a valid UUID v4', () => {
      const result = uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
      expect(result.success).toBe(true);
    });

    it('should accept uppercase UUID', () => {
      const result = uuidSchema.safeParse('550E8400-E29B-41D4-A716-446655440000');
      expect(result.success).toBe(true);
    });

    it('should reject an invalid UUID', () => {
      const result = uuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });

    it('should reject an empty string', () => {
      const result = uuidSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject a UUID without dashes', () => {
      const result = uuidSchema.safeParse('550e8400e29b41d4a716446655440000');
      expect(result.success).toBe(false);
    });

    it('should reject a UUID with extra characters', () => {
      const result = uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000x');
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should provide defaults when no values given', () => {
      const result = paginationSchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('should parse valid page and pageSize strings', () => {
      const result = paginationSchema.parse({ page: '3', pageSize: '50' });
      expect(result).toEqual({ page: 3, pageSize: 50 });
    });

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject pageSize greater than 100', () => {
      const result = paginationSchema.safeParse({ pageSize: '101' });
      expect(result.success).toBe(false);
    });

    it('should reject pageSize less than 1', () => {
      const result = paginationSchema.safeParse({ pageSize: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric page string', () => {
      const result = paginationSchema.safeParse({ page: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('idParamSchema', () => {
    it('should accept an object with a valid UUID id', () => {
      const result = idParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' });
      expect(result.success).toBe(true);
    });

    it('should reject an object with an invalid id', () => {
      const result = idParamSchema.safeParse({ id: '123' });
      expect(result.success).toBe(false);
    });

    it('should reject an object without id', () => {
      const result = idParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
