-- Whether a fee is offered in the child-registration wizard's fee step.
ALTER TABLE "branch_fees" ADD COLUMN "show_in_wizard" BOOLEAN NOT NULL DEFAULT true;
