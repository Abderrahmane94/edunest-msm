import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveRestore, Eye, FilePlus2, History, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate, formatDateTime, formatDZD } from '@/lib/formatters';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import {
  useDeletedExpenses,
  useExpenseHistory,
  useExpenseReceiptFile,
  useRestoreExpense,
  type Expense,
  type ExpenseFieldChange,
  type ExpenseHistoryEntry,
} from '@/hooks/useExpenses';

/** A name, an amount or a date kept in its own direction inside the sentence (Latin names in Arabic). */
const iso = (text: string) => `⁨${text}⁩`;

/** "Modifiée par Nadia le 19/10/2026 10:32", under an expense changed since it was recorded. */
export function lastChangeLine(expense: Expense, t: (key: string, o?: Record<string, unknown>) => string): string | null {
  const last = expense.lastChange;
  if (!last) return null;
  return t(`finance.expenses.trace.last.${last.action}`, { name: iso(last.byName), date: iso(formatDateTime(last.at)) });
}

/** Opens a receipt kept in the history in a new tab. */
function useKeptReceipt() {
  const file = useExpenseReceiptFile();
  async function view(changeId: string) {
    // Open the tab inside the click so popup blockers allow it.
    const tab = window.open('', '_blank');
    try {
      const { blob } = await file.mutateAsync({ change: changeId });
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
    }
  }
  return { view, isPending: file.isPending, error: file.error };
}

function FieldChangeLine({ change }: { change: ExpenseFieldChange }) {
  const { t } = useTranslation();
  if (change.field === 'receipt') return null;
  const shown = (v: string | boolean | null): string => {
    if (v === null || v === '') return '—';
    if (typeof v === 'boolean') return t(v ? 'finance.expenses.trace.yes' : 'finance.expenses.trace.no');
    if (change.field === 'amount') return iso(formatDZD(Number(v)));
    if (change.field === 'date') return iso(formatDate(v));
    if (change.field === 'category') return t(`finance.expenses.categories.${v}`, v);
    return iso(v);
  };
  return (
    <li>
      <span className="text-text-secondary">{t(`finance.expenses.trace.fields.${change.field}`)} : </span>
      <span className="line-through text-text-disabled">{shown(change.from)}</span>
      <span className="text-text-secondary"> {t('attendance.trace.arrow')} </span>
      <span className="font-medium text-foreground">{shown(change.to)}</span>
    </li>
  );
}

const ICONS = { created: FilePlus2, updated: Pencil, receipt: FilePlus2, deleted: Trash2, restored: RotateCcw };

function entryTitle(entry: ExpenseHistoryEntry, t: (key: string, o?: Record<string, unknown>) => string): string {
  const name = iso(entry.byName);
  if (entry.action === 'receipt') {
    return t(entry.changes[0]?.from ? 'finance.expenses.trace.receiptReplaced' : 'finance.expenses.trace.receiptAdded', { name });
  }
  return t(`finance.expenses.trace.${entry.action}`, { name });
}

function HistoryEntry({ entry, onViewReceipt }: { entry: ExpenseHistoryEntry; onViewReceipt: (changeId: string) => void }) {
  const { t } = useTranslation();
  const Icon = ICONS[entry.action] ?? History;
  const s = entry.snapshot;
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hover">
        <Icon className={entry.action === 'deleted' ? 'w-3.5 h-3.5 text-danger' : 'w-3.5 h-3.5 text-primary'} />
      </span>
      <div className="min-w-0 flex-1 text-caption">
        <p className="text-body font-medium text-foreground">{entryTitle(entry, t)}</p>
        <p className="text-text-secondary">{iso(formatDateTime(entry.at))}</p>
        {entry.action === 'created' && s && (
          <p className="mt-1 text-text-secondary">
            {iso(formatDZD(Number(s.amount)))} · {t(`finance.expenses.categories.${s.category}`, s.category)} · {iso(formatDate(s.date))}
          </p>
        )}
        {entry.changes.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {entry.changes.map((c) => (
              <FieldChangeLine key={c.field} change={c} />
            ))}
          </ul>
        )}
        {entry.hasReceipt && (
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:shadow-focus-ring rounded"
            onClick={() => onViewReceipt(entry.id)}
          >
            <Eye className="w-3.5 h-3.5" />
            {t(entry.action === 'deleted' ? 'finance.expenses.trace.receipt' : 'finance.expenses.trace.oldReceipt')}
          </button>
        )}
      </div>
    </li>
  );
}

/** Everything that happened to an expense: who, when, what changed; replaced receipts stay readable. */
export function ExpenseHistoryDialog({
  expense,
  onOpenChange,
}: {
  expense: Expense | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useExpenseHistory(expense?.id);
  const receipt = useKeptReceipt();
  const entries = data ?? [];

  return (
    <Dialog open={!!expense} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('finance.expenses.trace.title')}</DialogTitle>
          <DialogDescription>
            {expense && (
              <>
                <span dir="auto">{expense.description}</span> · {iso(formatDZD(Number(expense.amount)))}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-10 bg-hover rounded-md" />)}
          </div>
        ) : (
          <ol className="space-y-4">
            {/* Recorded before the history was kept. */}
            {entries[0]?.action !== 'created' && <li className="text-caption text-text-secondary">{t('finance.expenses.trace.before')}</li>}
            {entries.map((entry) => (
              <HistoryEntry key={entry.id} entry={entry} onViewReceipt={(id) => void receipt.view(id)} />
            ))}
          </ol>
        )}
        {receipt.error && <p className="text-caption text-danger">{errorMessage(receipt.error, t)}</p>}
      </DialogContent>
    </Dialog>
  );
}

/** The year's deleted expenses, with who deleted them and when; the office can put one back. */
export function DeletedExpensesDialog({
  open,
  onOpenChange,
  canRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRestore: boolean;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useDeletedExpenses(open);
  const restore = useRestoreExpense();
  const receipt = useKeptReceipt();
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setError(null);
      setDone(false);
    }
  }, [open]);

  function handleRestore(changeId: string) {
    setError(null);
    setDone(false);
    restore.mutate(changeId, { onSuccess: () => setDone(true), onError: (err) => setError(errorMessage(err, t)) });
  }

  const entries = data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('finance.expenses.trace.deletedList.title')}</DialogTitle>
          <DialogDescription>{t('finance.expenses.trace.deletedList.description')}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 bg-hover rounded-md" />)}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-body text-text-secondary">{t('finance.expenses.trace.deletedList.empty')}</p>
        ) : (
          <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {entries.map((entry) => {
              const s = entry.snapshot;
              if (!s) return null;
              return (
                <li key={entry.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-foreground break-words">
                      <span dir="auto">{s.description}</span>
                    </p>
                    <p className="text-caption text-text-secondary">
                      {iso(formatDZD(Number(s.amount)))} · {t(`finance.expenses.categories.${s.category}`, s.category)} · {iso(formatDate(s.date))}
                    </p>
                    <p className="text-caption text-danger">
                      {t('finance.expenses.trace.deleted', { name: iso(entry.byName) })} · {iso(formatDateTime(entry.at))}
                    </p>
                    {entry.hasReceipt && (
                      <button
                        type="button"
                        className="mt-0.5 inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline focus-visible:outline-none focus-visible:shadow-focus-ring rounded"
                        onClick={() => void receipt.view(entry.id)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {t('finance.expenses.trace.receipt')}
                      </button>
                    )}
                  </div>
                  {canRestore && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      disabled={restore.isPending}
                      onClick={() => handleRestore(entry.id)}
                    >
                      <ArchiveRestore className="w-4 h-4" />
                      {t('finance.expenses.trace.deletedList.restore')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {done && <p className="text-body text-success animate-fade-in">{t('finance.expenses.trace.deletedList.restored')}</p>}
        <ErrorAlert message={error ?? (receipt.error ? errorMessage(receipt.error, t) : null)} onDismiss={() => setError(null)} />
      </DialogContent>
    </Dialog>
  );
}
