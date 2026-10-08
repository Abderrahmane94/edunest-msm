import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { formatDateIn } from '@/lib/formatters';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, DataTable, SectionHeader, type Column } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import {
  useBranchCalendar,
  useCreateBranchCalendar,
  useUpdateBranchCalendar,
  useDeleteBranchCalendar,
  type BranchCalendarEntry,
} from '@/hooks/useBranchCalendar';

// ─── Validation Schema ────────────────────────────────────────────────────────

// The messages are translation keys, translated where they are shown.
const V = 'payments.branchCalendar.validation.';

const calendarFormSchema = z
  .object({
    label: z.string().min(1, V + 'labelRequired').max(100, V + 'labelTooLong'),
    period_start: z.string().min(1, V + 'startRequired'),
    period_end: z.string().min(1, V + 'endRequired'),
  })
  .refine(
    (data) => {
      if (!data.period_start || !data.period_end) return true;
      return data.period_end >= data.period_start;
    },
    { message: V + 'endBeforeStart', path: ['period_end'] },
  );

type CalendarFormValues = z.infer<typeof calendarFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function BranchCalendarPage() {
  const { t } = useTranslation();

  // Data fetching
  const { branchId: selectedBranchId } = useDefaultBranch();
  const { data: activeAcademicYear, isLoading: yearLoading } = useActiveAcademicYear();
  const selectedAcademicYearId = activeAcademicYear?.id ?? '';
  // Periods must fall within the academic year.
  const yearMin = activeAcademicYear?.start_date?.slice(0, 10);
  const yearMax = activeAcademicYear?.end_date?.slice(0, 10);

  // Dialog state
  const [formOpen, setFormOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<BranchCalendarEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = React.useState<BranchCalendarEntry | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

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
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CalendarFormValues>({
    resolver: zodResolver(calendarFormSchema),
  });

  // Handlers
  function handleOpenCreate() {
    setEditingEntry(null);
    reset({ label: '', period_start: '', period_end: '' });
    setFormError(null);
    setFormOpen(true);
  }

  function handleOpenEdit(entry: BranchCalendarEntry) {
    setEditingEntry(entry);
    reset({
      label: entry.label,
      period_start: entry.periodStart.slice(0, 10),
      period_end: entry.periodEnd.slice(0, 10),
    });
    setFormError(null);
    setFormOpen(true);
  }

  function handleOpenDelete(entry: BranchCalendarEntry) {
    setDeletingEntry(entry);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function onSubmit(data: CalendarFormValues) {
    setFormError(null);
    try {
      if (editingEntry) {
        await updateMutation.mutateAsync({
          branchId: selectedBranchId,
          id: editingEntry.id,
          label: data.label,
          period_start: data.period_start,
          period_end: data.period_end,
        });
      } else {
        await createMutation.mutateAsync({
          branchId: selectedBranchId,
          label: data.label,
          period_start: data.period_start,
          period_end: data.period_end,
          academicYearId: selectedAcademicYearId,
        });
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err, t));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingEntry) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync({
        branchId: selectedBranchId,
        id: deletingEntry.id,
      });
      setDeleteOpen(false);
      setDeletingEntry(null);
    } catch (err) {
      setDeleteError(errorMessage(err, t));
    }
  }

  // Table columns
  const columns: Column<BranchCalendarEntry>[] = [
    {
      key: 'label',
      header: t('payments.branchCalendar.columns.label'),
      render: (row) => <span className="font-medium">{row.label}</span>,
    },
    {
      key: 'periodStart',
      header: t('payments.branchCalendar.columns.periodStart'),
      sortable: true,
      render: (row) => formatDate(row.periodStart),
    },
    {
      key: 'periodEnd',
      header: t('payments.branchCalendar.columns.periodEnd'),
      render: (row) => formatDate(row.periodEnd),
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
            aria-label={t('common.edit')}
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
            aria-label={t('common.delete')}
          >
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  const isReady = selectedBranchId && selectedAcademicYearId;
  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title={t('payments.branchCalendar.title')}
        description={t('payments.branchCalendar.description')}
        actions={
          isReady && (
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              {t('payments.branchCalendar.addEntry')}
            </Button>
          )
        }
      />

      {/* Content */}
      {!yearLoading && !activeAcademicYear ? (
        <EmptyState message={t('payments.branchCalendar.noActiveYear')} />
      ) : !isReady ? (
        <LoadingSkeleton />
      ) : entriesLoading ? (
        <LoadingSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={calendarEntries ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage={t('payments.branchCalendar.noEntries')}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry
                ? t('payments.branchCalendar.editEntry')
                : t('payments.branchCalendar.createEntry')}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? t('payments.branchCalendar.editDescription')
                : t('payments.branchCalendar.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('payments.branchCalendar.fields.label')}
              placeholder={t('payments.branchCalendar.fields.labelPlaceholder')}
              error={errors.label?.message && t(errors.label.message)}
              {...register('label')}
            />

            {/* The date picker is controlled: it needs the current value passed in,
                which `register` doesn't provide — hence Controller. */}
            <Controller
              name="period_start"
              control={control}
              render={({ field }) => (
                <Input
                  type="date"
                  label={t('payments.branchCalendar.fields.periodStart')}
                  error={errors.period_start?.message && t(errors.period_start.message)}
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  min={yearMin}
                  max={yearMax}
                />
              )}
            />

            <Controller
              name="period_end"
              control={control}
              render={({ field }) => (
                <Input
                  type="date"
                  label={t('payments.branchCalendar.fields.periodEnd')}
                  error={errors.period_end?.message && t(errors.period_end.message)}
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  min={watch('period_start') || yearMin}
                  max={yearMax}
                />
              )}
            />

            <ErrorAlert message={formError} onDismiss={() => setFormError(null)} />
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating
                  ? t('common.loading')
                  : editingEntry
                    ? t('common.save')
                    : t('common.create')}
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
              {t('payments.branchCalendar.deleteTitle')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'payments.branchCalendar.deleteConfirmation',
                { label: deletingEntry?.label ?? '' },
              )}
            </DialogDescription>
          </DialogHeader>
          <ErrorAlert message={deleteError} onDismiss={() => setDeleteError(null)} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t('common.loading')
                : t('common.delete')}
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
  return formatDateIn(dateStr, i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
