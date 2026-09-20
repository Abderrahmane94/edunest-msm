-- Course correction from migration 0022: periods should exist independently
-- (reusable, branch + academic-year scoped, as they originally were) and be
-- explicitly assignable to one or more fees, rather than each period
-- belonging to exactly one fee. Introduces a many-to-many join table.

-- DropForeignKey
ALTER TABLE "branch_calendars" DROP CONSTRAINT "branch_calendars_branch_fee_id_fkey";

-- DropIndex
DROP INDEX "branch_calendars_branch_fee_id_academic_year_id_idx";

-- AlterTable
ALTER TABLE "branch_calendars" DROP COLUMN "branch_fee_id";

-- CreateTable
CREATE TABLE "branch_fee_periods" (
    "id" TEXT NOT NULL,
    "branch_fee_id" TEXT NOT NULL,
    "branch_calendar_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "branch_fee_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_fee_periods_branch_fee_id_branch_calendar_id_key" ON "branch_fee_periods"("branch_fee_id", "branch_calendar_id");

-- CreateIndex
CREATE INDEX "branch_fee_periods_branch_calendar_id_idx" ON "branch_fee_periods"("branch_calendar_id");

-- AddForeignKey
ALTER TABLE "branch_fee_periods" ADD CONSTRAINT "branch_fee_periods_branch_fee_id_fkey" FOREIGN KEY ("branch_fee_id") REFERENCES "branch_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_fee_periods" ADD CONSTRAINT "branch_fee_periods_branch_calendar_id_fkey" FOREIGN KEY ("branch_calendar_id") REFERENCES "branch_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
