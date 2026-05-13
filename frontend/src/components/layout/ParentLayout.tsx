import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { BottomTabBar } from './BottomTabBar';
import type { NavItem } from './Sidebar';

interface ParentLayoutProps {
  topBarContent?: React.ReactNode;
  navItems?: NavItem[];
}

export function ParentLayout({ navItems }: ParentLayoutProps) {
  const { logout, user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function toggleLanguage() {
    const newLang = i18n.language === 'ar' ? 'fr' : 'ar';
    i18n.changeLanguage(newLang);
    localStorage.setItem('preferred_language', newLang);
  }

  return (
    <div className="flex flex-col min-h-screen bg-page pb-16 lg:pb-0">
      {/* Top bar with branding, desktop nav, and actions */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-[900px] mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[var(--color-accent)] flex items-center justify-center">
              <span className="text-[var(--color-text-inverse)] text-micro font-semibold">E</span>
            </div>
            <span className="text-body font-semibold text-text-heading">EduNest</span>
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
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-caption font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-[var(--color-accent-subtle)] text-primary'
                        : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                    )
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span>{t(item.label, item.label)}</span>
                </NavLink>
              ))}
            </nav>
          )}

          {/* Right: User actions */}
          <div className="flex items-center gap-1">
            {user && (
              <span className="text-caption text-text-secondary hidden sm:inline me-2">
                {user.firstName}
              </span>
            )}
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
              onClick={handleLogout}
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-subtle text-text-secondary hover:text-danger transition-colors duration-150"
              aria-label="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <Outlet />
      {navItems && <BottomTabBar items={navItems} />}
    </div>
  );
}
