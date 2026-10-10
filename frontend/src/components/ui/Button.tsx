import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-focus-ring',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-accent)] text-white hover:text-white border-none shadow-[0_4px_14px_rgba(91,85,214,0.32)] hover:shadow-[0_6px_20px_rgba(91,85,214,0.42)] hover:from-[var(--color-accent)] hover:to-[var(--color-accent-hover)]',
        secondary:
          'bg-card text-text-heading border border-border-strong hover:bg-[var(--color-accent-subtle)] hover:border-[var(--color-accent-muted)] hover:text-primary shadow-level-0',
        danger:
          'bg-card text-danger border border-danger-muted hover:bg-[var(--color-danger-subtle)] hover:border-danger focus-visible:shadow-focus-danger',
        ghost:
          'bg-transparent text-text-secondary border-none hover:bg-subtle hover:text-text-primary',
      },
      size: {
        sm: 'px-3 py-[5px] text-label rounded-lg',
        md: 'px-4 py-2 text-body rounded-xl',
        lg: 'px-5 py-[10px] text-body-lg rounded-xl',
        icon: 'h-9 w-9 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
