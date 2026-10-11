-- Payments, expenses and salaries now belong to a school year, so each year's
-- money is seen on its own.
ALTER TABLE "payment_records" ADD COLUMN "academic_year_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN "academic_year_id" TEXT;
ALTER TABLE "salary_payments" ADD COLUMN "academic_year_id" TEXT;

CREATE INDEX "payment_records_branch_id_academic_year_id_idx" ON "payment_records"("branch_id", "academic_year_id");
CREATE INDEX "expenses_school_id_academic_year_id_idx" ON "expenses"("school_id", "academic_year_id");
CREATE INDEX "salary_payments_school_id_academic_year_id_idx" ON "salary_payments"("school_id", "academic_year_id");

ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The school year of a date: the one containing it; in a gap between two
-- years (summer), the next one; after the last year, the last one.
CREATE FUNCTION pg_temp.year_for_date(school TEXT, d DATE) RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT y.id FROM academic_years y
      WHERE y.school_id = school AND d BETWEEN y.start_date AND y.end_date
      ORDER BY y.start_date DESC LIMIT 1),
    (SELECT y.id FROM academic_years y
      WHERE y.school_id = school AND y.start_date > d
      ORDER BY y.start_date ASC LIMIT 1),
    (SELECT y.id FROM academic_years y
      WHERE y.school_id = school AND y.end_date < d
      ORDER BY y.end_date DESC LIMIT 1)
  );
$$ LANGUAGE SQL STABLE;

-- A payment: the year of the échéances it pays (the largest share if, before
-- this rule, it paid several years).
UPDATE "payment_records" pr
SET "academic_year_id" = s."academic_year_id"
FROM (
    SELECT DISTINCT ON (pa."payment_record_id") pa."payment_record_id", e."academic_year_id"
    FROM "payment_allocations" pa
    JOIN "billing_periods" bp ON bp."id" = pa."billing_period_id"
    JOIN "enrollments" e ON e."id" = bp."enrollment_id"
    ORDER BY pa."payment_record_id", abs(pa."amount") DESC
) s
WHERE s."payment_record_id" = pr."id";

-- A correction counts in the year of the payment it corrects.
UPDATE "payment_records" c
SET "academic_year_id" = p."academic_year_id"
FROM "payment_records" p
WHERE c."corrects_payment_id" = p."id" AND p."academic_year_id" IS NOT NULL;

-- Anything left (no échéance found): by its date.
UPDATE "payment_records" pr
SET "academic_year_id" = pg_temp.year_for_date(b."school_id", pr."value_date")
FROM "branches" b
WHERE b."id" = pr."branch_id" AND pr."academic_year_id" IS NULL;

UPDATE "expenses"
SET "academic_year_id" = pg_temp.year_for_date("school_id", "date");

UPDATE "salary_payments"
SET "academic_year_id" = pg_temp.year_for_date("school_id", make_date("year", "month", 1));
