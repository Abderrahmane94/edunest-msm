import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, CheckCircle, Circle } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import {
  Button,
  EditButton,
  EditFormActions,
  PageHeader,
  ReadOnlyFieldset,
  StatusBadge,
  useConfirm,
  useEditMode,
} from '@/components/ui';
import { yearActivateConfirm } from './AcademicYearsPage';
import { FormField } from '@/components/forms';
import { Input } from '@/components/ui';
import {
  useAcademicYear,
  useUpdateAcademicYear,
  useDeleteAcademicYear,
  useActivateAcademicYear,
} from '@/hooks/useAcademicYears';

export function AcademicYearDetailPage() {
  const { t } = useTranslation();
  const { yearId } = useParams<{ yearId: string }>();
  const navigate = useNavigate();

  const { data: year, isLoading } = useAcademicYear(yearId!);
  const updateYear = useUpdateAcademicYear();
  const deleteYear = useDeleteAcademicYear();
  const activateYear = useActivateAcademicYear();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [formData, setFormData] = React.useState({ name: '', start_date: '', end_date: '' });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const toForm = React.useCallback(
    (y: NonNullable<typeof year>) => ({
      name: y.name,
      start_date: y.start_date.split('T')[0],
      end_date: y.end_date.split('T')[0],
    }),
    [],
  );
  const edit = useEditMode(() => {
    if (year) setFormData(toForm(year));
    setSaveError(null);
  });

  // Follow the saved year while reading; never overwrite what is being typed.
  React.useEffect(() => {
    if (year && !edit.editing) setFormData(toForm(year));
  }, [year, edit.editing, toForm]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateYear.mutateAsync({ id: yearId!, ...formData });
      edit.finishEditing();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(errorMessage(err, t));
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteYear.mutateAsync(yearId!);
      navigate('/admin/academic-years');
    } catch (err) {
      setDeleteError(errorMessage(err, t));
      setConfirmDelete(false);
    }
  }

  async function handleToggleActive() {
    if (!year) return;
    if (!(await confirm(yearActivateConfirm(t, year.name)))) return;
    try {
      setSaveError(null);
      await activateYear.mutateAsync(year.id);
    } catch (err) {
      setSaveError(errorMessage(err, t));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-10 bg-hover rounded-md" />
          <div className="h-10 bg-hover rounded-md w-1/2" />
          <div className="h-10 bg-hover rounded-md w-1/2" />
        </div>
      </div>
    );
  }

  if (!year) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader back="/admin/academic-years" title={t('academicYears.notFound')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {confirmDialog}
      <PageHeader
        back="/admin/academic-years"
        title={year.name}
        description={
          <>
            <span dir="ltr">{formatDate(year.start_date)}</span> – <span dir="ltr">{formatDate(year.end_date)}</span>
          </>
        }
        badge={
          <StatusBadge variant={year.is_active ? 'success' : 'neutral'}>
            {year.is_active ? t('academicYears.active') : t('academicYears.inactive')}
          </StatusBadge>
        }
      />

      {/* Edit form */}
      <form onSubmit={handleSave}>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-subsection font-semibold text-text-heading">
              {t('academicYears.detail.info')}
            </h2>
            <EditButton onClick={edit.startEditing} hidden={edit.editing} />
          </div>

          <ReadOnlyFieldset readOnly={!edit.editing}>
          <FormField label={t('academicYears.form.name')} htmlFor="ay-name" required>
            <Input
              id="ay-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('academicYears.form.namePlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('academicYears.form.startDate')} htmlFor="ay-start" required>
              <Input
                id="ay-start"
                name="start_date"
                type="date"
                value={formData.start_date}
                onChange={handleChange}
              />
            </FormField>

            <FormField label={t('academicYears.form.endDate')} htmlFor="ay-end" required>
              <Input
                id="ay-end"
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleChange}
              />
            </FormField>
          </div>
          </ReadOnlyFieldset>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap mt-4">
          {edit.editing && <EditFormActions saving={updateYear.isPending} onCancel={edit.cancelEditing} />}

          {!edit.editing && !year.is_active && (
            <Button
              type="button"
              variant="secondary"
              disabled={activateYear.isPending}
              onClick={handleToggleActive}
            >
              <CheckCircle className="w-4 h-4 text-success" />
              {t('academicYears.activate')}
            </Button>
          )}

          {!edit.editing && year.is_active && (
            <div className="flex items-center gap-2 text-body text-success">
              <Circle className="w-4 h-4" />
              {t('academicYears.currentlyActive')}
            </div>
          )}

          {saveSuccess && (
            <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>
          )}
          {saveError && (
            <span className="text-body text-danger animate-fade-in">{saveError}</span>
          )}
        </div>
      </form>

      {/* Delete section */}
      {!year.is_active && (
        <div className="bg-card border border-border border-danger/30 rounded-lg p-6 space-y-3">
          <h2 className="text-subsection font-semibold text-danger">
            {t('academicYears.detail.dangerZone')}
          </h2>
          <p className="text-body text-text-secondary">
            {t('academicYears.detail.deleteWarning')}
          </p>

          {deleteError && (
            <p className="text-body text-danger">{deleteError}</p>
          )}

          {!confirmDelete ? (
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(true)}
              className="border-danger text-danger hover:bg-danger/10"
            >
              <Trash2 className="w-4 h-4" />
              {t('academicYears.detail.delete')}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-body text-danger font-medium">{t('academicYears.detail.confirmDelete')}</p>
              <Button
                variant="secondary"
                onClick={handleDelete}
                disabled={deleteYear.isPending}
                className="border-danger text-danger hover:bg-danger/10"
              >
                {deleteYear.isPending ? t('common.loading') : t('common.confirm')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
