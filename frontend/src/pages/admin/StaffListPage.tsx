import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserCog } from 'lucide-react';
import { DataTable, StatusBadge } from '@/components/ui';
import type { Column } from '@/components/ui';
import { useUsers, type User } from '@/hooks/useUsers';

export function StaffListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState<string>('created_at');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  const pageSize = 10;

  // Staff are users with role teacher or admin
  const { data, isLoading } = useUsers({
    page,
    pageSize,
    search: search || undefined,
    sortColumn,
    sortDirection,
  });

  // Filter to staff roles (teacher, admin) on the client side
  // In a real implementation, the API would support role filtering
  const staffUsers = React.useMemo(() => {
    const users = data?.users ?? [];
    return users.filter((u) => u.role === 'teacher' || u.role === 'admin');
  }, [data?.users]);

  const total = data?.total ?? 0;

  function handleSort(column: string, direction: 'asc' | 'desc') {
    setSortColumn(column);
    setSortDirection(direction);
    setPage(1);
  }

  function handleSearch(query: string) {
    setSearch(query);
    setPage(1);
  }

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: t('staff.columns.name'),
      sortable: true,
      render: (user) => (
        <button
          type="button"
          className="flex items-center gap-2 text-start hover:underline cursor-pointer"
          onClick={() => navigate(`/admin/staff/${user.id}`)}
        >
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] text-primary flex items-center justify-center text-label font-semibold">
            {user.first_name.charAt(0)}{user.last_name.charAt(0)}
          </div>
          <div>
            <p className="text-body font-medium text-foreground">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-caption text-text-secondary">{user.email}</p>
          </div>
        </button>
      ),
    },
    {
      key: 'role',
      header: t('staff.columns.role'),
      sortable: true,
      render: (user) => (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-micro font-medium bg-[var(--color-role-teacher-bg,#DBEAFE)] text-[var(--color-role-teacher,#1D4ED8)]">
          {t(`users.roles.${user.role}`)}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: t('staff.columns.status'),
      sortable: true,
      render: (user) => (
        <StatusBadge variant={user.is_active ? 'present' : 'cancelled'}>
          {user.is_active ? t('users.active') : t('users.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'created_at',
      header: t('staff.columns.joined'),
      sortable: true,
      render: (user) => (
        <span className="text-caption text-text-secondary">
          {new Date(user.created_at).toLocaleDateString()}
        </span>
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

      <DataTable<User>
        columns={columns}
        data={staffUsers}
        keyExtractor={(user) => user.id}
        searchable
        searchPlaceholder={t('staff.searchPlaceholder')}
        onSearch={handleSearch}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        emptyMessage={t('staff.noStaff')}
      />
    </div>
  );
}
