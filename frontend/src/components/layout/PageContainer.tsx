import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main className={cn('flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto', className)}>
      {children}
    </main>
  );
}
