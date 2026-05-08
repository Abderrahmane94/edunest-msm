import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

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
    <aside className="hidden lg:flex lg:flex-col w-[220px] bg-card border-e border-border p-4 h-screen sticky top-0 overflow-hidden">
      {header && <div className="mb-6 shrink-0">{header}</div>}

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0">
        {items.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/admin' || item.href === '/teacher' || item.href === '/parent'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-body font-medium transition-all duration-150 shrink-0',
                'text-text-secondary hover:bg-subtle hover:text-text-primary',
                isActive && 'bg-[var(--color-accent-subtle)] text-primary border-s-2 border-primary'
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span>{t(item.label, item.label)}</span>
          </NavLink>
        ))}
      </nav>

      {footer && <div className="shrink-0 mt-3 pt-3 border-t border-border">{footer}</div>}
    </aside>
  );
}
