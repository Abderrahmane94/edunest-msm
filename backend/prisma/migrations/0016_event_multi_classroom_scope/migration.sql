-- Replace the single-classroom event scope with a many-to-many link, so an
-- event can target zero (whole school), one, or several classrooms.

-- DropColumn
ALTER TABLE "events" DROP COLUMN "classroom_id";

-- CreateTable
CREATE TABLE "event_classrooms" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_classrooms_event_id_classroom_id_key" ON "event_classrooms"("event_id", "classroom_id");

-- AddForeignKey
ALTER TABLE "event_classrooms" ADD CONSTRAINT "event_classrooms_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_classrooms" ADD CONSTRAINT "event_classrooms_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
