import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Settings, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  useBranches,
  useBranchBillingConfig,
  useCreateBranchBillingConfig,
  useUpdateBranchBillingConfig,
} from '@/hooks/useBranchBillingConfig';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const branchBillingConfigSchema = z.object({
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
    formState: { isSubmitting },
  } = useForm<BranchBillingConfigForm>({
    resolver: zodResolver(branchBillingConfigSchema),
    defaultValues: {
      notificationSetting: 'disabled',
    },
  });

  // Populate form when config loads
  React.useEffect(() => {
    if (existingConfig) {
      reset({
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
