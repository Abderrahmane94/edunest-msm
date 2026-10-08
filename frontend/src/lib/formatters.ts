/**
 * Shared formatting utilities for EduNest.
 * Handles DZD currency formatting and DD/MM/YYYY date formatting
 * for both French and Arabic locales.
 */

import i18next from 'i18next';

/** The app's language, for formatters called without an explicit locale. */
function appLocale(): string {
  return i18next.language?.startsWith('ar') ? 'ar' : 'fr';
}

/**
 * Lay out numeric date parts for the language. In Arabic the day sits on the
 * right and is read first: right-to-left marks keep the parts from joining
 * into one left-to-right number, and the right-to-left isolate keeps that
 * order even inside a left-to-right element.
 */
function joinDateParts(parts: string[], locale: string, time?: string): string {
  if (locale !== 'ar') return parts.join('/') + (time ? ` ${time}` : '');
  return '⁧' + parts.join('‏/') + (time ? `‏ ${time}` : '') + '⁩';
}

/**
 * Format a number as DZD (Algerian Dinar) currency.
 * - French locale: "12 500,00 DA"
 * - Arabic locale: "12٬500٫00 د.ج"
 */
export function formatDZD(amount: number, locale: string = 'fr'): string {
  if (locale === 'ar') {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string as DD/MM/YYYY, in the app's language unless one is given.
 * Both locales use Western digits (standard in Algeria); in Arabic the day is
 * on the right (shown as 2024/12/01 for 1 December).
 */
export function formatDate(dateStr: string, locale: string = appLocale()): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());

    return joinDateParts([day, month, year], locale);
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string as a month name + year, e.g. "septembre 2026" / "سبتمبر 2026".
 * Western digits in both locales (standard in Algeria).
 */
export function formatMonthYear(dateStr: string, locale: string = 'fr'): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ-u-nu-latn' : 'fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Format a date in the app's language (not the device's), e.g. with
 * { weekday: 'long', day: 'numeric', month: 'long' } → "lundi 5 octobre" / "الاثنين 5 أكتوبر".
 * Western digits in both locales (standard in Algeria).
 */
export function formatDateIn(
  date: string | Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';

    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ-u-nu-latn' : 'fr-FR', options).format(d);
  } catch {
    return typeof date === 'string' ? date : '';
  }
}

/**
 * Format a time as HH:mm (24-hour, whatever the device's settings).
 */
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Format a date+time string as DD/MM/YYYY HH:mm, in the app's language unless
 * one is given (in Arabic the day is on the right, see formatDate).
 */
export function formatDateTime(dateStr: string, locale: string = appLocale()): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return joinDateParts([day, month, year], locale, `${hours}:${minutes}`);
  } catch {
    return dateStr;
  }
}

/**
 * Format currency with explicit currency code (for cases where currency may vary).
 * Falls back to DZD formatting.
 */
export function formatCurrency(amount: number, currency: string = 'DZD', locale: string = 'fr'): string {
  if (currency === 'DZD') {
    return formatDZD(amount, locale);
  }

  return new Intl.NumberFormat(locale === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
