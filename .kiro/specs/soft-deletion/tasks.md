# Implementation Plan: Soft-Deletion

## Overview

Implement soft-deletion across core entities (School, User, Child, Classroom) by adding a `deletedAt` timestamp column, extending the Prisma client to automatically filter deleted records, creating a shared `SoftDeleteService`, exposing trash management API endpoints, refactoring the children service, and building an admin Trash View UI page.

## Tasks

- [x] 1. Schema and data access layer
  - [x] 1.1 Add `deletedAt` column to Prisma schema and create migration
    - Add nullable `deletedAt DateTime?` field mapped to `deleted_at` on School, User, Child, and Classroom models
    - Add `@@index([deletedAt])` to each model
    - Generate migration `0007_soft_deletion`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Extend Prisma client with soft-delete filtering
    - Create `AsyncLocalStorage` instance `softDeleteStorage` in `src/lib/prisma.ts`
    - Export `SOFT_DELETABLE_MODELS` set containing `'School'`, `'User'`, `'Child'`, `'Classroom'`
    - Modify `applyTenantFilter` (rename to `applyQueryFilters`) to inject `deletedAt: null` into `where` for read/update/delete operations on soft-deletable models
    - Skip soft-delete filtering when `softDeleteContext?.includeDeleted` is true
    - Skip soft-delete filtering for `create` and `createMany` operations
    - Export `softDeleteStorage` for use by other modules
    - _Requirements: 2.1, 2.2, 2.3_

  - [x]* 1.3 Write property tests for automatic query filtering
    - **Property 2: Automatic exclusion of deleted records from standard queries**
    - **Property 3: Automatic exclusion of deleted records from write operations**
    - **Property 4: Opt-in bypass returns all records**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. Soft-delete service layer
  - [x] 2.1 Implement `SoftDeleteService` class
    - Create `src/services/soft-delete.service.ts`
    - Implement `softDelete(model, id, schoolId?)` — sets `deletedAt` to current UTC timestamp
    - Implement `restore(model, id, schoolId?)` — sets `deletedAt` to null using `includeDeleted` bypass
    - Implement `hardDelete(model, id, schoolId?)` — permanently removes record, catches P2003 referential integrity errors
    - Implement `listDeleted(model, schoolId, page, pageSize)` — returns paginated deleted records
    - Implement private `findIncludingDeleted(model, id, schoolId?)` helper
    - Export `SoftDeleteError` class with `statusCode` property
    - Export singleton `softDeleteService` instance
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4_

  - [x]* 2.2 Write property test for soft-delete and restore round-trip
    - **Property 5: Soft-delete and restore round-trip**
    - **Validates: Requirements 3.1, 4.1**

  - [x]* 2.3 Write property test for operation state guards
    - **Property 7: Operation state guards**
    - **Validates: Requirements 3.4, 4.3, 5.3**

  - [x]* 2.4 Write property test for no-cascade behavior
    - **Property 6: No cascade on soft-delete or restore**
    - **Validates: Requirements 3.2, 4.2**

  - [x]* 2.5 Write property test for hard-delete permanence
    - **Property 8: Hard-delete removes record permanently**
    - **Validates: Requirements 5.1**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Trash API module
  - [x] 4.1 Create trash validation schemas
    - Create `src/modules/trash/trash.schema.ts`
    - Define `entityTypeEnum` with values `'schools'`, `'users'`, `'children'`, `'classrooms'`
    - Define `trashListSchema` for params validation (entityType)
    - Define `trashActionSchema` for params validation (entityType + uuid id)
    - Define `trashQuerySchema` for query params (page, pageSize with defaults)
    - _Requirements: 6.1, 6.2_

  - [x] 4.2 Implement trash controller
    - Create `src/modules/trash/trash.controller.ts`
    - Implement `list` handler — maps plural entityType to model name, calls `softDeleteService.listDeleted`, formats response with display fields per entity type
    - Implement `restore` handler — calls `softDeleteService.restore`, returns restored entity
    - Implement `hardDelete` handler — calls `softDeleteService.hardDelete`, returns success message
    - Handle `SoftDeleteError` by returning appropriate HTTP status and error code
    - _Requirements: 4.4, 5.1, 5.4, 6.1, 6.3_

  - [x] 4.3 Create trash routes and register in app
    - Create `src/modules/trash/trash.routes.ts`
    - `GET /:entityType` — list deleted records (admin only)
    - `POST /:entityType/:id/restore` — restore a deleted record (admin only)
    - `DELETE /:entityType/:id` — permanently delete a record (admin only)
    - Apply `requireAdmin` middleware to all routes
    - Register routes in `src/app.ts` as `app.use('/api/trash', trashRoutes)`
    - _Requirements: 5.2, 6.4_

  - [x]* 4.4 Write property test for admin-only access
    - **Property 9: Admin-only access for trash operations**
    - **Validates: Requirements 5.2, 6.4**

  - [x]* 4.5 Write property test for trash listing correctness
    - **Property 10: Trash listing returns exactly deleted records within school scope**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 5. Children service refactoring
  - [x] 5.1 Refactor children service to use `SoftDeleteService`
    - Replace `softDelete` method body to call `softDeleteService.softDelete('child', id, schoolId)`
    - Remove `isActive: false` logic from the `softDelete` method
    - Remove `isActive: true` filter from `list` method (Prisma extension now handles exclusion)
    - Keep `isActive` field for business logic (deactivation) but decouple from deletion
    - Update `enrollInClassroom` to remove `isActive: true` from child lookup (rely on Prisma extension)
    - _Requirements: 8.1, 8.2, 8.3_

  - [x]* 5.2 Write property test for isActive independence
    - **Property 1: Soft-delete preserves isActive independence**
    - **Validates: Requirements 1.2, 3.3, 8.2**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Trash View UI (Admin Panel)
  - [x] 7.1 Create `useTrash` hook for trash API integration
    - Create `frontend/src/hooks/useTrash.ts`
    - Implement `useTrashList(entityType, page, pageSize)` query hook — calls `GET /api/trash/:entityType`
    - Implement `useRestoreRecord()` mutation — calls `POST /api/trash/:entityType/:id/restore`
    - Implement `useHardDeleteRecord()` mutation — calls `DELETE /api/trash/:entityType/:id`
    - Invalidate `['trash']` queries on successful mutations
    - _Requirements: 6.1, 7.1, 7.2, 7.3_

  - [x] 7.2 Create `TrashPage` component
    - Create `frontend/src/pages/admin/TrashPage.tsx`
    - Add entity type filter tabs/dropdown (Schools, Users, Children, Classrooms)
    - Display paginated table of deleted records with `deletedAt` in human-readable format
    - Show display-relevant fields per entity type (name, email, etc.)
    - Add restore action button per row
    - Add permanent delete action button per row with confirmation dialog
    - Apply EduNest design system tokens, RTL support, dense admin layout
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 7.3 Register TrashPage in router and admin navigation
    - Add route `{ path: 'trash', element: <TrashPage /> }` to admin children routes in `src/router/index.tsx`
    - Add `{ label: 'nav.trash', href: '/admin/trash', icon: Trash2 }` to admin nav items
    - Add i18n translation keys for `nav.trash` in both `ar` and `fr` locales
    - Export `TrashPage` from `src/pages/admin/index.ts`
    - _Requirements: 7.1_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Prisma extension approach ensures all existing application code automatically excludes deleted records without modification
- The `isActive` field remains independent from soft-deletion for business logic purposes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.2", "5.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "5.2"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2"] },
    { "id": 7, "tasks": ["7.3"] }
  ]
}
```
