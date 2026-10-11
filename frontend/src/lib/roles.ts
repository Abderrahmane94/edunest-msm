import { useAuth } from '@/contexts/AuthContext';

/** The school office: the director (admin), the administrative staff (إداري), or super_admin. */
export function isOfficeRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'administrative' || role === 'super_admin';
}

/**
 * Whether the user manages the school (the director, or super_admin): users,
 * settings, fees, expenses, payroll, deletions. The administrative staff do
 * the office's day-to-day work only.
 */
export function useIsDirector(): boolean {
  const { user } = useAuth();
  return user?.role === 'admin' || user?.role === 'super_admin';
}
