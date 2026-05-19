CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'overdue', 'cancelled', 'suspended');
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual');

CREATE TABLE "subscription_plans" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_monthly" DECIMAL(10,2) NOT NULL,
  "price_annual" DECIMAL(10,2),
  "currency" TEXT NOT NULL DEFAULT 'DZD',
  "max_children" INTEGER,
  "max_users" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "school_subscriptions" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
  "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
  "current_period_start" DATE NOT NULL,
  "current_period_end" DATE NOT NULL,
  "trial_ends_at" DATE,
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_subscriptions_school_id_key" ON "school_subscriptions"("school_id");

CREATE TABLE "subscription_payments" (
  "id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'DZD',
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL,
  "recorded_by" TEXT NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "school_subscriptions" ADD CONSTRAINT "school_subscriptions_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_subscriptions" ADD CONSTRAINT "school_subscriptions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "school_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
