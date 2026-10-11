-- Office access profiles: what each office staff member may do.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "access_profile_id" TEXT;

-- CreateTable
CREATE TABLE "access_profiles" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_profiles_school_id_name_key" ON "access_profiles"("school_id", "name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_access_profile_id_fkey" FOREIGN KEY ("access_profile_id") REFERENCES "access_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every school gets the default office profile, with exactly what the
-- administrative staff could do so far; their accounts are given it.
INSERT INTO "access_profiles" ("id", "school_id", "name", "description", "permissions", "is_default", "updated_at")
SELECT gen_random_uuid()::text, s."id", 'Agent administratif',
       'Profil par défaut du personnel de bureau', '{"areas":{"children":"edit","classes":"edit","communication":"edit","inventory":"edit","collections":"edit","expenses":"none","fees":"view","payroll":"none","staff":"none","settings":"none"},"delete":false,"correctPayments":false}'::jsonb, true, CURRENT_TIMESTAMP
FROM "schools" s;

UPDATE "users" u
SET "access_profile_id" = p."id"
FROM "access_profiles" p
WHERE p."school_id" = u."school_id" AND p."is_default" AND u."role" = 'administrative';
