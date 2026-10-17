import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const ROLE_STYLES: Record<string, string> = {
  super_admin: 'bg-[var(--color-role-admin-bg,#EDE9FE)] text-[var(--color-role-admin,#5B21B6)]',
  admin: 'bg-[var(--color-role-admin-bg,#EDE9FE)] text-[var(--color-role-admin,#5B21B6)]',
  teacher: 'bg-[var(--color-role-teacher-bg,#DBEAFE)] text-[var(--color-role-teacher,#1D4ED8)]',
  parent: 'bg-[var(--color-role-parent-bg,#FCE7F3)] text-[var(--color-role-parent,#9D174D)]',
};

/**
 * What follows the role in its badge: the office role of the office staff
 * ("Administratif · Comptable"), the job of an employee without access to
 * the app ("Employé sans accès · Femme de ménage").
 */
export function roleDetail(role: string, of: { accessProfile?: string | null; position?: string | null }): string | null {
  if (role === 'administrative') return of.accessProfile ?? null;
  if (role === 'staff') return of.position ?? null;
  return null;
}

/** A user's role, in the same colours everywhere, with its detail after it (see roleDetail). */
export function RoleBadge({ role, detail, className }: { role: string; detail?: string | null; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-caption-md font-medium whitespace-nowrap',
        ROLE_STYLES[role] ?? 'bg-subtle text-text-secondary',
        className,
      )}
    >
      {t(`users.roles.${role}`)}
      {detail && <span className="font-normal">&nbsp;· {detail}</span>}
    </span>
  );
}
