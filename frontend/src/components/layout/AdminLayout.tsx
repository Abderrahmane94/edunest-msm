import { Outlet } from 'react-router-dom';
import { Sidebar, type NavItem } from './Sidebar';
import { PageContainer } from './PageContainer';
import { BottomTabBar } from './BottomTabBar';

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
        <PageContainer>
          <Outlet />
        </PageContainer>
      </div>

      <BottomTabBar items={navItems} />
    </div>
  );
}
