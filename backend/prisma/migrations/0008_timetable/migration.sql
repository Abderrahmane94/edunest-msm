-- AlterTable: Add working_days column to classrooms
ALTER TABLE "classrooms" ADD COLUMN "working_days" JSONB NOT NULL DEFAULT '["sunday","monday","tuesday","wednesday","thursday"]';
