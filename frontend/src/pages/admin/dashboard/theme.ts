import * as React from 'react';
import { useTranslation } from 'react-i18next';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-subtle text-text-secondary',
  accent: 'bg-accent-muted text-primary',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
};

export const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-[var(--color-text-disabled)]',
  accent: 'bg-[var(--color-accent)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-text-heading',
  accent: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

// ─── Number formatting (app language, Western digits) ───

export function useNumbers() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-DZ' : 'fr-DZ';
  return React.useMemo(() => {
    const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    return {
      money: (n: number) => money.format(n),
      compact: (n: number) => compact.format(n),
      percent: (n: number) => `${number.format(n)} %`,
      number: (n: number) => number.format(n),
    };
  }, [locale]);
}
