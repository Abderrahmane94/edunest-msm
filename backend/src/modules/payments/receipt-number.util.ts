import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Type representing a Prisma interactive transaction client.
 * Used when the function is called within a $transaction block.
 */
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Generates a unique receipt number in the format: {BRANCH_CODE}-{YYYY}-{SEQ}
 *
 * - BRANCH_CODE: First 3 ASCII-safe uppercase characters of the branch name, padded with 'X' if shorter.
 * - YYYY: Year extracted from the value date.
 * - SEQ: Auto-incrementing sequence per branch per year, zero-padded to 6 digits.
 *
 * Concurrency safety is handled by counting existing records for the branch/year
 * within the same transaction. The unique constraint on receipt_number provides
 * additional safety against duplicates.
 *
 * @param tx - Prisma transaction client
 * @param branchId - The branch ID
 * @param branchName - The branch name (used to derive BRANCH_CODE)
 * @param valueDate - The payment value date (year is extracted from this)
 * @returns The generated receipt number string
 */
export async function generateReceiptNumber(
  tx: TransactionClient,
  branchId: string,
  branchName: string,
  valueDate: Date
): Promise<string> {
  const branchCode = deriveBranchCode(branchName);
  const year = valueDate.getFullYear();

  // Count existing payment records for this branch in the given year.
  // The unique constraint on receipt_number provides safety against duplicates.
  // In the rare case of a collision, the transaction will fail and can be retried.
  const result = await (tx as unknown as PrismaClient).$queryRaw<
    [{ next_seq: bigint }]
  >(
    Prisma.sql`
      SELECT COALESCE(COUNT(*), 0) + 1 AS next_seq
      FROM payment_records
      WHERE branch_id = ${branchId}
        AND EXTRACT(YEAR FROM value_date) = ${year}
    `
  );

  const seq = Number(result[0].next_seq);
  const seqStr = seq.toString().padStart(6, '0');

  return `${branchCode}-${year}-${seqStr}`;
}

/**
 * Derives the 3-character branch code from a branch name.
 *
 * Rules:
 * - Extracts only ASCII letters (A-Z, a-z) from the branch name
 * - Takes the first 3 characters and uppercases them
 * - If fewer than 3 ASCII letters are available, pads with 'X'
 * - If no ASCII letters exist at all, falls back to 'BRN'
 */
export function deriveBranchCode(branchName: string): string {
  // Extract only ASCII letters from the branch name
  const asciiLetters = branchName.replace(/[^A-Za-z]/g, '');

  if (asciiLetters.length === 0) {
    return 'BRN';
  }

  const code = asciiLetters.slice(0, 3).toUpperCase();

  // Pad with 'X' if shorter than 3 characters
  return code.padEnd(3, 'X');
}
