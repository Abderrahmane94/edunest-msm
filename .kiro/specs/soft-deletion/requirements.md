# Requirements Document

## Introduction

This feature introduces soft-deletion across core entities (School, User, Child, Classroom) in the kindergarten management system. Soft-deleted records are excluded from normal queries but remain in the database with a `deletedAt` timestamp. Admins can view soft-deleted records in a trash/archive view and either restore them or permanently delete them. The existing `isActive` field remains separate from deletion status. No cascade behavior applies — only the explicitly targeted entity receives the `deletedAt` timestamp.

## Glossary

- **Soft_Delete_System**: The backend subsystem responsible for marking entities as deleted by setting a `deletedAt` timestamp, filtering them from standard queries, and supporting restore and permanent deletion operations.
- **Core_Entity**: One of the four primary models subject to soft-deletion: School, User, Child, or Classroom.
- **Deleted_Record**: A Core_Entity row whose `deletedAt` field contains a non-null timestamp value.
- **Active_Record**: A Core_Entity row whose `deletedAt` field is null.
- **Trash_View**: The admin panel interface that displays all Deleted_Records for a given school, supporting restore and permanent deletion actions.
- **Restore_Operation**: The action of setting a Deleted_Record's `deletedAt` field back to null, making the record visible in standard queries again.
- **Hard_Delete_Operation**: The permanent removal of a Deleted_Record from the database.
- **Prisma_Extension**: The existing Prisma client extension in `prisma.ts` that intercepts all database queries for tenant scoping.
- **Admin_User**: A user with the `admin` or `super_admin` role.

## Requirements

### Requirement 1: Schema Extension

**User Story:** As a developer, I want a `deletedAt` nullable timestamp column on core entities, so that soft-deletion state is tracked independently from the `isActive` flag.

#### Acceptance Criteria

1. THE Soft_Delete_System SHALL add a nullable `deletedAt` column of type `DateTime` to the School, User, Child, and Classroom models in the Prisma schema.
2. THE Soft_Delete_System SHALL keep the existing `isActive` field unchanged and independent from the `deletedAt` field on all Core_Entity models.
3. THE Soft_Delete_System SHALL add a database index on the `deletedAt` column for each Core_Entity model to support efficient filtering.

### Requirement 2: Automatic Query Filtering

**User Story:** As a developer, I want soft-deleted records automatically excluded from all standard read queries, so that application code does not need to manually filter them.

#### Acceptance Criteria

1. THE Prisma_Extension SHALL exclude Deleted_Records from `findMany`, `findFirst`, `findUnique`, `count`, and `aggregate` operations on Core_Entity models by default.
2. THE Prisma_Extension SHALL exclude Deleted_Records from `update`, `updateMany`, `delete`, and `deleteMany` operations on Core_Entity models by default.
3. THE Soft_Delete_System SHALL provide an explicit opt-in mechanism to include Deleted_Records in queries when the caller requires access to soft-deleted data.

### Requirement 3: Soft-Delete Operation

**User Story:** As an admin, I want to soft-delete a record so that it is hidden from normal views but can be recovered later.

#### Acceptance Criteria

1. WHEN an Admin_User requests deletion of a Core_Entity, THE Soft_Delete_System SHALL set the `deletedAt` field to the current UTC timestamp on that entity only.
2. THE Soft_Delete_System SHALL NOT modify the `deletedAt` field of any related entities when a Core_Entity is soft-deleted.
3. WHEN a soft-delete operation is performed on a Core_Entity, THE Soft_Delete_System SHALL leave the `isActive` field unchanged.
4. IF the targeted Core_Entity is already a Deleted_Record, THEN THE Soft_Delete_System SHALL return an error indicating the record is already deleted.

### Requirement 4: Restore Operation

**User Story:** As an admin, I want to restore a soft-deleted record from the trash view, so that accidentally deleted data can be recovered.

#### Acceptance Criteria

1. WHEN an Admin_User requests restoration of a Deleted_Record, THE Soft_Delete_System SHALL set the `deletedAt` field to null on that entity.
2. THE Soft_Delete_System SHALL NOT modify any related entities during a Restore_Operation.
3. IF the targeted entity is an Active_Record, THEN THE Soft_Delete_System SHALL return an error indicating the record is not deleted.
4. WHEN a Restore_Operation completes successfully, THE Soft_Delete_System SHALL return the restored entity data in the response.

### Requirement 5: Hard Delete (Permanent Deletion)

**User Story:** As an admin, I want to permanently delete a record from the trash, so that I can remove data that is no longer needed.

#### Acceptance Criteria

1. WHEN an Admin_User requests permanent deletion of a Deleted_Record, THE Soft_Delete_System SHALL remove the record from the database.
2. THE Soft_Delete_System SHALL restrict Hard_Delete_Operation access to users with the `admin` or `super_admin` role.
3. IF the targeted entity is an Active_Record, THEN THE Soft_Delete_System SHALL return an error indicating only Deleted_Records can be permanently deleted.
4. IF the targeted Deleted_Record has dependent records that would violate referential integrity, THEN THE Soft_Delete_System SHALL return an error describing the constraint violation.

### Requirement 6: Trash View API

**User Story:** As an admin, I want an API endpoint to list all soft-deleted records, so that the admin panel can display a trash/archive view.

#### Acceptance Criteria

1. THE Soft_Delete_System SHALL provide an API endpoint that returns all Deleted_Records for a given Core_Entity type within the current school scope.
2. THE Soft_Delete_System SHALL support pagination parameters (page, pageSize) on the trash listing endpoint.
3. THE Soft_Delete_System SHALL return the `deletedAt` timestamp, entity identifier, and display-relevant fields for each Deleted_Record in the response.
4. THE Soft_Delete_System SHALL restrict access to the trash listing endpoint to Admin_User roles only.

### Requirement 7: Trash View UI (Admin Panel)

**User Story:** As an admin, I want a trash/archive section in the admin panel, so that I can browse, restore, and permanently delete soft-deleted records.

#### Acceptance Criteria

1. THE Trash_View SHALL display a list of Deleted_Records grouped or filterable by Core_Entity type.
2. THE Trash_View SHALL provide a restore action button for each Deleted_Record.
3. THE Trash_View SHALL provide a permanent delete action button for each Deleted_Record.
4. WHEN an Admin_User clicks the permanent delete button, THE Trash_View SHALL display a confirmation dialog before executing the Hard_Delete_Operation.
5. THE Trash_View SHALL display the `deletedAt` timestamp for each Deleted_Record in a human-readable format.

### Requirement 8: Children Service Refactoring

**User Story:** As a developer, I want the existing children soft-delete logic refactored to use the new `deletedAt` pattern, so that deletion behavior is consistent across all core entities.

#### Acceptance Criteria

1. THE Soft_Delete_System SHALL replace the existing `softDelete` method in the children service that sets `isActive=false` with the new `deletedAt` timestamp approach.
2. WHEN the children service soft-delete method is called, THE Soft_Delete_System SHALL set `deletedAt` to the current UTC timestamp and leave `isActive` unchanged.
3. THE Soft_Delete_System SHALL ensure all existing children queries that previously filtered by `isActive` for deletion purposes use the `deletedAt` filter instead.
