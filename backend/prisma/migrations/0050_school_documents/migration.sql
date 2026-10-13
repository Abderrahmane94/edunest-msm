-- The school's documents: what it prints or sends often (enrollment form, rules, health sheet…).
-- A new right, "documents": the office profiles that exist can see them; managing them is given by the director.

-- CreateTable
CREATE TABLE "school_documents" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "file_public_id" TEXT NOT NULL,
    "file_extension" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "visible_to_parents" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_documents_school_id_category_idx" ON "school_documents"("school_id", "category");

-- AddForeignKey
ALTER TABLE "school_documents" ADD CONSTRAINT "school_documents_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The profiles that exist: seeing the documents, for those that say nothing about them yet.
UPDATE "access_profiles"
SET "permissions" = jsonb_set("permissions", '{areas,documents}', '"view"', true)
WHERE jsonb_typeof("permissions" -> 'areas') = 'object'
  AND NOT ("permissions" -> 'areas' ? 'documents');
