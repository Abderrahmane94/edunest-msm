-- The trimester billing cycle is removed as a distinct option: it worked
-- exactly like the custom cycle (periods drawn from BranchFeePeriod
-- assignments) but additionally required exactly 3 periods. Existing
-- trimester fees keep their assigned periods and simply become "custom"
-- fees, with no other data change needed.
UPDATE "branch_fees" SET "billing_cycle" = 'custom' WHERE "billing_cycle" = 'trimester';

ALTER TYPE "BillingCycleType" RENAME TO "BillingCycleType_old";
CREATE TYPE "BillingCycleType" AS ENUM ('monthly', 'custom');
ALTER TABLE "branch_fees"
  ALTER COLUMN "billing_cycle" TYPE "BillingCycleType"
  USING ("billing_cycle"::text::"BillingCycleType");
DROP TYPE "BillingCycleType_old";
