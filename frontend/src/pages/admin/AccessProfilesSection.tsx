import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Pencil, ShieldCheck } from 'lucide-react';
import {
  Button,
  CreateButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Input,
  ListSkeleton,
  SectionHeader,
  StatusBadge,
  useConfirm,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { AREAS, useIsDirector, type Area, type Level, type Permissions } from '@/lib/roles';
import {
  useAccessProfiles,
  useAssignAccessProfile,
  useDeleteAccessProfile,
  useSaveAccessProfile,
  type AccessProfile,
} from '@/hooks/useAccessProfiles';

const LEVELS: Level[] = ['none', 'view', 'edit'];
const EMPTY: Permissions = {
  areas: Object.fromEntries(AREAS.map((a) => [a, 'none'])) as Record<Area, Level>,
  delete: false,
  correctPayments: false,
};

/** Creates or edits a profile: its name and, area by area, none / view / manage. */
function ProfileDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: AccessProfile | null;
}) {
  const { t } = useTranslation();
  const save = useSaveAccessProfile();
  const remove = useDeleteAccessProfile();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [perms, setPerms] = React.useState<Permissions>(EMPTY);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setName(profile?.name ?? '');
    setDescription(profile?.description ?? '');
    setPerms(profile ? structuredClone(profile.permissions) : structuredClone(EMPTY));
  }, [open, profile]);

  const setArea = (a: Area, l: Level) => setPerms((p) => ({ ...p, areas: { ...p.areas, [a]: l } }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ ...(profile ? { id: profile.id } : {}), name: name.trim(), description: description.trim() || null, permissions: perms });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  async function handleDelete() {
    if (!profile) return;
    const ok = await confirm({
      title: t('accessProfiles.deleteTitle', { name: profile.name }),
      description: t('accessProfiles.deleteDescription'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (ok) await run(() => remove.mutateAsync(profile.id));
  }

  const pending = save.isPending || remove.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        {confirmDialog}
        <DialogHeader>
          <DialogTitle>{profile ? t('accessProfiles.editTitle') : t('accessProfiles.createTitle')}</DialogTitle>
          <DialogDescription>{t('accessProfiles.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <FormField label={t('accessProfiles.name')} htmlFor="ap-name" required>
              <Input id="ap-name" value={name} maxLength={80} placeholder={t('accessProfiles.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label={t('accessProfiles.description')} htmlFor="ap-desc">
              <Input id="ap-desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
          </div>

          <div className="border border-border rounded-md divide-y divide-border">
            {AREAS.map((a) => (
              <div key={a} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium text-foreground">{t(`accessProfiles.areas.${a}`)}</p>
                  <p className="text-micro text-text-secondary">{t(`accessProfiles.areaHints.${a}`)}</p>
                </div>
                <div role="radiogroup" aria-label={t(`accessProfiles.areas.${a}`)} className="grid grid-cols-3 gap-1 p-1 bg-subtle rounded-lg sm:w-64 shrink-0">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={perms.areas[a] === l}
                      onClick={() => setArea(a, l)}
                      className={cn(
                        'px-2 py-1 rounded-md text-caption font-medium',
                        perms.areas[a] === l
                          ? l === 'none'
                            ? 'bg-card text-text-secondary shadow-sm'
                            : 'bg-primary text-white shadow-sm'
                          : 'text-text-secondary hover:text-foreground',
                      )}
                    >
                      {t(`accessProfiles.levels.${l}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {(['delete', 'correctPayments'] as const).map((k) => (
              <label key={k} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 rounded border-border text-primary"
                  checked={perms[k]}
                  onChange={(e) => setPerms((p) => ({ ...p, [k]: e.target.checked }))}
                />
                <span className="text-body text-foreground">
                  {t(`accessProfiles.extra.${k}`)}
                  <span className="block text-caption text-text-secondary">{t(`accessProfiles.extra.${k}Hint`)}</span>
                </span>
              </label>
            ))}
          </div>

          <ErrorAlert message={error} />
          <DialogFooter className="flex-wrap gap-2">
            {profile && !profile.isDefault && (
              <div className="flex gap-2 me-auto">
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => save.mutateAsync({ id: profile.id, isDefault: true }))}>
                  {t('accessProfiles.makeDefault')}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-danger" disabled={pending} onClick={handleDelete}>
                  {t('common.delete')}
                </Button>
              </div>
            )}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={pending}>{pending ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One line per area the profile opens: "Enfants : gérer", … */
function Summary({ p }: { p: Permissions }) {
  const { t } = useTranslation();
  const open = AREAS.filter((a) => p.areas[a] !== 'none');
  if (!open.length) return <p className="text-caption text-text-secondary">{t('accessProfiles.nothing')}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {open.map((a) => (
        <span
          key={a}
          className={cn(
            'px-2 py-0.5 rounded-full text-micro font-medium',
            p.areas[a] === 'edit' ? 'bg-[var(--color-accent-muted)] text-primary' : 'bg-subtle text-text-secondary',
          )}
        >
          {t(`accessProfiles.areas.${a}`)} · {t(`accessProfiles.levels.${p.areas[a]}`)}
        </span>
      ))}
      {p.delete && <span className="px-2 py-0.5 rounded-full text-micro font-medium bg-danger-muted text-danger">{t('accessProfiles.extra.delete')}</span>}
      {p.correctPayments && <span className="px-2 py-0.5 rounded-full text-micro font-medium bg-warning-muted text-warning">{t('accessProfiles.extra.correctPayments')}</span>}
    </div>
  );
}

/** Settings → Profils et droits: the director's profiles for the office staff. */
export function AccessProfilesSection() {
  const { t } = useTranslation();
  const { data: profiles, isLoading, isError, error } = useAccessProfiles();
  const [editing, setEditing] = React.useState<AccessProfile | null | undefined>(undefined);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('accessProfiles.title')}
        description={t('accessProfiles.description')}
        actions={<CreateButton label={t('accessProfiles.create')} onClick={() => setEditing(null)} />}
      />
      <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
        <Crown className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-body font-semibold text-foreground">{t('accessProfiles.directorTitle')}</p>
          <p className="text-caption text-text-secondary">{t('accessProfiles.directorHint')}</p>
        </div>
      </div>
      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : (
        (profiles ?? []).map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-foreground flex items-center gap-2 flex-wrap">
                  {p.name}
                  {p.isDefault && <StatusBadge variant="sent">{t('accessProfiles.default')}</StatusBadge>}
                </p>
                {p.description && <p className="text-caption text-text-secondary">{p.description}</p>}
              </div>
              <Button variant="ghost" size="sm" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(p)}>
                <Pencil className="w-4 h-4 text-primary" />
              </Button>
            </div>
            <Summary p={p.permissions} />
            <p className="text-caption text-text-secondary">
              {p.users.length
                ? t('accessProfiles.staff', { count: p.users.length, names: p.users.map((u) => `${u.firstName} ${u.lastName}`).join(', ') })
                : t('accessProfiles.noStaff')}
            </p>
          </div>
        ))
      )}
      <ProfileDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} profile={editing ?? null} />
    </div>
  );
}

/**
 * An office staff member's profile, on their file: the director picks it;
 * others see which one they have.
 */
export function UserAccessProfileCard({ user }: { user: { id: string; access_profile?: { id: string; name: string } | null } }) {
  const { t } = useTranslation();
  const isDirector = useIsDirector();
  const { data: profiles } = useAccessProfiles(isDirector);
  const assign = useAssignAccessProfile();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const defaultProfile = profiles?.find((p) => p.isDefault);
  const current = user.access_profile?.id ?? defaultProfile?.id ?? '';

  async function change(profileId: string) {
    setError(null);
    setSaved(false);
    try {
      await assign.mutateAsync({ userId: user.id, profileId });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      <h2 className="text-subsection font-semibold text-text-heading flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        {t('accessProfiles.userCardTitle')}
      </h2>
      {isDirector ? (
        <>
          <select
            aria-label={t('accessProfiles.userCardTitle')}
            value={current}
            disabled={assign.isPending || !profiles}
            onChange={(e) => change(e.target.value)}
            className="h-10 w-full sm:w-80 rounded-md border border-border bg-card px-2 text-body text-foreground"
          >
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? ` (${t('accessProfiles.default')})` : ''}
              </option>
            ))}
          </select>
          {(() => {
            const p = profiles?.find((x) => x.id === current);
            return p ? <Summary p={p.permissions} /> : null;
          })()}
          <p className="text-caption text-text-secondary">{t('accessProfiles.userCardHint')}</p>
          {saved && <p className="text-caption text-success">{t('common.saved')}</p>}
          <ErrorAlert message={error} />
        </>
      ) : (
        <p className="text-body text-foreground">{user.access_profile?.name ?? t('accessProfiles.defaultProfile')}</p>
      )}
    </div>
  );
}

