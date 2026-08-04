# Requirements Document

## Introduction

This feature extends the child registration endpoint (POST /api/children) to optionally create a payment Enrollment and its associated Billing_Periods in the same atomic operation. Currently, enrollment is a separate step performed from a dedicated Enrollments page after a child already exists. By embedding optional enrollment fields directly in the child creation payload, administrative staff can register a child and set up billing in a single form submission, reducing workflow steps and eliminating the window where a child exists without billing configured.

The enrollment fields are strictly optional. When omitted, the endpoint behaves exactly as it does today — creating a child record with no payment enrollment. When provided, the system validates branch billing configuration, generates billing periods, and commits both the child record and the enrollment atomically.

## Glossary

- **Child_Service**: The backend subsystem responsible for child registration, updates, soft deletion, classroom enrollment, and parent linking.
- **Enrollment_Service**: The backend subsystem responsible for creating Enrollment records and generating associated Billing_Periods within a database transaction.
- **Child_Creation_Endpoint**: The POST /api/children HTTP endpoint that registers a new child for a school.
- **Enrollment_Payload**: The optional object within the child creation request body containing branchId, startDate, recurringFee, registrationFee, and firstPeriodAmountDue fields.
- **Branch_Billing_Config**: The per-Branch configuration record containing billing_cycle, billing_due_day, grace_period_days, and default_recurring_fee.
- **Billing_Period**: A dated financial obligation generated from an Enrollment, carrying period boundaries, due dates, and amount owed.
- **Auto_Enrollment_Transaction**: The single database transaction encompassing child creation, enrollment creation, and billing period generation.

## Requirements

### Requirement 1: Optional Enrollment Payload in Child Creation Request

**User Story:** As an administrator, I want to include enrollment details when registering a child, so that billing is configured immediately without navigating to a separate page.

#### Acceptance Criteria

1. THE Child_Creation_Endpoint SHALL accept an optional `enrollment` object in the request body alongside existing child fields.
2. WHEN the `enrollment` object is absent or null, THE Child_Creation_Endpoint SHALL create only the child record and return the same response as the current implementation.
3. WHEN the `enrollment` object is present, THE Child_Creation_Endpoint SHALL validate that the object contains a required `branchId` field and a required `startDate` field.
4. WHEN the `enrollment` object is present, THE Child_Creation_Endpoint SHALL accept optional `recurringFee`, `registrationFee`, and `firstPeriodAmountDue` fields within the enrollment object.

### Requirement 2: Atomic Transaction for Child and Enrollment Creation

**User Story:** As an administrator, I want the child record and enrollment to be created together or not at all, so that the system never contains a child with a partially-created enrollment.

#### Acceptance Criteria

1. WHEN the `enrollment` object is present and valid, THE Child_Service SHALL execute child creation, enrollment creation, and billing period generation within a single database transaction.
2. IF the enrollment creation fails after the child record is inserted within the transaction, THEN THE Child_Service SHALL roll back the entire transaction including the child record.
3. IF the child creation fails, THEN THE Child_Service SHALL not attempt enrollment creation and SHALL return the child creation error.
4. WHEN the transaction completes successfully, THE Child_Creation_Endpoint SHALL return the created child record together with enrollment summary data including enrollmentId, periodsCreated, and totalAmountDue.

### Requirement 3: Enrollment Validation During Child Creation

**User Story:** As an administrator, I want clear validation errors when enrollment fields are incorrect, so that I can fix the form without guessing what went wrong.

#### Acceptance Criteria

1. WHEN the enrollment `branchId` references a Branch that does not exist, THE Child_Creation_Endpoint SHALL return HTTP 404 with a message identifying the missing branch.
2. WHEN the enrollment `branchId` references a Branch that has no Branch_Billing_Config, THE Child_Creation_Endpoint SHALL return HTTP 422 with a message stating that billing must be configured before enrollment.
3. WHEN the enrollment `startDate` is missing or not a valid date, THE Child_Creation_Endpoint SHALL return HTTP 400 with a validation error identifying the invalid field.
4. WHEN `recurringFee` is not provided in the enrollment object, THE Child_Service SHALL default the recurring fee to the Branch_Billing_Config `default_recurring_fee` value.
5. WHEN `firstPeriodAmountDue` is provided and the `startDate` is not later than the first billing period start, THE Child_Creation_Endpoint SHALL return HTTP 400 with a message explaining the constraint.

### Requirement 4: Billing Period Generation Consistency

**User Story:** As an administrator, I want auto-enrollment to generate the same billing periods as manual enrollment, so that billing behavior is predictable regardless of which workflow I use.

#### Acceptance Criteria

1. WHEN an enrollment is created via the child creation endpoint, THE Child_Service SHALL delegate billing period generation to the same Enrollment_Service logic used by the standalone enrollment endpoint.
2. THE Billing_Periods generated via auto-enrollment SHALL be identical in structure, boundaries, and amounts to those generated by calling POST /api/payments/enrollments with the same input parameters.
3. WHEN the billing cycle is trimester or custom, THE Child_Service SHALL read BranchCalendar rows for the specified branch and academic year during period generation.
4. IF no BranchCalendar rows exist for a trimester or custom billing cycle branch, THEN THE Child_Creation_Endpoint SHALL return HTTP 422 with a message stating that calendar configuration is required.

### Requirement 5: Duplicate Enrollment Prevention

**User Story:** As an administrator, I want the system to prevent duplicate enrollments, so that a child is never billed twice for the same academic year.

#### Acceptance Criteria

1. WHEN an enrollment already exists for the same child and academic year, THE Child_Creation_Endpoint SHALL return HTTP 409 with a message identifying the conflict.
2. THE duplicate check SHALL use the child being created and the academicYearId from the child creation payload to determine conflict.

### Requirement 6: Frontend Enrollment Section in Child Creation Form

**User Story:** As an administrator, I want optional enrollment fields visible in the child creation form, so that I can fill them in without leaving the page.

#### Acceptance Criteria

1. THE Child_Creation_Form SHALL display a collapsible or togglable "Payment Enrollment" section below the existing child fields.
2. WHEN the enrollment section is expanded or toggled on, THE Child_Creation_Form SHALL display fields for branch selection, start date, recurring fee, and registration fee.
3. WHEN the enrollment section is collapsed or toggled off, THE Child_Creation_Form SHALL not include the enrollment object in the submitted payload.
4. THE branch selection field SHALL display only branches belonging to the current school that have an active Branch_Billing_Config.
5. WHEN a branch is selected, THE recurring fee field SHALL pre-fill with the branch default_recurring_fee value and remain editable.
6. THE Child_Creation_Form SHALL display validation errors returned by the backend for enrollment fields inline next to the relevant form field.

### Requirement 7: Response Structure for Combined Creation

**User Story:** As an administrator, I want to see confirmation that both the child and enrollment were created, so that I have confidence billing is active.

#### Acceptance Criteria

1. WHEN child creation succeeds with enrollment, THE Child_Creation_Endpoint SHALL return HTTP 201 with a response body containing the child object and an `enrollment` summary object.
2. THE enrollment summary object SHALL include `enrollmentId`, `periodsCreated`, `earliestPeriodStart`, `latestPeriodEnd`, and `totalAmountDue` fields.
3. WHEN child creation succeeds without enrollment, THE Child_Creation_Endpoint SHALL return HTTP 201 with the child object and no enrollment field, maintaining backward compatibility.
