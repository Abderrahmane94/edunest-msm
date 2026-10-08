-- When the user last used the app (set at login and when the session is
-- renewed, at most once a day): shows which schools really use EduNest.
ALTER TABLE "users" ADD COLUMN "last_active_at" TIMESTAMP(3);
