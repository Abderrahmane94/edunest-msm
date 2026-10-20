-- Each device a person allowed notifications on (phone, computer...), so a
-- notification reaches all of them, not only the last one signed in.
CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");
CREATE INDEX "push_devices_user_id_idx" ON "push_devices"("user_id");

ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The devices already registered (one per person until now). A device shared
-- by two accounts is kept once; it is put right on its next visit.
INSERT INTO "push_devices" ("id", "user_id", "token")
SELECT DISTINCT ON ("fcm_token") gen_random_uuid()::text, "id", "fcm_token"
FROM "users"
WHERE "fcm_token" IS NOT NULL AND "deleted_at" IS NULL
ORDER BY "fcm_token", "created_at" DESC;
