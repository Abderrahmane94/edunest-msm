import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

/**
 * Role hierarchy defines the privilege level of each role.
 * Higher numbers indicate more privileges.
 * The student role is inactive in MVP.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 5,
  admin: 4,
  teacher: 3,
  parent: 2,
  student: 1,
};

/**
 * Factory function that creates an Express middleware to enforce role-based access control.
 * Checks if the authenticated user's role is included in the list of allowed roles.
 *
 * Usage: `router.get('/schools', rbac(['super_admin', 'admin']), controller.list)`
 *
 * @param allowedRoles - Array of roles permitted to access the endpoint
 * @returns Express middleware that returns 403 if the user's role is not allowed
 */
export function rbac(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip RBAC for unauthenticated requests (public routes handled by auth middleware)
    if (!req.user) {
      next();
      return;
    }

    const { role } = req.user;

    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. This endpoint requires one of the following roles: ${allowedRoles.join(', ')}. Your role: ${role}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Shorthand middleware that restricts access to super_admin only.
 * Use for platform-level operations like creating/deactivating schools.
 */
export const requireSuperAdmin = rbac(['super_admin']);

/**
 * Shorthand middleware that restricts access to admin or super_admin.
 * Use for school administration endpoints.
 */
export const requireAdmin = rbac(['super_admin', 'admin']);

/**
 * Shorthand middleware that restricts access to teacher, admin, or super_admin.
 * Use for classroom operations like attendance marking and daily reports.
 */
export const requireTeacherOrAdmin = rbac(['super_admin', 'admin', 'teacher']);

/**
 * Shorthand middleware that restricts access to parent, admin, or super_admin.
 * Use for parent-facing endpoints that admins also need access to.
 */
export const requireParentOrAdmin = rbac(['super_admin', 'admin', 'parent']);

/**
 * Middleware that restricts access to authenticated users with any active role.
 * Excludes the inactive student role.
 */
export const requireActiveRole = rbac(['super_admin', 'admin', 'teacher', 'parent']);
