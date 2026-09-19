import prisma from '../../lib/prisma';

/** The interactive-transaction client type actually produced by our tenant/soft-delete-extended `prisma`. */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Fetches BranchCalendar rows for trimester/custom billing cycles, shaped for
 * `generatePeriodsForEnrollment`. Monthly cycles need no calendar rows.
 *
 * Shared by enrollment creation and recurring-fee application so both walk
 * the exact same calendar-resolution path.
 */
export async function fetchCalendarRows(
  tx: TransactionClient,
  branchId: string,
  academicYearId: string,
  billingCycle: 'monthly' | 'trimester' | 'custom',
): Promise<Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }>> {
  if (billingCycle !== 'trimester' && billingCycle !== 'custom') {
    return [];
  }

  const rows = await tx.branchCalendar.findMany({
    where: { branchId, academicYearId },
    orderBy: { periodStart: 'asc' },
  });

  return rows.map((r) => ({
    periodStart: new Date(r.periodStart),
    periodEnd: new Date(r.periodEnd),
    dueDate: new Date(r.dueDate),
  }));
}
