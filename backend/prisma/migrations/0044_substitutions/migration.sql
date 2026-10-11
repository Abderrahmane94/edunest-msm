-- Teacher replacements (new table and a notification type; nothing existing changes).

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'substitution';

-- CreateTable
CREATE TABLE "substitutions" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "absent_teacher_id" TEXT,
    "substitute_user_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "parents_notified" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "substitutions_classroom_id_start_date_idx" ON "substitutions"("classroom_id", "start_date");

-- CreateIndex
CREATE INDEX "substitutions_substitute_user_id_start_date_idx" ON "substitutions"("substitute_user_id", "start_date");

-- CreateIndex
CREATE INDEX "substitutions_school_id_start_date_idx" ON "substitutions"("school_id", "start_date");

-- AddForeignKey
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_absent_teacher_id_fkey" FOREIGN KEY ("absent_teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_substitute_user_id_fkey" FOREIGN KEY ("substitute_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
