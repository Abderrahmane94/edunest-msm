-- Migration 0019: Staff messaging (teacher ↔ teacher, admin ↔ teacher)
-- Adds StaffConversation and StaffMessage tables scoped to a school.

CREATE TABLE "staff_conversations" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "school_id"       TEXT        NOT NULL,
  "initiator_id"    TEXT        NOT NULL,
  "recipient_id"    TEXT        NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "staff_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_conversations_school_pair_key" UNIQUE ("school_id", "initiator_id", "recipient_id")
);

CREATE INDEX "staff_conversations_school_id_idx"    ON "staff_conversations"("school_id");
CREATE INDEX "staff_conversations_initiator_id_idx" ON "staff_conversations"("initiator_id");
CREATE INDEX "staff_conversations_recipient_id_idx" ON "staff_conversations"("recipient_id");

ALTER TABLE "staff_conversations"
  ADD CONSTRAINT "staff_conversations_school_id_fkey"
    FOREIGN KEY ("school_id")    REFERENCES "schools"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "staff_conversations_initiator_id_fkey"
    FOREIGN KEY ("initiator_id") REFERENCES "users"("id"),
  ADD CONSTRAINT "staff_conversations_recipient_id_fkey"
    FOREIGN KEY ("recipient_id") REFERENCES "users"("id");

CREATE TABLE "staff_messages" (
  "id"                   TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "conversation_id"      TEXT        NOT NULL,
  "sender_user_id"       TEXT        NOT NULL,
  "content"              TEXT,
  "message_type"         "MessageType" NOT NULL DEFAULT 'text',
  "cloudinary_public_id" TEXT,
  "is_read"              BOOLEAN     NOT NULL DEFAULT false,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "staff_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_messages_conversation_id_created_at_idx"
  ON "staff_messages"("conversation_id", "created_at");

ALTER TABLE "staff_messages"
  ADD CONSTRAINT "staff_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "staff_conversations"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "staff_messages_sender_user_id_fkey"
    FOREIGN KEY ("sender_user_id") REFERENCES "users"("id");
