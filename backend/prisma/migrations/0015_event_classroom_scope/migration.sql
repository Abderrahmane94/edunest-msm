-- AlterTable: events — optionally scope an event to a single classroom
-- instead of always applying to the whole school. When set, consent forms
-- are only generated for children enrolled in that classroom.
ALTER TABLE "events" ADD COLUMN "classroom_id" TEXT;
