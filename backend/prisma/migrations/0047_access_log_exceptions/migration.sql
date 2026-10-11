-- The rights journal and per-person exceptions (new tables only).

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "profile_id" TEXT,
    "profile_name" TEXT,
    "target_user_id" TEXT,
    "target_name" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_exceptions" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "ends_on" DATE,
    "note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_logs_school_id_created_at_idx" ON "access_logs"("school_id", "created_at");

-- CreateIndex
CREATE INDEX "access_logs_target_user_id_idx" ON "access_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "access_exceptions_school_id_idx" ON "access_exceptions"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_exceptions_user_id_area_key" ON "access_exceptions"("user_id", "area");

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_exceptions" ADD CONSTRAINT "access_exceptions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_exceptions" ADD CONSTRAINT "access_exceptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
