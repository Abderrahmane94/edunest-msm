import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Mail, Printer, Send } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, ErrorAlert, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate } from '@/lib/formatters';
import { printDocument } from '@/lib/printDocument';
import { downloadReceiptPdf, receiptToPdfBase64 } from '@/lib/receiptPdf';
import { useEmailStatement, useStatement, type Statement, type StatementDocumentData, type StatementTotals } from '@/hooks/useStatement';

type Language = 'fr' | 'ar';

/** "12 500,00 DA": the same in both languages, so columns line up and digits stay Latin. */
function amount(value: string | number): string {
  return `${Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
}

function Totals({ totals, tr, strong }: { totals: StatementTotals; tr: (key: string) => string; strong?: boolean }) {
  const rows: [string, string, string?][] = [
    [tr('billed'), amount(totals.billed)],
    [tr('paid'), amount(totals.paid)],
    [tr('outstanding'), amount(totals.outstanding), 'font-bold text-[15px]'],
  ];
  return (
    <dl className={cn('rounded-lg p-4 space-y-1.5', strong ? 'bg-[#eef0ff]' : 'bg-[#f9fafb]')}>
      {Number(totals.discount) > 0 && (
        <div className="flex justify-between gap-4 text-[13px] text-[#4f46e5]">
          <dt>{tr('discounts')}</dt>
          <dd><bdi dir="ltr">− {amount(totals.discount)}</bdi></dd>
        </div>
      )}
      {rows.map(([label, value, extra]) => (
        <div key={label} className={cn('flex justify-between gap-4 text-[13px]', extra)}>
          <dt>{label}</dt>
          <dd><bdi dir="ltr">{value}</bdi></dd>
        </div>
      ))}
      {Number(totals.late) > 0 && (
        <div className="flex justify-between gap-4 text-[13px] text-[#b42318]">
          <dt>{tr('late')}</dt>
          <dd><bdi dir="ltr">{amount(totals.late)}</bdi></dd>
        </div>
      )}
    </dl>
  );
}

function ChildStatement({ statement, tr, compact, several }: { statement: Statement; tr: (key: string, options?: Record<string, unknown>) => string; compact: boolean; several: boolean }) {
  const cell = compact ? 'px-2 py-1.5' : 'px-3 py-2';
  const th = cn(cell, 'text-start font-semibold');
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e5e7eb] pb-2">
        <h3 className="text-[16px] font-bold">{statement.child.firstName} {statement.child.lastName}</h3>
        {statement.child.classroom && <p className="text-[12px] text-[#6b7280]">{tr('classroom', { name: statement.child.classroom })}</p>}
      </div>

      {statement.lines.length === 0 ? (
        <p className="text-[13px] text-[#6b7280]">{tr('nothingBilled')}</p>
      ) : (
        <>
          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280] mb-1.5">{tr('billedTitle')}</h4>
            <table className="w-full border-collapse text-[12px] border border-[#e5e7eb]">
              <thead>
                <tr className="bg-[#f9fafb]">
                  <th className={th}>{tr('fee')}</th>
                  <th className={th}>{tr('period')}</th>
                  {!compact && <th className={cn(th, 'text-end')}>{tr('amountDue')}</th>}
                  {!compact && <th className={cn(th, 'text-end')}>{tr('paidColumn')}</th>}
                  <th className={cn(th, 'text-end')}>{tr('left')}</th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((l) => (
                  <tr key={l.id} className="border-t border-[#e5e7eb] align-top">
                    <td className={cell}>
                      {l.feeName ?? (l.isRegistration ? tr('registrationFee') : tr('tuition'))}
                      {Number(l.discount) > 0 && <span className="block text-[11px] text-[#4f46e5]">{tr('discountOf')} <bdi dir="ltr">{amount(l.discount)}</bdi></span>}
                    </td>
                    <td className={cell}>
                      <bdi dir="ltr">{formatDate(l.periodStart)}{l.periodEnd !== l.periodStart && ` → ${formatDate(l.periodEnd)}`}</bdi>
                      {compact && <span className="block text-[11px] text-[#6b7280]">{tr('amountDue')} <bdi dir="ltr">{amount(l.amountDue)}</bdi></span>}
                    </td>
                    {!compact && <td className={cn(cell, 'text-end')}><bdi dir="ltr">{amount(l.amountDue)}</bdi></td>}
                    {!compact && <td className={cn(cell, 'text-end')}><bdi dir="ltr">{amount(l.paid)}</bdi></td>}
                    <td className={cn(cell, 'text-end font-semibold', l.isLate && 'text-[#b42318]')}>
                      {Number(l.outstanding) === 0 ? <span className="font-normal text-[#067647]">{tr('settled')}</span> : <bdi dir="ltr">{amount(l.outstanding)}</bdi>}
                      {l.isLate && <span className="block text-[11px] font-normal">{tr('lateSince', { date: formatDate(l.dueDate) })}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280] mb-1.5">{tr('paymentsTitle')}</h4>
            {statement.payments.length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">{tr('noPayment')}</p>
            ) : (
              <table className="w-full border-collapse text-[12px] border border-[#e5e7eb]">
                <thead>
                  <tr className="bg-[#f9fafb]">
                    <th className={th}>{tr('date')}</th>
                    <th className={th}>{tr('receipt')}</th>
                    {!compact && <th className={th}>{tr('channel')}</th>}
                    <th className={cn(th, 'text-end')}>{tr('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.payments.map((p) => (
                    <tr key={p.id} className="border-t border-[#e5e7eb] align-top">
                      <td className={cell}><bdi dir="ltr">{formatDate(p.valueDate)}</bdi></td>
                      <td className={cell}>
                        <bdi dir="ltr" className="font-mono">{p.receiptNumber}</bdi>
                        {p.isCorrection && <span className="block text-[11px] text-[#b42318]">{tr('correction')}</span>}
                        {compact && <span className="block text-[11px] text-[#6b7280]">{tr(`channels.${p.channel}`)}</span>}
                      </td>
                      {!compact && <td className={cell}>{tr(`channels.${p.channel}`)}</td>}
                      <td className={cn(cell, 'text-end')}><bdi dir="ltr">{amount(p.amount)}</bdi></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {several && <Totals totals={statement.totals} tr={tr} />}
        </>
      )}
    </section>
  );
}

/**
 * A statement of account laid out as a document: the same markup is the
 * preview, the printed page and the PDF. Fixed colours and sizes so it comes
 * out the same on paper; `compact` is the on-screen layout of narrow screens.
 */
export function StatementDocument({ data, language, compact = false }: { data: StatementDocumentData; language: Language; compact?: boolean }) {
  const { t } = useTranslation();
  const tr = (key: string, options?: Record<string, unknown>) => t(`statement.doc.${key}`, { lng: language, ...options });
  const several = data.statements.length > 1;
  return (
    <article dir={language === 'ar' ? 'rtl' : 'ltr'} className="receipt-document bg-white text-[#111827] rounded-lg border border-border shadow-sm overflow-hidden">
      <div className="h-1.5 bg-primary" />
      <div className={compact ? 'p-4 space-y-4' : 'p-8 space-y-6'}>
        <header className={cn('border-b border-[#e5e7eb] pb-5', compact ? 'flex flex-col gap-3' : 'flex items-start justify-between gap-6')}>
          <div className="min-w-0">
            <p className="text-[18px] font-bold leading-snug">{data.school.name}</p>
            <p className="text-[12px] text-[#6b7280] mt-0.5">{data.school.address}{data.school.wilaya && ` · ${data.school.wilaya}`}</p>
            <p className="text-[12px] text-[#6b7280]"><bdi dir="ltr">{data.school.contactPhone}</bdi> · <bdi dir="ltr">{data.school.contactEmail}</bdi></p>
          </div>
          <div className={compact ? 'text-start' : 'text-end shrink-0'}>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-primary">{tr('title')}</p>
            <p className="text-[18px] font-bold mt-0.5">{tr('year', { name: data.year.name })}</p>
            <p className="text-[12px] text-[#6b7280]">{tr('issuedOn')} <bdi dir="ltr">{formatDate(data.generatedOn)}</bdi></p>
          </div>
        </header>

        {data.parents.length > 0 && (
          <div className="text-[13px]">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280] mb-1">{tr('family')}</p>
            {data.parents.map((p) => (
              <p key={p.email}>
                {p.firstName} {p.lastName}
                {p.phone && <> · <bdi dir="ltr">{p.phone}</bdi></>}
              </p>
            ))}
          </div>
        )}

        {data.statements.map((s) => <ChildStatement key={s.child.id} statement={s} tr={tr} compact={compact} several={several} />)}

        <div>
          {several && <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280] mb-1.5">{tr('familyTotal')}</p>}
          <Totals totals={data.totals} tr={tr} strong />
        </div>

        <p className="text-[11px] text-[#6b7280] border-t border-[#e5e7eb] pt-3">{tr('footer')}</p>
      </div>
    </article>
  );
}

function fileName(data: StatementDocumentData, language: Language): string {
  const names = data.statements.map((s) => `${s.child.firstName} ${s.child.lastName}`).join(', ');
  return `${language === 'ar' ? 'كشف الحساب' : 'Relevé de compte'} ${data.year.name} - ${names}`.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
}

/**
 * A child's statement of account: read it, print it, save it as a PDF, send
 * it. `scope="parent"`: it goes to the parent's own address only.
 */
export function StatementDialog({ childId, yearId, scope = 'office', open, onOpenChange }: { childId: string | null; yearId?: string; scope?: 'office' | 'parent'; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language.startsWith('ar') ? 'ar' : 'fr';
  const [family, setFamily] = React.useState(false);
  const { data, isLoading, isError, error } = useStatement(open ? childId : null, { yearId, family });
  const send = useEmailStatement();

  const contentRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const [compact, setCompact] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [emailTo, setEmailTo] = React.useState('');
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'pdf' | 'email' | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  React.useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 560));
    observer.observe(node);
    return () => observer.disconnect();
  }, [data]);

  // Start fresh each time it opens on a child.
  React.useEffect(() => {
    setFamily(false);
    setEmailOpen(false);
    setSentTo(null);
    setFailure(null);
    send.reset();
  }, [open, childId]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstParent = data?.parents[0]?.email ?? '';
  React.useEffect(() => {
    setEmailTo(firstParent);
  }, [firstParent]);

  async function handleDownload() {
    if (!data || !contentRef.current) return;
    setBusy('pdf');
    setFailure(null);
    try {
      await downloadReceiptPdf(contentRef.current, fileName(data, language));
    } catch {
      setFailure(t('statement.pdfFailed'));
    } finally {
      setBusy(null);
    }
  }

  function handlePrint() {
    if (!data || !contentRef.current) return;
    printDocument(contentRef.current, { fileName: fileName(data, language), language, direction: language === 'ar' ? 'rtl' : 'ltr' });
  }

  async function handleSend() {
    if (!data || !childId || !contentRef.current) return;
    setBusy('email');
    setFailure(null);
    setSentTo(null);
    try {
      const pdfBase64 = await receiptToPdfBase64(contentRef.current).catch(() => null);
      if (!pdfBase64) {
        setFailure(t('statement.pdfFailed'));
        return;
      }
      const address = await send.mutateAsync({
        childId,
        to: scope === 'office' ? emailTo.trim() : undefined,
        language,
        family,
        academicYearId: yearId,
        pdfBase64,
        pdfFileName: fileName(data, language),
      });
      setSentTo(address);
    } catch (err) {
      setFailure(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>{t('statement.title')}</DialogTitle>
          <DialogDescription>{t('statement.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {data?.hasSiblings && (
            <label className="flex items-center gap-2 text-body text-foreground me-auto cursor-pointer">
              <input id="st-family" type="checkbox" className="w-4 h-4 accent-[var(--color-primary)]" checked={family} onChange={(e) => setFamily(e.target.checked)} />
              {t('statement.family')}
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2 ms-auto">
            <Button variant={emailOpen ? 'primary' : 'secondary'} size="sm" onClick={() => setEmailOpen((v) => !v)} disabled={!data} aria-expanded={emailOpen}>
              <Mail className="w-4 h-4" />
              {t('statement.sendEmail')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handlePrint} disabled={!data}>
              <Printer className="w-4 h-4" />
              {t('statement.print')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void handleDownload()} disabled={!data || busy !== null}>
              <Download className="w-4 h-4" />
              {busy === 'pdf' ? t('common.loading') : t('statement.downloadPdf')}
            </Button>
          </div>
        </div>

        {emailOpen && data && (
          <div className="rounded-lg border border-border bg-subtle p-3 space-y-2 mb-4">
            {scope === 'office' ? (
              <Input type="email" label={t('statement.emailTo')} value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="parent@example.dz" helperText={firstParent ? undefined : t('statement.emailNoParent')} />
            ) : (
              <p className="text-caption text-text-secondary">{t('statement.emailToYou')}</p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {sentTo && <p className="text-caption text-success me-auto" role="status">{t('statement.emailSent', { email: sentTo })}</p>}
              <Button size="sm" onClick={() => void handleSend()} disabled={busy !== null || (scope === 'office' && !emailTo.trim())}>
                <Send className="w-4 h-4" />
                {busy === 'email' ? t('common.loading') : t('statement.emailSend')}
              </Button>
            </div>
          </div>
        )}

        <ErrorAlert message={failure} />

        {isLoading && (
          <div className="py-12 animate-pulse space-y-3">
            <div className="h-8 bg-hover rounded-md w-48 mx-auto" />
            <div className="h-4 bg-hover rounded-md w-full" />
            <div className="h-4 bg-hover rounded-md w-3/4" />
          </div>
        )}
        {isError && !isLoading && <ErrorAlert message={errorMessage(error, t)} />}

        {data && !isLoading && (
          <>
            <div ref={previewRef} className="rounded-lg bg-subtle p-2 sm:p-3">
              <StatementDocument data={data} language={language} compact={compact} />
            </div>
            {/* What gets printed and attached: always the full layout. Never displayed. */}
            <div className="hidden" aria-hidden="true">
              <div ref={contentRef}>
                <StatementDocument data={data} language={language} />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
