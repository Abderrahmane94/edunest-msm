import { Outlet } from 'react-router-dom';
import { Sidebar, type NavItem } from './Sidebar';
import { PageContainer } from './PageContainer';
import { BottomTabBar } from './BottomTabBar';
import { NotificationBell } from '@/components/NotificationBell';

interface AdminLayoutProps {
  navItems: NavItem[];
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
}

export function AdminLayout({ navItems, sidebarHeader, sidebarFooter }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar items={navItems} header={sidebarHeader} footer={sidebarFooter} />

      <div className="flex-1 flex flex-col pb-16 lg:pb-0">
        {/* Slim top bar with the notification bell (data-dense admin/teacher UI) */}
        <header className="h-14 bg-card border-b border-border px-4 lg:px-6 flex items-center justify-end sticky top-0 z-30">
          <NotificationBell />
        </header>

        <PageContainer>
          <Outlet />
        </PageContainer>
      </div>

      <BottomTabBar items={navItems} />
    </div>
  );
}
