-- Billing is now entirely fee-based (no "base fee" per enrollment).

-- The amount a period was billed before any discount: discounts are always
-- computed from it, so editing or removing a discount restores it exactly.
ALTER TABLE "billing_periods" ADD COLUMN "base_amount" DECIMAL(10,2);
UPDATE "billing_periods" SET "base_amount" = "amount_due";

-- A discount can target one fee; NULL means every recurring fee.
ALTER TABLE "discounts" ADD COLUMN "branch_fee_id" TEXT;
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_branch_fee_id_fkey"
  FOREIGN KEY ("branch_fee_id") REFERENCES "branch_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "discounts_branch_fee_id_idx" ON "discounts"("branch_fee_id");
