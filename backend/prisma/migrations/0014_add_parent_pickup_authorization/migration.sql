-- AlterTable: parent_child_links — track whether a linked parent is
-- authorized to pick up the child (defaults to true; can be revoked for
-- custody situations without removing the parent-child link itself).
ALTER TABLE "parent_child_links" ADD COLUMN "can_pickup" BOOLEAN NOT NULL DEFAULT true;
