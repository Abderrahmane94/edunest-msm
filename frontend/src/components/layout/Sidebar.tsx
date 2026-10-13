import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { navChip } from './navColors';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** The group it is listed under (a `navSection.*` key); entries of a group follow each other. */
  section?: string;
  /** How many things wait behind it (late payments, unread messages…). */
  badge?: number;
}

/** "3", "99+": the count on a menu entry. */
export function NavBadge({ count, className }: { count?: number; className?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-white text-micro font-bold tabular-nums leading-none',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

interface SidebarProps {
  items: NavItem[];
  header?: React.ReactNode;
  /** Under the header: today at a glance. */
  status?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sidebar({ items, header, status, footer }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="hidden lg:flex lg:flex-col w-[236px] bg-card border-e border-border p-4 h-screen sticky top-0 overflow-hidden">
      {header && <div className={cn('shrink-0', status ? 'mb-3' : 'mb-6')}>{header}</div>}
      {status && <div className="mb-3 shrink-0">{status}</div>}

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0 -mx-1 px-1">
        {items.map((item, i) => (
          <React.Fragment key={item.href}>
          {item.section && item.section !== items[i - 1]?.section && (
            <p className={cn('px-2 pb-0.5 text-micro font-bold uppercase tracking-wider text-text-disabled shrink-0', i > 0 && 'pt-3')}>
              {t(`navSection.${item.section}`)}
            </p>
          )}
          <NavLink
            to={item.href}
            end={item.href === '/admin' || item.href === '/teacher' || item.href === '/parent'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-2 py-1.5 rounded-xl text-body font-medium transition-all duration-150 shrink-0',
                isActive
                  ? 'bg-gradient-to-r rtl:bg-gradient-to-l from-[var(--color-accent-light)] to-[var(--color-accent)] text-white shadow-[0_6px_16px_rgba(91,85,214,0.32)]'
                  : 'text-text-secondary hover:bg-subtle hover:text-text-heading',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isActive ? 'bg-white/20 text-white' : navChip(i),
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                </span>
                <span className="truncate flex-1">{t(item.label, item.label)}</span>
                <NavBadge count={item.badge} className={isActive ? 'bg-white text-primary' : undefined} />
              </>
            )}
          </NavLink>
          </React.Fragment>
        ))}
      </nav>

      {footer && <div className="shrink-0 mt-3 pt-3 border-t border-border">{footer}</div>}
    </aside>
  );
}
