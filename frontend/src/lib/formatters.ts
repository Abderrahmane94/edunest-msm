/**
 * Shared formatting utilities for EduNest.
 * Handles DZD currency formatting and DD/MM/YYYY date formatting
 * for both French and Arabic locales.
 */

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
 * Format a date string as DD/MM/YYYY.
 * Both locales use Western digits (standard in Algeria).
 */
export function formatDate(dateStr: string, _locale: string = 'fr'): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());

    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format a date+time string as DD/MM/YYYY HH:mm.
 */
export function formatDateTime(dateStr: string, _locale: string = 'fr'): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
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
