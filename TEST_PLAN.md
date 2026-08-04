# Test Plan: Payment Management & Auto-Enrollment at Child Creation

## Overview

This document covers the manual and automated test plan for the two new features implemented in EduNest:

1. **Payment Management Module** — Branch billing configuration, enrollment-driven billing period generation, append-only payment ledger, corrections/refunds, parent read-only portal, receipt generation, and reconciliation reporting.
2. **Auto-Enrollment at Child Creation** — Optional enrollment payload in the child creation endpoint that atomically creates a child record + enrollment + billing periods in a single transaction.

All monetary amounts are in DZD (Algerian Dinar) with exactly 2 decimal places.

---

## Test Environment Prerequisites

- Node.js ≥ 20
- PostgreSQL database with migrations applied (through `0009_payment_management`)
- Backend running on `http://localhost:3000`
- Frontend running on `http://localhost:5174`
- Seed data: at least one school, one branch with billing config, one academic year, one staff user, one parent user with linked children

---

## Feature 1: Payment Management Module

### A. Branch Billing Configuration

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1 | Create valid billing config | POST `/api/payments/branches/:id/config` with `{ billingCycle: "monthly", billingDueDay: 15, gracePeriodDays: 5, defaultRecurringFee: 5000.00 }` | 200 — config persisted |
| 2 | Invalid billing cycle | Submit `billingCycle: "weekly"` | 400 — validation error on billingCycle |
| 3 | billing_due_day out of range (high) | Submit `billingDueDay: 29` | 400 — validation error |
| 4 | billing_due_day out of range (low) | Submit `billingDueDay: 0` | 400 — validation error |
| 5 | grace_period_days defaults to 5 | Create config without gracePeriodDays field | Persisted value = 5 |
| 6 | grace_period_days out of range | Submit `gracePeriodDays: 61` | 400 — validation error |
| 7 | Fee with >2 decimal places | Submit `defaultRecurringFee: 1000.999` | 400 — validation error |
| 8 | Fee exceeds max | Submit `defaultRecurringFee: 10000000.00` | 400 — validation error |
| 9 | Non-staff user blocked | Parent role attempts config creation | 403 — authorization error |
| 10 | Update config doesn't alter existing periods | Update fee from 5000 to 6000 after periods exist | Already-generated periods retain amount_due = 5000 |
| 11 | Update returns unchanged period count | Update config when 10 periods exist | Response includes `unchangedPeriodsCount: 10` |

### B. Branch Calendar

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 12 | Create valid calendar entry | POST with label, period_start, period_end, due_date | 201 — entry created |
| 13 | period_end < period_start | Submit reversed dates | 400 — validation error naming both fields |
| 14 | due_date < period_start | Submit early due_date | 400 — validation error naming due_date |
| 15 | Overlapping date ranges | Submit range overlapping existing entry for same branch+AY | 400/409 — overlap error identifying conflicting row |
| 16 | Label too long (>100 chars) | Submit 101-character label | 400 — validation error |
| 17 | Label empty | Submit empty string label | 400 — validation error |
| 18 | Trimester requires exactly 3 rows | Attempt enrollment on trimester branch with only 2 calendar rows | 422 — error stating "expected 3, found 2" |
| 19 | Custom requires ≥1 row | Attempt enrollment on custom branch with 0 rows | 422 — error naming missing calendar config |
| 20 | Non-staff user blocked | Parent attempts calendar CRUD | 403 |
| 21 | Delete calendar entry | DELETE existing entry | 200 — entry removed, existing periods unchanged |

### C. Enrollment & Billing Period Generation

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 22 | Monthly enrollment (Sep–Jun) | Enroll child on monthly branch, AY Sep 1 – Jun 30 | 10 billing periods generated |
| 23 | Monthly period boundaries | Check generated periods | Each period: start = 1st of month, end = last of month |
| 24 | Monthly due_date uses billing_due_day | Branch billing_due_day = 15 | Each period due_date day = 15 |
| 25 | Trimester enrollment | Enroll on trimester branch with 3 calendar rows | 3 periods matching calendar boundaries exactly |
| 26 | Custom enrollment | Enroll on custom branch with 5 calendar rows | 5 periods matching calendar |
| 27 | Duplicate enrollment rejected | Enroll same child + academic year twice | 409 — conflict error |
| 28 | No billing config → rejected | Enroll on unconfigured branch | Error naming missing billing config |
| 29 | Registration fee generates extra period | Enroll with registrationFee = 2000 | Registration period (is_registration_period=true) + recurring periods |
| 30 | Null registration fee → no reg period | Enroll with registrationFee = null | Only recurring periods generated |
| 31 | Registration fee = 0.00 | Enroll with registrationFee = 0.00 | Registration period created with amount_due = 0.00 |
| 32 | Mid-cycle first period override | startDate mid-month + firstPeriodAmountDue = 3000 | First recurring period amount = 3000, rest = recurring_fee |
| 33 | firstPeriodAmountDue when startDate = period_start | Submit override when dates align | 400 — validation error |
| 34 | firstPeriodAmountDue > recurring_fee | Submit override greater than fee | 400 — validation error |
| 35 | grace_end_date = due_date + grace_period_days | Enroll with grace_period_days = 10 | Verify each period's grace_end |
| 36 | grace_period_days = 0 | grace_end_date = due_date | Verified |
| 37 | Fee defaults from branch config | Enroll without specifying recurring_fee | Enrollment uses branch default_recurring_fee |
| 38 | Generation result returned | Successful enrollment | Response: periodsCreated, earliestPeriodStart, latestPeriodEnd, totalAmountDue |
| 39 | Transaction rollback on failure | Force period generation failure | Neither enrollment nor periods persist |
| 40 | start_date before AY start | Submit early start_date | 400 — validation error |
| 41 | start_date after AY end | Submit late start_date | 400 — validation error |
| 42 | Trimester with start_date after all calendar rows | All 3 rows have period_end before start_date | 422 — no periods can be generated |

### D. Payment Recording

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 43 | Record cash payment | POST `/api/payments/records` with totalAmount=5000, channel=cash, allocations sum=5000 | Payment + allocations created, receipt number returned |
| 44 | Record CCP without reference_note | channel=ccp, omit reference_note | 400 — reference_note required |
| 45 | Record BaridiMob with reference | channel=baridimob, reference_note="TX123456" | Payment created |
| 46 | Cash payment without reference_note | channel=cash, no reference_note | Succeeds (reference_note optional for cash) |
| 47 | Allocation sum ≠ totalAmount | totalAmount=5000, allocations sum=4000 | 400 — sum mismatch |
| 48 | Allocation amount < 0.01 | Submit allocation with amount=0.001 | 400 — validation error |
| 49 | Duplicate period in allocations | Same period referenced twice | 400 — duplicate period |
| 50 | Allocation to cancelled period | Allocate to cancelled period | 400 — rejected |
| 51 | Allocation to other child's period | Reference period belonging to different child | 400 — rejected |
| 52 | Cross-tenant payment | Staff of School A records for School B child | 403 |
| 53 | Receipt number format | Check generated receipt | Format: `{BRANCH_CODE}-{YYYY}-{SEQ}` |
| 54 | Concurrent receipt numbers unique | Two simultaneous payments | Different sequential numbers |
| 55 | Value date in future | Submit valueDate > today | 400 — rejected |
| 56 | Audit entry created | After successful payment | Audit log entry exists |

### E. Corrections / Refunds

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 57 | Valid correction | Negative amount, links to existing payment, reference_note provided | Correction record created |
| 58 | Correction exceeds original allocation | Correct more than allocated to a period | 400 — rejected |
| 59 | Correction without reference_note | Omit reason | 400 — required |
| 60 | corrects_payment_id doesn't exist | Random UUID | 404 |
| 61 | Correct a correction | Link to another is_correction record | 400 — rejected |
| 62 | Cross-branch correction | Correct payment from different branch | 400 — rejected |
| 63 | Original payment not modified | After correction | Original record fields unchanged in DB |
| 64 | Audit entry for correction | After successful correction | Audit log exists |
| 65 | Multiple corrections on same original | Two partial corrections | Both accepted if total ≤ original |
| 66 | Total corrections exceed original | Running sum exceeds original allocation | 400 — rejected |

### F. Period Status Derivation

| # | Test Case | Condition | Expected |
|---|-----------|-----------|----------|
| 67 | Paid | total_paid ≥ amount_due | status=paid, is_late=false |
| 68 | Partial (before grace) | 0 < total_paid < amount_due, today ≤ grace_end | status=partial, is_late=false |
| 69 | Unpaid (before grace) | total_paid = 0, today ≤ grace_end | status=unpaid, is_late=false |
| 70 | Late | total_paid = 0, today > grace_end | status=late, is_late=true |
| 71 | Late partial | 0 < total_paid < amount_due, today > grace_end | status=late_partial, is_late=true |
| 72 | Cancelled period | cancelled_at set, today > grace_end | is_late=false regardless |
| 73 | Overpaid | total_paid > amount_due | status=paid, is_late=false |

### G. Outstanding Balance

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 74 | No payments | 3 periods @ 5000 each | Balance = 15000.00 |
| 75 | After partial payment | Pay 3000 against period 1 | Balance = 12000.00 |
| 76 | Cancelled periods excluded | Cancel one 5000 period | Balance = 10000.00 |
| 77 | Negative balance (overpayment) | Pay 20000 on 15000 total | Balance = -5000.00 (not clamped) |
| 78 | Corrections reduce total_paid | Pay 5000, then correct -2000 | Balance recalculated with correction |
| 79 | No periods → 0.00 | Child with no enrollments | Balance = 0.00 |

### H. Late Payments Dashboard

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 80 | Lists late periods | Multiple children past grace | All late/late_partial shown |
| 81 | Excludes paid periods | Fully paid period past grace | Not listed |
| 82 | Excludes cancelled periods | Cancelled period past grace | Not listed |
| 83 | Filter by late_partial only | Apply status filter | Only late_partial shown |
| 84 | Ordering | Multiple late entries | Sorted by grace_end_date ASC, then child name |
| 85 | Empty state | All periods paid or within grace | Empty list returned |
| 86 | Branch-scoped | Staff of Branch A | Only Branch A late periods |

### I. Reconciliation Report

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 87 | Full report by date range | Payments across 3 channels in January | Per-channel: total, paymentCount, correctionCount |
| 88 | Corrections as negative | Correction within range | Reduces channel total |
| 89 | Empty channel = 0 | No BaridiMob payments in range | baridimob: {total: 0, count: 0} |
| 90 | Grand total = sum(channels) | Any data | Math verified |
| 91 | rangeStart > rangeEnd | Submit reversed range | 400 — validation error |
| 92 | Missing dates | Omit rangeStart or rangeEnd | 400 — validation error |

### J. Enrollment Withdrawal

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 93 | Withdraw mid-year | POST withdrawal with date = March 15 | Future periods cancelled, past unchanged |
| 94 | Registration period not cancelled | Withdraw | Registration period intact |
| 95 | Current period amount adjustment | Provide adjusted amount_due for current period | Amount updated for that period only |
| 96 | Withdrawal date < start_date | Invalid early date | 400 |
| 97 | Withdrawal date > latest period_end | Invalid late date | 400 |
| 98 | Enrollment status changes | After withdrawal | status = "withdrawn" |
| 99 | Already cancelled periods unchanged | Period already cancelled before withdrawal | Remains cancelled, no duplicate |

### K. Parent Portal (Read-Only)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 100 | Parent sees linked children's periods | Login as parent with 2 children | Both children's billing shown |
| 101 | Parent cannot access unlinked child | Request data for unlinked child | Empty result or authorization error |
| 102 | No POST endpoints | Attempt POST as parent | 403 or 404 |
| 103 | No PUT endpoints | Attempt PUT as parent | 403 or 404 |
| 104 | No PATCH endpoints | Attempt PATCH as parent | 403 or 404 |
| 105 | No DELETE endpoints | Attempt DELETE as parent | 403 or 404 |
| 106 | View receipt for own child | GET receipt for linked child's payment | Receipt data returned |
| 107 | View receipt for other child | GET receipt for unlinked child's payment | 403 |
| 108 | Parent with no linked children | New parent account | Empty list, 200 |
| 109 | Payment history shows corrections | Correction exists for child | Shown with "correction" label |
| 110 | Cancelled periods visible with indicator | Cancelled period exists | Shown with cancelled marker |

### L. Receipt Generation

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 111 | Receipt contains all required fields | Generate receipt | School name, branch name, receipt #, child name, amount, channel, value date, recorded_by, allocations |
| 112 | Allocations ordered by period_start | Receipt with multiple allocations | Periods listed chronologically |
| 113 | Arabic (RTL) receipt | User language = Arabic | RTL layout, Arabic labels |
| 114 | French (LTR) receipt | User language = French | LTR layout, French labels |
| 115 | Correction receipt | Receipt for correction record | Shows correction marker + linked original receipt # |
| 116 | DZD currency with Western Arabic numerals | Any receipt | Amounts displayed as "5,000.00 DZD" not ٥٬٠٠٠٫٠٠ |

### M. Multi-Tenancy & Branch Scoping

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 117 | Branch-scoped staff sees only own branch | Staff assigned to Branch A queries payments | Only Branch A data returned |
| 118 | School-level staff (null branch) sees all branches | Staff with no branch assignment | All school branches visible |
| 119 | Super admin bypasses all scoping | Super admin queries any school | Full access |
| 120 | Cross-school reference rejected | Staff references child from different school | 403 |
| 121 | Cross-branch payment reference rejected | Staff of Branch A references Branch B period | 403 |
| 122 | Empty result (not error) when scoped out | Staff queries branch with no data | 200 with empty list |

### N. Non-Blocking Payment Status

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 123 | Attendance with unpaid status | Child with late periods → check-in | Check-in succeeds |
| 124 | Attendance with outstanding balance | Balance > 0 → check-out | Check-out succeeds |
| 125 | No feature gated on payment | Verify all non-payment endpoints | No payment status checks in authorization |

### O. Notifications (Optional)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 126 | Late notification dispatched | Period transitions to late, notifications enabled | Notification sent |
| 127 | Payment confirmation notification | Payment recorded, notifications enabled | Confirmation dispatched |
| 128 | Deduplication | Same period already notified today | No duplicate sent |
| 129 | Notifications disabled | Branch setting = disabled | No notifications |
| 130 | Notification failure doesn't block payment | Notification service throws | Payment still recorded |

---

## Feature 2: Auto-Enrollment at Child Creation

### A. Backend — Optional Enrollment Payload

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 131 | Child creation without enrollment | POST `/api/children` with standard fields, no enrollment | Child created, same response as current impl |
| 132 | Child creation with valid enrollment | POST with `enrollment: { branchId, startDate }` | Child + enrollment + periods created |
| 133 | enrollment = null explicitly | POST with `enrollment: null` | Child-only creation (backward compat) |
| 134 | Missing branchId in enrollment | `enrollment: { startDate: "2025-09-01" }` | 400 — validation error for branchId |
| 135 | Missing startDate in enrollment | `enrollment: { branchId: "..." }` | 400 — validation error for startDate |
| 136 | Non-existent branch | enrollment.branchId = random UUID | 404 — "Branch not found" |
| 137 | Branch without billing config | Valid branch, no config | 422 — "billing must be configured before enrollment" |
| 138 | Invalid startDate format | `startDate: "not-a-date"` | 400 — validation error |
| 139 | Custom recurringFee | Provide recurringFee = 4500 | Enrollment uses 4500 |
| 140 | Fee defaults from config | Omit recurringFee | Uses branch default_recurring_fee |
| 141 | Registration fee included | registrationFee = 2000 | Registration period generated |
| 142 | firstPeriodAmountDue | startDate mid-month + override = 3000 | First period = 3000 |
| 143 | No BranchCalendar for trimester | Trimester branch, 0 calendar rows | 422 — calendar config required |

### B. Backend — Atomicity (Transaction Guarantees)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 144 | Full rollback on enrollment failure | Submit with missing billing config | DB: no child, no enrollment, no periods |
| 145 | Rollback on period generation failure | Trimester branch, only 2 calendar rows | DB clean — verify with SELECT |
| 146 | Child validation failure stops everything | Invalid child firstName (empty) + valid enrollment | 400 — no enrollment attempted |
| 147 | Duplicate enrollment causes full rollback | Child+AY already has enrollment | 409 — no new child in DB |

### C. Backend — Duplicate Enrollment Prevention

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 148 | Same child + AY conflict | Create child with enrollment for occupied AY | 409 — "enrollment already exists" |
| 149 | Different AY is fine | Same child, different academic year | Both enrollments coexist |

### D. Backend — Period Generation Equivalence

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 150 | Periods match manual enrollment | Create via auto-enrollment, compare with POST /api/payments/enrollments using same params | Identical count, boundaries, amounts, grace dates |
| 151 | Trimester via auto-enrollment | Trimester branch + 3 calendar rows | 3 periods matching calendar exactly |
| 152 | Monthly via auto-enrollment | Monthly branch, Sep–Jun | 10 periods, correct boundaries |
| 153 | Registration period via auto-enrollment | registrationFee provided | Registration period identical to manual path |

### E. Backend — Response Structure

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 154 | Response with enrollment summary | Successful creation with enrollment | `{ ...child, enrollment: { enrollmentId, periodsCreated, earliestPeriodStart, latestPeriodEnd, totalAmountDue } }` |
| 155 | periodsCreated matches DB count | Count BillingPeriod records in DB | Matches response value |
| 156 | Response without enrollment | Creation without enrollment field | No `enrollment` key in response body |
| 157 | HTTP 201 in both cases | With and without enrollment | Status code = 201 |

### F. Frontend — Enrollment Section in Child Creation Form

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 158 | Section collapsed by default | Open Create Child dialog | "Payment Enrollment" section hidden/collapsed |
| 159 | Toggle on reveals fields | Click toggle/expand | Branch select, startDate, recurringFee, registrationFee fields visible |
| 160 | Toggle off removes from payload | Collapse section, submit form | Network request has no enrollment object |
| 161 | Branch dropdown filters by config | Open branch selector | Only branches with active BillingConfig shown |
| 162 | Fee pre-fills on branch select | Select a branch | recurringFee auto-populated from branch default |
| 163 | Fee remains editable | Change pre-filled value | New value submitted |
| 164 | startDate defaults to enrollment_date | Toggle on enrollment section | startDate pre-filled with child's enrollment_date |
| 165 | Backend validation errors inline | Submit with missing config branch | Error shown next to branch field |
| 166 | RTL layout (Arabic) | User lang = Arabic | Form renders right-to-left |
| 167 | LTR layout (French) | User lang = French | Form renders left-to-right |
| 168 | Success confirmation | Submit valid child + enrollment | Toast/message shows child created + enrollment summary |
| 169 | Success without enrollment | Submit child-only (section collapsed) | Standard child creation success message |

---

## Property-Based Tests (Automated — fast-check)

These tests run automatically with `vitest` and use randomized inputs (minimum 100 iterations each).

| Property | Description | Validates |
|----------|-------------|-----------|
| P1 | Period Status Derivation Completeness — random (amountDue, totalPaid, graceEndDate, currentDate, cancelledAt) always yields exactly one valid status | Req 8.1–8.14 |
| P2 | Monthly Billing Period Generation Boundaries — random (startDate, endDate, billingDueDay) produces correct period count and date boundaries | Req 4.3, 4.4 |
| P3 | Grace End Date Invariant — grace_end_date always equals due_date + gracePeriodDays | Req 4.6, 5.4 |
| P4 | Recurring Fee as Amount Source — all non-registration periods use enrollment recurring_fee | Req 3.6, 4.8 |
| P5 | Registration Period Generation — conditional on non-null registration_fee | Req 5.1–5.7 |
| P6 | Amount Snapshot Immutability — config/fee updates don't alter existing periods | Req 6.1–6.5 |
| P7 | Payment Allocation Sum Equals Total — allocation sum always equals payment total | Req 9.4 |
| P9 | Outstanding Balance Formula — balance = sum(due) - sum(paid) including corrections | Req 13.1–13.7 |
| P10 | Correction Amount Constraint — correction per period ≤ original allocation | Req 11.12, 11.17 |
| P11 | Withdrawal Cancellation Logic — only future periods cancelled | Req 12.1, 12.2 |
| P12 | Cancelled Period Exclusion — excluded from balance and late dashboard | Req 8.12, 12.5, 14.2 |
| P13 | Reconciliation Report Consistency — grand total = sum of channel totals | Req 19.1–19.6 |
| P14 | Parent Authorization Isolation — responses only contain linked children's data | Req 17.4–17.8 |
| P15 | Tenant Scoping Isolation — staff queries scoped to their branch/school | Req 20.1–20.7 |
| P16 | Ledger Append-Only — no operation modifies/deletes existing payment records | Req 11.1–11.3 |
| P17 | Trimester/Custom Period Boundaries From Calendar — periods match calendar rows | Req 2.2, 4.5 |
| P18 | Conditional Reference Note — required for ccp/baridimob and corrections | Req 10.3, 11.7 |
| P-AE1 | Backward Compatibility — absent enrollment produces identical response | Req AE-1.2, AE-7.3 |
| P-AE2 | Atomicity — failed enrollment leaves no child/enrollment/periods | Req AE-2.1, AE-2.2 |
| P-AE3 | Billing Period Generation Equivalence — auto-enrollment = manual enrollment | Req AE-4.1, AE-4.2 |
| P-AE5 | Fee Defaulting — omitted recurringFee uses branch config default | Req AE-3.4 |

---

## Running Tests

```bash
# Run all property-based and unit tests
npm run test --workspace=backend

# Run only payment module tests
npx vitest run --workspace=backend src/modules/payments/

# Run property tests specifically
npx vitest run --workspace=backend --grep "Property"
```

---

## Manual UI Testing Checklist

### Admin Portal
- [ ] Navigate to Payments section in sidebar (Arabic & French labels)
- [ ] Branch Billing Config form: create, update, validation errors visible
- [ ] Branch Calendar: add/edit/delete entries, date picker validation
- [ ] Enrollments list: data table with sorting, create dialog
- [ ] Enrollment detail: billing periods with status badges
- [ ] Withdrawal flow: date picker, confirmation, cancelled period indicators
- [ ] Payment recording: dynamic allocations, sum validation indicator
- [ ] Correction recording: negative amounts, max calculation
- [ ] Payment history: filter, receipt view/print
- [ ] Late dashboard: data table, status filter, ordering
- [ ] Reconciliation: date range picker, channel breakdown, print
- [ ] Receipt: print layout, Arabic RTL, French LTR

### Parent Portal
- [ ] Billing periods tab: per-child periods with status badges
- [ ] Payment history tab: receipts with correction labels
- [ ] Balance summary: per-child, negative shows "paid in advance"
- [ ] View receipt: read-only, correct data
- [ ] Mobile layout: warm, feed-like, large touch targets
- [ ] No write controls visible anywhere
- [ ] Empty state for parent with no children

### Auto-Enrollment in Child Form
- [ ] Create Child dialog opens with enrollment section collapsed
- [ ] Toggle shows/hides enrollment fields
- [ ] Branch dropdown only shows configured branches
- [ ] Selecting branch pre-fills recurring fee
- [ ] Success toast shows enrollment summary
- [ ] Collapsed toggle submits child-only (verify network tab)

### Cross-Cutting
- [ ] RTL layout correct in Arabic for all pages
- [ ] LTR layout correct in French for all pages
- [ ] DZD currency formatting consistent (Western Arabic numerals)
- [ ] Inter Variable font used throughout
- [ ] No hardcoded hex colors (CSS token variables only)
- [ ] Dense, data-rich layout in admin portal
- [ ] Mobile-first, warm layout in parent portal

---

## Risk Areas & Edge Cases

| Area | Risk | Mitigation |
|------|------|------------|
| Concurrent receipt numbers | Race condition under load | SELECT ... FOR UPDATE / DB sequence |
| Transaction rollback integrity | Partial state on failure | Property test P-AE2 + integration tests |
| Period status derivation at boundaries | Off-by-one on grace_end_date | Property test P1 with edge dates |
| Decimal precision | Rounding errors in DZD | Decimal(10,2) in DB, half-up rounding on display only |
| Multi-child parent portal | Data leak between children | Property test P14 |
| Calendar overlap detection | Boundary dates (same day) | Test with period_end = next period_start |
| Withdrawal on same day as period_start | Edge: should that period be cancelled? | Verify against requirement 12.3 |

---

## Acceptance Criteria Summary

- All 169 manual test cases pass
- All 20 property-based tests pass (100+ iterations each)
- Zero critical or high-severity bugs open
- RTL/LTR layouts render correctly
- No cross-tenant data leakage
- Append-only ledger integrity maintained under all scenarios
- Payment status never blocks attendance or other operations
