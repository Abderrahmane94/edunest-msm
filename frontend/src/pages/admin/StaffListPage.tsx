import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/formatters';
import { DataTable, FilterBar, ListSkeleton, PageHeader, RoleBadge, StatusBadge } from '@/components/ui';
import { avatarColor } from '@/components/ui/Avatar';
import type { Column } from '@/components/ui';
import { FormSelect } from '@/components/forms';
import { useUsers, type User } from '@/hooks/useUsers';
import { useStaffList, type ContractType, type StaffProfile } from '@/hooks/useStaff';

interface StaffRow {
  user: User;
  profile?: StaffProfile;
}

export function StaffListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<'' | 'teacher' | 'admin'>('');
  const [statusFilter, setStatusFilter] = React.useState<'' | 'active' | 'inactive'>('');
  const [contractFilter, setContractFilter] = React.useState<'' | ContractType>('');
  const [profileFilter, setProfileFilter] = React.useState<'' | 'with' | 'without'>('');
  const [endFilter, setEndFilter] = React.useState<'' | 'soon' | 'expired'>('');

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

    const q = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);
    return combined.filter((row) => {
      if (
        q &&
        !`${row.user.first_name} ${row.user.last_name}`.toLowerCase().includes(q) &&
        !row.user.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (roleFilter && row.user.role !== roleFilter) return false;
      if (statusFilter === 'active' && !row.user.is_active) return false;
      if (statusFilter === 'inactive' && row.user.is_active) return false;
      if (contractFilter && row.profile?.contract_type !== contractFilter) return false;
      if (profileFilter === 'with' && !row.profile) return false;
      if (profileFilter === 'without' && row.profile) return false;
      if (endFilter) {
        // A contract without an end date never expires.
        if (!row.profile?.contract_end) return false;
        const end = new Date(row.profile.contract_end);
        if (endFilter === 'expired' && end >= today) return false;
        if (endFilter === 'soon' && (end < today || end > in30Days)) return false;
      }
      return true;
    });
  }, [usersData?.users, staffData?.profiles, search, roleFilter, statusFilter, contractFilter, profileFilter, endFilter]);

  const activeFilters = [roleFilter, statusFilter, contractFilter, profileFilter, endFilter].filter(Boolean).length;

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const isLoading = usersLoading || staffLoading;

  function handleSearch(query: string) {
    setSearch(query);
    setPage(1);
  }

  // Any filter change goes back to the first page.
  function filterSetter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }

  const columns: Column<StaffRow>[] = [
    {
      key: 'name',
      header: t('staff.columns.name'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-label font-semibold ${avatarColor(`${row.user.first_name} ${row.user.last_name}`)}`}>
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
      render: (row) => <RoleBadge role={row.user.role} />,
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
          <span className="text-caption text-text-secondary">
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
        <StatusBadge variant={row.user.is_active ? 'success' : 'neutral'}>
          {row.user.is_active ? t('users.active') : t('users.inactive')}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('staff.title')} />

      <FilterBar
        search={{ onSearch: handleSearch, placeholder: t('staff.filters.searchPlaceholder'), defaultValue: search }}
        activeCount={activeFilters}
        summary={isLoading ? undefined : t('staff.filters.summary', { count: total })}
        onReset={() => {
          setRoleFilter('');
          setStatusFilter('');
          setContractFilter('');
          setProfileFilter('');
          setEndFilter('');
          setPage(1);
        }}
        columns={3}
      >
        <FormSelect
          label={t('users.filters.role')}
          name="staff-filter-role"
          value={roleFilter}
          onChange={(e) => filterSetter(setRoleFilter)(e.target.value as '' | 'teacher' | 'admin')}
          options={[
            { value: '', label: t('users.filters.allRoles') },
            { value: 'teacher', label: t('users.roles.teacher') },
            { value: 'admin', label: t('users.roles.admin') },
          ]}
        />
        <FormSelect
          label={t('users.filters.status')}
          name="staff-filter-status"
          value={statusFilter}
          onChange={(e) => filterSetter(setStatusFilter)(e.target.value as '' | 'active' | 'inactive')}
          options={[
            { value: '', label: t('users.filters.allStatuses') },
            { value: 'active', label: t('users.active') },
            { value: 'inactive', label: t('users.inactive') },
          ]}
        />
        <FormSelect
          label={t('staff.filters.contract')}
          name="staff-filter-contract"
          value={contractFilter}
          onChange={(e) => filterSetter(setContractFilter)(e.target.value as '' | ContractType)}
          options={[
            { value: '', label: t('staff.filters.allContracts') },
            ...(['full_time', 'part_time', 'contract'] as const).map((c) => ({ value: c, label: t(`staff.contractTypes.${c}`) })),
          ]}
        />
        <FormSelect
          label={t('staff.filters.profile')}
          name="staff-filter-profile"
          value={profileFilter}
          onChange={(e) => filterSetter(setProfileFilter)(e.target.value as '' | 'with' | 'without')}
          options={[
            { value: '', label: t('staff.filters.allProfiles') },
            { value: 'with', label: t('staff.filters.withProfile') },
            { value: 'without', label: t('staff.filters.withoutProfile') },
          ]}
        />
        <FormSelect
          label={t('staff.filters.contractEnd')}
          name="staff-filter-end"
          value={endFilter}
          onChange={(e) => filterSetter(setEndFilter)(e.target.value as '' | 'soon' | 'expired')}
          options={[
            { value: '', label: t('staff.filters.allContractEnds') },
            { value: 'soon', label: t('staff.filters.endingSoon') },
            { value: 'expired', label: t('staff.filters.expired') },
          ]}
        />
      </FilterBar>

      {isLoading ? (
        <ListSkeleton />
      ) : (
      <DataTable<StaffRow>
        columns={columns}
        data={pageRows}
        keyExtractor={(row) => row.user.id}
        onRowClick={(row) => navigate(`/admin/staff/${row.user.id}`)}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        emptyMessage={search || activeFilters ? t('staff.filters.noMatch') : t('staff.noStaff')}
      />
      )}
    </div>
  );
}
