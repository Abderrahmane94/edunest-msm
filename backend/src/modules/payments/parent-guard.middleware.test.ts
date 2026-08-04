import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock Prisma before importing the service
vi.mock('../../lib/prisma', () => ({
  default: {
    parentChildLink: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';
import { parentAuthorizationGuard } from './parent-guard.middleware';

const mockFindMany = vi.mocked(prisma.parentChildLink.findMany);

function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('parentAuthorizationGuard', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('authentication checks', () => {
    it('should reject with 403 when user is not authenticated', async () => {
      const req = createMockReq({ user: undefined });
      const res = createMockRes();

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Authentication required.',
        },
      });
    });

    it('should reject with 403 when user role is not parent', async () => {
      const req = createMockReq({
        user: { userId: 'user-1', schoolId: 'school-1', role: 'admin' as any },
      });
      const res = createMockRes();

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. This endpoint is restricted to parent users.',
        },
      });
    });

    it('should reject teacher role', async () => {
      const req = createMockReq({
        user: { userId: 'user-1', schoolId: 'school-1', role: 'teacher' as any },
      });
      const res = createMockRes();

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject super_admin role', async () => {
      const req = createMockReq({
        user: { userId: 'user-1', schoolId: null, role: 'super_admin' as any },
      });
      const res = createMockRes();

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('child resolution', () => {
    it('should resolve childIds from parent_child_links using session userId', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([
        { childId: 'child-1' },
        { childId: 'child-2' },
      ]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { parentUserId: 'parent-1' },
        select: { childId: true },
      });
      expect(next).toHaveBeenCalled();
      expect((req as any).resolvedChildIds).toEqual(['child-1', 'child-2']);
    });

    it('should store resolved childIds on request object', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([{ childId: 'child-abc' }]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect((req as any).resolvedChildIds).toEqual(['child-abc']);
    });

    it('should return empty list (not error) when parent has no linked children', async () => {
      const req = createMockReq({
        user: { userId: 'parent-no-kids', schoolId: 'school-1', role: 'parent' as any },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).resolvedChildIds).toEqual([]);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('childId verification', () => {
    it('should allow when referenced childId is in resolved set (from params)', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
        params: { childId: 'child-1' },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([
        { childId: 'child-1' },
        { childId: 'child-2' },
      ]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when referenced childId (from params) is not in resolved set', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
        params: { childId: 'other-child' },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([{ childId: 'child-1' }]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: "Access denied. You are not authorized to access this child's data.",
        },
      });
    });

    it('should reject when referenced childId (from query) is not in resolved set', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
        query: { childId: 'other-child' },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([{ childId: 'child-1' }]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow when referenced childId (from query) is in resolved set', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
        query: { childId: 'child-2' },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([
        { childId: 'child-1' },
        { childId: 'child-2' },
      ]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject when referenced childId (from body) is not in resolved set', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
        body: { childId: 'other-child' },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([{ childId: 'child-1' }]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow when referenced childId (from body) is in resolved set', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
        body: { childId: 'child-1' },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([{ childId: 'child-1' }]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return uniform auth error regardless of whether childId exists in DB', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
        params: { childId: 'nonexistent-child-xyz' },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([{ childId: 'child-1' }]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: "Access denied. You are not authorized to access this child's data.",
        },
      });
    });

    it('should allow through when no childId is referenced in request', async () => {
      const req = createMockReq({
        user: { userId: 'parent-1', schoolId: 'school-1', role: 'parent' as any },
      });
      const res = createMockRes();

      mockFindMany.mockResolvedValue([{ childId: 'child-1' }]);

      await parentAuthorizationGuard(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
