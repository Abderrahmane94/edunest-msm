-- Persistent many-to-many link between a BranchFee and a Classroom: lets a
-- fee declare which classrooms it applies to (metadata only — it does not
-- itself apply the fee to anyone). A fee with no links is a general fee.
CREATE TABLE "branch_fee_classrooms" (
    "id" TEXT NOT NULL,
    "branch_fee_id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "branch_fee_classrooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_fee_classrooms_branch_fee_id_classroom_id_key" ON "branch_fee_classrooms"("branch_fee_id", "classroom_id");

CREATE INDEX "branch_fee_classrooms_classroom_id_idx" ON "branch_fee_classrooms"("classroom_id");

ALTER TABLE "branch_fee_classrooms" ADD CONSTRAINT "branch_fee_classrooms_branch_fee_id_fkey" FOREIGN KEY ("branch_fee_id") REFERENCES "branch_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "branch_fee_classrooms" ADD CONSTRAINT "branch_fee_classrooms_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
