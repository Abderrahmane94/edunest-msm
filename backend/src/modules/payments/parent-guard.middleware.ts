import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';

/**
 * Parent Authorization Guard middleware.
 *
 * Verifies the authenticated user has the 'parent' role, resolves their
 * linked child IDs from the `parent_child_links` table, and stores those
 * IDs on `req.resolvedChildIds` for downstream route handlers.
 *
 * If the request references a specific childId (path, query, or body),
 * it is validated against the resolved set.
 *
 * Requirements: 17.1, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12
 */
export async function parentAuthorizationGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 1. Verify user is authenticated
  if (!req.user) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. Authentication required.',
      },
    });
    return;
  }

  // 2. Verify user has 'parent' role
  if (req.user.role !== 'parent') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. This endpoint is restricted to parent users.',
      },
    });
    return;
  }

  // 3. Resolve ChildParent links from DB using session user ID (not from request)
  const links = await prisma.parentChildLink.findMany({
    where: {
      parentUserId: req.user.userId,
    },
    select: {
      childId: true,
    },
  });

  const childIds = links.map((link) => link.childId);

  // 4. Store resolved childIds on req for downstream use
  // Req 17.12: Return empty list (not error) when parent has no linked children
  req.resolvedChildIds = childIds;

  // 5. If request references a childId, verify it exists in resolved set
  const referencedChildId =
    req.params.childId ||
    (req.query.childId as string | undefined) ||
    (req.body && req.body.childId);

  if (referencedChildId && typeof referencedChildId === 'string') {
    if (!childIds.includes(referencedChildId)) {
      // Req 17.7: Reject with uniform auth error regardless of whether child exists
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: "Access denied. You are not authorized to access this child's data.",
        },
      });
      return;
    }
  }

  next();
}
