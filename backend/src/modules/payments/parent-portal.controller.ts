import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { derivePeriodStatus } from './billing-period.service';
import { paymentService, PaymentServiceError } from './payments.service';
import { successResponse, errorResponse } from '../../utils/response';

/**
 * Parent Portal Controller — read-only endpoints for parents.
 *
 * All handlers rely on `parentAuthorizationGuard` middleware having already
 * resolved the parent's linked childIds onto `req.resolvedChildIds`.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.11, 16.12
 */
export const parentPortalController = {
  /**
   * GET /api/payments/parent/periods
   * List billing periods for all linked children with derived status.
   * Returns non-cancelled periods ordered by due_date ASC.
   *
   * Req 16.1: Display every non-cancelled billing period for every linked child.
   */
  async listPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const childIds: string[] = (req as any).resolvedChildIds;

      // Req 17.12: Return empty list when parent has no linked children
      if (childIds.length === 0) {
        res.status(200).json(successResponse([]));
        return;
      }

      // Fetch all non-cancelled billing periods for linked children
      const periods = await prisma.billingPeriod.findMany({
        where: {
          enrollment: {
            childId: { in: childIds },
          },
          cancelledAt: null,
        },
        include: {
          enrollment: {
            include: {
              child: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          paymentAllocations: {
            select: {
              amount: true,
            },
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      });

      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      // Derive status for each period and build response
      const result = periods.map((period) => {
        const totalPaid = period.paymentAllocations.reduce(
          (sum, alloc) => sum.add(alloc.amount),
          new Prisma.Decimal('0'),
        );

        const derived = derivePeriodStatus(
          period.amountDue,
          totalPaid,
          period.graceEndDate,
          currentDate,
          period.cancelledAt,
        );

        // Build period label
        const periodDate = new Date(period.periodStart);
        const periodLabel = period.isRegistrationPeriod
          ? 'Registration'
          : `${periodDate.getMonth() + 1}/${periodDate.getFullYear()}`;

        return {
          id: period.id,
          childId: period.enrollment.child.id,
          childName: `${period.enrollment.child.firstName} ${period.enrollment.child.lastName}`,
          branchName: period.enrollment.branch.name,
          periodLabel,
          amountDue: period.amountDue,
          dueDate: period.dueDate,
          graceEndDate: period.graceEndDate,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          isRegistrationPeriod: period.isRegistrationPeriod,
          status: derived.status,
          isLate: derived.isLate,
          totalPaid: derived.totalPaid,
          outstanding: derived.outstanding,
        };
      });

      res.status(200).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/payments/parent/history
   * Payment history for linked children.
   * Returns payment records ordered by valueDate DESC.
   *
   * Req 16.2, 16.3: Display payment history including corrections.
   */
  async listHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const childIds: string[] = (req as any).resolvedChildIds;

      // Req 17.12: Return empty list when parent has no linked children
      if (childIds.length === 0) {
        res.status(200).json(successResponse([]));
        return;
      }

      // Fetch payment records for linked children
      const records = await prisma.paymentRecord.findMany({
        where: {
          childId: { in: childIds },
        },
        include: {
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          allocations: {
            include: {
              billingPeriod: {
                select: {
                  id: true,
                  periodStart: true,
                  periodEnd: true,
                  isRegistrationPeriod: true,
                },
              },
            },
          },
        },
        orderBy: {
          valueDate: 'desc',
        },
      });

      // Build response with period labels and correction info
      const result = records.map((record) => {
        const allocations = record.allocations.map((alloc) => {
          const periodDate = new Date(alloc.billingPeriod.periodStart);
          const periodLabel = alloc.billingPeriod.isRegistrationPeriod
            ? 'Registration'
            : `${periodDate.getMonth() + 1}/${periodDate.getFullYear()}`;

          return {
            billingPeriodId: alloc.billingPeriodId,
            periodLabel,
            amount: alloc.amount,
          };
        });

        return {
          id: record.id,
          childId: record.childId,
          childName: `${record.child.firstName} ${record.child.lastName}`,
          receiptNumber: record.receiptNumber,
          totalAmount: record.totalAmount,
          channel: record.channel,
          valueDate: record.valueDate,
          isCorrection: record.isCorrection,
          correctsPaymentId: record.correctsPaymentId,
          allocations,
        };
      });

      res.status(200).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/payments/parent/balances
   * Outstanding balances per linked child.
   *
   * Req 16.4, 16.5: One balance per child, show negative as overpayment.
   */
  async listBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const childIds: string[] = (req as any).resolvedChildIds;

      // Req 17.12: Return empty list when parent has no linked children
      if (childIds.length === 0) {
        res.status(200).json(successResponse([]));
        return;
      }

      // Calculate outstanding balance for each linked child
      const balances = await Promise.all(
        childIds.map(async (childId) => {
          // Get child info
          const child = await prisma.child.findUnique({
            where: { id: childId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          });

          if (!child) {
            return null;
          }

          try {
            const outstanding = await paymentService.getOutstandingBalance(childId);
            return {
              childId: child.id,
              childName: `${child.firstName} ${child.lastName}`,
              outstanding,
            };
          } catch (error) {
            // If child has no enrollments, return 0.00 balance
            if (error instanceof PaymentServiceError && error.code === 'NOT_FOUND') {
              return {
                childId: child.id,
                childName: `${child.firstName} ${child.lastName}`,
                outstanding: new Prisma.Decimal('0.00'),
              };
            }
            throw error;
          }
        }),
      );

      // Filter out null entries (children that no longer exist)
      const result = balances.filter((b) => b !== null);

      res.status(200).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/payments/parent/receipts/:id
   * View receipt for a payment record (authorized child only).
   *
   * Req 16.2, 18.5, 18.9: Parent can view receipt for their child's payment.
   */
  async viewReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const childIds: string[] = (req as any).resolvedChildIds;
      const { id } = req.params;

      // Look up the payment record
      const paymentRecord = await prisma.paymentRecord.findUnique({
        where: { id },
        include: {
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              school: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          recorder: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          allocations: {
            include: {
              billingPeriod: {
                select: {
                  id: true,
                  periodStart: true,
                  periodEnd: true,
                  isRegistrationPeriod: true,
                },
              },
            },
          },
          corrections: {
            select: {
              id: true,
              receiptNumber: true,
              totalAmount: true,
              valueDate: true,
            },
            orderBy: {
              valueDate: 'asc',
            },
          },
        },
      });

      if (!paymentRecord) {
        res.status(404).json(
          errorResponse('NOT_FOUND', 'Payment record not found'),
        );
        return;
      }

      // Verify the payment belongs to one of the parent's linked children
      if (!childIds.includes(paymentRecord.childId)) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'Access denied'),
        );
        return;
      }

      // Build receipt response
      const allocations = paymentRecord.allocations
        .sort((a, b) => {
          const aStart = new Date(a.billingPeriod.periodStart).getTime();
          const bStart = new Date(b.billingPeriod.periodStart).getTime();
          return aStart - bStart;
        })
        .map((alloc) => {
          const periodDate = new Date(alloc.billingPeriod.periodStart);
          const periodLabel = alloc.billingPeriod.isRegistrationPeriod
            ? 'Registration'
            : `${periodDate.getMonth() + 1}/${periodDate.getFullYear()}`;

          return {
            billingPeriodId: alloc.billingPeriodId,
            periodLabel,
            amount: alloc.amount,
          };
        });

      const receipt = {
        id: paymentRecord.id,
        receiptNumber: paymentRecord.receiptNumber,
        schoolName: paymentRecord.branch.school.name,
        branchName: paymentRecord.branch.name,
        childName: `${paymentRecord.child.firstName} ${paymentRecord.child.lastName}`,
        totalAmount: paymentRecord.totalAmount,
        channel: paymentRecord.channel,
        valueDate: paymentRecord.valueDate,
        recordedBy: `${paymentRecord.recorder.firstName} ${paymentRecord.recorder.lastName}`,
        isCorrection: paymentRecord.isCorrection,
        correctsPaymentId: paymentRecord.correctsPaymentId,
        referenceNote: paymentRecord.referenceNote,
        allocations,
        corrections: paymentRecord.corrections.map((c) => ({
          id: c.id,
          receiptNumber: c.receiptNumber,
          totalAmount: c.totalAmount,
          valueDate: c.valueDate,
        })),
      };

      res.status(200).json(successResponse(receipt));
    } catch (error) {
      next(error);
    }
  },
};
