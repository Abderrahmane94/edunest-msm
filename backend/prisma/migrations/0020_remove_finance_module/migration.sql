-- Remove the legacy finance module (fee_structures/invoices/cash_payments/
-- payment_audit_logs and the old child-scoped discounts table), fully
-- superseded by the payments module (branches/enrollments/billing_periods/
-- payment_records) introduced in migration 0009. Per product decision, the
-- admin UI and backend for /admin/finance are being replaced entirely by
-- /admin/payments, including per-child discounts (now enrollment-scoped) and
-- expense tracking (moved into the payments module, table unchanged).

-- DropTable
DROP TABLE "payment_audit_logs";

-- DropTable
DROP TABLE "cash_payments";

-- DropTable
DROP TABLE "invoices";

-- DropTable
DROP TABLE "fee_structures";

-- DropTable
DROP TABLE "discounts";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "FeeFrequency";

-- CreateTable
-- Enrollment-scoped discounts, replacing the child-scoped table dropped above.
-- Applying/editing a discount recalculates amount_due on billing periods that
-- have no payment allocations yet (see discount.service.ts); periods with any
-- recorded payment are left untouched.
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discounts_enrollment_id_idx" ON "discounts"("enrollment_id");

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
