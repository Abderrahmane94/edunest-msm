import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Banknote, Printer, Settings } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Input,
  ListSkeleton,
  StatusBadge,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate, formatDateTime, formatDZD } from '@/lib/formatters';
import { printDocument } from '@/lib/printDocument';
import { usePermissions } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCashDesk,
  useCashDesks,
  useCashHandover,
  useCashHandovers,
  useCollectCashDesk,
  useMyCashDesk,
  useUpdateCashSettings,
  type CashDesk,
  type CashDeskDetail,
  type CashExpenseLine,
  type CashHandover,
  type CashPaymentLine,
  type CashSettings,
} from '@/hooks/useCashDesks';

function useMoney() {
  const { i18n } = useTranslation();
  return (amount: string | number) => formatDZD(Number(amount), i18n.language);
}

function Amount({ value, className = '' }: { value: string | number; className?: string }) {
  const money = useMoney();
  return (
    <span className={`font-mono ${className}`} dir="ltr">
      {money(value)}
    </span>
  );
}

/** "Fonds laissé + espèces encaissées − dépenses = à trouver". */
function Breakdown({ openingFloat, cashIn, cashOut, expected }: { openingFloat: string; cashIn: string; cashOut: string; expected: string }) {
  const { t } = useTranslation();
  const rows: [string, string, string][] = [
    [t('cashDesks.openingFloat'), openingFloat, ''],
    [t('cashDesks.cashIn'), cashIn, '+'],
    [t('cashDesks.cashOut'), cashOut, '−'],
  ];
  return (
    <dl className="space-y-1 text-body">
      {rows.map(([label, value, sign]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="text-text-secondary">{label}</dt>
          <dd className="text-foreground">
            {sign && Number(value) !== 0 ? `${sign} ` : ''}
            <Amount value={value} />
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border font-semibold">
        <dt className="text-foreground">{t('cashDesks.expected')}</dt>
        <dd className="text-foreground">
          <Amount value={expected} />
        </dd>
      </div>
    </dl>
  );
}

/** The payments and expenses a desk (or a handover) is made of. */
function Movements({ payments, expenses }: { payments: CashPaymentLine[]; expenses: CashExpenseLine[] }) {
  const { t } = useTranslation();
  if (!payments.length && !expenses.length) return <p className="text-caption text-text-secondary">{t('cashDesks.noMovements')}</p>;
  return (
    <ul className="divide-y divide-border text-body">
      {payments.map((p) => (
        <li key={p.id} className="py-1.5 flex items-center justify-between gap-3">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="text-foreground">{p.childName}</span>{' '}
            <span className="text-caption text-text-secondary" dir="ltr">{p.receiptNumber}</span>
            {p.isCorrection && <span className="text-caption text-warning"> · {t('cashDesks.refund')}</span>}
            <span className="block text-micro text-text-secondary">{formatDate(p.date)}</span>
          </span>
          <Amount value={p.amount} className={Number(p.amount) < 0 ? 'text-danger' : 'text-foreground'} />
        </li>
      ))}
      {expenses.map((e) => (
        <li key={e.id} className="py-1.5 flex items-center justify-between gap-3">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="text-foreground">{e.description}</span>
            <span className="text-caption text-text-secondary"> · {t('cashDesks.expenseLine')}</span>
            <span className="block text-micro text-text-secondary">{formatDate(e.date)}</span>
          </span>
          <Amount value={-Number(e.amount)} className="text-danger" />
        </li>
      ))}
    </ul>
  );
}

// ─── The handover slip ───

function SlipDocument({ id }: { id: string }) {
  const { t } = useTranslation();
  const { data: h, isLoading, isError, error } = useCashHandover(id);
  if (isLoading) return <ListSkeleton rows={3} />;
  if (isError || !h) return <ErrorAlert message={errorMessage(error, t)} />;
  const diff = Number(h.difference);
  const line = (label: string, value: string, strong = false) => (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'font-semibold' : ''}`}>
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-foreground">
        <Amount value={value} />
      </dd>
    </div>
  );
  return (
    <div className="receipt-document space-y-4 text-body text-foreground">
      <div className="text-center">
        <p className="text-subsection font-semibold">{h.schoolName}</p>
        <p className="font-medium">{t(h.kind === 'deposit' ? 'cashDesks.slip.depositTitle' : 'cashDesks.slip.title')}</p>
        <p className="text-caption text-text-secondary">{formatDateTime(h.createdAt)}</p>
      </div>
      <dl className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-secondary">{t('cashDesks.slip.cashier')}</dt>
          <dd>{h.cashierName}</dd>
        </div>
        {h.kind === 'handover' && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">{t('cashDesks.slip.collectedBy')}</dt>
            <dd>{h.collectedByName}</dd>
          </div>
        )}
      </dl>
      <Breakdown openingFloat={h.openingFloat} cashIn={h.cashIn} cashOut={h.cashOut} expected={h.expectedAmount} />
      <dl className="space-y-1">
        {line(t('cashDesks.counted'), h.countedAmount, true)}
        <div className="flex items-center justify-between gap-3 font-semibold">
          <dt className="text-text-secondary">{t('cashDesks.difference')}</dt>
          <dd className={diff < 0 ? 'text-danger' : diff > 0 ? 'text-warning' : 'text-success'}>
            {diff === 0 ? t('cashDesks.noDifference') : <Amount value={h.difference} />}
          </dd>
        </div>
        {h.reason && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-text-secondary">{t('cashDesks.reason')}</dt>
            <dd className="text-end [overflow-wrap:anywhere]">{h.reason}</dd>
          </div>
        )}
        {line(t('cashDesks.taken'), h.taken, true)}
        {line(t('cashDesks.floatLeft'), h.floatLeft)}
        {h.note && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-text-secondary">{t('cashDesks.note')}</dt>
            <dd className="text-end [overflow-wrap:anywhere]">{h.note}</dd>
          </div>
        )}
      </dl>
      <div>
        <p className="font-medium mb-1">{t('cashDesks.slip.movements')}</p>
        <Movements payments={h.payments} expenses={h.expenses} />
      </div>
      <div className="grid grid-cols-2 gap-6 pt-8 text-caption text-text-secondary">
        <p className="border-t border-border pt-1">{t('cashDesks.slip.signCashier')}</p>
        {h.kind === 'handover' && <p className="border-t border-border pt-1">{t('cashDesks.slip.signCollector')}</p>}
      </div>
    </div>
  );
}

function SlipDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const ref = React.useRef<HTMLDivElement>(null);
  function print() {
    if (!ref.current) return;
    printDocument(ref.current, { fileName: t('cashDesks.slip.title'), language: i18n.language, direction: i18n.language === 'ar' ? 'rtl' : 'ltr' });
  }
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('cashDesks.slip.title')}</DialogTitle>
          <DialogDescription>{t('cashDesks.slip.description')}</DialogDescription>
        </DialogHeader>
        <div ref={ref} className="max-h-[60vh] overflow-y-auto">{id && <SlipDocument id={id} />}</div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.close')}</Button>
          <Button type="button" onClick={print}>
            <Printer className="w-4 h-4" />
            {t('cashDesks.slip.print')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Counting a desk ───

function CollectForm({ desk, own, onDone, onCancel }: { desk: CashDeskDetail; own: boolean; onDone: (handoverId: string) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const collect = useCollectCashDesk();
  const [counted, setCounted] = React.useState('');
  const [floatLeft, setFloatLeft] = React.useState('0');
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const expected = Number(desk.expected);
  const countedN = counted === '' ? null : Number(counted);
  const floatN = Number(floatLeft || 0);
  // Cents: no stray 0.1 + 0.2.
  const diff = countedN === null ? null : Math.round((countedN - expected) * 100) / 100;
  const floatTooHigh = countedN !== null && floatN > countedN;
  const needsReason = diff !== null && diff !== 0;
  const canSubmit = countedN !== null && countedN >= 0 && floatN >= 0 && !floatTooHigh && (!needsReason || reason.trim().length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || countedN === null) return;
    setError(null);
    try {
      const { id } = await collect.mutateAsync({
        userId: desk.userId,
        countedAmount: countedN,
        floatLeft: floatN,
        expectedAmount: expected,
        reason: needsReason ? reason.trim() : null,
        note: note.trim() || null,
      });
      onDone(id);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Breakdown openingFloat={desk.openingFloat} cashIn={desk.cashIn} cashOut={desk.cashOut} expected={desk.expected} />
      <details className="text-body">
        <summary className="cursor-pointer text-caption text-primary">
          {t('cashDesks.showMovements', { count: desk.payments.length + desk.expenses.length })}
        </summary>
        <div className="max-h-[30vh] overflow-y-auto mt-1">
          <Movements payments={desk.payments} expenses={desk.expenses} />
        </div>
      </details>
      <div className="grid grid-cols-2 gap-x-3">
        <FormField label={t('cashDesks.counted')} htmlFor="cash-counted" required helperText={t('cashDesks.countedHint')}>
          <Input id="cash-counted" type="number" min="0" step="0.01" inputMode="decimal" className="font-mono" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0.00" autoFocus />
        </FormField>
        <FormField label={t('cashDesks.floatLeft')} htmlFor="cash-float" helperText={t('cashDesks.floatLeftHint')} error={floatTooHigh ? t('cashDesks.floatTooHigh') : undefined}>
          <Input id="cash-float" type="number" min="0" step="0.01" inputMode="decimal" className="font-mono" value={floatLeft} onChange={(e) => setFloatLeft(e.target.value)} />
        </FormField>
      </div>
      {diff !== null && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-body font-medium ${diff === 0 ? 'bg-success-muted text-success' : diff < 0 ? 'bg-danger-muted text-danger' : 'bg-warning-muted text-warning'}`}
        >
          {diff === 0 ? (
            t('cashDesks.noDifference')
          ) : (
            <>
              {t(diff < 0 ? 'cashDesks.missing' : 'cashDesks.surplus')} <Amount value={Math.abs(diff)} />
            </>
          )}
          {!floatTooHigh && countedN !== null && (
            <span className="block text-caption font-normal">
              {t(own ? 'cashDesks.youDeposit' : 'cashDesks.youTake')} <Amount value={Math.round((countedN - floatN) * 100) / 100} />
            </span>
          )}
        </p>
      )}
      {needsReason && (
        <FormField label={t('cashDesks.reason')} htmlFor="cash-reason" required helperText={t('cashDesks.reasonHint')}>
          <Input id="cash-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      )}
      <FormField label={t('cashDesks.note')} htmlFor="cash-note">
        <Input id="cash-note" value={note} maxLength={500} placeholder={t(own ? 'cashDesks.notePlaceholderDeposit' : 'cashDesks.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <p className="text-caption text-text-secondary">{t('cashDesks.final')}</p>
      <ErrorAlert message={error} />
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={!canSubmit || collect.isPending}>
          {collect.isPending ? t('common.loading') : t(own ? 'cashDesks.confirmDeposit' : 'cashDesks.confirmCollect')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CollectDialog({ userId, own, onClose, onDone }: { userId: string | null; own: boolean; onClose: () => void; onDone: (handoverId: string) => void }) {
  const { t } = useTranslation();
  const { data: desk, isLoading, isError, error } = useCashDesk(userId);
  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{own ? t('cashDesks.depositTitle') : t('cashDesks.collectTitle', { name: desk?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t(own ? 'cashDesks.depositDescription' : 'cashDesks.collectDescription')}</DialogDescription>
        </DialogHeader>
        {isLoading && <ListSkeleton rows={3} />}
        {isError && <ErrorAlert message={errorMessage(error, t)} />}
        {/* Remounted when the desk's amount changes: the count starts again. */}
        {desk && <CollectForm key={`${desk.userId}:${desk.expected}`} desk={desk} own={own} onDone={onDone} onCancel={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

// ─── When a desk is due ───

function SettingsDialog({ open, onOpenChange, settings }: { open: boolean; onOpenChange: (o: boolean) => void; settings: CashSettings }) {
  const { t } = useTranslation();
  const save = useUpdateCashSettings();
  const [amount, setAmount] = React.useState(String(Number(settings.cashAlertAmount)));
  const [days, setDays] = React.useState(String(settings.cashAlertDays));
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setAmount(String(Number(settings.cashAlertAmount)));
    setDays(String(settings.cashAlertDays));
    setError(null);
  }, [open, settings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ cashAlertAmount: Number(amount || 0), cashAlertDays: Math.round(Number(days || 0)) });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t('cashDesks.settings.title')}</DialogTitle>
          <DialogDescription>{t('cashDesks.settings.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label={t('cashDesks.settings.amount')} htmlFor="cash-alert-amount" helperText={t('cashDesks.settings.zeroHint')}>
            <Input id="cash-alert-amount" type="number" min="0" step="1" className="font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <FormField label={t('cashDesks.settings.days')} htmlFor="cash-alert-days" helperText={t('cashDesks.settings.zeroHint')}>
            <Input id="cash-alert-days" type="number" min="0" max="365" step="1" value={days} onChange={(e) => setDays(e.target.value)} />
          </FormField>
          <ErrorAlert message={error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── The tab ───

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-subsection font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MyDesk({ onDeposit }: { onDeposit?: () => void }) {
  const { t } = useTranslation();
  const { data: desk, isLoading, isError, error } = useMyCashDesk();
  const empty = !!desk && Number(desk.expected) === 0 && desk.payments.length + desk.expenses.length === 0;
  return (
    <Card
      title={t('cashDesks.mine')}
      action={
        onDeposit && desk && !empty ? (
          <Button type="button" size="sm" onClick={onDeposit}>
            <Banknote className="w-4 h-4" />
            {t('cashDesks.deposit')}
          </Button>
        ) : undefined
      }
    >
      {isLoading && <ListSkeleton rows={2} />}
      {isError && <ErrorAlert message={errorMessage(error, t)} />}
      {desk && (
        <>
          {desk.due && (
            <p className="flex items-center gap-2 rounded-md bg-warning-muted text-warning px-3 py-2 text-body">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {t(onDeposit ? 'cashDesks.dueMineDirector' : 'cashDesks.dueMine')}
            </p>
          )}
          <Breakdown openingFloat={desk.openingFloat} cashIn={desk.cashIn} cashOut={desk.cashOut} expected={desk.expected} />
          <p className="text-caption text-text-secondary">
            {t('cashDesks.cashOnly')}
            {desk.lastHandoverAt && ` ${t('cashDesks.since', { date: formatDateTime(desk.lastHandoverAt) })}`}
          </p>
          {!empty && (
            <details>
              <summary className="cursor-pointer text-caption text-primary">
                {t('cashDesks.showMovements', { count: desk.payments.length + desk.expenses.length })}
              </summary>
              <div className="max-h-[40vh] overflow-y-auto mt-1">
                <Movements payments={desk.payments} expenses={desk.expenses} />
              </div>
            </details>
          )}
        </>
      )}
    </Card>
  );
}

function AllDesks({ meId, isDirector, onCollect }: { meId: string | undefined; isDirector: boolean; onCollect: (desk: CashDesk) => void }) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { data, isLoading, isError, error } = useCashDesks();
  const [editing, setEditing] = React.useState(false);
  const desks = data?.desks ?? [];
  return (
    <Card
      title={t('cashDesks.all')}
      action={
        data && can('settings', 'edit') ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Settings className="w-4 h-4" />
            {t('cashDesks.settings.open')}
          </Button>
        ) : undefined
      }
    >
      {isLoading && <ListSkeleton rows={3} />}
      {isError && <ErrorAlert message={errorMessage(error, t)} />}
      {data && desks.length === 0 && <p className="text-caption text-text-secondary">{t('cashDesks.noDesks')}</p>}
      {desks.length > 0 && (
        <ul className="divide-y divide-border">
          {desks.map((d) => {
            const own = d.userId === meId;
            const empty = Number(d.expected) === 0 && d.paymentsCount + d.expensesCount === 0;
            return (
              <li key={d.userId} className="py-2 flex items-center gap-3 flex-wrap" data-testid={`cash-desk-${d.userId}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-foreground flex items-center gap-2 flex-wrap">
                    {d.name}
                    {own && <span className="text-caption text-text-secondary">({t('cashDesks.you')})</span>}
                    {d.due && <StatusBadge variant="warning">{t('cashDesks.due')}</StatusBadge>}
                    {!d.isActive && <StatusBadge variant="neutral">{t('cashDesks.inactive')}</StatusBadge>}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {d.lastHandoverAt ? t('cashDesks.lastHandover', { date: formatDate(d.lastHandoverAt) }) : t('cashDesks.neverCollected')}
                    {d.paymentsCount > 0 && ` · ${t('cashDesks.paymentsCount', { count: d.paymentsCount })}`}
                  </p>
                </div>
                <Amount value={d.expected} className="text-body font-semibold text-foreground" />
                {/* One's own desk is collected by someone else; a director deposits theirs. */}
                {(!own || isDirector) && (
                  <Button type="button" size="sm" variant={empty ? 'secondary' : 'primary'} disabled={empty} onClick={() => onCollect(d)}>
                    {t(own ? 'cashDesks.deposit' : 'cashDesks.collect')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && <SettingsDialog open={editing} onOpenChange={setEditing} settings={data.settings} />}
    </Card>
  );
}

function History({ all, onOpen }: { all: boolean; onOpen: (h: CashHandover) => void }) {
  const { t } = useTranslation();
  const { data: list = [], isLoading, isError, error } = useCashHandovers();
  return (
    <Card title={t(all ? 'cashDesks.history' : 'cashDesks.myHistory')}>
      {isLoading && <ListSkeleton rows={2} />}
      {isError && <ErrorAlert message={errorMessage(error, t)} />}
      {!isLoading && !isError && list.length === 0 && <p className="text-caption text-text-secondary">{t('cashDesks.noHistory')}</p>}
      {list.length > 0 && (
        <ul className="divide-y divide-border">
          {list.map((h) => {
            const diff = Number(h.difference);
            return (
              <li key={h.id}>
                <button type="button" onClick={() => onOpen(h)} className="w-full py-2 flex items-center gap-3 flex-wrap text-start hover:bg-subtle rounded-md px-1">
                  <span className="min-w-0 flex-1">
                    <span className="block text-body text-foreground">
                      {h.kind === 'deposit'
                        ? t('cashDesks.historyDeposit', { cashier: h.cashierName })
                        : t('cashDesks.historyHandover', { cashier: h.cashierName, collector: h.collectedByName })}
                    </span>
                    <span className="block text-micro text-text-secondary">{formatDateTime(h.createdAt)}</span>
                    {h.reason && <span className="block text-caption text-text-secondary [overflow-wrap:anywhere]">{h.reason}</span>}
                  </span>
                  {diff !== 0 && (
                    <StatusBadge variant={diff < 0 ? 'danger' : 'warning'}>
                      {t(diff < 0 ? 'cashDesks.missing' : 'cashDesks.surplus')} <Amount value={Math.abs(diff)} className="ms-1" />
                    </StatusBadge>
                  )}
                  <Amount value={h.taken} className="text-body font-semibold text-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Payments → Caisses: my desk, the others' (collectors), and past handovers. */
export function CashDesksTab() {
  const { user } = useAuth();
  const { can, canCollectCash, isDirector } = usePermissions();
  const [collecting, setCollecting] = React.useState<string | null>(null);
  const [slip, setSlip] = React.useState<string | null>(null);
  const hasDesk = can('collections', 'edit');
  // A director with nobody above deposits their own desk.
  const depositOwn = isDirector && user?.role === 'admin';

  return (
    <div className="space-y-4">
      {hasDesk && <MyDesk onDeposit={depositOwn ? () => setCollecting(user!.id) : undefined} />}
      {canCollectCash && <AllDesks meId={user?.id} isDirector={depositOwn} onCollect={(d) => setCollecting(d.userId)} />}
      <History all={canCollectCash} onOpen={(h) => setSlip(h.id)} />
      <CollectDialog
        userId={collecting}
        own={collecting === user?.id}
        onClose={() => setCollecting(null)}
        onDone={(id) => {
          setCollecting(null);
          setSlip(id);
        }}
      />
      <SlipDialog id={slip} onClose={() => setSlip(null)} />
    </div>
  );
}
