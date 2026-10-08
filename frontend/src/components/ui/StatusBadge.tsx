import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 rounded-full text-caption-md font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        // Attendance statuses
        present: 'bg-success-muted text-present',
        absent: 'bg-danger-muted text-absent',
        late: 'bg-warning-muted text-late',
        // Invoice statuses
        paid: 'bg-success-muted text-paid',
        sent: 'bg-primary-muted text-primary',
        overdue: 'bg-danger-muted text-overdue',
        draft: 'bg-subtle text-text-secondary',
        cancelled: 'bg-subtle text-text-disabled',
        partial: 'bg-warning-muted text-pending',
        // General tones, for any other state
        success: 'bg-success-muted text-success',
        warning: 'bg-warning-muted text-warning',
        danger: 'bg-danger-muted text-danger',
        info: 'bg-accent-muted text-primary',
        neutral: 'bg-subtle text-text-secondary',
      },
    },
    defaultVariants: {
      variant: 'draft',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
}

export function StatusBadge({ variant, className, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant, className }))} {...props}>
      {children}
    </span>
  );
}
