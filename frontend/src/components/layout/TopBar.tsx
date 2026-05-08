import { cn } from '@/lib/utils';

interface TopBarProps {
  children?: React.ReactNode;
  className?: string;
}

export function TopBar({ children, className }: TopBarProps) {
  return (
    <header
      className={cn(
        'h-14 bg-card border-b border-border px-4 flex items-center justify-between sticky top-0 z-30',
        className
      )}
    >
      {children}
    </header>
  );
}
