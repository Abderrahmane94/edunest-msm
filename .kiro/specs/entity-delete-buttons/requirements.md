# Requirements Document

## Introduction

This feature adds a soft-delete button to the admin panel detail pages for all four core entity types (Schools, Users, Children, Classrooms). The button is placed near the existing activate/deactivate toggle or danger zone section on each entity's detail page. Clicking the button triggers the existing backend soft-delete operation (sets `deletedAt` timestamp), which causes the entity to disappear from normal views and appear in the Trash View. The feature includes a confirmation dialog, loading states, error handling, and full i18n support (Arabic + French) with RTL layout compatibility.

## Glossary

- **Delete_Button**: A UI button component rendered on each core entity detail page that triggers the soft-delete operation for that entity.
- **Confirmation_Dialog**: A modal dialog displayed after the user clicks the Delete_Button, requiring explicit confirmation before executing the soft-delete operation.
- **Entity_Detail_Page**: One of the four admin panel pages that display and allow editing of a single core entity: SchoolDetailPage, UserDetailPage, ChildDetailPage, or ClassroomDetailPage.
- **Soft_Delete_Action**: The frontend mutation that calls the backend API to set the `deletedAt` timestamp on a core entity, making it invisible in standard queries.
- **Admin_User**: A user with the `admin` or `super_admin` role who has access to entity management pages.
- **Core_Entity**: One of the four primary models: School, User, Child, or Classroom.

## Requirements

### Requirement 1: Delete Button Placement

**User Story:** As an admin, I want a clearly visible delete button on each entity detail page near the activate/deactivate control, so that I can soft-delete entities without navigating to a separate interface.

#### Acceptance Criteria

1. THE Delete_Button SHALL be rendered on the SchoolDetailPage within the same card section as the activate/deactivate control.
2. THE Delete_Button SHALL be rendered on the UserDetailPage in the actions bar alongside the existing activate/deactivate button.
3. THE Delete_Button SHALL be rendered on the ChildDetailPage in the existing danger zone section, replacing the current hard-delete button with a soft-delete action.
4. THE Delete_Button SHALL be rendered on the ClassroomDetailPage in the existing danger zone section, replacing the current hard-delete button with a soft-delete action.
5. THE Delete_Button SHALL display a trash icon and a localized label that reads the translation key for "delete" in the current locale.
6. IF the Core_Entity is already a Deleted_Record, THEN THE Delete_Button SHALL be hidden on the entity detail page.
7. THE Delete_Button SHALL be styled as a destructive secondary action using the danger color token and SHALL be visually distinct from the activate/deactivate control.

### Requirement 2: Confirmation Dialog

**User Story:** As an admin, I want a confirmation dialog before soft-deleting an entity, so that I do not accidentally delete records.

#### Acceptance Criteria

1. WHEN an Admin_User clicks the Delete_Button, THE Confirmation_Dialog SHALL appear with a warning message stating that the entity will be soft-deleted and hidden from normal views but can be restored later from the Trash_View.
2. THE Confirmation_Dialog SHALL display the entity type and entity name or identifier in the warning message so the Admin_User can verify the correct entity is being deleted.
3. THE Confirmation_Dialog SHALL provide a confirm button and a cancel button.
4. WHEN the Admin_User clicks the cancel button or presses the Escape key or clicks outside the dialog, THE Confirmation_Dialog SHALL close without performing any action and without modifying any data.
5. WHEN the Admin_User clicks the confirm button, THE Confirmation_Dialog SHALL disable both buttons and display a loading indicator while the Soft_Delete_Action is executed against the backend API for the targeted entity.
6. WHEN the backend API returns a successful response to the Soft_Delete_Action, THE Confirmation_Dialog SHALL close and the entity SHALL be removed from the current list view.
7. IF the backend API returns an error response to the Soft_Delete_Action, THEN THE Confirmation_Dialog SHALL remain open, re-enable both buttons, and display an error message indicating that the deletion failed.
8. WHILE the Soft_Delete_Action is in progress, THE Confirmation_Dialog SHALL prevent duplicate submissions by keeping the confirm button disabled until the API responds.

### Requirement 3: Soft-Delete API Integration

**User Story:** As an admin, I want the delete button to call the correct backend soft-delete endpoint for each entity type, so that the entity is properly marked as deleted.

#### Acceptance Criteria

1. WHEN the Soft_Delete_Action is triggered for a Child entity, THE Entity_Detail_Page SHALL send a DELETE request to `/api/children/:id` which delegates to the SoftDeleteService.
2. WHEN the Soft_Delete_Action is triggered for a Classroom entity, THE Entity_Detail_Page SHALL send a DELETE request to `/api/classrooms/:id` which delegates to the SoftDeleteService.
3. WHEN the Soft_Delete_Action is triggered for a User entity, THE Entity_Detail_Page SHALL send a DELETE request to `/api/users/:id` which delegates to the SoftDeleteService.
4. WHEN the Soft_Delete_Action is triggered for a School entity, THE Entity_Detail_Page SHALL send a DELETE request to `/api/schools/:id` which delegates to the SoftDeleteService.
5. WHEN the Soft_Delete_Action completes successfully, THE Entity_Detail_Page SHALL navigate the Admin_User back to the corresponding entity list page within 2 seconds of receiving the success response.
6. WHEN the Soft_Delete_Action completes successfully, THE Entity_Detail_Page SHALL invalidate the relevant TanStack Query cache entries so the deleted entity no longer appears in list views.
7. IF the Soft_Delete_Action returns an error response (entity not found, entity already deleted, or network failure), THEN THE Entity_Detail_Page SHALL display an error message indicating the reason for failure and SHALL NOT navigate away from the current page.
8. WHEN the Admin_User triggers the Soft_Delete_Action, THE Entity_Detail_Page SHALL disable the delete button and display a loading indicator until the request completes or fails.
9. IF the Admin_User triggers the Soft_Delete_Action, THEN THE Entity_Detail_Page SHALL display a confirmation dialog before sending the DELETE request to the backend.

### Requirement 4: Loading and Error States

**User Story:** As an admin, I want clear feedback during and after the delete operation, so that I know whether the action succeeded or failed.

#### Acceptance Criteria

1. WHILE the Soft_Delete_Action is in progress, THE Confirmation_Dialog SHALL disable the confirm button and display a loading indicator.
2. WHILE the Soft_Delete_Action is in progress, THE Confirmation_Dialog SHALL prevent the Admin_User from closing the dialog or clicking the cancel button.
3. WHEN the Soft_Delete_Action completes successfully, THE Confirmation_Dialog SHALL close and THE Entity_Detail_Page SHALL display a success notification indicating the entity has been deleted.
4. IF the Soft_Delete_Action returns an error, THEN THE Confirmation_Dialog SHALL close and THE Entity_Detail_Page SHALL display an error notification describing the failure, visible until the Admin_User dismisses it.
5. IF the Soft_Delete_Action returns an error indicating the entity is already deleted, THEN THE Entity_Detail_Page SHALL display a notification indicating the entity has already been deleted and refresh the page state to reflect the current entity status.
6. WHEN the Soft_Delete_Action completes successfully, THE Entity_Detail_Page SHALL update its view within 1 second to reflect that the entity is no longer an Active_Record.

### Requirement 5: Internationalization and RTL Support

**User Story:** As an admin using the system in Arabic or French, I want all delete-related UI text to be properly translated and laid out, so that the feature is fully usable in both languages.

#### Acceptance Criteria

1. THE Delete_Button label, Confirmation_Dialog title, warning message, confirm button text, and cancel button text SHALL be available as non-empty translation keys in both the Arabic (`ar/common.json`) and French (`fr/common.json`) translation files.
2. WHILE the application language is set to Arabic, THE Delete_Button and Confirmation_Dialog SHALL render in right-to-left layout with the delete icon placed at the inline-end position, text aligned to inline-start, and the Confirmation_Dialog content flowing right-to-left matching the document `dir="rtl"` attribute.
3. THE Delete_Button SHALL use the same styling conventions (icon placement, spacing, color tokens) as the existing activate/deactivate buttons on the School, User, Child, and Classroom detail pages.
4. IF a delete-related translation key is missing from the active language file, THEN THE system SHALL fall back to the French translation for that key rather than displaying a raw translation key identifier.

### Requirement 6: Reusable Delete Button Component

**User Story:** As a developer, I want a single reusable component for the soft-delete button and confirmation dialog, so that the implementation is consistent across all entity pages and easy to maintain.

#### Acceptance Criteria

1. THE Delete_Button and Confirmation_Dialog SHALL be implemented as a single reusable React component that accepts the entity type (one of "schools", "users", "children", "classrooms"), entity ID, entity display name, and a navigation callback as props.
2. THE reusable component SHALL encapsulate the TanStack Query mutation for the soft-delete API call, confirmation state, loading state, and error state internally, displaying an inline error message when the mutation fails and clearing the error when the user initiates a new deletion attempt.
3. THE reusable component SHALL be used on the SchoolDetailPage, UserDetailPage, ChildDetailPage, and ClassroomDetailPage without duplicating mutation logic, confirmation state management, or error handling outside the component.
4. WHEN the user clicks the delete button, THE reusable component SHALL display a confirmation prompt with a confirm action and a cancel action before executing the soft-delete mutation.
5. WHEN the soft-delete mutation completes successfully, THE reusable component SHALL invoke the navigation callback to redirect the user away from the detail page.
