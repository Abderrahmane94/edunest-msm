-- A parent can write to the school office as well as to the teacher.
ALTER TABLE "conversations" ADD COLUMN "with_office" BOOLEAN NOT NULL DEFAULT false;
