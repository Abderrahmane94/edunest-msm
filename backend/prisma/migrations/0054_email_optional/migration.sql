-- Not everyone has an email: such an account signs in with its phone
-- number instead (the app asks for one of the two). The unique index on
-- (email, school_id) lets any number of accounts have none.

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
