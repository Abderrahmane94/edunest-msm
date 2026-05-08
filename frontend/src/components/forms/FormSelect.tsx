import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
}

const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, options, error, helperText, placeholder, className, id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="flex flex-col gap-1 mb-4">
        <label
          htmlFor={selectId}
          className="text-label font-medium text-foreground"
        >
          {label}
        </label>

        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full appearance-none bg-card border border-border rounded-md px-3 py-2 pe-9 text-body text-foreground',
              'transition-all duration-150',
              'focus:outline-none focus:border-primary focus:shadow-focus-ring',
              error && 'border-danger focus:border-danger focus:shadow-focus-danger',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
        </div>

        {error && (
          <p id={`${selectId}-error`} className="text-caption text-danger" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${selectId}-helper`} className="text-caption text-text-secondary">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
FormSelect.displayName = 'FormSelect';

export { FormSelect };
