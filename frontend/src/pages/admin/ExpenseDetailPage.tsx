import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { FormField } from '@/components/forms';
import { Input } from '@/components/ui';
import { useExpense, useUpdateExpense, useDeleteExpense } from '@/hooks/useFinance';

export function ExpenseDetailPage() {
  const { t } = useTranslation();
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();

  const { data: expense, isLoading } = useExpense(expenseId!);
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [formData, setFormData] = React.useState({ category: '', description: '', amount: '', date: '' });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (expense) {
      setFormData({
        category: expense.category,
        description: expense.description,
        amount: String(expense.amount),
        date: expense.date?.split('T')[0] ?? '',
      });
    }
  }, [expense]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateExpense.mutateAsync({ id: expenseId!, category: formData.category, description: formData.description, amount: Number(formData.amount), date: formData.date });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteExpense.mutateAsync(expenseId!);
      navigate('/admin/finance');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('common.error'));
      setConfirmDelete(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-10 bg-hover rounded-md" /><div className="h-10 bg-hover rounded-md w-1/2" />
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/finance')}>
          <ArrowLeft className="w-4 h-4" />{t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('finance.expenses.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/finance')}>
          <ArrowLeft className="w-4 h-4" />{t('common.back')}
        </Button>
        <div className="flex-1">
          <h1 className="text-page-title font-semibold text-text-heading">{expense.category}</h1>
          <p className="text-body text-text-secondary">{expense.description}</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-subsection font-semibold text-text-heading">{t('finance.expenses.detail.info')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <FormField label={t('finance.expenses.form.category')} htmlFor="exp-category" required>
              <Input id="exp-category" name="category" value={formData.category} onChange={handleChange} />
            </FormField>
            <FormField label={t('finance.expenses.form.amount')} htmlFor="exp-amount" required>
              <Input id="exp-amount" name="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={handleChange} />
            </FormField>
            <FormField label={t('finance.expenses.form.date')} htmlFor="exp-date" required>
              <Input id="exp-date" name="date" type="date" value={formData.date} onChange={handleChange} />
            </FormField>
          </div>
          <FormField label={t('finance.expenses.form.description')} htmlFor="exp-desc" required>
            <Input id="exp-desc" name="description" value={formData.description} onChange={handleChange} />
          </FormField>
          <p className="text-caption text-text-secondary">{t('finance.expenses.columns.createdBy')}: {expense.created_by_name}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-4">
          <Button type="submit" disabled={updateExpense.isPending}>
            <Save className="w-4 h-4" />{updateExpense.isPending ? t('common.loading') : t('common.save')}
          </Button>
          {saveSuccess && <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>}
          {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
        </div>
      </form>

      <div className="bg-card border border-border border-danger/30 rounded-lg p-6 space-y-3">
        <h2 className="text-subsection font-semibold text-danger">{t('finance.expenses.detail.dangerZone')}</h2>
        <p className="text-body text-text-secondary">{t('finance.expenses.detail.deleteWarning')}</p>
        {deleteError && <p className="text-body text-danger">{deleteError}</p>}
        {!confirmDelete ? (
          <Button variant="secondary" onClick={() => setConfirmDelete(true)} className="border-danger text-danger hover:bg-danger/10">
            <Trash2 className="w-4 h-4" />{t('finance.expenses.detail.delete')}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-body text-danger font-medium">{t('finance.expenses.detail.confirmDelete')}</p>
            <Button variant="secondary" onClick={handleDelete} disabled={deleteExpense.isPending} className="border-danger text-danger hover:bg-danger/10">
              {deleteExpense.isPending ? t('common.loading') : t('common.confirm')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
