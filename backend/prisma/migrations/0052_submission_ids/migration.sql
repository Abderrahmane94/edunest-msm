-- An expense or a cash handover sent twice (the first answer was lost on the
-- way) must be saved once: the form's own id is kept with the record, as
-- payments already do. Two new columns, empty on what exists; nothing else changes.

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "client_id" TEXT;

-- AlterTable
ALTER TABLE "cash_handovers" ADD COLUMN "client_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "expenses_client_id_key" ON "expenses"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_handovers_client_id_key" ON "cash_handovers"("client_id");
