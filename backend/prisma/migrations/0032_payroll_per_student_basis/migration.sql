-- A per-student salary is a rate per student per day. The day basis is either
-- every working day of the teacher's classes, or each day a child was present.
ALTER TABLE "employee_salaries" ADD COLUMN "per_student_basis" TEXT NOT NULL DEFAULT 'working_day';

-- The student-days a per-student salary payment was computed on.
ALTER TABLE "salary_payments" ADD COLUMN "student_days" INTEGER;
