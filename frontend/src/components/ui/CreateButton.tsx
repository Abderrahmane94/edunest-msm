import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface CreateButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function CreateButton({ label, className, ...props }: CreateButtonProps) {
  return (
    <Button
      variant="primary"
      className={cn('gap-2 px-4 py-2 text-body font-semibold text-white hover:text-white shadow-level-1 hover:shadow-level-2 hover:scale-[1.02]', className)}
      {...props}
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20">
        <Plus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
      </span>
      {label}
    </Button>
  );
}
