import { useTranslation } from 'react-i18next';
import { FlaskConical } from 'lucide-react';
import { useSchoolBrand } from '@/hooks/useSchool';
import { formatDate } from '@/lib/formatters';

/** In a demonstration school: says the data is fictitious, and until when it stays open. */
export function DemoBanner({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { data: brand } = useSchoolBrand();
  if (!brand?.demoExpiresAt) return null;
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
