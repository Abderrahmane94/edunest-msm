import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, Trash2, X, Eye, Pencil } from 'lucide-react';
import { formatDate, formatDZD } from '@/lib/formatters';
import {
  Button,
  CreateButton,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useUploadExpenseReceipt,
  useExpenseReceiptFile,
  type Expense,
} from '@/hooks/useExpenses';

// ─── Shared receipt file picker ─────────────────────────────────────────────

function ReceiptFilePicker({
  file,
  onSelect,
  onClear,
  disabled,
}: {
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
        <Upload className="w-4 h-4" />
        {t('finance.expenses.uploadReceipt', 'Upload receipt')}
      </Button>
      {file && (
        <span className="flex items-center gap-1 text-caption text-text-secondary truncate max-w-[160px]">
          {file.name}
          <button type="button" onClick={onClear} className="text-text-disabled hover:text-danger">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onSelect(selected);
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
}

const CATEGORY_KEYS = ['supplies', 'utilities', 'maintenance', 'food', 'transport', 'other'];

// ─── Receipt view / download (list and edit dialog) ─────────────────────────

function useExpenseReceiptActions() {
  const { t } = useTranslation();
  const receiptFile = useExpenseReceiptFile();

  async function view(expense: Expense) {
    // Open the tab right away (still inside the click) so popup blockers allow
    // it, then point it at the file once loaded.
    const tab = window.open('', '_blank');
    try {
      const { blob } = await receiptFile.mutateAsync(expense.id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
    }
  }

  async function download(expense: Expense) {
    try {
      const { blob, fileName } = await receiptFile.mutateAsync(expense.id);
      // Same name as the server's, with the category spelled out:
      // "<date> - <category> - <description>.<ext>".
      const ext = /\.[a-z0-9]{1,5}$/i.exec(fileName)?.[0] ?? '';
      const name = [expense.date.slice(0, 10), t(`finance.expenses.categories.${expense.category}`), expense.description]
        .map((part) => part.replace(/[\\/:*?"<>|]/g, '-').trim())
        .filter(Boolean)
        .join(' - ')
        .slice(0, 120);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // Exposed through `error`.
    }
  }

  return {
    view,
    download,
    isPending: receiptFile.isPending,
    error: receiptFile.isError
      ? receiptFile.error instanceof Error
        ? receiptFile.error.message
        : t('common.error')
      : null,
  };
}

export function ExpensesTab() {
  const { t } = useTranslation();
  const { data: expenses, isLoading } = useExpenses();
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null);
  const receipt = useExpenseReceiptActions();

  const columns: Column<Expense>[] = [
    {
      key: 'category',
      header: t('finance.expenses.columns.category'),
      sortable: true,
      render: (row) => (
        <span className="text-body font-medium text-foreground">
          {t(`finance.expenses.categories.${row.category}`, row.category)}
        </span>
      ),
    },
    {
      key: 'description',
      header: t('finance.expenses.columns.description'),
      render: (row) => (
        <span className="text-body text-text-secondary truncate max-w-[250px] block">
          {row.description}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('finance.expenses.columns.amount'),
      sortable: true,
      render: (row) => (
        <span className="font-mono text-body font-medium text-foreground" dir="ltr">
          {formatDZD(Number(row.amount))}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('finance.expenses.columns.date'),
      sortable: true,
      render: (row) => (
        <span className="text-caption text-text-secondary" dir="ltr">
          {formatDate(row.date)}
        </span>
      ),
    },
    {
      key: 'receipt',
      header: t('finance.expenses.columns.receipt'),
      render: (row) =>
        row.receiptPublicId ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void receipt.view(row)}
              disabled={receipt.isPending}
              aria-label={t('finance.expenses.viewReceipt')}
              title={t('finance.expenses.viewReceipt')}
            >
              <Eye className="w-4 h-4 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void receipt.download(row)}
              disabled={receipt.isPending}
              aria-label={t('finance.expenses.downloadReceipt')}
              title={t('finance.expenses.downloadReceipt')}
            >
              <Download className="w-4 h-4 text-primary" />
            </Button>
          </div>
        ) : (
          <span className="text-caption text-text-disabled">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditingExpense(row)}
          aria-label={t('finance.expenses.edit')}
          title={t('finance.expenses.edit')}
        >
          <Pencil className="w-4 h-4 text-primary" />
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-hover rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <CreateButton label={t('finance.expenses.create')} onClick={() => setShowCreateDialog(true)} />
      </div>

      {receipt.error && (
        <p className="text-caption text-danger" role="alert">
          {receipt.error}
        </p>
      )}

      <DataTable<Expense>
        columns={columns}
        data={expenses ?? []}
        keyExtractor={(row) => row.id}
        emptyMessage={t('finance.expenses.empty')}
      />

      <CreateExpenseDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          open={!!editingExpense}
          onOpenChange={(open) => !open && setEditingExpense(null)}
        />
      )}
    </div>
  );
}

function CreateExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const createExpense = useCreateExpense();
  const uploadReceipt = useUploadExpenseReceipt();

  const categoryOptions = CATEGORY_KEYS.map((key) => ({
    value: key,
    label: t(`finance.expenses.categories.${key}`),
  }));

  function resetForm() {
    setCategory('');
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().slice(0, 10));
    setReceiptFile(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !description.trim() || !amount || !date) return;
    setError(null);

    try {
      const created = await createExpense.mutateAsync({
        category,
        description: description.trim(),
        amount: parseFloat(amount),
        date,
      });
      if (receiptFile && created) {
        await uploadReceipt.mutateAsync({ id: created.id, file: receiptFile });
      }
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const isPending = createExpense.isPending || uploadReceipt.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('finance.expenses.form.title')}</DialogTitle>
          <DialogDescription>{t('finance.expenses.form.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label={t('finance.expenses.form.category')}
            name="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categoryOptions}
            placeholder={t('finance.expenses.form.categoryPlaceholder')}
          />

          <FormField label={t('finance.expenses.form.descriptionLabel')} htmlFor="expense-description" required>
            <Input
              id="expense-description"
              name="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('finance.expenses.form.descriptionPlaceholder')}
            />
          </FormField>

          <FormField label={t('finance.expenses.form.amount')} htmlFor="expense-amount" required>
            <Input
              id="expense-amount"
              name="expense-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </FormField>

          <FormField label={t('finance.expenses.form.date')} htmlFor="expense-date" required>
            <Input
              id="expense-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormField>

          <FormField label={t('finance.expenses.columns.receipt')} htmlFor="expense-receipt-create">
            <ReceiptFilePicker
              file={receiptFile}
              onSelect={setReceiptFile}
              onClear={() => setReceiptFile(null)}
              disabled={isPending}
            />
          </FormField>

          {error && <p className="text-body text-danger">{error}</p>}

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!category || !description.trim() || !amount || isPending}
            >
              {isPending ? t('common.loading') : t('finance.expenses.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
}: {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = React.useState(expense.category);
  const [description, setDescription] = React.useState(expense.description);
  const [amount, setAmount] = React.useState(String(expense.amount));
  const [date, setDate] = React.useState(expense.date.slice(0, 10));
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const uploadReceipt = useUploadExpenseReceipt();
  const receipt = useExpenseReceiptActions();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const categoryOptions = CATEGORY_KEYS.map((key) => ({
    value: key,
    label: t(`finance.expenses.categories.${key}`),
  }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !description.trim() || !amount || !date) return;

    updateExpense.mutate(
      {
        id: expense.id,
        category,
        description: description.trim(),
        amount: parseFloat(amount),
        date,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  function handleDelete() {
    deleteExpense.mutate(expense.id, { onSuccess: () => onOpenChange(false) });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadReceipt.mutate({ id: expense.id, file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('finance.expenses.detail.info')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label={t('finance.expenses.form.category')}
            name="expense-category-edit"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categoryOptions}
          />

          <FormField label={t('finance.expenses.form.descriptionLabel')} htmlFor="expense-description-edit" required>
            <Input
              id="expense-description-edit"
              name="expense-description-edit"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          <FormField label={t('finance.expenses.form.amount')} htmlFor="expense-amount-edit" required>
            <Input
              id="expense-amount-edit"
              name="expense-amount-edit"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
          </FormField>

          <FormField label={t('finance.expenses.form.date')} htmlFor="expense-date-edit" required>
            <Input
              id="expense-date-edit"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormField>

          <FormField label={t('finance.expenses.columns.receipt')} htmlFor="expense-receipt-edit">
            <div className="flex items-center gap-2">
              {expense.receiptPublicId && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void receipt.view(expense)}
                    disabled={receipt.isPending}
                  >
                    <Eye className="w-4 h-4" />
                    {t('finance.expenses.viewReceipt')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void receipt.download(expense)}
                    disabled={receipt.isPending}
                  >
                    <Download className="w-4 h-4" />
                    {t('finance.expenses.downloadReceipt')}
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadReceipt.isPending}
              >
                <Upload className="w-4 h-4" />
                {uploadReceipt.isPending
                  ? t('common.loading')
                  : t('finance.expenses.uploadReceipt', 'Upload receipt')}
              </Button>
              <input
                ref={fileInputRef}
                id="expense-receipt-edit"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {receipt.error && <p className="text-caption text-danger mt-1">{receipt.error}</p>}
          </FormField>

          <div className="border-t border-border pt-4">
            <p className="text-caption font-medium text-danger mb-2">{t('finance.expenses.detail.dangerZone')}</p>
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-caption text-text-secondary">{t('finance.expenses.detail.confirmDelete')}</span>
                <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={deleteExpense.isPending}>
                  {deleteExpense.isPending ? t('common.loading') : t('finance.expenses.detail.delete')}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="w-4 h-4" />
                {t('finance.expenses.detail.delete')}
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!category || !description.trim() || !amount || updateExpense.isPending}
            >
              {updateExpense.isPending ? t('common.loading') : t('finance.expenses.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
