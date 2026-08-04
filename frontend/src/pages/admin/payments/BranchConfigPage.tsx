import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Settings, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { FormField } from '@/components/forms';
import { FormSelect } from '@/components/forms';
import {
  useBranches,
  useBranchBillingConfig,
  useCreateBranchBillingConfig,
  useUpdateBranchBillingConfig,
} from '@/hooks/useBranchBillingConfig';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const branchBillingConfigSchema = z.object({
  billingCycle: z.enum(['monthly', 'trimester', 'custom'], {
    error: 'payments.validation.billingCycleRequired',
  }),
  billingDueDay: z
    .number({
      error: 'payments.validation.billingDueDayInvalid',
    })
    .int({ error: 'payments.validation.billingDueDayInteger' })
    .min(1, { error: 'payments.validation.billingDueDayMin' })
    .max(28, { error: 'payments.validation.billingDueDayMax' }),
  gracePeriodDays: z
    .number({
      error: 'payments.validation.gracePeriodInvalid',
    })
    .int({ error: 'payments.validation.gracePeriodInteger' })
    .min(0, { error: 'payments.validation.gracePeriodMin' })
    .max(60, { error: 'payments.validation.gracePeriodMax' }),
  defaultRecurringFee: z
    .number({
      error: 'payments.validation.defaultFeeInvalid',
    })
    .min(0, { error: 'payments.validation.defaultFeeMin' })
    .max(9999999.99, { error: 'payments.validation.defaultFeeMax' }),
  notificationSetting: z.enum(['enabled', 'disabled']),
});

type BranchBillingConfigForm = z.infer<typeof branchBillingConfigSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

export function BranchConfigPage() {
  const { t } = useTranslation();
  const { data: branches, isLoading: branchesLoading } = useBranches();
  const branchId = branches?.[0]?.id;

  const {
    data: existingConfig,
    isLoading: configLoading,
  } = useBranchBillingConfig(branchId);

  const createConfig = useCreateBranchBillingConfig();
  const updateConfig = useUpdateBranchBillingConfig();

  const isUpdate = !!existingConfig;
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BranchBillingConfigForm>({
    resolver: zodResolver(branchBillingConfigSchema),
    defaultValues: {
      billingCycle: 'monthly',
      billingDueDay: 1,
      gracePeriodDays: 5,
      defaultRecurringFee: 0,
      notificationSetting: 'disabled',
    },
  });

  // Populate form when config loads
  React.useEffect(() => {
    if (existingConfig) {
      reset({
        billingCycle: existingConfig.billingCycle,
        billingDueDay: existingConfig.billingDueDay,
        gracePeriodDays: existingConfig.gracePeriodDays,
        defaultRecurringFee: parseFloat(existingConfig.defaultRecurringFee),
        notificationSetting: existingConfig.notificationSetting,
      });
    }
  }, [existingConfig, reset]);

  async function onSubmit(data: BranchBillingConfigForm) {
    if (!branchId) return;
    setSaveSuccess(false);
    setServerError(null);

    try {
      if (isUpdate) {
        await updateConfig.mutateAsync({ branchId, ...data });
      } else {
        await createConfig.mutateAsync({ branchId, ...data });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : t('common.error'),
      );
    }
  }

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (branchesLoading || configLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-h2 font-semibold text-text-heading">
            {t('payments.branchConfig.title')}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-text-secondary animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // ─── No Branch Found ────────────────────────────────────────────────────────

  if (!branchId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-h2 font-semibold text-text-heading">
            {t('payments.branchConfig.title')}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-body text-text-secondary">
            {t('payments.branchConfig.noBranch')}
          </p>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────

  const billingCycleOptions = [
    { value: 'monthly', label: t('payments.branchConfig.cycleMonthly') },
    { value: 'trimester', label: t('payments.branchConfig.cycleTrimester') },
    { value: 'custom', label: t('payments.branchConfig.cycleCustom') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-h2 font-semibold text-text-heading">
          {t('payments.branchConfig.title')}
        </h1>
      </div>
      <p className="text-body text-text-secondary">
        {t('payments.branchConfig.description')}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-subsection font-semibold text-text-heading mb-4">
            {t('payments.branchConfig.sectionBilling')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {/* Billing Cycle */}
            <Controller
              name="billingCycle"
              control={control}
              render={({ field }) => (
                <FormSelect
                  label={t('payments.branchConfig.billingCycle')}
                  options={billingCycleOptions}
                  error={errors.billingCycle ? t(errors.billingCycle.message!) : undefined}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  name="billingCycle"
                />
              )}
            />

            {/* Billing Due Day */}
            <Controller
              name="billingDueDay"
              control={control}
              render={({ field }) => (
                <FormField
                  label={t('payments.branchConfig.billingDueDay')}
                  htmlFor="billingDueDay"
                  error={errors.billingDueDay ? t(errors.billingDueDay.message!) : undefined}
                  helperText={t('payments.branchConfig.billingDueDayHelper')}
                  required
                >
                  <Input
                    id="billingDueDay"
                    type="number"
                    min={1}
                    max={28}
                    step={1}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : '')}
                    onBlur={field.onBlur}
                    error={errors.billingDueDay ? t(errors.billingDueDay.message!) : undefined}
                  />
                </FormField>
              )}
            />

            {/* Grace Period Days */}
            <Controller
              name="gracePeriodDays"
              control={control}
              render={({ field }) => (
                <FormField
                  label={t('payments.branchConfig.gracePeriodDays')}
                  htmlFor="gracePeriodDays"
                  error={errors.gracePeriodDays ? t(errors.gracePeriodDays.message!) : undefined}
                  helperText={t('payments.branchConfig.gracePeriodHelper')}
                  required
                >
                  <Input
                    id="gracePeriodDays"
                    type="number"
                    min={0}
                    max={60}
                    step={1}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : '')}
                    onBlur={field.onBlur}
                    error={errors.gracePeriodDays ? t(errors.gracePeriodDays.message!) : undefined}
                  />
                </FormField>
              )}
            />

            {/* Default Recurring Fee */}
            <Controller
              name="defaultRecurringFee"
              control={control}
              render={({ field }) => (
                <FormField
                  label={t('payments.branchConfig.defaultRecurringFee')}
                  htmlFor="defaultRecurringFee"
                  error={errors.defaultRecurringFee ? t(errors.defaultRecurringFee.message!) : undefined}
                  helperText={t('payments.branchConfig.feeHelper')}
                  required
                >
                  <div className="relative">
                    <Input
                      id="defaultRecurringFee"
                      type="number"
                      min={0}
                      max={9999999.99}
                      step={0.01}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
                      onBlur={field.onBlur}
                      className="pe-14"
                      error={errors.defaultRecurringFee ? t(errors.defaultRecurringFee.message!) : undefined}
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-label text-text-secondary pointer-events-none">
                      {t('payments.branchConfig.currencyDZD')}
                    </span>
                  </div>
                </FormField>
              )}
            />
          </div>
        </div>

        {/* Notification Setting */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-subsection font-semibold text-text-heading mb-4">
            {t('payments.branchConfig.sectionNotifications')}
          </h2>

          <Controller
            name="notificationSetting"
            control={control}
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value === 'enabled'}
                  aria-label={t('payments.branchConfig.notificationSetting')}
                  onClick={() =>
                    field.onChange(field.value === 'enabled' ? 'disabled' : 'enabled')
                  }
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                    border-2 border-transparent transition-colors duration-200
                    focus-visible:outline-none focus-visible:shadow-focus-ring
                    ${field.value === 'enabled' ? 'bg-success' : 'bg-border'}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-5 w-5 rounded-full
                      bg-white shadow-level-1 transition-transform duration-200
                      ${field.value === 'enabled' ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
                <label className="text-body text-foreground cursor-pointer" onClick={() =>
                  field.onChange(field.value === 'enabled' ? 'disabled' : 'enabled')
                }>
                  {t('payments.branchConfig.notificationSetting')}
                </label>
              </div>
            )}
          />
          <p className="text-caption text-text-secondary mt-2">
            {t('payments.branchConfig.notificationHelper')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : isUpdate ? (
              t('common.save')
            ) : (
              t('payments.branchConfig.create')
            )}
          </Button>

          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-body text-success animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              {t('payments.branchConfig.saved')}
            </span>
          )}

          {serverError && (
            <span className="text-body text-danger animate-fade-in">
              {serverError}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
