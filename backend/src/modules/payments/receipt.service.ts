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
  feeName: string;
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
  /** "Remise" — discount mention on a line, and the total-discounts row. */
  discount: string;
  /** "original amount" */
  originalAmount: string;
  discountTypes: Record<'scholarship' | 'sibling' | 'staff' | 'custom', string>;
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
    allocatedPeriods: 'الرسوم المدفوعة',
    feeName: 'الرسم',
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
    discount: 'تخفيض',
    originalAmount: 'المبلغ الأصلي',
    discountTypes: { scholarship: 'منحة دراسية', sibling: 'إخوة', staff: 'طاقم العمل', custom: 'مخصص' },
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
    allocatedPeriods: 'Frais payés',
    feeName: 'Frais',
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
    discount: 'Remise',
    originalAmount: "montant d'origine",
    discountTypes: { scholarship: 'Bourse', sibling: 'Fratrie', staff: 'Personnel', custom: 'Personnalisé' },
    direction: 'ltr',
  },
};

/**
 * Represents one allocated billing period line on a receipt.
 */
export interface ReceiptAllocationLine {
  /** The fee this line pays (registration fee label for a registration period). */
  feeName: string;
  periodLabel: string;
  amount: string;
  periodStart: Date;
  /**
   * The discount that reduced this échéance, e.g. "Remise Fratrie −10 % :
   * −180.00 DZD (montant d'origine 1800.00 DZD)"; null when none.
   */
  discountNote: string | null;
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
  /** Sum of the discounts on the échéances this payment covers; null when none. */
  totalDiscount: string | null;
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
                id: true,
                periodStart: true,
                periodEnd: true,
                isRegistrationPeriod: true,
                amountDue: true,
                baseAmount: true,
                branchFeeId: true,
                branchFee: { select: { name: true } },
                enrollment: {
                  select: {
                    discounts: {
                      select: {
                        type: true,
                        percentage: true,
                        fixedAmount: true,
                        validFrom: true,
                        validTo: true,
                        branchFeeId: true,
                      },
                    },
                  },
                },
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

    const registrationLabel = language === 'ar' ? 'رسوم التسجيل' : 'Frais d\'inscription';

    // Build period label from period dates
    const buildPeriodLabel = (
      periodStart: Date,
      periodEnd: Date,
      isRegistrationPeriod: boolean,
    ): string => {
      if (isRegistrationPeriod) {
        return registrationLabel;
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
    type ReceiptPeriod = (typeof paymentRecord.allocations)[number]['billingPeriod'];

    /** What discounts took off a period (null when nothing). */
    const savedOn = (period: ReceiptPeriod): Prisma.Decimal | null => {
      if (period.baseAmount == null) return null;
      const saved = period.baseAmount.sub(period.amountDue);
      return saved.gt(0) ? saved : null;
    };

    /** "Remise Fratrie −10 % : −180.00 DZD (montant d'origine 1800.00 DZD)". */
    const discountNoteFor = (period: ReceiptPeriod): string | null => {
      const saved = savedOn(period);
      if (!saved || period.baseAmount == null) return null;
      const start = new Date(period.periodStart);
      const applied = period.enrollment.discounts.filter(
        (d) =>
          (!d.branchFeeId || d.branchFeeId === period.branchFeeId) &&
          new Date(d.validFrom) <= start &&
          (!d.validTo || new Date(d.validTo) >= start),
      );
      const names = applied
        .map(
          (d) =>
            `${labels.discountTypes[d.type]} ` +
            (d.fixedAmount !== null ? `−${formatAmount(d.fixedAmount)}` : `−${Number(d.percentage)} %`),
        )
        .join(' + ');
      return (
        `${labels.discount}${names ? ` ${names}` : ''} : −${formatAmount(saved)}` +
        ` (${labels.originalAmount} ${formatAmount(period.baseAmount)})`
      );
    };

    const allocations: ReceiptAllocationLine[] = paymentRecord.allocations
      .sort((a, b) => {
        const aStart = new Date(a.billingPeriod.periodStart).getTime();
        const bStart = new Date(b.billingPeriod.periodStart).getTime();
        return aStart - bStart;
      })
      .map((alloc) => ({
        feeName: alloc.billingPeriod.isRegistrationPeriod
          ? registrationLabel
          : (alloc.billingPeriod.branchFee?.name ?? ''),
        periodLabel: buildPeriodLabel(
          alloc.billingPeriod.periodStart,
          alloc.billingPeriod.periodEnd,
          alloc.billingPeriod.isRegistrationPeriod,
        ),
        amount: formatAmount(alloc.amount),
        periodStart: alloc.billingPeriod.periodStart,
        discountNote: discountNoteFor(alloc.billingPeriod),
      }));

    // Each discounted échéance counts once, even if split over several lines.
    const discountedPeriods = new Map<string, Prisma.Decimal>();
    for (const alloc of paymentRecord.allocations) {
      const saved = savedOn(alloc.billingPeriod);
      if (saved) discountedPeriods.set(alloc.billingPeriod.id, saved);
    }
    const totalDiscount = [...discountedPeriods.values()].reduce(
      (sum, v) => sum.add(v),
      new Prisma.Decimal(0),
    );

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
      totalDiscount: totalDiscount.gt(0) ? formatAmount(totalDiscount) : null,
      correctionReason: isCorrection ? paymentRecord.referenceNote : null,
      correctsReceiptNumber: paymentRecord.correctedPayment?.receiptNumber ?? null,
    };
  }
}

export const receiptService = new ReceiptService();
