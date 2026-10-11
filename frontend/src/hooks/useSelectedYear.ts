import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYears, type AcademicYear } from './useAcademicYears';

/**
 * The school year an admin is looking at. Each year's data (classes, children,
 * payments, expenses, salaries, announcements, events) is seen on its own:
 * screens show the chosen year, the active one by default. Remembered on this
 * device; teachers and parents always see the current year.
 */

const STORAGE_KEY = 'edunest.selectedYear';
const listeners = new Set<() => void>();

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let storedYearId = readStored();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSelectedYearId(id: string | null) {
  storedYearId = id;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not remembered (private mode): still chosen for this visit.
  }
  listeners.forEach((l) => l());
}

export interface SelectedYear {
  /** The year shown; undefined while loading or for a school without years. */
  year: AcademicYear | undefined;
  /** The school's current year. */
  activeYear: AcademicYear | undefined;
  /** Every year, latest first. */
  years: AcademicYear[];
  /** True when looking at the current year. */
  isActiveYear: boolean;
  /**
   * A closed year: one before the current year. It is looked at and its
   * unpaid charges collected, nothing else (the server refuses the rest).
   */
  isClosed: boolean;
  isLoading: boolean;
  /** Only school admins choose a year. */
  enabled: boolean;
}

export function useSelectedYear(): SelectedYear {
  const { user } = useAuth();
  // The school office (director and administrative staff) chooses a year.
  const enabled = user?.role === 'admin' || user?.role === 'administrative';
  // super_admin pages read the year too (without choosing one); teachers and parents can't list years.
  const query = useAcademicYears({ enabled: enabled || user?.role === 'super_admin' });
  const chosenId = useSyncExternalStore(subscribe, () => storedYearId);

  return useMemo(() => {
    const years = [...(query.data ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const activeYear = years.find((y) => y.is_active) ?? years[0];
    // A remembered year that no longer exists (deleted, other school) falls back to the current one.
    const year = years.find((y) => y.id === chosenId) ?? activeYear;
    return {
      year,
      activeYear,
      years,
      isActiveYear: !!year && year.id === activeYear?.id,
      isClosed: !!year && !!activeYear?.is_active && year.start_date < activeYear.start_date,
      isLoading: query.isLoading,
      enabled,
    };
  }, [query.data, query.isLoading, chosenId, enabled]);
}

/**
 * The year a list is limited to: the chosen one for an admin, none (as before)
 * for other roles. `ready` is false until it is known, so a list doesn't load
 * every year first and then the chosen one.
 */
export function useYearScope(): { yearId: string | undefined; ready: boolean } {
  const { year, enabled, isLoading } = useSelectedYear();
  if (!enabled) return { yearId: undefined, ready: true };
  return { yearId: year?.id, ready: !isLoading };
}

/** The year being looked at, shaped like a query result (drop-in for useActiveAcademicYear). */
export function useViewedYear(): { data: AcademicYear | undefined; isLoading: boolean } {
  const { year, isLoading } = useSelectedYear();
  return { data: year, isLoading };
}

/** Whether a year is closed (before the current one); the year looked at when none is given. */
export function useYearClosed(yearId?: string): boolean {
  const { year, years, activeYear } = useSelectedYear();
  const target = yearId ? years.find((y) => y.id === yearId) : year;
  return !!target && !!activeYear?.is_active && target.start_date < activeYear.start_date;
}
