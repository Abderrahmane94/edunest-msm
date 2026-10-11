-- Equipment the school owns, by room (new table only; nothing existing changes).

-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('good', 'repair', 'broken');

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "EquipmentCondition" NOT NULL DEFAULT 'good',
    "room_id" TEXT,
    "purchase_date" DATE,
    "unit_value" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_school_id_idx" ON "equipment"("school_id");

-- CreateIndex
CREATE INDEX "equipment_room_id_idx" ON "equipment"("room_id");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
