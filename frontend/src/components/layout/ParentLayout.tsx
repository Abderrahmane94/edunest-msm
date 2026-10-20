import { Link, NavLink, Outlet } from 'react-router-dom';
import { DemoBanner } from '@/components/DemoBanner';
import { PushNotificationsBanner } from '@/components/PushNotifications';
import { useTranslation } from 'react-i18next';
import { LogOut, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLogoutWithConfirm } from '@/components/LogoutConfirm';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadErrorBanner } from '@/components/LoadErrorBanner';
import { NotificationBell } from '@/components/NotificationBell';
import { OfflineStatus } from '@/components/OfflineStatus';
import { InstallAppButton } from '@/components/InstallAppButton';
import { BottomTabBar } from './BottomTabBar';
import { SchoolHeaderName } from './SchoolHeaderName';
import { NavBadge, type NavItem } from './Sidebar';
import { Avatar } from '@/components/ui';
import { useMyProfile } from '@/hooks/useMyProfile';

interface ParentLayoutProps {
  topBarContent?: React.ReactNode;
  navItems?: NavItem[];
}

export function ParentLayout({ navItems }: ParentLayoutProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { requestLogout, dialog: logoutDialog } = useLogoutWithConfirm();
  const { data: profile } = useMyProfile();

  function toggleLanguage() {
    const newLang = i18n.language === 'ar' ? 'fr' : 'ar';
    i18n.changeLanguage(newLang);
    localStorage.setItem('preferred_language', newLang);
  }

  return (
    <div className="flex flex-col min-h-screen bg-page pb-[calc(var(--tabbar-h)+0.5rem)] lg:pb-0">
      {/* Top bar with branding, desktop nav, and actions */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-[900px] mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left: the school's logo and name */}
          <div className="min-w-0 me-3">
            <SchoolHeaderName />
          </div>

          {/* Center: Desktop navigation */}
          {navItems && (
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/parent'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-full text-caption font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-[var(--color-accent-muted)] text-primary'
                        : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                    )
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span>{t(item.label, item.label)}</span>
                  <NavBadge count={item.badge} />
                </NavLink>
              ))}
            </nav>
          )}

          {/* Right: User actions */}
          <div className="flex items-center gap-1">
            {user && (
              <Link
                to="/parent/profile"
                className="flex items-center gap-2 rounded-full p-0.5 sm:pe-2 me-1 hover:bg-subtle transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-focus-ring"
                aria-label={t('myProfile.title')}
                title={t('myProfile.title')}
              >
                <Avatar src={profile?.avatarUrl} name={`${user.firstName} ${user.lastName}`} size="xs" />
                <span className="text-caption text-text-secondary hidden sm:inline">{user.firstName}</span>
              </Link>
            )}
            <OfflineStatus />
            <NotificationBell />
            <InstallAppButton variant="icon" />
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-subtle text-text-secondary hover:text-text-primary transition-colors duration-150"
              aria-label={i18n.language === 'ar' ? 'Français' : 'العربية'}
              title={i18n.language === 'ar' ? 'Français' : 'العربية'}
            >
              <Languages className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={requestLogout}
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-subtle text-text-secondary hover:text-danger transition-colors duration-150"
              aria-label={t('auth.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {logoutDialog}
      <LoadErrorBanner className="mx-4 mt-4 sm:mx-auto sm:max-w-[868px] sm:w-[calc(100%-2rem)]" />
      <DemoBanner className="mx-4 mt-4 !mb-0 sm:mx-auto sm:max-w-[868px] sm:w-[calc(100%-2rem)]" />
      <PushNotificationsBanner className="mx-4 mt-4 !mb-0 sm:mx-auto sm:max-w-[868px] sm:w-[calc(100%-2rem)]" />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      {navItems && <BottomTabBar items={navItems} />}
    </div>
  );
}
