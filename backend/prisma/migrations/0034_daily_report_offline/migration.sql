-- Daily reports saved offline are sent later. updated_at dates a report's
-- last change, so a newer change made on the server isn't overwritten.
ALTER TABLE "daily_reports" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "daily_reports" SET "updated_at" = "created_at";

-- The device's id for a photo: a photo sent again (lost response, retry)
-- isn't added twice.
ALTER TABLE "daily_report_photos" ADD COLUMN "client_id" TEXT;
CREATE UNIQUE INDEX "daily_report_photos_client_id_key" ON "daily_report_photos"("client_id");
