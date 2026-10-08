import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/formatters';
import { Shield, ShieldOff, Mail } from 'lucide-react';
import {
  Button,
  CreateButton,
  DataTable,
  ErrorAlert,
  FilterBar,
  ListSkeleton,
  PageHeader,
  RoleBadge,
  StatusBadge,
  useConfirm,
  type ConfirmOptions,
} from '@/components/ui';
import type { TFunction } from 'i18next';
import type { Column } from '@/components/ui';
import { FormSelect } from '@/components/forms';
import { useUsers, useToggleUserActive, type User } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { InviteUserDialog } from './InviteUserDialog';
import { InviteByEmailDialog } from './InviteByEmailDialog';

/** The question asked before an account is deactivated or reactivated. */
export function userToggleConfirm(
  t: TFunction,
  user: { first_name: string; last_name: string; is_active: boolean }
): ConfirmOptions {
  const name = `${user.first_name} ${user.last_name}`;
  return user.is_active
    ? {
        title: t('confirmations.user.deactivateTitle', { name }),
        description: t('confirmations.user.deactivateDescription'),
        confirmLabel: t('users.deactivate'),
        tone: 'danger',
      }
    : {
        title: t('confirmations.user.activateTitle', { name }),
        description: t('confirmations.user.activateDescription'),
        confirmLabel: t('users.activate'),
        tone: 'default',
      };
}

export function UsersPage() {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<'' | 'admin' | 'teacher' | 'parent'>('');
  const [statusFilter, setStatusFilter] = React.useState<'' | 'active' | 'inactive'>('');
  const [sortColumn, setSortColumn] = React.useState<string>('created_at');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [inviteByEmailDialogOpen, setInviteByEmailDialogOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const toggleUserActive = useToggleUserActive();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const pageSize = 10;

  const { data, isLoading } = useUsers({
    page,
    pageSize,
    search: search || undefined,
    sortColumn,
    sortDirection,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  });
  const hasFilters = !!(roleFilter || statusFilter);

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
        <StatusBadge variant={user.is_active ? 'success' : 'neutral'}>
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
        <span className="text-caption text-text-secondary" dir="ltr">
          {formatDate(user.created_at)}
        </span>
      ),
    },
    ...(isSuperAdmin ? [{
      key: 'school_name',
      header: t('users.columns.school'),
      render: (user: User) => (
        user.school_name ? (
          <button
            className="text-body text-primary hover:underline text-start"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/schools/${user.school_id}`); }}
          >
            {user.school_name}
          </button>
        ) : (
          <span className="text-body text-text-disabled">—</span>
        )
      ),
    }] : []),
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
            onClick={async (e) => { e.stopPropagation(); if (!(await confirm(userToggleConfirm(t, user)))) return; toggleUserActive.mutate({ id: user.id, isActive: user.is_active }, { onError: (err) => setActionError(errorMessage(err, t)) }); }}
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

  return (
    <div className="space-y-6 animate-fade-in">
      {confirmDialog}
      <PageHeader
        title={t('users.title')}
        actions={
          <>
            {!isSuperAdmin && (
              <Button variant="secondary" onClick={() => setInviteByEmailDialogOpen(true)}>
                <Mail className="w-4 h-4" />
                {t('users.invite')}
              </Button>
            )}
            <CreateButton label={t('users.create')} onClick={() => setInviteDialogOpen(true)} />
          </>
        }
      />

      <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />

      <FilterBar
        search={{ onSearch: handleSearch, placeholder: t('users.searchPlaceholder'), defaultValue: search }}
        activeCount={(roleFilter ? 1 : 0) + (statusFilter ? 1 : 0)}
        summary={t('users.filters.summary', { count: total })}
        onReset={() => {
          setRoleFilter('');
          setStatusFilter('');
          setPage(1);
        }}
      >
        <FormSelect
          label={t('users.filters.role')}
          name="users-filter-role"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as '' | 'admin' | 'teacher' | 'parent');
            setPage(1);
          }}
          options={[
            { value: '', label: t('users.filters.allRoles') },
            { value: 'admin', label: t('users.roles.admin') },
            { value: 'teacher', label: t('users.roles.teacher') },
            { value: 'parent', label: t('users.roles.parent') },
          ]}
        />
        <FormSelect
          label={t('users.filters.status')}
          name="users-filter-status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as '' | 'active' | 'inactive');
            setPage(1);
          }}
          options={[
            { value: '', label: t('users.filters.allStatuses') },
            { value: 'active', label: t('users.active') },
            { value: 'inactive', label: t('users.inactive') },
          ]}
        />
      </FilterBar>

      {isLoading ? (
        <ListSkeleton />
      ) : (
        <DataTable<User>
          columns={columns}
          data={users}
          keyExtractor={(user) => user.id}
          onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          emptyMessage={hasFilters || search ? t('users.filters.noMatch') : t('users.noUsers')}
        />
      )}

      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />

      <InviteByEmailDialog
        open={inviteByEmailDialogOpen}
        onOpenChange={setInviteByEmailDialogOpen}
      />
    </div>
  );
}
