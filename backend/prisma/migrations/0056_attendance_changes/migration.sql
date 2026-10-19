-- The history of each child's attendance: every mark and correction, who and when.
CREATE TABLE "attendance_changes" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "from_status" "AttendanceStatus",
    "to_status" "AttendanceStatus" NOT NULL,
    "from_note" TEXT,
    "to_note" TEXT,
    "by_user_id" TEXT NOT NULL,
    "by_name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_changes_record_id_idx" ON "attendance_changes"("record_id");
CREATE INDEX "attendance_changes_school_id_classroom_id_date_idx" ON "attendance_changes"("school_id", "classroom_id", "date");
CREATE INDEX "attendance_changes_child_id_date_idx" ON "attendance_changes"("child_id", "date");

ALTER TABLE "attendance_changes" ADD CONSTRAINT "attendance_changes_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
