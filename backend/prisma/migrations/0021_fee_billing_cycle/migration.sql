-- Move billing cycle configuration from the branch-wide billing config into
-- each fee: a fee can now optionally be "recurring" (billing_cycle set),
-- generating a full cycle of billing periods when applied, instead of the
-- single always-one-shot behavior fees had before. Enrollment creation now
-- picks a recurring fee (base_fee_id) instead of relying on a branch-wide
-- default cycle/fee.
--
-- No data backfill: existing branch_billing_configs rows lose their cycle/
-- due-day/grace-period/default-fee values (product decision — admins
-- recreate their recurring fee(s) once, post-deploy). Already-generated
-- billing_periods and each enrollment's recurring_fee amount are untouched.

-- AlterTable: branch_fees gains optional cycle fields
ALTER TABLE "branch_fees"
  ADD COLUMN "billing_cycle" "BillingCycleType",
  ADD COLUMN "billing_due_day" INTEGER,
  ADD COLUMN "grace_period_days" INTEGER;

-- AlterTable: enrollments records which recurring fee generated its base periods
ALTER TABLE "enrollments" ADD COLUMN "base_fee_id" TEXT;

-- CreateIndex
CREATE INDEX "enrollments_base_fee_id_idx" ON "enrollments"("base_fee_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_base_fee_id_fkey" FOREIGN KEY ("base_fee_id") REFERENCES "branch_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: branch_billing_configs keeps only the notification setting
ALTER TABLE "branch_billing_configs"
  DROP COLUMN "billing_cycle",
  DROP COLUMN "billing_due_day",
  DROP COLUMN "grace_period_days",
  DROP COLUMN "default_recurring_fee";
