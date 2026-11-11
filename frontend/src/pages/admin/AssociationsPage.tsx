import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Network, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import {
  Button,
  CreateButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorAlert,
  Input,
  ListSkeleton,
  PageHeader,
  useConfirm,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/formatters';
import { announceNewAccount } from '@/lib/newAccount';
import { GROUP_TERMS, MEMBER_TERMS, groupWords } from '@/lib/groupWords';
import type { SchoolItem } from '@/hooks/useSchools';
import {
  associationApi,
  useAssociationAction,
  useAssociations,
  type AssociationNaming,
  type AssociationRow,
  type OfficerInput,
} from '@/hooks/useAssociations';

/** Every real school, to pick a club from (the platform has few enough for one page). */
function useAllSchools() {
  return useQuery({
    queryKey: ['schools-list', 'all'],
    queryFn: async () => {
      const res = await apiClient.get<SchoolItem[]>('/schools?pageSize=100');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function AssociationsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useAssociations();
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<(AssociationNaming & { id?: string }) | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('associations.title')}
        description={t('associations.description')}
        actions={<CreateButton label={t('associations.create')} onClick={() => setEditing({ name: '', groupTerm: 'group', memberTerm: 'nursery' })} />}
      />
      <ErrorAlert message={error} onDismiss={() => setError(null)} />
      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<Network className="w-8 h-8" />} title={t('associations.empty.title')} message={t('associations.empty.description')} />
      ) : (
        <div className="space-y-4">
          {data.map((association) => (
            <AssociationCard
              key={association.id}
              association={association}
              linkedSchoolIds={new Set(data.flatMap((a) => a.clubs.map((c) => c.id)))}
              onEdit={() => setEditing(association)}
              onError={(err) => setError(errorMessage(err, t))}
            />
          ))}
        </div>
      )}
      <AssociationDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function AssociationCard({
  association,
  linkedSchoolIds,
  onEdit,
  onError,
}: {
  association: AssociationRow;
  linkedSchoolIds: Set<string>;
  onEdit: () => void;
  onError: (err: unknown) => void;
}) {
  const { t } = useTranslation();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: schools } = useAllSchools();
  const [club, setClub] = React.useState('');
  const [officerOpen, setOfficerOpen] = React.useState(false);
  const addClub = useAssociationAction(associationApi.addClub);
  const removeClub = useAssociationAction(associationApi.removeClub);
  const removeOfficer = useAssociationAction(associationApi.removeOfficer);
  const remove = useAssociationAction(associationApi.remove);

  // A school is in one association at most: those already linked are not offered.
  const available = (schools ?? []).filter((s) => !linkedSchoolIds.has(s.id));
  const empty = association.clubs.length === 0 && association.officers.length === 0;
  const words = groupWords(t, association.groupTerm, association.memberTerm);

  return (
    <section className="bg-card border border-border rounded-lg p-5 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-subsection font-semibold text-text-heading truncate" dir="auto">{association.name}</h2>
          <p className="text-caption text-text-secondary">
            {t('associations.summary', { clubs: association.clubs.length, count: association.officers.length })}
          </p>
          <p className="text-caption text-text-secondary">{t('associations.terms.shown', { group: words.group, members: words.memberOther })}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onEdit} title={t('associations.edit')}>
            <Pencil className="w-4 h-4" />
            <span className="max-sm:hidden">{t('associations.edit')}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!empty || remove.isPending}
            title={empty ? t('associations.remove') : t('associations.removeNotEmpty')}
            onClick={async () => {
              const ok = await confirm({
                title: t('associations.removeConfirm', { name: association.name }),
                confirmLabel: t('associations.remove'),
                tone: 'danger',
              });
              if (ok) remove.mutate(association.id, { onError });
            }}
          >
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        </div>
      </header>

      {/* The clubs: schools run on their own, whose figures the association sees. */}
      <div className="space-y-2">
        <h3 className="text-body font-semibold text-text-heading">{t('associations.clubs.title')}</h3>
        {association.clubs.length === 0 ? (
          <p className="text-caption text-text-secondary">{t('associations.clubs.none')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {association.clubs.map((c) => (
              <li key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-subtle ps-3 pe-1 py-1 text-caption">
                <span dir="auto">{c.name}</span>
                <span className="text-text-secondary">· {c.wilaya}</span>
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-hover focus-visible:outline-none focus-visible:shadow-focus-ring"
                  aria-label={t('associations.clubs.remove', { name: c.name })}
                  disabled={removeClub.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('associations.clubs.removeConfirm', { name: c.name }),
                      description: t('associations.clubs.removeHint'),
                      confirmLabel: t('associations.clubs.removeShort'),
                      tone: 'danger',
                    });
                    if (ok) removeClub.mutate({ id: association.id, schoolId: c.id }, { onError });
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!club) return;
            addClub.mutate({ id: association.id, schoolId: club }, { onSuccess: () => setClub(''), onError });
          }}
        >
          <div className="min-w-[220px] flex-1 max-w-sm">
            <FormSelect
              label={t('associations.clubs.add')}
              name={`club-${association.id}`}
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder={available.length ? t('associations.clubs.pick') : t('associations.clubs.noneLeft')}
              options={available.map((s) => ({ value: s.id, label: `${s.name} · ${s.wilaya}` }))}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!club || addClub.isPending} className="mb-4">
            <Plus className="w-4 h-4" />
            {t('associations.clubs.addShort')}
          </Button>
        </form>
      </div>

      {/* The officers: they see the clubs' figures, nothing else. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-body font-semibold text-text-heading">{t('associations.officers.title')}</h3>
          <Button variant="secondary" size="sm" onClick={() => setOfficerOpen(true)}>
            <UserPlus className="w-4 h-4" />
            {t('associations.officers.add')}
          </Button>
        </div>
        {association.officers.length === 0 ? (
          <p className="text-caption text-text-secondary">{t('associations.officers.none')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {association.officers.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-body font-medium text-foreground truncate" dir="auto">{o.firstName} {o.lastName}</p>
                  <p className="text-caption text-text-secondary truncate">
                    <span dir="ltr">{o.email || o.phone}</span>
                    {' · '}
                    {o.lastActiveAt ? t('associations.officers.lastActive', { date: `⁨${formatDateTime(o.lastActiveAt)}⁩` }) : t('associations.officers.never')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removeOfficer.isPending}
                  title={t('associations.officers.remove')}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('associations.officers.removeConfirm', { name: `${o.firstName} ${o.lastName}` }),
                      description: t('associations.officers.removeHint'),
                      confirmLabel: t('associations.officers.remove'),
                      tone: 'danger',
                    });
                    if (ok) removeOfficer.mutate({ id: association.id, userId: o.id }, { onError });
                  }}
                >
                  <Trash2 className="w-4 h-4 text-danger" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <OfficerDialog association={association} open={officerOpen} onOpenChange={setOfficerOpen} />
      {confirmDialog}
    </section>
  );
}

/** Create a group, or change its name and the words its client sees. */
function AssociationDialog({ value, onClose }: { value: (AssociationNaming & { id?: string }) | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState<AssociationNaming>({ name: '', groupTerm: 'group', memberTerm: 'nursery' });
  const [error, setError] = React.useState<string | null>(null);
  const create = useAssociationAction(associationApi.create);
  const update = useAssociationAction(associationApi.update);
  const pending = create.isPending || update.isPending;

  React.useEffect(() => {
    if (value) setForm({ name: value.name, groupTerm: value.groupTerm, memberTerm: value.memberTerm });
    setError(null);
  }, [value]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value || !form.name.trim()) return;
    const input = { ...form, name: form.name.trim() };
    const done = { onSuccess: onClose, onError: (err: unknown) => setError(errorMessage(err, t)) };
    if (value.id) update.mutate({ id: value.id, ...input }, done);
    else create.mutate(input, done);
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{value?.id ? t('associations.edit') : t('associations.create')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-1">
          <FormField label={t('associations.name')} htmlFor="association-name" required>
            <Input id="association-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} dir="auto" autoFocus />
          </FormField>
          {/* The client's own words: Kiddoo's pages keep saying group and nurseries. */}
          <fieldset className="rounded-lg border border-border p-3 pb-0 mb-3">
            <legend className="px-1 text-body font-semibold text-text-heading">{t('associations.terms.title')}</legend>
            <p className="text-caption text-text-secondary mb-2">{t('associations.terms.hint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <FormSelect
                label={t('associations.terms.group')}
                name="association-group-term"
                value={form.groupTerm}
                onChange={(e) => setForm((f) => ({ ...f, groupTerm: e.target.value }))}
                options={GROUP_TERMS.map((term) => ({ value: term, label: t(`groupTerms.${term}.label`) }))}
              />
              <FormSelect
                label={t('associations.terms.member')}
                name="association-member-term"
                value={form.memberTerm}
                onChange={(e) => setForm((f) => ({ ...f, memberTerm: e.target.value }))}
                options={MEMBER_TERMS.map((term) => ({ value: term, label: t(`memberTerms.${term}.other`) }))}
              />
            </div>
          </fieldset>
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!form.name.trim() || pending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const emptyOfficer = { firstName: '', lastName: '', email: '', phone: '', preferredLanguage: 'fr' as 'fr' | 'ar' };

/** An officer's account: its first password is shown once, like any new account. */
function OfficerDialog({
  association,
  open,
  onOpenChange,
}: {
  association: AssociationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState(emptyOfficer);
  const [error, setError] = React.useState<string | null>(null);
  const add = useAssociationAction(associationApi.addOfficer);

  React.useEffect(() => {
    if (!open) {
      setForm(emptyOfficer);
      setError(null);
    }
  }, [open]);

  const set = (key: keyof typeof emptyOfficer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const ready = form.firstName.trim() && form.lastName.trim() && (form.email.trim() || form.phone.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const input: OfficerInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      preferredLanguage: form.preferredLanguage,
    };
    add.mutate(
      { id: association.id, input },
      {
        onSuccess: (account) => {
          onOpenChange(false);
          announceNewAccount(account, { role: 'association', schoolName: association.name });
        },
        onError: (err) => setError(errorMessage(err, t)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('associations.officers.add')}</DialogTitle>
          <DialogDescription>{t('associations.officers.formHint', { name: association.name })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('demos.form.firstName')} htmlFor="officer-first" required>
              <Input id="officer-first" value={form.firstName} onChange={set('firstName')} dir="auto" />
            </FormField>
            <FormField label={t('demos.form.lastName')} htmlFor="officer-last" required>
              <Input id="officer-last" value={form.lastName} onChange={set('lastName')} dir="auto" />
            </FormField>
          </div>
          <FormField label={t('associations.officers.email')} htmlFor="officer-email" helperText={t('associations.officers.loginHint')}>
            <Input id="officer-email" type="email" value={form.email} onChange={set('email')} dir="ltr" placeholder="president@association.dz" />
          </FormField>
          <FormField label={t('associations.officers.phone')} htmlFor="officer-phone">
            <Input id="officer-phone" type="tel" value={form.phone} onChange={set('phone')} dir="ltr" placeholder="0555 12 34 56" />
          </FormField>
          <FormSelect
            label={t('demos.form.language')}
            name="officer-language"
            value={form.preferredLanguage}
            onChange={set('preferredLanguage')}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'ar', label: 'العربية' },
            ]}
          />
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={add.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!ready || add.isPending}>
              {t('associations.officers.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
