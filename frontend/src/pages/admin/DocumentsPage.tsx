import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Eye, FileImage, FileSpreadsheet, FileText, Pencil, Upload, Users } from 'lucide-react';
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
  FilterChips,
  Input,
  ListSkeleton,
  PageHeader,
  SearchInput,
  StatusBadge,
  useConfirm,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate } from '@/lib/formatters';
import { usePermissions } from '@/lib/roles';
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORIES,
  DOCUMENT_MAX_BYTES,
  fileSizeLabel,
  opensInBrowser,
  useDeleteDocument,
  useDocumentFile,
  useDocuments,
  useSaveDocument,
  type DocumentCategory,
  type SchoolDocument,
} from '@/hooks/useDocuments';

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-2 text-body text-foreground';

/** The picture of a file, by its kind. */
export function DocumentIcon({ extension }: { extension: string }) {
  const [Icon, tint] =
    extension === 'pdf' ? [FileText, 'bg-danger-muted text-danger']
    : ['jpg', 'png', 'webp'].includes(extension) ? [FileImage, 'bg-[var(--color-accent-muted)] text-primary']
    : ['xls', 'xlsx'].includes(extension) ? [FileSpreadsheet, 'bg-success-muted text-success']
    : [FileText, 'bg-subtle text-text-secondary'];
  return (
    <span className={`w-11 h-11 shrink-0 rounded-xl flex flex-col items-center justify-center ${tint}`}>
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-bold uppercase leading-none mt-0.5" dir="ltr">{extension}</span>
    </span>
  );
}

/** Adds a document, or changes one (its file is replaced only when a new one is chosen). */
function DocumentDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (open: boolean) => void; item: SchoolDocument | null }) {
  const { t, i18n } = useTranslation();
  const save = useSaveDocument();
  const remove = useDeleteDocument();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const empty = { name: '', category: 'enrollment' as DocumentCategory, note: '', visibleToParents: false };
  const [form, setForm] = React.useState(empty);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const picker = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    setForm(item ? { name: item.name, category: item.category, note: item.note ?? '', visibleToParents: item.visibleToParents } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function choose(chosen: File | undefined) {
    if (!chosen) return;
    setError(null);
    const extension = /\.([a-z0-9]{1,5})$/i.exec(chosen.name)?.[1].toLowerCase() ?? '';
    if (!DOCUMENT_ACCEPT.split(',').includes(`.${extension}`)) {
      setError(t('documents.fileKind'));
      return;
    }
    if (chosen.size > DOCUMENT_MAX_BYTES) {
      setError(t('errors.fileTooLargeMax', { max: fileSizeLabel(DOCUMENT_MAX_BYTES, i18n.language) }));
      return;
    }
    setFile(chosen);
    // The file's own name is a fair first name for the document.
    if (!form.name.trim()) set({ name: chosen.name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 120) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) {
      setError(t('documents.nameRequired'));
      return;
    }
    if (!item && !file) {
      setError(t('documents.fileRequired'));
      return;
    }
    try {
      await save.mutateAsync({ ...(item ? { id: item.id } : {}), ...form, name: form.name.trim(), note: form.note.trim(), file });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  async function handleDelete() {
    if (!item) return;
    const ok = await confirm({
      title: t('documents.deleteTitle', { name: item.name }),
      description: t('documents.deleteDescription'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(item.id);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        {confirmDialog}
        <DialogHeader>
          <DialogTitle>{item ? t('documents.editTitle') : t('documents.createTitle')}</DialogTitle>
          <DialogDescription>{t('documents.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormField label={t('documents.file')} htmlFor="doc-file" required={!item}>
            <input
              ref={picker}
              id="doc-file"
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                choose(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => picker.current?.click()}
              className="w-full flex items-center gap-3 rounded-lg border border-dashed border-border bg-subtle px-3 py-3 text-start hover:border-primary transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring"
            >
              <Upload className="w-5 h-5 text-primary shrink-0" />
              <span className="min-w-0">
                <span className="block text-body text-foreground [overflow-wrap:anywhere]">
                  {file ? file.name : item ? t('documents.replaceFile') : t('documents.chooseFile')}
                </span>
                <span className="block text-caption text-text-secondary">
                  {file ? fileSizeLabel(file.size, i18n.language) : t('documents.fileHint')}
                </span>
              </span>
            </button>
          </FormField>
          <FormField label={t('documents.name')} htmlFor="doc-name" required>
            <Input id="doc-name" value={form.name} maxLength={120} placeholder={t('documents.namePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          <FormField label={t('documents.category')} htmlFor="doc-category" required>
            <select id="doc-category" value={form.category} onChange={(e) => set({ category: e.target.value as DocumentCategory })} className={selectClass}>
              {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`documents.categories.${c}`)}</option>)}
            </select>
          </FormField>
          <FormField label={t('documents.note')} htmlFor="doc-note">
            <Input id="doc-note" value={form.note} maxLength={500} placeholder={t('documents.notePlaceholder')} onChange={(e) => set({ note: e.target.value })} />
          </FormField>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 mb-4 cursor-pointer">
            <input
              id="doc-parents"
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
              checked={form.visibleToParents}
              onChange={(e) => set({ visibleToParents: e.target.checked })}
            />
            <span>
              <span className="block text-body font-medium text-foreground">{t('documents.visibleToParents')}</span>
              <span className="block text-caption text-text-secondary">{t('documents.visibleToParentsHint')}</span>
            </span>
          </label>
          <ErrorAlert message={error} />
          <DialogFooter className="flex-wrap gap-2">
            {item && (
              <Button type="button" variant="ghost" size="sm" className="text-danger me-auto" disabled={remove.isPending} onClick={handleDelete}>
                {t('common.delete')}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('documents.sending') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The documents the school prints or sends often: one place to keep and find them. */
export function DocumentsPage() {
  const { t, i18n } = useTranslation();
  const { data: documents, isLoading, isError, error } = useDocuments();
  const files = useDocumentFile();
  const canEdit = usePermissions().can('documents', 'edit');
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState<'all' | DocumentCategory>('all');
  const [editing, setEditing] = React.useState<SchoolDocument | null | undefined>(undefined);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const all = documents ?? [];
  const q = search.trim().toLowerCase();
  const matching = all.filter((d) => !q || d.name.toLowerCase().includes(q) || (d.note ?? '').toLowerCase().includes(q));
  const shown = matching.filter((d) => category === 'all' || d.category === category);
  const groups = DOCUMENT_CATEGORIES.map((c) => ({ category: c, items: shown.filter((d) => d.category === c) })).filter((g) => g.items.length > 0);

  async function run(action: (doc: SchoolDocument) => Promise<void>, doc: SchoolDocument) {
    setFileError(null);
    try {
      await action(doc);
    } catch (err) {
      setFileError(errorMessage(err, t));
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('documents.title')}
        description={t('pageIntro.documents')}
        actions={canEdit && <CreateButton label={t('documents.create')} onClick={() => setEditing(null)} />}
      />

      {all.length > 0 && (
        <div className="space-y-3">
          <SearchInput defaultValue={search} onSearch={setSearch} placeholder={t('documents.searchPlaceholder')} className="w-full sm:w-72" />
          <FilterChips
            label={t('documents.category')}
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all' as const, label: t('documents.allCategories'), count: matching.length },
              ...DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: t(`documents.categories.${c}`), count: matching.filter((d) => d.category === c).length })),
            ]}
          />
        </div>
      )}

      <ErrorAlert message={fileError} />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : all.length === 0 ? (
        <EmptyState message={canEdit ? t('documents.empty') : t('documents.emptyReadOnly')} />
      ) : groups.length === 0 ? (
        <EmptyState message={t('documents.noMatch')} />
      ) : (
        groups.map((g) => (
          <section key={g.category} className="bg-card border border-border rounded-lg">
            <h2 className="px-4 py-2.5 bg-subtle rounded-t-lg flex items-center gap-2 text-body font-semibold text-foreground">
              <span className="flex-1">{t(`documents.categories.${g.category}`)}</span>
              <span className="text-caption font-normal text-text-secondary tabular-nums">{t('documents.count', { count: g.items.length })}</span>
            </h2>
            <ul className="divide-y divide-border">
              {g.items.map((d) => (
                <li key={d.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <DocumentIcon extension={d.fileExtension} />
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-body font-medium text-foreground [overflow-wrap:anywhere]">{d.name}</p>
                    <p className="text-caption text-text-secondary [overflow-wrap:anywhere]">
                      {fileSizeLabel(d.fileSize, i18n.language)} · {t('documents.updatedOn', { date: formatDate(d.updatedAt) })}
                      {d.note && ` · ${d.note}`}
                    </p>
                    {d.visibleToParents && (
                      <StatusBadge variant="info" className="mt-1 gap-1">
                        <Users className="w-3 h-3" />
                        {t('documents.sharedBadge')}
                      </StatusBadge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ms-auto">
                    {opensInBrowser(d) && (
                      <Button variant="secondary" size="sm" disabled={files.pendingId === d.id} onClick={() => run(files.open, d)}>
                        <Eye className="w-4 h-4" />
                        {t('documents.open')}
                      </Button>
                    )}
                    <Button variant={opensInBrowser(d) ? 'ghost' : 'secondary'} size="sm" disabled={files.pendingId === d.id} aria-label={t('documents.download')} title={t('documents.download')} onClick={() => run(files.download, d)}>
                      <Download className="w-4 h-4" />
                      {!opensInBrowser(d) && t('documents.download')}
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(d)}>
                        <Pencil className="w-4 h-4 text-primary" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <DocumentDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} item={editing ?? null} />
    </div>
  );
}
