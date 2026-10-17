-- People the school employs who do not use the app (cleaning, cooking,
-- driving): an account to be in the staff list and the payroll, which
-- cannot sign in. A new role; nothing else changes.

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'staff';
