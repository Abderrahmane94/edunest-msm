-- CreateTable
CREATE TABLE "branch_fees" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_fees_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "billing_periods" ADD COLUMN "branch_fee_id" TEXT;

-- CreateIndex
CREATE INDEX "branch_fees_branch_id_idx" ON "branch_fees"("branch_id");

-- CreateIndex
CREATE INDEX "billing_periods_branch_fee_id_idx" ON "billing_periods"("branch_fee_id");

-- AddForeignKey
ALTER TABLE "branch_fees" ADD CONSTRAINT "branch_fees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_branch_fee_id_fkey" FOREIGN KEY ("branch_fee_id") REFERENCES "branch_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
