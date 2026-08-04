import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Property 15: Tenant Scoping Isolation
 *
 * For any staff user scoped to a specific branch, every query result SHALL contain
 * only records belonging to that branch, and requests referencing records from other
 * branches or other schools SHALL be rejected.
 *
 * **Validates: Requirements 20.1, 20.2, 20.3, 20.6, 20.7**
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface StaffUser {
  userId: string;
  schoolId: string;
  branchId: string | null; // null means access to all branches in school
  role: 'admin' | 'super_admin';
}

interface Record {
  id: string;
  schoolId: string;
  branchId: string;
}

type QueryResult =
  | { success: true; records: Record[] }
  | { success: false; error: 'FORBIDDEN' };

type ReferenceResult =
  | { success: true; record: Record }
  | { success: false; error: 'FORBIDDEN' };

// ─── Tenant Scoping Simulation ───────────────────────────────────────────────

/**
 * Simulates scoped list queries. A staff user can only see records that:
 * 1. Belong to the same school (schoolId match)
 * 2. If user has non-null branchId, records must also match that branchId
 * 3. If user has null branchId, they see all branches within their school
 * 4. super_admin bypasses all scoping
 *
 * Returns empty list (not error) when all rows excluded by scope.
 */
function scopedListQuery(user: StaffUser, allRecords: Record[]): QueryResult {
  // super_admin bypasses all scoping (Requirement 20.5)
  if (user.role === 'super_admin') {
    return { success: true, records: allRecords };
  }

  // Filter to user's school first (Requirement 20.1)
  let scopedRecords = allRecords.filter((r) => r.schoolId === user.schoolId);

  // If branch-scoped staff, further filter to their branch (Requirement 20.2)
  if (user.branchId !== null) {
    scopedRecords = scopedRecords.filter((r) => r.branchId === user.branchId);
  }

  // Return empty list (not error) when all rows excluded (Requirement 20.3)
  return { success: true, records: scopedRecords };
}

/**
 * Simulates a reference to a specific record by ID.
 * Rejects with authorization error if:
 * - Record belongs to a different school (Requirement 20.7)
 * - Branch-scoped staff references another branch (Requirement 20.6)
 */
function scopedRecordReference(
  user: StaffUser,
  record: Record
): ReferenceResult {
  // super_admin bypasses all scoping
  if (user.role === 'super_admin') {
    return { success: true, record };
  }

  // Cross-school reference → reject (Requirement 20.7)
  if (record.schoolId !== user.schoolId) {
    return { success: false, error: 'FORBIDDEN' };
  }

  // Branch-scoped staff referencing another branch → reject (Requirement 20.6)
  if (user.branchId !== null && record.branchId !== user.branchId) {
    return { success: false, error: 'FORBIDDEN' };
  }

  return { success: true, record };
}

// ─── Arbitrary Generators ────────────────────────────────────────────────────

const arbSchoolId = fc.constantFrom('school-1', 'school-2', 'school-3');
const arbBranchId = fc.constantFrom(
  'branch-1a', 'branch-1b', 'branch-1c',
  'branch-2a', 'branch-2b',
  'branch-3a'
);

/**
 * Maps branches to their school for realistic data.
 */
const branchToSchool: Record<string, string> = {
  'branch-1a': 'school-1',
  'branch-1b': 'school-1',
  'branch-1c': 'school-1',
  'branch-2a': 'school-2',
  'branch-2b': 'school-2',
  'branch-3a': 'school-3',
};

const schoolBranches: Record<string, string[]> = {
  'school-1': ['branch-1a', 'branch-1b', 'branch-1c'],
  'school-2': ['branch-2a', 'branch-2b'],
  'school-3': ['branch-3a'],
};

function arbBranchForSchool(schoolId: string): fc.Arbitrary<string> {
  return fc.constantFrom(...schoolBranches[schoolId]);
}

function arbRecord(): fc.Arbitrary<Record> {
  return arbBranchId.map((branchId) => ({
    id: `record-${branchId}-${Math.random().toString(36).slice(2, 8)}`,
    schoolId: branchToSchool[branchId],
    branchId,
  }));
}

function arbBranchScopedStaff(): fc.Arbitrary<StaffUser> {
  return arbSchoolId.chain((schoolId) =>
    arbBranchForSchool(schoolId).map((branchId) => ({
      userId: `user-${branchId}`,
      schoolId,
      branchId,
      role: 'admin' as const,
    }))
  );
}

function arbSchoolScopedStaff(): fc.Arbitrary<StaffUser> {
  return arbSchoolId.map((schoolId) => ({
    userId: `user-school-${schoolId}`,
    schoolId,
    branchId: null,
    role: 'admin' as const,
  }));
}

function arbSuperAdmin(): fc.Arbitrary<StaffUser> {
  return fc.constant({
    userId: 'super-admin',
    schoolId: 'school-1', // irrelevant for super_admin
    branchId: null,
    role: 'super_admin' as const,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Property 15: Tenant Scoping Isolation', () => {
  it('branch-scoped staff see only records from their branch', () => {
    fc.assert(
      fc.property(
        arbBranchScopedStaff(),
        fc.array(arbRecord(), { minLength: 1, maxLength: 30 }),
        (user, allRecords) => {
          const result = scopedListQuery(user, allRecords);

          expect(result.success).toBe(true);
          if (!result.success) return;

          // Every returned record must belong to the user's branch
          for (const record of result.records) {
            expect(record.branchId).toBe(user.branchId);
            expect(record.schoolId).toBe(user.schoolId);
          }

          // All records from the user's branch must be included
          const expectedRecords = allRecords.filter(
            (r) => r.branchId === user.branchId && r.schoolId === user.schoolId
          );
          expect(result.records.length).toBe(expectedRecords.length);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('null-branch staff see all branches within their school only', () => {
    fc.assert(
      fc.property(
        arbSchoolScopedStaff(),
        fc.array(arbRecord(), { minLength: 1, maxLength: 30 }),
        (user, allRecords) => {
          const result = scopedListQuery(user, allRecords);

          expect(result.success).toBe(true);
          if (!result.success) return;

          // Every returned record must belong to the user's school
          for (const record of result.records) {
            expect(record.schoolId).toBe(user.schoolId);
          }

          // No records from other schools are included
          const otherSchoolRecords = result.records.filter(
            (r) => r.schoolId !== user.schoolId
          );
          expect(otherSchoolRecords.length).toBe(0);

          // All records from the user's school must be included
          const expectedRecords = allRecords.filter(
            (r) => r.schoolId === user.schoolId
          );
          expect(result.records.length).toBe(expectedRecords.length);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('cross-school references are always rejected', () => {
    fc.assert(
      fc.property(
        arbBranchScopedStaff(),
        arbRecord(),
        (user, record) => {
          // Only test records from different schools
          fc.pre(record.schoolId !== user.schoolId);

          const result = scopedRecordReference(user, record);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('FORBIDDEN');
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('cross-branch references for branch-scoped staff are rejected', () => {
    fc.assert(
      fc.property(
        arbBranchScopedStaff(),
        arbRecord(),
        (user, record) => {
          // Record from same school but different branch
          fc.pre(record.schoolId === user.schoolId && record.branchId !== user.branchId);

          const result = scopedRecordReference(user, record);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('FORBIDDEN');
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('same-branch references for branch-scoped staff are allowed', () => {
    fc.assert(
      fc.property(
        arbBranchScopedStaff(),
        arbRecord(),
        (user, record) => {
          // Record from same branch
          fc.pre(record.schoolId === user.schoolId && record.branchId === user.branchId);

          const result = scopedRecordReference(user, record);

          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('super_admin bypasses school and branch scoping', () => {
    fc.assert(
      fc.property(
        arbSuperAdmin(),
        fc.array(arbRecord(), { minLength: 1, maxLength: 30 }),
        (superAdmin, allRecords) => {
          const result = scopedListQuery(superAdmin, allRecords);

          expect(result.success).toBe(true);
          if (!result.success) return;

          // super_admin sees all records regardless of school or branch
          expect(result.records.length).toBe(allRecords.length);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('super_admin can reference any record without rejection', () => {
    fc.assert(
      fc.property(
        arbSuperAdmin(),
        arbRecord(),
        (superAdmin, record) => {
          const result = scopedRecordReference(superAdmin, record);

          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('scoped queries return empty list (not error) when no matching records exist', () => {
    fc.assert(
      fc.property(
        arbBranchScopedStaff(),
        fc.array(arbRecord(), { minLength: 0, maxLength: 20 }),
        (user, allRecords) => {
          // Remove all records that match user's scope
          const noMatchRecords = allRecords.filter(
            (r) => r.branchId !== user.branchId || r.schoolId !== user.schoolId
          );

          const result = scopedListQuery(user, noMatchRecords);

          // Should succeed with empty list, not error
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.records.length).toBe(0);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('null-branch staff cannot see records from other schools', () => {
    fc.assert(
      fc.property(
        arbSchoolScopedStaff(),
        arbRecord(),
        (user, record) => {
          // Record from different school
          fc.pre(record.schoolId !== user.schoolId);

          const result = scopedRecordReference(user, record);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('FORBIDDEN');
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('null-branch staff can reference any record in their school', () => {
    fc.assert(
      fc.property(
        arbSchoolScopedStaff(),
        arbRecord(),
        (user, record) => {
          // Record from same school (any branch)
          fc.pre(record.schoolId === user.schoolId);

          const result = scopedRecordReference(user, record);

          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
