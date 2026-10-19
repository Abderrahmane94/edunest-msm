-- Receipt numbers are unique within a branch, not across the platform: two schools
-- whose names give the same code (e.g. two Arabic names, both "BRN") each start at 000001.
DROP INDEX "payment_records_receipt_number_key";
CREATE UNIQUE INDEX "payment_records_branch_id_receipt_number_key" ON "payment_records"("branch_id", "receipt_number");
