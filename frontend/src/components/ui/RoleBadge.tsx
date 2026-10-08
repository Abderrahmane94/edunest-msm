import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const ROLE_STYLES: Record<string, string> = {
  super_admin: 'bg-[var(--color-role-admin-bg,#EDE9FE)] text-[var(--color-role-admin,#5B21B6)]',
  admin: 'bg-[var(--color-role-admin-bg,#EDE9FE)] text-[var(--color-role-admin,#5B21B6)]',
  teacher: 'bg-[var(--color-role-teacher-bg,#DBEAFE)] text-[var(--color-role-teacher,#1D4ED8)]',
  parent: 'bg-[var(--color-role-parent-bg,#FCE7F3)] text-[var(--color-role-parent,#9D174D)]',
};

/** A user's role, in the same colours everywhere. */
export function RoleBadge({ role, className }: { role: string; className?: string }) {
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
    </span>
  );
}
