import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Receipt, CalendarDays, Wallet, Eye, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

type PeriodStatus = 'unpaid' | 'partial' | 'late_partial' | 'late' | 'paid';
type PaymentChannel = 'cash' | 'ccp' | 'baridimob';
interface ParentBillingPeriod { id: string; childName: string; branchName: string; periodStart: string; periodEnd: string; dueDate: string; graceEndDate: string; amountDue: string; isRegistrationPeriod: boolean; status: PeriodStatus; isLate: boolean; }
interface ParentPaymentRecord { id: string; childName: string; receiptNumber: string; totalAmount: string; channel: PaymentChannel; valueDate: string; isCorrection: boolean; correctsReceiptNumber: string | null; allocations: { periodLabel: string; amount: string }[]; }
interface ParentChildBalance { childId: string; childName: string; branchName: string; outstanding: string; }

function useParentPeriods() { return useQuery({ queryKey: ['parent-payment-periods'], queryFn: async () => { const res = await apiClient.get<unknown>('/payments/parent/periods'); if (!res.success) throw new Error(res.error?.message ?? 'Failed'); return Array.isArray(res.data) ? res.data.map(mapPeriod) : []; } }); }
function useParentHistory() { return useQuery({ queryKey: ['parent-payment-history'], queryFn: async () => { const res = await apiClient.get<unknown>('/payments/parent/history'); if (!res.success) throw new Error(res.error?.message ?? 'Failed'); return Array.isArray(res.data) ? res.data.map(mapPayment) : []; } }); }
function useParentBalances() { return useQuery({ queryKey: ['parent-payment-balances'], queryFn: async () => { const res = await apiClient.get<unknown>('/payments/parent/balances'); if (!res.success) throw new Error(res.error?.message ?? 'Failed'); return Array.isArray(res.data) ? res.data.map(mapBalance) : []; } }); }

function mapPeriod(raw: Record<string, unknown>): ParentBillingPeriod { return { id: raw.id as string, childName: (raw.childName ?? raw.child_name ?? '') as string, branchName: (raw.branchName ?? raw.branch_name ?? '') as string, periodStart: (raw.periodStart ?? raw.period_start) as string, periodEnd: (raw.periodEnd ?? raw.period_end) as string, dueDate: (raw.dueDate ?? raw.due_date) as string, graceEndDate: (raw.graceEndDate ?? raw.grace_end_date) as string, amountDue: String(raw.amountDue ?? raw.amount_due ?? '0'), isRegistrationPeriod: Boolean(raw.isRegistrationPeriod ?? raw.is_registration_period), status: (raw.status as PeriodStatus) ?? 'unpaid', isLate: Boolean(raw.isLate ?? raw.is_late) }; }
function mapPayment(raw: Record<string, unknown>): ParentPaymentRecord { const allocs = raw.allocations as Record<string, unknown>[] | undefined; return { id: raw.id as string, childName: (raw.childName ?? raw.child_name ?? '') as string, receiptNumber: (raw.receiptNumber ?? raw.receipt_number) as string, totalAmount: String(raw.totalAmount ?? raw.total_amount ?? '0'), channel: (raw.channel as PaymentChannel) ?? 'cash', valueDate: (raw.valueDate ?? raw.value_date) as string, isCorrection: Boolean(raw.isCorrection ?? raw.is_correction), correctsReceiptNumber: (raw.correctsReceiptNumber ?? raw.corrects_receipt_number ?? null) as string | null, allocations: allocs ? allocs.map((a) => ({ periodLabel: (a.periodLabel ?? a.period_label ?? '') as string, amount: String(a.amount ?? '0') })) : [] }; }
function mapBalance(raw: Record<string, unknown>): ParentChildBalance { return { childId: (raw.childId ?? raw.child_id) as string, childName: (raw.childName ?? raw.child_name ?? '') as string, branchName: (raw.branchName ?? raw.branch_name ?? '') as string, outstanding: String(raw.outstanding ?? '0') }; }

function formatDZD(amount: string | number): string { const num = typeof amount === 'string' ? parseFloat(amount) : amount; if (isNaN(num)) return '0.00 DZD'; return `${num.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD`; }
function fmtDate(dateStr: string): string { try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return dateStr; } }
function statusColor(status: PeriodStatus): string { switch (status) { case 'paid': return 'bg-[var(--color-success-muted)] text-[var(--color-success)]'; case 'partial': return 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]'; case 'late': case 'late_partial': return 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'; default: return 'bg-subtle text-text-secondary'; } }
function channelLabel(ch: PaymentChannel, t: ReturnType<typeof useTranslation>['t']): string { return t(`parentPayments.channel.${ch}`, ch); }

type TabId = 'periods' | 'history' | 'balances';

export function ParentPaymentsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<TabId>('periods');
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <h1 className="text-page-title font-semibold text-text-heading">{t('parentPayments.title', 'Payments')}</h1>
          <p className="text-caption text-text-secondary">{t('parentPayments.subtitle', "View your children's charges and payments")}</p>
        </div>
        <div className="max-w-[600px] mx-auto px-4"><TabBar activeTab={activeTab} onTabChange={setActiveTab} /></div>
      </header>
      <main className="max-w-[600px] mx-auto px-4 py-6" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'periods' && <BillingPeriodsTab />}
        {activeTab === 'history' && <PaymentHistoryTab />}
        {activeTab === 'balances' && <BalancesTab />}
      </main>
    </div>
  );
}


function TabBar({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (id: TabId) => void }) {
  const { t } = useTranslation();
  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'periods', label: t('parentPayments.tabs.periods', 'Charges'), icon: CalendarDays },
    { id: 'history', label: t('parentPayments.tabs.history', 'Payments'), icon: Receipt },
    { id: 'balances', label: t('parentPayments.tabs.balances', 'Balance'), icon: Wallet },
  ];
  return (
    <div className="flex border-b border-border" role="tablist">
      {tabs.map((tab) => { const Icon = tab.icon; const isActive = activeTab === tab.id; return (
        <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={isActive} onClick={() => onTabChange(tab.id)} className={cn('flex items-center gap-2 px-4 py-3 text-body font-medium transition-colors duration-150 border-b-2 -mb-px', isActive ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong')}>
          <Icon className="w-4 h-4" aria-hidden="true" /><span>{tab.label}</span>
        </button>); })}
    </div>
  );
}

function NoChildren() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-16 space-y-3">
      <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center"><Users className="w-8 h-8 text-text-secondary" /></div>
      <p className="text-body text-text-secondary">{t('parentPayments.noChildren', 'No children linked to your account.')}</p>
      <p className="text-caption text-text-secondary">{t('parentPayments.noChildrenHint', 'Contact your school to link your children.')}</p>
    </div>
  );
}

function SkeletonCards({ count }: { count: number }) {
  return (<div className="space-y-3">{Array.from({ length: count }).map((_, i) => (
    <div key={i} className="animate-pulse bg-card border border-border rounded-xl p-4"><div className="flex items-center gap-3"><div className="flex-1 space-y-2"><div className="h-4 bg-subtle rounded w-2/3" /><div className="h-3 bg-subtle rounded w-1/3" /></div><div className="h-6 w-16 bg-subtle rounded-full" /></div></div>
  ))}</div>);
}


function BillingPeriodsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useParentPeriods();
  if (isLoading) return <SkeletonCards count={4} />;
  if (isError) return <p className="text-center py-16 text-body text-text-secondary">{t('parentPayments.error', 'Unable to load data.')}</p>;
  if (!data || data.length === 0) return <NoChildren />;
  return (<ul role="list" className="space-y-3">{data.map((p) => <PeriodCard key={p.id} period={p} />)}</ul>);
}

function PeriodCard({ period }: { period: ParentBillingPeriod }) {
  const { t } = useTranslation();
  const label = period.isRegistrationPeriod ? t('parentPayments.registrationFee', 'Registration Fee') : `${fmtDate(period.periodStart)} — ${fmtDate(period.periodEnd)}`;
  return (
    <li><article className={cn('bg-card border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]', period.isLate ? 'border-[var(--color-danger-muted)]' : 'border-border')}>
      {period.isLate && <div className="h-1 bg-[var(--color-danger)]" aria-hidden="true" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0"><h3 className="text-body font-medium text-text-heading truncate">{period.childName}</h3><p className="text-caption text-text-secondary mt-0.5">{period.branchName}</p></div>
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-micro font-medium shrink-0', statusColor(period.status))}>{t(`parentPayments.status.${period.status}`, period.status)}</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <p className="text-caption text-text-secondary">{label}</p>
          <div className="flex items-end justify-between gap-3">
            <p className="font-mono text-subsection font-semibold text-text-heading">{formatDZD(period.amountDue)}</p>
            <p className="text-micro text-text-secondary">{t('parentPayments.dueDate', 'Due')}: {fmtDate(period.dueDate)}</p>
          </div>
        </div>
      </div>
    </article></li>
  );
}


function PaymentHistoryTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useParentHistory();
  if (isLoading) return <SkeletonCards count={4} />;
  if (isError) return <p className="text-center py-16 text-body text-text-secondary">{t('parentPayments.error', 'Unable to load data.')}</p>;
  if (!data || data.length === 0) return (<div className="text-center py-16 space-y-3"><div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center"><Receipt className="w-8 h-8 text-text-secondary" /></div><p className="text-body text-text-secondary">{t('parentPayments.noPayments', 'No payments recorded yet.')}</p></div>);
  return (<ul role="list" className="space-y-3">{data.map((p) => <PaymentCard key={p.id} payment={p} />)}</ul>);
}

function PaymentCard({ payment }: { payment: ParentPaymentRecord }) {
  const { t } = useTranslation();
  const [showReceipt, setShowReceipt] = React.useState(false);
  const isNeg = parseFloat(payment.totalAmount) < 0;
  return (
    <li><article className={cn('bg-card border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]', payment.isCorrection ? 'border-[var(--color-warning-muted)]' : 'border-border')}>
      {payment.isCorrection && <div className="h-1 bg-[var(--color-warning)]" aria-hidden="true" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0"><h3 className="text-body font-medium text-text-heading truncate">{payment.childName}</h3><p className="text-caption text-text-secondary mt-0.5">{t('parentPayments.receipt', 'Receipt')}: {payment.receiptNumber}</p></div>
          {payment.isCorrection && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-micro font-medium bg-[var(--color-warning-muted)] text-[var(--color-warning)] shrink-0">{t('parentPayments.correction', 'Correction')}</span>}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className={cn('font-mono text-subsection font-semibold', isNeg ? 'text-[var(--color-danger)]' : 'text-text-heading')}>{isNeg && '−'}{formatDZD(Math.abs(parseFloat(payment.totalAmount)))}</p>
            <p className="text-micro text-text-secondary mt-1">{channelLabel(payment.channel, t)} · {fmtDate(payment.valueDate)}</p>
          </div>
          <button type="button" onClick={() => setShowReceipt(!showReceipt)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-colors duration-150" aria-label={t('parentPayments.viewReceipt', 'View Receipt')} aria-expanded={showReceipt}>
            <Eye className="w-3.5 h-3.5" aria-hidden="true" /><span>{t('parentPayments.viewReceipt', 'View Receipt')}</span>
          </button>
        </div>
        {payment.isCorrection && payment.correctsReceiptNumber && <p className="mt-2 text-micro text-text-secondary">{t('parentPayments.correctsReceipt', 'Corrects')}: {payment.correctsReceiptNumber}</p>}
        {showReceipt && <ReceiptInline paymentId={payment.id} />}
      </div>
    </article></li>
  );
}


function ReceiptInline({ paymentId }: { paymentId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'fr';
  const { data, isLoading } = useQuery({ queryKey: ['parent-receipt', paymentId, lang], queryFn: async () => { const res = await apiClient.get<unknown>(`/payments/parent/receipts/${paymentId}?language=${lang}`); if (!res.success) throw new Error(res.error?.message ?? 'Failed'); return res.data as Record<string, unknown>; }, enabled: !!paymentId });
  if (isLoading) return <div className="mt-3 p-3 rounded-lg bg-subtle animate-pulse"><div className="h-4 bg-card rounded w-2/3 mb-2" /><div className="h-3 bg-card rounded w-1/2" /></div>;
  if (!data) return null;
  const allocs = (data.allocations as { periodLabel: string; amount: string }[]) ?? [];
  return (
    <div className="mt-3 p-3 rounded-lg bg-subtle border border-border space-y-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <p className="text-caption font-medium text-text-heading">{(data.title as string) ?? t('parentPayments.receiptTitle', 'Payment Receipt')}</p>
      {allocs.length > 0 && <ul className="space-y-1">{allocs.map((a, i) => (<li key={i} className="flex items-center justify-between text-micro text-text-secondary"><span>{a.periodLabel}</span><span className="font-mono">{formatDZD(a.amount)}</span></li>))}</ul>}
      <p className="text-micro text-text-secondary pt-1 border-t border-border">{(data.schoolName as string) ?? ''} · {(data.branchName as string) ?? ''}</p>
    </div>
  );
}

function BalancesTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useParentBalances();
  if (isLoading) return <SkeletonCards count={2} />;
  if (isError) return <p className="text-center py-16 text-body text-text-secondary">{t('parentPayments.error', 'Unable to load data.')}</p>;
  if (!data || data.length === 0) return <NoChildren />;
  return (<ul role="list" className="space-y-3">{data.map((b) => <BalanceCard key={b.childId} balance={b} />)}</ul>);
}

function BalanceCard({ balance }: { balance: ParentChildBalance }) {
  const { t } = useTranslation();
  const amt = parseFloat(balance.outstanding);
  const isOverpaid = amt < 0;
  const isZero = amt === 0;
  return (
    <li><article className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="p-5"><div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0"><h3 className="text-subsection font-semibold text-text-heading truncate">{balance.childName}</h3><p className="text-caption text-text-secondary mt-0.5">{balance.branchName}</p></div>
        <div className="text-end shrink-0">
          <p className={cn('font-mono text-subsection font-semibold', isZero ? 'text-[var(--color-success)]' : isOverpaid ? 'text-[var(--color-accent)]' : 'text-text-heading')}>{isOverpaid && '−'}{formatDZD(Math.abs(amt))}</p>
          {isOverpaid && <p className="text-micro text-[var(--color-accent)] mt-0.5">{t('parentPayments.paidInAdvance', 'Paid in advance')}</p>}
          {isZero && <p className="text-micro text-[var(--color-success)] mt-0.5">{t('parentPayments.allPaid', 'All paid')}</p>}
          {!isOverpaid && !isZero && <p className="text-micro text-text-secondary mt-0.5">{t('parentPayments.outstanding', 'Outstanding')}</p>}
        </div>
      </div></div>
    </article></li>
  );
}
