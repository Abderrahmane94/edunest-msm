import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, UserPlus, Receipt, Clock, BarChart2, Settings } from 'lucide-react';
import { Button } from '@/components/ui';
import { BranchConfigPage } from './BranchConfigPage';
import { BranchCalendarPage } from './BranchCalendarPage';
import BranchFeesPage from './BranchFeesPage';
import { EnrollmentsPage } from './EnrollmentsPage';
import { PaymentsPage } from './PaymentsPage';
import { LateDashboardPage } from './LateDashboardPage';
import { ReconciliationPage } from './ReconciliationPage';

type PaymentTab = 'enrollments' | 'records' | 'late' | 'reconciliation' | 'config';

export function PaymentManagementPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read tab from URL query param, default to 'enrollments'
  const tabParam = searchParams.get('tab') as PaymentTab | null;
  const activeTab: PaymentTab = tabParam && isValidTab(tabParam) ? tabParam : 'enrollments';

  function setActiveTab(tab: PaymentTab) {
    setSearchParams({ tab });
  }

  const tabs: { key: PaymentTab; label: string; icon: React.ReactNode }[] = [
    { key: 'enrollments', label: t('nav.paymentsEnrollments'), icon: <UserPlus className="w-4 h-4" /> },
    { key: 'records', label: t('nav.paymentsRecords'), icon: <Receipt className="w-4 h-4" /> },
    { key: 'late', label: t('nav.paymentsLate'), icon: <Clock className="w-4 h-4" /> },
    { key: 'reconciliation', label: t('nav.paymentsRecon'), icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'config', label: t('payments.branchConfig.title', 'Configuration'), icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <CreditCard className="w-6 h-6 text-primary" />
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('nav.payments')}
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
      {activeTab === 'enrollments' && <EnrollmentsPage />}
      {activeTab === 'records' && <PaymentsPage />}
      {activeTab === 'late' && <LateDashboardPage />}
      {activeTab === 'reconciliation' && <ReconciliationPage />}
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

      {/* Calendar */}
      <BranchCalendarPage />
    </div>
  );
}

function isValidTab(tab: string): tab is PaymentTab {
  return ['enrollments', 'records', 'late', 'reconciliation', 'config'].includes(tab);
}
