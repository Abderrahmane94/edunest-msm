import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Link2, Phone, HeartPulse } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import {
  Button,
  CreateButton,
  DataTable,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormSelect } from '@/components/forms';
import {
  useChildren, useLinkParent, useMedicalNotes,
  type Child,
} from '@/hooks/useChildren';
import { useUsers } from '@/hooks/useUsers';
import { EmergencyContactsDialog } from './EmergencyContactsDialog';
import { MedicalNotesDialog } from './MedicalNotesDialog';
import { CreateChildWizard } from './CreateChildWizard';

/** Minimal shape needed by dialogs that only display/reference a child's identity. */
type ChildRef = Pick<Child, 'id' | 'first_name' | 'last_name'>;

/** Small table-cell warning shown when nobody — parent or emergency contact — is authorized to pick up this child. */
function PickupContactWarning({ child }: { child: Child }) {
  const { t } = useTranslation();
  if (child.has_authorized_pickup !== false) return null;
  return (
    <StatusBadge variant="absent" title={t('children.emergencyContacts.noPickupContact')}>
      {t('children.emergencyContacts.noPickupContact')}
    </StatusBadge>
  );
}

/** Small table-cell warning shown when a child has a high-severity medical note. */
function HighSeverityMedicalWarning({ childId }: { childId: string }) {
  const { t } = useTranslation();
  const { data: notes } = useMedicalNotes(childId);
  if (!notes || !notes.some((n) => n.severity === 'high')) return null;
  return (
    <StatusBadge variant="absent" title={t('children.medicalNotes.highSeverityWarning')}>
      {t('children.medicalNotes.highSeverityWarning')}
    </StatusBadge>
  );
}

function LinkParentDialog({
  open,
  onOpenChange,
  child,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: ChildRef | null;
}) {
  const { t } = useTranslation();
  const linkParent = useLinkParent();
  const { data: usersData } = useUsers({ pageSize: 100 });

  const parents = (usersData?.users ?? []).filter((u) => u.role === 'parent');

  const [parentId, setParentId] = React.useState('');
  const [relationship, setRelationship] = React.useState('mother');

  function resetForm() {
    setParentId('');
    setRelationship('mother');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!child || !parentId) return;

    try {
      await linkParent.mutateAsync({
        childId: child.id,
        parentId,
        relationship,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by React Query
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  const parentOptions = parents.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`,
  }));

  const relationshipOptions = [
    { value: 'mother', label: t('children.linkParent.mother') },
    { value: 'father', label: t('children.linkParent.father') },
    { value: 'guardian', label: t('children.linkParent.guardian') },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('children.linkParent.title')}</DialogTitle>
          <DialogDescription>
            {t('children.linkParent.description', {
              name: child ? `${child.first_name} ${child.last_name}` : '',
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormSelect
            label={t('children.linkParent.parent')}
            name="parent_id"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            options={parentOptions}
            placeholder={t('children.linkParent.selectParent')}
          />

          <FormSelect
            label={t('children.linkParent.relationship')}
            name="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            options={relationshipOptions}
          />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={linkParent.isPending || !parentId}>
              {linkParent.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChildrenPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const pageSize = 10;

  const { data, isLoading } = useChildren({ page, pageSize, search: search || undefined });
  const children = data?.children ?? [];
  const total = data?.total ?? 0;

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [linkParentDialogOpen, setLinkParentDialogOpen] = React.useState(false);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = React.useState(false);
  const [medicalDialogOpen, setMedicalDialogOpen] = React.useState(false);
  const [selectedChild, setSelectedChild] = React.useState<ChildRef | null>(null);

  function handleSearch(query: string) {
    setSearch(query);
    setPage(1);
  }

  function handleLinkParent(child: Child) {
    setSelectedChild(child);
    setLinkParentDialogOpen(true);
  }

  function handleEmergencyContacts(child: Child) {
    setSelectedChild(child);
    setEmergencyDialogOpen(true);
  }

  function handleMedicalNotes(child: Child) {
    setSelectedChild(child);
    setMedicalDialogOpen(true);
  }

  const columns: Column<Child>[] = [
    {
      key: 'name',
      header: t('children.columns.name'),
      sortable: true,
      render: (child) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] text-primary flex items-center justify-center text-label font-semibold">
            {child.first_name.charAt(0)}{child.last_name.charAt(0)}
          </div>
          <div>
            <p className="text-body font-medium text-foreground">
              {child.first_name} {child.last_name}
            </p>
            <p className="text-caption text-text-secondary" dir="ltr">
              {formatDate(child.date_of_birth)}
            </p>
          </div>
          <PickupContactWarning child={child} />
          <HighSeverityMedicalWarning childId={child.id} />
        </div>
      ),
    },
    {
      key: 'gender',
      header: t('children.columns.gender'),
      render: (child) => (
        <span className="text-body text-text-secondary">
          {t(`children.form.${child.gender}`)}
        </span>
      ),
    },
    {
      key: 'classroom_name',
      header: t('children.columns.classroom'),
      render: (child) =>
        child.classroom_name ? (
          <span className="text-body text-foreground">{child.classroom_name}</span>
        ) : (
          <span className="text-body text-text-disabled">—</span>
        ),
    },
    {
      key: 'parent_names',
      header: t('children.columns.parents'),
      render: (child) =>
        child.parent_names && child.parent_names.length > 0 ? (
          <span className="text-body text-foreground">{child.parent_names.join(', ')}</span>
        ) : (
          <span className="text-body text-text-disabled">{t('children.noParents')}</span>
        ),
    },
    {
      key: 'is_active',
      header: t('children.columns.status'),
      render: (child) => (
        <StatusBadge variant={child.is_active ? 'present' : 'cancelled'}>
          {child.is_active ? t('children.active') : t('children.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (child) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleLinkParent(child); }}
            aria-label={t('children.linkParent.title')}
            title={t('children.linkParent.title')}
          >
            <Link2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleEmergencyContacts(child); }}
            aria-label={t('children.emergencyContacts.title')}
            title={t('children.emergencyContacts.title')}
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleMedicalNotes(child); }}
            aria-label={t('children.medicalNotes.title')}
            title={t('children.medicalNotes.title')}
          >
            <HeartPulse className="w-4 h-4" />
          </Button>
        </div>
      ),
      className: 'w-32',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('children.title')}
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
          {t('children.title')}
        </h1>
        <CreateButton label={t('children.register')} onClick={() => setCreateDialogOpen(true)} />
      </div>

      <DataTable<Child>
        columns={columns}
        data={children}
        keyExtractor={(child) => child.id}
        onRowClick={(child) => navigate(`/admin/children/${child.id}`)}
        searchable
        searchPlaceholder={t('children.searchPlaceholder')}
        onSearch={handleSearch}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        emptyMessage={t('children.noChildren')}
      />

      <CreateChildWizard
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <LinkParentDialog
        open={linkParentDialogOpen}
        onOpenChange={setLinkParentDialogOpen}
        child={selectedChild}
      />

      <EmergencyContactsDialog
        open={emergencyDialogOpen}
        onOpenChange={setEmergencyDialogOpen}
        childId={selectedChild?.id ?? ''}
        childName={selectedChild ? `${selectedChild.first_name} ${selectedChild.last_name}` : ''}
      />

      <MedicalNotesDialog
        open={medicalDialogOpen}
        onOpenChange={setMedicalDialogOpen}
        childId={selectedChild?.id ?? ''}
        childName={selectedChild ? `${selectedChild.first_name} ${selectedChild.last_name}` : ''}
      />
    </div>
  );
}
