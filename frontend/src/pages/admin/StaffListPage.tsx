import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserCog } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { DataTable, StatusBadge } from '@/components/ui';
import type { Column } from '@/components/ui';
import { useUsers, type User } from '@/hooks/useUsers';
import { useStaffList, type StaffProfile } from '@/hooks/useStaff';

interface StaffRow {
  user: User;
  profile?: StaffProfile;
}

export function StaffListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');

  const pageSize = 10;

  // Fetch everyone (small school rosters), then filter/merge client-side —
  // the users list has no role filter and the staff list has no user data
  // beyond the linked profile, so neither endpoint alone can drive this page.
  const { data: usersData, isLoading: usersLoading } = useUsers({ pageSize: 100 });
  const { data: staffData, isLoading: staffLoading } = useStaffList({ pageSize: 100 });

  const rows = React.useMemo(() => {
    const profileByUserId = new Map((staffData?.profiles ?? []).map((p) => [p.user_id, p]));
    const staffUsers = (usersData?.users ?? []).filter((u) => u.role === 'teacher' || u.role === 'admin');
    const combined: StaffRow[] = staffUsers.map((user) => ({ user, profile: profileByUserId.get(user.id) }));

    if (!search.trim()) return combined;
    const q = search.trim().toLowerCase();
    return combined.filter(
      (row) =>
        `${row.user.first_name} ${row.user.last_name}`.toLowerCase().includes(q) ||
        row.user.email.toLowerCase().includes(q),
    );
  }, [usersData?.users, staffData?.profiles, search]);

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const isLoading = usersLoading || staffLoading;

  function handleSearch(query: string) {
    setSearch(query);
    setPage(1);
  }

  const columns: Column<StaffRow>[] = [
    {
      key: 'name',
      header: t('staff.columns.name'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] text-primary flex items-center justify-center text-label font-semibold">
            {row.user.first_name.charAt(0)}{row.user.last_name.charAt(0)}
          </div>
          <div>
            <p className="text-body font-medium text-foreground">
              {row.user.first_name} {row.user.last_name}
            </p>
            <p className="text-caption text-text-secondary">{row.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('staff.columns.role'),
      render: (row) => (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-micro font-medium bg-[var(--color-role-teacher-bg,#DBEAFE)] text-[var(--color-role-teacher,#1D4ED8)]">
          {t(`users.roles.${row.user.role}`)}
        </span>
      ),
    },
    {
      key: 'position',
      header: t('staff.columns.position'),
      render: (row) =>
        row.profile ? (
          <span className="text-body text-foreground">{row.profile.position}</span>
        ) : (
          <span className="text-body text-text-disabled">{t('staff.noProfileYet')}</span>
        ),
    },
    {
      key: 'contract_type',
      header: t('staff.columns.contractType'),
      render: (row) =>
        row.profile ? (
          <span className="text-body text-text-secondary">{t(`staff.contractTypes.${row.profile.contract_type}`)}</span>
        ) : (
          <span className="text-body text-text-disabled">—</span>
        ),
    },
    {
      key: 'contract_dates',
      header: t('staff.columns.contractDates'),
      render: (row) =>
        row.profile ? (
          <span className="text-caption text-text-secondary" dir="ltr">
            {formatDate(row.profile.contract_start)}
            {row.profile.contract_end ? ` – ${formatDate(row.profile.contract_end)}` : ''}
          </span>
        ) : (
          <span className="text-body text-text-disabled">—</span>
        ),
    },
    {
      key: 'is_active',
      header: t('staff.columns.status'),
      render: (row) => (
        <StatusBadge variant={row.user.is_active ? 'present' : 'cancelled'}>
          {row.user.is_active ? t('users.active') : t('users.inactive')}
        </StatusBadge>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <UserCog className="w-6 h-6 text-primary" />
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('staff.title')}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <UserCog className="w-6 h-6 text-primary" />
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('staff.title')}
        </h1>
      </div>

      <DataTable<StaffRow>
        columns={columns}
        data={pageRows}
        keyExtractor={(row) => row.user.id}
        onRowClick={(row) => navigate(`/admin/staff/${row.user.id}`)}
        searchable
        searchPlaceholder={t('staff.searchPlaceholder')}
        onSearch={handleSearch}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        emptyMessage={t('staff.noStaff')}
      />
    </div>
  );
}
