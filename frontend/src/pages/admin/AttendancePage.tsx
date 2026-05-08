import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Calendar, BarChart2, Users } from 'lucide-react';
import { Button, DataTable, StatusBadge, KPICard } from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormSelect } from '@/components/forms';
import { useClassrooms, type Classroom } from '@/hooks/useClassrooms';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import {
  useClassroomAttendance,
  useClassroomMonthlyReport,
  type AttendanceRecord,
  type ChildAttendanceReportItem,
} from '@/hooks/useAttendance';

type ViewMode = 'daily' | 'monthly';

function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getMonthOptions(t: (key: string) => string) {
  return [
    { value: '1', label: t('attendance.months.january') },
    { value: '2', label: t('attendance.months.february') },
    { value: '3', label: t('attendance.months.march') },
    { value: '4', label: t('attendance.months.april') },
    { value: '5', label: t('attendance.months.may') },
    { value: '6', label: t('attendance.months.june') },
    { value: '7', label: t('attendance.months.july') },
    { value: '8', label: t('attendance.months.august') },
    { value: '9', label: t('attendance.months.september') },
    { value: '10', label: t('attendance.months.october') },
    { value: '11', label: t('attendance.months.november') },
    { value: '12', label: t('attendance.months.december') },
  ];
}

export function AttendancePage() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = React.useState<ViewMode>('daily');
  const [selectedClassroomId, setSelectedClassroomId] = React.useState<string>('');
  const [selectedDate, setSelectedDate] = React.useState<string>(getTodayString());
  const [selectedMonth, setSelectedMonth] = React.useState<number>(getCurrentMonth());
  const [selectedYear, setSelectedYear] = React.useState<number>(getCurrentYear());

  // Fetch classrooms for the active academic year
  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const { data: classrooms, isLoading: classroomsLoading } = useClassrooms(activeYear?.id);

  // Auto-select first classroom when data loads
  React.useEffect(() => {
    if (classrooms && classrooms.length > 0 && !selectedClassroomId) {
      setSelectedClassroomId(classrooms[0].id);
    }
  }, [classrooms, selectedClassroomId]);

  // Fetch daily attendance
  const {
    data: dailyRecords,
    isLoading: dailyLoading,
  } = useClassroomAttendance(
    viewMode === 'daily' ? selectedClassroomId : undefined,
    viewMode === 'daily' ? selectedDate : undefined
  );

  // Fetch monthly report
  const {
    data: monthlyReport,
    isLoading: monthlyLoading,
  } = useClassroomMonthlyReport(
    viewMode === 'monthly' ? selectedClassroomId : undefined,
    viewMode === 'monthly' ? selectedMonth : undefined,
    viewMode === 'monthly' ? selectedYear : undefined
  );

  const classroomOptions = (classrooms ?? []).map((c: Classroom) => ({
    value: c.id,
    label: `${c.name} (${c.level})`,
  }));

  // KPI stats from daily records
  const dailyStats = React.useMemo(() => {
    if (!dailyRecords || dailyRecords.length === 0) {
      return { total: 0, present: 0, absent: 0, late: 0, rate: 0 };
    }
    const total = dailyRecords.length;
    const present = dailyRecords.filter((r) => r.status === 'present').length;
    const absent = dailyRecords.filter((r) => r.status === 'absent').length;
    const late = dailyRecords.filter((r) => r.status === 'late').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, absent, late, rate };
  }, [dailyRecords]);

  // Monthly KPI stats
  const monthlyStats = React.useMemo(() => {
    if (!monthlyReport || monthlyReport.children.length === 0) {
      return { totalChildren: 0, totalDays: 0, avgRate: 0 };
    }
    const totalChildren = monthlyReport.children.length;
    const totalDays = monthlyReport.totalSchoolDays;
    const avgRate =
      totalChildren > 0
        ? Math.round(
            monthlyReport.children.reduce((sum, c) => sum + c.attendancePercentage, 0) /
              totalChildren
          )
        : 0;
    return { totalChildren, totalDays, avgRate };
  }, [monthlyReport]);

  // Daily attendance table columns
  const dailyColumns: Column<AttendanceRecord>[] = [
    {
      key: 'child_name',
      header: t('attendance.columns.childName'),
      sortable: true,
      render: (record) => (
        <span className="text-body font-medium text-foreground">
          {record.child.firstName} {record.child.lastName}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('attendance.columns.status'),
      sortable: true,
      render: (record) => (
        <StatusBadge variant={record.status}>
          {t(`attendance.statuses.${record.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'note',
      header: t('attendance.columns.note'),
      render: (record) => (
        <span className="text-body text-text-secondary">
          {record.note || '—'}
        </span>
      ),
    },
  ];

  // Monthly report table columns
  const monthlyColumns: Column<ChildAttendanceReportItem>[] = [
    {
      key: 'child_name',
      header: t('attendance.columns.childName'),
      sortable: true,
      render: (item) => (
        <span className="text-body font-medium text-foreground">
          {item.firstName} {item.lastName}
        </span>
      ),
    },
    {
      key: 'presentCount',
      header: t('attendance.columns.present'),
      sortable: true,
      render: (item) => (
        <span className="text-body text-success font-medium">{item.presentCount}</span>
      ),
    },
    {
      key: 'absentCount',
      header: t('attendance.columns.absent'),
      sortable: true,
      render: (item) => (
        <span className="text-body text-danger font-medium">{item.absentCount}</span>
      ),
    },
    {
      key: 'lateCount',
      header: t('attendance.columns.late'),
      sortable: true,
      render: (item) => (
        <span className="text-body text-warning font-medium">{item.lateCount}</span>
      ),
    },
    {
      key: 'attendancePercentage',
      header: t('attendance.columns.rate'),
      sortable: true,
      render: (item) => {
        const variant =
          item.attendancePercentage >= 90
            ? 'present'
            : item.attendancePercentage >= 75
              ? 'late'
              : 'absent';
        return (
          <StatusBadge variant={variant}>
            {item.attendancePercentage.toFixed(1)}%
          </StatusBadge>
        );
      },
    },
  ];

  // Year options for the year selector
  const yearOptions = React.useMemo(() => {
    const current = getCurrentYear();
    return [
      { value: String(current - 1), label: String(current - 1) },
      { value: String(current), label: String(current) },
      { value: String(current + 1), label: String(current + 1) },
    ];
  }, []);

  if (classroomsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('attendance.title')}
        </h1>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('attendance.title')}
          </h1>
          {activeYear && (
            <p className="text-caption text-text-secondary mt-1">
              {activeYear.name}
            </p>
          )}
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'daily' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setViewMode('daily')}
        >
          <Calendar className="w-4 h-4" />
          {t('attendance.dailyView')}
        </Button>
        <Button
          variant={viewMode === 'monthly' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setViewMode('monthly')}
        >
          <BarChart2 className="w-4 h-4" />
          {t('attendance.monthlyView')}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Classroom selector */}
          <FormSelect
            label={t('attendance.classroom')}
            name="classroom"
            value={selectedClassroomId}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
            options={classroomOptions}
            placeholder={t('attendance.selectClassroom')}
          />

          {viewMode === 'daily' ? (
            /* Date picker for daily view */
            <div className="flex flex-col gap-1 mb-4">
              <label
                htmlFor="attendance-date"
                className="text-label font-medium text-foreground"
              >
                {t('attendance.date')}
              </label>
              <input
                id="attendance-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150"
              />
            </div>
          ) : (
            /* Month and year selectors for monthly view */
            <>
              <FormSelect
                label={t('attendance.month')}
                name="month"
                value={String(selectedMonth)}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                options={getMonthOptions(t)}
              />
              <FormSelect
                label={t('attendance.year')}
                name="year"
                value={String(selectedYear)}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                options={yearOptions}
              />
            </>
          )}
        </div>
      </div>

      {/* No classroom selected state */}
      {!selectedClassroomId && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <ClipboardCheck className="w-8 h-8 text-text-disabled mx-auto mb-2" />
          <p className="text-body text-text-secondary">
            {t('attendance.selectClassroomPrompt')}
          </p>
        </div>
      )}

      {/* Daily view */}
      {viewMode === 'daily' && selectedClassroomId && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              label={t('attendance.kpi.total')}
              value={dailyStats.total}
              icon={<Users className="w-4 h-4" />}
            />
            <KPICard
              label={t('attendance.kpi.present')}
              value={dailyStats.present}
              icon={<ClipboardCheck className="w-4 h-4" />}
            />
            <KPICard
              label={t('attendance.kpi.absent')}
              value={dailyStats.absent}
            />
            <KPICard
              label={t('attendance.kpi.rate')}
              value={`${dailyStats.rate}%`}
            />
          </div>

          {/* Daily records table */}
          {dailyLoading ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-hover rounded-md" />
                ))}
              </div>
            </div>
          ) : (
            <DataTable<AttendanceRecord>
              columns={dailyColumns}
              data={dailyRecords ?? []}
              keyExtractor={(r) => r.id}
              emptyMessage={t('attendance.noRecords')}
            />
          )}
        </>
      )}

      {/* Monthly view */}
      {viewMode === 'monthly' && selectedClassroomId && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KPICard
              label={t('attendance.kpi.totalChildren')}
              value={monthlyStats.totalChildren}
              icon={<Users className="w-4 h-4" />}
            />
            <KPICard
              label={t('attendance.kpi.schoolDays')}
              value={monthlyStats.totalDays}
              icon={<Calendar className="w-4 h-4" />}
            />
            <KPICard
              label={t('attendance.kpi.avgRate')}
              value={`${monthlyStats.avgRate}%`}
              icon={<BarChart2 className="w-4 h-4" />}
            />
          </div>

          {/* Monthly report table */}
          {monthlyLoading ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-hover rounded-md" />
                ))}
              </div>
            </div>
          ) : (
            <DataTable<ChildAttendanceReportItem>
              columns={monthlyColumns}
              data={monthlyReport?.children ?? []}
              keyExtractor={(item) => item.childId}
              emptyMessage={t('attendance.noReportData')}
            />
          )}
        </>
      )}
    </div>
  );
}
