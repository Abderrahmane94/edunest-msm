-- Rooms get their own list: a room outlasts the school year, its classes don't.
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "location" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rooms_school_id_idx" ON "rooms"("school_id");

ALTER TABLE "rooms" ADD CONSTRAINT "rooms_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "classrooms" ADD COLUMN "room_id" TEXT;

CREATE INDEX "classrooms_room_id_idx" ON "classrooms"("room_id");

ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Each room typed on a class becomes a room of its school. Spellings that
-- differ only by case or spaces are one room, named after its first use.
INSERT INTO "rooms" ("id", "school_id", "name", "created_at")
SELECT gen_random_uuid()::text, t."school_id", t."name", t."created_at"
FROM (
    SELECT DISTINCT ON (c."school_id", lower(btrim(c."room_number")))
           c."school_id", btrim(c."room_number") AS "name", c."created_at"
    FROM "classrooms" c
    WHERE c."room_number" IS NOT NULL AND btrim(c."room_number") <> ''
    ORDER BY c."school_id", lower(btrim(c."room_number")), c."created_at"
) t;

UPDATE "classrooms" c
SET "room_id" = r."id"
FROM "rooms" r
WHERE r."school_id" = c."school_id"
  AND lower(r."name") = lower(btrim(c."room_number"));

ALTER TABLE "classrooms" DROP COLUMN "room_number";
