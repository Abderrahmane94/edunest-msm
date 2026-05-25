import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Pencil, Trash2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate } from '@/lib/formatters';
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
import { FormField } from '@/components/forms';
import type { Column } from '@/components/ui';
import {
  usePayrollEmployees,
  useSetSalary,
  usePayrollPayments,
  useRecordPayment,
  useDeletePayment,
  type EmployeeRecord,
  type SalaryPayment,
} from '@/hooks/usePayroll';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDZD(value: string | number) {
  return `${Number(value).toLocaleString('fr-FR')} DZD`;
}

function MonthLabel({ month, year }: { month: number; year: number }) {
  const { t } = useTranslation();
  return (
    <span>
      {t(`payroll.months.${month}`)} {year}
    </span>
  );
}

// ─── Set Salary Dialog ────────────────────────────────────────────────────────

function SetSalaryDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: EmployeeRecord | null;
}) {
  const { t } = useTranslation();
  const setSalary = useSetSalary();
  const [form, setForm] = React.useState({
    baseSalary: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (employee?.salary) {
      setForm({
        baseSalary: employee.salary.baseSalary,
        effectiveFrom: employee.salary.effectiveFrom.split('T')[0],
        notes: employee.salary.notes ?? '',
      });
    } else {
      setForm({ baseSalary: '', effectiveFrom: new Date().toISOString().split('T')[0], notes: '' });
    }
    setError(null);
  }, [employee, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setError(null);
    try {
      await setSalary.mutateAsync({
        userId: employee.id,
        data: {
          baseSalary: parseFloat(form.baseSalary),
          effectiveFrom: form.effectiveFrom,
          notes: form.notes || undefined,
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('payroll.setSalaryDialog.title')}</DialogTitle>
          <DialogDescription>
            {employee
              ? `${employee.firstName} ${employee.lastName}`
              : t('payroll.setSalaryDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormField label={t('payroll.setSalaryDialog.baseSalary')} htmlFor="ps-base" required>
            <Input
              id="ps-base"
              type="number"
              min="0"
              step="0.01"
              value={form.baseSalary}
              onChange={(e) => setForm((p) => ({ ...p, baseSalary: e.target.value }))}
              placeholder="50000"
            />
          </FormField>
          <FormField label={t('payroll.setSalaryDialog.effectiveFrom')} htmlFor="ps-eff" required>
            <Input
              id="ps-eff"
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
            />
          </FormField>
          <FormField label={t('payroll.setSalaryDialog.notes')} htmlFor="ps-notes">
            <Input
              id="ps-notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder={t('payroll.setSalaryDialog.notesPlaceholder')}
            />
          </FormField>
          {error && <p className="text-body text-danger mb-2">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={setSalary.isPending}>
              {setSalary.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Payment Dialog ────────────────────────────────────────────────────

function RecordPaymentDialog({
  open,
  onOpenChange,
  employees,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: EmployeeRecord[];
}) {
  const { t } = useTranslation();
  const recordPayment = useRecordPayment();
  const now = new Date();
  const [form, setForm] = React.useState({
    userId: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    baseSalary: '',
    bonuses: '0',
    deductions: '0',
    paidAt: now.toISOString().split('T')[0],
    note: '',
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      const d = new Date();
      setForm({
        userId: '',
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        baseSalary: '',
        bonuses: '0',
        deductions: '0',
        paidAt: d.toISOString().split('T')[0],
        note: '',
      });
      setError(null);
    }
  }, [open]);

  function handleEmployeeChange(userId: string) {
    const emp = employees.find((e) => e.id === userId);
    setForm((p) => ({
      ...p,
      userId,
      baseSalary: emp?.salary?.baseSalary ?? '',
    }));
  }

  const net =
    (parseFloat(form.baseSalary) || 0) +
    (parseFloat(form.bonuses) || 0) -
    (parseFloat(form.deductions) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordPayment.mutateAsync({
        userId: form.userId,
        month: form.month,
        year: form.year,
        baseSalary: parseFloat(form.baseSalary),
        bonuses: parseFloat(form.bonuses) || 0,
        deductions: parseFloat(form.deductions) || 0,
        paidAt: form.paidAt,
        note: form.note || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('payroll.recordDialog.title')}</DialogTitle>
          <DialogDescription>{t('payroll.recordDialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormField label={t('payroll.recordDialog.employee')} htmlFor="rp-emp" required>
            <select
              id="rp-emp"
              value={form.userId}
              onChange={(e) => handleEmployeeChange(e.target.value)}
              required
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="">{t('payroll.recordDialog.employeePlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-x-4">
            <FormField label={t('payroll.recordDialog.month')} htmlFor="rp-month" required>
              <select
                id="rp-month"
                value={form.month}
                onChange={(e) => setForm((p) => ({ ...p, month: parseInt(e.target.value) }))}
                className="w-full h-9 rounded-md border border-border bg-card px-3 text-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {t(`payroll.months.${m}`)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t('payroll.recordDialog.year')} htmlFor="rp-year" required>
              <select
                id="rp-year"
                value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: parseInt(e.target.value) }))}
                className="w-full h-9 rounded-md border border-border bg-card px-3 text-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label={t('payroll.recordDialog.baseSalary')} htmlFor="rp-base" required>
            <Input
              id="rp-base"
              type="number"
              min="0"
              step="0.01"
              value={form.baseSalary}
              onChange={(e) => setForm((p) => ({ ...p, baseSalary: e.target.value }))}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-x-4">
            <FormField label={t('payroll.recordDialog.bonuses')} htmlFor="rp-bonuses">
              <Input
                id="rp-bonuses"
                type="number"
                min="0"
                step="0.01"
                value={form.bonuses}
                onChange={(e) => setForm((p) => ({ ...p, bonuses: e.target.value }))}
              />
            </FormField>
            <FormField label={t('payroll.recordDialog.deductions')} htmlFor="rp-ded">
              <Input
                id="rp-ded"
                type="number"
                min="0"
                step="0.01"
                value={form.deductions}
                onChange={(e) => setForm((p) => ({ ...p, deductions: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="rounded-md bg-subtle border border-border px-4 py-3 flex items-center justify-between mb-3">
            <span className="text-body text-text-secondary">{t('payroll.recordDialog.netSalary')}</span>
            <span className="text-body font-semibold font-mono text-foreground">{fmtDZD(net)}</span>
          </div>

          <FormField label={t('payroll.recordDialog.paidAt')} htmlFor="rp-paid" required>
            <Input
              id="rp-paid"
              type="date"
              value={form.paidAt}
              onChange={(e) => setForm((p) => ({ ...p, paidAt: e.target.value }))}
            />
          </FormField>

          <FormField label={t('payroll.recordDialog.note')} htmlFor="rp-note">
            <Input
              id="rp-note"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder={t('payroll.recordDialog.notePlaceholder')}
            />
          </FormField>

          {error && <p className="text-body text-danger mb-2">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={recordPayment.isPending || !form.userId || !form.baseSalary}>
              {recordPayment.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

function EmployeesTab() {
  const { t } = useTranslation();
  const { data: employees, isLoading } = usePayrollEmployees();
  const [setSalaryOpen, setSetSalaryOpen] = React.useState(false);
  const [selectedEmployee, setSelectedEmployee] = React.useState<EmployeeRecord | null>(null);

  function openSetSalary(emp: EmployeeRecord) {
    setSelectedEmployee(emp);
    setSetSalaryOpen(true);
  }

  const columns: Column<EmployeeRecord>[] = [
    {
      key: 'name',
      header: t('payroll.columns.employee'),
      render: (emp) => (
        <div>
          <p className="text-body font-medium text-foreground">
            {emp.firstName} {emp.lastName}
          </p>
          <p className="text-caption text-text-secondary">{emp.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('payroll.columns.role'),
      render: (emp) => (
        <span className="text-body text-text-secondary capitalize">{emp.role}</span>
      ),
    },
    {
      key: 'salary',
      header: t('payroll.employees.salary'),
      render: (emp) =>
        emp.salary ? (
          <div>
            <p className="text-body font-mono font-medium text-foreground">
              {fmtDZD(emp.salary.baseSalary)}
            </p>
            <p className="text-caption text-text-secondary" dir="ltr">
              {t('payroll.employees.effectiveFrom')}: {formatDate(emp.salary.effectiveFrom)}
            </p>
          </div>
        ) : (
          <span className="text-caption text-text-secondary italic">{t('payroll.employees.noSalary')}</span>
        ),
    },
    {
      key: 'lastPayment',
      header: t('payroll.employees.lastPayment'),
      render: (emp) =>
        emp.lastPayment ? (
          <div>
            <p className="text-body font-mono font-medium text-foreground">
              {fmtDZD(emp.lastPayment.netSalary)}
            </p>
            <p className="text-caption text-text-secondary">
              <MonthLabel month={emp.lastPayment.month} year={emp.lastPayment.year} />
            </p>
          </div>
        ) : (
          <span className="text-caption text-text-secondary">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (emp) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openSetSalary(emp);
          }}
        >
          <Pencil className="w-3.5 h-3.5" />
          {emp.salary ? t('payroll.employees.editSalary') : t('payroll.employees.setSalary')}
        </Button>
      ),
      className: 'w-40',
    },
  ];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-hover rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <>
      <DataTable<EmployeeRecord>
        columns={columns}
        data={employees ?? []}
        keyExtractor={(emp) => emp.id}
        emptyMessage={t('payroll.payments.empty')}
      />
      <SetSalaryDialog
        open={setSalaryOpen}
        onOpenChange={setSetSalaryOpen}
        employee={selectedEmployee}
      />
    </>
  );
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

async function renderPDF(html: string, filename: string) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed; top:-20000px; left:0; width:794px; z-index:-9999; opacity:0; pointer-events:none;';
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  await document.fonts.ready;
  await new Promise<void>((r) => setTimeout(r, 250));

  const canvas = await html2canvas(wrapper.firstElementChild as HTMLElement, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 794,
  });
  document.body.removeChild(wrapper);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / pdfW;
  const pageHeightPx = Math.floor(pdfH * ratio);
  let srcY = 0;
  let firstPage = true;
  while (srcY < canvas.height) {
    if (!firstPage) pdf.addPage();
    firstPage = false;
    const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, sliceH / ratio);
    srcY += pageHeightPx;
  }
  pdf.save(filename);
}

type TFn = (key: string) => string;

function fmtPdfDate(value: string | Date): string {
  let date: Date;
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    date = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  } else {
    date = value;
  }
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${mo}/${d}`;
}

function buildPayslipHTML(p: SalaryPayment, monthLabel: string, isRTL: boolean, t: TFn): string {
  const dir = isRTL ? 'rtl' : 'ltr';
  const font = isRTL
    ? "'Noto Sans Arabic', Arial, sans-serif"
    : "'Plus Jakarta Sans', Arial, sans-serif";
  const startAlign = isRTL ? 'right' : 'left';
  const endAlign = isRTL ? 'left' : 'right';

  const today = fmtPdfDate(new Date());

  const row = (label: string, value: string, valueColor = '#111827', ltrValue = true) =>
    `<tr>
      <td dir="${dir}" style="padding:10px 0;font-size:11px;color:#6b7280;width:50%;text-align:${startAlign};border-bottom:1px solid #f3f4f6;">${label}</td>
      <td dir="${ltrValue ? 'ltr' : dir}" style="padding:10px 0;font-size:11px;font-weight:600;color:${valueColor};text-align:${endAlign};border-bottom:1px solid #f3f4f6;unicode-bidi:embed;">${value}</td>
    </tr>`;

  const hasBonuses = parseFloat(p.bonuses) > 0;
  const hasDeductions = parseFloat(p.deductions) > 0;

  return `
<div dir="${dir}" style="font-family:${font};direction:${dir};background:#fff;width:794px;box-sizing:border-box;color:#111827;">
  <table style="width:100%;border-collapse:collapse;background:#6366f1;">
    <tr>
      <td style="padding:22px 32px;vertical-align:middle;">
        <div style="color:#fff;font-size:22px;font-weight:700;margin-bottom:4px;">EduNest</div>
        <div style="color:#c7d2fe;font-size:11px;">${t('payroll.pdf.payslipTitle')}</div>
      </td>
      <td dir="ltr" style="padding:22px 32px;vertical-align:middle;text-align:${endAlign};color:#e0e7ff;font-size:10px;unicode-bidi:embed;">
        ${today}
      </td>
    </tr>
  </table>

  <div style="padding:28px 32px;">
    <div dir="${dir}" style="font-size:20px;font-weight:700;color:#111827;margin-bottom:2px;text-align:${startAlign};">${p.employeeName}</div>
    <div dir="${dir}" style="font-size:11px;color:#6b7280;margin-bottom:24px;text-align:${startAlign};">${p.role} — ${monthLabel}</div>

    <div style="background:#f9fafb;border-radius:12px;padding:20px 24px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${row(t('payroll.columns.baseSalary'), `${Number(p.baseSalary).toLocaleString('fr-FR')} DZD`, '#111827')}
          ${hasBonuses ? row(t('payroll.columns.bonuses'), `+${Number(p.bonuses).toLocaleString('fr-FR')} DZD`, '#16a34a') : ''}
          ${hasDeductions ? row(t('payroll.columns.deductions'), `-${Number(p.deductions).toLocaleString('fr-FR')} DZD`, '#dc2626') : ''}
        </tbody>
      </table>
    </div>

    <div style="background:#eef2ff;border-radius:12px;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <span dir="${dir}" style="font-size:13px;font-weight:600;color:#4338ca;">${t('payroll.pdf.netToPay')}</span>
      <span dir="ltr" style="font-size:22px;font-weight:700;color:#4338ca;unicode-bidi:embed;">${Number(p.netSalary).toLocaleString('fr-FR')} DZD</span>
    </div>

    <div style="background:#f9fafb;border-radius:12px;padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${row(t('payroll.pdf.paymentDate'), fmtPdfDate(p.paidAt), '#111827')}
          ${p.note ? row(t('payroll.columns.note'), p.note, '#6b7280', false) : ''}
        </tbody>
      </table>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;background:#6366f1;margin-top:28px;">
    <tr>
      <td style="padding:8px 32px;color:#fff;font-size:9px;font-weight:600;text-align:${startAlign};">EduNest</td>
      <td dir="ltr" style="padding:8px 32px;color:#c7d2fe;font-size:9px;text-align:${endAlign};unicode-bidi:embed;">${t('payroll.pdf.generatedOn')}: ${today}</td>
    </tr>
  </table>
</div>`;
}

function buildPayrollListHTML(items: SalaryPayment[], isRTL: boolean, monthName: (m: number, y: number) => string, t: TFn): string {
  const dir = isRTL ? 'rtl' : 'ltr';
  const font = isRTL
    ? "'Noto Sans Arabic', Arial, sans-serif"
    : "'Plus Jakarta Sans', Arial, sans-serif";
  const startAlign = isRTL ? 'right' : 'left';
  const endAlign = isRTL ? 'left' : 'right';

  const today = fmtPdfDate(new Date());
  const thStyle = `padding:10px 12px;font-weight:600;font-size:11px;color:#fff;text-align:${startAlign};`;

  const totalNet = items.reduce((s, p) => s + parseFloat(p.netSalary), 0);

  const rows = items
    .map((p, i) => {
      const bg = i % 2 === 1 ? '#f9fafb' : '#ffffff';
      return `<tr style="background:${bg};">
        <td dir="${dir}" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:${startAlign};font-weight:500;">${p.employeeName}</td>
        <td dir="${dir}" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:${startAlign};color:#6b7280;">${monthName(p.month, p.year)}</td>
        <td dir="ltr" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:${endAlign};unicode-bidi:embed;">${Number(p.baseSalary).toLocaleString('fr-FR')} DZD</td>
        <td dir="ltr" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:${endAlign};color:#16a34a;unicode-bidi:embed;">${parseFloat(p.bonuses) > 0 ? `+${Number(p.bonuses).toLocaleString('fr-FR')} DZD` : '—'}</td>
        <td dir="ltr" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:${endAlign};color:#dc2626;unicode-bidi:embed;">${parseFloat(p.deductions) > 0 ? `-${Number(p.deductions).toLocaleString('fr-FR')} DZD` : '—'}</td>
        <td dir="ltr" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;font-weight:700;text-align:${endAlign};unicode-bidi:embed;">${Number(p.netSalary).toLocaleString('fr-FR')} DZD</td>
        <td dir="ltr" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:${startAlign};color:#6b7280;unicode-bidi:embed;">${fmtPdfDate(p.paidAt)}</td>
      </tr>`;
    })
    .join('');

  return `
<div dir="${dir}" style="font-family:${font};direction:${dir};background:#fff;width:794px;box-sizing:border-box;color:#111827;">
  <table style="width:100%;border-collapse:collapse;background:#6366f1;">
    <tr>
      <td style="padding:22px 32px;vertical-align:middle;">
        <div style="color:#fff;font-size:22px;font-weight:700;margin-bottom:4px;">EduNest</div>
        <div style="color:#c7d2fe;font-size:11px;">${t('payroll.pdf.reportTitle')}</div>
      </td>
      <td dir="ltr" style="padding:22px 32px;vertical-align:middle;text-align:${endAlign};color:#e0e7ff;font-size:10px;unicode-bidi:embed;">${today}</td>
    </tr>
  </table>

  <div style="padding:24px 32px 0;">
    <table style="width:100%;border-collapse:separate;border-spacing:12px 0;margin-bottom:20px;table-layout:fixed;">
      <tr>
        <td style="background:#eef2ff;border-radius:10px;padding:14px 18px;width:50%;vertical-align:top;">
          <div dir="ltr" style="font-size:26px;font-weight:700;color:#6366f1;line-height:1;text-align:${startAlign};unicode-bidi:embed;">${items.length}</div>
          <div dir="${dir}" style="font-size:10px;color:#6b7280;margin-top:6px;text-align:${startAlign};">${t('payroll.pdf.totalPayments')}</div>
        </td>
        <td style="background:#f0fdf4;border-radius:10px;padding:14px 18px;width:50%;vertical-align:top;">
          <div dir="ltr" style="font-size:20px;font-weight:700;color:#16a34a;line-height:1;text-align:${startAlign};unicode-bidi:embed;">${totalNet.toLocaleString('fr-FR')} DZD</div>
          <div dir="${dir}" style="font-size:10px;color:#6b7280;margin-top:6px;text-align:${startAlign};">${t('payroll.pdf.totalNet')}</div>
        </td>
      </tr>
    </table>

    <table dir="${dir}" style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <colgroup>
        <col style="width:20%"><col style="width:14%"><col style="width:17%">
        <col style="width:13%"><col style="width:13%"><col style="width:15%"><col style="width:12%">
      </colgroup>
      <thead>
        <tr style="background:#6366f1;">
          <th dir="${dir}" style="${thStyle}">${t('payroll.columns.employee')}</th>
          <th dir="${dir}" style="${thStyle}">${t('payroll.columns.period')}</th>
          <th dir="ltr"    style="${thStyle};text-align:${endAlign};">${t('payroll.columns.baseSalary')}</th>
          <th dir="ltr"    style="${thStyle};text-align:${endAlign};">${t('payroll.columns.bonuses')}</th>
          <th dir="ltr"    style="${thStyle};text-align:${endAlign};">${t('payroll.columns.deductions')}</th>
          <th dir="ltr"    style="${thStyle};text-align:${endAlign};">${t('payroll.pdf.netColumn')}</th>
          <th dir="ltr"    style="${thStyle}">${t('payroll.columns.paidAt')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f3f4f6;border-top:2px solid #d1d5db;">
          <td colspan="5" style="padding:10px 12px;"></td>
          <td dir="ltr" style="padding:10px 12px;font-weight:700;font-size:11px;text-align:${endAlign};color:#16a34a;unicode-bidi:embed;">${totalNet.toLocaleString('fr-FR')} DZD</td>
          <td style="padding:10px 12px;"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <table style="width:100%;border-collapse:collapse;background:#6366f1;margin-top:28px;">
    <tr>
      <td style="padding:8px 32px;color:#fff;font-size:9px;font-weight:600;text-align:${startAlign};">EduNest</td>
      <td dir="ltr" style="padding:8px 32px;color:#c7d2fe;font-size:9px;text-align:${endAlign};unicode-bidi:embed;">${t('payroll.pdf.generatedOn')}: ${today}</td>
    </tr>
  </table>
</div>`;
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab({ employees }: { employees: EmployeeRecord[] }) {
  const { t } = useTranslation();
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [filterUserId, setFilterUserId] = React.useState('');
  const [filterYear, setFilterYear] = React.useState<number | undefined>();
  const [filterMonth, setFilterMonth] = React.useState<number | undefined>();
  const [page, setPage] = React.useState(1);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [pdfRowId, setPdfRowId] = React.useState<string | null>(null);
  const [pdfBulkLoading, setPdfBulkLoading] = React.useState(false);
  const pageSize = 20;

  const deletePayment = useDeletePayment();
  const { data, isLoading } = usePayrollPayments({
    userId: filterUserId || undefined,
    year: filterYear,
    month: filterMonth,
    page,
    pageSize,
  });

  const now = new Date();
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  function monthName(m: number, y: number) {
    return `${t(`payroll.months.${m}`)} ${y}`;
  }

  async function downloadPayslip(p: SalaryPayment) {
    setPdfRowId(p.id);
    try {
      const isRTL = document.documentElement.dir === 'rtl';
      const html = buildPayslipHTML(p, monthName(p.month, p.year), isRTL, t);
      const safeName = p.employeeName.replace(/\s+/g, '-');
      await renderPDF(html, `fiche-paie-${safeName}-${p.year}-${String(p.month).padStart(2, '0')}.pdf`);
    } finally {
      setPdfRowId(null);
    }
  }

  async function downloadBulkPDF() {
    const items = data?.items;
    if (!items || items.length === 0) return;
    setPdfBulkLoading(true);
    try {
      const isRTL = document.documentElement.dir === 'rtl';
      const html = buildPayrollListHTML(items, isRTL, monthName, t);
      await renderPDF(html, `rapport-paie-${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
      setPdfBulkLoading(false);
    }
  }

  const columns: Column<SalaryPayment>[] = [
    {
      key: 'employee',
      header: t('payroll.columns.employee'),
      render: (p) => <span className="text-body font-medium text-foreground">{p.employeeName}</span>,
    },
    {
      key: 'period',
      header: t('payroll.columns.period'),
      render: (p) => (
        <span className="text-body text-text-secondary">
          <MonthLabel month={p.month} year={p.year} />
        </span>
      ),
    },
    {
      key: 'baseSalary',
      header: t('payroll.columns.baseSalary'),
      render: (p) => <span className="text-body font-mono text-text-secondary">{fmtDZD(p.baseSalary)}</span>,
    },
    {
      key: 'bonuses',
      header: t('payroll.columns.bonuses'),
      render: (p) => (
        <span className="text-body font-mono text-success">
          {parseFloat(p.bonuses) > 0 ? `+${fmtDZD(p.bonuses)}` : '—'}
        </span>
      ),
    },
    {
      key: 'deductions',
      header: t('payroll.columns.deductions'),
      render: (p) => (
        <span className="text-body font-mono text-danger">
          {parseFloat(p.deductions) > 0 ? `-${fmtDZD(p.deductions)}` : '—'}
        </span>
      ),
    },
    {
      key: 'netSalary',
      header: t('payroll.columns.netSalary'),
      render: (p) => (
        <span className="text-body font-mono font-semibold text-foreground">{fmtDZD(p.netSalary)}</span>
      ),
    },
    {
      key: 'paidAt',
      header: t('payroll.columns.paidAt'),
      render: (p) => (
        <span className="text-body text-text-secondary" dir="ltr">
          {formatDate(p.paidAt)}
        </span>
      ),
    },
    {
      key: 'note',
      header: t('payroll.columns.note'),
      render: (p) => <span className="text-caption text-text-secondary">{p.note || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (p) =>
        deleteConfirm === p.id ? (
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={deletePayment.isPending}
              onClick={(e) => {
                e.stopPropagation();
                deletePayment.mutate(p.id, { onSuccess: () => setDeleteConfirm(null) });
              }}
            >
              {t('common.confirm')}
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              title={t('payroll.pdf.downloadPayslip')}
              disabled={pdfRowId === p.id}
              onClick={(e) => { e.stopPropagation(); downloadPayslip(p); }}
            >
              <Download className={`w-4 h-4 ${pdfRowId === p.id ? 'animate-pulse text-primary' : 'text-text-secondary'}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirm(p.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 text-danger" />
            </Button>
          </div>
        ),
      className: 'w-40',
    },
  ];

  const hasItems = (data?.items?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterUserId}
          onChange={(e) => { setFilterUserId(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-card px-3 text-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">{t('payroll.payments.allEmployees')}</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>

        <select
          value={filterYear ?? ''}
          onChange={(e) => { setFilterYear(e.target.value ? parseInt(e.target.value) : undefined); setPage(1); }}
          className="h-9 rounded-md border border-border bg-card px-3 text-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">{t('payroll.payments.filterYear')}</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={filterMonth ?? ''}
          onChange={(e) => { setFilterMonth(e.target.value ? parseInt(e.target.value) : undefined); setPage(1); }}
          className="h-9 rounded-md border border-border bg-card px-3 text-body text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">{t('payroll.payments.allMonths')}</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>{t(`payroll.months.${m}`)}</option>
          ))}
        </select>

        <div className="flex-1" />

        {hasItems && (
          <Button variant="secondary" size="sm" onClick={downloadBulkPDF} disabled={pdfBulkLoading}>
            <Download className="w-4 h-4" />
            {pdfBulkLoading ? t('common.loading') : t('payroll.pdf.exportList')}
          </Button>
        )}
        <CreateButton label={t('payroll.payments.record')} onClick={() => setRecordOpen(true)} />
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-hover rounded-md" />
          ))}
        </div>
      ) : (
        <DataTable<SalaryPayment>
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(p) => p.id}
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={setPage}
          emptyMessage={t('payroll.payments.empty')}
        />
      )}

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} employees={employees} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'employees' | 'payments';

export function PayrollPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<Tab>('employees');
  const { data: employees } = usePayrollEmployees();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Banknote className="w-6 h-6 text-text-secondary" />
        <h1 className="text-page-title font-semibold text-text-heading">{t('payroll.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['employees', 'payments'] as Tab[]).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab(tab)}
          >
            {t(`payroll.tabs.${tab}`)}
          </Button>
        ))}
      </div>

      {activeTab === 'employees' ? (
        <EmployeesTab />
      ) : (
        <PaymentsTab employees={employees ?? []} />
      )}
    </div>
  );
}
