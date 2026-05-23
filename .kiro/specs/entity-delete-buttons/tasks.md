# Implementation Plan: Entity Delete Buttons

## Overview

Add a reusable `EntityDeleteButton` component to the admin panel that encapsulates a danger-styled soft-delete button, confirmation dialog, TanStack Query mutation, loading/error states, and post-deletion navigation. Integrate it into the four core entity detail pages (Schools, Users, Children, Classrooms) and add the required i18n translation keys for Arabic and French.

## Tasks

- [x] 1. Create the reusable EntityDeleteButton component
  - [x] 1.1 Create `EntityDeleteButton.tsx` in `frontend/src/components/ui/`
    - Define the `EntityDeleteButtonProps` interface with `entityType`, `entityId`, `entityDisplayName`, `onDeleted`, and `hidden` props
    - Implement the internal `useSoftDelete` hook using TanStack Query `useMutation` calling `apiClient.delete(/${entityType}/${entityId})`
    - Render a danger-styled `<Button>` with `<Trash2>` icon from lucide-react and localized label `t('common.softDelete.button')`
    - If `hidden` is true or `entityId` is empty, render nothing
    - On click, open the internal confirmation dialog
    - On mutation success, invalidate relevant query keys (`[entityType]` and `['trash', entityType]`) and invoke `onDeleted` callback
    - On mutation error, extract error message from API response or fall back to `t('common.softDelete.errorGeneric')`
    - Handle 409 `ALREADY_DELETED` error specially: close dialog, show notification, invalidate entity query
    - Clear error state when dialog is re-opened for a new attempt
    - Style button using danger color token, visually distinct from activate/deactivate controls
    - _Requirements: 1.5, 1.6, 1.7, 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.2 Implement the `ConfirmDeleteDialog` internal sub-component
    - Compose using existing `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` components
    - Display title: `t('common.softDelete.dialogTitle')`
    - Display warning message with interpolated entity type and display name: `t('common.softDelete.dialogWarning', { entityType, entityName })`
    - Render Cancel button (`t('common.softDelete.dialogCancel')`) and Confirm button (`t('common.softDelete.dialogConfirm')`, danger variant)
    - While mutation is pending: disable both buttons, show spinner on confirm button, block dialog close (Escape/overlay)
    - On error: display error in a danger alert card above the footer, re-enable buttons
    - On cancel: close dialog without side effects
    - Ensure RTL layout compatibility using logical properties (inline-start/end) for icon and text placement
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 4.1, 4.2, 5.2, 5.3_

  - [ ]* 1.3 Write property tests for EntityDeleteButton
    - **Property 1: Hidden when already deleted** — Generate random entity objects with non-null `deletedAt`, verify component renders nothing
    - **Property 2: Confirmation dialog displays entity identity** — Generate random entity types × random display names, verify both appear in dialog warning
    - **Property 3: Error prevents navigation and displays message** — Generate random error strings, verify error shown and `onDeleted` not invoked
    - **Property 6: Component renders for all valid prop combinations** — Generate random valid entity types × UUIDs × display names × callbacks, verify renders without error
    - **Property 7: Error clears on retry** — Generate sequences of failed-then-retried attempts, verify error cleared before new mutation
    - **Property 8: Navigation callback invoked exactly once on success** — Generate random entity types × callbacks, verify callback invoked once
    - **Validates: Requirements 1.6, 2.2, 2.7, 3.5, 3.7, 6.1, 6.2, 6.5**

  - [ ]* 1.4 Write unit tests for EntityDeleteButton
    - Test button renders with correct icon and label
    - Test button hidden when `hidden={true}`
    - Test button hidden when `entityId` is empty
    - Test dialog opens on button click
    - Test dialog closes on cancel click
    - Test dialog closes on Escape key press
    - Test loading state disables buttons and shows spinner
    - Test success flow: dialog closes, `onDeleted` invoked
    - Test error flow: dialog stays open, error message displayed, buttons re-enabled
    - Test 409 already-deleted handling
    - _Requirements: 1.5, 1.6, 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.3, 4.4, 4.5, 6.1_

- [x] 2. Add i18n translation keys for soft-delete UI
  - [x] 2.1 Add French translation keys to `frontend/src/i18n/locales/fr/common.json`
    - Add `common.softDelete.button`, `dialogTitle`, `dialogWarning`, `dialogConfirm`, `dialogCancel`, `success`, `errorAlreadyDeleted`, `errorNotFound`, `errorGeneric`
    - Add `common.entityTypes.schools`, `users`, `children`, `classrooms`
    - _Requirements: 5.1, 5.4_

  - [x] 2.2 Add Arabic translation keys to `frontend/src/i18n/locales/ar/common.json`
    - Add same keys as French with proper Arabic translations
    - Ensure text is appropriate for RTL rendering
    - _Requirements: 5.1, 5.2_

  - [ ]* 2.3 Write property test for translation completeness
    - **Property 5: Translation completeness** — Enumerate all required soft-delete translation keys, verify both Arabic and French locale files contain non-empty string values for each key
    - **Validates: Requirements 5.1**

- [x] 3. Checkpoint - Ensure component and translations are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate EntityDeleteButton into entity detail pages
  - [x] 4.1 Integrate into `SchoolDetailPage.tsx`
    - Import `EntityDeleteButton` from `components/ui`
    - Place inside the "Access Control" card section, below the activate/deactivate toggle
    - Pass `entityType="schools"`, `entityId` from route params, `entityDisplayName` from school data, `onDeleted` navigating to `/admin/schools`
    - Set `hidden={!!school.deletedAt}`
    - _Requirements: 1.1, 1.6, 3.4, 3.5, 3.6, 6.3_

  - [x] 4.2 Integrate into `UserDetailPage.tsx`
    - Import `EntityDeleteButton` from `components/ui`
    - Place in the actions bar alongside the existing activate/deactivate button
    - Pass `entityType="users"`, `entityId`, `entityDisplayName` (user's full name), `onDeleted` navigating to `/admin/users`
    - Set `hidden={!!user.deletedAt}`
    - _Requirements: 1.2, 1.6, 3.3, 3.5, 3.6, 6.3_

  - [x] 4.3 Integrate into `ChildDetailPage.tsx`
    - Import `EntityDeleteButton` from `components/ui`
    - Place in the danger zone section, replacing the existing hard-delete button
    - Pass `entityType="children"`, `entityId`, `entityDisplayName` (child's name), `onDeleted` navigating to `/admin/children`
    - Set `hidden={!!child.deletedAt}`
    - _Requirements: 1.3, 1.6, 3.1, 3.5, 3.6, 6.3_

  - [x] 4.4 Integrate into `ClassroomDetailPage.tsx`
    - Import `EntityDeleteButton` from `components/ui`
    - Place in the danger zone section, replacing the existing hard-delete button
    - Pass `entityType="classrooms"`, `entityId`, `entityDisplayName` (classroom name), `onDeleted` navigating to `/admin/classrooms`
    - Set `hidden={!!classroom.deletedAt}`
    - _Requirements: 1.4, 1.6, 3.2, 3.5, 3.6, 6.3_

  - [ ]* 4.5 Write property test for cache invalidation
    - **Property 4: Correct cache invalidation per entity type** — Generate random entity types, verify correct query keys invalidated on successful deletion
    - **Validates: Requirements 3.6**

  - [ ]* 4.6 Write integration tests for delete flow
    - Test end-to-end flow on each detail page: click delete → confirm → verify API call → verify navigation
    - Test that cache invalidation causes list page to exclude deleted entity
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 5. Export EntityDeleteButton from UI barrel file
  - [x] 5.1 Add export to `frontend/src/components/ui/index.ts`
    - Export `EntityDeleteButton` component and `EntityDeleteButtonProps` type
    - _Requirements: 6.1, 6.3_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend soft-delete endpoints already exist — no backend changes needed
- The existing `Dialog` component set is reused (no new modal primitive)
- All styling uses semantic color tokens and TailwindCSS utility classes per the EduNest design system

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2"] },
    { "id": 1, "tasks": ["1.2", "5.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.3"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["4.5", "4.6"] }
  ]
}
```
