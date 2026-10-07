import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Download, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@/components/ui';
import { formatDate, formatDateTime, formatDZD } from '@/lib/formatters';
import { printDocument } from '@/lib/printDocument';
import { downloadReceiptPdf } from '@/lib/receiptPdf';
import { useSchool } from '@/hooks/useSchool';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import { provisionalRef, type OfflinePaymentPayload } from '@/hooks/useOfflinePayments';

/**
 * The receipt handed over for a payment recorded offline. It carries a
 * provisional reference (PROV-…) and says so: the numbered receipt is
 * issued once the payment reaches the server. Works without a connection
 * (printing, and PDF once its libraries were loaded online).
 */
export function ProvisionalReceiptDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: OfflinePaymentPayload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [pdfFailed, setPdfFailed] = React.useState(false);
  const language = i18n.language === 'ar' ? 'ar' : 'fr';
  const direction = language === 'ar' ? 'rtl' : 'ltr';

  React.useEffect(() => setPdfFailed(false), [open]);

  if (!payment) return null;
  const ref = provisionalRef(payment);
  const fileName = `${t('payments.offline.receipt.fileName')} ${ref} - ${payment.childName}`.replace(/[\\/:*?"<>|]/g, '-');

  async function handleDownload() {
    if (!contentRef.current) return;
    setDownloading(true);
    setPdfFailed(false);
    try {
      await downloadReceiptPdf(contentRef.current, fileName);
    } catch {
      // The PDF libraries weren't loaded before going offline: printing still works.
      setPdfFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t('payments.offline.receipt.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
          {pdfFailed && (
            <p className="text-caption text-danger me-auto" role="alert">
              {t('payments.offline.receipt.pdfUnavailable')}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => contentRef.current && printDocument(contentRef.current, { fileName, language, direction })}
          >
            <Printer className="w-4 h-4" />
            {t('payments.receipt.print')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleDownload()} disabled={downloading}>
            <Download className="w-4 h-4" />
            {downloading ? t('common.loading') : t('payments.receipt.downloadPdf')}
          </Button>
        </div>

        <div className="rounded-lg bg-subtle p-2 sm:p-3">
          <div ref={contentRef}>
            <ProvisionalReceiptDocument payment={payment} reference={ref} direction={direction} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProvisionalReceiptDocument({
  payment,
  reference,
  direction,
}: {
  payment: OfflinePaymentPayload;
  reference: string;
  direction: 'rtl' | 'ltr';
}) {
  const { t, i18n } = useTranslation();
  const { data: school } = useSchool();
  const { branchName } = useDefaultBranch();
  const schoolName = school?.name ?? '';
  const money = (amount: number) => formatDZD(amount, i18n.language);

  return (
    <article dir={direction} className="receipt-document bg-white text-[#111827] rounded-lg border border-border shadow-sm overflow-hidden">
      <div className="h-1.5 bg-warning" />
      <div className="p-5 sm:p-8 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="min-w-0">
            <p className="text-[18px] font-bold leading-snug">{schoolName}</p>
            {branchName && branchName !== schoolName && (
              <p className="text-caption text-text-secondary mt-0.5">{branchName}</p>
            )}
          </div>
          <div className="text-end">
            <p className="text-caption font-semibold uppercase tracking-wide text-warning">
              {t('payments.offline.receipt.heading')}
            </p>
            <p className="text-[18px] font-bold font-mono mt-0.5">
              <bdi dir="ltr">{reference}</bdi>
            </p>
            <p className="text-caption text-text-secondary">
              <bdi dir="ltr">{formatDate(payment.valueDate)}</bdi>
            </p>
          </div>
        </header>

        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-caption">{t('payments.offline.receipt.notice')}</p>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 rounded-lg bg-subtle p-4">
          <Field label={t('payments.recording.fields.child')} value={payment.childName} strong />
          <Field label={t('payments.recording.fields.valueDate')} value={<bdi dir="ltr">{formatDate(payment.valueDate)}</bdi>} />
          <Field label={t('payments.recording.fields.channel')} value={t(`payments.recording.channels.${payment.channel}`)} />
          <Field label={t('payments.offline.receipt.recordedBy')} value={payment.recordedByName} />
          {payment.referenceNote && (
            <Field label={t('payments.recording.fields.referenceNote')} value={payment.referenceNote} />
          )}
        </section>

        {payment.allocations.length > 0 ? (
          <table className="w-full border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-subtle">
                <th className="px-4 py-2 text-start text-caption font-semibold text-text-secondary">
                  {t('payments.offline.receipt.echeance')}
                </th>
                <th className="px-4 py-2 text-end text-caption font-semibold text-text-secondary">
                  {t('payments.offline.receipt.amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((a) => (
                <tr key={a.billingPeriodId} className="border-t border-border">
                  <td className="px-4 py-2.5 text-body">{a.label}</td>
                  <td className="px-4 py-2.5 text-body text-end tabular-nums whitespace-nowrap">
                    <bdi dir="ltr">{money(a.amount)}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-caption text-text-secondary">{t('payments.offline.receipt.toAllocate')}</p>
        )}

        <section className="flex justify-end">
          <div className="rounded-lg border-2 border-warning px-6 py-3 text-end">
            <p className="text-caption text-text-secondary">{t('payments.offline.receipt.paidAmount')}</p>
            <p className="text-[22px] font-bold tabular-nums">
              <bdi dir="ltr">{money(payment.totalAmount)}</bdi>
            </p>
          </div>
        </section>

        <footer className="flex flex-wrap items-end justify-between gap-6 border-t border-border pt-5">
          <p className="text-caption text-text-secondary">
            {t('payments.offline.receipt.recordedAt')}{' '}
            <bdi dir="ltr">{formatDateTime(payment.recordedAt)}</bdi>
          </p>
          <div className="text-center">
            <div className="w-48 h-14 border-b border-dashed border-text-disabled" />
            <p className="text-caption text-text-secondary mt-1">{t('payments.receipt.doc.signature')}</p>
          </div>
        </footer>
      </div>
    </article>
  );
}

function Field({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className={`text-body ${strong ? 'font-semibold' : 'font-medium'} break-words`}>{value}</p>
    </div>
  );
}
