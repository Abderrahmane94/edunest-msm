# Requirements Document

## Introduction

The Payment Management module tracks kindergarten fee billing and payment collection for schools operating in Algeria. All amounts are denominated in Algerian Dinar (DZD). Payments are captured manually by administrative staff after money is received through one of three offline channels: cash handed over at a branch, a CCP transfer through Algérie Poste, or a BaridiMob mobile transfer. The module does not integrate an online payment gateway.

Billing is driven by the Enrollment record. When a Child is enrolled at a Branch for an academic year, the Payment_Service immediately generates the full set of Billing_Periods for that Enrollment. Period boundaries come from per-Branch configuration: monthly cycles are derived from calendar months, while trimester and custom cycles read their boundaries from a per-Branch BranchCalendar table. Period boundaries are never hardcoded in application logic.

Every recorded payment is written to an append-only ledger. Once a Payment_Record exists no application code path updates or deletes that record; corrections and refunds are appended as new Payment_Records carrying a negative amount and a link to the record being corrected. Period payment status is derived from the ledger rather than stored as authoritative state.

Parents access a read-only portal view showing their children's Billing_Periods, payment history, and outstanding balance, with no write endpoints of any kind in v1. Payment status is informational: the Payment_Service never gates attendance, check-in, or any other operational feature on payment state.

This module extends the existing Finance_Service, `fee_structures`, `invoices`, `cash_payments`, and `payment_audit_logs` structures already present in the system. The Branch, BranchCalendar, and Enrollment concepts are new to the data model, and the ChildParent join table is created by this module if that table does not already exist.

## Non-Goals for v1

The following are explicitly out of scope for v1 and no requirement in this document depends on any of them:

- **No credit, wallet, or advance-balance engine.** Money that staff do not allocate to a Billing_Period is not recorded and creates no carry-forward credit.
- **No automatic allocation.** The Payment_Service does not choose which periods a payment settles; staff state the allocation explicitly.
- **No automatic proration.** Mid-cycle enrollment and mid-cycle withdrawal amounts are adjusted manually by staff.
- **No dedicated Refund entity.** A refund is modelled as a negative correction Payment_Record. A first-class Refund entity is deferred to v2.
- **No online payment gateway.** Card and mobile-wallet checkout are outside this module.
- **No parent write endpoints.** The parent surface is read-only.

## Glossary

- **Payment_Service**: The backend subsystem of this module responsible for Billing_Period generation, payment recording, correction handling, status derivation, balance calculation, receipt production, and reconciliation reporting.
- **Academic_Year**: The dated school year record that scopes an Enrollment and bounds monthly Billing_Period generation.
- **Branch**: A physical location belonging to a School, holding its own billing configuration, its own BranchCalendar rows, its own Enrollments, and its own payment records.
- **Billing_Cycle**: The per-Branch period length, taking exactly one of the values `monthly`, `trimester`, or `custom`.
- **BranchCalendar**: A per-Branch configuration table whose rows each carry `branch_id`, an Academic_Year identifier, `label`, `period_start`, `period_end`, and `due_date`, and which is the sole source of period boundaries for `trimester` and `custom` Billing_Cycles.
- **grace_period_days**: The per-Branch whole number of days added to a Billing_Period `due_date` to obtain that period's `grace_end_date`, defaulting to 5.
- **billing_due_day**: The per-Branch day of month used as the `due_date` for Billing_Periods generated under a `monthly` Billing_Cycle.
- **Enrollment**: The record linking one Child to one Branch for one Academic_Year, carrying `branch_id`, `start_date`, `status`, a nullable `registration_fee`, and a required `recurring_fee`.
- **recurring_fee**: The per-Enrollment amount in DZD charged for each recurring Billing_Period, which overrides the Branch default fee and therefore expresses per-child discounts.
- **registration_fee**: The optional one-time amount in DZD charged on an Enrollment at the moment of enrollment.
- **Billing_Period**: A dated financial obligation covering one Enrollment period, carrying `period_start`, `period_end`, `due_date`, `grace_end_date`, `amount_due`, `is_registration_period`, and `cancelled_at`. Referred to as a charge in staff-facing copy.
- **amount_due**: The DZD amount owed for one Billing_Period, snapshotted at generation time.
- **grace_end_date**: The date stored on a Billing_Period equal to `due_date` plus the Branch `grace_period_days`, and the sole reference date for lateness determination.
- **is_registration_period**: The boolean flag on a Billing_Period marking that period as the one-time registration charge rather than a recurring charge.
- **cancelled_at**: The nullable timestamp on a Billing_Period marking that period as cancelled. A cancelled Billing_Period is excluded from balances and late listings and is never deleted.
- **Period_Status**: The derived payment state of a Billing_Period, taking exactly one of the values `unpaid`, `partial`, `late_partial`, `late`, or `paid`.
- **is_late**: The derived boolean exposed alongside Period_Status, true when Period_Status is `late` or `late_partial` and false otherwise.
- **total_paid**: For one Billing_Period, the sum of all Payment_Allocation amounts against that period, including negative amounts contributed by correction Payment_Records.
- **Payment_Record**: An append-only ledger entry representing one physical receipt of money or one correction, carrying an amount in DZD, a Payment_Channel, a value date, a `recorded_by` Staff_User identifier, a `reference_note`, an `is_correction` flag, and a nullable `corrects_payment_id`.
- **Payment_Allocation**: A line item linking one Payment_Record to one Billing_Period with an explicit DZD amount, stated by the recording Staff_User.
- **Payment_Ledger**: The append-only collection of all Payment_Records and their Payment_Allocations for a Branch.
- **Payment_Channel**: One of exactly three manual receipt channels: `cash`, `ccp`, or `baridimob`.
- **reference_note**: The free-text field on a Payment_Record holding a transfer reference, a cash note, or a mandatory correction reason.
- **Outstanding_Balance**: For a given Child, the sum of `amount_due` over that Child's non-cancelled Billing_Periods minus the sum of `total_paid` over the same periods.
- **ChildParent**: The many-to-many join table linking Children to parent user accounts, supporting siblings and shared custody.
- **Staff_User**: A user with the `admin` or `super_admin` role who is authorised to configure billing, create Enrollments, and record payments.
- **Parent_User**: A user with the `parent` role linked to one or more Children through ChildParent.
- **Parent_Portal_View**: The read-only parent-facing interface presenting Billing_Periods, Payment_Ledger entries, and Outstanding_Balance for the Children linked to the signed-in Parent_User.
- **Parent_Authorization_Guard**: The server-side middleware that resolves the signed-in Parent_User's ChildParent links and authorises every parent-facing request against those links.
- **Late_Dashboard**: The staff-facing listing of a Branch's Billing_Periods filtered to late Period_Status values.
- **Receipt**: A printable document produced from a single Payment_Record, showing the school and branch identity, the Child, the amount in DZD, the Payment_Channel, the value date, the allocated Billing_Periods, and a receipt number.
- **Reconciliation_Report**: A per-Branch, per-date-range summary of Payment_Ledger totals grouped by Payment_Channel.
- **Attendance_Service**: The existing backend subsystem that records Child check-in and check-out events.
- **System**: The complete school management application, comprising the Payment_Service, the Attendance_Service, and all other subsystems.
- **DZD**: Algerian Dinar, the sole currency used by the Payment_Service.

## Requirements

### Requirement 1: Branch Billing Configuration

**User Story:** As a school admin, I want to configure billing settings for each branch, so that period boundaries, due dates, and lateness match how that branch actually bills families.

#### Acceptance Criteria

1. THE Payment_Service SHALL store exactly one billing configuration per Branch, keyed uniquely by branch identifier, containing a Billing_Cycle, a whole-number `billing_due_day`, a whole-number `grace_period_days` value, and a default recurring fee in DZD from 0.00 through 9,999,999.99 inclusive recorded with exactly two decimal places.
2. THE Payment_Service SHALL accept Billing_Cycle values of exactly `monthly`, `trimester`, and `custom`.
3. IF a Staff_User submits a Billing_Cycle value other than `monthly`, `trimester`, or `custom`, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted configuration, and return a validation error naming the Billing_Cycle field.
4. THE Payment_Service SHALL accept whole-number `billing_due_day` values from 1 through 28 inclusive.
5. IF a Staff_User submits a `billing_due_day` that is outside 1 through 28 inclusive or is not a whole number, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted configuration, and return a validation error naming the `billing_due_day` field.
6. THE Payment_Service SHALL accept whole-number `grace_period_days` values from 0 through 60 inclusive.
7. WHEN a Staff_User creates a Branch billing configuration without stating `grace_period_days`, THE Payment_Service SHALL set `grace_period_days` to 5.
8. THE Payment_Service SHALL restrict Branch billing configuration creation and update operations to Staff_Users.
9. IF a Staff_User submits a `grace_period_days` value that is outside 0 through 60 inclusive or is not a whole number, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted configuration, and return a validation error naming the `grace_period_days` field.
10. IF a Staff_User submits a default recurring fee that is outside 0.00 DZD through 9,999,999.99 DZD inclusive or carries more than two decimal places, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted configuration, and return a validation error naming the default recurring fee field.
11. IF a user who is not a Staff_User submits a Branch billing configuration creation or update request, THEN THE Payment_Service SHALL reject the request, leave the stored billing configuration unchanged, and return an authorization error indicating the operation is restricted to Staff_Users.

### Requirement 2: BranchCalendar Period Boundaries

**User Story:** As a school admin, I want trimester and custom period boundaries to come from a branch calendar I control, so that periods follow my branch's real academic calendar instead of dates fixed in code.

#### Acceptance Criteria

1. THE Payment_Service SHALL store BranchCalendar rows containing `branch_id`, an Academic_Year identifier, a `label` of 1 to 100 characters, `period_start`, `period_end`, and `due_date`, with `period_start`, `period_end`, and `due_date` each held as a calendar date.
2. WHERE a Branch Billing_Cycle is `trimester` or `custom`, THE Payment_Service SHALL read every generated Billing_Period `period_start`, `period_end`, and `due_date` unchanged from the BranchCalendar rows of that Branch and of the Enrollment's Academic_Year, taken in ascending `period_start` order.
3. THE Payment_Service SHALL derive `trimester` and `custom` period boundaries only from BranchCalendar rows and SHALL hold no period boundary date as a literal value in application code.
4. WHERE a Branch Billing_Cycle is `trimester`, THE Payment_Service SHALL require exactly 3 BranchCalendar rows for that Branch and Academic_Year.
5. IF a Branch Billing_Cycle is `trimester` and the number of BranchCalendar rows for that Branch and Academic_Year is other than 3, THEN THE Payment_Service SHALL reject Billing_Period generation, persist no Billing_Period and no Enrollment for that submission, and return an error stating the required row count of 3 and the found row count.
6. IF a Branch Billing_Cycle is `custom` and no BranchCalendar row exists for that Branch and Academic_Year, THEN THE Payment_Service SHALL reject Billing_Period generation, persist no Billing_Period and no Enrollment for that submission, and return an error naming the missing BranchCalendar configuration for that Branch and Academic_Year.
7. IF a Staff_User submits a BranchCalendar row whose `period_end` is earlier than its `period_start`, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted BranchCalendar row, and return a validation error naming both the `period_start` and `period_end` fields.
8. THE Payment_Service SHALL restrict BranchCalendar creation, update, and deletion to Staff_Users.
9. IF a user who is not a Staff_User submits a BranchCalendar creation, update, or deletion request, THEN THE Payment_Service SHALL reject the request, leave every stored BranchCalendar row unchanged, and return an authorization error indicating the operation is restricted to Staff_Users.
10. IF a Staff_User submits a BranchCalendar row whose `due_date` is earlier than its `period_start`, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted BranchCalendar row, and return a validation error naming the `due_date` field.
11. IF a Staff_User submits a BranchCalendar row whose `period_start` through `period_end` range overlaps the range of an existing BranchCalendar row of the same Branch and Academic_Year, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted BranchCalendar row, and return an error identifying the overlapping existing BranchCalendar row.

### Requirement 3: Enrollment Record

**User Story:** As a school admin, I want one enrollment record per child per academic year carrying that child's own fees, so that billing reflects per-child agreements and discounts.

#### Acceptance Criteria

1. THE Payment_Service SHALL store one Enrollment per Child per Academic_Year containing `branch_id`, a `start_date` falling on or after the Academic_Year start date and on or before the Academic_Year end date inclusive, a `status` defaulting to `active`, a nullable `registration_fee` in DZD from 0.00 through 9,999,999.99 inclusive recorded with exactly two decimal places, and a required `recurring_fee` in DZD from 0.00 through 9,999,999.99 inclusive recorded with exactly two decimal places.
2. THE Payment_Service SHALL enforce a unique constraint on the pair of Child identifier and Academic_Year identifier across Enrollments.
3. IF a Staff_User submits an Enrollment for a Child that already has an Enrollment in the same Academic_Year, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted Enrollment, and return an error identifying the existing Enrollment.
4. THE Payment_Service SHALL accept Enrollment `status` values of exactly `active`, `withdrawn`, and `completed`.
5. WHEN a Staff_User creates an Enrollment without stating `recurring_fee`, THE Payment_Service SHALL set that Enrollment `recurring_fee` to the default recurring fee held in the billing configuration of the Enrollment's Branch.
6. THE Payment_Service SHALL use the Enrollment `recurring_fee` value, and no other fee value, as the source of `amount_due` for every recurring Billing_Period it generates for that Enrollment.
7. IF a Staff_User submits a `recurring_fee` or `registration_fee` value that is outside 0.00 DZD through 9,999,999.99 DZD inclusive or that carries more than two decimal places, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted Enrollment, and return a validation error naming the rejected field.
8. THE Payment_Service SHALL restrict Enrollment creation and update to Staff_Users.
9. IF a Staff_User submits an Enrollment `status` value other than `active`, `withdrawn`, or `completed`, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted Enrollment, and return a validation error naming the `status` field.
10. IF a Staff_User submits an Enrollment whose `start_date` is earlier than the Academic_Year start date or later than the Academic_Year end date, THEN THE Payment_Service SHALL reject the submission, persist no part of the submitted Enrollment, and return a validation error naming the `start_date` field.
11. IF a user who is not a Staff_User submits an Enrollment creation or update request, THEN THE Payment_Service SHALL reject the request, leave every stored Enrollment unchanged, and return an authorization error indicating the operation is restricted to Staff_Users.

### Requirement 4: Billing Period Generation at Enrollment Creation

**User Story:** As a school admin, I want the full schedule of billing periods created the moment I enroll a child, so that collection does not depend on remembering to run a batch job.

#### Acceptance Criteria

1. WHEN a Staff_User creates an Enrollment, THE Payment_Service SHALL generate that Enrollment's Billing_Periods within the same transaction as the Enrollment insert, committing the Enrollment insert and every generated Billing_Period as a single atomic unit.
2. THE Payment_Service SHALL generate Billing_Periods only as part of Enrollment creation and SHALL expose no staff-triggered batch generation operation.
3. WHERE the Branch Billing_Cycle is `monthly`, THE Payment_Service SHALL generate one Billing_Period per calendar month from the calendar month containing the Enrollment `start_date` through the calendar month containing the Academic_Year end date inclusive, setting each generated Billing_Period `period_start` to the first day of that period's calendar month and each generated Billing_Period `period_end` to the last day of that period's calendar month.
4. WHERE the Branch Billing_Cycle is `monthly`, THE Payment_Service SHALL set each generated Billing_Period `due_date` to the date within that period's calendar month whose day of month equals the Branch `billing_due_day`, including for the first generated Billing_Period when that date falls earlier than the Enrollment `start_date`.
5. WHERE the Branch Billing_Cycle is `trimester` or `custom`, THE Payment_Service SHALL generate one Billing_Period per BranchCalendar row of that Branch and Academic_Year whose `period_end` is on or after the Enrollment `start_date`, copying that row's `period_start`, `period_end`, and `due_date` onto the generated Billing_Period unchanged.
6. THE Payment_Service SHALL set each generated Billing_Period `grace_end_date` to that period's `due_date` plus the Branch `grace_period_days` counted as whole calendar days, and SHALL set `grace_end_date` equal to `due_date` when the Branch `grace_period_days` is 0.
7. THE Payment_Service SHALL store each generated Billing_Period `grace_end_date` as a persisted value on that Billing_Period.
8. THE Payment_Service SHALL set the `amount_due` of every generated Billing_Period whose `is_registration_period` is false to the Enrollment `recurring_fee` value in effect at that Billing_Period's generation time, except for the first generated Billing_Period when a Staff_User supplies an `amount_due` for it as described in Requirement 7.
9. THE Payment_Service SHALL record every Billing_Period `amount_due` in DZD with exactly two decimal places.
10. THE Payment_Service SHALL set `cancelled_at` to null on every generated Billing_Period.
11. THE Payment_Service SHALL return a generation result listing the count of Billing_Periods created, the earliest `period_start` across the Billing_Periods created, the latest `period_end` across the Billing_Periods created, and the sum of `amount_due` across the Billing_Periods created expressed in DZD with exactly two decimal places.
12. IF Billing_Period generation for an Enrollment does not complete, THEN THE Payment_Service SHALL roll back the enclosing transaction, persist neither the Enrollment nor any Billing_Period of that Enrollment, and return an error indicating that Billing_Period generation failed.
13. IF a Staff_User creates an Enrollment for a Branch that holds no billing configuration, THEN THE Payment_Service SHALL reject the submission, persist neither the Enrollment nor any Billing_Period, and return an error naming the missing Branch billing configuration.
14. IF the Branch Billing_Cycle is `trimester` or `custom` and no BranchCalendar row of that Branch and Academic_Year has a `period_end` on or after the Enrollment `start_date`, THEN THE Payment_Service SHALL reject the submission, persist neither the Enrollment nor any Billing_Period, and return an error indicating that no Billing_Period could be generated for the submitted `start_date`.

### Requirement 5: Registration Fee Period

**User Story:** As a school admin, I want a one-time registration charge raised at enrollment, so that the registration fee is collected and tracked like any other charge.

#### Acceptance Criteria

1. WHERE an Enrollment carries a non-null `registration_fee`, WHEN a Staff_User creates that Enrollment, THE Payment_Service SHALL generate exactly one additional Billing_Period for that Enrollment with `is_registration_period` set to true, within the same transaction as the Enrollment insert.
2. THE Payment_Service SHALL set the registration Billing_Period `due_date` to the Enrollment `start_date`.
3. THE Payment_Service SHALL set the registration Billing_Period `amount_due` to the Enrollment `registration_fee` value in effect at that Billing_Period's generation time, recorded in DZD with exactly two decimal places.
4. THE Payment_Service SHALL set the registration Billing_Period `grace_end_date` to the Enrollment `start_date` plus the Branch `grace_period_days`, and SHALL store that value as a persisted value on that Billing_Period.
5. WHERE an Enrollment carries a null `registration_fee`, THE Payment_Service SHALL generate no Billing_Period with `is_registration_period` set to true for that Enrollment.
6. THE Payment_Service SHALL set `is_registration_period` to false on every Billing_Period generated for an Enrollment other than that Enrollment's registration Billing_Period.
7. THE Payment_Service SHALL set both the registration Billing_Period `period_start` and the registration Billing_Period `period_end` to the Enrollment `start_date`.
8. WHERE an Enrollment carries a `registration_fee` equal to 0.00 DZD, THE Payment_Service SHALL generate exactly one Billing_Period with `is_registration_period` set to true and `amount_due` set to 0.00 DZD for that Enrollment.
9. IF a Staff_User updates the `registration_fee` of an Enrollment whose Billing_Periods have already been generated, THEN THE Payment_Service SHALL generate no further Billing_Period with `is_registration_period` set to true for that Enrollment, SHALL leave the existing registration Billing_Period `amount_due` unchanged, and SHALL return a result indicating that the registration charge was not regenerated.

### Requirement 6: Amount Snapshot Immutability

**User Story:** As a school owner, I want already-generated charges frozen at the amount they were created with, so that a later fee change never rewrites history a parent has already been shown or already paid.

#### Acceptance Criteria

1. THE Payment_Service SHALL treat a Billing_Period as already-generated from the moment the transaction that inserted that Billing_Period commits, and SHALL hold each already-generated Billing_Period `amount_due` as a snapshot of the value in effect at that Billing_Period's generation time, taken from: the Enrollment `recurring_fee` where `is_registration_period` is false and no Staff_User-supplied first-period `amount_due` was stated, the Staff_User-supplied first-period `amount_due` where one was stated at Enrollment creation, and the Enrollment `registration_fee` where `is_registration_period` is true.
2. WHEN a Staff_User updates a Branch billing configuration, THE Payment_Service SHALL leave the `amount_due`, `due_date`, and `grace_end_date` of every already-generated Billing_Period of every Enrollment of that Branch unchanged, for every Period_Status value and for Billing_Periods carrying a non-null `cancelled_at`.
3. WHEN a Staff_User updates an Enrollment `recurring_fee`, THE Payment_Service SHALL leave the `amount_due` of every already-generated Billing_Period of that Enrollment unchanged, including Billing_Periods whose `is_registration_period` is true, Billing_Periods carrying a non-null `cancelled_at`, and Billing_Periods with one or more Payment_Allocations already recorded against them.
4. WHEN a Staff_User updates or deletes a BranchCalendar row, THE Payment_Service SHALL leave the `period_start`, `period_end`, `due_date`, and `grace_end_date` of every already-generated Billing_Period of that Branch unchanged.
5. THE Payment_Service SHALL apply an updated Branch billing configuration value, an updated Enrollment `recurring_fee` value, and an updated or newly created BranchCalendar row only when generating Billing_Periods for an Enrollment whose creation transaction commits after that update commits.
6. IF a request would change the `amount_due`, `due_date`, `grace_end_date`, `period_start`, or `period_end` of an already-generated Billing_Period, and that request is not the withdrawal-date `amount_due` adjustment permitted by Requirement 12, THEN THE Payment_Service SHALL reject the request, leave all five of those stored values on that Billing_Period unchanged, and return an error indicating that the amounts and dates of a generated Billing_Period are immutable.
7. WHEN a Staff_User updates a Branch billing configuration, an Enrollment `recurring_fee`, or a BranchCalendar row, THE Payment_Service SHALL return a result stating the count of already-generated Billing_Periods left unchanged by that update.

### Requirement 7: Mid-Cycle Enrollment

**User Story:** As a school admin, I want to set the first period's amount myself when a child joins part-way through a period, so that I can charge a fair amount without waiting for a proration engine.

#### Acceptance Criteria

1. THE Payment_Service SHALL set every generated Billing_Period `amount_due` to exactly one of the Enrollment `recurring_fee`, the Enrollment `registration_fee`, or the Staff_User-supplied first-period `amount_due`, applying no adjustment derived from the position of the Enrollment `start_date` within that Billing_Period's `period_start` through `period_end` range and no adjustment derived from the number of days remaining in that range.
2. THE Payment_Service SHALL treat the first generated Billing_Period of an Enrollment as the generated Billing_Period of that Enrollment whose `is_registration_period` is false and whose `period_start` is the earliest among that Enrollment's generated Billing_Periods whose `is_registration_period` is false.
3. WHEN a Staff_User creates an Enrollment whose `start_date` is later than the `period_start` of the first generated Billing_Period and whose creation submission states a first-period `amount_due`, THE Payment_Service SHALL set that first generated Billing_Period `amount_due` to the stated value, recorded in DZD with exactly two decimal places, within the same transaction as the Enrollment insert.
4. WHEN a Staff_User creates an Enrollment whose creation submission states no first-period `amount_due`, THE Payment_Service SHALL set the first generated Billing_Period `amount_due` to the full Enrollment `recurring_fee` value in effect at that Billing_Period's generation time.
5. THE Payment_Service SHALL accept a Staff_User-supplied first-period `amount_due` from 0.00 DZD through the Enrollment `recurring_fee` value in effect at that Billing_Period's generation time inclusive, carrying no more than two decimal places.
6. IF a Staff_User supplies a first-period `amount_due` that is less than 0.00 DZD, greater than the Enrollment `recurring_fee`, or carries more than two decimal places, THEN THE Payment_Service SHALL reject the submission, persist neither the Enrollment nor any Billing_Period of that Enrollment, and return a validation error naming the `amount_due` field and stating the accepted range.
7. THE Payment_Service SHALL accept the Staff_User-supplied first-period `amount_due` only as a field of the Enrollment creation submission.
8. IF a Staff_User supplies a first-period `amount_due` in an Enrollment creation submission whose `start_date` equals the `period_start` of the first generated Billing_Period, THEN THE Payment_Service SHALL reject the submission, persist neither the Enrollment nor any Billing_Period of that Enrollment, and return a validation error naming the `amount_due` field and indicating that a first-period amount may be stated only when `start_date` is later than the first Billing_Period `period_start`.
9. IF an Enrollment creation submission states an `amount_due` for a Billing_Period other than the first generated Billing_Period, THEN THE Payment_Service SHALL reject the submission, persist neither the Enrollment nor any Billing_Period of that Enrollment, and return a validation error identifying the Billing_Period for which an `amount_due` may not be stated.
10. IF a Staff_User submits a first-period `amount_due` in a request other than an Enrollment creation submission, THEN THE Payment_Service SHALL reject the request, leave the `amount_due` of every already-generated Billing_Period of that Enrollment unchanged, and return an error indicating that the first-period amount may be stated only at Enrollment creation.

### Requirement 8: Billing Period Status Derivation

**User Story:** As a school admin, I want each charge's status derived from the ledger against the grace deadline, so that the status I see always agrees with the payments actually recorded.

#### Acceptance Criteria

1. THE Payment_Service SHALL express Period_Status as exactly one of `unpaid`, `partial`, `late_partial`, `late`, or `paid`, and SHALL return exactly one of those values for a Billing_Period on any single derivation.
2. WHEN `total_paid` for a Billing_Period is greater than or equal to that period's `amount_due`, both compared in DZD at exactly two decimal places, THE Payment_Service SHALL set Period_Status to `paid`.
3. WHEN `total_paid` for a Billing_Period exceeds that period's `amount_due`, THE Payment_Service SHALL set Period_Status to `paid` and SHALL return that Period_Status without raising an error.
4. WHEN `total_paid` for a Billing_Period is greater than 0.00 DZD and less than that period's `amount_due` and the current date in the School's configured time zone is on or before that period's `grace_end_date`, THE Payment_Service SHALL set Period_Status to `partial`.
5. WHEN `total_paid` for a Billing_Period is greater than 0.00 DZD and less than that period's `amount_due` and the current date in the School's configured time zone is later than that period's `grace_end_date`, THE Payment_Service SHALL set Period_Status to `late_partial`.
6. WHEN `total_paid` for a Billing_Period is less than or equal to 0.00 DZD and that period's `amount_due` is greater than 0.00 DZD and the current date in the School's configured time zone is on or before that period's `grace_end_date`, THE Payment_Service SHALL set Period_Status to `unpaid`.
7. WHEN `total_paid` for a Billing_Period is less than or equal to 0.00 DZD and that period's `amount_due` is greater than 0.00 DZD and the current date in the School's configured time zone is later than that period's `grace_end_date`, THE Payment_Service SHALL set Period_Status to `late`.
8. THE Payment_Service SHALL determine lateness by comparing the current date in the School's configured time zone to the Billing_Period `grace_end_date` as whole calendar dates with no time-of-day component, and SHALL use no other date for that comparison.
9. WHERE a Billing_Period carries a null `cancelled_at`, THE Payment_Service SHALL expose `is_late` as true when Period_Status is `late` or `late_partial`, and as false for the Period_Status values `unpaid`, `partial`, and `paid`.
10. THE Payment_Service SHALL derive Period_Status from the Payment_Ledger on each read rather than reading a stored Period_Status column, and SHALL treat `total_paid` as 0.00 DZD for a Billing_Period carrying no Payment_Allocation.
11. WHERE the Payment_Service caches a derived Period_Status, WHEN a Payment_Record is inserted against the corresponding Billing_Period, when that Billing_Period `cancelled_at` is set, or when the current date in the School's configured time zone changes, THE Payment_Service SHALL invalidate that cached value so that the next derivation returns the value the rules in criteria 2 through 9 produce.
12. THE Payment_Service SHALL represent cancellation through the Billing_Period `cancelled_at` timestamp, SHALL expose no `cancelled` value within Period_Status, and SHALL derive Period_Status for a Billing_Period carrying a non-null `cancelled_at` by the same rules while keeping that Billing_Period excluded from the Late_Dashboard and from Outstanding_Balance.
13. THE Payment_Service SHALL return the same Period_Status and the same `is_late` value for a Billing_Period on repeated requests made on the same date in the School's configured time zone when no Payment_Record has been inserted against that Billing_Period and that Billing_Period `cancelled_at` has not changed between the requests.
14. WHERE a Billing_Period carries a non-null `cancelled_at`, THE Payment_Service SHALL expose `is_late` as false.
15. IF a Period_Status derivation is requested for a Billing_Period identifier that does not resolve to a stored Billing_Period, THEN THE Payment_Service SHALL return no Period_Status and SHALL return an error indicating that the Billing_Period was not found.

### Requirement 9: Staff-Directed Payment Allocation

**User Story:** As a school admin, I want to state exactly which charges a single payment settles, so that one cash handover or one CCP slip can cover several periods in a single submission.

#### Acceptance Criteria

1. WHEN a Staff_User submits a payment recording request, THE Payment_Service SHALL require a non-null target Child identifier, a non-null total amount in DZD expressed with at most 2 decimal places, a non-null Payment_Channel, a non-null value date held as a calendar date, a non-null `recorded_by` Staff_User identifier, and a list holding one or more Payment_Allocations.
2. THE Payment_Service SHALL require each submitted Payment_Allocation to carry a non-null Billing_Period identifier and a non-null amount in DZD expressed with at most 2 decimal places, and, where the submission's `is_correction` is false, to carry an amount of at least 0.01 DZD.
3. THE Payment_Service SHALL accept a single Payment_Record submission carrying one or more Payment_Allocations, up to at most one Payment_Allocation per non-cancelled Billing_Period belonging to an Enrollment of the target Child.
4. IF the sum of the submitted Payment_Allocation amounts differs from the Staff_User-entered total amount by any non-zero DZD amount, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error stating the submitted total amount and the computed allocation sum.
5. IF a submitted Payment_Allocation references a Billing_Period that does not belong to an Enrollment of the target Child, THEN THE Payment_Service SHALL reject the whole submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return an error identifying the rejected Billing_Period identifier.
6. THE Payment_Service SHALL select the Billing_Periods a payment settles only from the submitted Payment_Allocations and SHALL apply no due-date-ordered or otherwise automatic allocation.
7. THE Payment_Service SHALL record no credit, wallet, or advance balance for any amount of money a Staff_User does not include in a Payment_Allocation.
8. IF the submission's `is_correction` is false and the submitted Payment_Record total amount is less than 0.01 DZD, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the amount field.
9. IF the submitted value date is later than the current date in the School's configured time zone, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the value date field.
10. WHEN the Payment_Service inserts a Payment_Record, THE Payment_Service SHALL assign that Payment_Record exactly one non-null receipt number that is unique across all Payment_Records of the same Branch, including Payment_Records whose `is_correction` is true and including Payment_Records created by payment recording requests processed concurrently.
11. THE Payment_Service SHALL write the Payment_Record and all of that record's Payment_Allocations in a single transaction such that a failure of any part of that write persists neither the Payment_Record nor any of that submission's Payment_Allocations.
12. IF a user who is not a Staff_User submits a payment recording request, THEN THE Payment_Service SHALL reject the request, persist neither the Payment_Record nor any Payment_Allocation, and return an authorization error indicating the operation is restricted to Staff_Users.
13. IF a submitted Payment_Allocation references a Billing_Period with a non-null `cancelled_at`, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return an error identifying that Billing_Period.
14. IF a payment recording submission omits or nulls the target Child identifier, the total amount, the Payment_Channel, the value date, or the `recorded_by` Staff_User identifier, or omits, nulls, or holds zero Payment_Allocations, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any Payment_Allocation, and return a validation error naming each field that failed the check.
15. IF two or more submitted Payment_Allocations of the same submission reference the same Billing_Period identifier, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return an error identifying the repeated Billing_Period identifier.
16. IF the submitted target Child identifier does not resolve to an existing Child holding at least one Enrollment, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return an error indicating that the target Child was not found.

### Requirement 10: Payment Channels

**User Story:** As a school admin, I want to record which of the three real-world channels the money arrived through, so that reconciliation against cash on hand and postal statements is possible.

#### Acceptance Criteria

1. THE Payment_Service SHALL accept Payment_Channel values of exactly the lowercase strings `cash`, `ccp`, and `baridimob`, matched case-sensitively, and SHALL require a non-null Payment_Channel on every Payment_Record insert.
2. IF a Staff_User submits a Payment_Record whose Payment_Channel is absent, null, empty, or any value other than the lowercase strings `cash`, `ccp`, or `baridimob`, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the Payment_Channel field.
3. WHERE the Payment_Channel is `ccp` or `baridimob`, THE Payment_Service SHALL require a `reference_note` holding 1 through 500 characters inclusive after leading and trailing whitespace is removed.
4. IF the Payment_Channel is `ccp` or `baridimob` and the submitted `reference_note` is absent, null, or holds 0 characters after leading and trailing whitespace is removed, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the `reference_note` field.
5. WHERE the Payment_Channel is `cash` and `is_correction` is false, THE Payment_Service SHALL accept a submission whose `reference_note` is absent, null, or holds 0 through 500 characters inclusive.
6. THE Payment_Service SHALL store the submitted Payment_Channel value unchanged on every Payment_Record it inserts, including every Payment_Record whose `is_correction` is true.
7. IF a Staff_User submits a `reference_note` holding more than 500 characters, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the `reference_note` field.

### Requirement 11: Append-Only Ledger, Corrections, and Refunds

**User Story:** As a school owner, I want the ledger to be insert-only and every correction to be an appended entry with a stated reason, so that financial history is auditable and cannot be silently altered.

#### Acceptance Criteria

1. THE Payment_Service SHALL expose only insert operations for Payment_Records and SHALL contain no update path and no delete path for Payment_Records in application code.
2. IF a request attempts to modify a field of an existing Payment_Record, THEN THE Payment_Service SHALL reject the request, leave that Payment_Record and all of its Payment_Allocations unchanged, and return an error stating the ledger is append-only.
3. IF a request attempts to delete an existing Payment_Record, THEN THE Payment_Service SHALL reject the request, leave that Payment_Record and all of its Payment_Allocations stored and unchanged, and return an error stating the ledger is append-only.
4. THE Payment_Service SHALL require a non-null `recorded_by` Staff_User identifier that resolves to an existing Staff_User on every Payment_Record insert.
5. THE Payment_Service SHALL require a non-null `recorded_by` Staff_User identifier on every Payment_Record inserted by a data migration.
6. WHEN a Staff_User corrects or refunds a recorded payment, THE Payment_Service SHALL insert a new Payment_Record with a negative amount, `is_correction` set to true, `corrects_payment_id` set to the identifier of the Payment_Record being corrected, and one or more Payment_Allocations each carrying an amount less than 0.00 DZD.
7. THE Payment_Service SHALL require a `reference_note` holding 1 through 500 characters inclusive after leading and trailing whitespace is removed, stating the reason, on every Payment_Record with `is_correction` set to true.
8. IF a Staff_User submits a Payment_Record with `is_correction` set to true whose `reference_note` is absent, null, or holds 0 characters after leading and trailing whitespace is removed, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the `reference_note` field.
9. IF a Staff_User submits a Payment_Record with `is_correction` set to true and an amount greater than or equal to 0.00 DZD, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the amount field.
10. THE Payment_Service SHALL include correction Payment_Record amounts in `total_paid` for each Billing_Period referenced by that correction's Payment_Allocations, reducing `total_paid` by the absolute value of those allocation amounts, and SHALL leave `total_paid` unchanged for every Billing_Period that correction's Payment_Allocations do not reference.
11. WHEN a correction Payment_Record reduces a Billing_Period `total_paid` below that period's `amount_due`, THE Payment_Service SHALL derive a Period_Status of `partial`, `late_partial`, `unpaid`, or `late` for that Billing_Period according to Requirement 8.
12. THE Payment_Service SHALL restrict the sum of the absolute values of all correction Payment_Record amounts sharing the same `corrects_payment_id` to at most the amount of the Payment_Record identified by that `corrects_payment_id`.
13. THE Payment_Service SHALL include both original and correction Payment_Records in every Payment_Ledger listing, with each correction Payment_Record carrying its `is_correction` flag and its `corrects_payment_id` so that a reader can identify it as a correction and locate the corrected Payment_Record.
14. THE Payment_Service SHALL append an audit entry for every Payment_Record insert capturing the acting user identifier, the action name, and the creation timestamp, and SHALL expose no update path and no delete path for audit entries.
15. THE Payment_Service SHALL restrict correction Payment_Record creation to Staff_Users.
16. IF a Staff_User submits a Payment_Record with `is_correction` set to true whose `corrects_payment_id` is absent, is null, does not resolve to a stored Payment_Record, resolves to a Payment_Record of a different Branch, or resolves to a Payment_Record whose `is_correction` is true, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the `corrects_payment_id` field.
17. IF a submitted correction Payment_Allocation would reduce the sum of correction amounts already recorded against one Billing_Period under the same `corrects_payment_id` beyond the amount the corrected Payment_Record allocated to that Billing_Period, THEN THE Payment_Service SHALL reject the submission, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return an error identifying that Billing_Period and the remaining correctable amount.
18. IF a Payment_Record insert submits a `recorded_by` Staff_User identifier that is absent, null, or does not resolve to an existing Staff_User, THEN THE Payment_Service SHALL reject the insert, persist neither the Payment_Record nor any of that submission's Payment_Allocations, and return a validation error naming the `recorded_by` field.

**Deferred to v2:** A dedicated Refund entity with its own lifecycle, approval workflow, and disbursement tracking. In v1 a refund is recorded solely as a negative correction Payment_Record as described above.

### Requirement 12: Withdrawal Handling

**User Story:** As a school admin, I want future charges cancelled when a child withdraws, so that families are not chased for periods the child will not attend, while the full history stays intact.

#### Acceptance Criteria

1. WHEN a Staff_User sets an Enrollment `status` to `withdrawn` with a submitted withdrawal date, THE Payment_Service SHALL, within the same transaction as that `status` update, set `cancelled_at` to the timestamp at which that transaction commits on every Billing_Period of that Enrollment whose `cancelled_at` is null, whose `is_registration_period` is false, and whose `period_start` is later than the submitted withdrawal date, and SHALL leave the existing `cancelled_at` value unchanged on every Billing_Period of that Enrollment that already carries a non-null `cancelled_at`.
2. WHEN a Staff_User sets an Enrollment `status` to `withdrawn`, THE Payment_Service SHALL leave `cancelled_at` null on the Billing_Period of that Enrollment whose `period_start` through `period_end` range contains the submitted withdrawal date, on every Billing_Period of that Enrollment whose `period_end` is earlier than the submitted withdrawal date, and on every Billing_Period of that Enrollment whose `is_registration_period` is true, and SHALL complete the `status` update whether or not any Billing_Period of that Enrollment has a date range containing the submitted withdrawal date.
3. WHEN a Staff_User sets an Enrollment `status` to `withdrawn` and the withdrawal submission states no `amount_due`, THE Payment_Service SHALL leave the `amount_due` of the Billing_Period whose date range contains the submitted withdrawal date unchanged, applying no adjustment derived from the position of the submitted withdrawal date within that Billing_Period's `period_start` through `period_end` range and no adjustment derived from the number of days remaining in that range.
4. WHEN a Staff_User sets an Enrollment `status` to `withdrawn` and the withdrawal submission states an `amount_due` for the Billing_Period whose date range contains the submitted withdrawal date, THE Payment_Service SHALL set that Billing_Period `amount_due` to the stated value in DZD within the same transaction as the `status` update, accepting values from 0.00 DZD through that Billing_Period's current stored `amount_due` inclusive carrying no more than two decimal places, as the sole permitted change to an already-generated Billing_Period `amount_due` and an explicit exception to the Billing_Period `amount_due` immutability rule of Requirement 6.
5. THE Payment_Service SHALL exclude every Billing_Period carrying a non-null `cancelled_at` from both the `amount_due` sum and the `total_paid` sum of every Outstanding_Balance calculation, for every Period_Status value and in both Staff_User-facing and Parent_Portal_View responses.
6. THE Payment_Service SHALL exclude every Billing_Period carrying a non-null `cancelled_at` from the Late_Dashboard, including Billing_Periods whose Period_Status is `late` or `late_partial` and Billing_Periods whose `grace_end_date` is earlier than the current date.
7. THE Payment_Service SHALL retain every Billing_Period carrying a non-null `cancelled_at` as a stored row with its `period_start`, `period_end`, `due_date`, `grace_end_date`, `amount_due`, and `is_registration_period` values unchanged, and SHALL delete no Billing_Period, no Payment_Record, and no Payment_Allocation as part of processing a withdrawal.
8. WHEN a Staff_User or an authorised Parent_User requests the full Billing_Period history listing for a Child, THE Payment_Service SHALL include every Billing_Period of that Child carrying a non-null `cancelled_at`, each labelled with its `cancelled_at` timestamp and a cancelled indicator, and SHALL exclude those Billing_Periods from any outstanding total returned with that listing.
9. THE Payment_Service SHALL restrict Enrollment withdrawal to Staff_Users.
10. IF an Enrollment withdrawal submission states no withdrawal date, states a withdrawal date earlier than that Enrollment `start_date`, or states a withdrawal date later than the `period_end` of that Enrollment's latest generated Billing_Period, THEN THE Payment_Service SHALL reject the submission, leave that Enrollment `status` and the `cancelled_at` and `amount_due` of every Billing_Period of that Enrollment unchanged, and return a validation error naming the withdrawal date field and stating the accepted date range.
11. IF an Enrollment withdrawal submission states an `amount_due` that is less than 0.00 DZD, greater than the current stored `amount_due` of the Billing_Period whose date range contains the submitted withdrawal date, carries more than two decimal places, or is stated for any Billing_Period other than the one whose date range contains the submitted withdrawal date, THEN THE Payment_Service SHALL reject the submission, leave that Enrollment `status` and the `cancelled_at` and `amount_due` of every Billing_Period of that Enrollment unchanged, and return a validation error naming the `amount_due` field and identifying the Billing_Period for which an `amount_due` may be stated.
12. IF a user who is not a Staff_User submits an Enrollment withdrawal request, THEN THE Payment_Service SHALL reject the request, leave that Enrollment `status` and the `cancelled_at` and `amount_due` of every Billing_Period of that Enrollment unchanged, and return an authorization error indicating the operation is restricted to Staff_Users.

### Requirement 13: Balance Calculation

**User Story:** As a school admin, I want outstanding balances calculated from the ledger, so that I can see who owes what without manual reconciliation.

#### Acceptance Criteria

1. WHEN a Staff_User or an authorised Parent_User requests the Outstanding_Balance of a Child, THE Payment_Service SHALL calculate that Outstanding_Balance as the sum of `amount_due` over every Billing_Period of every Enrollment of that Child whose `cancelled_at` is null, across every Academic_Year and every Branch in which that Child holds an Enrollment and including every such Billing_Period whose `is_registration_period` is true, minus the sum of `total_paid` over that same set of Billing_Periods.
2. THE Payment_Service SHALL include in every Outstanding_Balance calculation the amounts of all Payment_Allocations of Payment_Records whose `is_correction` is true that reference a Billing_Period counted in that calculation, through the `total_paid` of that Billing_Period, and SHALL exclude the amounts of all Payment_Allocations that reference a Billing_Period whose `cancelled_at` is non-null.
3. THE Payment_Service SHALL express every calculated Outstanding_Balance in DZD as a value carrying exactly two decimal places using half-up rounding, and SHALL apply that rounding to the final subtraction result only and to no intermediate sum.
4. WHEN a Staff_User or an authorised Parent_User requests the Outstanding_Balance of the same Child two or more times, THE Payment_Service SHALL return an identical value for each of those requests for as long as no Payment_Record, no Payment_Allocation, and no Billing_Period of that Child has been inserted, no `cancelled_at` value on a Billing_Period of that Child has changed, and no `amount_due` value on a Billing_Period of that Child has changed between those requests.
5. WHEN a Parent_User requests balances through the Parent_Portal_View, THE Payment_Service SHALL return one separately calculated Outstanding_Balance per Child linked to that Parent_User through ChildParent, and SHALL return no value that combines the balances of two or more Children.
6. IF a Child holds no Billing_Period whose `cancelled_at` is null at the moment an Outstanding_Balance is requested for that Child, THEN THE Payment_Service SHALL return an Outstanding_Balance of 0.00 DZD for that Child rather than an error or an absent value.
7. IF the sum of `total_paid` over the Billing_Periods counted in an Outstanding_Balance calculation exceeds the sum of `amount_due` over those same Billing_Periods, THEN THE Payment_Service SHALL return that Outstanding_Balance as a negative DZD value equal to that difference and SHALL not clamp the returned value to 0.00 DZD.
8. IF an Outstanding_Balance request states a Child identifier that does not resolve to an existing Child, THEN THE Payment_Service SHALL return no Outstanding_Balance value and SHALL return an error indicating that the requested Child was not found.

### Requirement 14: Late Payments Staff Dashboard

**User Story:** As a school admin, I want a list of who is late at my branch, so that I can follow up on collection without scanning every child's history.

#### Acceptance Criteria

1. WHEN a Staff_User requests the Late_Dashboard for a Branch, THE Payment_Service SHALL return every Billing_Period of every Enrollment of that Branch whose Period_Status derived according to Requirement 8 against the current date in the School's configured time zone is `late` or `late_partial`, including Billing_Periods whose `is_registration_period` is true and Billing_Periods belonging to an Enrollment whose `status` is `withdrawn`.
2. THE Payment_Service SHALL exclude every Billing_Period carrying a non-null `cancelled_at` from the Late_Dashboard for every stated filter value.
3. THE Payment_Service SHALL include in each Late_Dashboard entry the Child name, the Billing_Period label, the `due_date`, the `grace_end_date`, the `amount_due`, the `total_paid`, the outstanding amount calculated as `amount_due` minus `total_paid` expressed in DZD with exactly two decimal places using half-up rounding, and the Period_Status.
4. WHEN a Staff_User requests the Late_Dashboard without stating a Period_Status filter, THE Payment_Service SHALL return entries for both the `late` and the `late_partial` Period_Status values.
5. THE Payment_Service SHALL restrict Late_Dashboard access to Staff_Users.
6. IF a Late_Dashboard request states a Period_Status filter value other than `late` or `late_partial`, THEN THE Payment_Service SHALL reject the request, return no Late_Dashboard entry, and return a validation error naming the Period_Status filter field and listing the accepted values.
7. IF a user who is not a Staff_User requests the Late_Dashboard, THEN THE Payment_Service SHALL reject the request, return no Late_Dashboard entry, and return an authorization error indicating the operation is restricted to Staff_Users.
8. IF no Billing_Period of the requested Branch matches the stated filter, THEN THE Payment_Service SHALL return a Late_Dashboard holding zero entries rather than an error.
9. THE Payment_Service SHALL return Late_Dashboard entries ordered by `grace_end_date` from earliest to latest, then by Child name, then by Billing_Period identifier.

### Requirement 15: Payment Status Does Not Restrict Operations

**User Story:** As a school owner, I want payment status to stay purely informational, so that no child is ever turned away or blocked from a school feature because of a balance.

#### Acceptance Criteria

1. THE Payment_Service SHALL expose Period_Status, `is_late`, and Outstanding_Balance as informational values for display to Staff_Users and Parent_Users, and SHALL expose no operation that withholds a non-payment capability on the basis of any of those three values.
2. WHEN the Attendance_Service records a check-in or a check-out for a Child, THE Attendance_Service SHALL admit that event for every Period_Status value of that Child's Billing_Periods, for `is_late` true and `is_late` false, and for a negative, zero, or positive Outstanding_Balance, producing the same outcome it produces for a Child whose every non-cancelled Billing_Period has Period_Status `paid`.
3. WHEN a Staff_User or a Parent_User requests any System feature for a Child other than Branch billing configuration and payment recording, THE System SHALL return the same authorisation outcome it returns for a Child whose every non-cancelled Billing_Period has Period_Status `paid`.
4. THE System SHALL determine authorisation for every request using only the requesting user's role, that user's ChildParent links, and that user's School and Branch scope, and SHALL use no Period_Status value, `is_late` value, or Outstanding_Balance value as an authorisation input.
5. IF the Payment_Service cannot derive Period_Status, `is_late`, or Outstanding_Balance for a Child, THEN THE System SHALL continue to admit Attendance_Service check-in and check-out events and every other non-payment feature for that Child, and SHALL indicate the payment value as unavailable rather than returning a denial.
6. WHEN a Billing_Period of a Child reaches Period_Status `late` or `late_partial`, THE Payment_Service SHALL leave that Child's Enrollment `status` and that Child's Branch assignment unchanged.

### Requirement 16: Read-Only Parent Portal

**User Story:** As a parent, I want to see my children's charges, payments, and balances, so that I know what I owe and what I have already paid.

#### Acceptance Criteria

1. WHEN a Parent_User opens the Parent_Portal_View, THE Parent_Portal_View SHALL display every Billing_Period carrying a null `cancelled_at` of every Child in that Parent_User's resolved ChildParent set, each entry carrying the Child name, the Branch name, the period label, `amount_due` in DZD, `due_date`, `grace_end_date`, Period_Status, and `is_late`, ordered by `due_date` from earliest to latest.
2. WHEN a Parent_User opens the Parent_Portal_View, THE Parent_Portal_View SHALL display every Payment_Ledger entry carrying at least one Payment_Allocation against a Billing_Period of a Child in that Parent_User's resolved ChildParent set, each entry carrying the Child name, the amount in DZD, the Payment_Channel, the value date, the receipt number, and the label and allocated amount of each allocated Billing_Period, ordered by value date from most recent to oldest.
3. WHERE a displayed Payment_Ledger entry is a Payment_Record whose `is_correction` is true, THE Parent_Portal_View SHALL display that entry with a label identifying it as a correction and with the receipt number of the Payment_Record identified by its `corrects_payment_id`.
4. WHEN a Parent_User opens the Parent_Portal_View, THE Parent_Portal_View SHALL display one separate Outstanding_Balance per Child in that Parent_User's resolved ChildParent set, displaying a zero balance as 0.00 DZD and displaying a negative balance with a leading minus sign and a label identifying the amount as paid in advance.
5. WHERE a Parent_User is linked to Children enrolled at different Branches, THE Parent_Portal_View SHALL display the Billing_Periods and Outstanding_Balance of every linked Child across those Branches, each labelled with the Branch name of the Enrollment the entry belongs to.
6. THE Payment_Service SHALL expose no create, update, or delete endpoint reachable by a Parent_User for Billing_Periods, Payment_Records, Payment_Allocations, or Enrollments.
7. IF a Parent_User request targets an endpoint that creates, updates, or deletes a Billing_Period, a Payment_Record, a Payment_Allocation, or an Enrollment, THEN THE Payment_Service SHALL reject the request, insert, update, and delete no Billing_Period, Payment_Record, Payment_Allocation, or Enrollment, return no financial data, and return an authorisation error.
8. THE Parent_Portal_View SHALL present every amount with the DZD currency label and Western Arabic numerals.
9. WHERE a Parent_User's preferred language is Arabic, THE Parent_Portal_View SHALL render its payment content in Arabic with a right-to-left layout.
10. WHERE a Parent_User's preferred language is French or is unset, THE Parent_Portal_View SHALL render its payment content in French with a left-to-right layout.
11. THE Parent_Portal_View SHALL present no control that submits a create, update, or delete request for a Billing_Period, a Payment_Record, a Payment_Allocation, or an Enrollment.
12. IF a Parent_User's resolved ChildParent set holds no Child, THEN THE Parent_Portal_View SHALL display an empty state indicating that no child is linked to that account and SHALL display no Billing_Period, Payment_Ledger entry, or Outstanding_Balance.

### Requirement 17: Parent Authorization Guard

**User Story:** As a school owner, I want every parent request checked against a verified child link on the server, so that a parent cannot reach another family's financial records by changing an identifier.

#### Acceptance Criteria

1. THE Payment_Service SHALL store ChildParent rows linking Children to Parent_Users as a many-to-many relation holding at most one row per pair of Child identifier and Parent_User identifier.
2. WHERE the ChildParent table is absent from the data model, THE Payment_Service SHALL create the ChildParent table as part of this module's migrations.
3. THE Payment_Service SHALL support one Child linked to two or more Parent_Users and one Parent_User linked to two or more Children.
4. THE Parent_Authorization_Guard SHALL execute on the server and complete for every parent-facing request that reads Billing_Periods, Payment_Ledger entries, Outstanding_Balance values, or Receipts before that request reads any of those values.
5. THE Parent_Authorization_Guard SHALL resolve the set of authorised Child identifiers only from ChildParent rows matching the user identifier held in the server-side session as those rows stand at the moment the request is received, and SHALL take that user identifier from no request path, query string, body, or header value.
6. THE Parent_Authorization_Guard SHALL treat every Child identifier carried in a request path, query string, or body as unverified input and SHALL authorise that value against the resolved ChildParent set before any data read.
7. IF a parent-facing request references a Child identifier absent from the resolved ChildParent set, THEN THE Parent_Authorization_Guard SHALL reject the request, read no Billing_Period, Payment_Ledger entry, Outstanding_Balance value, or Receipt, return no financial data, and return the same authorisation error whether or not that Child identifier resolves to an existing Child.
8. THE Parent_Authorization_Guard SHALL return every parent-facing list response holding no entry that belongs to a Child absent from the resolved ChildParent set.
9. THE Payment_Service SHALL restrict ChildParent link creation and removal to Staff_Users.
10. IF a parent-facing request carries no authenticated session or carries a session whose user is not a Parent_User, THEN THE Parent_Authorization_Guard SHALL reject the request, return no financial data, and return an authorisation error.
11. IF a user who is not a Staff_User submits a ChildParent link creation or removal request, THEN THE Payment_Service SHALL reject the request, leave every stored ChildParent row unchanged, and return an authorisation error indicating the operation is restricted to Staff_Users.
12. IF the resolved ChildParent set of an authenticated Parent_User holds no Child identifier, THEN THE Parent_Authorization_Guard SHALL return every parent-facing list response holding zero entries rather than an authorisation error.

### Requirement 18: Receipt Generation

**User Story:** As a school admin, I want to produce a receipt for a recorded payment, so that families have proof of payment.

#### Acceptance Criteria

1. WHEN a Staff_User requests a Receipt for a Payment_Record of a Branch within that Staff_User's School, THE Payment_Service SHALL produce a document containing the school name, the Branch name, the receipt number, the Child name, the Payment_Record amount in DZD, the Payment_Channel, the value date as a calendar date, the `recorded_by` Staff_User name, and one line per allocated Billing_Period carrying that period's label and allocated amount, with the allocated Billing_Period lines ordered by `period_start` from earliest to latest and every amount presented with exactly two decimal places, the DZD currency label, and Western Arabic numerals.
2. WHERE the requesting user's preferred language is Arabic, THE Payment_Service SHALL produce all Receipt labels and text content in Arabic with a right-to-left layout.
3. WHERE one or more correction Payment_Records reference the requested Payment_Record through `corrects_payment_id`, THE Payment_Service SHALL include on the produced document a corrected marker and one line per referencing correction Payment_Record carrying that correction's receipt number, value date, and amount in DZD, ordered by value date from earliest to latest.
4. WHERE the requested Payment_Record has `is_correction` true, THE Payment_Service SHALL produce a document showing that record's negative amount in DZD with a leading minus sign, that record's `reference_note` text labelled as the correction reason, and the receipt number of the Payment_Record identified by its `corrects_payment_id`.
5. WHEN a Parent_User requests a Receipt for a Payment_Record whose allocated Billing_Periods belong to a Child present in that Parent_User's ChildParent set as resolved by the Parent_Authorization_Guard, THE Payment_Service SHALL produce that Receipt carrying the same fields required by acceptance criterion 1.
6. WHERE no correction Payment_Record referencing a given Payment_Record has been inserted between two Receipt requests for that Payment_Record, THE Payment_Service SHALL produce identical values for every Receipt field, including the receipt number, on both requests.
7. WHERE the requesting user's preferred language is French or is unset, THE Payment_Service SHALL produce all Receipt labels and text content in French with a left-to-right layout.
8. IF a Receipt request references a Payment_Record identifier that matches no Payment_Record, THEN THE Payment_Service SHALL reject the request, produce no document, and return an error indicating that no Receipt exists for the requested identifier.
9. IF a Receipt request comes from a user who is neither a Staff_User of the School owning the requested Payment_Record nor a Parent_User whose resolved ChildParent set holds the Child of that Payment_Record, THEN THE Payment_Service SHALL reject the request, produce no document, return no Payment_Record field values, and return an authorisation error.

### Requirement 19: Reconciliation Reporting

**User Story:** As a school owner, I want per-branch payment totals by channel over a date range, so that I can reconcile recorded payments against cash on hand and postal statements.

#### Acceptance Criteria

1. WHEN a Staff_User requests a Reconciliation_Report for a Branch and a date range, THE Payment_Service SHALL return one signed total of Payment_Record amounts per Payment_Channel, each expressed in DZD with exactly two decimal places.
2. THE Payment_Service SHALL include every Payment_Record whose `is_correction` is true in the Payment_Channel total of that record's Payment_Channel, contributing its negative amount to that signed total.
3. THE Payment_Service SHALL include for each Payment_Channel the count of Payment_Records whose `is_correction` is false and the count of Payment_Records whose `is_correction` is true, each as a whole number of 0 or greater.
4. THE Payment_Service SHALL select for the Reconciliation_Report every Payment_Record of the requested Branch's Payment_Ledger whose value date is on or after the requested range start date and on or before the requested range end date, and SHALL select no Payment_Record whose value date falls outside that range and no Payment_Record of any other Branch.
5. IF the requested range start date is later than the range end date, THEN THE Payment_Service SHALL reject the request, return no Reconciliation_Report, and return a validation error naming both date fields.
6. THE Payment_Service SHALL return a Reconciliation_Report grand total equal to the signed sum of the per-Payment_Channel totals, expressed in DZD with exactly two decimal places.
7. THE Payment_Service SHALL restrict Reconciliation_Report access to Staff_Users.
8. THE Payment_Service SHALL return one group for each of the Payment_Channel values `cash`, `ccp`, and `baridimob` in every Reconciliation_Report, returning a total of 0.00 DZD and counts of 0 and 0 for a Payment_Channel matched by no selected Payment_Record.
9. IF a Reconciliation_Report request omits the range start date, omits the range end date, or states a value that is not a calendar date for either field, THEN THE Payment_Service SHALL reject the request, return no Reconciliation_Report and no partial totals, and return a validation error naming each field that failed the check.
10. IF a user who is not a Staff_User requests a Reconciliation_Report, THEN THE Payment_Service SHALL reject the request, return no Reconciliation_Report and no Payment_Record data, and return an authorisation error indicating the operation is restricted to Staff_Users.

### Requirement 20: Branch and Tenant Scoping

**User Story:** As a school owner operating several branches, I want payment data isolated per branch and per school, so that staff see only the records they are responsible for.

#### Acceptance Criteria

1. THE Payment_Service SHALL scope every Enrollment, Billing_Period, Payment_Record, and Payment_Allocation query to the School identifier held in the requesting user's authenticated session, and SHALL treat any School identifier or Branch identifier carried in a request path, query string, or body as unverified input.
2. WHERE a Staff_User account holds a non-null Branch identifier, THE Payment_Service SHALL limit that Staff_User's Enrollment, Billing_Period, and Payment_Ledger access to that Branch; WHERE a Staff_User account holds a null Branch identifier, THE Payment_Service SHALL grant that Staff_User access across every Branch of that Staff_User's School.
3. WHEN the Payment_Service returns a list of Enrollments, Billing_Periods, Payment_Records, or Payment_Allocations, THE Payment_Service SHALL exclude every row outside the requesting user's resolved School and Branch scope and SHALL return a list holding zero entries rather than an error when every candidate row is excluded.
4. IF a request references a Branch identifier or a BranchCalendar row outside the requesting user's School, THEN THE Payment_Service SHALL reject the request, insert, update, and delete nothing, return no Branch or BranchCalendar field values, and return an authorisation error.
5. THE Payment_Service SHALL allow a `super_admin` user to access Enrollments, Billing_Periods, Payment_Records, and Payment_Allocations across all Schools and Branches, and SHALL apply neither the School scoping of criterion 1 nor the Branch limitation of criterion 2 to a `super_admin` user.
6. IF a Staff_User who holds a non-null Branch identifier submits a request that creates, updates, or reads an Enrollment, Billing_Period, Payment_Record, or Payment_Allocation of another Branch of the same School, THEN THE Payment_Service SHALL reject the request, insert, update, and delete nothing, return no field values of the referenced row, and return an authorisation error.
7. IF a request references an Enrollment, Billing_Period, Payment_Record, or Payment_Allocation identifier belonging to a School other than the requesting user's School, THEN THE Payment_Service SHALL reject the request, return no field values of the referenced row, and return the same authorisation error whether or not that identifier resolves to an existing row.
8. IF a requesting user who is not a `super_admin` holds no resolvable School identifier, THEN THE Payment_Service SHALL reject the request, return no Enrollment, Billing_Period, Payment_Record, or Payment_Allocation data, and return an authorisation error.

### Requirement 21: Optional Payment Notifications

**User Story:** As a school admin, I want optional reminder and confirmation messages, so that follow-up is easier without the billing records depending on message delivery.

**Scope note:** This requirement is optional and secondary. The authoritative source specification does not require notifications for payment management. Every criterion below is non-blocking, and no other requirement in this document depends on notification delivery.

#### Acceptance Criteria

1. WHERE the Branch payment notification setting is `enabled`, WHEN the Period_Status of a Billing_Period whose `cancelled_at` is null transitions to `late` or `late_partial`, THE Payment_Service SHALL request exactly one late notification addressed to every Parent_User linked through ChildParent to that Billing_Period's Child.
2. WHERE the Branch payment notification setting is `enabled`, WHEN a Payment_Record is inserted for a Child, THE Payment_Service SHALL request exactly one confirmation notification for that inserted Payment_Record, counting correction Payment_Records as inserted Payment_Records, addressed to every Parent_User linked through ChildParent to that Child.
3. WHERE the Branch payment notification setting is `enabled`, IF a late notification has already been requested for a Billing_Period on the current calendar day, THEN THE Payment_Service SHALL request no further late notification for that Billing_Period on that calendar day and SHALL leave that Billing_Period and its derived Period_Status unchanged.
4. WHERE the Branch payment notification setting is `disabled`, THE Payment_Service SHALL request no late notification and no confirmation notification for any Child of that Branch.
5. IF a notification dispatch attempt returns an error or is not accepted by the notification channel, THEN THE Payment_Service SHALL retain the inserted Payment_Record and the derived Period_Status unchanged and SHALL record a dispatch failure entry for that notification that is retrievable by Staff_Users of that Branch.
6. THE Payment_Service SHALL complete Payment_Record insertion independently of notification dispatch outcome and SHALL return no notification-related error in the Payment_Record insertion response.
7. THE Payment_Service SHALL store exactly one payment notification setting per Branch, keyed uniquely by branch identifier, holding exactly one of the values `enabled` or `disabled`, and SHALL set that setting to `disabled` when no value is stated for a Branch.
8. IF no Parent_User is linked through ChildParent to a Child for which a late notification or a confirmation notification would otherwise be requested, THEN THE Payment_Service SHALL request no notification for that Child and SHALL record no dispatch failure entry.
9. THE Payment_Service SHALL complete Period_Status derivation and Outstanding_Balance calculation independently of notification dispatch outcome.

## Open Items for the Design Phase

1. **Conflict with kindergarten-school-management Requirements 23 and 23.1.** Requirement 23 of the `kindergarten-school-management` spec mandates Chargily Pay online checkout with Edahabia and CIB, and Requirement 23.1 mandates cash payment handling on `invoices` with mutable invoice status transitions and a `remaining_amount` field updated in place. Both conflict with this module: this module records no online gateway payments, derives status from an append-only ledger instead of updating a status column, and models corrections as appended negative Payment_Records rather than edits. The design phase must resolve whether the `invoices` and `cash_payments` structures are migrated into Billing_Periods and Payment_Records, kept in parallel, or superseded, and whether Chargily Pay is retired, deferred, or layered on top of the ledger as an additional Payment_Channel in a later version.
2. **Academic_Year end date source.** Monthly generation bounds depend on the Academic_Year end date; the design phase must confirm the existing `academic_years` field used for that bound.
3. **Period_Status caching strategy.** Requirement 8 permits either on-read derivation or a cache invalidated on Payment_Record insert; the design phase must select one approach and state the invalidation points.
4. **Zero-period Enrollment rejection.** Requirement 4 criterion 14 rejects an Enrollment when no BranchCalendar row can produce a Billing_Period for the submitted `start_date`, rather than creating an Enrollment with an empty schedule. Confirm that rejecting is the desired behaviour for late-year enrollments at `trimester` and `custom` Branches.
5. **First-period amount edit window.** Requirement 7 accepts the manual first-period `amount_due` only as a field of the Enrollment creation submission, and Requirement 12 permits one further `amount_due` change on the Billing_Period covering a withdrawal date. Confirm that staff never need to correct a first-period amount after the Enrollment is saved; if they do, that path needs its own requirement and an audit trail.
6. **Branch entity ownership.** `Branch` does not yet exist in `backend/prisma/schema.prisma`. The design phase must decide whether Branch is introduced by this module or by a separate schema change, and how existing `School`-scoped rows map onto Branches during migration.
