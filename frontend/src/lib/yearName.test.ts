import { describe, it, expect } from 'vitest';
import { shortYearName } from './yearName';

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
