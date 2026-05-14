import { Navigate, Outlet, useNavigate, type RouteObject } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  LoginPage,
  RegisterPage,
  ResetPasswordRequestPage,
  ResetPasswordConfirmPage,
  ChangePasswordPage,
} from '@/pages/auth';
import {
  DashboardPage,
  SchoolSettingsPage,
  SchoolsPage,
  SchoolDetailPage,
  UsersPage,
  UserDetailPage,
  StaffListPage,
  StaffProfilePage,
  AcademicYearsPage,
  AcademicYearDetailPage,
  ClassroomsPage,
  ClassroomDetailPage,
  ChildrenPage,
  ChildDetailPage,
  AttendancePage,
  CommunicationPage,
  AnnouncementDetailPage,
  EventDetailPage,
  FinancePage,
  FeeStructureDetailPage,
  InvoiceDetailPage,
  ExpenseDetailPage,
} from '@/pages/admin';
import { TeacherAttendancePage, TeacherDailyReportPage, TeacherMessagesPage } from '@/pages/teacher';
import { ParentFeedPage, ParentMessagesPage, ParentAttendancePage, ParentNotificationsPage, ParentInvoicesPage } from '@/pages/parent';
import { AdminLayout, ParentLayout } from '@/components/layout';
import type { NavItem } from '@/components/layout';
import {
  LayoutDashboard,
  Users,
  UserCog,
  GraduationCap,
  School,
  Baby,
  ClipboardCheck,
  MessageCircle,
  Wallet,
  Settings,
  CalendarDays,
  FileText,
  Bell,
  Receipt,
  LogOut,
  Building2,
  Languages,
} from 'lucide-react';

/**
 * Protects routes that require authentication.
 * Redirects to /login if not authenticated.
 */
function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Intercept first-login: force password change before accessing any page
  if (user?.mustChangePassword) {
    return <ChangePasswordPage />;
  }

  return <Outlet />;
}

/**
 * Protects routes that require a specific role.
 * Redirects to the user's default portal if role doesn't match.
 */
function RoleRoute({ allowedRoles }: { allowedRoles: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    // Redirect to the user's default portal
    const defaultPath = getDefaultPath(user?.role);
    return <Navigate to={defaultPath} replace />;
  }

  return <Outlet />;
}

function getDefaultPath(role?: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/admin';
    case 'teacher':
      return '/teacher';
    case 'parent':
      return '/parent';
    default:
      return '/login';
  }
}

/**
 * Placeholder component for routes that haven't been implemented yet.
 */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-color-text-secondary">{title}</p>
    </div>
  );
}

// ─── Navigation Items ────────────────────────────────────────────────────────

function getAdminNavItems(role: string): NavItem[] {
  const items: NavItem[] = [
    { label: 'nav.dashboard', href: '/admin', icon: LayoutDashboard },
  ];

  if (role === 'super_admin') {
    items.push({ label: 'nav.schools', href: '/admin/schools', icon: Building2 });
  }

  items.push(
    { label: 'nav.users', href: '/admin/users', icon: Users },
    { label: 'nav.staff', href: '/admin/staff', icon: UserCog },
    { label: 'nav.academicYears', href: '/admin/academic-years', icon: GraduationCap },
    { label: 'nav.classrooms', href: '/admin/classrooms', icon: School },
    { label: 'nav.children', href: '/admin/children', icon: Baby },
    { label: 'nav.attendance', href: '/admin/attendance', icon: ClipboardCheck },
    { label: 'nav.communication', href: '/admin/communication', icon: MessageCircle },
    { label: 'nav.finance', href: '/admin/finance', icon: Wallet },
  );

  if (role === 'admin') {
    items.push({ label: 'nav.settings', href: '/admin/settings', icon: Settings });
  }

  return items;
}

const teacherNavItems: NavItem[] = [
  { label: 'nav.attendance', href: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'nav.reports', href: '/teacher/reports', icon: FileText },
  { label: 'nav.messages', href: '/teacher/messages', icon: MessageCircle },
];

const parentNavItems: NavItem[] = [
  { label: 'nav.reports', href: '/parent', icon: FileText },
  { label: 'nav.attendance', href: '/parent/attendance', icon: CalendarDays },
  { label: 'nav.messages', href: '/parent/messages', icon: MessageCircle },
  { label: 'nav.invoices', href: '/parent/invoices', icon: Receipt },
  { label: 'nav.notifications', href: '/parent/notifications', icon: Bell },
];

// ─── Layout Wrappers ─────────────────────────────────────────────────────────

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  function toggleLanguage() {
    const newLang = currentLang === 'ar' ? 'fr' : 'ar';
    i18n.changeLanguage(newLang);
    localStorage.setItem('preferred_language', newLang);
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-body font-medium text-text-secondary hover:bg-subtle hover:text-text-primary transition-all duration-150"
      aria-label={currentLang === 'ar' ? 'Passer en français' : 'التبديل إلى العربية'}
    >
      <Languages className="w-5 h-5 shrink-0" />
      <span>{currentLang === 'ar' ? 'Français' : 'العربية'}</span>
    </button>
  );
}

function SidebarFooterContent() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="space-y-2">
      {user && (
        <div className="flex items-center gap-2 px-1 mb-2">
          <div className="w-7 h-7 rounded-full bg-subtle flex items-center justify-center text-micro font-semibold text-text-secondary">
            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-caption font-medium text-text-primary truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-micro text-text-secondary truncate">{user.email}</p>
          </div>
        </div>
      )}
      <LanguageSwitcher />
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-body font-medium text-text-secondary hover:bg-subtle hover:text-danger transition-all duration-150"
      >
        <LogOut className="w-5 h-5 shrink-0" />
        <span>Déconnexion</span>
      </button>
    </div>
  );
}

function AdminLayoutWrapper() {
  const { user } = useAuth();
  const navItems = getAdminNavItems(user?.role || 'admin');

  return (
    <AdminLayout
      navItems={navItems}
      sidebarHeader={
        <div className="flex items-center gap-2 px-1">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
            <span className="text-[var(--color-text-inverse)] text-label font-semibold">E</span>
          </div>
          <span className="text-body font-semibold text-text-heading">EduNest</span>
        </div>
      }
      sidebarFooter={<SidebarFooterContent />}
    />
  );
}

function TeacherLayoutWrapper() {
  return (
    <AdminLayout
      navItems={teacherNavItems}
      sidebarHeader={
        <div className="flex items-center gap-2 px-1">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
            <span className="text-[var(--color-text-inverse)] text-label font-semibold">E</span>
          </div>
          <span className="text-body font-semibold text-text-heading">EduNest</span>
        </div>
      }
      sidebarFooter={<SidebarFooterContent />}
    />
  );
}

function ParentLayoutWrapper() {
  return <ParentLayout navItems={parentNavItems} />;
}

export const routes: RouteObject[] = [
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordRequestPage />,
  },
  {
    path: '/reset-password/confirm',
    element: <ResetPasswordConfirmPage />,
  },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      // Admin portal
      {
        path: '/admin',
        element: <RoleRoute allowedRoles={['super_admin', 'admin']} />,
        children: [
          {
            element: <AdminLayoutWrapper />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'schools', element: <SchoolsPage /> },
              { path: 'schools/:schoolId', element: <SchoolDetailPage /> },
              { path: 'users', element: <UsersPage /> },
              { path: 'users/:userId', element: <UserDetailPage /> },
              { path: 'staff', element: <StaffListPage /> },
              { path: 'staff/:userId', element: <StaffProfilePage /> },
              { path: 'academic-years', element: <AcademicYearsPage /> },
              { path: 'academic-years/:yearId', element: <AcademicYearDetailPage /> },
              { path: 'classrooms', element: <ClassroomsPage /> },
              { path: 'classrooms/:classroomId', element: <ClassroomDetailPage /> },
              { path: 'children', element: <ChildrenPage /> },
              { path: 'children/:childId', element: <ChildDetailPage /> },
              { path: 'attendance', element: <AttendancePage /> },
              { path: 'communication', element: <CommunicationPage /> },
              { path: 'communication/announcements/:announcementId', element: <AnnouncementDetailPage /> },
              { path: 'communication/events/:eventId', element: <EventDetailPage /> },
              { path: 'finance', element: <FinancePage /> },
              { path: 'finance/fees/:feeId', element: <FeeStructureDetailPage /> },
              { path: 'finance/invoices/:invoiceId', element: <InvoiceDetailPage /> },
              { path: 'finance/expenses/:expenseId', element: <ExpenseDetailPage /> },
              { path: 'settings', element: <SchoolSettingsPage /> },
            ],
          },
        ],
      },

      // Teacher portal
      {
        path: '/teacher',
        element: <RoleRoute allowedRoles={['teacher']} />,
        children: [
          {
            element: <TeacherLayoutWrapper />,
            children: [
              { index: true, element: <TeacherAttendancePage /> },
              { path: 'attendance', element: <TeacherAttendancePage /> },
              { path: 'reports', element: <TeacherDailyReportPage /> },
              { path: 'messages', element: <TeacherMessagesPage /> },
            ],
          },
        ],
      },

      // Parent portal
      {
        path: '/parent',
        element: <RoleRoute allowedRoles={['parent']} />,
        children: [
          {
            element: <ParentLayoutWrapper />,
            children: [
              { index: true, element: <ParentFeedPage /> },
              { path: 'attendance', element: <ParentAttendancePage /> },
              { path: 'messages', element: <ParentMessagesPage /> },
              { path: 'invoices', element: <ParentInvoicesPage /> },
              { path: 'notifications', element: <ParentNotificationsPage /> },
            ],
          },
        ],
      },
    ],
  },

  // Catch-all redirect
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
];
