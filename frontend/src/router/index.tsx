import { Navigate, Outlet, useParams, useSearchParams, type RouteObject } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLogoutWithConfirm } from '@/components/LogoutConfirm';
import { usePreloadOfflinePayments } from '@/hooks/useOfflinePayments';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
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
  BillingPage,
  UsersPage,
  UserDetailPage,
  StaffListPage,
  StaffProfilePage,
  AcademicYearDetailPage,
  ClassroomsPage,
  ClassroomDetailPage,
  ChildrenPage,
  ChildDetailPage,
  AttendancePage,
  CommunicationPage,
  AnnouncementDetailPage,
  EventDetailPage,
  TrashPage,
  PayrollPage,
} from '@/pages/admin';
import {
  PaymentManagementPage,
  EnrollmentDetailPage,
} from '@/pages/admin/payments';
import { TeacherAttendancePage, TeacherDailyReportPage, TeacherMessagesPage, TeacherAnnouncementsPage, TeacherChildrenPage } from '@/pages/teacher';
import { ParentFeedPage, ParentMessagesPage, ParentAttendancePage, ParentNotificationsPage, ParentAnnouncementsPage, ParentPaymentsPage } from '@/pages/parent';
import { InstallAppButton } from '@/components/InstallAppButton';
import { AdminLayout, ParentLayout } from '@/components/layout';
import { BrandMark } from '@/components/layout/BrandMark';
import { Avatar } from '@/components/ui';
import type { NavItem } from '@/components/layout';
import { useSchool } from '@/hooks/useSchool';
import {
  LayoutDashboard,
  Users,
  UserCog,
  School,
  Baby,
  ClipboardCheck,
  MessageCircle,
  Wallet,
  Settings,
  CalendarDays,
  FileText,
  Bell,
  LogOut,
  Building2,
  Languages,
  Trash2,
  Banknote,
  Megaphone,
  CreditCard,
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


// ─── Navigation Items ────────────────────────────────────────────────────────

function getAdminNavItems(role: string): NavItem[] {
  // super_admin: platform-level only
  if (role === 'super_admin') {
    return [
      { label: 'nav.dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'nav.schools',   href: '/admin/schools', icon: Building2 },
      { label: 'nav.users',     href: '/admin/users', icon: Users },
      { label: 'nav.billing',   href: '/admin/billing', icon: Wallet },
      { label: 'nav.trash',     href: '/admin/trash', icon: Trash2 },
    ];
  }

  // admin (school director): full school management
  return [
    { label: 'nav.dashboard',     href: '/admin', icon: LayoutDashboard },
    { label: 'nav.users',         href: '/admin/users', icon: Users },
    { label: 'nav.staff',         href: '/admin/staff', icon: UserCog },
    { label: 'nav.classrooms',    href: '/admin/classrooms', icon: School },
    { label: 'nav.children',      href: '/admin/children', icon: Baby },
    { label: 'nav.attendance',    href: '/admin/attendance', icon: ClipboardCheck },
    { label: 'nav.communication', href: '/admin/communication', icon: MessageCircle },
    { label: 'nav.payments',      href: '/admin/payments', icon: CreditCard },
    { label: 'nav.payroll',       href: '/admin/payroll', icon: Banknote },
    { label: 'nav.settings',      href: '/admin/settings', icon: Settings },
  ];
}

const teacherNavItems: NavItem[] = [
  { label: 'nav.attendance', href: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'nav.reports', href: '/teacher/reports', icon: FileText },
  { label: 'nav.children', href: '/teacher/children', icon: Baby },
  { label: 'nav.messages', href: '/teacher/messages', icon: MessageCircle },
  { label: 'nav.announcements', href: '/teacher/announcements', icon: Megaphone },
];

const parentNavItems: NavItem[] = [
  { label: 'nav.reports', href: '/parent', icon: FileText },
  { label: 'nav.attendance', href: '/parent/attendance', icon: CalendarDays },
  { label: 'nav.messages', href: '/parent/messages', icon: MessageCircle },
  { label: 'nav.announcements', href: '/parent/announcements', icon: Megaphone },
  { label: 'nav.payments', href: '/parent/payments', icon: Wallet },
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
  const { user } = useAuth();
  const { t } = useTranslation();
  const { requestLogout, dialog: logoutDialog } = useLogoutWithConfirm();

  return (
    <div className="space-y-2">
      {user && (
        <div className="flex items-center gap-2 px-1 mb-2">
          <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-caption font-medium text-text-primary truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-micro text-text-secondary truncate">{user.email}</p>
          </div>
        </div>
      )}
      <InstallAppButton />
      <LanguageSwitcher />
      <button
        type="button"
        onClick={requestLogout}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-body font-medium text-text-secondary hover:bg-subtle hover:text-danger transition-all duration-150"
      >
        <LogOut className="w-5 h-5 shrink-0" />
        <span>{t('auth.logout')}</span>
      </button>
      {logoutDialog}
    </div>
  );
}

function SchoolSidebarHeader() {
  const { data: school } = useSchool();

  return (
    <div className="flex items-center gap-2 px-1">
      {school?.logo_url ? (
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
          <img src={school.logo_url} alt={school.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <BrandMark size={34} className="shrink-0" />
      )}
      <span className="font-playful text-body-lg font-bold leading-tight text-text-heading truncate">
        {school?.name || 'EduNest'}
      </span>
    </div>
  );
}

/** Keeps the échéances on an admin's device, for recording payments offline. */
function OfflinePaymentsPreloader() {
  const { branchId } = useDefaultBranch();
  usePreloadOfflinePayments(branchId, true);
  return null;
}

/** An old /admin/academic-years/:id link opens the same year under Settings. */
function OldAcademicYearRedirect() {
  const { yearId } = useParams<{ yearId: string }>();
  return <Navigate to={`/admin/settings/academic-years/${yearId}`} replace />;
}

/** The platform's trash stays a page; a school's trash is a tab of its Settings. */
function TrashRoute() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  if (user?.role === 'super_admin') return <TrashPage />;
  const section = params.get('tab');
  return <Navigate to={`/admin/settings?tab=trash${section ? `&section=${section}` : ''}`} replace />;
}

function AdminLayoutWrapper() {
  const { user } = useAuth();
  const navItems = getAdminNavItems(user?.role || 'admin');
  const isAdmin = user?.role === 'admin';

  return (
    <>
      {isAdmin && <OfflinePaymentsPreloader />}
      <AdminLayout
        navItems={navItems}
        sidebarHeader={
          isAdmin ? (
            <SchoolSidebarHeader />
          ) : (
            <div className="flex items-center gap-2 px-1">
              <BrandMark size={34} className="shrink-0" />
              <span className="font-playful text-[19px] font-extrabold leading-none" dir="ltr"><span className="text-text-heading">Edu</span><span className="text-primary">Nest</span></span>
            </div>
          )
        }
        sidebarFooter={<SidebarFooterContent />}
      />
    </>
  );
}

function TeacherLayoutWrapper() {
  return (
    <AdminLayout
      navItems={teacherNavItems}
      sidebarHeader={
        <div className="flex items-center gap-2 px-1">
          <BrandMark size={34} className="shrink-0" />
          <span className="font-playful text-[19px] font-extrabold leading-none" dir="ltr"><span className="text-text-heading">Edu</span><span className="text-primary">Nest</span></span>
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
              // Academic years moved into Settings; old links still land there.
              { path: 'academic-years', element: <Navigate to="/admin/settings?tab=years" replace /> },
              { path: 'academic-years/:yearId', element: <OldAcademicYearRedirect /> },
              { path: 'classrooms', element: <ClassroomsPage /> },
              { path: 'classrooms/:classroomId', element: <ClassroomDetailPage /> },
              { path: 'timetable', element: <Navigate to="/admin/settings?tab=days" replace /> },
              { path: 'children', element: <ChildrenPage /> },
              { path: 'children/:childId', element: <ChildDetailPage /> },
              { path: 'attendance', element: <AttendancePage /> },
              { path: 'communication', element: <CommunicationPage /> },
              { path: 'communication/announcements/:announcementId', element: <AnnouncementDetailPage /> },
              { path: 'communication/events/:eventId', element: <EventDetailPage /> },
              { path: 'billing', element: <BillingPage /> },
              { path: 'payroll', element: <PayrollPage /> },
              { path: 'payments', element: <PaymentManagementPage /> },
              { path: 'payments/enrollments/:enrollmentId', element: <EnrollmentDetailPage /> },
              { path: 'trash', element: <TrashRoute /> },
              { path: 'settings', element: <SchoolSettingsPage /> },
              { path: 'settings/academic-years/:yearId', element: <AcademicYearDetailPage /> },
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
              { path: 'children', element: <TeacherChildrenPage /> },
              { path: 'messages', element: <TeacherMessagesPage /> },
              { path: 'announcements', element: <TeacherAnnouncementsPage /> },
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
              { path: 'announcements', element: <ParentAnnouncementsPage /> },
              { path: 'payments', element: <ParentPaymentsPage /> },
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
