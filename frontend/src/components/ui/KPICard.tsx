import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface KPICardProps {
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down';
    value: string;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({ label, value, trend, icon, className }: KPICardProps) {
  return (
    <div
      className={cn(
        'bg-hover rounded-[10px] p-4 flex flex-col gap-2',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-caption text-text-secondary font-medium">{label}</span>
        {icon && <span className="text-text-secondary">{icon}</span>}
      </div>

      <div className="flex items-end gap-2">
        <span className="text-page-title font-semibold text-text-heading">{value}</span>

        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-caption font-medium mb-1',
              trend.direction === 'up' ? 'text-success' : 'text-danger'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
