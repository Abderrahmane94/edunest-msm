# Design Document: Soft-Deletion

## Overview

This design implements soft-deletion across core entities (School, User, Child, Classroom) in the kindergarten management system. Records are marked with a `deletedAt` timestamp rather than being removed from the database, enabling recovery and audit trails. The system extends the existing Prisma client extension to automatically filter deleted records from all standard queries while providing admin-facing APIs and UI for managing the trash/archive.

## Architecture

The soft-deletion system is layered as follows:

1. **Schema Layer** — Prisma schema additions (`deletedAt` column + index on each core model)
2. **Data Access Layer** — Extended Prisma client middleware that injects `deletedAt IS NULL` filters into all read/write operations, with an opt-in bypass mechanism via `AsyncLocalStorage`
3. **Service Layer** — A shared `SoftDeleteService` class providing soft-delete, restore, and hard-delete operations for any core entity
4. **API Layer** — RESTful trash endpoints under `/api/trash/:entityType` for listing, restoring, and permanently deleting records
5. **UI Layer** — Admin panel Trash View page with entity type filtering, restore, and permanent delete actions

The data access layer sits alongside the existing tenant-scoping extension in `src/lib/prisma.ts`, applying soft-delete filtering after tenant scoping. This ensures all existing application code automatically excludes deleted records without modification.

## Components and Interfaces

### 1. Prisma Schema Changes

Add `deletedAt` to the four core models:

```prisma
model School {
  // ... existing fields
  deletedAt DateTime? @map("deleted_at")

  @@index([deletedAt])
  @@map("schools")
}

model User {
  // ... existing fields
  deletedAt DateTime? @map("deleted_at")

  @@index([deletedAt])
  @@map("users")
}

model Child {
  // ... existing fields
  deletedAt DateTime? @map("deleted_at")

  @@index([schoolId, academicYearId, isActive])
  @@index([deletedAt])
  @@map("children")
}

model Classroom {
  // ... existing fields
  deletedAt DateTime? @map("deleted_at")

  @@index([deletedAt])
  @@map("classrooms")
}
```

A new migration `0007_soft_deletion` will add the column and index to each table.

### 2. Prisma Extension — Soft-Delete Filtering

The existing `createTenantScopedClient()` in `src/lib/prisma.ts` will be extended to inject `deletedAt: null` into the `where` clause for all operations on soft-deletable models.

```typescript
// Models that support soft-deletion
const SOFT_DELETABLE_MODELS = new Set([
  'School',
  'User',
  'Child',
  'Classroom',
]);

// Context key to bypass soft-delete filtering
export const INCLUDE_DELETED = Symbol('includeDeleted');
```

The extension intercepts the same operations it already intercepts for tenant scoping, adding a `deletedAt: null` condition unless the caller explicitly opts in via a context flag.

**Opt-in mechanism:**

```typescript
import { softDeleteStorage } from '../lib/prisma';

// To include deleted records in a query:
softDeleteStorage.run({ includeDeleted: true }, async () => {
  const allRecords = await prisma.child.findMany({ where: { schoolId } });
  // Returns both active and soft-deleted records
});
```

This uses an `AsyncLocalStorage` instance (same pattern as `tenantStorage`) to pass the bypass flag through the call stack without modifying every function signature.

### 3. SoftDeleteService

A generic service class that handles soft-delete, restore, and hard-delete operations for any core entity model.

```typescript
// src/services/soft-delete.service.ts

import prisma, { softDeleteStorage } from '../lib/prisma';

export type SoftDeletableModel = 'school' | 'user' | 'child' | 'classroom';

export class SoftDeleteError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SoftDeleteError';
  }
}

class SoftDeleteService {
  /**
   * Soft-delete an entity by setting deletedAt to current UTC timestamp.
   * Throws if the entity is already deleted or not found.
   */
  async softDelete(model: SoftDeletableModel, id: string, schoolId?: string): Promise<void> {
    const record = await this.findIncludingDeleted(model, id, schoolId);

    if (!record) {
      throw new SoftDeleteError(`${model} not found`, 404);
    }

    if (record.deletedAt !== null) {
      throw new SoftDeleteError(`${model} is already deleted`, 409);
    }

    await (prisma[model] as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft-deleted entity by setting deletedAt to null.
   * Throws if the entity is not deleted or not found.
   */
  async restore(model: SoftDeletableModel, id: string, schoolId?: string): Promise<unknown> {
    const record = await this.findIncludingDeleted(model, id, schoolId);

    if (!record) {
      throw new SoftDeleteError(`${model} not found`, 404);
    }

    if (record.deletedAt === null) {
      throw new SoftDeleteError(`${model} is not deleted`, 409);
    }

    // Use softDeleteStorage bypass to update a deleted record
    return softDeleteStorage.run({ includeDeleted: true }, async () => {
      return (prisma[model] as any).update({
        where: { id },
        data: { deletedAt: null },
      });
    });
  }

  /**
   * Permanently delete a soft-deleted entity from the database.
   * Throws if the entity is not deleted, not found, or has referential constraints.
   */
  async hardDelete(model: SoftDeletableModel, id: string, schoolId?: string): Promise<void> {
    const record = await this.findIncludingDeleted(model, id, schoolId);

    if (!record) {
      throw new SoftDeleteError(`${model} not found`, 404);
    }

    if (record.deletedAt === null) {
      throw new SoftDeleteError(`Only deleted records can be permanently removed`, 409);
    }

    try {
      await softDeleteStorage.run({ includeDeleted: true }, async () => {
        await (prisma[model] as any).delete({ where: { id } });
      });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new SoftDeleteError(
          `Cannot permanently delete: this ${model} has dependent records that would violate referential integrity`,
          409,
        );
      }
      throw error;
    }
  }

  /**
   * List all soft-deleted records for a model within a school scope.
   */
  async listDeleted(
    model: SoftDeletableModel,
    schoolId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: unknown[]; total: number }> {
    return softDeleteStorage.run({ includeDeleted: true }, async () => {
      const where = model === 'school'
        ? { deletedAt: { not: null } }
        : { schoolId, deletedAt: { not: null } };

      const [data, total] = await Promise.all([
        (prisma[model] as any).findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { deletedAt: 'desc' },
        }),
        (prisma[model] as any).count({ where }),
      ]);

      return { data, total };
    });
  }

  /**
   * Internal helper to find a record including deleted ones.
   */
  private async findIncludingDeleted(
    model: SoftDeletableModel,
    id: string,
    schoolId?: string,
  ): Promise<any> {
    return softDeleteStorage.run({ includeDeleted: true }, async () => {
      const where: any = { id };
      if (schoolId && model !== 'school') {
        where.schoolId = schoolId;
      }
      return (prisma[model] as any).findFirst({ where });
    });
  }
}

export const softDeleteService = new SoftDeleteService();
```

### 4. Trash API Routes

```typescript
// src/modules/trash/trash.routes.ts

import { Router } from 'express';
import { trashController } from './trash.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { trashListSchema, trashActionSchema } from './trash.schema';

const router = Router();

// GET /api/trash/:entityType — List deleted records (admin only)
router.get('/:entityType', requireAdmin, validateParams(trashListSchema), trashController.list);

// POST /api/trash/:entityType/:id/restore — Restore a deleted record (admin only)
router.post('/:entityType/:id/restore', requireAdmin, validateParams(trashActionSchema), trashController.restore);

// DELETE /api/trash/:entityType/:id — Permanently delete a record (admin only)
router.delete('/:entityType/:id', requireAdmin, validateParams(trashActionSchema), trashController.hardDelete);

export default router;
```

**Route registration in `app.ts`:**
```typescript
import trashRoutes from './modules/trash/trash.routes';
// ...
app.use('/api/trash', trashRoutes);
```

### 5. Children Service Refactoring

The existing `softDelete` method in `ChildrenService` will be updated:

```typescript
// Before (current):
async softDelete(id: string, schoolId: string): Promise<void> {
  // ...
  await prisma.child.update({
    where: { id },
    data: { isActive: false },
  });
}

// After (refactored):
async softDelete(id: string, schoolId: string): Promise<void> {
  await softDeleteService.softDelete('child', id, schoolId);
}
```

The `list` method will remove the `isActive: true` filter for deletion purposes since the Prisma extension now handles exclusion of deleted records automatically:

```typescript
// Before:
where: { schoolId, isActive: true }

// After:
where: { schoolId }
// deletedAt filtering is handled by the Prisma extension
```

Note: `isActive` may still be used for business logic (e.g., temporarily deactivating a child without deleting), but it is no longer used as a proxy for deletion.

## Interfaces

### Trash API Request/Response Schemas

```typescript
// src/modules/trash/trash.schema.ts

import { z } from 'zod';

export const entityTypeEnum = z.enum(['schools', 'users', 'children', 'classrooms']);

export const trashListSchema = z.object({
  entityType: entityTypeEnum,
});

export const trashActionSchema = z.object({
  entityType: entityTypeEnum,
  id: z.string().uuid(),
});

export const trashQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

### API Response Format

**GET /api/trash/:entityType**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "deletedAt": "2024-01-15T10:30:00.000Z",
        "displayName": "Ahmed Benali",
        "entityType": "children",
        "metadata": {
          "firstName": "Ahmed",
          "lastName": "Benali",
          "dateOfBirth": "2019-05-15"
        }
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

**POST /api/trash/:entityType/:id/restore**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "deletedAt": null,
    "firstName": "Ahmed",
    "lastName": "Benali"
  }
}
```

**DELETE /api/trash/:entityType/:id**
```json
{
  "success": true,
  "data": { "message": "Record permanently deleted" }
}
```

### Error Responses

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_DELETED",
    "message": "child is already deleted"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "NOT_DELETED",
    "message": "child is not deleted"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "REFERENTIAL_INTEGRITY",
    "message": "Cannot permanently delete: this school has dependent records that would violate referential integrity"
  }
}
```

## Data Models

### Database Migration (0007_soft_deletion)

```sql
-- Add deletedAt column to core entity tables
ALTER TABLE "schools" ADD COLUMN "deleted_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP;
ALTER TABLE "children" ADD COLUMN "deleted_at" TIMESTAMP;
ALTER TABLE "classrooms" ADD COLUMN "deleted_at" TIMESTAMP;

-- Add indexes for efficient filtering
CREATE INDEX "schools_deleted_at_idx" ON "schools"("deleted_at");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX "children_deleted_at_idx" ON "children"("deleted_at");
CREATE INDEX "classrooms_deleted_at_idx" ON "classrooms"("deleted_at");
```

### Entity Display Fields for Trash View

| Entity Type | Display Fields |
|-------------|---------------|
| School | name, contactEmail, wilaya |
| User | firstName, lastName, email, role |
| Child | firstName, lastName, dateOfBirth, learnerType |
| Classroom | name, level, roomNumber |

## Error Handling

| Scenario | HTTP Status | Error Code | Message |
|----------|-------------|------------|---------|
| Entity not found | 404 | NOT_FOUND | `{model} not found` |
| Entity already deleted | 409 | ALREADY_DELETED | `{model} is already deleted` |
| Entity not deleted (restore/hard-delete) | 409 | NOT_DELETED | `{model} is not deleted` / `Only deleted records can be permanently removed` |
| Referential integrity violation | 409 | REFERENTIAL_INTEGRITY | `Cannot permanently delete: this {model} has dependent records...` |
| Unauthorized role | 403 | FORBIDDEN | `Access denied. This endpoint requires one of the following roles: super_admin, admin` |

## Soft-Delete Filtering Implementation Detail

The Prisma extension in `prisma.ts` will be modified to add soft-delete filtering alongside the existing tenant scoping. The filtering logic follows this order:

1. **Tenant scoping** (existing) — adds `schoolId` filter
2. **Soft-delete filtering** (new) — adds `deletedAt: null` filter unless bypassed

```typescript
// Updated applyTenantFilter becomes applyQueryFilters
function applyQueryFilters(
  args: Record<string, unknown>,
  model: string,
  operation: 'read' | 'create' | 'createMany'
): void {
  const tenantContext = tenantStorage.getStore();
  const softDeleteContext = softDeleteStorage.getStore();

  // Tenant scoping (existing logic)
  if (tenantContext?.schoolId && !MODELS_WITHOUT_SCHOOL_ID.has(model)) {
    if (operation === 'create') {
      args.data = { ...(args.data as Record<string, unknown>), schoolId: tenantContext.schoolId };
    } else if (operation === 'createMany') {
      // ... existing createMany logic
    } else {
      args.where = { ...(args.where as Record<string, unknown>), schoolId: tenantContext.schoolId };
    }
  }

  // Soft-delete filtering (new logic)
  if (
    SOFT_DELETABLE_MODELS.has(model) &&
    operation !== 'create' &&
    operation !== 'createMany' &&
    !softDeleteContext?.includeDeleted
  ) {
    args.where = { ...(args.where as Record<string, unknown>), deletedAt: null };
  }
}
```

## Testing Strategy

**Unit Tests (Vitest):**
- SoftDeleteService methods: soft-delete, restore, hard-delete with mocked Prisma
- Prisma extension filtering logic: verify `deletedAt: null` is injected correctly
- Trash controller: request validation, response formatting
- Children service refactoring: verify new behavior matches requirements

**Property-Based Tests (Vitest + fast-check):**
- Automatic query filtering: generate random record sets with mixed deletedAt states, verify filtering
- Round-trip properties: soft-delete then restore returns to original state
- State guard properties: operations on wrong state always produce errors
- No-cascade properties: related entities remain unchanged after operations
- Role-based access: non-admin roles always get 403

**Integration Tests:**
- End-to-end trash API flow: create → soft-delete → list in trash → restore → verify active
- Hard-delete with referential integrity violations
- Pagination on trash listing endpoint

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Soft-delete preserves isActive independence

*For any* core entity (School, User, Child, or Classroom) with any value of `isActive`, performing a soft-delete operation SHALL set `deletedAt` to a non-null timestamp while leaving the `isActive` field completely unchanged.

**Validates: Requirements 1.2, 3.3, 8.2**

### Property 2: Automatic exclusion of deleted records from standard queries

*For any* set of core entity records where some have `deletedAt` set to a non-null value, all standard read operations (`findMany`, `findFirst`, `findUnique`, `count`, `aggregate`) SHALL return only records where `deletedAt` is null.

**Validates: Requirements 2.1**

### Property 3: Automatic exclusion of deleted records from write operations

*For any* core entity record with a non-null `deletedAt` value, standard write operations (`update`, `updateMany`, `delete`, `deleteMany`) SHALL not affect that record.

**Validates: Requirements 2.2**

### Property 4: Opt-in bypass returns all records

*For any* set of core entity records with mixed `deletedAt` states (some null, some non-null), queries executed within the `includeDeleted` context SHALL return all records regardless of their `deletedAt` value.

**Validates: Requirements 2.3**

### Property 5: Soft-delete and restore round-trip

*For any* active core entity, performing a soft-delete followed by a restore operation SHALL result in the entity having `deletedAt` equal to null, effectively returning it to its original active state.

**Validates: Requirements 3.1, 4.1**

### Property 6: No cascade on soft-delete or restore

*For any* core entity that has related records, performing a soft-delete or restore operation on that entity SHALL NOT modify the `deletedAt` field of any related entities.

**Validates: Requirements 3.2, 4.2**

### Property 7: Operation state guards

*For any* core entity that is already a Deleted_Record, attempting to soft-delete it again SHALL return an error. Conversely, *for any* core entity that is an Active_Record, attempting to restore or hard-delete it SHALL return an error.

**Validates: Requirements 3.4, 4.3, 5.3**

### Property 8: Hard-delete removes record permanently

*For any* soft-deleted core entity with no dependent records, performing a hard-delete SHALL remove the record from the database such that it is no longer retrievable even with the `includeDeleted` bypass.

**Validates: Requirements 5.1**

### Property 9: Admin-only access for trash operations

*For any* user with a role other than `admin` or `super_admin`, all trash-related API operations (list deleted, restore, hard-delete) SHALL return a 403 Forbidden response.

**Validates: Requirements 5.2, 6.4**

### Property 10: Trash listing returns exactly deleted records within school scope

*For any* school with a mix of active and soft-deleted records of a given entity type, the trash listing endpoint SHALL return exactly the records where `deletedAt` is non-null, scoped to that school, respecting pagination bounds.

**Validates: Requirements 6.1, 6.2, 6.3**
