import * as React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleUserRound } from 'lucide-react';
import { Sidebar, type NavItem } from './Sidebar';
import { PageContainer } from './PageContainer';
import { BottomTabBar } from './BottomTabBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadErrorBanner } from '@/components/LoadErrorBanner';
import { NotificationBell } from '@/components/NotificationBell';
import { OfflineStatus } from '@/components/OfflineStatus';

interface AdminLayoutProps {
  navItems: NavItem[];
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
}

export function AdminLayout({ navItems, sidebarHeader, sidebarFooter }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar items={navItems} header={sidebarHeader} footer={sidebarFooter} />

      {/* min-w-0: a wide table scrolls inside its own box instead of
          stretching the whole page past the screen. */}
      <div className="flex-1 min-w-0 flex flex-col pb-[calc(var(--tabbar-h)+0.5rem)] lg:pb-0">
        {/* Slim top bar with the notification bell (data-dense admin/teacher UI).
            Below lg the sidebar is hidden, so the bar also carries the school
            name and the account menu (language, logout). */}
        <header className="h-14 bg-white/85 backdrop-blur-md border-b border-border px-4 lg:px-6 flex items-center justify-end gap-2 sticky top-0 z-30">
          {sidebarHeader && <div className="lg:hidden min-w-0 flex-1">{sidebarHeader}</div>}
          <OfflineStatus />
          <NotificationBell />
          {sidebarFooter && <MobileAccountMenu>{sidebarFooter}</MobileAccountMenu>}
        </header>

        <PageContainer>
          <LoadErrorBanner />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </PageContainer>
      </div>

      <BottomTabBar items={navItems} />
    </div>
  );
}

function MobileAccountMenu({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-subtle text-text-secondary hover:text-text-primary transition-colors duration-150"
        aria-label={t('common.account')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CircleUserRound className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-level-4 p-3 z-50">
          {children}
        </div>
      )}
    </div>
  );
}
