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
          'bg-gradient-to-b from-[var(--color-accent-light)] to-[var(--color-accent)] text-white hover:text-white border-none shadow-level-1 hover:shadow-level-2 hover:from-[var(--color-accent)] hover:to-[var(--color-accent-hover)]',
        secondary:
          'bg-card text-foreground border border-border hover:bg-hover hover:border-border-strong shadow-level-0',
        danger:
          'bg-card text-danger border border-danger-muted hover:bg-[var(--color-danger-subtle)] hover:border-danger focus-visible:shadow-focus-danger',
        ghost:
          'bg-transparent text-text-secondary border-none hover:bg-subtle hover:text-text-primary',
      },
      size: {
        sm: 'px-3 py-[5px] text-label rounded-sm',
        md: 'px-4 py-2 text-body rounded-md',
        lg: 'px-5 py-[10px] text-body-lg rounded-md',
        icon: 'h-9 w-9 rounded-md',
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
