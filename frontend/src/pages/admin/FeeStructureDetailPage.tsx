import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Button, StatusBadge } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import { useFeeStructure, useUpdateFeeStructure, useDeleteFeeStructure } from '@/hooks/useFinance';

const FREQUENCIES = ['monthly', 'quarterly', 'annual', 'one_time'] as const;

function formatDZD(amount: number) {
  return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(amount);
}

export function FeeStructureDetailPage() {
  const { t } = useTranslation();
  const { feeId } = useParams<{ feeId: string }>();
  const navigate = useNavigate();

  const { data: fee, isLoading } = useFeeStructure(feeId!);
  const updateFee = useUpdateFeeStructure();
  const deleteFee = useDeleteFeeStructure();

  const [formData, setFormData] = React.useState({ name: '', amount: '', frequency: '', level: '', description: '' });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (fee) {
      setFormData({
        name: fee.name,
        amount: String(fee.amount),
        frequency: fee.frequency,
        level: fee.level ?? '',
        description: fee.description ?? '',
      });
    }
  }, [fee]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateFee.mutateAsync({ id: feeId!, name: formData.name, amount: Number(formData.amount), frequency: formData.frequency, level: formData.level || undefined, description: formData.description || undefined });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteFee.mutateAsync(feeId!);
      navigate('/admin/finance');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('common.error'));
      setConfirmDelete(false);
    }
  }

  const frequencyOptions = FREQUENCIES.map((f) => ({ value: f, label: t(`finance.fees.frequencies.${f}`) }));

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

  if (!fee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/finance')}>
          <ArrowLeft className="w-4 h-4" />{t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('finance.fees.notFound')}</p>
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
          <h1 className="text-page-title font-semibold text-text-heading">{fee.name}</h1>
          <p className="text-body text-text-secondary">{formatDZD(fee.amount)} · <StatusBadge variant="sent">{t(`finance.fees.frequencies.${fee.frequency}`)}</StatusBadge></p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-subsection font-semibold text-text-heading">{t('finance.fees.detail.info')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <FormField label={t('finance.fees.form.name')} htmlFor="fee-name" required>
              <Input id="fee-name" name="name" value={formData.name} onChange={handleChange} />
            </FormField>
            <FormField label={t('finance.fees.form.amount')} htmlFor="fee-amount" required>
              <Input id="fee-amount" name="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={handleChange} />
            </FormField>
            <FormField label={t('finance.fees.form.frequency')} htmlFor="fee-freq">
              <FormSelect label="" name="frequency" value={formData.frequency} onChange={handleSelectChange} options={frequencyOptions} />
            </FormField>
            <FormField label={t('finance.fees.form.level')} htmlFor="fee-level">
              <Input id="fee-level" name="level" value={formData.level} onChange={handleChange} placeholder={t('finance.fees.form.levelPlaceholder')} />
            </FormField>
          </div>
          <FormField label={t('finance.fees.form.description')} htmlFor="fee-desc">
            <Input id="fee-desc" name="description" value={formData.description} onChange={handleChange} placeholder={t('finance.fees.form.descriptionPlaceholder')} />
          </FormField>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-4">
          <Button type="submit" disabled={updateFee.isPending}>
            <Save className="w-4 h-4" />{updateFee.isPending ? t('common.loading') : t('common.save')}
          </Button>
          {saveSuccess && <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>}
          {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
        </div>
      </form>

      <div className="bg-card border border-border border-danger/30 rounded-lg p-6 space-y-3">
        <h2 className="text-subsection font-semibold text-danger">{t('finance.fees.detail.dangerZone')}</h2>
        <p className="text-body text-text-secondary">{t('finance.fees.detail.deleteWarning')}</p>
        {deleteError && <p className="text-body text-danger">{deleteError}</p>}
        {!confirmDelete ? (
          <Button variant="secondary" onClick={() => setConfirmDelete(true)} className="border-danger text-danger hover:bg-danger/10">
            <Trash2 className="w-4 h-4" />{t('finance.fees.detail.delete')}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-body text-danger font-medium">{t('finance.fees.detail.confirmDelete')}</p>
            <Button variant="secondary" onClick={handleDelete} disabled={deleteFee.isPending} className="border-danger text-danger hover:bg-danger/10">
              {deleteFee.isPending ? t('common.loading') : t('common.confirm')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
