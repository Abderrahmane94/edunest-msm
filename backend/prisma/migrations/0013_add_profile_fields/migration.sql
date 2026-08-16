-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('a_positive', 'a_negative', 'b_positive', 'b_negative', 'ab_positive', 'ab_negative', 'o_positive', 'o_negative');

-- AlterTable: users — phone already existed (migration 0010); add address + national ID
ALTER TABLE "users" ADD COLUMN "address" TEXT;
ALTER TABLE "users" ADD COLUMN "national_id" TEXT;

-- AlterTable: children — national ID, address, place of birth, blood type
ALTER TABLE "children" ADD COLUMN "national_id" TEXT;
ALTER TABLE "children" ADD COLUMN "address" TEXT;
ALTER TABLE "children" ADD COLUMN "place_of_birth" TEXT;
ALTER TABLE "children" ADD COLUMN "blood_type" "BloodType";

-- AlterTable: emergency_contacts — address + national ID, so staff can verify
-- identity for whoever is authorized to pick up a child.
ALTER TABLE "emergency_contacts" ADD COLUMN "address" TEXT;
ALTER TABLE "emergency_contacts" ADD COLUMN "national_id" TEXT;
