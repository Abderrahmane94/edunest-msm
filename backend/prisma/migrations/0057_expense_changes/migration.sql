-- The history of each expense: every creation, change, receipt, deletion and restore, who and when.
CREATE TABLE "expense_changes" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "snapshot" JSONB,
    "receipt_public_id" TEXT,
    "by_user_id" TEXT NOT NULL,
    "by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expense_changes_expense_id_idx" ON "expense_changes"("expense_id");
CREATE INDEX "expense_changes_school_id_action_created_at_idx" ON "expense_changes"("school_id", "action", "created_at");
