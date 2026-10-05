-- When an attendance record last changed. Attendance saved offline carries
-- the time it was marked; a record changed on the server after that (e.g. an
-- admin correction) is kept instead of being overwritten.
ALTER TABLE "attendance_records" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "attendance_records" SET "updated_at" = "created_at";
