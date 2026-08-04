import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// Mock prisma before importing the service
vi.mock('../../lib/prisma', () => ({
  default: {
    paymentRecord: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';
import { receiptService, type ReceiptData } from './receipt.service';

const mockFindUnique = vi.mocked(prisma.paymentRecord.findUnique);

/**
 * Helper to build a mock payment record with all relations.
 */
function buildMockPaymentRecord(overrides: Partial<{
  id: string;
  branchId: string;
  childId: string;
  receiptNumber: string;
  totalAmount: Prisma.Decimal;
  channel: 'cash' | 'ccp' | 'baridimob';
  valueDate: Date;
  recordedBy: string;
  referenceNote: string | null;
  isCorrection: boolean;
  correctsPaymentId: string | null;
  branchName: string;
  schoolName: string;
  childFirstName: string;
  childLastName: string;
  recorderFirstName: string;
  recorderLastName: string;
  allocations: Array<{
    id: string;
    amount: Prisma.Decimal;
    billingPeriod: {
      periodStart: Date;
      periodEnd: Date;
      isRegistrationPeriod: boolean;
    };
  }>;
  corrections: Array<{
    receiptNumber: string;
    valueDate: Date;
    totalAmount: Prisma.Decimal;
  }>;
  correctedPayment: { receiptNumber: string } | null;
}> = {}) {
  return {
    id: overrides.id ?? 'payment-1',
    branchId: overrides.branchId ?? 'branch-1',
    childId: overrides.childId ?? 'child-1',
    receiptNumber: overrides.receiptNumber ?? 'MAI-2024-000001',
    totalAmount: overrides.totalAmount ?? new Prisma.Decimal('5000.00'),
    channel: overrides.channel ?? 'cash',
    valueDate: overrides.valueDate ?? new Date('2024-09-15'),
    recordedBy: overrides.recordedBy ?? 'user-1',
    referenceNote: overrides.referenceNote ?? null,
    isCorrection: overrides.isCorrection ?? false,
    correctsPaymentId: overrides.correctsPaymentId ?? null,
    createdAt: new Date('2024-09-15T10:00:00Z'),
    branch: {
      id: 'branch-1',
      name: overrides.branchName ?? 'Main Branch',
      school: {
        name: overrides.schoolName ?? 'EduNest Kindergarten',
      },
    },
    child: {
      firstName: overrides.childFirstName ?? 'Ahmed',
      lastName: overrides.childLastName ?? 'Benali',
    },
    recorder: {
      firstName: overrides.recorderFirstName ?? 'Fatima',
      lastName: overrides.recorderLastName ?? 'Zerhouni',
    },
    allocations: overrides.allocations ?? [
      {
        id: 'alloc-1',
        amount: new Prisma.Decimal('2500.00'),
        billingPeriod: {
          periodStart: new Date('2024-09-01'),
          periodEnd: new Date('2024-09-30'),
          isRegistrationPeriod: false,
        },
      },
      {
        id: 'alloc-2',
        amount: new Prisma.Decimal('2500.00'),
        billingPeriod: {
          periodStart: new Date('2024-10-01'),
          periodEnd: new Date('2024-10-31'),
          isRegistrationPeriod: false,
        },
      },
    ],
    corrections: overrides.corrections ?? [],
    correctedPayment: overrides.correctedPayment ?? null,
  };
}

describe('ReceiptService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateReceipt', () => {
    it('returns 404 error when payment record not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        receiptService.generateReceipt('nonexistent-id', 'fr'),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'No receipt exists for the requested identifier',
      });
    });

    describe('French (LTR) receipt', () => {
      it('produces a receipt with all required fields in French', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord() as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt.language).toBe('fr');
        expect(receipt.direction).toBe('ltr');
        expect(receipt.title).toBe('Reçu de paiement');
        expect(receipt.schoolName).toBe('EduNest Kindergarten');
        expect(receipt.branchName).toBe('Main Branch');
        expect(receipt.receiptNumber).toBe('MAI-2024-000001');
        expect(receipt.childName).toBe('Ahmed Benali');
        expect(receipt.amount).toBe('5000.00 DZD');
        expect(receipt.channel).toBe('Espèces');
        expect(receipt.channelRaw).toBe('cash');
        expect(receipt.valueDate).toBe('2024-09-15');
        expect(receipt.recordedBy).toBe('Fatima Zerhouni');
      });

      it('includes allocated periods ordered by period_start', async () => {
        // Provide allocations in reverse order to verify sorting
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          allocations: [
            {
              id: 'alloc-2',
              amount: new Prisma.Decimal('2500.00'),
              billingPeriod: {
                periodStart: new Date('2024-11-01'),
                periodEnd: new Date('2024-11-30'),
                isRegistrationPeriod: false,
              },
            },
            {
              id: 'alloc-1',
              amount: new Prisma.Decimal('2500.00'),
              billingPeriod: {
                periodStart: new Date('2024-09-01'),
                periodEnd: new Date('2024-09-30'),
                isRegistrationPeriod: false,
              },
            },
          ],
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt.allocations).toHaveLength(2);
        expect(receipt.allocations[0].periodLabel).toBe('09/2024');
        expect(receipt.allocations[0].amount).toBe('2500.00 DZD');
        expect(receipt.allocations[1].periodLabel).toBe('11/2024');
        expect(receipt.allocations[1].amount).toBe('2500.00 DZD');
      });

      it('labels registration period correctly in French', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          allocations: [
            {
              id: 'alloc-reg',
              amount: new Prisma.Decimal('1000.00'),
              billingPeriod: {
                periodStart: new Date('2024-09-01'),
                periodEnd: new Date('2024-09-01'),
                isRegistrationPeriod: true,
              },
            },
          ],
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt.allocations[0].periodLabel).toBe("Frais d'inscription");
      });

      it('formats multi-month period labels correctly', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          allocations: [
            {
              id: 'alloc-trim',
              amount: new Prisma.Decimal('7500.00'),
              billingPeriod: {
                periodStart: new Date('2024-09-01'),
                periodEnd: new Date('2024-11-30'),
                isRegistrationPeriod: false,
              },
            },
          ],
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt.allocations[0].periodLabel).toBe('09/2024 - 11/2024');
      });

      it('translates CCP channel correctly', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          channel: 'ccp',
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');
        expect(receipt.channel).toBe('CCP');
      });

      it('translates BaridiMob channel correctly', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          channel: 'baridimob',
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');
        expect(receipt.channel).toBe('BaridiMob');
      });
    });

    describe('Arabic (RTL) receipt', () => {
      it('produces a receipt with all required fields in Arabic', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord() as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'ar');

        expect(receipt.language).toBe('ar');
        expect(receipt.direction).toBe('rtl');
        expect(receipt.title).toBe('إيصال دفع');
        expect(receipt.schoolName).toBe('EduNest Kindergarten');
        expect(receipt.branchName).toBe('Main Branch');
        expect(receipt.receiptNumber).toBe('MAI-2024-000001');
        expect(receipt.childName).toBe('Ahmed Benali');
        expect(receipt.amount).toBe('5000.00 د.ج');
        expect(receipt.channel).toBe('نقدي');
        expect(receipt.valueDate).toBe('2024-09-15');
        expect(receipt.recordedBy).toBe('Fatima Zerhouni');
      });

      it('labels registration period correctly in Arabic', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          allocations: [
            {
              id: 'alloc-reg',
              amount: new Prisma.Decimal('1000.00'),
              billingPeriod: {
                periodStart: new Date('2024-09-01'),
                periodEnd: new Date('2024-09-01'),
                isRegistrationPeriod: true,
              },
            },
          ],
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'ar');

        expect(receipt.allocations[0].periodLabel).toBe('رسوم التسجيل');
      });

      it('translates channels correctly in Arabic', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({ channel: 'ccp' }) as any);
        const ccpReceipt = await receiptService.generateReceipt('payment-1', 'ar');
        expect(ccpReceipt.channel).toBe('حساب بريدي جاري');

        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({ channel: 'baridimob' }) as any);
        const baridReceipt = await receiptService.generateReceipt('payment-1', 'ar');
        expect(baridReceipt.channel).toBe('بريدي موب');
      });
    });

    describe('defaults to French when language not specified', () => {
      it('defaults to French', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord() as any);

        const receipt = await receiptService.generateReceipt('payment-1');

        expect(receipt.language).toBe('fr');
        expect(receipt.direction).toBe('ltr');
      });
    });

    describe('correction markers on corrected payment', () => {
      it('includes correction marker and correction lines when payment has corrections', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          corrections: [
            {
              receiptNumber: 'MAI-2024-000002',
              valueDate: new Date('2024-09-20'),
              totalAmount: new Prisma.Decimal('-1000.00'),
            },
            {
              receiptNumber: 'MAI-2024-000003',
              valueDate: new Date('2024-09-25'),
              totalAmount: new Prisma.Decimal('-500.00'),
            },
          ],
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt.isCorrepted).toBe(true);
        expect(receipt.correctionMarker).toBe('Corrigé');
        expect(receipt.corrections).toHaveLength(2);
        expect(receipt.corrections[0].receiptNumber).toBe('MAI-2024-000002');
        expect(receipt.corrections[0].valueDate).toBe('2024-09-20');
        expect(receipt.corrections[0].amount).toBe('-1000.00 DZD');
        expect(receipt.corrections[1].receiptNumber).toBe('MAI-2024-000003');
        expect(receipt.corrections[1].valueDate).toBe('2024-09-25');
        expect(receipt.corrections[1].amount).toBe('-500.00 DZD');
      });

      it('does not include correction marker when no corrections exist', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          corrections: [],
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt.isCorrepted).toBe(false);
        expect(receipt.correctionMarker).toBeNull();
        expect(receipt.corrections).toHaveLength(0);
      });
    });

    describe('correction receipt (is_correction = true)', () => {
      it('produces correction receipt with negative amount and correction reason', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          isCorrection: true,
          totalAmount: new Prisma.Decimal('-2000.00'),
          referenceNote: 'Parent requested partial refund',
          correctsPaymentId: 'original-payment-1',
          correctedPayment: { receiptNumber: 'MAI-2024-000001' },
          allocations: [
            {
              id: 'alloc-corr',
              amount: new Prisma.Decimal('-2000.00'),
              billingPeriod: {
                periodStart: new Date('2024-09-01'),
                periodEnd: new Date('2024-09-30'),
                isRegistrationPeriod: false,
              },
            },
          ],
        }) as any);

        const receipt = await receiptService.generateReceipt('correction-1', 'fr');

        expect(receipt.isCorrection).toBe(true);
        expect(receipt.title).toBe('Reçu de correction');
        expect(receipt.amount).toBe('-2000.00 DZD');
        expect(receipt.correctionReason).toBe('Parent requested partial refund');
        expect(receipt.correctsReceiptNumber).toBe('MAI-2024-000001');
      });

      it('produces correction receipt in Arabic', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          isCorrection: true,
          totalAmount: new Prisma.Decimal('-1500.00'),
          referenceNote: 'خطأ في المبلغ',
          correctsPaymentId: 'original-payment-1',
          correctedPayment: { receiptNumber: 'MAI-2024-000001' },
          allocations: [],
        }) as any);

        const receipt = await receiptService.generateReceipt('correction-1', 'ar');

        expect(receipt.isCorrection).toBe(true);
        expect(receipt.title).toBe('إيصال تصحيح');
        expect(receipt.amount).toBe('-1500.00 د.ج');
        expect(receipt.correctionReason).toBe('خطأ في المبلغ');
        expect(receipt.correctsReceiptNumber).toBe('MAI-2024-000001');
      });
    });

    describe('amount formatting', () => {
      it('formats amounts with exactly 2 decimal places', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          totalAmount: new Prisma.Decimal('100.10'),
          allocations: [
            {
              id: 'alloc-1',
              amount: new Prisma.Decimal('100.10'),
              billingPeriod: {
                periodStart: new Date('2024-09-01'),
                periodEnd: new Date('2024-09-30'),
                isRegistrationPeriod: false,
              },
            },
          ],
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt.amount).toBe('100.10 DZD');
        expect(receipt.allocations[0].amount).toBe('100.10 DZD');
      });

      it('formats whole amounts with .00', async () => {
        mockFindUnique.mockResolvedValue(buildMockPaymentRecord({
          totalAmount: new Prisma.Decimal('3000'),
          allocations: [],
        }) as any);

        const receipt = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt.amount).toBe('3000.00 DZD');
      });
    });

    describe('idempotency (Requirement 18.6)', () => {
      it('produces identical output for the same payment record', async () => {
        const mockRecord = buildMockPaymentRecord();
        mockFindUnique.mockResolvedValue(mockRecord as any);

        const receipt1 = await receiptService.generateReceipt('payment-1', 'fr');

        mockFindUnique.mockResolvedValue(mockRecord as any);

        const receipt2 = await receiptService.generateReceipt('payment-1', 'fr');

        expect(receipt1).toEqual(receipt2);
      });
    });
  });
});
