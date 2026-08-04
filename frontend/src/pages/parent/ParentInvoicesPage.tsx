import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Receipt,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, StatusBadge } from '@/components/ui';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
type PaymentMethod = 'online' | 'cash';
type ConsentStatus = 'pending' | 'approved' | 'declined';

interface Invoice {
  id: string;
  child_name: string;
  fee_structure_name: string;
  amount: number;
  discount_amount: number;
  final_amount: number;
  remaining_amount: number | null;
  currency: string;
  due_date: string;
  status: InvoiceStatus;
  payment_method: PaymentMethod | null;
  chargily_payment_url: string | null;
  paid_at: string | null;
}

interface CashPayment {
  id: string;
  amount: number;
  received_at: string;
  note: string | null;
}

interface ConsentEvent {
  id: string;
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  location: string | null;
  consent_forms: ConsentForm[];
}

interface ConsentForm {
  id: string;
  child_name: string;
  status: ConsentStatus;
  responded_at: string | null;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useParentInvoices() {
  return useQuery({
    queryKey: ['parent-invoices'],
    queryFn: async () => {
      const res = await apiClient.get<{ invoices: Invoice[] }>(
        '/finance/invoices/my-children'
      );
      return res.data?.invoices ?? [];
    },
  });
}

function useCashPayments(invoiceId: string | null) {
  return useQuery({
    queryKey: ['cash-payments', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const res = await apiClient.get<{ cash_payments: CashPayment[] }>(
        `/finance/invoices/${invoiceId}/cash-payments`
      );
      return res.data?.cash_payments ?? [];
    },
    enabled: !!invoiceId,
  });
}

function useConsentEvents() {
  return useQuery({
    queryKey: ['parent-consent-events'],
    queryFn: async () => {
      const res = await apiClient.get<{ events: ConsentEvent[] }>(
        '/communication/events/my-children'
      );
      return res.data?.events ?? [];
    },
  });
}

function useRespondConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      consentFormId,
      status,
    }: {
      consentFormId: string;
      status: 'approved' | 'declined';
    }) => {
      const res = await apiClient.put(`/communication/consent/${consentFormId}`, { status });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to respond to consent form');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-consent-events'] });
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getReceiptDownloadUrl(cashPaymentId: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${baseUrl}/cash-payments/${cashPaymentId}/receipt`;
}

// ─── Tab Component ───────────────────────────────────────────────────────────

type TabId = 'invoices' | 'consent';

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const { t } = useTranslation();

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'invoices', label: t('parentInvoices.tabs.invoices', 'Invoices'), icon: FileText },
    { id: 'consent', label: t('parentInvoices.tabs.consent', 'Consent Forms'), icon: Calendar },
  ];

  return (
    <div className="flex border-b border-border" role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-body font-medium transition-colors duration-150 border-b-2 -mb-px',
              isActive
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'
            )}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Invoice List ────────────────────────────────────────────────────────────

function InvoiceList() {
  const { t, i18n } = useTranslation();
  const { data: invoices, isLoading, isError } = useParentInvoices();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-subtle" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-subtle rounded w-2/3" />
                <div className="h-3 bg-subtle rounded w-1/3" />
              </div>
              <div className="h-6 w-16 bg-subtle rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-16">
        <p className="text-body text-text-secondary">
          {t('parentInvoices.error', 'Unable to load invoices. Please try again.')}
        </p>
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center">
          <FileText className="w-8 h-8 text-text-secondary" />
        </div>
        <p className="text-body text-text-secondary">
          {t('parentInvoices.empty', 'No invoices yet.')}
        </p>
      </div>
    );
  }

  return (
    <ul role="list" className="space-y-3">
      {invoices.map((invoice) => (
        <InvoiceCard key={invoice.id} invoice={invoice} locale={i18n.language} />
      ))}
    </ul>
  );
}

function InvoiceCard({ invoice, locale }: { invoice: Invoice; locale: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);

  const isActionable = invoice.status === 'sent' || invoice.status === 'overdue';
  const showPaymentHistory =
    invoice.payment_method === 'cash' || invoice.status === 'partial' || invoice.status === 'paid';

  // Use amber styling for overdue/sent (not red) per design spec
  const cardBorderClass =
    invoice.status === 'overdue' || invoice.status === 'sent'
      ? 'border-[var(--color-warning-muted)]'
      : 'border-border';

  return (
    <li>
      <article
        className={cn(
          'bg-card border rounded-xl overflow-hidden transition-colors duration-150',
          cardBorderClass
        )}
      >
        {/* Amber accent strip for unpaid/overdue */}
        {(invoice.status === 'overdue' || invoice.status === 'sent') && (
          <div className="h-1 bg-[var(--color-warning)]" aria-hidden="true" />
        )}

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-body font-medium text-text-heading truncate">
                {invoice.child_name}
              </h3>
              <p className="text-caption text-text-secondary mt-0.5">
                {invoice.fee_structure_name}
              </p>
            </div>
            <StatusBadge variant={invoice.status}>
              {t(`parentInvoices.status.${invoice.status}`, invoice.status)}
            </StatusBadge>
          </div>

          {/* Amount and details */}
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-subsection font-semibold text-text-heading">
                {formatCurrency(invoice.final_amount, invoice.currency)}
              </p>
              {invoice.discount_amount > 0 && (
                <p className="text-micro text-text-secondary line-through mt-0.5">
                  <span className="font-mono">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </span>
                </p>
              )}
              {invoice.remaining_amount !== null && invoice.remaining_amount > 0 && (
                <p className="text-caption text-[var(--color-warning)] font-medium mt-1">
                  {t('parentInvoices.remaining', 'Remaining')}:{' '}
                  <span className="font-mono">
                    {formatCurrency(invoice.remaining_amount, invoice.currency)}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              {/* Payment method badge */}
              {invoice.payment_method && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-subtle text-micro font-medium text-text-secondary">
                  {invoice.payment_method === 'online' ? (
                    <CreditCard className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <Banknote className="w-3 h-3" aria-hidden="true" />
                  )}
                  {t(`parentInvoices.paymentMethod.${invoice.payment_method}`, invoice.payment_method)}
                </span>
              )}
              {/* Due date */}
              <p className="text-caption text-text-secondary">
                {t('parentInvoices.dueDate', 'Due')}: {formatDate(invoice.due_date, locale)}
              </p>
            </div>
          </div>

          {/* Actions row */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Pay Online button */}
            {isActionable && invoice.chargily_payment_url && (
              <a
                href={invoice.chargily_payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-label font-medium hover:bg-[var(--color-accent-hover)] transition-colors duration-150"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                {t('parentInvoices.payOnline', 'Pay Online')}
              </a>
            )}

            {/* Expand payment history */}
            {showPaymentHistory && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-label font-medium text-text-secondary hover:bg-subtle transition-colors duration-150"
                aria-expanded={expanded}
              >
                <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
                {t('parentInvoices.paymentHistory', 'Payment History')}
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Expandable payment history */}
        {expanded && showPaymentHistory && (
          <PaymentHistory invoiceId={invoice.id} locale={locale} />
        )}
      </article>
    </li>
  );
}

function PaymentHistory({ invoiceId, locale }: { invoiceId: string; locale: string }) {
  const { t } = useTranslation();
  const { data: payments, isLoading } = useCashPayments(invoiceId);

  if (isLoading) {
    return (
      <div className="border-t border-border px-4 py-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-subtle rounded w-1/2" />
          <div className="h-4 bg-subtle rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="border-t border-border px-4 py-3">
        <p className="text-caption text-text-secondary">
          {t('parentInvoices.noPayments', 'No payment records found.')}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="px-4 py-3 space-y-2">
        <h4 className="text-caption font-medium text-text-secondary uppercase tracking-wide">
          {t('parentInvoices.paymentHistoryTitle', 'Payments')}
        </h4>
        <ul role="list" className="space-y-2">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-3 p-2 rounded-lg bg-subtle"
            >
              <div className="flex-1 min-w-0">
                <p className="font-mono text-body font-medium text-text-heading">
                  {formatCurrency(payment.amount, 'DZD')}
                </p>
                <p className="text-micro text-text-secondary mt-0.5">
                  {formatDate(payment.received_at, locale)}
                  {payment.note && ` — ${payment.note}`}
                </p>
              </div>
              <a
                href={getReceiptDownloadUrl(payment.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-micro font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-colors duration-150"
                aria-label={t('parentInvoices.downloadReceipt', 'Download receipt')}
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {t('parentInvoices.receipt', 'Receipt')}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Consent Forms ───────────────────────────────────────────────────────────

function ConsentFormsList() {
  const { t, i18n } = useTranslation();
  const { data: events, isLoading, isError } = useConsentEvents();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-card border border-border rounded-xl p-4">
            <div className="space-y-2">
              <div className="h-5 bg-subtle rounded w-3/4" />
              <div className="h-3 bg-subtle rounded w-full" />
              <div className="h-3 bg-subtle rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-16">
        <p className="text-body text-text-secondary">
          {t('parentInvoices.consentError', 'Unable to load consent forms. Please try again.')}
        </p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center">
          <Calendar className="w-8 h-8 text-text-secondary" />
        </div>
        <p className="text-body text-text-secondary">
          {t('parentInvoices.noConsent', 'No events requiring consent.')}
        </p>
      </div>
    );
  }

  return (
    <ul role="list" className="space-y-4">
      {events.map((event) => (
        <EventConsentCard key={event.id} event={event} locale={i18n.language} />
      ))}
    </ul>
  );
}

function EventConsentCard({ event, locale }: { event: ConsentEvent; locale: string }) {
  return (
    <li>
      <article className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4">
          {/* Event header */}
          <h3 className="text-body font-medium text-text-heading">
            {event.title}
          </h3>
          {event.description && (
            <p className="text-caption text-text-secondary mt-1 line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Event meta */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className="inline-flex items-center gap-1 text-caption text-text-secondary">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              {formatDateTime(event.start_datetime, locale)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1 text-caption text-text-secondary">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                {event.location}
              </span>
            )}
          </div>

          {/* Consent forms per child */}
          {event.consent_forms.length > 0 && (
            <div className="mt-4 space-y-2">
              {event.consent_forms.map((form) => (
                <ConsentFormItem key={form.id} form={form} />
              ))}
            </div>
          )}
        </div>
      </article>
    </li>
  );
}

function ConsentFormItem({ form }: { form: ConsentForm }) {
  const { t } = useTranslation();
  const respondConsent = useRespondConsent();

  const isPending = form.status === 'pending';

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 p-3 rounded-lg border',
        isPending ? 'border-[var(--color-warning-muted)] bg-[var(--color-warning-muted)]/20' : 'border-border bg-subtle'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-body font-medium text-text-primary truncate">
          {form.child_name}
        </p>
        {!isPending && (
          <p className="text-micro text-text-secondary mt-0.5 flex items-center gap-1">
            {form.status === 'approved' ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" aria-hidden="true" />
                {t('parentInvoices.consentApproved', 'Approved')}
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-[var(--color-danger)]" aria-hidden="true" />
                {t('parentInvoices.consentDeclined', 'Declined')}
              </>
            )}
          </p>
        )}
      </div>

      {isPending && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => respondConsent.mutate({ consentFormId: form.id, status: 'approved' })}
            disabled={respondConsent.isPending}
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            {t('parentInvoices.approve', 'Approve')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => respondConsent.mutate({ consentFormId: form.id, status: 'declined' })}
            disabled={respondConsent.isPending}
          >
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
            {t('parentInvoices.decline', 'Decline')}
          </Button>
        </div>
      )}

      {!isPending && (
        <div className="shrink-0">
          {form.status === 'approved' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-success-muted text-[var(--color-success)] text-micro font-medium">
              {t('parentInvoices.consentApproved', 'Approved')}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-subtle text-text-secondary text-micro font-medium">
              {t('parentInvoices.consentDeclined', 'Declined')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ParentInvoicesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab: TabId = searchParams.get('tab') === 'consent' ? 'consent' : 'invoices';
  const [activeTab, setActiveTab] = React.useState<TabId>(initialTab);

  return (
    <div className="min-h-screen bg-page">
      {/* Page header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('parentInvoices.title', 'Invoices & Consent')}
          </h1>
          <p className="text-caption text-text-secondary">
            {t('parentInvoices.subtitle', 'Manage payments and event approvals')}
          </p>
        </div>
        <div className="max-w-[600px] mx-auto px-4">
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </header>

      {/* Tab content */}
      <main className="max-w-[600px] mx-auto px-4 py-6" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'invoices' ? <InvoiceList /> : <ConsentFormsList />}
      </main>
    </div>
  );
}
