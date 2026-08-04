import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Plus, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, DataTable, type Column } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { FormSelect } from '@/components/forms';
import { Input } from '@/components/ui/Input';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import {
  useBranches,
  useBranchCalendar,
  useCreateBranchCalendar,
  useUpdateBranchCalendar,
  useDeleteBranchCalendar,
  type BranchCalendarEntry,
} from '@/hooks/useBranchCalendar';

// ─── Validation Schema ────────────────────────────────────────────────────────

const calendarFormSchema = z
  .object({
    label: z.string().min(1, 'Label is required').max(100, 'Label must be 100 characters or less'),
    period_start: z.string().min(1, 'Period start is required'),
    period_end: z.string().min(1, 'Period end is required'),
    due_date: z.string().min(1, 'Due date is required'),
  })
  .refine(
    (data) => {
      if (!data.period_start || !data.period_end) return true;
      return data.period_end >= data.period_start;
    },
    { message: 'Period end must be on or after period start', path: ['period_end'] },
  )
  .refine(
    (data) => {
      if (!data.period_start || !data.due_date) return true;
      return data.due_date >= data.period_start;
    },
    { message: 'Due date must be on or after period start', path: ['due_date'] },
  );

type CalendarFormValues = z.infer<typeof calendarFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function BranchCalendarPage() {
  const { t } = useTranslation();

  // Data fetching
  const { data: branches, isLoading: branchesLoading } = useBranches();
  const { data: academicYears } = useAcademicYears();

  // Selection state
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState<string>('');

  // Dialog state
  const [formOpen, setFormOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<BranchCalendarEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = React.useState<BranchCalendarEntry | null>(null);

  // Auto-select first branch
  React.useEffect(() => {
    if (!selectedBranchId && branches && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  // Auto-select active academic year
  React.useEffect(() => {
    if (!selectedAcademicYearId && academicYears && academicYears.length > 0) {
      const active = academicYears.find((y) => y.is_active);
      setSelectedAcademicYearId(active?.id ?? academicYears[0].id);
    }
  }, [academicYears, selectedAcademicYearId]);

  // Calendar data
  const { data: calendarEntries, isLoading: entriesLoading } = useBranchCalendar(
    selectedBranchId || undefined,
    selectedAcademicYearId || undefined,
  );

  // Mutations
  const createMutation = useCreateBranchCalendar();
  const updateMutation = useUpdateBranchCalendar();
  const deleteMutation = useDeleteBranchCalendar();

  // Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CalendarFormValues>({
    resolver: zodResolver(calendarFormSchema),
  });

  // Handlers
  function handleOpenCreate() {
    setEditingEntry(null);
    reset({ label: '', period_start: '', period_end: '', due_date: '' });
    setFormOpen(true);
  }

  function handleOpenEdit(entry: BranchCalendarEntry) {
    setEditingEntry(entry);
    reset({
      label: entry.label,
      period_start: entry.periodStart.slice(0, 10),
      period_end: entry.periodEnd.slice(0, 10),
      due_date: entry.dueDate.slice(0, 10),
    });
    setFormOpen(true);
  }

  function handleOpenDelete(entry: BranchCalendarEntry) {
    setDeletingEntry(entry);
    setDeleteOpen(true);
  }

  async function onSubmit(data: CalendarFormValues) {
    if (editingEntry) {
      await updateMutation.mutateAsync({
        branchId: selectedBranchId,
        id: editingEntry.id,
        label: data.label,
        period_start: data.period_start,
        period_end: data.period_end,
        due_date: data.due_date,
      });
    } else {
      await createMutation.mutateAsync({
        branchId: selectedBranchId,
        label: data.label,
        period_start: data.period_start,
        period_end: data.period_end,
        due_date: data.due_date,
        academicYearId: selectedAcademicYearId,
      });
    }
    setFormOpen(false);
  }

  async function handleConfirmDelete() {
    if (!deletingEntry) return;
    await deleteMutation.mutateAsync({
      branchId: selectedBranchId,
      id: deletingEntry.id,
    });
    setDeleteOpen(false);
    setDeletingEntry(null);
  }

  // Table columns
  const columns: Column<BranchCalendarEntry>[] = [
    {
      key: 'label',
      header: t('payments.branchCalendar.columns.label', 'Label'),
      render: (row) => <span className="font-medium">{row.label}</span>,
    },
    {
      key: 'periodStart',
      header: t('payments.branchCalendar.columns.periodStart', 'Period Start'),
      sortable: true,
      render: (row) => formatDate(row.periodStart),
    },
    {
      key: 'periodEnd',
      header: t('payments.branchCalendar.columns.periodEnd', 'Period End'),
      render: (row) => formatDate(row.periodEnd),
    },
    {
      key: 'dueDate',
      header: t('payments.branchCalendar.columns.dueDate', 'Due Date'),
      render: (row) => formatDate(row.dueDate),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(row);
            }}
            aria-label={t('common.edit', 'Edit')}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            aria-label={t('common.delete', 'Delete')}
          >
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  // Branch and year select options
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const yearOptions = (academicYears ?? []).map((y) => ({ value: y.id, label: y.name }));

  const isReady = selectedBranchId && selectedAcademicYearId;
  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-h2 font-semibold text-text-heading">
              {t('payments.branchCalendar.title')}
            </h1>
            <p className="text-caption text-text-secondary mt-0.5">
              {t('payments.branchCalendar.description')}
            </p>
          </div>
        </div>
        {isReady && (
          <Button onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            {t('payments.branchCalendar.addEntry', 'Add Period')}
          </Button>
        )}
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-64">
          <FormSelect
            label={t('payments.branchCalendar.selectBranch', 'Branch')}
            name="branch"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            options={branchOptions}
            placeholder={t('payments.branchCalendar.selectBranchPlaceholder', 'Select branch')}
          />
        </div>
        <div className="w-full sm:w-64">
          <FormSelect
            label={t('payments.branchCalendar.selectYear', 'Academic Year')}
            name="academicYear"
            value={selectedAcademicYearId}
            onChange={(e) => setSelectedAcademicYearId(e.target.value)}
            options={yearOptions}
            placeholder={t('payments.branchCalendar.selectYearPlaceholder', 'Select year')}
          />
        </div>
      </div>

      {/* Content */}
      {branchesLoading ? (
        <LoadingSkeleton />
      ) : !branches || branches.length === 0 ? (
        <EmptyState message={t('payments.branchCalendar.noBranch', 'No branches found. Please create a branch first.')} />
      ) : !isReady ? (
        <EmptyState message={t('payments.branchCalendar.selectPrompt', 'Select a branch and academic year to view calendar entries.')} />
      ) : entriesLoading ? (
        <LoadingSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={calendarEntries ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage={t('payments.branchCalendar.noEntries', 'No calendar entries found for this branch and year.')}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry
                ? t('payments.branchCalendar.editEntry', 'Edit Calendar Entry')
                : t('payments.branchCalendar.createEntry', 'New Calendar Entry')}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? t('payments.branchCalendar.editDescription', 'Update the period details below.')
                : t('payments.branchCalendar.createDescription', 'Define a new billing period for this branch.')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('payments.branchCalendar.fields.label', 'Label')}
              placeholder={t('payments.branchCalendar.fields.labelPlaceholder', 'e.g. Trimester 1')}
              error={errors.label?.message}
              {...register('label')}
            />

            <Input
              type="date"
              label={t('payments.branchCalendar.fields.periodStart', 'Period Start')}
              error={errors.period_start?.message}
              {...register('period_start')}
            />

            <Input
              type="date"
              label={t('payments.branchCalendar.fields.periodEnd', 'Period End')}
              error={errors.period_end?.message}
              {...register('period_end')}
            />

            <Input
              type="date"
              label={t('payments.branchCalendar.fields.dueDate', 'Due Date')}
              error={errors.due_date?.message}
              {...register('due_date')}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormOpen(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating
                  ? t('common.loading', 'Saving...')
                  : editingEntry
                    ? t('common.save', 'Save')
                    : t('common.create', 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('payments.branchCalendar.deleteTitle', 'Delete Calendar Entry')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'payments.branchCalendar.deleteConfirmation',
                'Are you sure you want to delete "{{label}}"? This action cannot be undone.',
                { label: deletingEntry?.label ?? '' },
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t('common.loading', 'Deleting...')
                : t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-hover rounded-md" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-8 text-center">
      <p className="text-body text-text-secondary">{message}</p>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
