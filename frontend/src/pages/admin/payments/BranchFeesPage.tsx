import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Edit2, DollarSign, Users } from 'lucide-react';
import {
  Button,
  CreateButton,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { formatDZD } from '@/lib/formatters';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import { useChildren } from '@/hooks/useChildren';
import { useClassrooms } from '@/hooks/useClassrooms';
import {
  useBranchFees,
  useCreateBranchFee,
  useUpdateBranchFee,
  useDeleteBranchFee,
  useAssignFee,
  type BranchFee,
  type AssignFeeResult,
} from '@/hooks/useBranchFees';

// ─── Create/Edit Fee Dialog ──────────────────────────────────────────────────

function FeeDialog({
  open,
  onOpenChange,
  branchId,
  editingFee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  editingFee: BranchFee | null;
}) {
  const { t } = useTranslation();
  const createFee = useCreateBranchFee(branchId);
  const updateFee = useUpdateBranchFee(branchId);

  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (editingFee) {
      setName(editingFee.name);
      setAmount(editingFee.amount);
    } else {
      setName('');
      setAmount('');
    }
    setErrors({});
  }, [editingFee, open]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length > 100) {
      newErrors.name = t('payments.fees.errors.nameRequired');
    }
    const num = Number(amount);
    if (isNaN(num) || num < 0 || num > 9_999_999.99) {
      newErrors.amount = t('payments.fees.errors.amountInvalid');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (editingFee) {
        await updateFee.mutateAsync({
          id: editingFee.id,
          name: name.trim(),
          amount: Number(amount),
        });
      } else {
        await createFee.mutateAsync({
          name: name.trim(),
          amount: Number(amount),
        });
      }
      onOpenChange(false);
    } catch {
      // handled by react-query
    }
  }

  const isPending = createFee.isPending || updateFee.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {editingFee
              ? t('payments.fees.editTitle')
              : t('payments.fees.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('payments.fees.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label={t('payments.fees.fields.name')}
            htmlFor="fee-name"
            error={errors.name}
            required
          >
            <Input
              id="fee-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('payments.fees.fields.namePlaceholder')}
              maxLength={100}
            />
          </FormField>

          <FormField
            label={t('payments.fees.fields.amount')}
            htmlFor="fee-amount"
            error={errors.amount}
            required
          >
            <Input
              id="fee-amount"
              type="number"
              step="0.01"
              min="0"
              max="9999999.99"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Fee Dialog ───────────────────────────────────────────────────────

function AssignFeeDialog({
  open,
  onOpenChange,
  branchId,
  fee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  fee: BranchFee | null;
}) {
  const { t } = useTranslation();
  const assignFee = useAssignFee(branchId);
  const { data: childrenData } = useChildren({ pageSize: 100 });
  const { data: classrooms } = useClassrooms();

  const [targetType, setTargetType] = React.useState<'children' | 'classrooms' | 'school'>('school');
  const [selectedChildIds, setSelectedChildIds] = React.useState<string[]>([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = React.useState<string[]>([]);
  const [childSearch, setChildSearch] = React.useState('');
  const [result, setResult] = React.useState<AssignFeeResult | null>(null);

  React.useEffect(() => {
    if (open) {
      setTargetType('school');
      setSelectedChildIds([]);
      setSelectedClassroomIds([]);
      setChildSearch('');
      setResult(null);
    }
  }, [open]);

  async function handleAssign() {
    if (!fee) return;

    try {
      const res = await assignFee.mutateAsync({
        feeId: fee.id,
        target: targetType,
        childIds: targetType === 'children' ? selectedChildIds : undefined,
        classroomIds: targetType === 'classrooms' ? selectedClassroomIds : undefined,
      });
      setResult(res);
    } catch {
      // handled by react-query
    }
  }

  const childOptions = (childrenData?.children ?? []).map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const filteredChildOptions = React.useMemo(() => {
    if (!childSearch.trim()) return childOptions;
    const query = childSearch.toLowerCase().trim();
    return childOptions.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [childOptions, childSearch]);

  const classroomOptions = (classrooms ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const targetOptions = [
    { value: 'school', label: t('payments.fees.assign.targetSchool') },
    { value: 'classrooms', label: t('payments.fees.assign.targetClassrooms') },
    { value: 'children', label: t('payments.fees.assign.targetChildren') },
  ];

  const canSubmit =
    targetType === 'school' ||
    (targetType === 'children' && selectedChildIds.length > 0) ||
    (targetType === 'classrooms' && selectedClassroomIds.length > 0);

  // Success view
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('payments.fees.assign.resultTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 bg-subtle rounded-lg p-4">
            <p className="text-body text-foreground">
              {t('payments.fees.assign.resultApplied', { count: result.applied })}
            </p>
            {result.skipped > 0 && (
              <p className="text-caption text-text-secondary">
                {t('payments.fees.assign.resultSkipped', { count: result.skipped })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('payments.fees.assign.title', { name: fee?.name })}</DialogTitle>
          <DialogDescription>{t('payments.fees.assign.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormSelect
            label={t('payments.fees.assign.targetLabel')}
            name="targetType"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as 'children' | 'classrooms' | 'school')}
            options={targetOptions}
          />

          {targetType === 'children' && (
            <div className="space-y-2">
              <label className="text-label font-medium text-foreground">
                {t('payments.fees.assign.selectChildren')}
              </label>
              <Input
                type="text"
                placeholder={t('payments.fees.assign.searchPlaceholder')}
                value={childSearch}
                onChange={(e) => setChildSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {filteredChildOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-hover cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedChildIds.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChildIds((prev) => [...prev, opt.value]);
                        } else {
                          setSelectedChildIds((prev) => prev.filter((id) => id !== opt.value));
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-body text-foreground">{opt.label}</span>
                  </label>
                ))}
                {filteredChildOptions.length === 0 && (
                  <p className="text-caption text-text-secondary p-2">{t('payments.fees.assign.noChildren')}</p>
                )}
              </div>
              {selectedChildIds.length > 0 && (
                <p className="text-caption text-text-secondary">
                  {t('payments.fees.assign.selectedCount', { count: selectedChildIds.length })}
                </p>
              )}
            </div>
          )}

          {targetType === 'classrooms' && (
            <div className="space-y-2">
              <label className="text-label font-medium text-foreground">
                {t('payments.fees.assign.selectClassrooms')}
              </label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {classroomOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-hover cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedClassroomIds.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClassroomIds((prev) => [...prev, opt.value]);
                        } else {
                          setSelectedClassroomIds((prev) => prev.filter((id) => id !== opt.value));
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-body text-foreground">{opt.label}</span>
                  </label>
                ))}
                {classroomOptions.length === 0 && (
                  <p className="text-caption text-text-secondary p-2">{t('payments.fees.assign.noClassrooms')}</p>
                )}
              </div>
            </div>
          )}

          {targetType === 'school' && (
            <p className="text-body text-text-secondary bg-subtle rounded-lg p-3">
              {t('payments.fees.assign.schoolConfirmation')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAssign} disabled={!canSubmit || assignFee.isPending}>
            {assignFee.isPending ? t('common.loading') : t('payments.fees.assign.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BranchFeesPage() {
  const { t, i18n } = useTranslation();
  const { branchId: selectedBranchId } = useDefaultBranch();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [editingFee, setEditingFee] = React.useState<BranchFee | null>(null);
  const [assigningFee, setAssigningFee] = React.useState<BranchFee | null>(null);

  const { data: fees, isLoading } = useBranchFees(selectedBranchId);
  const deleteFee = useDeleteBranchFee(selectedBranchId);

  function handleEdit(fee: BranchFee) {
    setEditingFee(fee);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditingFee(null);
    setDialogOpen(true);
  }

  function handleAssign(fee: BranchFee) {
    setAssigningFee(fee);
    setAssignDialogOpen(true);
  }

  async function handleDelete(fee: BranchFee) {
    if (window.confirm(t('payments.fees.confirmDelete', { name: fee.name }))) {
      await deleteFee.mutateAsync(fee.id);
    }
  }

  const columns: Column<BranchFee>[] = [
    {
      key: 'name',
      header: t('payments.fees.fields.name'),
      render: (fee) => (
        <span className="font-medium text-foreground">{fee.name}</span>
      ),
    },
    {
      key: 'amount',
      header: t('payments.fees.fields.amount'),
      render: (fee) => (
        <span className="font-medium text-foreground" dir="ltr">
          {formatDZD(Number(fee.amount), i18n.language)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (fee) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleAssign(fee)} title={t('payments.fees.assign.button')}>
            <Users className="w-4 h-4 text-primary" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(fee)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(fee)}
            disabled={deleteFee.isPending}
          >
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-primary" />
          <h1 className="text-heading-md font-semibold text-foreground">
            {t('payments.fees.title')}
          </h1>
        </div>
        <CreateButton
          label={t('payments.fees.create')}
          onClick={handleCreate}
          disabled={!selectedBranchId}
        />
      </div>

      {/* Fees table */}
      <DataTable
        columns={columns}
        data={fees ?? []}
        keyExtractor={(f) => f.id}
        emptyMessage={isLoading ? t('common.loading') : t('payments.fees.empty')}
      />

      {/* Create/Edit Dialog */}
      {selectedBranchId && (
        <FeeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          branchId={selectedBranchId}
          editingFee={editingFee}
        />
      )}

      {/* Assign Fee Dialog */}
      {selectedBranchId && (
        <AssignFeeDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          branchId={selectedBranchId}
          fee={assigningFee}
        />
      )}
    </div>
  );
}
