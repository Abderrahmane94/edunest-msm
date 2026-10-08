import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    // The page scrolls, not this box: a scrolling box here would keep the
    // pages' sticky headers and save bars from sticking. overflow-x-clip still
    // keeps anything too wide from widening the page.
    <main className={cn('flex-1 min-w-0 p-4 sm:p-6 overflow-x-clip', className)}>
      {/* Lines stay readable on very wide screens. */}
      <div className="mx-auto w-full max-w-[1440px]">{children}</div>
    </main>
  );
}
