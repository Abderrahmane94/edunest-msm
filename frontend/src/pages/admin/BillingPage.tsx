import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, CreditCard, Building2, CheckCircle, AlertCircle,
  Plus, Pencil, Trash2, X, Save, Banknote, Clock, XCircle, Search, Calendar, Download,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Button, DataTable, StatusBadge, Dialog, DialogContent,
  DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import {
  usePlans, useCreatePlan, useUpdatePlan, useDeletePlan,
  useSubscriptions, useAssignPlan, useUpdateSubscriptionStatus,
  useRecordPayment, useBillingStats, useSchoolPayments,
  type SubscriptionPlan, type SchoolSubscription, type BillingStats, type SchoolPaymentRecord,
} from '@/hooks/useBilling';
import { useSchoolsList } from '@/hooks/useSchools';

type Tab = 'dashboard' | 'plans' | 'subscriptions' | 'payments';

function formatDZD(n: number) {
  return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(n);
}

const STATUS_VARIANT: Record<string, string> = {
  active: 'present', trial: 'late', overdue: 'absent', cancelled: 'cancelled', suspended: 'draft',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  active: <CheckCircle className="w-4 h-4 text-success" />,
  trial: <Clock className="w-4 h-4 text-warning" />,
  overdue: <AlertCircle className="w-4 h-4 text-danger" />,
  cancelled: <XCircle className="w-4 h-4 text-text-disabled" />,
  suspended: <X className="w-4 h-4 text-text-disabled" />,
};

/* ─── Dashboard tab ─── */
function BillingDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useBillingStats() as { data: BillingStats | undefined; isLoading: boolean };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-hover rounded-xl h-24 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-hover rounded-xl h-20 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('billing.dashboard.mrr'), value: formatDZD(stats?.mrr ?? 0), icon: <TrendingUp className="w-5 h-5 text-primary" />, accent: 'bg-accent-muted' },
          { label: t('billing.dashboard.revenueThisMonth'), value: formatDZD(stats?.revenueThisMonth ?? 0), icon: <Banknote className="w-5 h-5 text-success" />, accent: 'bg-success-muted' },
          { label: t('billing.dashboard.totalRevenue'), value: formatDZD(stats?.totalRevenue ?? 0), icon: <CreditCard className="w-5 h-5 text-warning" />, accent: 'bg-warning-muted' },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.accent}`}>{c.icon}</div>
            <div>
              <p className="text-caption text-text-secondary">{c.label}</p>
              <p className="text-section font-bold text-text-heading">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription status breakdown */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-subsection font-semibold text-text-heading mb-4">{t('billing.dashboard.subscriptionStatus')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: 'active', label: t('billing.status.active'), color: 'text-success' },
            { key: 'trial', label: t('billing.status.trial'), color: 'text-warning' },
            { key: 'overdue', label: t('billing.status.overdue'), color: 'text-danger' },
            { key: 'cancelled', label: t('billing.status.cancelled'), color: 'text-text-disabled' },
          ].map((s) => (
            <div key={s.key} className="text-center p-4 bg-subtle rounded-lg">
              <p className={`text-display font-bold ${s.color}`}>{stats?.[s.key as keyof BillingStats] ?? 0}</p>
              <p className="text-caption text-text-secondary mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Plans tab ─── */
function PlanFormDialog({
  open, onOpenChange, plan,
}: { open: boolean; onOpenChange: (v: boolean) => void; plan?: SubscriptionPlan }) {
  const { t } = useTranslation();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const emptyForm = { name: '', description: '', priceMonthly: '', priceAnnual: '', maxChildren: '', maxUsers: '' };
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (plan) {
      setForm({
        name: plan.name,
        description: plan.description ?? '',
        priceMonthly: String(plan.priceMonthly),
        priceAnnual: plan.priceAnnual != null ? String(plan.priceAnnual) : '',
        maxChildren: plan.maxChildren != null ? String(plan.maxChildren) : '',
        maxUsers: plan.maxUsers != null ? String(plan.maxUsers) : '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [plan, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      description: form.description || undefined,
      priceMonthly: Number(form.priceMonthly),
      priceAnnual: form.priceAnnual ? Number(form.priceAnnual) : undefined,
      maxChildren: form.maxChildren ? Number(form.maxChildren) : undefined,
      maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined,
      currency: 'DZD',
    };
    const callbacks = {
      onSuccess: () => onOpenChange(false),
      onError: (err: unknown) => setError(err instanceof Error ? err.message : 'BILLING_ERROR'),
    };
    if (plan) updatePlan.mutate({ id: plan.id, ...payload }, callbacks);
    else createPlan.mutate(payload, callbacks);
  }

  const isPending = createPlan.isPending || updatePlan.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? t('billing.plans.edit') : t('billing.plans.create')}</DialogTitle>
          <DialogDescription>{t('billing.plans.formDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormField label={t('billing.plans.name')} htmlFor="p-name" required>
            <Input id="p-name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Standard" />
          </FormField>
          <FormField label={t('billing.plans.description')} htmlFor="p-desc">
            <Input id="p-desc" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t('billing.plans.descriptionPlaceholder')} />
          </FormField>
          <div className="grid grid-cols-2 gap-x-4">
            <FormField label={t('billing.plans.priceMonthly')} htmlFor="p-monthly" required>
              <Input id="p-monthly" type="number" min="0" value={form.priceMonthly} onChange={(e) => setForm(p => ({ ...p, priceMonthly: e.target.value }))} placeholder="2000" />
            </FormField>
            <FormField label={t('billing.plans.priceAnnual')} htmlFor="p-annual">
              <Input id="p-annual" type="number" min="0" value={form.priceAnnual} onChange={(e) => setForm(p => ({ ...p, priceAnnual: e.target.value }))} placeholder="20000" />
            </FormField>
            <FormField label={t('billing.plans.maxChildren')} htmlFor="p-children">
              <Input id="p-children" type="number" min="1" value={form.maxChildren} onChange={(e) => setForm(p => ({ ...p, maxChildren: e.target.value }))} placeholder={t('billing.plans.unlimited')} />
            </FormField>
            <FormField label={t('billing.plans.maxUsers')} htmlFor="p-users">
              <Input id="p-users" type="number" min="1" value={form.maxUsers} onChange={(e) => setForm(p => ({ ...p, maxUsers: e.target.value }))} placeholder={t('billing.plans.unlimited')} />
            </FormField>
          </div>
          {error && <p className="text-body text-danger mb-3">{t(`billing.errors.${error}`, { defaultValue: error })}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isPending}>
              <Save className="w-4 h-4" />{isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlansTab() {
  const { t } = useTranslation();
  const { data: plans, isLoading } = usePlans();
  const deletePlan = useDeletePlan();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editPlan, setEditPlan] = React.useState<SubscriptionPlan | undefined>();
  const [deletingPlan, setDeletingPlan] = React.useState<SubscriptionPlan | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  async function handleConfirmDelete() {
    if (!deletingPlan) return;
    setDeleteError(null);
    try {
      await deletePlan.mutateAsync(deletingPlan.id);
      setDeletingPlan(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'BILLING_ERROR');
    }
  }

  const columns: Column<SubscriptionPlan>[] = [
    { key: 'name', header: t('billing.plans.name'), render: (p) => <span className="font-medium text-foreground">{p.name}</span> },
    { key: 'priceMonthly', header: t('billing.plans.priceMonthly'), render: (p) => <span className="font-mono font-medium">{formatDZD(p.priceMonthly)}</span> },
    { key: 'priceAnnual', header: t('billing.plans.priceAnnual'), render: (p) => p.priceAnnual ? <span className="font-mono">{formatDZD(p.priceAnnual)}</span> : <span className="text-text-disabled">—</span> },
    { key: 'maxChildren', header: t('billing.plans.maxChildren'), render: (p) => <span className="text-text-secondary">{p.maxChildren ?? t('billing.plans.unlimited')}</span> },
    { key: 'maxUsers', header: t('billing.plans.maxUsers'), render: (p) => <span className="text-text-secondary">{p.maxUsers ?? t('billing.plans.unlimited')}</span> },
    {
      key: 'actions', header: '', render: (p) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditPlan(p); setFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeletingPlan(p); }}>
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        </div>
      ), className: 'w-20',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {deleteError && <p className="text-body text-danger">{t(`billing.errors.${deleteError}`, { defaultValue: deleteError })}</p>}
        <div className="ms-auto">
          <Button onClick={() => { setEditPlan(undefined); setFormOpen(true); }}>
            <Plus className="w-4 h-4" />{t('billing.plans.create')}
          </Button>
        </div>
      </div>
      {isLoading
        ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-hover rounded-xl h-12 animate-pulse" />)}</div>
        : <DataTable columns={columns} data={plans ?? []} keyExtractor={(p) => p.id} emptyMessage={t('billing.plans.empty')} />}
      <PlanFormDialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditPlan(undefined); }} plan={editPlan} />

      {/* Delete confirmation */}
      <Dialog open={!!deletingPlan} onOpenChange={(v) => { if (!v) { setDeletingPlan(null); setDeleteError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billing.plans.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('billing.plans.deleteConfirm', { name: deletingPlan?.name })}</DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-body text-danger mt-2">{t(`billing.errors.${deleteError}`, { defaultValue: deleteError })}</p>}
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setDeletingPlan(null); setDeleteError(null); }}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={deletePlan.isPending} onClick={handleConfirmDelete}>
              <Trash2 className="w-4 h-4" />{deletePlan.isPending ? t('common.loading') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Subscriptions tab ─── */
function AssignPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const { data: schools } = useSchoolsList();
  const { data: plans } = usePlans();
  const assignPlan = useAssignPlan();
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = React.useState({ schoolId: '', planId: '', billingCycle: 'monthly', startDate: today, trialDays: '' });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm({ schoolId: '', planId: '', billingCycle: 'monthly', startDate: today, trialDays: '' });
      setError(null);
    }
  }, [open]);

  const schoolOptions = (schools ?? []).map((s) => ({ value: s.id, label: s.name }));
  const planOptions = (plans ?? []).filter((p) => p.isActive).map((p) => ({ value: p.id, label: `${p.name} — ${formatDZD(p.priceMonthly)}/mois` }));
  const cycleOptions = [{ value: 'monthly', label: t('billing.subscriptions.monthly') }, { value: 'annual', label: t('billing.subscriptions.annual') }];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    assignPlan.mutate(
      { ...form, trialDays: form.trialDays ? Number(form.trialDays) : undefined },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError(err instanceof Error ? err.message : 'BILLING_ERROR'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('billing.subscriptions.assign')}</DialogTitle>
          <DialogDescription>{t('billing.subscriptions.assignDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormSelect label={t('billing.subscriptions.school')} name="schoolId" value={form.schoolId} onChange={(e) => setForm(p => ({ ...p, schoolId: e.target.value }))} options={schoolOptions} placeholder={t('billing.subscriptions.selectSchool')} />
          <FormSelect label={t('billing.subscriptions.plan')} name="planId" value={form.planId} onChange={(e) => setForm(p => ({ ...p, planId: e.target.value }))} options={planOptions} placeholder={t('billing.subscriptions.selectPlan')} />
          <FormSelect label={t('billing.subscriptions.billingCycle')} name="billingCycle" value={form.billingCycle} onChange={(e) => setForm(p => ({ ...p, billingCycle: e.target.value }))} options={cycleOptions} />
          <div className="grid grid-cols-2 gap-x-4">
            <FormField label={t('billing.subscriptions.startDate')} htmlFor="s-start" required>
              <Input id="s-start" type="date" value={form.startDate} onChange={(e) => setForm(p => ({ ...p, startDate: e.target.value }))} />
            </FormField>
            <FormField label={t('billing.subscriptions.trialDays')} htmlFor="s-trial">
              <Input id="s-trial" type="number" min="0" value={form.trialDays} onChange={(e) => setForm(p => ({ ...p, trialDays: e.target.value }))} placeholder="0" />
            </FormField>
          </div>
          {error && <p className="text-body text-danger mb-3">{t(`billing.errors.${error}`, { defaultValue: error })}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={assignPlan.isPending || !form.schoolId || !form.planId}>
              {assignPlan.isPending ? t('common.loading') : t('billing.subscriptions.assign')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({ sub, onClose }: { sub: SchoolSubscription; onClose: () => void }) {
  const { t } = useTranslation();
  const recordPayment = useRecordPayment();
  const today = new Date().toISOString().split('T')[0];

  // Pre-fill the NEXT billing period (current end → one cycle later)
  const nextStart = sub.currentPeriodEnd.split('T')[0];
  const nextEndDate = new Date(sub.currentPeriodEnd);
  if (sub.billingCycle === 'annual') nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
  else nextEndDate.setMonth(nextEndDate.getMonth() + 1);
  const nextEnd = nextEndDate.toISOString().split('T')[0];

  const defaultAmount = sub.billingCycle === 'annual' && sub.plan.priceAnnual
    ? String(sub.plan.priceAnnual)
    : String(sub.plan.priceMonthly);

  const [form, setForm] = React.useState({ amount: defaultAmount, periodStart: nextStart, periodEnd: nextEnd, paidAt: today, note: '' });
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    recordPayment.mutate(
      { subscriptionId: sub.id, amount: Number(form.amount), periodStart: form.periodStart, periodEnd: form.periodEnd, paidAt: form.paidAt, note: form.note || undefined },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError(err instanceof Error ? err.message : 'BILLING_ERROR'),
      },
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('billing.payments.record')}</DialogTitle>
          <DialogDescription>{sub.school.name} — {sub.plan.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormField label={t('billing.payments.amount')} htmlFor="pay-amount" required>
            <Input id="pay-amount" type="number" min="0" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-x-4">
            <FormField label={t('billing.payments.periodStart')} htmlFor="pay-start" required>
              <Input id="pay-start" type="date" value={form.periodStart} onChange={(e) => setForm(p => ({ ...p, periodStart: e.target.value }))} />
            </FormField>
            <FormField label={t('billing.payments.periodEnd')} htmlFor="pay-end" required>
              <Input id="pay-end" type="date" value={form.periodEnd} onChange={(e) => setForm(p => ({ ...p, periodEnd: e.target.value }))} />
            </FormField>
          </div>
          <FormField label={t('billing.payments.paidAt')} htmlFor="pay-date" required>
            <Input id="pay-date" type="date" value={form.paidAt} onChange={(e) => setForm(p => ({ ...p, paidAt: e.target.value }))} />
          </FormField>
          <FormField label={t('billing.payments.note')} htmlFor="pay-note">
            <Input id="pay-note" value={form.note} onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))} placeholder={t('billing.payments.notePlaceholder')} />
          </FormField>
          {error && <p className="text-body text-danger mb-3">{t(`billing.errors.${error}`, { defaultValue: error })}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              <Banknote className="w-4 h-4" />{recordPayment.isPending ? t('common.loading') : t('billing.payments.record')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionsTab() {
  const { t } = useTranslation();
  const { data: subs, isLoading } = useSubscriptions();
  const { data: plans } = usePlans();
  const { data: schools } = useSchoolsList();
  const updateStatus = useUpdateSubscriptionStatus();
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [payingSub, setPayingSub] = React.useState<SchoolSubscription | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const [schoolFilter, setSchoolFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [planFilter, setPlanFilter] = React.useState('');
  const [cycleFilter, setCycleFilter] = React.useState('');

  const hasFilters = !!(schoolFilter || statusFilter || planFilter || cycleFilter);

  const filtered = React.useMemo(() => {
    let data = subs ?? [];
    if (schoolFilter) data = data.filter((s) => s.school.id === schoolFilter);
    if (statusFilter) data = data.filter((s) => s.status === statusFilter);
    if (planFilter) data = data.filter((s) => s.plan.id === planFilter);
    if (cycleFilter) data = data.filter((s) => s.billingCycle === cycleFilter);
    return data;
  }, [subs, schoolFilter, statusFilter, planFilter, cycleFilter]);

  const schoolOptions = React.useMemo(() => [
    { value: '', label: t('billing.subscriptions.allSchools') },
    ...(schools ?? []).map((s) => ({ value: s.id, label: s.name })),
  ], [schools, t]);

  const planOptions = React.useMemo(() => [
    { value: '', label: t('billing.subscriptions.allPlans') },
    ...(plans ?? []).map((p) => ({ value: p.id, label: p.name })),
  ], [plans, t]);

  const statusOptions = [
    { value: '', label: t('billing.subscriptions.allStatuses') },
    { value: 'active', label: t('billing.status.active') },
    { value: 'trial', label: t('billing.status.trial') },
    { value: 'overdue', label: t('billing.status.overdue') },
    { value: 'cancelled', label: t('billing.status.cancelled') },
    { value: 'suspended', label: t('billing.status.suspended') },
  ];

  const cycleOptions = [
    { value: '', label: t('billing.subscriptions.allCycles') },
    { value: 'monthly', label: t('billing.subscriptions.monthly') },
    { value: 'annual', label: t('billing.subscriptions.annual') },
  ];

  async function handleStatusChange(sub: SchoolSubscription, status: 'cancelled' | 'suspended' | 'active') {
    setStatusError(null);
    try {
      await updateStatus.mutateAsync({ id: sub.id, status });
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'BILLING_ERROR');
    }
  }

  const columns: Column<SchoolSubscription>[] = [
    {
      key: 'school', header: t('billing.subscriptions.school'), render: (s) => (
        <div>
          <p className="font-medium text-foreground">{s.school.name}</p>
          <p className="text-caption text-text-secondary">{s.school.wilaya}</p>
        </div>
      ),
    },
    { key: 'plan', header: t('billing.subscriptions.plan'), render: (s) => <span className="font-medium text-foreground">{s.plan.name}</span> },
    { key: 'price', header: t('billing.subscriptions.price'), render: (s) => <span className="font-mono">{formatDZD(s.plan.priceMonthly)}<span className="text-caption text-text-disabled">/mois</span></span> },
    {
      key: 'status', header: t('billing.subscriptions.status'), render: (s) => (
        <div className="flex items-center gap-1.5">
          {STATUS_ICON[s.status]}
          <StatusBadge variant={STATUS_VARIANT[s.status] as 'present' | 'late' | 'absent' | 'cancelled' | 'draft'}>{t(`billing.status.${s.status}`)}</StatusBadge>
        </div>
      ),
    },
    {
      key: 'period', header: t('billing.subscriptions.period'), render: (s) => (
        <span className="text-caption text-text-secondary" dir="ltr">
          {new Date(s.currentPeriodStart).toLocaleDateString()} – {new Date(s.currentPeriodEnd).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions', header: '', render: (s) => {
        const periodPaid = s.status === 'active' && new Date(s.currentPeriodEnd) > new Date();
        const blocked = s.status === 'cancelled' || s.status === 'suspended';
        return (
          <div className="flex items-center gap-1 justify-end">
            {!periodPaid && !blocked && (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setPayingSub(s); }}>
                <Banknote className="w-3.5 h-3.5 text-success" />{t('billing.payments.record')}
              </Button>
            )}
            {s.status === 'active' && (
              <Button variant="ghost" size="icon" title={t('billing.subscriptions.suspend')}
                onClick={(e) => { e.stopPropagation(); handleStatusChange(s, 'suspended'); }}>
                <X className="w-4 h-4 text-warning" />
              </Button>
            )}
            {(s.status === 'active' || s.status === 'suspended' || s.status === 'overdue' || s.status === 'trial') && (
              <Button variant="ghost" size="icon" title={t('billing.subscriptions.cancel')}
                onClick={(e) => { e.stopPropagation(); handleStatusChange(s, 'cancelled'); }}>
                <XCircle className="w-4 h-4 text-danger" />
              </Button>
            )}
            {s.status === 'suspended' && (
              <Button variant="ghost" size="icon" title={t('billing.subscriptions.reactivate')}
                onClick={(e) => { e.stopPropagation(); handleStatusChange(s, 'active'); }}>
                <CheckCircle className="w-4 h-4 text-success" />
              </Button>
            )}
          </div>
        );
      }, className: 'w-48',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <FormSelect
              label={t('billing.subscriptions.school')}
              name="school"
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              options={schoolOptions}
            />
          </div>
          <div>
            <FormSelect
              label={t('billing.subscriptions.status')}
              name="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
          </div>
          <div>
            <FormSelect
              label={t('billing.subscriptions.plan')}
              name="plan"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              options={planOptions}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="w-48">
            <FormSelect
              label={t('billing.subscriptions.billingCycle')}
              name="cycle"
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              options={cycleOptions}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="mt-5"
              onClick={() => { setSchoolFilter(''); setStatusFilter(''); setPlanFilter(''); setCycleFilter(''); }}>
              {t('billing.subscriptions.clearFilters')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setAssignOpen(true)}>
          <Plus className="w-4 h-4" />{t('billing.subscriptions.assign')}
        </Button>
      </div>
      {statusError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-body text-danger flex items-center justify-between">
          <span>{t(`billing.errors.${statusError}`, { defaultValue: statusError! })}</span>
          <button onClick={() => setStatusError(null)} className="text-danger hover:opacity-70 text-lg leading-none">&times;</button>
        </div>
      )}
      {isLoading
        ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-hover rounded-xl h-14 animate-pulse" />)}</div>
        : <DataTable columns={columns} data={filtered} keyExtractor={(s) => s.id} emptyMessage={t('billing.subscriptions.empty')} />}
      <AssignPlanDialog open={assignOpen} onOpenChange={setAssignOpen} />
      {payingSub && <RecordPaymentDialog sub={payingSub} onClose={() => setPayingSub(null)} />}
    </div>
  );
}

/* ─── Payments tab ─── */
function PaymentsTab() {
  const { t } = useTranslation();
  const { data: schools } = useSchoolsList();

  const [selectedSchoolId, setSelectedSchoolId] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const filters = React.useMemo(() => ({
    from: dateFrom || undefined,
    to: dateTo || undefined,
    status: statusFilter || undefined,
  }), [dateFrom, dateTo, statusFilter]);

  const { data: payments, isLoading: paymentsLoading } = useSchoolPayments(
    selectedSchoolId || null,
    filters,
  );

  const schoolOptions = React.useMemo(() =>
    (schools ?? []).map((s) => ({ value: s.id, label: s.name })),
    [schools],
  );

  const statusOptions = [
    { value: '', label: t('billingPayments.allStatuses') },
    { value: 'active', label: t('billing.status.active') },
    { value: 'overdue', label: t('billing.status.overdue') },
    { value: 'trial', label: t('billing.status.trial') },
    { value: 'cancelled', label: t('billing.status.cancelled') },
    { value: 'suspended', label: t('billing.status.suspended') },
  ];

  const columns: Column<SchoolPaymentRecord>[] = [
    {
      key: 'paidAt', header: t('billingPayments.columns.date'), render: (p) => (
        <span className="text-body text-text-primary">{new Date(p.paidAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'amount', header: t('billingPayments.columns.amount'), render: (p) => (
        <span className="font-mono font-medium text-text-heading">{formatDZD(p.amount)}</span>
      ),
    },
    {
      key: 'period', header: t('billingPayments.columns.period'), render: (p) => (
        <span className="text-caption text-text-secondary" dir="ltr">
          {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'plan', header: t('billingPayments.columns.plan'), render: (p) => (
        <span className="text-body text-text-primary">{p.subscription.plan.name}</span>
      ),
    },
    {
      key: 'status', header: t('billingPayments.columns.subscriptionStatus'), render: (p) => (
        <StatusBadge variant={STATUS_VARIANT[p.subscription.status] as 'present' | 'late' | 'absent' | 'cancelled' | 'draft'}>
          {t(`billing.status.${p.subscription.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'note', header: t('billingPayments.columns.note'), render: (p) => (
        <span className="text-caption text-text-secondary">{p.note || '—'}</span>
      ),
    },
  ];

  const totalAmount = React.useMemo(() =>
    (payments ?? []).reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );

  async function downloadPDF() {
    if (!payments || payments.length === 0) return;

    const schoolName = schools?.find((s) => s.id === selectedSchoolId)?.name ?? selectedSchoolId;
    const isRTL = document.documentElement.dir === 'rtl';
    const dir = isRTL ? 'rtl' : 'ltr';
    const font = isRTL
      ? "'Noto Sans Arabic', Arial, sans-serif"
      : "'Plus Jakarta Sans', Arial, sans-serif";
    const amountAlign = isRTL ? 'left' : 'right';
    const rowDir = isRTL ? 'row-reverse' : 'row';

    const filterParts: string[] = [];
    if (dateFrom) filterParts.push(`${t('billingPayments.from')}: ${dateFrom}`);
    if (dateTo) filterParts.push(`${t('billingPayments.to')}: ${dateTo}`);
    if (statusFilter) filterParts.push(`${t('billingPayments.status')}: ${t(`billing.status.${statusFilter}`)}`);

    const STATUS_COLOR: Record<string, string> = {
      active: '#16a34a', trial: '#ca8a04', overdue: '#dc2626',
      cancelled: '#9ca3af', suspended: '#9ca3af',
    };

    const cellBase = `padding:9px 12px; border-bottom:1px solid #e5e7eb; font-size:11px; color:#374151;`;
    const rows = payments.map((p, i) => {
      const bg = i % 2 === 1 ? 'background:#f9fafb;' : '';
      const statusColor = STATUS_COLOR[p.subscription.status] ?? '#374151';
      return `<tr style="${bg}">
        <td style="${cellBase}">${new Date(p.paidAt).toLocaleDateString()}</td>
        <td style="${cellBase} text-align:${amountAlign}; font-weight:600; color:#111827;">${p.amount.toLocaleString('fr-FR')} DZD</td>
        <td style="${cellBase}" dir="ltr">${new Date(p.periodStart).toLocaleDateString()} – ${new Date(p.periodEnd).toLocaleDateString()}</td>
        <td style="${cellBase}">${p.subscription.plan.name}</td>
        <td style="${cellBase} color:${statusColor}; font-weight:600;">${t(`billing.status.${p.subscription.status}`)}</td>
        <td style="${cellBase} color:#9ca3af;">${p.note ?? '—'}</td>
      </tr>`;
    }).join('');

    const thBase = `padding:10px 12px; font-weight:600; font-size:11px; color:#fff;`;
    const html = `<div style="font-family:${font}; direction:${dir}; background:#fff; width:794px; box-sizing:border-box; color:#111827;">

      <div style="background:#6366f1; padding:22px 32px; display:flex; flex-direction:${rowDir}; justify-content:space-between; align-items:center;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700; letter-spacing:-0.5px; margin-bottom:4px;">EduNest</div>
          <div style="color:#c7d2fe; font-size:11px;">${t('billingPayments.pdfTitle')}</div>
        </div>
        <div style="color:#e0e7ff; font-size:10px;">${new Date().toLocaleDateString()}</div>
      </div>

      <div style="padding:24px 32px 0;">

        <div style="font-size:16px; font-weight:700; color:#111827; margin-bottom:${filterParts.length ? '4px' : '16px'};">${schoolName}</div>
        ${filterParts.length ? `<div style="font-size:10px; color:#6b7280; margin-bottom:16px;">${filterParts.join('   ·   ')}</div>` : ''}

        <div style="display:flex; flex-direction:${rowDir}; gap:12px; margin-bottom:24px;">
          <div style="flex:1; background:#eef2ff; border-radius:10px; padding:14px 18px;">
            <div style="font-size:26px; font-weight:700; color:#6366f1; line-height:1;">${payments.length}</div>
            <div style="font-size:10px; color:#6b7280; margin-top:6px;">${t('billingPayments.totalPayments')}</div>
          </div>
          <div style="flex:1; background:#f0fdf4; border-radius:10px; padding:14px 18px;">
            <div style="font-size:20px; font-weight:700; color:#16a34a; line-height:1;">${totalAmount.toLocaleString('fr-FR')} DZD</div>
            <div style="font-size:10px; color:#6b7280; margin-top:6px;">${t('billingPayments.totalAmount')}</div>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; border-radius:8px; overflow:hidden;">
          <thead>
            <tr style="background:#6366f1;">
              <th style="${thBase} text-align:${isRTL ? 'right' : 'left'};">${t('billingPayments.columns.date')}</th>
              <th style="${thBase} text-align:${amountAlign};">${t('billingPayments.columns.amount')}</th>
              <th style="${thBase} text-align:${isRTL ? 'right' : 'left'};">${t('billingPayments.columns.period')}</th>
              <th style="${thBase} text-align:${isRTL ? 'right' : 'left'};">${t('billingPayments.columns.plan')}</th>
              <th style="${thBase} text-align:${isRTL ? 'right' : 'left'};">${t('billingPayments.columns.subscriptionStatus')}</th>
              <th style="${thBase} text-align:${isRTL ? 'right' : 'left'};">${t('billingPayments.columns.note')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#f3f4f6; border-top:2px solid #d1d5db;">
              <td style="padding:10px 12px; font-weight:700; font-size:11px;">${t('billingPayments.total')}</td>
              <td style="padding:10px 12px; font-weight:700; font-size:11px; text-align:${amountAlign}; color:#16a34a;">${totalAmount.toLocaleString('fr-FR')} DZD</td>
              <td colspan="4" style="padding:10px 12px;"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="background:#6366f1; margin-top:28px; padding:8px 32px; display:flex; flex-direction:${rowDir}; justify-content:space-between; align-items:center;">
        <span style="color:#fff; font-size:9px; font-weight:600;">EduNest</span>
        <span style="color:#c7d2fe; font-size:9px;">${t('billingPayments.generatedOn')}: ${new Date().toLocaleDateString()}</span>
      </div>
    </div>`;

    // Fixed position above viewport — avoids RTL left:-9999px clipping
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed; top:-20000px; left:0; width:794px; z-index:-9999; opacity:0; pointer-events:none;';
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    // Wait for fonts (Noto Sans Arabic loads async)
    await document.fonts.ready;
    await new Promise<void>((r) => setTimeout(r, 250));

    const canvas = await html2canvas(wrapper.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    document.body.removeChild(wrapper);

    // Paginate into A4
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / pdfW;
    const pageHeightPx = Math.floor(pdfH * ratio);

    let srcY = 0;
    let firstPage = true;
    while (srcY < canvas.height) {
      if (!firstPage) pdf.addPage();
      firstPage = false;

      const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, sliceH / ratio);
      srcY += pageHeightPx;
    }

    pdf.save(`paiements-${schoolName}-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <FormSelect
              label={t('billingPayments.selectSchool')}
              name="schoolId"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              options={schoolOptions}
              placeholder={t('billingPayments.schoolPlaceholder')}
            />
          </div>
          <div>
            <label className="text-label font-medium text-text-primary block mb-1">{t('billingPayments.from')}</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-label font-medium text-text-primary block mb-1">{t('billingPayments.to')}</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="w-48">
            <FormSelect
              label={t('billingPayments.status')}
              name="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
          </div>
          {(dateFrom || dateTo || statusFilter) && (
            <Button variant="ghost" size="sm" className="mt-5" onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter(''); }}>
              {t('billingPayments.clearFilters')}
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      {!selectedSchoolId ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Search className="w-12 h-12 text-text-disabled mx-auto mb-4" />
          <p className="text-body text-text-secondary">{t('billingPayments.selectSchoolPrompt')}</p>
        </div>
      ) : paymentsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-hover rounded-xl h-14 animate-pulse" />)}
        </div>
      ) : (
        <>
          {payments && payments.length > 0 && (
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={downloadPDF}>
                <Download className="w-4 h-4" />{t('billingPayments.downloadPdf')}
              </Button>
            </div>
          )}
          {payments && payments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-success-muted">
                  <Banknote className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-caption text-text-secondary">{t('billingPayments.totalPayments')}</p>
                  <p className="text-section font-bold text-text-heading">{payments.length}</p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-accent-muted">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-caption text-text-secondary">{t('billingPayments.totalAmount')}</p>
                  <p className="text-section font-bold text-text-heading">{formatDZD(totalAmount)}</p>
                </div>
              </div>
            </div>
          )}
          <DataTable columns={columns} data={payments ?? []} keyExtractor={(p) => p.id} emptyMessage={t('billingPayments.empty')} />
        </>
      )}
    </div>
  );
}

/* ─── Page ─── */
export function BillingPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: t('billing.tabs.dashboard'), icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'plans', label: t('billing.tabs.plans'), icon: <CreditCard className="w-4 h-4" /> },
    { key: 'subscriptions', label: t('billing.tabs.subscriptions'), icon: <Building2 className="w-4 h-4" /> },
    { key: 'payments', label: t('billing.tabs.payments'), icon: <Banknote className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-page-title font-semibold text-text-heading">{t('billing.title')}</h1>

      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <Button key={tab.key} variant={activeTab === tab.key ? 'primary' : 'secondary'} size="sm"
            onClick={() => setActiveTab(tab.key)}>
            {tab.icon}{tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'dashboard' && <BillingDashboard />}
      {activeTab === 'plans' && <PlansTab />}
      {activeTab === 'subscriptions' && <SubscriptionsTab />}
      {activeTab === 'payments' && <PaymentsTab />}
    </div>
  );
}
