-- A soft-deleted user's email was permanently unusable: the app's normal
-- queries filter out deleted_at IS NOT NULL rows (so invite()/register()
-- reported the email as free), but the full-table unique index still
-- rejected the raw INSERT. Replace it with a partial index that only
-- enforces uniqueness among active (non-deleted) users.
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_email_active_key" ON "users"("email") WHERE "deleted_at" IS NULL;
