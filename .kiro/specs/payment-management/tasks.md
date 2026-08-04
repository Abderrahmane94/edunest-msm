# Implementation Plan: Payment Management

## Overview

This plan implements the Payment Management module for the EduNest kindergarten school management system. The module introduces branch-level billing configuration, enrollment-driven billing period generation, an append-only payment ledger, corrections/refunds, a parent read-only portal, receipt generation, and reconciliation reporting. All amounts are in DZD with 2 decimal places. The backend uses Node.js/Express with Prisma ORM and PostgreSQL; the frontend uses React/TypeScript with shadcn/ui and TailwindCSS with RTL Arabic support.

## Tasks

- [x] 1. Database schema and migration
  - [x] 1.1 Create Prisma schema additions for payment management models
    - Add `Branch`, `BranchBillingConfig`, `BranchCalendar`, `Enrollment`, `BillingPeriod`, `PaymentRecord`, `PaymentAllocation`, `PaymentAuditEntry` models
    - Add enums: `BillingCycleType`, `NotificationSettingType`, `EnrollmentStatus`, `PaymentChannel`
    - Add relations to existing `School`, `Child`, `User`, `AcademicYear` models
    - Add `branchId` (nullable) to User model for branch-scoped staff
    - Add `Branch` relation to `School` model, `Enrollment` and `PaymentRecord` relations to `Child`
    - _Requirements: 1.1, 2.1, 3.1, 9.10, 11.1, 20.1_

  - [x] 1.2 Create database migration with default branch seeding
    - Generate Prisma migration from schema changes
    - Write migration SQL that creates a default branch for each existing school
    - Ensure `parent_child_links` table is reused as ChildParent (already exists)
    - Mark `invoices`, `cash_payments`, `payment_audit_logs` as deprecated (no drop)
    - _Requirements: 17.1, 17.2, 20.1_


- [x] 2. Backend module structure and shared types
  - [x] 2.1 Create payment module directory structure and TypeScript interfaces
    - Create `backend/src/modules/payments/` directory
    - Create `payments.types.ts` with all interfaces: `BranchBillingConfig`, `CreateEnrollmentInput`, `EnrollmentGenerationResult`, `RecordPaymentInput`, `PaymentAllocationInput`, `RecordCorrectionInput`, `DerivedPeriodStatus`, `ReconciliationReport`, `ChannelSummary`
    - Create `payments.schema.ts` with Zod validation schemas for all request bodies
    - _Requirements: 1.1, 1.2, 3.1, 9.1, 10.1, 11.6_

  - [x] 2.2 Implement receipt number generation utility
    - Create utility function following format `{BRANCH_CODE}-{YYYY}-{SEQ}`
    - Use database sequence or `SELECT ... FOR UPDATE` for concurrency safety
    - _Requirements: 9.10_


- [x] 3. Branch billing configuration backend
  - [x] 3.1 Implement branch-config service and controller
    - Create `branch-config.service.ts` with create, update, get operations
    - Validate billing_cycle (monthly/trimester/custom), billing_due_day (1-28), grace_period_days (0-60, default 5), default_recurring_fee (0.00-9,999,999.99)
    - Enforce Staff-only access, reject non-Staff with authorization error
    - Return count of already-generated billing periods left unchanged on update
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 6.2, 6.7_

  - [x] 3.2 Implement branch-config routes
    - Create `branch-config.routes.ts` with POST/PUT/GET for `/api/payments/branches/:branchId/config`
    - Wire auth middleware, tenancy middleware, RBAC middleware (admin/super_admin only)
    - _Requirements: 1.8, 1.11, 20.1, 20.2_

  - [x] 3.3 Write unit tests for branch config validation
    - Test billing_cycle enum validation, billing_due_day range, grace_period_days default and range
    - Test fee precision validation (exactly 2 decimal places)
    - Test authorization rejection for non-Staff users
    - _Requirements: 1.3, 1.5, 1.9, 1.10, 1.11_


- [x] 4. BranchCalendar management backend
  - [x] 4.1 Implement branch-calendar service and controller
    - Create `branch-calendar.service.ts` with CRUD operations
    - Validate: period_end >= period_start, due_date >= period_start, label 1-100 chars
    - Validate no overlapping date ranges for same branch + academic year
    - Enforce Staff-only access
    - _Requirements: 2.1, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [x] 4.2 Implement branch-calendar routes
    - Create `branch-calendar.routes.ts` with GET/POST/PUT/DELETE for `/api/payments/branches/:branchId/calendar`
    - Wire auth, tenancy, RBAC middleware
    - _Requirements: 2.8, 2.9, 20.1_

  - [x] 4.3 Write unit tests for branch calendar validation
    - Test date range validation (period_end < period_start rejection)
    - Test due_date < period_start rejection
    - Test overlapping period detection
    - Test trimester requires exactly 3 rows enforcement
    - _Requirements: 2.7, 2.10, 2.11, 2.4, 2.5_


- [x] 5. Billing period generation service
  - [x] 5.1 Implement billing-period service with generation logic
    - Create `billing-period.service.ts` with `generatePeriodsForEnrollment()` method
    - Implement monthly generation: one period per calendar month from start_date month to academic year end month
    - Set monthly period_start = first of month, period_end = last of month, due_date day = billing_due_day
    - Implement trimester/custom generation: read BranchCalendar rows, filter by period_end >= start_date
    - Validate trimester requires exactly 3 rows, custom requires >= 1 row
    - Calculate grace_end_date = due_date + grace_period_days for every period
    - Set amount_due = enrollment recurring_fee for all recurring periods
    - Support first-period amount override for mid-cycle enrollment
    - Generate registration period when registration_fee is non-null
    - Return generation result: count, earliest period_start, latest period_end, total amount_due
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 5.2 Implement period status derivation function
    - Create pure `derivePeriodStatus()` function in billing-period.service.ts
    - Implement status logic: paid (totalPaid >= amountDue), partial/late_partial (0 < totalPaid < amountDue), unpaid/late (totalPaid <= 0)
    - Determine lateness by comparing currentDate > graceEndDate
    - Handle cancelled periods: is_late always false when cancelledAt non-null
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.12, 8.14_

  - [x] 5.3 Write property test for period status derivation (Property 1)
    - **Property 1: Period Status Derivation Completeness and Correctness**
    - Generate random (amountDue, totalPaid, graceEndDate, currentDate, cancelledAt) tuples
    - Verify exactly one status value returned, is_late correct per rules
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 8.9, 8.13, 8.14**

  - [x] 5.4 Write property test for monthly billing period generation (Property 2)
    - **Property 2: Monthly Billing Period Generation Boundaries**
    - Generate random (startDate, endDate, billingDueDay) and verify period count, boundaries
    - **Validates: Requirements 4.3, 4.4**

  - [x] 5.5 Write property test for grace end date invariant (Property 3)
    - **Property 3: Grace End Date Invariant**
    - Generate random (dueDate, gracePeriodDays) and verify grace_end_date calculation
    - **Validates: Requirements 4.6, 5.4**

  - [x] 5.6 Write property test for recurring fee as amount source (Property 4)
    - **Property 4: Recurring Fee as Amount Source**
    - Generate random recurring fees, verify all non-registration periods use that value
    - **Validates: Requirements 3.6, 4.8, 4.9**

  - [x] 5.7 Write property test for registration period generation (Property 5)
    - **Property 5: Registration Period Generation**
    - Generate random enrollments with/without registration fee, verify conditional generation
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.6, 5.7**


- [x] 6. Enrollment service backend
  - [x] 6.1 Implement enrollment service with transactional period generation
    - Create `enrollment.service.ts` with create, list, get, update operations
    - Enrollment creation wraps enrollment insert + billing period generation in single Prisma interactive transaction
    - Validate: unique child+academic_year, start_date within academic year range, fee ranges
    - Default recurring_fee to branch config when not supplied
    - Reject if branch has no billing config
    - On failure, rollback entire transaction (no partial state)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 4.1, 4.12, 4.13_

  - [x] 6.2 Implement enrollment routes and controller
    - Create `enrollment.routes.ts` with POST/GET/PATCH for `/api/payments/enrollments`
    - POST `/api/payments/enrollments/:id/withdraw` for withdrawal
    - Wire auth, tenancy, RBAC middleware
    - _Requirements: 3.8, 3.11, 12.9, 20.1_

  - [x] 6.3 Implement withdrawal logic in enrollment service
    - Set enrollment status to `withdrawn`, record withdrawal_date
    - Cancel future periods: set cancelled_at on periods where period_start > withdrawal_date and is_registration_period = false
    - Leave current and past periods unchanged, leave registration period unchanged
    - Support optional amount_due adjustment on the period covering withdrawal date
    - Validate withdrawal date range (>= start_date, <= latest period_end)
    - All in single transaction
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12_

  - [x] 6.4 Write property test for withdrawal cancellation logic (Property 11)
    - **Property 11: Withdrawal Cancellation Logic**
    - Generate enrollments with multiple periods, apply withdrawal at random dates, verify correct periods cancelled
    - **Validates: Requirements 12.1, 12.2**

  - [x] 6.5 Write property test for amount snapshot immutability (Property 6)
    - **Property 6: Amount Snapshot Immutability**
    - Generate periods, apply config/fee updates, verify period fields unchanged
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**


- [x] 7. Checkpoint - Core billing logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Payment recording service backend
  - [x] 8.1 Implement payment service for recording payments
    - Create `payments.service.ts` with `recordPayment()` method
    - Validate: childId, totalAmount > 0, channel (cash/ccp/baridimob), valueDate <= today, recordedBy resolves to Staff
    - Validate allocations: sum equals totalAmount, each amount >= 0.01, no duplicate periods, all periods belong to child, no cancelled periods
    - Require reference_note for ccp/baridimob channels (1-500 chars after trim)
    - Generate receipt number using utility
    - Write PaymentRecord + all PaymentAllocations in single transaction
    - Create audit entry on successful insert
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 9.14, 9.15, 9.16, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 11.4, 11.14_

  - [x] 8.2 Implement correction/refund recording
    - Create `recordCorrection()` method in payments.service.ts
    - Validate: amount < 0, is_correction = true, corrects_payment_id resolves to existing non-correction record of same branch
    - Require reference_note (1-500 chars) for correction reason
    - Validate correction allocations: negative amounts, sum of corrections per period doesn't exceed original allocation
    - Write correction PaymentRecord + allocations in single transaction
    - Create audit entry
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14, 11.15, 11.16, 11.17, 11.18_

  - [x] 8.3 Implement payment routes and controller
    - Create `payments.routes.ts` with POST `/api/payments/records` and POST `/api/payments/records/correction`
    - GET `/api/payments/records` for listing (branch-scoped)
    - Wire auth, tenancy, RBAC middleware
    - _Requirements: 9.12, 11.15, 20.1, 20.2_

  - [x] 8.4 Write property test for allocation sum equals total (Property 7)
    - **Property 7: Payment Allocation Sum Equals Total**
    - Generate random allocation sets, verify sum constraint enforcement
    - **Validates: Requirements 9.4**

  - [x] 8.5 Write property test for correction amount constraint (Property 10)
    - **Property 10: Correction Amount Constraint**
    - Generate corrections against originals, verify magnitude limit
    - **Validates: Requirements 11.12, 11.17**

  - [x] 8.6 Write property test for ledger append-only invariant (Property 16)
    - **Property 16: Ledger Append-Only Invariant**
    - Verify no operation modifies or deletes existing payment records
    - **Validates: Requirements 11.1, 11.2, 11.3**


- [x] 9. Balance, late dashboard, and reconciliation backend
  - [x] 9.1 Implement outstanding balance calculation
    - Add `getOutstandingBalance(childId)` to payments.service.ts
    - Sum amount_due over non-cancelled periods minus sum of all allocation amounts
    - Include correction allocations (negative)
    - Express in DZD with 2 decimal places, half-up rounding on final result only
    - Allow negative balance (overpayment) without clamping
    - Return 0.00 if no non-cancelled periods exist
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 9.2 Implement late payments dashboard endpoint
    - Create late dashboard query in payments.service.ts
    - Filter billing periods where derived status is `late` or `late_partial`
    - Exclude cancelled periods
    - Return: child name, period label, due_date, grace_end_date, amount_due, total_paid, outstanding, status
    - Order by grace_end_date ASC, child name, period ID
    - Support optional status filter (late/late_partial only)
    - Add GET `/api/payments/branches/:branchId/late` route
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_

  - [x] 9.3 Implement reconciliation report service
    - Create `reconciliation.service.ts` with report generation
    - Filter payment records by branch + value_date within date range
    - Group by channel, compute signed totals (include corrections as negatives)
    - Return per-channel: total, paymentCount, correctionCount
    - Grand total = sum of channel totals
    - Return 0.00 and counts 0 for channels with no matching records
    - Add GET `/api/payments/branches/:branchId/reconciliation` route
    - Validate: rangeStart <= rangeEnd, both required dates
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

  - [x] 9.4 Write property test for outstanding balance formula (Property 9)
    - **Property 9: Outstanding Balance Formula**
    - Generate random periods and payments, verify balance = sum(due) - sum(paid)
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.7**

  - [x] 9.5 Write property test for cancelled period exclusion (Property 12)
    - **Property 12: Cancelled Period Exclusion**
    - Verify cancelled periods excluded from balance and late dashboard
    - **Validates: Requirements 8.12, 8.14, 12.5, 12.6, 14.2**

  - [x] 9.6 Write property test for reconciliation report consistency (Property 13)
    - **Property 13: Reconciliation Report Consistency**
    - Generate random payments, verify grand total = sum of channel totals
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.6**


- [x] 10. Receipt generation and billing period endpoints
  - [x] 10.1 Implement receipt service
    - Create `receipt.service.ts` for receipt document generation
    - Include: school name, branch name, receipt number, child name, amount, channel, value date, recorded_by name
    - Include allocated billing periods with labels and amounts (ordered by period_start)
    - Include correction markers and linked correction records when applicable
    - Support Arabic (RTL) and French (LTR) based on user language preference
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9_

  - [x] 10.2 Implement billing period and balance endpoints
    - GET `/api/payments/children/:childId/periods` — list child's billing periods with derived status
    - GET `/api/payments/children/:childId/balance` — get child's outstanding balance
    - PATCH `/api/payments/periods/:id/cancel` — cancel a billing period (Staff only)
    - GET `/api/payments/records/:id/receipt` — generate receipt (Staff or authorized Parent)
    - _Requirements: 8.10, 8.15, 13.1, 18.1, 18.9_

- [x] 11. Checkpoint - Core payment backend complete
  - Ensure all tests pass, ask the user if questions arise.


- [x] 12. Parent portal backend and authorization guard
  - [x] 12.1 Implement parent authorization guard middleware
    - Create `parent-guard.middleware.ts`
    - Verify user is authenticated with `parent` role
    - Resolve child IDs from `parent_child_links` table using session user ID (not from request)
    - Store resolved childIds on request object
    - If request references a childId, verify it exists in resolved set
    - Reject with uniform auth error if any check fails
    - Return empty list (not error) when parent has no linked children
    - _Requirements: 17.1, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12_

  - [x] 12.2 Implement parent portal routes (read-only)
    - Create `parent-portal.routes.ts` with GET-only endpoints
    - GET `/api/payments/parent/periods` — list linked children's billing periods with status
    - GET `/api/payments/parent/history` — payment history for linked children
    - GET `/api/payments/parent/balances` — outstanding balances per child
    - GET `/api/payments/parent/receipts/:id` — view receipt (authorized child only)
    - Wire auth + parent-guard middleware
    - Ensure no POST/PUT/PATCH/DELETE endpoints exist for parent role
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.11, 16.12_

  - [x] 12.3 Write property test for parent authorization isolation (Property 14)
    - **Property 14: Parent Authorization Isolation**
    - Verify all responses contain only data for parent's linked children
    - **Validates: Requirements 17.4, 17.5, 17.6, 17.7, 17.8**

  - [x] 12.4 Write property test for tenant scoping isolation (Property 15)
    - **Property 15: Tenant Scoping Isolation**
    - Verify staff queries return only records from their branch/school scope
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.6, 20.7**


- [x] 13. Optional notifications and tenant scoping
  - [x] 13.1 Implement optional payment notification service
    - Create `notification.service.ts`
    - When branch notification_setting is `enabled`: dispatch late notification on status transition to late/late_partial
    - Dispatch confirmation notification on payment record insert
    - Deduplicate: no more than one late notification per period per day
    - Record dispatch failure entries (retrievable by staff)
    - Complete payment recording independently of notification outcome
    - No notifications when setting is `disabled`
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9_

  - [x] 13.2 Implement branch and tenant scoping enforcement
    - Ensure every query is scoped to authenticated user's school ID
    - Branch-scoped staff see only their branch's data
    - Null-branch staff see all branches of their school
    - Super_admin bypasses school+branch scoping
    - Return empty lists (not errors) when all rows excluded by scope
    - Reject cross-school and cross-branch references with authorization error
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8_

  - [x] 13.3 Wire payment routes into main app.ts
    - Import and register payment routes in `backend/src/app.ts` under `/api/payments`
    - Ensure route is added after auth and tenancy middleware
    - _Requirements: 20.1_


- [x] 14. Checkpoint - Full backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Admin frontend - Branch configuration and calendar pages
  - [x] 15.1 Create admin payment pages structure and routing
    - Create `frontend/src/pages/admin/payments/` directory
    - Add routes for: BranchConfigPage, BranchCalendarPage, EnrollmentsPage, PaymentsPage, LateDashboardPage, ReconciliationPage
    - Register routes in admin router
    - Add navigation entries in admin sidebar (Arabic + French labels)
    - _Requirements: 1.8, 2.8, 20.1_

  - [x] 15.2 Implement BranchBillingConfigPage component
    - Form to create/update branch billing configuration
    - Fields: billing_cycle (select), billing_due_day (number 1-28), grace_period_days (number 0-60), default_recurring_fee (currency input), notification_setting (toggle)
    - Use shadcn/ui form components, Zod client-side validation
    - Support RTL layout for Arabic, display amounts in DZD
    - Show validation errors per field
    - _Requirements: 1.1, 1.2, 1.4, 1.6, 1.7, 1.10_

  - [x] 15.3 Implement BranchCalendarPage component
    - List existing BranchCalendar entries for selected branch + academic year
    - Form to create/edit calendar entries: label, period_start, period_end, due_date
    - Date pickers with validation (period_end >= period_start, due_date >= period_start)
    - Delete calendar entry with confirmation
    - Support RTL layout
    - _Requirements: 2.1, 2.7, 2.8, 2.10, 2.11_


- [x] 16. Admin frontend - Enrollment management
  - [x] 16.1 Implement EnrollmentsPage with list and create form
    - Data table listing enrollments for current branch: child name, academic year, status, recurring_fee, start_date
    - Create enrollment dialog/form: child select, branch select, academic year, start_date, recurring_fee (optional), registration_fee (optional), first_period_amount_due (optional for mid-cycle)
    - Show generation result after successful creation (periods created, date range, total)
    - Validate fee inputs (max 2 decimal places, DZD range)
    - Support RTL layout
    - _Requirements: 3.1, 3.5, 3.7, 4.11, 7.3, 7.5_

  - [x] 16.2 Implement enrollment detail view and withdrawal UI
    - Display enrollment details with all billing periods listed (with derived status)
    - Withdrawal form: withdrawal date, optional amount_due for current period
    - Show cancelled periods with visual indicator
    - Display period status badges (unpaid, partial, late_partial, late, paid)
    - _Requirements: 12.1, 12.3, 12.4, 12.8, 12.10, 12.11_


- [x] 17. Admin frontend - Payment recording and corrections
  - [x] 17.1 Implement payment recording page/dialog
    - Form: select child, total amount (DZD), channel (cash/ccp/baridimob), value date, reference_note
    - Dynamic allocations section: add billing period + amount rows
    - Show allocation sum vs total with validation indicator
    - Require reference_note for ccp/baridimob channels
    - Show generated receipt number on success
    - Support RTL layout
    - _Requirements: 9.1, 9.2, 9.4, 10.1, 10.3, 10.4, 10.5_

  - [x] 17.2 Implement correction recording dialog
    - Form: select original payment, negative total amount, channel, reference_note (required)
    - Allocations: negative amounts per period (max = original allocation for that period)
    - Show remaining correctable amount per period
    - Validation: sum of correction allocations = correction total
    - _Requirements: 11.6, 11.7, 11.8, 11.9, 11.12, 11.16, 11.17_

  - [x] 17.3 Implement payment history list component
    - Data table showing payment records: receipt number, child, amount, channel, date, type (payment/correction)
    - Filter by date range, channel, child
    - Link corrections to original payment (show corrects_payment_id)
    - Print/view receipt button per row
    - _Requirements: 11.13, 18.1_


- [x] 18. Admin frontend - Late dashboard, reconciliation, and receipts
  - [x] 18.1 Implement late payments dashboard page
    - Data table: child name, period label, due_date, grace_end_date, amount_due, total_paid, outstanding, status
    - Filter by status (late / late_partial)
    - Ordered by grace_end_date ASC, then child name
    - Empty state when no late periods
    - Support RTL layout
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.8, 14.9_

  - [x] 18.2 Implement reconciliation report page
    - Date range picker (start date, end date)
    - Display per-channel breakdown: cash, ccp, baridimob
    - Show: total amount, payment count, correction count per channel
    - Grand total at bottom
    - Print/export option
    - Support RTL layout
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.6, 19.8_

  - [x] 18.3 Implement receipt view/print component
    - Display receipt data: school, branch, receipt number, child, amount, channel, date, recorded by
    - List allocated billing periods with amounts
    - Show correction info when applicable
    - Print-friendly layout
    - Arabic (RTL) and French (LTR) based on user language
    - DZD currency label with Western Arabic numerals
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.7_


- [x] 19. Parent portal frontend
  - [x] 19.1 Implement parent payment portal pages
    - Create `frontend/src/pages/parent/ParentPaymentsPage.tsx`
    - Billing periods tab: list all non-cancelled periods with status, amount, due_date per child
    - Payment history tab: list all payments with receipt number, amount, channel, date
    - Balance summary: one outstanding balance per child (show negative as "paid in advance")
    - Display cancelled periods in history with cancelled indicator
    - Corrections shown with "correction" label and linked original receipt number
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.8, 16.12_

  - [x] 19.2 Implement parent portal UI details and restrictions
    - No create/update/delete controls visible to parent
    - Mobile-first, warm feed-like layout per design system
    - RTL layout when user language is Arabic, LTR for French
    - DZD currency label with Western Arabic numerals
    - Empty state for parent with no linked children
    - View receipt button linking to receipt view (read-only)
    - _Requirements: 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12_

  - [x] 19.3 Add parent payment routes to frontend router
    - Register ParentPaymentsPage in parent portal routes
    - Add navigation entry in parent sidebar/nav
    - _Requirements: 16.1_


- [x] 20. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Integration, i18n, and non-blocking payment status
  - [x] 21.1 Add Arabic and French translation keys for payment module
    - Add payment-related keys to `frontend/src/i18n/locales/ar/` and `fr/` translation files
    - Cover: billing config, calendar, enrollment, payment, receipt, reconciliation, late dashboard, parent portal labels
    - Include status labels: unpaid, partial, late_partial, late, paid, cancelled
    - Include channel labels: cash, ccp, baridimob
    - _Requirements: 16.9, 16.10, 18.2, 18.7_

  - [x] 21.2 Verify payment status does not restrict operations
    - Confirm attendance check-in/check-out works regardless of payment status
    - Ensure no feature is gated on Period_Status, is_late, or Outstanding_Balance
    - Authorization uses only role, ChildParent links, and school/branch scope
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 21.3 Write property test for conditional reference note (Property 18)
    - **Property 18: Conditional Reference Note Requirement**
    - Verify reference_note required for ccp/baridimob and for all corrections
    - **Validates: Requirements 10.3, 11.7**

  - [x] 21.4 Write property test for trimester/custom period boundaries (Property 17)
    - **Property 17: Trimester/Custom Period Boundaries From Calendar**
    - Verify generated periods match BranchCalendar rows exactly
    - **Validates: Requirements 2.2, 4.5**

- [x] 22. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check` via `vitest`
- Unit tests validate specific examples and edge cases
- The append-only ledger pattern means no UPDATE/DELETE on payment_records — corrections are new inserts with negative amounts
- All monetary amounts use Decimal(10,2) in Prisma and DZD currency throughout
- Frontend uses shadcn/ui components with RTL support for Arabic
- The existing `parent_child_links` table serves as the ChildParent join — no new table needed
- Branch is a new entity; migration auto-creates one default branch per existing school

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["3.1", "4.1", "5.2"] },
    { "id": 4, "tasks": ["3.2", "4.2", "5.1", "3.3", "4.3", "5.3", "5.5"] },
    { "id": 5, "tasks": ["5.4", "5.6", "5.7", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "6.5"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 9, "tasks": ["8.5", "8.6", "9.1", "9.2", "9.3"] },
    { "id": 10, "tasks": ["9.4", "9.5", "9.6", "10.1", "10.2"] },
    { "id": 11, "tasks": ["12.1", "12.2"] },
    { "id": 12, "tasks": ["12.3", "12.4", "13.1", "13.2", "13.3"] },
    { "id": 13, "tasks": ["15.1"] },
    { "id": 14, "tasks": ["15.2", "15.3", "16.1"] },
    { "id": 15, "tasks": ["16.2", "17.1", "17.2"] },
    { "id": 16, "tasks": ["17.3", "18.1", "18.2", "18.3"] },
    { "id": 17, "tasks": ["19.1", "19.2", "19.3"] },
    { "id": 18, "tasks": ["21.1", "21.2", "21.3", "21.4"] }
  ]
}
```
