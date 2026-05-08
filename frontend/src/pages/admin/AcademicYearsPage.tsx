import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckCircle, Circle } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  StatusBadge,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import {
  useAcademicYears,
  useCreateAcademicYear,
  useActivateAcademicYear,
} from '@/hooks/useAcademicYears';

function CreateAcademicYearDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const createAcademicYear = useCreateAcademicYear();

  const [formData, setFormData] = React.useState({
    name: '',
    start_date: '',
    end_date: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function resetForm() {
    setFormData({ name: '', start_date: '', end_date: '' });
    setErrors({});
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = t('academicYears.form.nameRequired');
    }
    if (!formData.start_date) {
      newErrors.start_date = t('academicYears.form.startDateRequired');
    }
    if (!formData.end_date) {
      newErrors.end_date = t('academicYears.form.endDateRequired');
    }
    if (formData.start_date && formData.end_date && formData.start_date >= formData.end_date) {
      newErrors.end_date = t('academicYears.form.endDateAfterStart');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createAcademicYear.mutateAsync(formData);
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by React Query
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('academicYears.form.title')}</DialogTitle>
          <DialogDescription>{t('academicYears.form.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormField
            label={t('academicYears.form.name')}
            htmlFor="ay-name"
            error={errors.name}
            required
          >
            <Input
              id="ay-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('academicYears.form.namePlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('academicYears.form.startDate')}
              htmlFor="ay-start-date"
              error={errors.start_date}
              required
            >
              <Input
                id="ay-start-date"
                name="start_date"
                type="date"
                value={formData.start_date}
                onChange={handleChange}
              />
            </FormField>

            <FormField
              label={t('academicYears.form.endDate')}
              htmlFor="ay-end-date"
              error={errors.end_date}
              required
            >
              <Input
                id="ay-end-date"
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleChange}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createAcademicYear.isPending}>
              {createAcademicYear.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AcademicYearsPage() {
  const { t } = useTranslation();
  const { data: academicYears, isLoading } = useAcademicYears();
  const activateAcademicYear = useActivateAcademicYear();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  async function handleActivate(id: string) {
    try {
      await activateAcademicYear.mutateAsync(id);
    } catch {
      // Error handled by React Query
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('academicYears.title')}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const years = academicYears ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('academicYears.title')}
        </h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          {t('academicYears.create')}
        </Button>
      </div>

      {years.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-body text-text-secondary">{t('academicYears.noYears')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {years.map((year) => (
            <div
              key={year.id}
              className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:bg-hover transition-colors duration-150"
            >
              <div className="flex items-center gap-3">
                {year.is_active ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <Circle className="w-5 h-5 text-text-disabled" />
                )}
                <div>
                  <p className="text-body font-medium text-foreground">{year.name}</p>
                  <p className="text-caption text-text-secondary">
                    {new Date(year.start_date).toLocaleDateString()} –{' '}
                    {new Date(year.end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge variant={year.is_active ? 'present' : 'draft'}>
                  {year.is_active ? t('academicYears.active') : t('academicYears.inactive')}
                </StatusBadge>
                {!year.is_active && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleActivate(year.id)}
                    disabled={activateAcademicYear.isPending}
                  >
                    {t('academicYears.activate')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateAcademicYearDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
