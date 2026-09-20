import prisma from '../../lib/prisma';

/** The interactive-transaction client type actually produced by our tenant/soft-delete-extended `prisma`. */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Fetches BranchCalendar rows for the custom billing cycle, shaped for
 * `generatePeriodsForEnrollment`. Monthly cycles need no calendar rows.
 *
 * Periods are reusable, branch + academic-year scoped building blocks
 * explicitly assigned to fees via BranchFeePeriod — a period can be shared by
 * several fees, and a fee can be assigned several periods.
 *
 * Shared by enrollment creation and recurring-fee application so both walk
 * the exact same calendar-resolution path.
 */
export async function fetchCalendarRows(
  tx: TransactionClient,
  branchFeeId: string,
  academicYearId: string,
  billingCycle: 'monthly' | 'custom',
): Promise<Array<{ periodStart: Date; periodEnd: Date }>> {
  if (billingCycle !== 'custom') {
    return [];
  }

  const rows = await tx.branchCalendar.findMany({
    where: {
      academicYearId,
      feeAssignments: { some: { branchFeeId } },
    },
    orderBy: { periodStart: 'asc' },
  });

  return rows.map((r) => ({
    periodStart: new Date(r.periodStart),
    periodEnd: new Date(r.periodEnd),
  }));
}
