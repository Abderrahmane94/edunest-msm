import { Link, Navigate, Outlet, useParams, useSearchParams, type RouteObject } from 'react-router-dom';
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
import { lazyPage, usePreloadPages } from './lazyPage';

// Each page is its own file, downloaded when first opened (see lazyPage).
const DashboardPage = lazyPage('office', () => import('@/pages/admin/DashboardPage').then((m) => m.DashboardPage));
const SchoolSettingsPage = lazyPage('office', () => import('@/pages/admin/SchoolSettingsPage').then((m) => m.SchoolSettingsPage));
const UsersPage = lazyPage('office', () => import('@/pages/admin/UsersPage').then((m) => m.UsersPage));
const UserDetailPage = lazyPage('office', () => import('@/pages/admin/UserDetailPage').then((m) => m.UserDetailPage));
const StaffListPage = lazyPage('office', () => import('@/pages/admin/StaffListPage').then((m) => m.StaffListPage));
const StaffProfilePage = lazyPage('office', () => import('@/pages/admin/StaffProfilePage').then((m) => m.StaffProfilePage));
const AcademicYearDetailPage = lazyPage('office', () => import('@/pages/admin/AcademicYearDetailPage').then((m) => m.AcademicYearDetailPage));
const YearRolloverPage = lazyPage('office', () => import('@/pages/admin/YearRolloverPage').then((m) => m.YearRolloverPage));
const InventoryPage = lazyPage('office', () => import('@/pages/admin/InventoryPage').then((m) => m.InventoryPage));
const DocumentsPage = lazyPage('office', () => import('@/pages/admin/DocumentsPage').then((m) => m.DocumentsPage));
const PlanningPage = lazyPage('office', () => import('@/pages/admin/PlanningPage').then((m) => m.PlanningPage));
const ClassroomsPage = lazyPage('office', () => import('@/pages/admin/ClassroomsPage').then((m) => m.ClassroomsPage));
const ClassroomDetailPage = lazyPage('office', () => import('@/pages/admin/ClassroomDetailPage').then((m) => m.ClassroomDetailPage));
const ChildrenPage = lazyPage('office', () => import('@/pages/admin/ChildrenPage').then((m) => m.ChildrenPage));
const ChildDetailPage = lazyPage('office', () => import('@/pages/admin/ChildDetailPage').then((m) => m.ChildDetailPage));
const AttendancePage = lazyPage('office', () => import('@/pages/admin/AttendancePage').then((m) => m.AttendancePage));
const CommunicationPage = lazyPage('office', () => import('@/pages/admin/CommunicationPage').then((m) => m.CommunicationPage));
const AnnouncementDetailPage = lazyPage('office', () => import('@/pages/admin/AnnouncementDetailPage').then((m) => m.AnnouncementDetailPage));
const EventDetailPage = lazyPage('office', () => import('@/pages/admin/EventDetailPage').then((m) => m.EventDetailPage));
const PayrollPage = lazyPage('office', () => import('@/pages/admin/PayrollPage').then((m) => m.PayrollPage));
const TrashPage = lazyPage('platform', () => import('@/pages/admin/TrashPage').then((m) => m.TrashPage));
const SchoolsPage = lazyPage('platform', () => import('@/pages/admin/SchoolsPage').then((m) => m.SchoolsPage));
const SchoolDetailPage = lazyPage('platform', () => import('@/pages/admin/SchoolDetailPage').then((m) => m.SchoolDetailPage));
const BillingPage = lazyPage('platform', () => import('@/pages/admin/BillingPage').then((m) => m.BillingPage));
const PaymentManagementPage = lazyPage('office', () => import('@/pages/admin/payments/PaymentManagementPage').then((m) => m.PaymentManagementPage));
const EnrollmentDetailPage = lazyPage('office', () => import('@/pages/admin/payments/EnrollmentDetailPage').then((m) => m.EnrollmentDetailPage));
const TeacherAttendancePage = lazyPage('teacher', () => import('@/pages/teacher/TeacherAttendancePage').then((m) => m.TeacherAttendancePage));
const TeacherDailyReportPage = lazyPage('teacher', () => import('@/pages/teacher/TeacherDailyReportPage').then((m) => m.TeacherDailyReportPage));
const TeacherMessagesPage = lazyPage('teacher', () => import('@/pages/teacher/TeacherMessagesPage').then((m) => m.TeacherMessagesPage));
const TeacherAnnouncementsPage = lazyPage('teacher', () => import('@/pages/teacher/TeacherAnnouncementsPage').then((m) => m.TeacherAnnouncementsPage));
const TeacherChildrenPage = lazyPage('teacher', () => import('@/pages/teacher/TeacherChildrenPage').then((m) => m.TeacherChildrenPage));
const TeacherSuppliesPage = lazyPage('teacher', () => import('@/pages/teacher/TeacherSuppliesPage').then((m) => m.TeacherSuppliesPage));
const TeacherPlanningPage = lazyPage('teacher', () => import('@/pages/teacher/TeacherPlanningPage').then((m) => m.TeacherPlanningPage));
const ParentFeedPage = lazyPage('parent', () => import('@/pages/parent/ParentFeedPage').then((m) => m.ParentFeedPage));
const ParentMessagesPage = lazyPage('parent', () => import('@/pages/parent/ParentMessagesPage').then((m) => m.ParentMessagesPage));
const ParentAttendancePage = lazyPage('parent', () => import('@/pages/parent/ParentAttendancePage').then((m) => m.ParentAttendancePage));
const ParentNotificationsPage = lazyPage('parent', () => import('@/pages/parent/ParentNotificationsPage').then((m) => m.ParentNotificationsPage));
const ParentAnnouncementsPage = lazyPage('parent', () => import('@/pages/parent/ParentAnnouncementsPage').then((m) => m.ParentAnnouncementsPage));
const ParentPaymentsPage = lazyPage('parent', () => import('@/pages/parent/ParentPaymentsPage').then((m) => m.ParentPaymentsPage));
const ParentDocumentsPage = lazyPage('parent', () => import('@/pages/parent/ParentDocumentsPage').then((m) => m.ParentDocumentsPage));
import { InstallAppButton } from '@/components/InstallAppButton';
import { AdminLayout, ParentLayout } from '@/components/layout';
import { YearBanner, YearSwitcher } from '@/components/layout/YearSwitcher';
import { BrandMark } from '@/components/layout/BrandMark';
import { Avatar } from '@/components/ui';
import type { NavItem } from '@/components/layout';
import { useSchool } from '@/hooks/useSchool';
import { useOfficeNavCounts, usePersonalNavCounts } from '@/hooks/useNavCounts';
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
  Package,
  FolderOpen,
  CalendarClock,
} from 'lucide-react';
import { SubstitutionBanner, TeacherClassSwitcher } from '@/components/layout/TeacherClassSwitcher';
import { usePermissions, type Area } from '@/lib/roles';

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
    case 'administrative':
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

function getAdminNavItems(role: string, can: (area: Area) => boolean): NavItem[] {
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

  // The director sees everything; the office staff, the areas their profile opens.
  const items: (NavItem & { area?: Area | Area[] })[] = [
    // Every day: the children and their classes.
    { label: 'nav.dashboard',     href: '/admin', icon: LayoutDashboard, section: 'daily', tab: true },
    { label: 'nav.attendance',    href: '/admin/attendance', icon: ClipboardCheck, area: 'classes', section: 'daily', tab: true },
    { label: 'nav.children',      href: '/admin/children', icon: Baby, area: 'children', section: 'daily', tab: true },
    { label: 'nav.classrooms',    href: '/admin/classrooms', icon: School, area: 'classes', section: 'daily' },
    { label: 'nav.communication', href: '/admin/communication', icon: MessageCircle, area: 'communication', section: 'daily' },
    // The money and the supplies.
    { label: 'nav.payments',      href: '/admin/payments', icon: CreditCard, area: PAYMENT_AREAS, section: 'management', tab: true },
    { label: 'nav.payroll',       href: '/admin/payroll', icon: Banknote, area: 'payroll', section: 'management' },
    { label: 'nav.inventory',     href: '/admin/inventory', icon: Package, area: 'inventory', section: 'management' },
    // The accounts and the school's settings.
    { label: 'nav.users',         href: '/admin/users', icon: Users, area: 'staff', section: 'administration' },
    { label: 'nav.staff',         href: '/admin/staff', icon: UserCog, area: 'staff', section: 'administration' },
    // Everyone of the office: the team's week for who manages it, their own for the others.
    { label: 'nav.planning',      href: '/admin/planning', icon: CalendarClock, section: 'administration' },
    { label: 'nav.documents',     href: '/admin/documents', icon: FolderOpen, area: 'documents', section: 'administration' },
    { label: 'nav.settings',      href: '/admin/settings', icon: Settings, area: 'settings', section: 'administration' },
  ];
  return items
    .filter((item) => !item.area || (Array.isArray(item.area) ? item.area : [item.area]).some((a) => can(a)))
    .map(({ area: _area, ...item }) => item);
}

/** The payments page opens with any of its tabs' rights. */
const PAYMENT_AREAS: Area[] = ['collections', 'expenses', 'fees'];

/** A page of an area: the office staff without the right land on the dashboard. */
function PermissionRoute({ area, level = 'view' }: { area: Area | Area[]; level?: 'view' | 'edit' }) {
  const { can, ready } = usePermissions();
  const { user } = useAuth();
  if (!ready) return null;
  const areas = Array.isArray(area) ? area : [area];
  // The platform account belongs to no school: a school's own pages have nothing to show it.
  if (user?.role === 'super_admin' && !areas.some((a) => PLATFORM_AREAS.includes(a))) return <Navigate to="/admin" replace />;
  return areas.some((a) => can(a, level)) ? <Outlet /> : <Navigate to="/admin" replace />;
}

/** The areas the platform account works in (accounts, settings); the others are a school's daily life. */
const PLATFORM_AREAS: Area[] = ['staff', 'settings'];

/** A school's page with no area of its own: not for the platform account. */
function SchoolRoute() {
  const { user } = useAuth();
  return user?.role === 'super_admin' ? <Navigate to="/admin" replace /> : <Outlet />;
}

const teacherNavItems: NavItem[] = [
  { label: 'nav.attendance', href: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'nav.reports', href: '/teacher/reports', icon: FileText },
  { label: 'nav.children', href: '/teacher/children', icon: Baby },
  { label: 'nav.supplies', href: '/teacher/supplies', icon: Package },
  { label: 'nav.messages', href: '/teacher/messages', icon: MessageCircle },
  { label: 'nav.announcements', href: '/teacher/announcements', icon: Megaphone },
  { label: 'nav.planning', href: '/teacher/planning', icon: CalendarClock },
];

const parentNavItems: NavItem[] = [
  { label: 'nav.reports', href: '/parent', icon: FileText },
  { label: 'nav.attendance', href: '/parent/attendance', icon: CalendarDays },
  { label: 'nav.messages', href: '/parent/messages', icon: MessageCircle },
  { label: 'nav.announcements', href: '/parent/announcements', icon: Megaphone },
  { label: 'nav.payments', href: '/parent/payments', icon: Wallet },
  { label: 'nav.documents', href: '/parent/documents', icon: FolderOpen },
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

/** Top of the office menu: who is in today, and the roll calls still to do. */
function TodayStatus({ present, expected, callsMissing }: { present: number; expected: number; callsMissing: number }) {
  const { t } = useTranslation();
  const rate = expected > 0 ? Math.min(100, Math.round((present / expected) * 100)) : 0;
  return (
    <Link
      to="/admin/attendance"
      className="block rounded-xl bg-[var(--color-accent-subtle)] px-3 py-2 hover:bg-[var(--color-accent-muted)] transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-micro font-semibold text-text-secondary">{t('navStatus.present')}</span>
        <span className="text-body font-bold text-text-heading tabular-nums" dir="ltr">
          {present} / {expected}
        </span>
      </span>
      <span className="mt-1 block h-1.5 rounded-full bg-white overflow-hidden">
        <span className="block h-full rounded-full bg-success" style={{ width: `${rate}%` }} />
      </span>
      {callsMissing > 0 && <span className="mt-1 block text-micro font-medium text-warning">{t('navStatus.callsMissing', { count: callsMissing })}</span>}
    </Link>
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
  const { can } = usePermissions();
  // The school's office: the director and the administrative staff (not super_admin).
  const isAdmin = user?.role === 'admin' || user?.role === 'administrative';
  usePreloadPages(isAdmin ? 'office' : 'platform');
  const { counts, today } = useOfficeNavCounts(isAdmin);
  const navItems = getAdminNavItems(user?.role || 'admin', can).map((item) => ({ ...item, badge: counts[item.href] }));

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
        sidebarStatus={today ? <TodayStatus {...today} /> : undefined}
        yearSwitcher={isAdmin ? <YearSwitcher /> : undefined}
        yearBanner={isAdmin ? <YearBanner /> : undefined}
      />
    </>
  );
}

function TeacherLayoutWrapper() {
  usePreloadPages('teacher');
  const counts = usePersonalNavCounts();
  return (
    <AdminLayout
      navItems={teacherNavItems.map((item) => ({ ...item, badge: counts[item.href] }))}
      sidebarHeader={
        <div className="flex items-center gap-2 px-1">
          <BrandMark size={34} className="shrink-0" />
          <span className="font-playful text-[19px] font-extrabold leading-none" dir="ltr"><span className="text-text-heading">Edu</span><span className="text-primary">Nest</span></span>
        </div>
      }
      sidebarFooter={<SidebarFooterContent />}
      yearSwitcher={<TeacherClassSwitcher />}
      yearBanner={<SubstitutionBanner />}
    />
  );
}

function ParentLayoutWrapper() {
  usePreloadPages('parent');
  const counts = usePersonalNavCounts();
  return <ParentLayout navItems={parentNavItems.map((item) => ({ ...item, badge: counts[item.href] }))} />;
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
        element: <RoleRoute allowedRoles={['super_admin', 'admin', 'administrative']} />,
        children: [
          {
            element: <AdminLayoutWrapper />,
            children: [
              { index: true, element: <DashboardPage /> },
              // The platform's pages (super_admin) and the director's.
              {
                element: <RoleRoute allowedRoles={['super_admin', 'admin']} />,
                children: [
                  { path: 'schools', element: <SchoolsPage /> },
                  { path: 'schools/:schoolId', element: <SchoolDetailPage /> },
                  { path: 'billing', element: <BillingPage /> },
                ],
              },
              // Each area's pages, open to the office staff whose profile allows it.
              {
                element: <PermissionRoute area="staff" />,
                children: [
                  { path: 'users', element: <UsersPage /> },
                  { path: 'users/:userId', element: <UserDetailPage /> },
                  { path: 'staff', element: <StaffListPage /> },
                  { path: 'staff/:userId', element: <StaffProfilePage /> },
                ],
              },
              { element: <PermissionRoute area="payroll" />, children: [{ path: 'payroll', element: <PayrollPage /> }] },
              {
                // Billing management (discounts, withdrawal): to manage the fees.
                element: <PermissionRoute area="fees" level="edit" />,
                children: [{ path: 'payments/enrollments/:enrollmentId', element: <EnrollmentDetailPage /> }],
              },
              {
                element: <PermissionRoute area="settings" />,
                children: [
                  // Academic years moved into Settings; old links still land there.
                  { path: 'academic-years', element: <Navigate to="/admin/settings?tab=years" replace /> },
                  { path: 'academic-years/:yearId', element: <OldAcademicYearRedirect /> },
                  { path: 'timetable', element: <Navigate to="/admin/settings?tab=days" replace /> },
                  { path: 'trash', element: <TrashRoute /> },
                  { path: 'settings', element: <SchoolSettingsPage /> },
                  { path: 'settings/academic-years/:yearId', element: <AcademicYearDetailPage /> },
                  { path: 'settings/academic-years/:yearId/prepare', element: <YearRolloverPage /> },
                ],
              },
              {
                element: <PermissionRoute area="classes" />,
                children: [
                  { path: 'classrooms', element: <ClassroomsPage /> },
                  { path: 'classrooms/:classroomId', element: <ClassroomDetailPage /> },
                  { path: 'attendance', element: <AttendancePage /> },
                ],
              },
              {
                element: <PermissionRoute area="children" />,
                children: [
                  { path: 'children', element: <ChildrenPage /> },
                  { path: 'children/:childId', element: <ChildDetailPage /> },
                ],
              },
              {
                element: <PermissionRoute area="communication" />,
                children: [
                  { path: 'communication', element: <CommunicationPage /> },
                  { path: 'communication/announcements/:announcementId', element: <AnnouncementDetailPage /> },
                  { path: 'communication/events/:eventId', element: <EventDetailPage /> },
                ],
              },
              { element: <PermissionRoute area="inventory" />, children: [{ path: 'inventory', element: <InventoryPage /> }] },
              { element: <PermissionRoute area="documents" />, children: [{ path: 'documents', element: <DocumentsPage /> }] },
              { element: <SchoolRoute />, children: [{ path: 'planning', element: <PlanningPage /> }] },
              { element: <PermissionRoute area={PAYMENT_AREAS} />, children: [{ path: 'payments', element: <PaymentManagementPage /> }] },
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
              { path: 'supplies', element: <TeacherSuppliesPage /> },
              { path: 'planning', element: <TeacherPlanningPage /> },
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
              { path: 'documents', element: <ParentDocumentsPage /> },
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
