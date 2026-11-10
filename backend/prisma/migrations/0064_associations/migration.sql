-- Associations running several clubs (each club a school of its own): the
-- association's officers see the clubs' figures. A new table, a new role and
-- two nullable links; nothing existing changes.

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'association' AFTER 'super_admin';

-- CreateTable
CREATE TABLE "associations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "association_id" TEXT;
ALTER TABLE "users" ADD COLUMN "association_id" TEXT;

-- CreateIndex
CREATE INDEX "schools_association_id_idx" ON "schools"("association_id");

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
