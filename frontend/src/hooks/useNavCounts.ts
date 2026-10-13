import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/lib/roles';
import { useAdminDashboard } from './useAdminDashboard';
import { useCashSummary } from './useCashDesks';
import { useEquipmentToRepair } from './useEquipment';
import { useLowStockCount } from './useInventory';
import { useConversations } from './useMessaging';
import { useUnreadCount } from './useNotificationCenter';
import { useStaffConversations } from './useStaffMessaging';

const unread = (list: { unread_count: number }[] | undefined) => (list ?? []).reduce((n, c) => n + (c.unread_count || 0), 0);

/**
 * What waits behind each entry of the office menu, by path: late payments
 * and cash desks to collect, parents without an answer, roll calls not done,
 * supplies to buy. Only what the user's rights open is counted (and asked).
 */
export function useOfficeNavCounts(enabled: boolean) {
  const { can, canCollectCash } = usePermissions();
  const { data: dashboard } = useAdminDashboard(enabled);
  const { data: cash } = useCashSummary(enabled && can('collections'));
  const inventory = enabled && can('inventory');
  const { data: lowStock = 0 } = useLowStockCount(inventory);
  const { data: toRepair = 0 } = useEquipmentToRepair(inventory);
  const { data: staffThreads } = useStaffConversations(enabled && can('communication'));

  const counts: Record<string, number> = {};
  if (!enabled || !dashboard) return { counts, today: null };
  if (can('collections')) {
    counts['/admin/payments'] = dashboard.finance.late.children + (canCollectCash ? cash?.toCollect?.count ?? 0 : cash?.mine?.due ? 1 : 0);
  }
  if (can('communication')) counts['/admin/communication'] = dashboard.communication.waitingParents + unread(staffThreads);
  if (can('classes') && dashboard.attendance.isSchoolDay) counts['/admin/attendance'] = dashboard.attendance.missingClassrooms.length;
  if (inventory) counts['/admin/inventory'] = lowStock + toRepair;

  const a = dashboard.attendance;
  return {
    counts,
    /** Today at a glance, for the top of the menu. */
    today: can('classes') && a.isSchoolDay ? { present: a.present + a.late, expected: a.expected, callsMissing: a.missingClassrooms.length } : null,
  };
}

/** Unread messages (and, for parents, notifications), by path. */
export function usePersonalNavCounts(): Record<string, number> {
  const { user } = useAuth();
  const teacher = user?.role === 'teacher';
  const parent = user?.role === 'parent';
  const { data: mine } = useConversations();
  const { data: staff } = useStaffConversations(teacher);
  const { data: notifications = 0 } = useUnreadCount();
  if (teacher) return { '/teacher/messages': unread(mine) + unread(staff) };
  if (parent) return { '/parent/messages': unread(mine), '/parent/notifications': notifications };
  return {};
}
