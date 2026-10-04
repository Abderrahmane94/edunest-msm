-- A discount is either a percentage or a fixed amount taken off each
-- échéance it applies to — exactly one of the two.
ALTER TABLE "discounts" ALTER COLUMN "percentage" DROP NOT NULL;
ALTER TABLE "discounts" ADD COLUMN "fixed_amount" DECIMAL(10,2);
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_percentage_xor_fixed_amount"
  CHECK (("percentage" IS NULL) <> ("fixed_amount" IS NULL));
