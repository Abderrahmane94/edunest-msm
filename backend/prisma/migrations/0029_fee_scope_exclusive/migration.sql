-- A fee is scoped to the whole school or to specific classrooms, never both.
-- Whole-school fees left with classroom links keep the whole-school scope (the
-- one actually applied to new enrollments), so their links are dropped.
DELETE FROM "branch_fee_classrooms" bfc
USING "branch_fees" bf
WHERE bfc."branch_fee_id" = bf."id" AND bf."applies_to_school" = true;
