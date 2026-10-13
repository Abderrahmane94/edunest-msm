import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Eye, FolderOpen } from 'lucide-react';
import { Button, EmptyState, ErrorAlert, ListSkeleton } from '@/components/ui';
import { errorMessage } from '@/lib/errorMessage';
import { DOCUMENT_CATEGORIES, fileSizeLabel, opensInBrowser, useDocumentFile, useSharedDocuments, type SchoolDocument } from '@/hooks/useDocuments';
import { DocumentIcon } from '@/pages/admin/DocumentsPage';

/** What the school shares with the families: forms to fill, the rules, lists of papers to bring. */
export function ParentDocumentsPage() {
  const { t, i18n } = useTranslation();
  const { data: documents, isLoading, isError, error } = useSharedDocuments();
  const files = useDocumentFile();
  const [fileError, setFileError] = React.useState<string | null>(null);

  const all = documents ?? [];
  const groups = DOCUMENT_CATEGORIES.map((c) => ({ category: c, items: all.filter((d) => d.category === c) })).filter((g) => g.items.length > 0);

  async function run(action: (doc: SchoolDocument) => Promise<void>, doc: SchoolDocument) {
    setFileError(null);
    try {
      await action(doc);
    } catch (err) {
      setFileError(errorMessage(err, t));
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-14 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <h1 className="text-page-title font-semibold text-text-heading">{t('documents.parentTitle')}</h1>
          <p className="text-caption text-text-secondary">{t('documents.parentSubtitle')}</p>
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
        <ErrorAlert message={fileError} />
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorAlert message={errorMessage(error, t)} />
        ) : all.length === 0 ? (
          <EmptyState bare className="py-16" icon={<FolderOpen />} message={t('documents.parentEmpty')} />
        ) : (
          groups.map((g) => (
            <section key={g.category} className="space-y-2">
              <h2 className="text-label font-semibold text-text-secondary">{t(`documents.categories.${g.category}`)}</h2>
              <ul className="space-y-2">
                {g.items.map((d) => (
                  <li key={d.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                    <DocumentIcon extension={d.fileExtension} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-medium text-foreground [overflow-wrap:anywhere]">{d.name}</p>
                      <p className="text-caption text-text-secondary [overflow-wrap:anywhere]">
                        {fileSizeLabel(d.fileSize, i18n.language)}
                        {d.note && ` · ${d.note}`}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={files.pendingId === d.id}
                      onClick={() => run(opensInBrowser(d) ? files.open : files.download, d)}
                    >
                      {opensInBrowser(d) ? <Eye className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                      {opensInBrowser(d) ? t('documents.open') : t('documents.download')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
