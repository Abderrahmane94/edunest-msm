import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/formatters';
import {
  Receipt,
  FileText,
  TrendingUp,
  Wallet,
  Send,
  Banknote,
  CreditCard,
  Upload,
  BarChart2,
} from 'lucide-react';
import {
  Button,
  CreateButton,
  DataTable,
  StatusBadge,
  KPICard,
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
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useClassrooms, type Classroom } from '@/hooks/useClassrooms';
import {
  useFeeStructures,
  useCreateFeeStructure,
  useInvoices,
  useBulkGenerateInvoices,
  useSendInvoice,
  useRecordCashPayment,
  useExpenses,
  useCreateExpense,
  useFinanceSummary,
  usePaymentMethodBreakdown,
  type FeeStructure,
  type Invoice,
  type Expense,
} from '@/hooks/useFinance';

type TabMode = 'fees' | 'invoices' | 'expenses' | 'reports';

export function FinancePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<TabMode>('fees');

  const tabs: { key: TabMode; label: string; icon: React.ReactNode }[] = [
    { key: 'fees', label: t('finance.tabs.fees'), icon: <Receipt className="w-4 h-4" /> },
    { key: 'invoices', label: t('finance.tabs.invoices'), icon: <FileText className="w-4 h-4" /> },
    { key: 'expenses', label: t('finance.tabs.expenses'), icon: <Wallet className="w-4 h-4" /> },
    { key: 'reports', label: t('finance.tabs.reports'), icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('finance.title')}
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'fees' && <FeeStructuresTab />}
      {activeTab === 'invoices' && <InvoicesTab />}
      {activeTab === 'expenses' && <ExpensesTab />}
      {activeTab === 'reports' && <ReportsTab />}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   Fee Structures Tab
   ═══════════════════════════════════════════════════════════════════════════ */

function FeeStructuresTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: feeStructures, isLoading } = useFeeStructures();
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);

  const columns: Column<FeeStructure>[] = [
    {
      key: 'name',
      header: t('finance.fees.columns.name'),
      sortable: true,
      render: (row) => (
        <span className="text-body font-medium text-foreground">{row.name}</span>
      ),
    },
    {
      key: 'amount',
      header: t('finance.fees.columns.amount'),
      sortable: true,
      render: (row) => (
        <span className="font-mono text-body font-medium text-foreground">
          {formatDZD(row.amount)}
        </span>
      ),
    },
    {
      key: 'frequency',
      header: t('finance.fees.columns.frequency'),
      render: (row) => (
        <StatusBadge variant="sent">
          {t(`finance.fees.frequencies.${row.frequency}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'level',
      header: t('finance.fees.columns.level'),
      render: (row) => (
        <span className="text-body text-text-secondary">{row.level || '—'}</span>
      ),
    },
    {
      key: 'description',
      header: t('finance.fees.columns.description'),
      render: (row) => (
        <span className="text-body text-text-secondary truncate max-w-[200px] block">
          {row.description || '—'}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <CreateButton label={t('finance.fees.create')} onClick={() => setShowCreateDialog(true)} />
      </div>

      <DataTable<FeeStructure>
        columns={columns}
        data={feeStructures ?? []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/admin/finance/fees/${row.id}`)}
        emptyMessage={t('finance.fees.empty')}
      />

      <CreateFeeStructureDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}

function CreateFeeStructureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [frequency, setFrequency] = React.useState('monthly');
  const [level, setLevel] = React.useState('');
  const [description, setDescription] = React.useState('');

  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const createFeeStructure = useCreateFeeStructure();

  const frequencyOptions = [
    { value: 'monthly', label: t('finance.fees.frequencies.monthly') },
    { value: 'quarterly', label: t('finance.fees.frequencies.quarterly') },
    { value: 'annual', label: t('finance.fees.frequencies.annual') },
    { value: 'one_time', label: t('finance.fees.frequencies.one_time') },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount || !activeYear) return;

    createFeeStructure.mutate(
      {
        name: name.trim(),
        amount: parseFloat(amount),
        currency: 'DZD',
        frequency,
        level: level.trim() || undefined,
        description: description.trim() || undefined,
        academic_year_id: activeYear.id,
      },
      {
        onSuccess: () => {
          setName('');
          setAmount('');
          setFrequency('monthly');
          setLevel('');
          setDescription('');
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('finance.fees.form.title')}</DialogTitle>
          <DialogDescription>{t('finance.fees.form.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('finance.fees.form.name')} htmlFor="fee-name" required>
            <Input
              id="fee-name"
              name="fee-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('finance.fees.form.namePlaceholder')}
            />
          </FormField>

          <FormField label={t('finance.fees.form.amount')} htmlFor="fee-amount" required>
            <Input
              id="fee-amount"
              name="fee-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </FormField>

          <FormSelect
            label={t('finance.fees.form.frequency')}
            name="fee-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            options={frequencyOptions}
          />

          <FormField label={t('finance.fees.form.level')} htmlFor="fee-level">
            <Input
              id="fee-level"
              name="fee-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder={t('finance.fees.form.levelPlaceholder')}
            />
          </FormField>

          <FormField label={t('finance.fees.form.descriptionLabel')} htmlFor="fee-description">
            <textarea
              id="fee-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('finance.fees.form.descriptionPlaceholder')}
              rows={3}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground placeholder:text-text-disabled focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150 resize-none"
            />
          </FormField>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!name.trim() || !amount || createFeeStructure.isPending}
            >
              {createFeeStructure.isPending ? t('common.loading') : t('finance.fees.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   Invoices Tab
   ═══════════════════════════════════════════════════════════════════════════ */

function InvoicesTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: invoices, isLoading } = useInvoices();
  const [showBulkDialog, setShowBulkDialog] = React.useState(false);
  const [showCashPaymentDialog, setShowCashPaymentDialog] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);

  const sendInvoice = useSendInvoice();
  const [sendError, setSendError] = React.useState<string | null>(null);

  function handleSend(invoice: Invoice) {
    setSendError(null);
    sendInvoice.mutate(invoice.id, {
      onError: (err) => setSendError(err instanceof Error ? err.message : 'Failed to send invoice'),
    });
  }

  function handleRecordCash(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setShowCashPaymentDialog(true);
  }

  const columns: Column<Invoice>[] = [
    {
      key: 'child_name',
      header: t('finance.invoices.columns.child'),
      sortable: true,
      render: (row) => (
        <span className="text-body font-medium text-foreground">{row.child_name}</span>
      ),
    },
    {
      key: 'fee_structure_name',
      header: t('finance.invoices.columns.fee'),
      render: (row) => (
        <span className="text-body text-text-secondary">{row.fee_structure_name}</span>
      ),
    },
    {
      key: 'final_amount',
      header: t('finance.invoices.columns.amount'),
      sortable: true,
      render: (row) => (
        <span className="font-mono text-body font-medium text-foreground">
          {formatDZD(row.final_amount)}
        </span>
      ),
    },
    {
      key: 'due_date',
      header: t('finance.invoices.columns.dueDate'),
      sortable: true,
      render: (row) => (
        <span className="text-caption text-text-secondary" dir="ltr">
          {formatDate(row.due_date)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('finance.invoices.columns.status'),
      sortable: true,
      render: (row) => (
        <StatusBadge variant={row.status as 'paid' | 'sent' | 'overdue' | 'draft' | 'cancelled' | 'partial'}>
          {t(`finance.invoices.statuses.${row.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'payment_method',
      header: t('finance.invoices.columns.paymentMethod'),
      render: (row) => {
        if (!row.payment_method) return <span className="text-caption text-text-disabled">—</span>;
        return (
          <span className="inline-flex items-center gap-1 text-caption font-medium">
            {row.payment_method === 'online' ? (
              <>
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary">{t('finance.invoices.methods.online')}</span>
              </>
            ) : (
              <>
                <Banknote className="w-3.5 h-3.5 text-success" />
                <span className="text-success">{t('finance.invoices.methods.cash')}</span>
              </>
            )}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleSend(row); }}
              disabled={sendInvoice.isPending}
            >
              <Send className="w-3.5 h-3.5" />
              {t('finance.invoices.send')}
            </Button>
          )}
          {(row.status === 'sent' || row.status === 'partial' || row.status === 'overdue') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleRecordCash(row); }}
            >
              <Banknote className="w-3.5 h-3.5" />
              {t('finance.invoices.recordCash')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <CreateButton label={t('finance.invoices.bulkGenerate')} onClick={() => setShowBulkDialog(true)} />
      </div>

      {sendError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-body text-danger flex items-center justify-between">
          <span>{sendError}</span>
          <button onClick={() => setSendError(null)} className="text-danger hover:opacity-70 text-lg leading-none">&times;</button>
        </div>
      )}

      <DataTable<Invoice>
        columns={columns}
        data={invoices ?? []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/admin/finance/invoices/${row.id}`)}
        emptyMessage={t('finance.invoices.empty')}
      />

      <BulkInvoiceDialog
        open={showBulkDialog}
        onOpenChange={setShowBulkDialog}
      />

      {selectedInvoice && (
        <CashPaymentDialog
          open={showCashPaymentDialog}
          onOpenChange={(open) => {
            setShowCashPaymentDialog(open);
            if (!open) setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
        />
      )}
    </div>
  );
}

function BulkInvoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [classroomId, setClassroomId] = React.useState('');
  const [feeStructureId, setFeeStructureId] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const { data: classrooms } = useClassrooms(activeYear?.id);
  const { data: feeStructures } = useFeeStructures();
  const bulkGenerate = useBulkGenerateInvoices();

  const classroomOptions = (classrooms ?? []).map((c: Classroom) => ({
    value: c.id,
    label: c.name,
  }));

  const feeOptions = (feeStructures ?? []).map((f: FeeStructure) => ({
    value: f.id,
    label: `${f.name} — ${formatDZD(f.amount)}`,
  }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classroomId || !feeStructureId || !dueDate) return;

    const selectedFee = feeStructures?.find((f) => f.id === feeStructureId);
    bulkGenerate.mutate(
      { classroom_id: classroomId, fee_structure_id: feeStructureId, due_date: dueDate, amount: selectedFee?.amount ?? 0 },
      {
        onSuccess: () => {
          setClassroomId('');
          setFeeStructureId('');
          setDueDate('');
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('finance.invoices.bulkForm.title')}</DialogTitle>
          <DialogDescription>{t('finance.invoices.bulkForm.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label={t('finance.invoices.bulkForm.classroom')}
            name="bulk-classroom"
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            options={classroomOptions}
            placeholder={t('finance.invoices.bulkForm.classroomPlaceholder')}
          />

          <FormSelect
            label={t('finance.invoices.bulkForm.feeStructure')}
            name="bulk-fee"
            value={feeStructureId}
            onChange={(e) => setFeeStructureId(e.target.value)}
            options={feeOptions}
            placeholder={t('finance.invoices.bulkForm.feePlaceholder')}
          />

          <FormField label={t('finance.invoices.bulkForm.dueDate')} htmlFor="bulk-due-date" required>
            <input
              id="bulk-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150"
            />
          </FormField>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!classroomId || !feeStructureId || !dueDate || bulkGenerate.isPending}
            >
              {bulkGenerate.isPending ? t('common.loading') : t('finance.invoices.bulkForm.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CashPaymentDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}) {
  const { t } = useTranslation();
  const [amountReceived, setAmountReceived] = React.useState('');
  const [receivedAt, setReceivedAt] = React.useState(
    new Date().toISOString().slice(0, 16)
  );
  const [note, setNote] = React.useState('');

  const recordCash = useRecordCashPayment();

  const outstanding = invoice.remaining_amount ?? invoice.final_amount;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountReceived || parseFloat(amountReceived) <= 0) return;

    recordCash.mutate(
      {
        invoiceId: invoice.id,
        amount_received: parseFloat(amountReceived),
        received_at: receivedAt,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          setAmountReceived('');
          setNote('');
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('finance.invoices.cashForm.title')}</DialogTitle>
          <DialogDescription>
            {t('finance.invoices.cashForm.description', { child: invoice.child_name })}
          </DialogDescription>
        </DialogHeader>

        {/* Invoice summary */}
        <div className="bg-subtle rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-secondary">{t('finance.invoices.cashForm.totalAmount')}</span>
            <span className="font-mono text-body font-medium text-foreground">{formatDZD(invoice.final_amount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-secondary">{t('finance.invoices.cashForm.outstanding')}</span>
            <span className="font-mono text-body font-medium text-warning">{formatDZD(outstanding)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('finance.invoices.cashForm.amountReceived')} htmlFor="cash-amount" required>
            <Input
              id="cash-amount"
              name="cash-amount"
              type="number"
              min="0.01"
              max={outstanding}
              step="0.01"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </FormField>

          <FormField label={t('finance.invoices.cashForm.receivedAt')} htmlFor="cash-received-at" required>
            <input
              id="cash-received-at"
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150"
            />
          </FormField>

          <FormField label={t('finance.invoices.cashForm.note')} htmlFor="cash-note">
            <Input
              id="cash-note"
              name="cash-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('finance.invoices.cashForm.notePlaceholder')}
            />
          </FormField>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!amountReceived || parseFloat(amountReceived) <= 0 || recordCash.isPending}
            >
              {recordCash.isPending ? t('common.loading') : t('finance.invoices.cashForm.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   Expenses Tab
   ═══════════════════════════════════════════════════════════════════════════ */

function ExpensesTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: expenses, isLoading } = useExpenses();
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);

  const columns: Column<Expense>[] = [
    {
      key: 'category',
      header: t('finance.expenses.columns.category'),
      sortable: true,
      render: (row) => (
        <span className="text-body font-medium text-foreground">{row.category}</span>
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
        <span className="font-mono text-body font-medium text-foreground">
          {formatDZD(row.amount)}
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
      render: (row) => (
        row.receipt_public_id ? (
          <span className="inline-flex items-center gap-1 text-caption text-primary font-medium">
            <Upload className="w-3.5 h-3.5" />
            {t('finance.expenses.hasReceipt')}
          </span>
        ) : (
          <span className="text-caption text-text-disabled">—</span>
        )
      ),
    },
    {
      key: 'created_by_name',
      header: t('finance.expenses.columns.createdBy'),
      render: (row) => (
        <span className="text-body text-text-secondary">{row.created_by_name}</span>
      ),
    },
  ];

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <CreateButton label={t('finance.expenses.create')} onClick={() => setShowCreateDialog(true)} />
      </div>

      <DataTable<Expense>
        columns={columns}
        data={expenses ?? []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/admin/finance/expenses/${row.id}`)}
        emptyMessage={t('finance.expenses.empty')}
      />

      <CreateExpenseDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
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

  const createExpense = useCreateExpense();

  const categoryOptions = [
    { value: 'supplies', label: t('finance.expenses.categories.supplies') },
    { value: 'utilities', label: t('finance.expenses.categories.utilities') },
    { value: 'maintenance', label: t('finance.expenses.categories.maintenance') },
    { value: 'salaries', label: t('finance.expenses.categories.salaries') },
    { value: 'food', label: t('finance.expenses.categories.food') },
    { value: 'transport', label: t('finance.expenses.categories.transport') },
    { value: 'other', label: t('finance.expenses.categories.other') },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !description.trim() || !amount || !date) return;

    createExpense.mutate(
      {
        category,
        description: description.trim(),
        amount: parseFloat(amount),
        date,
      },
      {
        onSuccess: () => {
          setCategory('');
          setDescription('');
          setAmount('');
          setDate(new Date().toISOString().slice(0, 10));
          onOpenChange(false);
        },
      }
    );
  }

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
            <input
              id="expense-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150"
            />
          </FormField>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!category || !description.trim() || !amount || createExpense.isPending}
            >
              {createExpense.isPending ? t('common.loading') : t('finance.expenses.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   Reports Tab
   ═══════════════════════════════════════════════════════════════════════════ */

function ReportsTab() {
  const { t } = useTranslation();
  const { data: summary, isLoading: summaryLoading } = useFinanceSummary();
  const { data: paymentMethods, isLoading: methodsLoading } = usePaymentMethodBreakdown();

  const isLoading = summaryLoading || methodsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-hover rounded-[10px] p-4 h-[88px] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-6 h-[200px] animate-pulse" />
          <div className="bg-card border border-border rounded-lg p-6 h-[200px] animate-pulse" />
        </div>
      </div>
    );
  }

  const totalCollected = (paymentMethods?.cash_total ?? 0) + (paymentMethods?.online_total ?? 0);
  const cashPercentage = totalCollected > 0
    ? Math.round(((paymentMethods?.cash_total ?? 0) / totalCollected) * 100)
    : 0;
  const onlinePercentage = totalCollected > 0
    ? Math.round(((paymentMethods?.online_total ?? 0) / totalCollected) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KPICard
          label={t('finance.reports.totalInvoiced')}
          value={formatDZD(summary?.total_invoiced ?? 0)}
          icon={<FileText className="w-4 h-4" />}
        />
        <KPICard
          label={t('finance.reports.totalCollected')}
          value={formatDZD(summary?.total_collected ?? 0)}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KPICard
          label={t('finance.reports.totalOutstanding')}
          value={formatDZD(summary?.total_outstanding ?? 0)}
          icon={<Receipt className="w-4 h-4" />}
        />
        <KPICard
          label={t('finance.reports.totalExpenses')}
          value={formatDZD(summary?.total_expenses ?? 0)}
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      {/* Payment Method Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment method chart */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-subsection font-semibold text-text-heading">
            {t('finance.reports.paymentBreakdown')}
          </h3>

          <div className="space-y-3">
            {/* Cash bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-body text-foreground">
                  <Banknote className="w-4 h-4 text-success" />
                  {t('finance.reports.cash')}
                </span>
                <span className="font-mono text-body font-medium text-foreground">
                  {formatDZD(paymentMethods?.cash_total ?? 0)}
                </span>
              </div>
              <div className="w-full h-3 bg-subtle rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-300"
                  style={{ width: `${cashPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-caption text-text-secondary">
                  {paymentMethods?.cash_count ?? 0} {t('finance.reports.transactions')}
                </span>
                <span className="text-caption font-medium text-text-secondary">
                  {cashPercentage}%
                </span>
              </div>
            </div>

            {/* Online bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-body text-foreground">
                  <CreditCard className="w-4 h-4 text-primary" />
                  {t('finance.reports.online')}
                </span>
                <span className="font-mono text-body font-medium text-foreground">
                  {formatDZD(paymentMethods?.online_total ?? 0)}
                </span>
              </div>
              <div className="w-full h-3 bg-subtle rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${onlinePercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-caption text-text-secondary">
                  {paymentMethods?.online_count ?? 0} {t('finance.reports.transactions')}
                </span>
                <span className="text-caption font-medium text-text-secondary">
                  {onlinePercentage}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Collection summary */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-subsection font-semibold text-text-heading">
            {t('finance.reports.collectionSummary')}
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-subtle">
              <span className="text-body text-text-secondary">{t('finance.reports.totalInvoiced')}</span>
              <span className="font-mono text-body font-medium text-foreground">
                {formatDZD(summary?.total_invoiced ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-subtle">
              <span className="text-body text-text-secondary">{t('finance.reports.totalCollected')}</span>
              <span className="font-mono text-body font-medium text-success">
                {formatDZD(summary?.total_collected ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-subtle">
              <span className="text-body text-text-secondary">{t('finance.reports.totalOutstanding')}</span>
              <span className="font-mono text-body font-medium text-warning">
                {formatDZD(summary?.total_outstanding ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-body text-text-secondary">{t('finance.reports.totalExpenses')}</span>
              <span className="font-mono text-body font-medium text-danger">
                {formatDZD(summary?.total_expenses ?? 0)}
              </span>
            </div>

            {/* Net income */}
            <div className="bg-subtle rounded-lg p-3 flex items-center justify-between mt-2">
              <span className="text-body font-medium text-foreground">{t('finance.reports.netIncome')}</span>
              <span className="font-mono text-subsection font-semibold text-text-heading">
                {formatDZD((summary?.total_collected ?? 0) - (summary?.total_expenses ?? 0))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared Utilities
   ═══════════════════════════════════════════════════════════════════════════ */

function formatDZD(amount: number): string {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function TableSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-hover rounded-md" />
        ))}
      </div>
    </div>
  );
}
