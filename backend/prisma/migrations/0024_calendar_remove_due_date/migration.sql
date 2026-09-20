-- Due date moves out of the reusable period library and stays purely on the
-- fee (BranchFee.billing_due_day already carries it). A calendar period is
-- just a date range now; the actual per-period due date paid by an
-- enrollment is computed from its fee's billing_due_day and stored on
-- BillingPeriod as before.
ALTER TABLE "branch_calendars" DROP COLUMN "due_date";
