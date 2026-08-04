import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { PaymentServiceError } from './payments.service';

/**
 * Supported languages for receipt generation.
 * Arabic uses RTL layout; French uses LTR layout.
 */
export type ReceiptLanguage = 'ar' | 'fr';

/**
 * Labels for receipt fields in Arabic and French.
 */
const LABELS: Record<ReceiptLanguage, {
  receiptTitle: string;
  correctionReceiptTitle: string;
  schoolName: string;
  branchName: string;
  receiptNumber: string;
  childName: string;
  amount: string;
  channel: string;
  valueDate: string;
  recordedBy: string;
  allocatedPeriods: string;
  periodLabel: string;
  periodAmount: string;
  correctionMarker: string;
  correctionReason: string;
  correctsReceipt: string;
  correctionRecord: string;
  currency: string;
  channelCash: string;
  channelCcp: string;
  channelBaridimob: string;
  direction: 'rtl' | 'ltr';
}> = {
  ar: {
    receiptTitle: 'إيصال دفع',
    correctionReceiptTitle: 'إيصال تصحيح',
    schoolName: 'اسم المدرسة',
    branchName: 'اسم الفرع',
    receiptNumber: 'رقم الإيصال',
    childName: 'اسم الطفل',
    amount: 'المبلغ',
    channel: 'قناة الدفع',
    valueDate: 'تاريخ القيمة',
    recordedBy: 'سُجل بواسطة',
    allocatedPeriods: 'الفترات المخصصة',
    periodLabel: 'الفترة',
    periodAmount: 'المبلغ',
    correctionMarker: 'تم التصحيح',
    correctionReason: 'سبب التصحيح',
    correctsReceipt: 'يصحح الإيصال',
    correctionRecord: 'سجل التصحيح',
    currency: 'د.ج',
    channelCash: 'نقدي',
    channelCcp: 'حساب بريدي جاري',
    channelBaridimob: 'بريدي موب',
    direction: 'rtl',
  },
  fr: {
    receiptTitle: 'Reçu de paiement',
    correctionReceiptTitle: 'Reçu de correction',
    schoolName: 'Nom de l\'école',
    branchName: 'Nom de la branche',
    receiptNumber: 'Numéro de reçu',
    childName: 'Nom de l\'enfant',
    amount: 'Montant',
    channel: 'Canal de paiement',
    valueDate: 'Date de valeur',
    recordedBy: 'Enregistré par',
    allocatedPeriods: 'Périodes allouées',
    periodLabel: 'Période',
    periodAmount: 'Montant',
    correctionMarker: 'Corrigé',
    correctionReason: 'Motif de correction',
    correctsReceipt: 'Corrige le reçu',
    correctionRecord: 'Enregistrement de correction',
    currency: 'DZD',
    channelCash: 'Espèces',
    channelCcp: 'CCP',
    channelBaridimob: 'BaridiMob',
    direction: 'ltr',
  },
};

/**
 * Represents one allocated billing period line on a receipt.
 */
export interface ReceiptAllocationLine {
  periodLabel: string;
  amount: string;
  periodStart: Date;
}

/**
 * Represents a correction record linked to a payment.
 */
export interface ReceiptCorrectionLine {
  receiptNumber: string;
  valueDate: string;
  amount: string;
}

/**
 * The full receipt data structure returned by the receipt service.
 * The frontend renders this into a printable document.
 */
export interface ReceiptData {
  language: ReceiptLanguage;
  direction: 'rtl' | 'ltr';
  labels: typeof LABELS['fr'];
  title: string;
  schoolName: string;
  branchName: string;
  receiptNumber: string;
  childName: string;
  amount: string;
  channel: string;
  channelRaw: 'cash' | 'ccp' | 'baridimob';
  valueDate: string;
  recordedBy: string;
  allocations: ReceiptAllocationLine[];
  /** Present when this payment has been corrected by other records */
  isCorrepted: boolean;
  correctionMarker: string | null;
  corrections: ReceiptCorrectionLine[];
  /** Present when this record IS a correction */
  isCorrection: boolean;
  correctionReason: string | null;
  correctsReceiptNumber: string | null;
}

class ReceiptService {
  /**
   * Generate a receipt data structure for a given payment record.
   *
   * Queries the database to assemble all receipt data from a PaymentRecord ID.
   * Includes school, branch, child, recorder names, allocated periods (ordered by period_start),
   * and correction information when applicable.
   *
   * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9
   */
  async generateReceipt(
    paymentRecordId: string,
    language: ReceiptLanguage = 'fr',
  ): Promise<ReceiptData> {
    // Fetch the payment record with all related data
    const paymentRecord = await prisma.paymentRecord.findUnique({
      where: { id: paymentRecordId },
      include: {
        branch: {
          include: {
            school: {
              select: { name: true },
            },
          },
        },
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        recorder: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        allocations: {
          include: {
            billingPeriod: {
              select: {
                periodStart: true,
                periodEnd: true,
                isRegistrationPeriod: true,
              },
            },
          },
        },
        // Corrections that reference this payment
        corrections: {
          select: {
            receiptNumber: true,
            valueDate: true,
            totalAmount: true,
          },
          orderBy: {
            valueDate: 'asc',
          },
        },
        // If this is a correction, get the original payment's receipt number
        correctedPayment: {
          select: {
            receiptNumber: true,
          },
        },
      },
    });

    if (!paymentRecord) {
      throw new PaymentServiceError(
        'No receipt exists for the requested identifier',
        404,
        'NOT_FOUND',
      );
    }

    const labels = LABELS[language];

    // Format amount with 2 decimal places and currency label
    const formatAmount = (amount: Prisma.Decimal): string => {
      return `${amount.toFixed(2)} ${labels.currency}`;
    };

    // Format date as calendar date (YYYY-MM-DD)
    const formatDate = (date: Date): string => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Translate payment channel
    const translateChannel = (channel: 'cash' | 'ccp' | 'baridimob'): string => {
      switch (channel) {
        case 'cash':
          return labels.channelCash;
        case 'ccp':
          return labels.channelCcp;
        case 'baridimob':
          return labels.channelBaridimob;
      }
    };

    // Build period label from period dates
    const buildPeriodLabel = (
      periodStart: Date,
      periodEnd: Date,
      isRegistrationPeriod: boolean,
    ): string => {
      if (isRegistrationPeriod) {
        return language === 'ar' ? 'رسوم التسجيل' : 'Frais d\'inscription';
      }
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      const startMonth = start.getMonth() + 1;
      const startYear = start.getFullYear();
      const endMonth = end.getMonth() + 1;
      const endYear = end.getFullYear();

      if (startMonth === endMonth && startYear === endYear) {
        return `${String(startMonth).padStart(2, '0')}/${startYear}`;
      }
      return `${String(startMonth).padStart(2, '0')}/${startYear} - ${String(endMonth).padStart(2, '0')}/${endYear}`;
    };

    // Build allocations sorted by period_start
    const allocations: ReceiptAllocationLine[] = paymentRecord.allocations
      .sort((a, b) => {
        const aStart = new Date(a.billingPeriod.periodStart).getTime();
        const bStart = new Date(b.billingPeriod.periodStart).getTime();
        return aStart - bStart;
      })
      .map((alloc) => ({
        periodLabel: buildPeriodLabel(
          alloc.billingPeriod.periodStart,
          alloc.billingPeriod.periodEnd,
          alloc.billingPeriod.isRegistrationPeriod,
        ),
        amount: formatAmount(alloc.amount),
        periodStart: alloc.billingPeriod.periodStart,
      }));

    // Build correction lines (other records that correct this one)
    const hasCorrections = paymentRecord.corrections.length > 0;
    const correctionLines: ReceiptCorrectionLine[] = paymentRecord.corrections.map((c) => ({
      receiptNumber: c.receiptNumber,
      valueDate: formatDate(c.valueDate),
      amount: formatAmount(c.totalAmount),
    }));

    // Determine title and correction-specific fields
    const isCorrection = paymentRecord.isCorrection;
    const title = isCorrection ? labels.correctionReceiptTitle : labels.receiptTitle;

    return {
      language,
      direction: labels.direction,
      labels,
      title,
      schoolName: paymentRecord.branch.school.name,
      branchName: paymentRecord.branch.name,
      receiptNumber: paymentRecord.receiptNumber,
      childName: `${paymentRecord.child.firstName} ${paymentRecord.child.lastName}`,
      amount: formatAmount(paymentRecord.totalAmount),
      channel: translateChannel(paymentRecord.channel),
      channelRaw: paymentRecord.channel,
      valueDate: formatDate(paymentRecord.valueDate),
      recordedBy: `${paymentRecord.recorder.firstName} ${paymentRecord.recorder.lastName}`,
      allocations,
      // Correction markers for when THIS record has been corrected
      isCorrepted: hasCorrections,
      correctionMarker: hasCorrections ? labels.correctionMarker : null,
      corrections: correctionLines,
      // Fields for when THIS record IS a correction
      isCorrection,
      correctionReason: isCorrection ? paymentRecord.referenceNote : null,
      correctsReceiptNumber: paymentRecord.correctedPayment?.receiptNumber ?? null,
    };
  }
}

export const receiptService = new ReceiptService();
