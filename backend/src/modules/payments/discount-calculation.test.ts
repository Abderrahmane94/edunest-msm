import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { computeDiscountedAmountDue } from './discount.service';

const fee = new Prisma.Decimal('15000');

describe('computeDiscountedAmountDue', () => {
  it('returns the full recurring fee when there are no discounts', () => {
    const result = computeDiscountedAmountDue(fee, new Date('2026-01-01'), []);
    expect(result.toString()).toBe('15000');
  });

  it('applies a single discount valid at the period start', () => {
    const discounts = [
      { percentage: 15, validFrom: new Date('2026-01-01'), validTo: null },
    ];
    const result = computeDiscountedAmountDue(fee, new Date('2026-02-01'), discounts);
    expect(result.toString()).toBe('12750');
  });

  it('ignores a discount that has not started yet', () => {
    const discounts = [
      { percentage: 50, validFrom: new Date('2026-03-01'), validTo: null },
    ];
    const result = computeDiscountedAmountDue(fee, new Date('2026-02-01'), discounts);
    expect(result.toString()).toBe('15000');
  });

  it('ignores a discount that has already expired', () => {
    const discounts = [
      { percentage: 50, validFrom: new Date('2026-01-01'), validTo: new Date('2026-01-31') },
    ];
    const result = computeDiscountedAmountDue(fee, new Date('2026-02-01'), discounts);
    expect(result.toString()).toBe('15000');
  });

  it('includes a discount on its exact validFrom and validTo boundaries', () => {
    const periodStart = new Date('2026-02-01');
    const discounts = [
      { percentage: 10, validFrom: periodStart, validTo: periodStart },
    ];
    const result = computeDiscountedAmountDue(fee, periodStart, discounts);
    expect(result.toString()).toBe('13500');
  });

  it('sums multiple simultaneously-active discounts', () => {
    const periodStart = new Date('2026-02-01');
    const discounts = [
      { percentage: 15, validFrom: new Date('2026-01-01'), validTo: null },
      { percentage: 10, validFrom: new Date('2026-01-01'), validTo: null },
    ];
    const result = computeDiscountedAmountDue(fee, periodStart, discounts);
    // 25% off 15000 = 11250
    expect(result.toString()).toBe('11250');
  });

  it('caps the combined percentage at 100', () => {
    const periodStart = new Date('2026-02-01');
    const discounts = [
      { percentage: 70, validFrom: new Date('2026-01-01'), validTo: null },
      { percentage: 60, validFrom: new Date('2026-01-01'), validTo: null },
    ];
    const result = computeDiscountedAmountDue(fee, periodStart, discounts);
    expect(result.toString()).toBe('0');
  });

  it('always derives from the base recurring fee, not a previous result', () => {
    const periodStart = new Date('2026-02-01');
    const oneDiscount = [{ percentage: 20, validFrom: new Date('2026-01-01'), validTo: null }];
    const first = computeDiscountedAmountDue(fee, periodStart, oneDiscount);
    expect(first.toString()).toBe('12000');

    // Recomputing with the same discount list from the same base fee is
    // idempotent — it doesn't compound on top of the previous result.
    const second = computeDiscountedAmountDue(fee, periodStart, oneDiscount);
    expect(second.toString()).toBe(first.toString());
  });
});
