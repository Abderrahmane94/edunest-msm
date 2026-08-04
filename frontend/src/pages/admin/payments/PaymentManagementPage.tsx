import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, UserPlus, Receipt, Clock, BarChart2, Settings, Building2, Plus } from 'lucide-react';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui';
import { FormField } from '@/components/forms';
import { useBranches, useCreateBranch } from '@/hooks/useBranchBillingConfig';
import { BranchConfigPage } from './BranchConfigPage';
import { BranchCalendarPage } from './BranchCalendarPage';
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

/** Config tab renders branch list + billing config and calendar */
function ConfigTab() {
  const { t } = useTranslation();
  const { data: branches, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newAddress, setNewAddress] = React.useState('');

  async function handleCreate() {
    if (!newName.trim()) return;
    await createBranch.mutateAsync({ name: newName.trim(), address: newAddress.trim() || undefined });
    setNewName('');
    setNewAddress('');
    setDialogOpen(false);
  }

  return (
    <div className="space-y-8">
      {/* Branch List */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-heading">
              {t('payments.branches.title', 'Filiales')}
            </h2>
          </div>
          <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            {t('payments.branches.create', 'Nouvelle filiale')}
          </Button>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-10 bg-hover rounded-md" />)}
          </div>
        ) : branches && branches.length > 0 ? (
          <div className="divide-y divide-border">
            {branches.map((branch) => (
              <div key={branch.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-text-primary">{branch.name}</p>
                  {branch.address && (
                    <p className="text-sm text-text-secondary">{branch.address}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {branch.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-secondary text-sm">
            {t('payments.branches.empty', 'Aucune filiale créée')}
          </p>
        )}
      </div>

      {/* Create Branch Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payments.branches.create', 'Nouvelle filiale')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormField label={t('payments.branches.name', 'Nom de la filiale')} required>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('payments.branches.namePlaceholder', 'Ex: Filiale Centre')}
              />
            </FormField>
            <FormField label={t('payments.branches.address', 'Adresse')}>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder={t('payments.branches.addressPlaceholder', 'Adresse (optionnel)')}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!newName.trim() || createBranch.isPending}
            >
              {createBranch.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billing Configuration */}
      <BranchConfigPage />

      {/* Calendar */}
      <BranchCalendarPage />
    </div>
  );
}

function isValidTab(tab: string): tab is PaymentTab {
  return ['enrollments', 'records', 'late', 'reconciliation', 'config'].includes(tab);
}
