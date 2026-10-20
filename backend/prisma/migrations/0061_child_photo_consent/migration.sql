-- The parents' agreement to keep a child's photo: when, and who gave or recorded it.
ALTER TABLE "children" ADD COLUMN "photo_consent_at" TIMESTAMP(3);
ALTER TABLE "children" ADD COLUMN "photo_consent_by_id" TEXT;
ALTER TABLE "children" ADD COLUMN "photo_consent_by_name" TEXT;
