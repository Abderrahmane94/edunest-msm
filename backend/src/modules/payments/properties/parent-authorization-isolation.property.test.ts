import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';

/**
 * Property 14: Parent Authorization Isolation
 *
 * For any authenticated parent user, every API response SHALL contain data only
 * for children present in that parent's resolved ChildParent link set, and requests
 * referencing a child ID not in that set SHALL be rejected with an authorization error.
 *
 * **Validates: Requirements 17.4, 17.5, 17.6, 17.7, 17.8**
 */

// Mock Prisma before importing the middleware
vi.mock('../../../lib/prisma', () => ({
  default: {
    parentChildLink: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../../../lib/prisma';
import { parentAuthorizationGuard } from '../parent-guard.middleware';

const mockFindMany = vi.mocked(prisma.parentChildLink.findMany);

// --- Arbitraries ---

/**
 * Generates a non-empty UUID-like string for identifiers.
 */
function arbId() {
  return fc.uuid();
}

/**
 * Generates a non-empty set of child IDs representing a parent's linked children.
 */
function arbLinkedChildIds() {
  return fc.uniqueArray(arbId(), { minLength: 1, maxLength: 10 });
}

/**
 * Generates a childId source location: 'params', 'query', or 'body'.
 */
function arbChildIdSource() {
  return fc.constantFrom('params', 'query', 'body') as fc.Arbitrary<
    'params' | 'query' | 'body'
  >;
}

// --- Helpers ---

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

describe('Property 14: Parent Authorization Isolation', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('the guard resolves only the parent\'s linked children from DB using session userId', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbId(), // parentUserId
        arbLinkedChildIds(), // linked children from DB
        async (parentUserId, linkedChildIds) => {
          vi.clearAllMocks();
          next = vi.fn();

          const req = createMockReq({
            user: { userId: parentUserId, schoolId: 'school-1', role: 'parent' as any },
          });
          const res = createMockRes();

          mockFindMany.mockResolvedValue(
            linkedChildIds.map((childId) => ({ childId }))
          );

          await parentAuthorizationGuard(req as Request, res as Response, next);

          // Guard must query using the session userId (Req 17.5)
          expect(mockFindMany).toHaveBeenCalledWith({
            where: { parentUserId },
            select: { childId: true },
          });

          // Resolved set must match exactly what DB returned
          expect((req as any).resolvedChildIds).toEqual(linkedChildIds);
          expect(next).toHaveBeenCalled();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('a referenced childId NOT in the resolved set is always rejected with 403', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbId(), // parentUserId
        arbLinkedChildIds(), // linked children
        arbId(), // unlinked childId candidate
        arbChildIdSource(), // where the childId appears in request
        async (parentUserId, linkedChildIds, unlinkedChildId, source) => {
          // Skip if the unlinked ID happens to be in the linked set
          if (linkedChildIds.includes(unlinkedChildId)) return;

          vi.clearAllMocks();
          next = vi.fn();

          const reqOverrides: Partial<Request> = {
            user: { userId: parentUserId, schoolId: 'school-1', role: 'parent' as any },
            params: {},
            query: {},
            body: {},
          };

          // Place the unlinked childId in the appropriate request location
          if (source === 'params') {
            reqOverrides.params = { childId: unlinkedChildId };
          } else if (source === 'query') {
            reqOverrides.query = { childId: unlinkedChildId };
          } else {
            reqOverrides.body = { childId: unlinkedChildId };
          }

          const req = createMockReq(reqOverrides);
          const res = createMockRes();

          mockFindMany.mockResolvedValue(
            linkedChildIds.map((childId) => ({ childId }))
          );

          await parentAuthorizationGuard(req as Request, res as Response, next);

          // Req 17.7: Must reject with uniform auth error
          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: "Access denied. You are not authorized to access this child's data.",
            },
          });
          expect(next).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 500 }
    );
  });

  it('a referenced childId IN the resolved set is always allowed through', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbId(), // parentUserId
        arbLinkedChildIds(), // linked children
        arbChildIdSource(), // where the childId appears in request
        async (parentUserId, linkedChildIds, source) => {
          vi.clearAllMocks();
          next = vi.fn();

          // Pick a random linked child
          const linkedChildId = linkedChildIds[0];

          const reqOverrides: Partial<Request> = {
            user: { userId: parentUserId, schoolId: 'school-1', role: 'parent' as any },
            params: {},
            query: {},
            body: {},
          };

          // Place the linked childId in the appropriate request location
          if (source === 'params') {
            reqOverrides.params = { childId: linkedChildId };
          } else if (source === 'query') {
            reqOverrides.query = { childId: linkedChildId };
          } else {
            reqOverrides.body = { childId: linkedChildId };
          }

          const req = createMockReq(reqOverrides);
          const res = createMockRes();

          mockFindMany.mockResolvedValue(
            linkedChildIds.map((childId) => ({ childId }))
          );

          await parentAuthorizationGuard(req as Request, res as Response, next);

          // Req 17.4, 17.6: Must allow through when childId is in resolved set
          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 500 }
    );
  });

  it('no data for unlinked children ever leaks through (resolvedChildIds contains only linked)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbId(), // parentUserId
        arbLinkedChildIds(), // linked children
        async (parentUserId, linkedChildIds) => {
          vi.clearAllMocks();
          next = vi.fn();

          const req = createMockReq({
            user: { userId: parentUserId, schoolId: 'school-1', role: 'parent' as any },
          });
          const res = createMockRes();

          mockFindMany.mockResolvedValue(
            linkedChildIds.map((childId) => ({ childId }))
          );

          await parentAuthorizationGuard(req as Request, res as Response, next);

          // Req 17.8: resolvedChildIds must contain ONLY linked children
          const resolved: string[] = (req as any).resolvedChildIds;
          expect(resolved).toBeDefined();
          expect(resolved.length).toBe(linkedChildIds.length);

          // Every resolved ID must be in the linked set
          for (const id of resolved) {
            expect(linkedChildIds).toContain(id);
          }

          // No extra IDs must be present
          for (const id of linkedChildIds) {
            expect(resolved).toContain(id);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('uniform auth error is returned regardless of whether child exists (Req 17.7)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbId(), // parentUserId
        arbLinkedChildIds(), // linked children
        arbId(), // arbitrary unlinked childId (may or may not exist in DB)
        arbChildIdSource(),
        async (parentUserId, linkedChildIds, arbitraryChildId, source) => {
          // Skip if the arbitrary ID happens to be in the linked set
          if (linkedChildIds.includes(arbitraryChildId)) return;

          vi.clearAllMocks();
          next = vi.fn();

          const reqOverrides: Partial<Request> = {
            user: { userId: parentUserId, schoolId: 'school-1', role: 'parent' as any },
            params: {},
            query: {},
            body: {},
          };

          if (source === 'params') {
            reqOverrides.params = { childId: arbitraryChildId };
          } else if (source === 'query') {
            reqOverrides.query = { childId: arbitraryChildId };
          } else {
            reqOverrides.body = { childId: arbitraryChildId };
          }

          const req = createMockReq(reqOverrides);
          const res = createMockRes();

          mockFindMany.mockResolvedValue(
            linkedChildIds.map((childId) => ({ childId }))
          );

          await parentAuthorizationGuard(req as Request, res as Response, next);

          // The error message must be the same regardless of the childId value
          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: "Access denied. You are not authorized to access this child's data.",
            },
          });
        }
      ),
      { numRuns: 200 }
    );
  });
});
