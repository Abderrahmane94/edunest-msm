import { describe, it, expect } from 'vitest';
import { shortYearName, yearNameFromDates } from './yearName';

describe('shortYearName', () => {
  it('keeps the last two digits of each year, however the name is written', () => {
    expect(shortYearName('2026-2027')).toBe('26-27');
    expect(shortYearName('2026/2027')).toBe('26-27');
    expect(shortYearName('Année 2026 – 2027')).toBe('26-27');
  });

  it('a name without two years stays as it is', () => {
    expect(shortYearName('Rentrée')).toBe('Rentrée');
  });
});

describe('yearNameFromDates', () => {
  it('names the year from its dates', () => {
    expect(yearNameFromDates('2026-09-01', '2027-07-31')).toBe('2026-2027');
    expect(yearNameFromDates('2026-01-05', '2026-12-20')).toBe('2026');
  });

  it('nothing until both dates are set', () => {
    expect(yearNameFromDates('2026-09-01', '')).toBeNull();
  });
});
