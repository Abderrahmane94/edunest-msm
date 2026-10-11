import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { PlusCircle, X } from 'lucide-react';
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
  StatusBadge,
  useConfirm,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { cn } from '@/lib/utils';
import { formatDZD } from '@/lib/formatters';
import { useClassroomFees } from '@/hooks/useBranchFeeClassrooms';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import {
  useAssignFee,
  useBranchFees,
  useChangeFeeScope,
  useCreateBranchFee,
  type AssignFeeResult,
  type BranchFee,
} from '@/hooks/useBranchFees';

interface ClassroomInfo {
  id: string;
  name: string;
  /** Children in the class now. */
  childCount: number;
  /** Only a class of the current year can have its children billed now. */
  isCurrentYear: boolean;
  /** A closed year's class is looked at, not changed. */
  readOnly: boolean;
}

type Mode = 'existing' | 'new';

/**
 * Adds a fee to a class: an existing fee (not already the whole school's), or
 * a new one made here. The fee is linked to the class (offered when enrolling
 * its children) and, for a class of the current year, can be billed now to the
 * children already in it.
 */
function AddClassroomFeeDialog({
  open,
  onOpenChange,
  classroom,
  linkedIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: ClassroomInfo;
  linkedIds: Set<string>;
}) {
  const { t, i18n } = useTranslation();
  const { branchId } = useDefaultBranch();
  const { data: fees = [] } = useBranchFees(branchId);
  const createFee = useCreateBranchFee(branchId);
  const assignFee = useAssignFee(branchId);
  const changeScope = useChangeFeeScope(branchId);
  // Fees that can be added: active, not whole-school (they already apply), not linked yet.
  const available = fees.filter((f) => f.isActive && !f.appliesToSchool && !linkedIds.has(f.id));
  const canBill = classroom.isCurrentYear && classroom.childCount > 0;

  const [mode, setMode] = React.useState<Mode>('existing');
  const [feeId, setFeeId] = React.useState('');
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [monthly, setMonthly] = React.useState(false);
  const [dueDay, setDueDay] = React.useState('5');
  const [grace, setGrace] = React.useState('5');
  const [bill, setBill] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AssignFeeResult | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setMode(available.length ? 'existing' : 'new');
    setFeeId('');
    setName('');
    setAmount('');
    setMonthly(false);
    setDueDay('5');
    setGrace('5');
    setBill(true);
    setError(null);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pending = createFee.isPending || assignFee.isPending || changeScope.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let fee: BranchFee | undefined;
    try {
      if (mode === 'existing') {
        fee = available.find((f) => f.id === feeId);
        if (!fee) {
          setError(t('classrooms.fees.add.pickFee'));
          return;
        }
      } else {
        const value = Number(amount);
        if (!name.trim() || amount === '' || Number.isNaN(value) || value < 0) {
          setError(t('classrooms.fees.add.newInvalid'));
          return;
        }
        fee = await createFee.mutateAsync({
          name: name.trim(),
          amount: value,
          ...(monthly
            ? { billingCycle: 'monthly' as const, billingDueDay: Number(dueDay), gracePeriodDays: Number(grace) }
            : {}),
        });
      }

      if (canBill && bill) {
        // Links the fee to the class and bills the children already in it.
        setResult(await assignFee.mutateAsync({ feeId: fee.id, target: 'classrooms', classroomIds: [classroom.id] }));
      } else {
        // Only links it: offered when enrolling, billed to no one yet.
        await changeScope.mutateAsync({
          feeId: fee.id,
          scope: 'classrooms',
          classroomIds: [...new Set([...(fee.classrooms ?? []).map((c) => c.id), classroom.id])],
          outOfScope: 'keep',
        });
        onOpenChange(false);
      }
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  const feeLabel = (f: BranchFee) =>
    `${f.name} — ${formatDZD(Number(f.amount), i18n.language)}${f.billingCycle === 'monthly' ? ` ${t('children.wizard.fees.perMonth')}` : f.billingCycle === 'custom' ? ` ${t('children.wizard.fees.perPeriod')}` : ''}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('classrooms.fees.add.title', { name: classroom.name })}</DialogTitle>
          <DialogDescription>{t('classrooms.fees.add.description')}</DialogDescription>
        </DialogHeader>

        {result ? (
          <>
            <ul className="text-body text-foreground space-y-1 list-disc ps-5">
              <li>{t('classrooms.fees.add.resultLinked', { name: classroom.name })}</li>
              <li>{t('payments.fees.assign.resultApplied', { count: result.applied })}</li>
              {result.skipped > 0 && <li>{t('payments.fees.assign.resultSkipped', { count: result.skipped })}</li>}
              {result.enrolled > 0 && <li>{t('payments.fees.assign.resultEnrolled', { count: result.enrolled })}</li>}
            </ul>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div role="tablist" className="grid grid-cols-2 gap-1 p-1 bg-subtle rounded-lg">
              {(['existing', 'new'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  disabled={m === 'existing' && available.length === 0}
                  onClick={() => { setMode(m); setError(null); }}
                  className={cn(
                    'px-2 py-1.5 rounded-md text-caption font-medium disabled:opacity-50',
                    mode === m ? 'bg-card text-foreground shadow-sm' : 'text-text-secondary hover:text-foreground',
                  )}
                >
                  {t(`classrooms.fees.add.mode.${m}`)}
                </button>
              ))}
            </div>

            {mode === 'existing' ? (
              <FormField label={t('classrooms.fees.add.fee')} htmlFor="cf-fee" required>
                <select
                  id="cf-fee"
                  value={feeId}
                  onChange={(e) => setFeeId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-2 text-body text-foreground"
                >
                  <option value="">{t('classrooms.fees.add.pickPlaceholder')}</option>
                  {available.map((f) => <option key={f.id} value={f.id}>{feeLabel(f)}</option>)}
                </select>
              </FormField>
            ) : (
              <>
                <FormField label={t('payments.fees.fields.name')} htmlFor="cf-name" required>
                  <Input id="cf-name" value={name} maxLength={100} placeholder={t('payments.fees.fields.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
                </FormField>
                <FormField label={t('payments.fees.fields.amount')} htmlFor="cf-amount" required>
                  <Input id="cf-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </FormField>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border text-primary" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} />
                  <span className="text-body text-foreground">{t('classrooms.fees.add.monthly')}</span>
                </label>
                {monthly && (
                  <div className="grid grid-cols-2 gap-x-3">
                    <FormField label={t('classrooms.fees.add.dueDay')} htmlFor="cf-due" required>
                      <Input id="cf-due" type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
                    </FormField>
                    <FormField label={t('classrooms.fees.add.grace')} htmlFor="cf-grace" required>
                      <Input id="cf-grace" type="number" min={0} max={60} value={grace} onChange={(e) => setGrace(e.target.value)} />
                    </FormField>
                  </div>
                )}
                <p className="text-caption text-text-secondary">{t('classrooms.fees.add.customHint')}</p>
              </>
            )}

            {canBill ? (
              <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border p-3">
                <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-border text-primary" checked={bill} onChange={(e) => setBill(e.target.checked)} />
                <span className="text-body text-foreground">
                  {t('classrooms.fees.add.bill', { count: classroom.childCount })}
                  <span className="block text-caption text-text-secondary">{t('classrooms.fees.add.billHint')}</span>
                </span>
              </label>
            ) : (
              <p className="text-caption text-text-secondary">
                {t(classroom.isCurrentYear ? 'classrooms.fees.add.noChildren' : 'classrooms.fees.add.otherYear')}
              </p>
            )}

            <ErrorAlert message={error} />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={pending}>{pending ? t('common.loading') : t('classrooms.fees.add.submit')}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Fees of a classroom: those linked to it plus whole-school fees. Fees can be
 * added here, and a linked one removed (charges already billed are kept).
 */
export function ClassroomFeesSection({ classroom }: { classroom: ClassroomInfo }) {
  const { t, i18n } = useTranslation();
  const { branchId } = useDefaultBranch();
  const { data: fees, isLoading, isError, error } = useClassroomFees(classroom.id);
  const { data: branchFees = [] } = useBranchFees(branchId);
  const changeScope = useChangeFeeScope(branchId);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [adding, setAdding] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const linkedIds = new Set((fees ?? []).filter((f) => !f.appliesToSchool).map((f) => f.id));

  function cycleLabel(fee: BranchFee): string {
    if (fee.billingCycle === 'monthly') return t('payments.branchConfig.cycleMonthly');
    if (fee.billingCycle === 'custom') return t('payments.branchConfig.cycleCustom');
    return t('children.fees.oneShot');
  }

  async function handleRemove(fee: BranchFee) {
    const ok = await confirm({
      title: t('classrooms.fees.remove.title', { fee: fee.name, name: classroom.name }),
      description: t('classrooms.fees.remove.description'),
      confirmLabel: t('classrooms.fees.remove.action'),
    });
    if (!ok) return;
    setActionError(null);
    // The fee's other classes keep it; with none left, it is assigned by hand only.
    const others = (branchFees.find((f) => f.id === fee.id)?.classrooms ?? []).map((c) => c.id).filter((id) => id !== classroom.id);
    try {
      await changeScope.mutateAsync({
        feeId: fee.id,
        scope: others.length ? 'classrooms' : 'none',
        ...(others.length ? { classroomIds: others } : {}),
        outOfScope: 'keep',
      });
    } catch (err) {
      setActionError(errorMessage(err, t));
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      {confirmDialog}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-subsection font-semibold text-text-heading">{t('classrooms.fees.title')}</h2>
        {!classroom.readOnly && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <PlusCircle className="w-4 h-4" />
            {t('classrooms.fees.add.button')}
          </Button>
        )}
      </div>

      <ErrorAlert message={actionError} />

      {isLoading ? (
        <div className="animate-pulse h-16 bg-subtle rounded-md" />
      ) : isError ? (
        <p className="text-body text-danger">{errorMessage(error, t)}</p>
      ) : !fees || fees.length === 0 ? (
        <p className="text-body text-text-secondary">{t('classrooms.fees.empty')}</p>
      ) : (
        <div className="space-y-2">
          {fees.map((fee) => (
            <div
              key={fee.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-subtle rounded-lg px-3 py-2"
            >
              <div>
                <span className="text-body font-medium text-foreground">{fee.name}</span>
                <p className="text-caption text-text-secondary">{cycleLabel(fee)}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge variant={fee.appliesToSchool ? 'sent' : 'draft'}>
                  {fee.appliesToSchool ? t('payments.fees.scopeSchool') : t('classrooms.fees.linked')}
                </StatusBadge>
                <span className="text-body font-medium text-foreground">
                  {formatDZD(Number(fee.amount), i18n.language)}
                </span>
                {!fee.appliesToSchool && !classroom.readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('classrooms.fees.remove.action')}
                    title={t('classrooms.fees.remove.action')}
                    disabled={changeScope.isPending}
                    onClick={() => handleRemove(fee)}
                  >
                    <X className="w-4 h-4 text-danger" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!classroom.readOnly && (
        <AddClassroomFeeDialog open={adding} onOpenChange={setAdding} classroom={classroom} linkedIds={linkedIds} />
      )}
    </div>
  );
}
