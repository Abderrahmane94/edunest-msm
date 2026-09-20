-- Calendar periods now belong to one specific recurring fee instead of being
-- shared branch-wide: different fees can have entirely different custom or
-- trimester schedules for the same academic year.
--
-- No way to backfill which fee an existing period belonged to (this
-- association didn't exist before), so existing branch_calendars rows are
-- cleared — this feature is newly-shipped and not yet in real use beyond
-- testing.

-- Clear existing rows (see note above)
DELETE FROM "branch_calendars";

-- AlterTable
ALTER TABLE "branch_calendars" ADD COLUMN "branch_fee_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "branch_calendars_branch_fee_id_academic_year_id_idx" ON "branch_calendars"("branch_fee_id", "academic_year_id");

-- AddForeignKey
ALTER TABLE "branch_calendars" ADD CONSTRAINT "branch_calendars_branch_fee_id_fkey" FOREIGN KEY ("branch_fee_id") REFERENCES "branch_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
