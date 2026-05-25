import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Send, Banknote, X } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { Button, StatusBadge } from '@/components/ui';
import { FormField } from '@/components/forms';
import { Input } from '@/components/ui';
import {
  useInvoice,
  useSendInvoice,
  useCancelInvoice,
  useRecordCashPayment,
  useCashPayments,
} from '@/hooks/useFinance';

function formatDZD(amount: number) {
  return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(amount);
}

const STATUS_VARIANT: Record<string, string> = {
  draft: 'draft', sent: 'sent', paid: 'paid', partial: 'late', overdue: 'absent', cancelled: 'cancelled',
};

export function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useInvoice(invoiceId!);
  const { data: cashPayments } = useCashPayments(invoiceId);
  const sendInvoice = useSendInvoice();
  const cancelInvoice = useCancelInvoice();
  const recordCash = useRecordCashPayment();

  const [cashAmount, setCashAmount] = React.useState('');
  const [cashNote, setCashNote] = React.useState('');
  const [cashError, setCashError] = React.useState<string | null>(null);
  const [cashSuccess, setCashSuccess] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  async function handleSend() {
    setActionError(null);
    try {
      await sendInvoice.mutateAsync(invoiceId!);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleCancel() {
    setActionError(null);
    try {
      await cancelInvoice.mutateAsync(invoiceId!);
      setConfirmCancel(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('common.error'));
      setConfirmCancel(false);
    }
  }

  async function handleRecordCash(e: React.FormEvent) {
    e.preventDefault();
    setCashError(null);
    setCashSuccess(false);
    if (!cashAmount || Number(cashAmount) <= 0) {
      setCashError(t('common.error'));
      return;
    }
    try {
      await recordCash.mutateAsync({
        invoiceId: invoiceId!,
        amount_received: Number(cashAmount),
        received_at: new Date().toISOString(),
        note: cashNote || undefined,
      });
      setCashAmount('');
      setCashNote('');
      setCashSuccess(true);
      setTimeout(() => setCashSuccess(false), 3000);
    } catch (err) {
      setCashError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-10 bg-hover rounded-md" /><div className="h-10 bg-hover rounded-md w-1/2" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/finance')}>
          <ArrowLeft className="w-4 h-4" />{t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('finance.invoices.notFound')}</p>
      </div>
    );
  }

  const canSend = invoice.status === 'draft';
  const canRecordCash = ['sent', 'partial', 'overdue'].includes(invoice.status);
  const canCancel = !['paid', 'cancelled'].includes(invoice.status);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/finance')}>
          <ArrowLeft className="w-4 h-4" />{t('common.back')}
        </Button>
        <div className="flex-1">
          <h1 className="text-page-title font-semibold text-text-heading">{invoice.child_name}</h1>
          <p className="text-body text-text-secondary">{invoice.parent_name} · {invoice.fee_structure_name}</p>
        </div>
        <StatusBadge variant={STATUS_VARIANT[invoice.status] as any}>
          {t(`finance.invoices.statuses.${invoice.status}`)}
        </StatusBadge>
      </div>

      {actionError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-body text-danger flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-danger hover:opacity-70 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Invoice details */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-subsection font-semibold text-text-heading">{t('finance.invoices.detail.info')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-body">
          <div><p className="text-caption text-text-secondary">{t('finance.invoices.columns.amount')}</p><p className="font-mono font-medium text-foreground">{formatDZD(invoice.amount)}</p></div>
          {invoice.discount_amount > 0 && <div><p className="text-caption text-text-secondary">{t('finance.invoices.detail.discount')}</p><p className="font-mono text-success">-{formatDZD(invoice.discount_amount)}</p></div>}
          <div><p className="text-caption text-text-secondary">{t('finance.invoices.detail.finalAmount')}</p><p className="font-mono font-medium text-foreground text-lg">{formatDZD(invoice.final_amount)}</p></div>
          {invoice.remaining_amount != null && <div><p className="text-caption text-text-secondary">{t('finance.invoices.detail.remaining')}</p><p className="font-mono font-medium text-warning">{formatDZD(invoice.remaining_amount)}</p></div>}
          <div><p className="text-caption text-text-secondary">{t('finance.invoices.columns.dueDate')}</p><p className="text-foreground" dir="ltr">{formatDate(invoice.due_date)}</p></div>
          {invoice.paid_at && <div><p className="text-caption text-text-secondary">{t('finance.invoices.detail.paidAt')}</p><p className="text-foreground" dir="ltr">{formatDate(invoice.paid_at)}</p></div>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
          {canSend && (
            <Button variant="primary" size="sm" onClick={handleSend} disabled={sendInvoice.isPending}>
              <Send className="w-4 h-4" />{sendInvoice.isPending ? t('common.loading') : t('finance.invoices.send')}
            </Button>
          )}
          {canCancel && !confirmCancel && (
            <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(true)} className="border-danger text-danger hover:bg-danger/10">
              <X className="w-4 h-4" />{t('finance.invoices.cancel')}
            </Button>
          )}
          {confirmCancel && (
            <div className="flex items-center gap-2">
              <span className="text-body text-danger">{t('finance.invoices.detail.confirmCancel')}</span>
              <Button variant="secondary" size="sm" onClick={handleCancel} disabled={cancelInvoice.isPending} className="border-danger text-danger hover:bg-danger/10">
                {cancelInvoice.isPending ? t('common.loading') : t('common.confirm')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>{t('common.cancel')}</Button>
            </div>
          )}
        </div>
      </div>

      {/* Record cash payment */}
      {canRecordCash && (
        <form onSubmit={handleRecordCash} className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-subsection font-semibold text-text-heading flex items-center gap-2">
            <Banknote className="w-5 h-5 text-success" />{t('finance.invoices.cashForm.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('finance.invoices.cashForm.amountReceived')} htmlFor="cash-amount" required>
              <Input id="cash-amount" name="cash-amount" type="number" min="0.01" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0.00" />
            </FormField>
            <FormField label={t('finance.invoices.cashForm.note')} htmlFor="cash-note">
              <Input id="cash-note" name="cash-note" value={cashNote} onChange={(e) => setCashNote(e.target.value)} placeholder={t('finance.invoices.cashForm.notePlaceholder')} />
            </FormField>
          </div>
          {cashError && <p className="text-body text-danger">{cashError}</p>}
          {cashSuccess && <p className="text-body text-success animate-fade-in">{t('common.saved')}</p>}
          <Button type="submit" disabled={recordCash.isPending}>
            {recordCash.isPending ? t('common.loading') : t('finance.invoices.cashForm.submit')}
          </Button>
        </form>
      )}

      {/* Payment history */}
      {(cashPayments ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <h2 className="text-subsection font-semibold text-text-heading">{t('finance.invoices.detail.paymentHistory')}</h2>
          <div className="space-y-2">
            {cashPayments!.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-subtle rounded-lg px-3 py-2">
                <div>
                  <span className="font-mono text-body font-medium text-foreground">{formatDZD(p.amount)}</span>
                  {p.note && <span className="text-caption text-text-secondary ms-2">{p.note}</span>}
                </div>
                <span className="text-caption text-text-secondary" dir="ltr">{formatDate(p.received_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
