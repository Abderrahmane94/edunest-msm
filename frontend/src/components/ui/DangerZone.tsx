import * as React from 'react';
import { useTranslation } from 'react-i18next';

/** Actions that can't easily be undone (deactivate, delete), kept apart at the bottom of a page. */
export function DangerZone({
  title,
  description,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="bg-card border border-danger/30 rounded-lg p-4 sm:p-6 space-y-3">
      <h2 className="text-subsection font-semibold text-danger">{title ?? t('common.dangerZone')}</h2>
      {description && <p className="text-body text-text-secondary">{description}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}
