-- A fee scoped to the whole school: set when the fee is assigned to the whole
-- school, and applied automatically to every new enrollment afterwards.
ALTER TABLE "branch_fees" ADD COLUMN "applies_to_school" BOOLEAN NOT NULL DEFAULT false;
