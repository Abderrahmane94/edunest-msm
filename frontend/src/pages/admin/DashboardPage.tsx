import { useTranslation } from 'react-i18next';
import {
  Users, ClipboardCheck, FileText, MessageCircle,
  Building2, Baby, PowerOff, TrendingUp, School,
  CheckCircle, GraduationCap,
} from 'lucide-react';
import { usePlatformStats, useAdminDashboard } from '@/hooks/useAdminDashboard';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Shared stat card ─── */
function StatCard({
  label,
  value,
  icon,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 hover:shadow-level-1 transition-shadow duration-150">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-caption text-text-secondary truncate">{label}</p>
        <p className="text-section font-bold text-text-heading mt-0.5">{value}</p>
        {sub && <p className="text-micro text-text-disabled mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Admin (school director) dashboard ─── */
function AdminDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: stats, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-hover rounded-2xl h-28 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-hover rounded-xl h-[88px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const schoolName = (user as any)?.schoolName;

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-light)] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <GraduationCap className="w-5 h-5 opacity-80" />
          <span className="text-caption opacity-80 font-medium uppercase tracking-wider">
            {t('dashboard.admin.overview')}
          </span>
        </div>
        <h2 className="text-section font-bold mb-0.5">
          {t('dashboard.admin.welcome', { name: user?.firstName })}
        </h2>
        {schoolName && (
          <p className="text-body opacity-80">{schoolName}</p>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.enrollment')}
          value={stats?.enrollmentCount ?? 0}
          icon={<Users className="w-5 h-5 text-primary" />}
          accent="bg-accent-muted"
          sub={t('dashboard.admin.activeChildren')}
        />
        <StatCard
          label={t('dashboard.attendanceRate')}
          value={stats?.attendanceRate != null ? `${stats.attendanceRate}%` : '—'}
          icon={<ClipboardCheck className="w-5 h-5 text-success" />}
          accent="bg-success-muted"
          sub={t('dashboard.admin.last30Days')}
        />
        <StatCard
          label={t('dashboard.outstandingInvoices')}
          value={stats?.outstandingInvoices ?? 0}
          icon={<FileText className="w-5 h-5 text-warning" />}
          accent="bg-warning-muted"
          sub={t('dashboard.admin.sentOrOverdue')}
        />
        <StatCard
          label={t('dashboard.unreadMessages')}
          value={stats?.unreadMessages ?? 0}
          icon={<MessageCircle className="w-5 h-5 text-text-secondary" />}
          accent="bg-subtle"
          sub={t('dashboard.admin.pendingReply')}
        />
      </div>
    </div>
  );
}

/* ─── Super admin platform dashboard ─── */
function SuperAdminDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: stats, isLoading } = usePlatformStats();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-hover rounded-2xl h-28 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-hover rounded-xl h-[88px] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-hover rounded-xl h-[88px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activeRate = stats?.totalSchools
    ? Math.round((stats.activeSchools / stats.totalSchools) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-light)] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="w-5 h-5 opacity-80" />
          <span className="text-caption opacity-80 font-medium uppercase tracking-wider">
            {t('dashboard.platform.overview')}
          </span>
        </div>
        <h2 className="text-section font-bold mb-1">
          {t('dashboard.platform.welcome', { name: user?.firstName })}
        </h2>
        <p className="text-body opacity-80">
          {t('dashboard.platform.subtitle', { count: stats?.totalSchools ?? 0 })}
        </p>
      </div>

      {/* Schools */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <School className="w-5 h-5 text-primary" />
          <h3 className="text-subsection font-semibold text-text-heading">
            {t('dashboard.platform.schools')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label={t('dashboard.platform.totalSchools')} value={stats?.totalSchools ?? 0}
            icon={<Building2 className="w-5 h-5 text-primary" />} accent="bg-accent-muted" />
          <StatCard label={t('dashboard.platform.activeSchools')} value={stats?.activeSchools ?? 0}
            icon={<CheckCircle className="w-5 h-5 text-success" />} accent="bg-success-muted" />
          <StatCard label={t('dashboard.platform.inactiveSchools')} value={stats?.inactiveSchools ?? 0}
            icon={<PowerOff className="w-5 h-5 text-danger" />} accent="bg-danger-muted" />
        </div>
        {(stats?.totalSchools ?? 0) > 0 && (
          <div className="mt-4 bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption text-text-secondary">{t('dashboard.platform.activeRate')}</span>
              <span className="text-label font-semibold text-success">{activeRate}%</span>
            </div>
            <div className="h-2 bg-subtle rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${activeRate}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* People */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-subsection font-semibold text-text-heading">
            {t('dashboard.platform.people')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label={t('dashboard.platform.totalUsers')} value={stats?.totalUsers ?? 0}
            icon={<Users className="w-5 h-5 text-primary" />} accent="bg-accent-muted" />
          <StatCard label={t('dashboard.platform.totalChildren')} value={stats?.totalChildren ?? 0}
            icon={<Baby className="w-5 h-5 text-warning" />} accent="bg-warning-muted" />
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-page-title font-semibold text-text-heading">
        {t('dashboard.title')}
      </h1>
      {user?.role === 'super_admin' ? <SuperAdminDashboard /> : <AdminDashboard />}
    </div>
  );
}
