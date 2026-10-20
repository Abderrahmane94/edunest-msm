import { useTranslation } from 'react-i18next';
import { FlaskConical, Hourglass } from 'lucide-react';
import { useSchoolBrand } from '@/hooks/useSchool';
import { useAuth } from '@/contexts/AuthContext';
import { isOfficeRole } from '@/lib/roles';
import { formatDate } from '@/lib/formatters';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * In a demonstration school: says the data is fictitious, and until when it
 * stays open. In a school on trial (`office`: the office's own pages only):
 * until when, and that its data is kept once it subscribes.
 */
export function DemoBanner({ className = '', office = false }: { className?: string; office?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: brand } = useSchoolBrand();
  if (brand?.demoExpiresAt) {
    return (
      <div
        role="note"
        className={`mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-caption text-foreground ${className}`}
      >
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <span className="font-semibold">{t('demos.banner.title')}</span>{' '}
          {t('demos.banner.text', { date: `⁨${formatDate(brand.demoExpiresAt)}⁩` })}
        </p>
      </div>
    );
  }
  if (office && brand?.trialEndsAt && isOfficeRole(user?.role)) {
    const daysLeft = Math.max(1, Math.ceil((new Date(brand.trialEndsAt).getTime() - Date.now()) / DAY_MS));
    const date = `⁨${formatDate(brand.trialEndsAt)}⁩`;
    // The last three days stand out.
    const soon = daysLeft <= 3;
    return (
      <div
        role="note"
        className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-caption text-foreground ${soon ? 'border-warning/40 bg-warning/10' : 'border-primary/30 bg-primary/5'} ${className}`}
      >
        <Hourglass className={`mt-0.5 h-4 w-4 shrink-0 ${soon ? 'text-warning' : 'text-primary'}`} />
        <p>
          <span className="font-semibold">{t('schools.trial.banner.title')}</span>{' '}
          {daysLeft <= 1 ? t('schools.trial.banner.lastDay', { date }) : t('schools.trial.banner.text', { date, count: daysLeft })}
        </p>
      </div>
    );
  }
  return null;
}
