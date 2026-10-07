-- The recording device's id for a payment: payments entered offline are sent
-- later, possibly more than once; the same id is only saved once.
ALTER TABLE "payment_records" ADD COLUMN "client_id" TEXT;
CREATE UNIQUE INDEX "payment_records_client_id_key" ON "payment_records"("client_id");
