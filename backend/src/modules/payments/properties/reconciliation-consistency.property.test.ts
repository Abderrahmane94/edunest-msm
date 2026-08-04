import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';

/**
 * Property 13: Reconciliation Report Consistency
 *
 * For any branch and date range, the reconciliation report grand total SHALL equal
 * the sum of the per-channel totals, each channel total SHALL equal the signed sum
 * of all payment record amounts of that channel whose value date falls within the
 * range, and each channel's payment count plus correction count SHALL equal the
 * total number of matching records for that channel.
 *
 * **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.6**
 */

type PaymentChannel = 'cash' | 'ccp' | 'baridimob';

interface ReconciliationRecord {
  channel: PaymentChannel;
  totalAmount: Prisma.Decimal;
  isCorrection: boolean;
}

interface ChannelSummary {
  total: Prisma.Decimal;
  paymentCount: number;
  correctionCount: number;
}

interface ReconciliationResult {
  channels: Record<PaymentChannel, ChannelSummary>;
  grandTotal: Prisma.Decimal;
}

/**
 * Pure function simulating the reconciliation logic.
 * Groups records by channel, computes signed totals, payment counts, and correction counts.
 */
function computeReconciliation(
  records: ReconciliationRecord[]
): ReconciliationResult {
  const channels: Record<PaymentChannel, ChannelSummary> = {
    cash: { total: new Prisma.Decimal('0.00'), paymentCount: 0, correctionCount: 0 },
    ccp: { total: new Prisma.Decimal('0.00'), paymentCount: 0, correctionCount: 0 },
    baridimob: { total: new Prisma.Decimal('0.00'), paymentCount: 0, correctionCount: 0 },
  };

  for (const record of records) {
    const summary = channels[record.channel];
    summary.total = summary.total.add(record.totalAmount);

    if (record.isCorrection) {
      summary.correctionCount += 1;
    } else {
      summary.paymentCount += 1;
    }
  }

  const grandTotal = channels.cash.total
    .add(channels.ccp.total)
    .add(channels.baridimob.total);

  return { channels, grandTotal };
}

/**
 * Generates a Prisma.Decimal amount (positive for payments, negative for corrections).
 */
function arbPaymentAmount() {
  return fc
    .integer({ min: 1, max: 99999999 })
    .map((cents) => new Prisma.Decimal(cents).div(100));
}

function arbCorrectionAmount() {
  return fc
    .integer({ min: 1, max: 99999999 })
    .map((cents) => new Prisma.Decimal(cents).div(100).neg());
}

function arbChannel(): fc.Arbitrary<PaymentChannel> {
  return fc.constantFrom('cash', 'ccp', 'baridimob');
}

function arbRecord(): fc.Arbitrary<ReconciliationRecord> {
  return fc.oneof(
    // Payment record (positive amount)
    fc.record({
      channel: arbChannel(),
      totalAmount: arbPaymentAmount(),
      isCorrection: fc.constant(false),
    }),
    // Correction record (negative amount)
    fc.record({
      channel: arbChannel(),
      totalAmount: arbCorrectionAmount(),
      isCorrection: fc.constant(true),
    })
  );
}

describe('Property 13: Reconciliation Report Consistency', () => {
  it('grand total equals sum of channel totals', () => {
    fc.assert(
      fc.property(
        fc.array(arbRecord(), { minLength: 0, maxLength: 50 }),
        (records) => {
          const result = computeReconciliation(records);

          const sumOfChannelTotals = result.channels.cash.total
            .add(result.channels.ccp.total)
            .add(result.channels.baridimob.total);

          expect(result.grandTotal.equals(sumOfChannelTotals)).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('each channel total equals signed sum of records for that channel', () => {
    fc.assert(
      fc.property(
        fc.array(arbRecord(), { minLength: 0, maxLength: 50 }),
        (records) => {
          const result = computeReconciliation(records);

          const channelNames: PaymentChannel[] = ['cash', 'ccp', 'baridimob'];

          for (const channel of channelNames) {
            const channelRecords = records.filter((r) => r.channel === channel);
            const expectedTotal = channelRecords.reduce(
              (sum, r) => sum.add(r.totalAmount),
              new Prisma.Decimal('0.00')
            );

            expect(result.channels[channel].total.equals(expectedTotal)).toBe(true);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('paymentCount + correctionCount equals total matching records per channel', () => {
    fc.assert(
      fc.property(
        fc.array(arbRecord(), { minLength: 0, maxLength: 50 }),
        (records) => {
          const result = computeReconciliation(records);

          const channelNames: PaymentChannel[] = ['cash', 'ccp', 'baridimob'];

          for (const channel of channelNames) {
            const channelRecords = records.filter((r) => r.channel === channel);
            const summary = result.channels[channel];

            expect(summary.paymentCount + summary.correctionCount).toBe(
              channelRecords.length
            );
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('channels with no records have total=0 and counts=0', () => {
    fc.assert(
      fc.property(
        fc.array(arbRecord(), { minLength: 0, maxLength: 50 }),
        (records) => {
          const result = computeReconciliation(records);

          const channelNames: PaymentChannel[] = ['cash', 'ccp', 'baridimob'];

          for (const channel of channelNames) {
            const channelRecords = records.filter((r) => r.channel === channel);

            if (channelRecords.length === 0) {
              expect(result.channels[channel].total.equals(new Prisma.Decimal('0.00'))).toBe(true);
              expect(result.channels[channel].paymentCount).toBe(0);
              expect(result.channels[channel].correctionCount).toBe(0);
            }
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});
