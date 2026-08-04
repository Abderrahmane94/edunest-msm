-- Migration: Payment Management
-- This migration introduces the branch-level billing and payment collection system.
-- It creates Branch, BranchBillingConfig, BranchCalendar, Enrollment, BillingPeriod,
-- PaymentRecord, PaymentAllocation, and PaymentAuditEntry models.
-- It also adds payroll tables (EmployeeSalary, SalaryPayment) and deleted_at on subscription_payments.

-- ============================================================================
-- DEPRECATED TABLES (kept for historical data, no longer used for new enrollments)
-- ============================================================================
-- DEPRECATED: The "invoices" table is superseded by the new billing_periods + payment_records model.
-- New enrollments use billing_periods and payment_records exclusively.
-- This table is retained for historical data only. Do NOT use for new billing.

-- DEPRECATED: The "cash_payments" table is superseded by the new payment_records model.
-- New payments are recorded exclusively in payment_records with payment_allocations.
-- This table is retained for historical data only. Do NOT use for new payments.

-- DEPRECATED: The "payment_audit_logs" table is superseded by the new payment_audit_entries model.
-- New audit entries are written to payment_audit_entries exclusively.
-- This table is retained for historical data only. Do NOT use for new audit logging.

COMMENT ON TABLE "invoices" IS 'DEPRECATED: Superseded by billing_periods + payment_records. Retained for historical data only.';
COMMENT ON TABLE "cash_payments" IS 'DEPRECATED: Superseded by payment_records + payment_allocations. Retained for historical data only.';
COMMENT ON TABLE "payment_audit_logs" IS 'DEPRECATED: Superseded by payment_audit_entries. Retained for historical data only.';

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

-- CreateEnum
CREATE TYPE "BillingCycleType" AS ENUM ('monthly', 'trimester', 'custom');

-- CreateEnum
CREATE TYPE "NotificationSettingType" AS ENUM ('enabled', 'disabled');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'withdrawn', 'completed');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('cash', 'ccp', 'baridimob');

-- ============================================================================
-- ALTER EXISTING TABLES
-- ============================================================================

-- AlterTable: Add branch_id to users (nullable, for branch-scoped staff)
ALTER TABLE "users" ADD COLUMN "branch_id" TEXT;

-- AlterTable: Add deleted_at to subscription_payments
ALTER TABLE "subscription_payments" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- ============================================================================
-- NEW TABLES: Payment Management
-- ============================================================================

-- CreateTable: branches
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branches_school_id_idx" ON "branches"("school_id");

-- CreateIndex
CREATE INDEX "branches_deleted_at_idx" ON "branches"("deleted_at");

-- CreateTable: branch_billing_configs
CREATE TABLE "branch_billing_configs" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "billing_cycle" "BillingCycleType" NOT NULL,
    "billing_due_day" INTEGER NOT NULL,
    "grace_period_days" INTEGER NOT NULL DEFAULT 5,
    "default_recurring_fee" DECIMAL(10,2) NOT NULL,
    "notification_setting" "NotificationSettingType" NOT NULL DEFAULT 'disabled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_billing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_billing_configs_branch_id_key" ON "branch_billing_configs"("branch_id");

-- CreateTable: branch_calendars
CREATE TABLE "branch_calendars" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_calendars_branch_id_academic_year_id_idx" ON "branch_calendars"("branch_id", "academic_year_id");

-- CreateTable: enrollments
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "registration_fee" DECIMAL(10,2),
    "recurring_fee" DECIMAL(10,2) NOT NULL,
    "withdrawal_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_child_id_academic_year_id_key" ON "enrollments"("child_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "enrollments_branch_id_academic_year_id_idx" ON "enrollments"("branch_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "enrollments_child_id_idx" ON "enrollments"("child_id");

-- CreateTable: billing_periods
CREATE TABLE "billing_periods" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "grace_end_date" DATE NOT NULL,
    "amount_due" DECIMAL(10,2) NOT NULL,
    "is_registration_period" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_periods_enrollment_id_idx" ON "billing_periods"("enrollment_id");

-- CreateIndex
CREATE INDEX "billing_periods_due_date_idx" ON "billing_periods"("due_date");

-- CreateIndex
CREATE INDEX "billing_periods_cancelled_at_idx" ON "billing_periods"("cancelled_at");

-- CreateTable: payment_records
CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "value_date" DATE NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "reference_note" TEXT,
    "is_correction" BOOLEAN NOT NULL DEFAULT false,
    "corrects_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_receipt_number_key" ON "payment_records"("receipt_number");

-- CreateIndex
CREATE INDEX "payment_records_branch_id_value_date_idx" ON "payment_records"("branch_id", "value_date");

-- CreateIndex
CREATE INDEX "payment_records_child_id_idx" ON "payment_records"("child_id");

-- CreateIndex
CREATE INDEX "payment_records_corrects_payment_id_idx" ON "payment_records"("corrects_payment_id");

-- CreateTable: payment_allocations
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "payment_record_id" TEXT NOT NULL,
    "billing_period_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_record_id_billing_period_id_key" ON "payment_allocations"("payment_record_id", "billing_period_id");

-- CreateIndex
CREATE INDEX "payment_allocations_billing_period_id_idx" ON "payment_allocations"("billing_period_id");

-- CreateTable: payment_audit_entries
CREATE TABLE "payment_audit_entries" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "payment_record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performed_by" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_audit_entries_branch_id_created_at_idx" ON "payment_audit_entries"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_audit_entries_payment_record_id_idx" ON "payment_audit_entries"("payment_record_id");

-- ============================================================================
-- NEW TABLES: Payroll
-- ============================================================================

-- CreateTable: employee_salaries
CREATE TABLE "employee_salaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "salary_type" TEXT NOT NULL DEFAULT 'fixed',
    "base_salary" DECIMAL(10,2),
    "rate_per_student" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "effective_from" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_salaries_user_id_key" ON "employee_salaries"("user_id");

-- CreateIndex
CREATE INDEX "employee_salaries_school_id_idx" ON "employee_salaries"("school_id");

-- CreateTable: salary_payments
CREATE TABLE "salary_payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "base_salary" DECIMAL(10,2) NOT NULL,
    "bonuses" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(10,2) NOT NULL,
    "student_count" INTEGER,
    "paid_at" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_payments_user_id_month_year_key" ON "salary_payments"("user_id", "month", "year");

-- CreateIndex
CREATE INDEX "salary_payments_school_id_year_month_idx" ON "salary_payments"("school_id", "year", "month");

-- CreateIndex
CREATE INDEX "salary_payments_deleted_at_idx" ON "salary_payments"("deleted_at");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

-- AddForeignKey: users.branch_id -> branches.id
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: branches.school_id -> schools.id
ALTER TABLE "branches" ADD CONSTRAINT "branches_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: branch_billing_configs.branch_id -> branches.id
ALTER TABLE "branch_billing_configs" ADD CONSTRAINT "branch_billing_configs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: branch_calendars.branch_id -> branches.id
ALTER TABLE "branch_calendars" ADD CONSTRAINT "branch_calendars_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: branch_calendars.academic_year_id -> academic_years.id
ALTER TABLE "branch_calendars" ADD CONSTRAINT "branch_calendars_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: enrollments.child_id -> children.id
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: enrollments.branch_id -> branches.id
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: enrollments.academic_year_id -> academic_years.id
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: billing_periods.enrollment_id -> enrollments.id
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payment_records.branch_id -> branches.id
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payment_records.child_id -> children.id
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payment_records.recorded_by -> users.id
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payment_records.corrects_payment_id -> payment_records.id (self-reference)
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_corrects_payment_id_fkey" FOREIGN KEY ("corrects_payment_id") REFERENCES "payment_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: payment_allocations.payment_record_id -> payment_records.id
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "payment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payment_allocations.billing_period_id -> billing_periods.id
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: employee_salaries.user_id -> users.id
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: salary_payments.user_id -> users.id
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- DATA MIGRATION: Create default branch for each existing school
-- ============================================================================
-- For single-location schools, a default branch is auto-created so that
-- existing schools have a Branch to associate billing config with.
-- The branch name follows the pattern "{School Name} - Main".

INSERT INTO "branches" ("id", "school_id", "name", "is_active", "created_at")
SELECT gen_random_uuid(), "id", "name" || ' - Main', true, now()
FROM "schools";

-- ============================================================================
-- NOTE: The parent_child_links table already exists (created in 0001_init).
-- It serves as the ChildParent join table — no new table is needed.
-- ============================================================================
