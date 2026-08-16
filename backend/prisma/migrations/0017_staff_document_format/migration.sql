-- AlterTable: staff_profiles — store the uploaded document's file format
-- (extension) so a genuinely time-limited Cloudinary download URL can be
-- generated via private_download_url, which requires the format up front.
ALTER TABLE "staff_profiles" ADD COLUMN "document_format" TEXT;
