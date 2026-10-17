import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePickerInput } from './DatePicker';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, type = 'text', ...props }, ref) => {
    const inputId = id || props.name;

    if (type === 'date') {
      const { name, value, onChange, min, max, disabled, required, placeholder, ...rest } = props;
      return (
        <div className="flex flex-col gap-1">
          {label && (
            <label htmlFor={inputId} className="text-label font-medium text-foreground">
              {label}
            </label>
          )}
          <DatePickerInput
            {...rest}
            id={inputId}
            name={name}
            value={typeof value === 'string' ? value : undefined}
            onChange={onChange}
            min={typeof min === 'string' ? min : undefined}
            max={typeof max === 'string' ? max : undefined}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            className={cn(error && 'border-danger focus:border-danger focus:shadow-focus-ring', className)}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          />
          {error && (
            <p id={`${inputId}-error`} className="text-caption text-danger" role="alert">
              {error}
            </p>
          )}
          {!error && helperText && (
            <p id={`${inputId}-helper`} className="text-caption text-text-secondary">
              {helperText}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-label font-medium text-foreground"
          >
            {label}
          </label>
        )}
        {type === 'password' ? (
          <PasswordField
            id={inputId}
            ref={ref}
            className={className}
            error={error}
            describedBy={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
        ) : (
        <input
          type={type}
          id={inputId}
          className={cn(
            'w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground placeholder:text-text-disabled',
            'transition-all duration-150',
            'focus:outline-none focus:border-primary focus:shadow-focus-ring',
            error && 'border-danger focus:border-danger focus:shadow-focus-danger',
            className
          )}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-caption text-danger" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-caption text-text-secondary">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

/** A password, with the eye that shows what was typed (to check it before saving). */
const PasswordField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string; describedBy?: string }
>(({ className, error, describedBy, ...props }, ref) => {
  const { t } = useTranslation();
  const [shown, setShown] = React.useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        ref={ref}
        className={cn(
          'w-full bg-card border border-border rounded-md ps-3 pe-10 py-2 text-body text-foreground placeholder:text-text-disabled',
          'transition-all duration-150',
          'focus:outline-none focus:border-primary focus:shadow-focus-ring',
          error && 'border-danger focus:border-danger focus:shadow-focus-danger',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="absolute end-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-text-disabled hover:text-text-secondary transition focus-visible:outline-none focus-visible:shadow-focus-ring"
        aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={shown}
      >
        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
});
PasswordField.displayName = 'PasswordField';

export { Input };
