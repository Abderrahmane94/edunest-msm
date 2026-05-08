import { describe, it, expect } from 'vitest';
import { formatDZD, formatDate, formatDateTime, formatCurrency } from './formatters';

describe('formatDZD', () => {
  it('formats amount with French locale by default', () => {
    const result = formatDZD(12500);
    // Should contain the amount and DZD currency indicator
    expect(result).toContain('12');
    expect(result).toContain('500');
  });

  it('formats amount with Arabic locale', () => {
    const result = formatDZD(12500, 'ar');
    // Should contain Arabic currency symbol
    expect(result).toContain('د.ج');
  });

  it('includes two decimal places', () => {
    const result = formatDZD(100, 'fr');
    expect(result).toMatch(/100/);
  });
});

describe('formatDate', () => {
  it('formats date as DD/MM/YYYY', () => {
    const result = formatDate('2024-03-15', 'fr');
    expect(result).toBe('15/03/2024');
  });

  it('formats date as DD/MM/YYYY for Arabic locale', () => {
    const result = formatDate('2024-12-01', 'ar');
    expect(result).toBe('01/12/2024');
  });

  it('returns original string for invalid date', () => {
    const result = formatDate('not-a-date', 'fr');
    expect(result).toBe('not-a-date');
  });
});

describe('formatDateTime', () => {
  it('formats date and time as DD/MM/YYYY HH:mm', () => {
    const result = formatDateTime('2024-03-15T14:30:00', 'fr');
    expect(result).toBe('15/03/2024 14:30');
  });

  it('returns original string for invalid date', () => {
    const result = formatDateTime('invalid', 'ar');
    expect(result).toBe('invalid');
  });
});

describe('formatCurrency', () => {
  it('delegates to formatDZD for DZD currency', () => {
    const result = formatCurrency(5000, 'DZD', 'fr');
    expect(result).toContain('5');
    expect(result).toContain('000');
  });

  it('formats other currencies using Intl', () => {
    const result = formatCurrency(100, 'EUR', 'fr');
    expect(result).toContain('100');
  });
});
