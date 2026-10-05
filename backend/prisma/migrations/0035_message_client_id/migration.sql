-- The sending device's id for a message: messages written offline are sent
-- later, possibly more than once; the same id is only saved once.
ALTER TABLE "messages" ADD COLUMN "client_id" TEXT;
CREATE UNIQUE INDEX "messages_client_id_key" ON "messages"("client_id");

ALTER TABLE "staff_messages" ADD COLUMN "client_id" TEXT;
CREATE UNIQUE INDEX "staff_messages_client_id_key" ON "staff_messages"("client_id");
