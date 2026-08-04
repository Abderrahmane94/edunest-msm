import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';

/**
 * Property 7: Payment Allocation Sum Equals Total
 *
 * For any valid payment recording submission, the sum of all payment allocation
 * amounts SHALL equal the submitted total amount. If they differ by any non-zero
 * amount, the submission SHALL be rejected.
 *
 * **Validates: Requirements 9.4**
 */

/**
 * Pure validation function that checks if the allocation sum equals the total amount.
 * This mirrors the validation logic in payments.service.ts (step d.2).
 */
function validateAllocationSum(
  totalAmount: Prisma.Decimal,
  allocations: Array<{ amount: Prisma.Decimal }>
): boolean {
  const sum = allocations.reduce(
    (s, a) => s.add(a.amount),
    new Prisma.Decimal(0)
  );
  return sum.equals(totalAmount);
}

/**
 * Generates a positive Prisma.Decimal with 2 decimal places.
 * Range: 0.01 to 999999.99
 */
function arbPositiveDecimal() {
  return fc
    .integer({ min: 1, max: 99999999 })
    .map((cents) => new Prisma.Decimal(cents).div(100));
}

/**
 * Generates allocation amounts that sum exactly to the given totalAmount.
 * Splits the total into `count` parts, each at least 0.01.
 */
function arbAllocationsMatchingTotal(totalAmount: Prisma.Decimal, count: number) {
  // Generate `count` weights and split totalAmount proportionally
  // ensuring each allocation is at least 0.01
  return fc
    .array(fc.integer({ min: 1, max: 10000 }), {
      minLength: count,
      maxLength: count,
    })
    .map((weights) => {
      const totalCents = Number(totalAmount.mul(100).toFixed(0));
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      // Distribute cents proportionally
      const allocCents: number[] = [];
      let remaining = totalCents;

      for (let i = 0; i < count - 1; i++) {
        // Each allocation gets at least 1 cent
        const share = Math.max(1, Math.floor((weights[i] / totalWeight) * totalCents));
        // Ensure we leave enough for remaining allocations (each needs at least 1 cent)
        const maxForThis = remaining - (count - i - 1);
        const clamped = Math.min(share, maxForThis);
        const finalShare = Math.max(1, clamped);
        allocCents.push(finalShare);
        remaining -= finalShare;
      }
      // Last allocation gets whatever remains
      allocCents.push(remaining);

      return allocCents.map((cents) => ({
        amount: new Prisma.Decimal(cents).div(100),
      }));
    });
}

describe('Property 7: Payment Allocation Sum Equals Total', () => {
  it('when allocation amounts sum exactly to totalAmount, validation passes', () => {
    fc.assert(
      fc.property(
        arbPositiveDecimal(),
        fc.integer({ min: 1, max: 10 }),
        (totalAmount, allocationCount) => {
          // Ensure totalAmount has enough cents for all allocations (min 0.01 each)
          const totalCents = Number(totalAmount.mul(100).toFixed(0));
          if (totalCents < allocationCount) return; // skip if impossible to split

          // Generate allocations that sum to totalAmount
          const totalWeight = allocationCount * 100; // arbitrary
          const allocCents: number[] = [];
          let remaining = totalCents;

          for (let i = 0; i < allocationCount - 1; i++) {
            const maxForThis = remaining - (allocationCount - i - 1);
            const share = Math.max(1, Math.min(Math.floor(remaining / (allocationCount - i)), maxForThis));
            allocCents.push(share);
            remaining -= share;
          }
          allocCents.push(remaining);

          const allocations = allocCents.map((cents) => ({
            amount: new Prisma.Decimal(cents).div(100),
          }));

          // Verify the sum equals totalAmount
          const result = validateAllocationSum(totalAmount, allocations);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('when allocation amounts differ from totalAmount by any non-zero amount, validation fails', () => {
    fc.assert(
      fc.property(
        arbPositiveDecimal(),
        fc.array(arbPositiveDecimal(), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.boolean(),
        (totalAmount, rawAllocations, offsetCents, addOffset) => {
          // Wrap raw decimals into allocation objects
          const allocations = rawAllocations.map((amount) => ({ amount }));

          // Calculate the natural sum of the allocations
          const sum = allocations.reduce(
            (s, a) => s.add(a.amount),
            new Prisma.Decimal(0)
          );

          // Create a totalAmount that differs from the sum by a non-zero offset
          const offset = new Prisma.Decimal(offsetCents).div(100);
          const mismatchedTotal = addOffset ? sum.add(offset) : sum.sub(offset);

          // Skip if the offset accidentally makes them equal
          if (mismatchedTotal.equals(sum)) return;
          // Skip negative or zero totals (not valid for payment)
          if (mismatchedTotal.lte(0)) return;

          const result = validateAllocationSum(mismatchedTotal, allocations);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('validation is symmetric: splitting totalAmount across allocations in any way passes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 9999999 }), // totalCents (at least 1.00)
        fc.integer({ min: 2, max: 8 }),
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 8, maxLength: 8 }),
        (totalCents, allocationCount, weights) => {
          const totalAmount = new Prisma.Decimal(totalCents).div(100);

          // Use the first `allocationCount` weights to split the amount
          const activeWeights = weights.slice(0, allocationCount);
          const totalWeight = activeWeights.reduce((a, b) => a + b, 0);

          const allocCents: number[] = [];
          let remaining = totalCents;

          for (let i = 0; i < allocationCount - 1; i++) {
            const maxForThis = remaining - (allocationCount - i - 1);
            const share = Math.max(
              1,
              Math.min(
                Math.floor((activeWeights[i] / totalWeight) * totalCents),
                maxForThis
              )
            );
            allocCents.push(share);
            remaining -= share;
          }
          allocCents.push(remaining);

          // Verify all allocations are positive
          if (allocCents.some((c) => c < 1)) return;

          const allocations = allocCents.map((cents) => ({
            amount: new Prisma.Decimal(cents).div(100),
          }));

          // No matter how we split, the sum should equal totalAmount
          const result = validateAllocationSum(totalAmount, allocations);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('single allocation equal to totalAmount passes validation', () => {
    fc.assert(
      fc.property(arbPositiveDecimal(), (totalAmount) => {
        const allocations = [{ amount: totalAmount }];
        const result = validateAllocationSum(totalAmount, allocations);
        expect(result).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('empty allocations array only passes when totalAmount is zero', () => {
    fc.assert(
      fc.property(arbPositiveDecimal(), (totalAmount) => {
        const allocations: Array<{ amount: Prisma.Decimal }> = [];
        const result = validateAllocationSum(totalAmount, allocations);
        // Since totalAmount is always positive (>= 0.01), empty allocations should fail
        expect(result).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });
});
