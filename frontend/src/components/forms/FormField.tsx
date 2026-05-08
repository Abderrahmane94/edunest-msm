import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  helperText,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1 mb-4', className)}>
      <label
        htmlFor={htmlFor}
        className="text-label font-medium text-foreground"
      >
        {label}
        {required && <span className="text-danger ms-0.5">*</span>}
      </label>

      {children}

      {error && (
        <p className="text-caption text-danger" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-caption text-text-secondary">{helperText}</p>
      )}
    </div>
  );
}
