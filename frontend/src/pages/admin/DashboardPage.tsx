import { useTranslation } from 'react-i18next';
import { Users, ClipboardCheck, FileText, MessageCircle } from 'lucide-react';
import { KPICard } from '@/components/ui';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('dashboard.title')}
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-hover rounded-[10px] p-4 h-[88px] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: t('dashboard.enrollment'),
      value: stats?.enrollmentCount ?? 0,
      trend: stats?.enrollmentTrend,
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: t('dashboard.attendanceRate'),
      value: stats?.attendanceRate != null ? `${stats.attendanceRate}%` : '—',
      trend: stats?.attendanceTrend,
      icon: <ClipboardCheck className="w-4 h-4" />,
    },
    {
      label: t('dashboard.outstandingInvoices'),
      value: stats?.outstandingInvoices ?? 0,
      trend: stats?.invoiceTrend,
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: t('dashboard.unreadMessages'),
      value: stats?.unreadMessages ?? 0,
      trend: stats?.messageTrend,
      icon: <MessageCircle className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-page-title font-semibold text-text-heading">
        {t('dashboard.title')}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpiCards.map((card) => (
          <KPICard
            key={card.label}
            label={card.label}
            value={card.value}
            trend={card.trend}
            icon={card.icon}
          />
        ))}
      </div>
    </div>
  );
}
