import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ReceiptData } from '@/hooks/usePayments';

/**
 * A payment receipt laid out as a document. The same markup is the on-screen
 * preview, the printed page and the PDF (attached to emails), so what you see
 * is what gets printed or sent. Layout is fixed (no responsive breakpoints) so
 * it renders identically at A4 width. Numbers, dates and receipt numbers sit
 * in <bdi dir="ltr"> so they read correctly yet follow the page alignment in
 * Arabic.
 *
 * `compact` is the on-screen layout for narrow screens (phones): sections
 * stack and the fee table has two columns. Print and PDF always use the full
 * layout.
 */
export function ReceiptDocument({ receipt, compact = false }: { receipt: ReceiptData; compact?: boolean }) {
  const { t } = useTranslation();
  const { labels, direction } = receipt;
  // Texts outside the server's labels follow the receipt's own language.
  const tr = (key: string, options?: Record<string, unknown>) =>
    t(`payments.receipt.doc.${key}`, { lng: receipt.language, ...options });
  const issuedOn = formatDate(new Date().toISOString());
  // Table cell padding and the label cells' span in the totals rows.
  const pad = compact ? 'px-3' : 'px-4';
  const labelSpan = compact ? 1 : 2;

  return (
    <article
      dir={direction}
      className="receipt-document bg-white text-[#111827] rounded-lg border border-border shadow-sm overflow-hidden"
    >
      {/* Accent band */}
      <div className="h-1.5 bg-primary" />

      <div className={compact ? 'p-4 space-y-4' : 'p-8 space-y-6'}>
        {/* Header: school on one side, receipt identity on the other */}
        <header
          className={cn(
            'border-b border-border pb-5',
            compact ? 'flex flex-col gap-3' : 'flex items-start justify-between gap-6',
          )}
        >
          <div className="min-w-0">
            <p className="text-[18px] font-bold leading-snug">{receipt.schoolName}</p>
            {receipt.branchName && receipt.branchName !== receipt.schoolName && (
              <p className="text-caption text-text-secondary mt-0.5">{receipt.branchName}</p>
            )}
          </div>
          <div className={compact ? 'text-start' : 'text-end shrink-0'}>
            <p className="text-caption font-semibold uppercase tracking-wide text-primary">{receipt.title}</p>
            <p className="text-[18px] font-bold font-mono mt-0.5">
              <bdi dir="ltr">{receipt.receiptNumber}</bdi>
            </p>
            <p className="text-caption text-text-secondary">
              <bdi dir="ltr">{receipt.valueDate}</bdi>
            </p>
          </div>
        </header>

        {/* Correction receipt */}
        {receipt.isCorrection && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 space-y-1">
            <p className="flex items-center gap-1.5 text-body font-semibold text-danger">
              <AlertTriangle className="w-4 h-4" />
              {labels.correctionReceiptTitle}
            </p>
            {receipt.correctsReceiptNumber && (
              <p className="text-caption text-text-secondary">
                {labels.correctsReceipt} :{' '}
                <bdi dir="ltr" className="font-mono">
                  {receipt.correctsReceiptNumber}
                </bdi>
              </p>
            )}
            {receipt.correctionReason && (
              <p className="text-caption text-text-secondary">
                {labels.correctionReason} : {receipt.correctionReason}
              </p>
            )}
          </div>
        )}

        {/* Payment details */}
        <section className={cn('grid gap-x-8 gap-y-4 rounded-lg bg-subtle p-4', compact ? 'grid-cols-1' : 'grid-cols-2')}>
          <Field label={labels.childName} value={receipt.childName} strong />
          <Field label={labels.valueDate} value={<bdi dir="ltr">{receipt.valueDate}</bdi>} />
          <Field label={labels.channel} value={receipt.channel} />
          <Field label={labels.recordedBy} value={receipt.recordedBy} />
        </section>

        {/* Fees paid */}
        {receipt.allocations.length > 0 && (
          <section>
            <h3 className="text-label font-semibold mb-2">{labels.allocatedPeriods}</h3>
            <table className="w-full table-fixed border border-border rounded-lg overflow-hidden">
              {compact ? (
                <colgroup>
                  <col className="w-[62%]" />
                  <col className="w-[38%]" />
                </colgroup>
              ) : (
                <colgroup>
                  <col className="w-[50%]" />
                  <col className="w-[22%]" />
                  <col className="w-[28%]" />
                </colgroup>
              )}
              <thead>
                <tr className="bg-subtle">
                  <th className={cn('py-2 text-start text-caption font-semibold text-text-secondary', pad)}>
                    {labels.feeName}
                  </th>
                  {!compact && (
                    <th className={cn('py-2 text-start text-caption font-semibold text-text-secondary', pad)}>
                      {labels.periodLabel}
                    </th>
                  )}
                  <th className={cn('py-2 text-end text-caption font-semibold text-text-secondary', pad)}>
                    {labels.periodAmount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {receipt.allocations.map((alloc, idx) => (
                  <tr key={idx} className="border-t border-border align-top">
                    <td className={cn('py-2.5 text-body', pad)}>
                      <p className="font-medium">{alloc.feeName || '—'}</p>
                      {compact && (
                        <p className="text-caption text-text-secondary">
                          <bdi dir="ltr">{alloc.periodLabel}</bdi>
                        </p>
                      )}
                      {alloc.discountNote && (
                        <p className="text-caption text-primary mt-0.5">{alloc.discountNote}</p>
                      )}
                    </td>
                    {!compact && (
                      <td className={cn('py-2.5 text-body text-text-secondary', pad)}>
                        <bdi dir="ltr">{alloc.periodLabel}</bdi>
                      </td>
                    )}
                    <td className={cn('py-2.5 text-body text-end tabular-nums whitespace-nowrap', pad)}>
                      <bdi dir="ltr">{alloc.amount}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {receipt.totalDiscount && (
                  <tr className="border-t border-border text-primary">
                    <td colSpan={labelSpan} className={cn('py-2 text-body', pad)}>
                      {labels.discount}
                    </td>
                    <td className={cn('py-2 text-body text-end tabular-nums whitespace-nowrap', pad)}>
                      <bdi dir="ltr">−{receipt.totalDiscount}</bdi>
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-border bg-subtle">
                  <td colSpan={labelSpan} className={cn('py-2.5 text-body font-semibold', pad)}>
                    {labels.amount}
                  </td>
                  <td className={cn('py-2.5 text-body font-bold text-end tabular-nums whitespace-nowrap', pad)}>
                    <bdi dir="ltr">{receipt.amount}</bdi>
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {/* Amount paid, prominent */}
        <section className="flex justify-end">
          <div
            className={`rounded-lg border-2 px-6 py-3 text-end ${
              receipt.isCorrection ? 'border-danger text-danger' : 'border-primary'
            }`}
          >
            <p className="text-caption text-text-secondary">{tr('paidAmount')}</p>
            <p className="text-[22px] font-bold tabular-nums">
              <bdi dir="ltr">{receipt.amount}</bdi>
            </p>
          </div>
        </section>

        {/* This receipt was later corrected */}
        {receipt.isCorrepted && receipt.corrections.length > 0 && (
          <section className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <h3 className="text-label font-semibold text-warning mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {labels.correctionMarker}
            </h3>
            <ul className="space-y-1">
              {receipt.corrections.map((c, idx) => (
                <li key={idx} className="grid grid-cols-3 gap-4 text-caption text-text-secondary">
                  <bdi dir="ltr" className="font-mono">
                    {c.receiptNumber}
                  </bdi>
                  <bdi dir="ltr">{c.valueDate}</bdi>
                  <bdi dir="ltr" className="text-end text-danger font-medium">
                    {c.amount}
                  </bdi>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer: issue date + signature */}
        <footer
          className={cn(
            'border-t border-border pt-5',
            compact ? 'flex flex-col gap-4' : 'flex items-end justify-between gap-6',
          )}
        >
          <div className="text-caption text-text-secondary space-y-0.5">
            <p>{tr('thanks')}</p>
            <p>
              {tr('issuedOn')} <bdi dir="ltr">{issuedOn}</bdi> · EduNest
            </p>
          </div>
          <div className="text-center">
            <div className="w-48 h-14 border-b border-dashed border-text-disabled" />
            <p className="text-caption text-text-secondary mt-1">{tr('signature')}</p>
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
