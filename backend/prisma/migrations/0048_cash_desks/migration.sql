-- Cash desks: whose desk each cash payment and cash expense is in, and the handovers.
-- New columns are empty for what exists already: desks start from zero.

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "cash_handover_id" TEXT,
ADD COLUMN     "paid_from_cash_user_id" TEXT;

-- AlterTable
ALTER TABLE "payment_records" ADD COLUMN     "cash_handover_id" TEXT,
ADD COLUMN     "cashier_user_id" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "cash_alert_amount" DECIMAL(10,2) NOT NULL DEFAULT 50000,
ADD COLUMN     "cash_alert_days" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "cash_handovers" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "cashier_user_id" TEXT NOT NULL,
    "collected_by_user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'handover',
    "opening_float" DECIMAL(10,2) NOT NULL,
    "cash_in" DECIMAL(10,2) NOT NULL,
    "cash_out" DECIMAL(10,2) NOT NULL,
    "expected_amount" DECIMAL(10,2) NOT NULL,
    "counted_amount" DECIMAL(10,2) NOT NULL,
    "float_left" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_handovers_school_id_created_at_idx" ON "cash_handovers"("school_id", "created_at");

-- CreateIndex
CREATE INDEX "cash_handovers_cashier_user_id_created_at_idx" ON "cash_handovers"("cashier_user_id", "created_at");

-- CreateIndex
CREATE INDEX "expenses_paid_from_cash_user_id_cash_handover_id_idx" ON "expenses"("paid_from_cash_user_id", "cash_handover_id");

-- CreateIndex
CREATE INDEX "payment_records_cashier_user_id_cash_handover_id_idx" ON "payment_records"("cashier_user_id", "cash_handover_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cash_handover_id_fkey" FOREIGN KEY ("cash_handover_id") REFERENCES "cash_handovers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_cash_handover_id_fkey" FOREIGN KEY ("cash_handover_id") REFERENCES "cash_handovers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_cashier_user_id_fkey" FOREIGN KEY ("cashier_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_collected_by_user_id_fkey" FOREIGN KEY ("collected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
