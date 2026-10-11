import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, Clock, BarChart2, Settings, Wallet } from 'lucide-react';
import { BranchConfigPage } from './BranchConfigPage';
import { BranchCalendarPage } from './BranchCalendarPage';
import BranchFeesPage from './BranchFeesPage';
import { PaymentsPage } from './PaymentsPage';
import { LateDashboardPage } from './LateDashboardPage';
import { ReconciliationPage } from './ReconciliationPage';
import { ExpensesTab } from './ExpensesTab';
import { PageHeader, Tabs } from '@/components/ui';
import { useTabParam } from '@/hooks/useTabParam';
import { usePermissions } from '@/lib/roles';

type PaymentTab = 'records' | 'late' | 'reconciliation' | 'expenses' | 'config';

export function PaymentManagementPage() {
  const { t } = useTranslation();
  // A child's billing enrollment is managed from their page (Assigned fees → Manage billing).
  // The administrative staff collect payments and follow late ones; the rest is the director's.
  const { can } = usePermissions();
  const allowed = PAYMENT_TABS.filter((tab) => can(...TAB_AREA[tab]));
  const [activeTab, setActiveTab] = useTabParam<PaymentTab>(allowed.length ? allowed : PAYMENT_TABS, allowed[0] ?? 'records');

  const tabs: { value: PaymentTab; label: string; icon: React.ReactNode }[] = [
    { value: 'records', label: t('nav.paymentsRecords'), icon: <Receipt className="w-4 h-4" /> },
    { value: 'late', label: t('nav.paymentsLate'), icon: <Clock className="w-4 h-4" /> },
    { value: 'reconciliation', label: t('nav.paymentsRecon'), icon: <BarChart2 className="w-4 h-4" /> },
    { value: 'expenses', label: t('finance.tabs.expenses'), icon: <Wallet className="w-4 h-4" /> },
    { value: 'config', label: t('payments.branchConfig.title'), icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('nav.payments')} />

      <Tabs value={activeTab} onChange={setActiveTab} items={tabs.filter((tab) => allowed.includes(tab.value))} />

      {/* Tab content */}
      {activeTab === 'records' && <PaymentsPage />}
      {activeTab === 'late' && <LateDashboardPage />}
      {activeTab === 'reconciliation' && <ReconciliationPage />}
      {activeTab === 'expenses' && <ExpensesTab />}
      {activeTab === 'config' && <ConfigTab />}
    </div>
  );
}

/** Config tab renders billing config, fees, and calendar */
function ConfigTab() {
  return (
    <div className="space-y-8">
      {/* Billing Configuration */}
      <BranchConfigPage />

      {/* Fees */}
      <BranchFeesPage />

      {/* Calendar — periods for custom cycle fees */}
      <div id="billing-calendar-section">
        <BranchCalendarPage />
      </div>
    </div>
  );
}

const PAYMENT_TABS: PaymentTab[] = ['records', 'late', 'reconciliation', 'expenses', 'config'];
// Each tab with the right it needs (the fee configuration: to manage the fees).
const TAB_AREA: Record<PaymentTab, ['collections' | 'expenses' | 'fees', 'view' | 'edit']> = {
  records: ['collections', 'view'],
  late: ['collections', 'view'],
  reconciliation: ['expenses', 'view'],
  expenses: ['expenses', 'view'],
  config: ['fees', 'edit'],
};
