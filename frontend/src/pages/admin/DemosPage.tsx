import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Copy, MessageCircle, XCircle } from 'lucide-react';
import {
  Button,
  CreateButton,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Input,
  ListSkeleton,
  PageHeader,
  useConfirm,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { apiClient, apiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { whatsappLink } from '@/lib/whatsapp';

interface DemoRow {
  schoolId: string;
  schoolName: string;
  directorName: string;
  phone: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string | null;
}

interface CreatedDemo {
  schoolId: string;
  schoolName: string;
  expiresAt: string;
  phone: string;
  firstName: string;
  language: 'fr' | 'ar';
  content: DemoContent;
  /** An empty demonstration has the director's account only. */
  accounts: { director: string; teacher?: string; parent?: string };
  password: string;
}

type DemoContent = 'sample' | 'empty';
const CONTENTS: DemoContent[] = ['sample', 'empty'];
const WHO = ['director', 'teacher', 'parent'] as const;

function useDemos() {
  return useQuery({
    queryKey: ['demos'],
    staleTime: 0,
    queryFn: async () => {
      const res = await apiClient.get<DemoRow[]>('/demos');
      if (!res.success) throw apiError(res.error, 'Failed to load demonstrations');
      return res.data ?? [];
    },
  });
}

function useDemoAction<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['demos'] }) });
}

/** The message that gives the director their demonstration, in the demonstration's language. */
function demoMessage(t: (key: string, o?: Record<string, unknown>) => string, demo: CreatedDemo): string {
  const o = { lng: demo.language };
  const empty = demo.content === 'empty';
  return [
    t('demos.whatsapp.greeting', { ...o, name: demo.firstName }),
    t(empty ? 'demos.whatsapp.introEmpty' : 'demos.whatsapp.intro', o),
    [
      t('demos.whatsapp.link', { ...o, url: `${window.location.origin}/login` }),
      t(empty ? 'demos.whatsapp.passwordOne' : 'demos.whatsapp.password', { ...o, password: demo.password }),
    ].join('\n'),
    WHO.filter((who) => demo.accounts[who])
      .map((who) => t(`demos.whatsapp.${who}`, { ...o, login: demo.accounts[who] }))
      .join('\n'),
    t(empty ? 'demos.whatsapp.tipEmpty' : 'demos.whatsapp.tip', o),
    t('demos.whatsapp.until', { ...o, date: formatDate(demo.expiresAt, demo.language) }),
    `— ${t('whatsapp.msg.team', o)}`,
  ].join('\n\n');
}

export function DemosPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useDemos();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const extend = useDemoAction(async (id: string) => {
    const res = await apiClient.patch(`/demos/${id}/extend`, { days: 7 });
    if (!res.success) throw apiError(res.error, 'Failed to extend');
  });
  const end = useDemoAction(async (id: string) => {
    const res = await apiClient.delete(`/demos/${id}`);
    if (!res.success) throw apiError(res.error, 'Failed to close');
  });

  const columns: Column<DemoRow>[] = [
    {
      key: 'schoolName',
      header: t('demos.columns.director'),
      render: (row) => (
        <span className="block">
          <span className="block text-body font-medium text-foreground" dir="auto">{row.directorName}</span>
          <span className="block text-caption text-text-secondary" dir="auto">{row.schoolName}</span>
        </span>
      ),
    },
    {
      key: 'phone',
      header: t('demos.columns.phone'),
      render: (row) => <span className="text-body text-text-secondary" dir="ltr">{row.phone}</span>,
    },
    {
      key: 'createdAt',
      header: t('demos.columns.created'),
      render: (row) => <span className="text-caption text-text-secondary" dir="ltr">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'expiresAt',
      header: t('demos.columns.expires'),
      render: (row) => <span className="text-caption text-text-secondary" dir="ltr">{formatDate(row.expiresAt)}</span>,
    },
    {
      key: 'lastActiveAt',
      header: t('demos.columns.lastActive'),
      render: (row) =>
        row.lastActiveAt ? (
          <span className="text-caption text-success">{`⁨${formatDateTime(row.lastActiveAt)}⁩`}</span>
        ) : (
          <span className="text-caption text-text-disabled">{t('demos.neverUsed')}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={extend.isPending}
            onClick={() => extend.mutate(row.schoolId, { onError: (err) => setError(errorMessage(err, t)) })}
            title={t('demos.extend')}
          >
            <CalendarPlus className="w-4 h-4 text-primary" />
            <span className="max-sm:hidden">{t('demos.extend')}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={end.isPending}
            title={t('demos.end')}
            onClick={async () => {
              const ok = await confirm({
                title: t('demos.endConfirm.title', { name: row.directorName }),
                description: t('demos.endConfirm.description'),
                confirmLabel: t('demos.end'),
                tone: 'danger',
              });
              if (ok) end.mutate(row.schoolId, { onError: (err) => setError(errorMessage(err, t)) });
            }}
          >
            <XCircle className="w-4 h-4 text-danger" />
            <span className="max-sm:hidden">{t('demos.end')}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('demos.title')}
        description={t('demos.description')}
        actions={<CreateButton label={t('demos.create')} onClick={() => setCreateOpen(true)} />}
      />
      <ErrorAlert message={error} onDismiss={() => setError(null)} />
      {isLoading ? (
        <ListSkeleton />
      ) : (
        <DataTable<DemoRow> columns={columns} data={data ?? []} keyExtractor={(row) => row.schoolId} emptyMessage={t('demos.empty')} />
      )}
      <CreateDemoDialog open={createOpen} onOpenChange={setCreateOpen} />
      {confirmDialog}
    </div>
  );
}

const emptyForm = { firstName: '', lastName: '', phone: '', schoolName: '', language: 'fr' as 'fr' | 'ar', content: 'sample' as DemoContent };

function CreateDemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState(emptyForm);
  const [created, setCreated] = React.useState<CreatedDemo | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const create = useDemoAction(async (input: typeof emptyForm) => {
    const res = await apiClient.post<CreatedDemo>('/demos', { ...input, schoolName: input.schoolName.trim() || undefined });
    if (!res.success || !res.data) throw apiError(res.error, 'Failed to create the demonstration');
    return res.data;
  });

  React.useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setCreated(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const ready = form.firstName.trim() && form.lastName.trim() && form.phone.trim().length >= 8;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    create.mutate(form, {
      onSuccess: (demo) => setCreated(demo as CreatedDemo),
      onError: (err) => setError(errorMessage(err, t)),
    });
  }

  const message = created ? demoMessage(t, created) : '';

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{created ? t('demos.ready.title') : t('demos.form.title')}</DialogTitle>
          <DialogDescription>
            {created ? t(created.content === 'empty' ? 'demos.ready.descriptionEmpty' : 'demos.ready.description') : t('demos.form.description')}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <dl className="rounded-lg border border-border divide-y divide-border text-body">
              {WHO.filter((who) => created.accounts[who]).map((who) => (
                <div key={who} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-text-secondary">{t(`demos.accounts.${who}`)}</dt>
                  <dd className="font-mono text-caption break-all text-end" dir="ltr">{created.accounts[who]}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-text-secondary">{t('demos.accounts.password')}</dt>
                <dd className="font-mono font-semibold" dir="ltr">{created.password}</dd>
              </div>
            </dl>
            <p className="text-caption text-text-secondary">{t('demos.ready.once')}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={whatsappLink(created.phone, message)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-body font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:shadow-focus-ring"
              >
                <MessageCircle className="w-4 h-4" />
                {t('demos.ready.whatsapp')}
              </a>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(message).then(() => setCopied(true));
                }}
              >
                <Copy className="w-4 h-4" />
                {copied ? t('demos.ready.copied') : t('demos.ready.copy')}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-1">
            <div role="radiogroup" aria-label={t('demos.form.content')} className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-3">
              {CONTENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.content === c}
                  onClick={() => setForm((f) => ({ ...f, content: c }))}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-start focus-visible:outline-none focus-visible:shadow-focus-ring',
                    form.content === c ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="block text-body font-medium text-foreground">{t(`demos.form.contents.${c}`)}</span>
                  <span className="block text-caption text-text-secondary">{t(`demos.form.contents.${c}Hint`)}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <FormField label={t('demos.form.firstName')} htmlFor="demo-first" required>
                <Input id="demo-first" value={form.firstName} onChange={set('firstName')} dir="auto" />
              </FormField>
              <FormField label={t('demos.form.lastName')} htmlFor="demo-last" required>
                <Input id="demo-last" value={form.lastName} onChange={set('lastName')} dir="auto" />
              </FormField>
            </div>
            <FormField label={t('demos.form.phone')} htmlFor="demo-phone" helperText={t('demos.form.phoneHint')} required>
              <Input id="demo-phone" type="tel" value={form.phone} onChange={set('phone')} dir="ltr" placeholder="0555 12 34 56" />
            </FormField>
            <FormField label={t('demos.form.schoolName')} htmlFor="demo-school" helperText={t('demos.form.schoolNameHint')}>
              <Input id="demo-school" value={form.schoolName} onChange={set('schoolName')} dir="auto" placeholder={t('demos.form.schoolNamePlaceholder')} />
            </FormField>
            <FormSelect
              label={t('demos.form.language')}
              name="demo-language"
              value={form.language}
              onChange={set('language')}
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'ar', label: 'العربية' },
              ]}
            />
            <ErrorAlert message={error} onDismiss={() => setError(null)} />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!ready || create.isPending}>
                {create.isPending ? t('demos.form.preparing') : t('demos.form.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
