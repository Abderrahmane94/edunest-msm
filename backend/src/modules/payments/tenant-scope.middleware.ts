import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { errorResponse } from '../../utils/response';

/**
 * Resolved tenant scope for the current request.
 * Attached to req.tenantScope by the payment tenancy middleware.
 */
export interface TenantScope {
  /** The user's school ID (null only for super_admin) */
  schoolId: string | null;
  /** The user's branch ID (null means school-wide access) */
  branchId: string | null;
  /** Whether the user is a super_admin (bypasses all scoping) */
  isSuperAdmin: boolean;
}

// Extend Express Request with tenantScope
declare global {
  namespace Express {
    interface Request {
      tenantScope?: TenantScope;
    }
  }
}

/**
 * Payment-specific tenancy middleware.
 * Resolves the user's school and branch scope for payment module queries.
 *
 * Scoping rules (Requirements 20.1-20.8):
 * - super_admin: bypasses school+branch scoping
 * - Staff with branchId: sees only their branch's data
 * - Staff with null branchId: sees all branches of their school
 * - Non-super_admin without schoolId: rejected
 */
export async function paymentTenancyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  const { role, schoolId, branchId } = req.user;

  // Super_admin bypasses all scoping (Req 20.5)
  if (role === 'super_admin') {
    req.tenantScope = {
      schoolId: null,
      branchId: null,
      isSuperAdmin: true,
    };
    next();
    return;
  }

  // Non-super_admin must have a school association (Req 20.8)
  if (!schoolId) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'No school association found for this user'),
    );
    return;
  }

  req.tenantScope = {
    schoolId,
    branchId: branchId ?? null,
    isSuperAdmin: false,
  };

  next();
}

/**
 * Validates that a branch ID belongs to the requesting user's scope.
 * Used by controllers before passing branchId to services.
 *
 * Returns the validated branchId if access is allowed, or sends an error response.
 *
 * Rules:
 * - super_admin: any branch is allowed
 * - Staff with null branchId: branch must belong to their school
 * - Staff with non-null branchId: branch must match their branchId exactly
 *
 * @returns the branchId if valid, or null if an error response was sent
 */
export async function validateBranchAccess(
  branchId: string,
  req: Request,
  res: Response,
): Promise<string | null> {
  const scope = req.tenantScope;
  if (!scope) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Tenant scope not resolved'),
    );
    return null;
  }

  // Super_admin bypasses all scoping (Req 20.5)
  if (scope.isSuperAdmin) {
    return branchId;
  }

  // Branch-scoped staff: must match their own branchId (Req 20.2, 20.6)
  if (scope.branchId && scope.branchId !== branchId) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Access denied: you can only access your assigned branch'),
    );
    return null;
  }

  // Verify the branch belongs to the user's school (Req 20.1, 20.4)
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { schoolId: true },
  });

  if (!branch || branch.schoolId !== scope.schoolId) {
    // Return same error whether branch exists or not (Req 20.7)
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Access denied: branch does not belong to your school'),
    );
    return null;
  }

  return branchId;
}

/**
 * Validates that an enrollment belongs to the requesting user's scope.
 * Checks both school and branch ownership.
 *
 * @returns the enrollment's branchId if valid, or null if an error response was sent
 */
export async function validateEnrollmentAccess(
  enrollmentId: string,
  req: Request,
  res: Response,
): Promise<string | null> {
  const scope = req.tenantScope;
  if (!scope) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Tenant scope not resolved'),
    );
    return null;
  }

  // Super_admin bypasses all scoping
  if (scope.isSuperAdmin) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { branchId: true },
    });
    if (!enrollment) {
      return null; // Let the service handle 404
    }
    return enrollment.branchId;
  }

  // Find the enrollment and check its branch's school
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      branchId: true,
      branch: { select: { schoolId: true } },
    },
  });

  if (!enrollment || enrollment.branch.schoolId !== scope.schoolId) {
    // Same error whether enrollment exists or not (Req 20.7)
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Access denied: resource does not belong to your school'),
    );
    return null;
  }

  // Branch-scoped staff: enrollment's branch must match (Req 20.6)
  if (scope.branchId && enrollment.branchId !== scope.branchId) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Access denied: resource does not belong to your branch'),
    );
    return null;
  }

  return enrollment.branchId;
}

/**
 * Validates that a payment record belongs to the requesting user's scope.
 *
 * @returns the payment record's branchId if valid, or null if an error response was sent
 */
export async function validatePaymentRecordAccess(
  paymentRecordId: string,
  req: Request,
  res: Response,
): Promise<string | null> {
  const scope = req.tenantScope;
  if (!scope) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Tenant scope not resolved'),
    );
    return null;
  }

  // Super_admin bypasses all scoping
  if (scope.isSuperAdmin) {
    const record = await prisma.paymentRecord.findUnique({
      where: { id: paymentRecordId },
      select: { branchId: true },
    });
    if (!record) {
      return null; // Let the service handle 404
    }
    return record.branchId;
  }

  // Find the record and check its branch's school
  const record = await prisma.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: {
      branchId: true,
      branch: { select: { schoolId: true } },
    },
  });

  if (!record || record.branch.schoolId !== scope.schoolId) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Access denied: resource does not belong to your school'),
    );
    return null;
  }

  // Branch-scoped staff: record's branch must match
  if (scope.branchId && record.branchId !== scope.branchId) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Access denied: resource does not belong to your branch'),
    );
    return null;
  }

  return record.branchId;
}

/**
 * Resolves the branchId(s) the user is allowed to query for list endpoints.
 *
 * If the user is branch-scoped, forces their own branchId regardless of what's in the request.
 * If the user is school-wide, uses the requested branchId (after validation) or returns all branches.
 *
 * @param requestedBranchId - The branchId from the request (query param or path param), or undefined
 * @returns Object with resolved branchId filter, or null if error was sent
 */
export async function resolveBranchFilter(
  requestedBranchId: string | undefined,
  req: Request,
  res: Response,
): Promise<{ branchId?: string; branchIds?: string[] } | null> {
  const scope = req.tenantScope;
  if (!scope) {
    res.status(403).json(
      errorResponse('FORBIDDEN', 'Tenant scope not resolved'),
    );
    return null;
  }

  // Super_admin: use requested branch or no filter
  if (scope.isSuperAdmin) {
    if (requestedBranchId) {
      return { branchId: requestedBranchId };
    }
    return {}; // No filter — sees everything
  }

  // Branch-scoped staff: always use their own branch (Req 20.2)
  if (scope.branchId) {
    // If they explicitly asked for a different branch, reject
    if (requestedBranchId && requestedBranchId !== scope.branchId) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Access denied: you can only access your assigned branch'),
      );
      return null;
    }
    return { branchId: scope.branchId };
  }

  // School-wide staff (null branchId): validate requested branch or return all branches
  if (requestedBranchId) {
    // Validate the branch belongs to their school
    const branch = await prisma.branch.findUnique({
      where: { id: requestedBranchId },
      select: { schoolId: true },
    });

    if (!branch || branch.schoolId !== scope.schoolId) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Access denied: branch does not belong to your school'),
      );
      return null;
    }
    return { branchId: requestedBranchId };
  }

  // No specific branch requested — return all branches for the school
  const schoolBranches = await prisma.branch.findMany({
    where: { schoolId: scope.schoolId!, deletedAt: null },
    select: { id: true },
  });

  return { branchIds: schoolBranches.map((b) => b.id) };
}
