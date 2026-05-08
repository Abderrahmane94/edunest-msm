import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { NavItem } from './Sidebar';

interface BottomTabBarProps {
  items: NavItem[];
}

export function BottomTabBar({ items }: BottomTabBarProps) {
  const { t } = useTranslation();
  // Show max 5 items in bottom tab bar
  const visibleItems = items.slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border flex items-center justify-around h-14">
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
          <item.icon className="w-5 h-5" />
          <span className="text-micro font-medium truncate max-w-[64px]">{t(item.label, item.label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
