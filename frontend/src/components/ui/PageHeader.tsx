import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: React.ReactNode;
  /** One line under the title. */
  description?: React.ReactNode;
  /** A "Back" link above the title: a path, or a handler. */
  back?: string | (() => void);
  /** Next to the title (e.g. a status badge). */
  badge?: React.ReactNode;
  /** Before the title and its description (e.g. the person's avatar). */
  leading?: React.ReactNode;
  /** The page's buttons, at the end of the title line (below it on a phone). */
  actions?: React.ReactNode;
  className?: string;
}

/** The top of every page: title, a line of context, and the page's actions. */
export function PageHeader({ title, description, back, badge, leading, actions, className }: PageHeaderProps) {
  const { t } = useTranslation();
  const backClass =
    'inline-flex items-center gap-1.5 text-label font-medium text-text-secondary hover:text-text-heading transition-colors -ms-1 px-1 py-0.5 rounded focus-visible:outline-none focus-visible:shadow-focus-ring';
  const backContent = (
    <>
      <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
      {t('common.back')}
    </>
  );

  return (
    <header className={cn('space-y-2', className)}>
      {back &&
        (typeof back === 'string' ? (
          <Link to={back} className={backClass}>
            {backContent}
          </Link>
        ) : (
          <button type="button" onClick={back} className={backClass}>
            {backContent}
          </button>
        ))}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex items-center gap-4">
          {leading && <div className="shrink-0">{leading}</div>}
          <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-playful text-page-title font-bold text-text-heading break-words min-w-0">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1 text-body text-text-secondary">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
