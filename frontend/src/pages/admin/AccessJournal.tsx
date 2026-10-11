import * as React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { PlusCircle, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Input,
  ListSkeleton,
  StatusBadge,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { AREAS } from '@/lib/roles';
import {
  useAccessJournal,
  useRemoveException,
  useSetException,
  useUserExceptions,
  type AccessLogEntry,
  type ExceptionKey,
} from '@/hooks/useAccessProfiles';

const FLAGS = ['delete', 'correctPayments'] as const;
const isFlag = (k: string) => (FLAGS as readonly string[]).includes(k);

/** "Paie", "Supprimer", "Nom". */
function keyLabel(key: string, t: TFunction): string {
  if (key === 'name') return t('accessProfiles.journal.name');
  if (isFlag(key)) return t(`accessProfiles.extra.${key}`);
  return t(`accessProfiles.areas.${key}`);
}

/** "Gérer", "Voir", "oui" / "non" for the two separate rights. */
function levelLabel(key: string, level: string, t: TFunction): string {
  if (key === 'name') return `« ${level} »`;
  if (isFlag(key)) return t(level === 'edit' ? 'accessProfiles.journal.yes' : 'accessProfiles.journal.no');
  return t(`accessProfiles.levels.${level}`);
}

/** One journal line, in words. */
export function describeEntry(e: AccessLogEntry, t: TFunction): string {
  const changes = (e.details.changes ?? [])
    .map((c) => `${keyLabel(c.key, t)} ${levelLabel(c.key, c.from, t)} → ${levelLabel(c.key, c.to, t)}`)
    .join(' ; ');
  const p = { actor: e.actorName, profile: e.profileName ?? '', person: e.targetName ?? '' };
  switch (e.action) {
    case 'profile_created':
      return t('accessProfiles.journal.created', p) + (changes ? ` — ${changes}` : '');
    case 'profile_updated':
      return t('accessProfiles.journal.updated', p) + (changes ? ` — ${changes}` : '');
    case 'profile_deleted':
      return t('accessProfiles.journal.deleted', { ...p, fallback: e.details.movedTo ?? '' });
    case 'profile_default':
      return t('accessProfiles.journal.default', p);
    case 'profile_assigned':
      return t('accessProfiles.journal.assigned', { ...p, before: e.details.from ?? '—' });
    case 'exception_added': {
      const what = `${keyLabel(e.details.key ?? '', t)} : ${levelLabel(e.details.key ?? '', e.details.level ?? '', t)}`;
      const until = e.details.endsOn ? ` ${t('accessProfiles.exceptions.until', { date: formatDate(e.details.endsOn) })}` : '';
      return t('accessProfiles.journal.exceptionAdded', { ...p, what: what + until });
    }
    case 'exception_removed':
      return t('accessProfiles.journal.exceptionRemoved', { ...p, what: keyLabel(e.details.key ?? '', t) });
    default:
      return '';
  }
}

/** The journal's lines, latest first. */
export function AccessJournalList({ userId, compact = false }: { userId?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useAccessJournal({ userId });
  if (isLoading) return <ListSkeleton rows={2} />;
  if (isError) return <ErrorAlert message={errorMessage(error, t)} />;
  const list = compact ? (data ?? []).slice(0, 5) : data ?? [];
  if (!list.length) return <p className="text-caption text-text-secondary">{t('accessProfiles.journal.empty')}</p>;
  return (
    <ul className="divide-y divide-border">
      {list.map((e) => (
        <li key={e.id} className="py-2">
          <p className="text-body text-foreground [overflow-wrap:anywhere]">{describeEntry(e, t)}</p>
          <p className="text-micro text-text-secondary">{formatDateTime(e.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}

/** Settings → Profils et droits → Journal. */
export function AccessJournalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t('accessProfiles.journal.title')}</DialogTitle>
          <DialogDescription>{t('accessProfiles.journal.description')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">{open && <AccessJournalList />}</div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Adds (or replaces) one exception: an area, its level, until when. */
function ExceptionDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string }) {
  const { t } = useTranslation();
  const save = useSetException();
  const [area, setArea] = React.useState<ExceptionKey>('payroll');
  const [level, setLevel] = React.useState<'none' | 'view' | 'edit'>('edit');
  const [endsOn, setEndsOn] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setArea('payroll');
    setLevel('edit');
    setEndsOn('');
    setNote('');
    setError(null);
  }, [open]);

  const levels: ('none' | 'view' | 'edit')[] = isFlag(area) ? ['edit', 'none'] : ['none', 'view', 'edit'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ userId, area, level, endsOn: endsOn || null, note: note.trim() || null });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('accessProfiles.exceptions.addTitle')}</DialogTitle>
          <DialogDescription>{t('accessProfiles.exceptions.addDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label={t('accessProfiles.exceptions.area')} htmlFor="ex-area" required>
            <select
              id="ex-area"
              value={area}
              onChange={(e) => {
                const k = e.target.value as ExceptionKey;
                setArea(k);
                if (isFlag(k) && level === 'view') setLevel('edit');
              }}
              className="h-10 w-full rounded-md border border-border bg-card px-2 text-body text-foreground"
            >
              {AREAS.map((a) => <option key={a} value={a}>{t(`accessProfiles.areas.${a}`)}</option>)}
              {FLAGS.map((f) => <option key={f} value={f}>{t(`accessProfiles.extra.${f}`)}</option>)}
            </select>
          </FormField>
          <div role="radiogroup" aria-label={t('accessProfiles.exceptions.level')} className="flex gap-1 p-1 bg-subtle rounded-lg">
            {levels.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                onClick={() => setLevel(l)}
                className={`flex-1 px-2 py-1.5 rounded-md text-caption font-medium ${level === l ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-foreground'}`}
              >
                {levelLabel(area, l, t)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <FormField label={t('accessProfiles.exceptions.endsOn')} htmlFor="ex-ends" helperText={t('accessProfiles.exceptions.endsOnHint')}>
              <Input id="ex-ends" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </FormField>
            <FormField label={t('accessProfiles.exceptions.note')} htmlFor="ex-note">
              <Input id="ex-note" value={note} maxLength={200} placeholder={t('accessProfiles.exceptions.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          </div>
          <ErrorAlert message={error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A person's exceptions, on their file (director). */
export function UserExceptionsPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: list = [] } = useUserExceptions(userId);
  const remove = useRemoveException();
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const active = list.filter((e) => e.active);

  async function handleRemove(id: string) {
    setError(null);
    try {
      await remove.mutateAsync({ userId, id });
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body font-medium text-foreground">{t('accessProfiles.exceptions.title')}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <PlusCircle className="w-4 h-4" />
          {t('accessProfiles.exceptions.add')}
        </Button>
      </div>
      {active.length === 0 ? (
        <p className="text-caption text-text-secondary">{t('accessProfiles.exceptions.none')}</p>
      ) : (
        <ul className="space-y-1">
          {active.map((e) => (
            <li key={e.id} className="flex items-center gap-2 flex-wrap">
              <StatusBadge variant="warning">
                {keyLabel(e.area, t)} : {levelLabel(e.area, e.level, t)}
              </StatusBadge>
              <span className="text-caption text-text-secondary">
                {e.endsOn ? t('accessProfiles.exceptions.until', { date: formatDate(e.endsOn) }) : t('accessProfiles.exceptions.forGood')}
                {e.note && ` · ${e.note}`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('accessProfiles.exceptions.remove')}
                title={t('accessProfiles.exceptions.remove')}
                disabled={remove.isPending}
                onClick={() => handleRemove(e.id)}
              >
                <X className="w-4 h-4 text-danger" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorAlert message={error} />
      <ExceptionDialog open={adding} onOpenChange={setAdding} userId={userId} />
    </div>
  );
}
