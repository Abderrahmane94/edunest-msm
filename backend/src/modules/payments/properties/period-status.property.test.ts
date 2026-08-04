import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { derivePeriodStatus } from '../billing-period.service';

/**
 * Property 1: Period Status Derivation Completeness and Correctness
 *
 * For any combination of amountDue (≥ 0), totalPaid (any value), graceEndDate (any date),
 * currentDate (any date), and cancelledAt (null or any timestamp), derivePeriodStatus SHALL
 * return exactly one of the five status values and SHALL return is_late = true only when status
 * is 'late' or 'late_partial' and cancelledAt is null, and is_late = false in all other cases.
 *
 * **Validates: Requirements 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 8.9, 8.13, 8.14**
 */
describe('Property 1: Period Status Derivation Completeness and Correctness', () => {
  const VALID_STATUSES = ['unpaid', 'partial', 'late_partial', 'late', 'paid'] as const;

  // Arbitraries
  const amountDueArb = fc.double({ min: 0, max: 9999999.99, noNaN: true }).map(
    (v) => new Prisma.Decimal(v.toFixed(2))
  );

  const totalPaidArb = fc.double({ min: -9999999.99, max: 9999999.99, noNaN: true }).map(
    (v) => new Prisma.Decimal(v.toFixed(2))
  );

  const dateArb = fc.date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2100-12-31T23:59:59.999Z'),
    noInvalidDate: true,
  });

  const cancelledAtArb = fc.option(dateArb);

  it('should return exactly one valid status value', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        totalPaidArb,
        dateArb,
        dateArb,
        cancelledAtArb,
        (amountDue, totalPaid, graceEndDate, currentDate, cancelledAt) => {
          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          expect(VALID_STATUSES).toContain(result.status);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should set isLate = true ONLY when status is late or late_partial AND cancelledAt is null', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        totalPaidArb,
        dateArb,
        dateArb,
        cancelledAtArb,
        (amountDue, totalPaid, graceEndDate, currentDate, cancelledAt) => {
          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          if (result.isLate) {
            // isLate true => status must be 'late' or 'late_partial' AND cancelledAt must be null
            expect(['late', 'late_partial']).toContain(result.status);
            expect(cancelledAt).toBeNull();
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should set isLate = false when cancelledAt is non-null', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        totalPaidArb,
        dateArb,
        dateArb,
        // Force cancelledAt to be non-null
        dateArb,
        (amountDue, totalPaid, graceEndDate, currentDate, cancelledAt) => {
          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          expect(result.isLate).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should compute outstanding as amountDue - totalPaid', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        totalPaidArb,
        dateArb,
        dateArb,
        cancelledAtArb,
        (amountDue, totalPaid, graceEndDate, currentDate, cancelledAt) => {
          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          const expectedOutstanding = amountDue.minus(totalPaid);
          expect(result.outstanding.equals(expectedOutstanding)).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should return status paid when totalPaid >= amountDue', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        fc.double({ min: 0, max: 9999999.99, noNaN: true }),
        dateArb,
        dateArb,
        cancelledAtArb,
        (amountDue, extra, graceEndDate, currentDate, cancelledAt) => {
          // Generate totalPaid >= amountDue
          const totalPaid = amountDue.plus(new Prisma.Decimal(extra.toFixed(2)));

          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          expect(result.status).toBe('paid');
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should return status late_partial when 0 < totalPaid < amountDue AND currentDate > graceEndDate', () => {
    fc.assert(
      fc.property(
        // amountDue must be > 0.01 so there's room for partial payment
        fc.double({ min: 0.02, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
        dateArb,
        cancelledAtArb,
        (amountDue, graceEndDate, cancelledAt) => {
          // totalPaid is between 0.01 and amountDue - 0.01
          const totalPaid = new Prisma.Decimal('0.01');
          // currentDate is after graceEndDate
          const currentDate = new Date(graceEndDate.getTime() + 86400000); // +1 day

          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          expect(result.status).toBe('late_partial');
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should return status partial when 0 < totalPaid < amountDue AND currentDate <= graceEndDate', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.02, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
        dateArb,
        cancelledAtArb,
        (amountDue, graceEndDate, cancelledAt) => {
          const totalPaid = new Prisma.Decimal('0.01');
          // currentDate is on or before graceEndDate
          const currentDate = new Date(graceEndDate.getTime());

          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          expect(result.status).toBe('partial');
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should return status late when totalPaid <= 0 AND currentDate > graceEndDate', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
        dateArb,
        cancelledAtArb,
        (amountDue, graceEndDate, cancelledAt) => {
          const totalPaid = new Prisma.Decimal('0');
          // currentDate after graceEndDate
          const currentDate = new Date(graceEndDate.getTime() + 86400000);

          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          expect(result.status).toBe('late');
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should return status unpaid when totalPaid <= 0 AND currentDate <= graceEndDate', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
        dateArb,
        cancelledAtArb,
        (amountDue, graceEndDate, cancelledAt) => {
          const totalPaid = new Prisma.Decimal('0');
          // currentDate on or before graceEndDate
          const currentDate = new Date(graceEndDate.getTime());

          const result = derivePeriodStatus(
            amountDue,
            totalPaid,
            graceEndDate,
            currentDate,
            cancelledAt
          );

          expect(result.status).toBe('unpaid');
        }
      ),
      { numRuns: 1000 }
    );
  });
});
