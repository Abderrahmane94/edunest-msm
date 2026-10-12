import { describe, it, expect } from 'vitest';
import { addDays, addMonths, dateInMonth, monthOf } from './period';

describe('period helpers', () => {
  it('moves by days across months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('moves by months across years', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('builds and reads dates', () => {
    expect(dateInMonth('2026-10', 3)).toBe('2026-10-03');
    expect(monthOf('2026-10-03')).toBe('2026-10');
  });
});
