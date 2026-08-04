import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';

/**
 * Property 10: Correction Amount Constraint
 *
 * For any correction payment record with corrects_payment_id pointing to an
 * original record, and for any billing period referenced by that correction's
 * allocations, the absolute sum of all correction allocations against that period
 * under the same corrects_payment_id SHALL NOT exceed the amount the original
 * record allocated to that period.
 *
 * **Validates: Requirements 11.12, 11.17**
 */

/**
 * Pure validation function that checks whether a new correction allocation
 * (absolute value) is within the remaining correctable limit for a given period.
 *
 * @param originalAllocation - The amount the original payment allocated to the period (positive)
 * @param priorCorrections - Absolute sum of prior correction allocations for the same period
 *                           under the same corrects_payment_id
 * @param newCorrectionAbs - Absolute value of the new correction allocation
 * @returns true if the correction is within limit, false otherwise
 */
function validateCorrectionLimit(
  originalAllocation: Prisma.Decimal,
  priorCorrections: Prisma.Decimal,
  newCorrectionAbs: Prisma.Decimal
): boolean {
  return priorCorrections.add(newCorrectionAbs).lte(originalAllocation);
}

/**
 * Generates a positive Prisma.Decimal with 2 decimal places.
 * Range: 0.01 to 9999.99
 */
function arbPositiveDecimal(min = 1, max = 999999) {
  return fc
    .integer({ min, max })
    .map((cents) => new Prisma.Decimal(cents).div(100));
}

describe('Property 10: Correction Amount Constraint', () => {
  it('when priorCorrections + newCorrectionAbs <= originalAllocation, correction is valid', () => {
    fc.assert(
      fc.property(
        // originalAllocation: 0.01 to 9999.99
        arbPositiveDecimal(1, 999999),
        // fraction of original already corrected (0.00 to 1.00 ratio)
        fc.integer({ min: 0, max: 100 }),
        // fraction of remaining used by new correction (0.00 to 1.00 ratio)
        fc.integer({ min: 0, max: 100 }),
        (originalAllocation, priorPct, newPct) => {
          const originalCents = Number(originalAllocation.mul(100).toFixed(0));

          // priorCorrections: 0 to originalAllocation
          const priorCents = Math.floor((priorPct / 100) * originalCents);
          const priorCorrections = new Prisma.Decimal(priorCents).div(100);

          // remaining correctable amount
          const remainingCents = originalCents - priorCents;
          if (remainingCents <= 0) return; // skip: no room for new correction

          // newCorrectionAbs: 0.01 to remaining
          const newCents = Math.max(1, Math.floor((newPct / 100) * remainingCents));
          const newCorrectionAbs = new Prisma.Decimal(newCents).div(100);

          // By construction: priorCents + newCents <= originalCents
          const result = validateCorrectionLimit(
            originalAllocation,
            priorCorrections,
            newCorrectionAbs
          );
          expect(result).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('when priorCorrections + newCorrectionAbs > originalAllocation, correction is invalid', () => {
    fc.assert(
      fc.property(
        // originalAllocation: 0.01 to 9999.99
        arbPositiveDecimal(1, 999999),
        // priorCorrections: 0 to originalAllocation
        fc.integer({ min: 0, max: 100 }),
        // excess cents beyond the limit (at least 1 cent over)
        fc.integer({ min: 1, max: 999999 }),
        (originalAllocation, priorPct, excessCents) => {
          const originalCents = Number(originalAllocation.mul(100).toFixed(0));

          // priorCorrections: 0 to originalAllocation
          const priorCents = Math.floor((priorPct / 100) * originalCents);
          const priorCorrections = new Prisma.Decimal(priorCents).div(100);

          // remaining correctable amount
          const remainingCents = originalCents - priorCents;

          // newCorrectionAbs = remaining + excess (always exceeds limit)
          const newCents = remainingCents + excessCents;
          const newCorrectionAbs = new Prisma.Decimal(newCents).div(100);

          const result = validateCorrectionLimit(
            originalAllocation,
            priorCorrections,
            newCorrectionAbs
          );
          expect(result).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('correcting exactly the remaining amount is valid (boundary case)', () => {
    fc.assert(
      fc.property(
        // originalAllocation: 0.01 to 9999.99
        arbPositiveDecimal(1, 999999),
        // fraction of original already corrected (0 to 99%)
        fc.integer({ min: 0, max: 99 }),
        (originalAllocation, priorPct) => {
          const originalCents = Number(originalAllocation.mul(100).toFixed(0));

          // priorCorrections: 0 to 99% of original
          const priorCents = Math.floor((priorPct / 100) * originalCents);
          const priorCorrections = new Prisma.Decimal(priorCents).div(100);

          // newCorrectionAbs = exactly the remaining amount
          const remainingCents = originalCents - priorCents;
          if (remainingCents <= 0) return; // skip: nothing to correct

          const newCorrectionAbs = new Prisma.Decimal(remainingCents).div(100);

          // Exactly at the limit: priorCents + remainingCents === originalCents
          const result = validateCorrectionLimit(
            originalAllocation,
            priorCorrections,
            newCorrectionAbs
          );
          expect(result).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('with zero prior corrections, correction up to originalAllocation is valid', () => {
    fc.assert(
      fc.property(
        // originalAllocation: 0.01 to 9999.99
        arbPositiveDecimal(1, 999999),
        // newCorrectionAbs: 0.01 to originalAllocation
        fc.integer({ min: 0, max: 100 }),
        (originalAllocation, pct) => {
          const originalCents = Number(originalAllocation.mul(100).toFixed(0));
          const priorCorrections = new Prisma.Decimal(0);

          // newCorrectionAbs: 0.01 up to originalAllocation
          const newCents = Math.max(1, Math.floor((pct / 100) * originalCents));
          const newCorrectionAbs = new Prisma.Decimal(newCents).div(100);

          const result = validateCorrectionLimit(
            originalAllocation,
            priorCorrections,
            newCorrectionAbs
          );
          expect(result).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('exceeding by exactly one cent is invalid', () => {
    fc.assert(
      fc.property(
        // originalAllocation: 0.02 to 9999.99 (need at least 2 cents for meaningful test)
        arbPositiveDecimal(2, 999999),
        // priorCorrections: 0 to originalAllocation - 0.01
        fc.integer({ min: 0, max: 99 }),
        (originalAllocation, priorPct) => {
          const originalCents = Number(originalAllocation.mul(100).toFixed(0));

          const priorCents = Math.floor((priorPct / 100) * (originalCents - 1));
          const priorCorrections = new Prisma.Decimal(priorCents).div(100);

          // Remaining + exactly 1 cent over
          const remainingCents = originalCents - priorCents;
          const newCents = remainingCents + 1;
          const newCorrectionAbs = new Prisma.Decimal(newCents).div(100);

          const result = validateCorrectionLimit(
            originalAllocation,
            priorCorrections,
            newCorrectionAbs
          );
          expect(result).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
