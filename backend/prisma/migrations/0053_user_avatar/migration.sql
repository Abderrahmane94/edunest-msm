-- Everyone may give their account a photo, shown in their own menu. Kept
-- private like the children's photos; one new column, empty on what exists.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_public_id" TEXT;
