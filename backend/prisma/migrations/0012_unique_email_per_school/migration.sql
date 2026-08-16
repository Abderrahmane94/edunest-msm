-- Email uniqueness (among active users) is now scoped per school instead of
-- global, so the same person's email can have separate accounts in
-- different schools. Superseded by this migration: 0011's global partial
-- unique index.
--
-- Known limitation: Postgres treats each NULL as distinct in a unique
-- index, so this does not prevent two super_admin accounts (school_id IS
-- NULL) from sharing an email. Acceptable for now given how few super_admin
-- accounts exist; revisit with a second partial index if that changes.
DROP INDEX "users_email_active_key";
CREATE UNIQUE INDEX "users_email_school_active_key" ON "users"("email", "school_id") WHERE "deleted_at" IS NULL;
