import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Shield, ShieldOff } from 'lucide-react';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import type { Column } from '@/components/ui';
import { useUsers, useToggleUserActive, type User } from '@/hooks/useUsers';
import { InviteUserDialog } from './InviteUserDialog';

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();

  const roleStyles: Record<string, string> = {
    admin: 'bg-[var(--color-role-admin-bg,#EDE9FE)] text-[var(--color-role-admin,#5B21B6)]',
    teacher: 'bg-[var(--color-role-teacher-bg,#DBEAFE)] text-[var(--color-role-teacher,#1D4ED8)]',
    parent: 'bg-[var(--color-role-parent-bg,#FCE7F3)] text-[var(--color-role-parent,#9D174D)]',
    super_admin: 'bg-[var(--color-role-admin-bg,#EDE9FE)] text-[var(--color-role-admin,#5B21B6)]',
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-micro font-medium ${roleStyles[role] || 'bg-subtle text-text-secondary'}`}
    >
      {t(`users.roles.${role}`)}
    </span>
  );
}

export function UsersPage() {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState<string>('created_at');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const toggleUserActive = useToggleUserActive();
  const pageSize = 10;

  const { data, isLoading } = useUsers({
    page,
    pageSize,
    search: search || undefined,
    sortColumn,
    sortDirection,
  });

  const users = data?.users ?? [];
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
      header: t('users.columns.name'),
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] text-primary flex items-center justify-center text-label font-semibold">
            {user.first_name.charAt(0)}{user.last_name.charAt(0)}
          </div>
          <div>
            <p className="text-body font-medium text-foreground">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-caption text-text-secondary">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('users.columns.role'),
      sortable: true,
      render: (user) => <RoleBadge role={user.role} />,
    },
    {
      key: 'is_active',
      header: t('users.columns.status'),
      sortable: true,
      render: (user) => (
        <StatusBadge variant={user.is_active ? 'present' : 'cancelled'}>
          {user.is_active ? t('users.active') : t('users.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'preferred_language',
      header: t('users.columns.language'),
      sortable: false,
      render: (user) => (
        <span className="text-body text-text-secondary">
          {user.preferred_language === 'ar' ? 'العربية' : 'Français'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: t('users.columns.joined'),
      sortable: true,
      render: (user) => (
        <span className="text-caption text-text-secondary">
          {new Date(user.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (user) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label={user.is_active ? t('users.deactivate') : t('users.activate')}
            title={user.is_active ? t('users.deactivate') : t('users.activate')}
            disabled={toggleUserActive.isPending}
            onClick={(e) => { e.stopPropagation(); toggleUserActive.mutate({ id: user.id, isActive: user.is_active }, { onError: (err) => setActionError(err instanceof Error ? err.message : 'Error') }); }}
          >
            {user.is_active ? (
              <ShieldOff className="w-4 h-4 text-danger" />
            ) : (
              <Shield className="w-4 h-4 text-success" />
            )}
          </Button>
        </div>
      ),
      className: 'w-24',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('users.title')}
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
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('users.title')}
        </h1>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="w-4 h-4" />
          {t('users.create')}
        </Button>
      </div>

      {actionError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-body text-danger flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-danger hover:opacity-70 text-lg leading-none">&times;</button>
        </div>
      )}

      <DataTable<User>
        columns={columns}
        data={users}
        keyExtractor={(user) => user.id}
        onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
        searchable
        searchPlaceholder={t('users.searchPlaceholder')}
        onSearch={handleSearch}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        emptyMessage={t('users.noUsers')}
      />

      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  );
}
