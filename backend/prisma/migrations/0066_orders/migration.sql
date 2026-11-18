-- Orders left on the landing pages (Kiddoo's site, the Shopify page): only the platform sees them.
CREATE TYPE "OrderStatus" AS ENUM ('new', 'contacted', 'won', 'lost');

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'new',
    "plan" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "amount" INTEGER,
    "director_name" TEXT NOT NULL,
    "nursery_name" TEXT,
    "phone" TEXT NOT NULL,
    "wilaya" TEXT NOT NULL,
    "children_count" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "note" TEXT,
    "source" TEXT,
    "page_url" TEXT,
    "utm" JSONB,
    "event_id" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "contacted_at" TIMESTAMP(3),
    "won_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");
