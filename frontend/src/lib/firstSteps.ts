import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import type { AdminDashboard } from '@/hooks/useAdminDashboard';

export type Setup = AdminDashboard['setup'];
export type Step = keyof Setup;

/** In the order a new school sets itself up, each with where it is done. */
export const STEPS: { key: Step; to: string }[] = [
  { key: 'year', to: '/admin/settings?tab=years' },
  { key: 'rooms', to: '/admin/settings?tab=rooms' },
  { key: 'classes', to: '/admin/classrooms' },
  { key: 'fees', to: '/admin/payments?tab=config' },
  { key: 'team', to: '/admin/users' },
  { key: 'children', to: '/admin/children' },
];

/** Whether `step` is done on the page at `pathname` + `search` (same path, and same tab when the step names one). */
export function isStepPage(step: { to: string }, pathname: string, search: string): boolean {
  const [path, query] = step.to.split('?');
  if (pathname !== path) return false;
  const tab = new URLSearchParams(query).get('tab');
  return !tab || new URLSearchParams(search).get('tab') === tab;
}

/** The first steps alone, for the guide on every page. */
export function useSetup(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'setup'],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<Setup>('/admin/setup');
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to load the first steps');
      return res.data;
    },
    staleTime: 0,
  });
}

// Put away for the school on this device: the dashboard card and the guide go together.
const hiddenKey = (schoolId: string) => `kiddoo:first-steps-hidden:${schoolId}`;
const CHANGE = 'kiddoo:first-steps-hidden';

function readHidden(schoolId: string): boolean {
  try {
    return localStorage.getItem(hiddenKey(schoolId)) === '1';
  } catch {
    return false;
  }
}

export function useFirstStepsHidden(schoolId: string): [boolean, () => void] {
  const [hidden, setHidden] = React.useState(() => readHidden(schoolId));
  React.useEffect(() => {
    const sync = () => setHidden(readHidden(schoolId));
    window.addEventListener(CHANGE, sync);
    return () => window.removeEventListener(CHANGE, sync);
  }, [schoolId]);
  const hide = React.useCallback(() => {
    setHidden(true);
    try {
      localStorage.setItem(hiddenKey(schoolId), '1');
    } catch {
      // No device storage: it shows again next time, nothing else.
    }
    window.dispatchEvent(new Event(CHANGE));
  }, [schoolId]);
  return [hidden, hide];
}
