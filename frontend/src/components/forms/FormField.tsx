import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const SKIPPED_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'hidden', 'file']);

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
  const { t } = useTranslation();
  const controlsRef = React.useRef<HTMLDivElement>(null);
  const requiredMessage = t('common.fieldRequired');

  // The asterisk alone never stopped a form: mark the field's controls required
  // so the browser blocks the submit, and count blank-only text as empty.
  // Runs on every render (values set by the parent) and on input (typing).
  React.useLayoutEffect(() => {
    if (!required || !controlsRef.current) return;
    const controls = Array.from(
      controlsRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea',
      ),
    ).filter((el) => !(el instanceof HTMLInputElement && SKIPPED_TYPES.has(el.type)));
    const check = (el: (typeof controls)[number]) =>
      el.setCustomValidity(el.value.trim() === '' ? requiredMessage : '');
    const onInput = (e: Event) => check(e.target as (typeof controls)[number]);
    controls.forEach((el) => {
      el.required = true;
      check(el);
      el.addEventListener('input', onInput);
    });
    return () =>
      controls.forEach((el) => {
        el.removeEventListener('input', onInput);
        el.setCustomValidity('');
      });
  });

  return (
    <div className={cn('flex flex-col gap-1 mb-4', className)}>
      <label
        htmlFor={htmlFor}
        className="text-label font-medium text-foreground"
      >
        {label}
        {required && <span className="text-danger ms-0.5">*</span>}
      </label>

      <div ref={controlsRef} className="contents">
        {children}
      </div>

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
