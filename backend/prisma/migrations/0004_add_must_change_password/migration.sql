-- AlterTable
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable (make school_id nullable for super_admin users)
ALTER TABLE "users" ALTER COLUMN "school_id" DROP NOT NULL;
