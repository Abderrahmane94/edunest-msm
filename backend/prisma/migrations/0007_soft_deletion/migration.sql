-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_school_id_fkey";

-- AlterTable
ALTER TABLE "children" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "classrooms" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "children_deleted_at_idx" ON "children"("deleted_at");

-- CreateIndex
CREATE INDEX "classrooms_deleted_at_idx" ON "classrooms"("deleted_at");

-- CreateIndex
CREATE INDEX "schools_deleted_at_idx" ON "schools"("deleted_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
