import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { rbac, requireSuperAdmin, requireAdmin, requireTeacherOrAdmin, ROLE_HIERARCHY } from './rbac.middleware';

function createMockReq(role?: string, schoolId?: string): Partial<Request> {
  if (!role) return {};
  return {
    user: {
      userId: 'user-123',
      schoolId: schoolId || 'school-456',
      role: role as any,
    },
  };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('rbac middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  describe('rbac factory function', () => {
    it('should call next() when user role is in allowed roles', () => {
      const middleware = rbac(['admin', 'super_admin']);
      const req = createMockReq('admin');
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is not in allowed roles', () => {
      const middleware = rbac(['super_admin']);
      const req = createMockReq('teacher');
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining('Access denied'),
        },
      });
    });

    it('should include the required roles in the error message', () => {
      const middleware = rbac(['super_admin', 'admin']);
      const req = createMockReq('parent');
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining('super_admin, admin'),
        },
      });
    });

    it('should include the user current role in the error message', () => {
      const middleware = rbac(['super_admin']);
      const req = createMockReq('parent');
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining('Your role: parent'),
        },
      });
    });

    it('should call next() when req.user is not set (unauthenticated/public route)', () => {
      const middleware = rbac(['admin']);
      const req = createMockReq(); // no user
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject student role (inactive in MVP)', () => {
      const middleware = rbac(['admin', 'teacher', 'parent']);
      const req = createMockReq('student');
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireSuperAdmin', () => {
    it('should allow super_admin', () => {
      const req = createMockReq('super_admin');
      const res = createMockRes();

      requireSuperAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject admin', () => {
      const req = createMockReq('admin');
      const res = createMockRes();

      requireSuperAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject teacher', () => {
      const req = createMockReq('teacher');
      const res = createMockRes();

      requireSuperAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireAdmin', () => {
    it('should allow super_admin', () => {
      const req = createMockReq('super_admin');
      const res = createMockRes();

      requireAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow admin', () => {
      const req = createMockReq('admin');
      const res = createMockRes();

      requireAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject teacher', () => {
      const req = createMockReq('teacher');
      const res = createMockRes();

      requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject parent', () => {
      const req = createMockReq('parent');
      const res = createMockRes();

      requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireTeacherOrAdmin', () => {
    it('should allow super_admin', () => {
      const req = createMockReq('super_admin');
      const res = createMockRes();

      requireTeacherOrAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow admin', () => {
      const req = createMockReq('admin');
      const res = createMockRes();

      requireTeacherOrAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow teacher', () => {
      const req = createMockReq('teacher');
      const res = createMockRes();

      requireTeacherOrAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject parent', () => {
      const req = createMockReq('parent');
      const res = createMockRes();

      requireTeacherOrAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('should define correct hierarchy order', () => {
      expect(ROLE_HIERARCHY.super_admin).toBeGreaterThan(ROLE_HIERARCHY.admin);
      expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.teacher);
      expect(ROLE_HIERARCHY.teacher).toBeGreaterThan(ROLE_HIERARCHY.parent);
      expect(ROLE_HIERARCHY.parent).toBeGreaterThan(ROLE_HIERARCHY.student);
    });

    it('should include all five roles', () => {
      expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(5);
      expect(ROLE_HIERARCHY).toHaveProperty('super_admin');
      expect(ROLE_HIERARCHY).toHaveProperty('admin');
      expect(ROLE_HIERARCHY).toHaveProperty('teacher');
      expect(ROLE_HIERARCHY).toHaveProperty('parent');
      expect(ROLE_HIERARCHY).toHaveProperty('student');
    });
  });
});
