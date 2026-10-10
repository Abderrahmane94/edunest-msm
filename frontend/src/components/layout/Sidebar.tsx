import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { navChip } from './navColors';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: NavItem[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sidebar({ items, header, footer }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="hidden lg:flex lg:flex-col w-[236px] bg-card border-e border-border p-4 h-screen sticky top-0 overflow-hidden">
      {header && <div className="mb-6 shrink-0">{header}</div>}

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0 -mx-1 px-1">
        {items.map((item, i) => (
          <NavLink
            key={item.href}
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
                <span className="truncate">{t(item.label, item.label)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {footer && <div className="shrink-0 mt-3 pt-3 border-t border-border">{footer}</div>}
    </aside>
  );
}
