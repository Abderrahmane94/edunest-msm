import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavItem } from './Sidebar';
import { navChip } from './navColors';

interface BottomTabBarProps {
  items: NavItem[];
}

// Bottom bar has room for 5 slots. When there are more items than that,
// the 5th slot becomes a "More" trigger that opens the rest in a sheet —
// otherwise items past #5 would be completely unreachable below the `lg`
// breakpoint, since the full Sidebar is hidden there.
const MAX_VISIBLE_WITH_OVERFLOW = 4;

function isItemActive(item: NavItem, pathname: string): boolean {
  const isRoot = item.href === '/admin' || item.href === '/teacher' || item.href === '/parent';
  return isRoot ? pathname === item.href : pathname.startsWith(item.href);
}

export function BottomTabBar({ items }: BottomTabBarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const hasOverflow = items.length > 5;
  const visibleItems = hasOverflow ? items.slice(0, MAX_VISIBLE_WITH_OVERFLOW) : items;
  const overflowItems = hasOverflow ? items.slice(MAX_VISIBLE_WITH_OVERFLOW) : [];
  const isOverflowActive = overflowItems.some((item) => isItemActive(item, location.pathname));

  React.useEffect(() => {
    if (!moreOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  // Close the sheet automatically after navigating to one of its links.
  React.useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-border shadow-[0_-4px_16px_rgba(46,42,107,0.06)] flex items-center justify-around h-[var(--tabbar-h)] pb-[env(safe-area-inset-bottom)]">
        {visibleItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/admin' || item.href === '/teacher' || item.href === '/parent'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-[48px] min-h-[48px] rounded-md transition-colors duration-150',
                'text-text-secondary',
                isActive && 'text-primary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-150',
                    isActive && 'bg-[var(--color-accent-muted)]',
                  )}
                >
                  <item.icon className="w-5 h-5" />
                </span>
            {/* A short name when the full one wouldn't fit (e.g. "Accueil" for the dashboard). */}
            <span className="text-micro font-medium truncate max-w-[72px]">
              {t(item.label.replace(/^nav./, 'navShort.'), { defaultValue: t(item.label, item.label) })}
            </span>
              </>
            )}
          </NavLink>
        ))}

        {hasOverflow && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-[48px] min-h-[48px] rounded-md transition-colors duration-150',
              isOverflowActive ? 'text-primary' : 'text-text-secondary'
            )}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <span
              className={cn(
                'flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-150',
                isOverflowActive && 'bg-[var(--color-accent-muted)]',
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
            </span>
            <span className="text-micro font-medium">{t('common.more')}</span>
          </button>
        )}
      </nav>

      {hasOverflow && moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div
            className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-[2px] animate-fade-in"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('common.more')}
            className="relative z-50 w-full bg-card rounded-t-xl p-4 shadow-level-4 animate-scale-in max-h-[70vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(1rem + var(--tabbar-h))' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-body font-semibold text-text-heading">{t('common.more')}</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label={t('common.closeDialog')}
                className="p-1.5 rounded-md hover:bg-subtle text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {overflowItems.map((item, i) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/admin' || item.href === '/teacher' || item.href === '/parent'}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl text-center transition-colors duration-150',
                      isActive
                        ? 'bg-[var(--color-accent-subtle)] text-primary ring-1 ring-[var(--color-accent-muted)]'
                        : 'text-text-secondary hover:bg-subtle'
                    )
                  }
                >
                  <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center', navChip(MAX_VISIBLE_WITH_OVERFLOW + i))}>
                    <item.icon className="w-5 h-5" />
                  </span>
                  <span className="text-micro font-medium">{t(item.label, item.label)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
