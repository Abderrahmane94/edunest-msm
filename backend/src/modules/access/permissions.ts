/**
 * What an office profile allows, area by area: none, view or edit (edit
 * includes view). Two sensitive rights are kept apart: deleting (children,
 * classes, the trash) and correcting a recorded payment. The director has
 * every right; teachers and parents keep their own rules (their class, their
 * children) and have no profile.
 */
export const AREAS = [
  'children',
  'classes',
  'communication',
  'inventory',
  'collections',
  'expenses',
  'fees',
  'payroll',
  'staff',
  'settings',
] as const;
export type Area = (typeof AREAS)[number];
export const LEVELS = ['none', 'view', 'edit'] as const;
export type Level = (typeof LEVELS)[number];

export interface Permissions {
  areas: Record<Area, Level>;
  /** Delete children and classes, empty the trash. */
  delete: boolean;
  /** Record a correction of a payment. */
  correctPayments: boolean;
  /** Count and take the cash of the others' cash desks. */
  collectCash: boolean;
}

const all = (level: Level) => Object.fromEntries(AREAS.map((a) => [a, level])) as Record<Area, Level>;

/** The director's rights: everything. */
export const FULL_PERMISSIONS: Permissions = { areas: all('edit'), delete: true, correctPayments: true, collectCash: true };

/**
 * The default office profile: what the administrative staff could do before
 * profiles existed (day-to-day work, collecting payments, reading the fees).
 */
export const OFFICE_DEFAULT_PERMISSIONS: Permissions = {
  areas: {
    children: 'edit',
    classes: 'edit',
    communication: 'edit',
    inventory: 'edit',
    collections: 'edit',
    expenses: 'none',
    fees: 'view',
    payroll: 'none',
    staff: 'none',
    settings: 'none',
  },
  delete: false,
  correctPayments: false,
  collectCash: false,
};

/** Profile JSON as stored, made whole (unknown areas off, missing ones none). */
export function normalizePermissions(raw: unknown): Permissions {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<{ areas: Record<string, unknown>; delete: unknown; correctPayments: unknown; collectCash: unknown }>;
  const areas = all('none');
  for (const a of AREAS) {
    const v = r.areas?.[a];
    if (v === 'view' || v === 'edit') areas[a] = v;
  }
  return { areas, delete: r.delete === true, correctPayments: r.correctPayments === true, collectCash: r.collectCash === true };
}

/** Whether these rights reach `level` in `area` (edit includes view). */
export function allows(p: Permissions, area: Area, level: Exclude<Level, 'none'> = 'view'): boolean {
  const have = p.areas[area];
  return level === 'view' ? have === 'view' || have === 'edit' : have === 'edit';
}
