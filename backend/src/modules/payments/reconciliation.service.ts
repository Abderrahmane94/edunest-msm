import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { ReconciliationReport, ChannelSummary } from './payments.types';

export class ReconciliationServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ReconciliationServiceError';
  }
}

/**
 * Reconciliation Service
 *
 * Generates reconciliation reports for a branch within a date range.
 * Groups payment records by channel (cash, ccp, baridimob) and computes:
 * - Signed totals (corrections are negative)
 * - Payment count (non-correction records)
 * - Correction count (is_correction = true records)
 */
export const reconciliationService = {
  /**
   * Generate a reconciliation report for the specified branch and date range.
   *
   * @param branchId - The branch to generate the report for
   * @param rangeStart - Start of the date range (inclusive)
   * @param rangeEnd - End of the date range (inclusive)
   * @returns ReconciliationReport with per-channel breakdowns and grand total
   */
  async generateReport(
    branchId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<ReconciliationReport> {
    // Validate date range
    if (!rangeStart || !rangeEnd) {
      throw new ReconciliationServiceError(
        'VALIDATION_ERROR',
        'Both rangeStart and rangeEnd are required',
        400,
      );
    }

    if (rangeStart > rangeEnd) {
      throw new ReconciliationServiceError(
        'VALIDATION_ERROR',
        'rangeStart must be less than or equal to rangeEnd',
        400,
      );
    }

    // Query all payment records for the branch within the date range
    const records = await prisma.paymentRecord.findMany({
      where: {
        branchId,
        valueDate: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        totalAmount: true,
        channel: true,
        isCorrection: true,
      },
    });

    // Initialize channel summaries with zero values
    const channels: Record<'cash' | 'ccp' | 'baridimob', ChannelSummary> = {
      cash: { total: new Prisma.Decimal('0.00'), paymentCount: 0, correctionCount: 0 },
      ccp: { total: new Prisma.Decimal('0.00'), paymentCount: 0, correctionCount: 0 },
      baridimob: { total: new Prisma.Decimal('0.00'), paymentCount: 0, correctionCount: 0 },
    };

    // Group by channel and compute totals
    for (const record of records) {
      const channel = record.channel as 'cash' | 'ccp' | 'baridimob';
      const summary = channels[channel];

      // Signed sum: corrections have negative totalAmount already stored
      summary.total = summary.total.add(record.totalAmount);

      if (record.isCorrection) {
        summary.correctionCount += 1;
      } else {
        summary.paymentCount += 1;
      }
    }

    // Grand total = sum of all channel totals
    const grandTotal = channels.cash.total
      .add(channels.ccp.total)
      .add(channels.baridimob.total);

    return {
      branchId,
      rangeStart,
      rangeEnd,
      channels,
      grandTotal,
    };
  },
};
