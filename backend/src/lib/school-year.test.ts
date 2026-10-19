import { describe, it, expect } from 'vitest';
import { orderedYearName, schoolYearOf } from './school-year';

describe('schoolYearOf', () => {
  it('from September to July: the year that started in September', () => {
    expect(schoolYearOf('2026-10-19')).toEqual({ name: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' });
    expect(schoolYearOf('2027-03-01')).toEqual({ name: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' });
    expect(schoolYearOf('2027-07-31').name).toBe('2026-2027');
  });

  it('from August: the coming year', () => {
    expect(schoolYearOf('2027-08-01').name).toBe('2027-2028');
  });
});

describe('orderedYearName', () => {
  it('puts two reversed years back in order, keeping how they are separated', () => {
    expect(orderedYearName('2027/2026')).toBe('2026/2027');
    expect(orderedYearName('2027 - 2026')).toBe('2026 - 2027');
    expect(orderedYearName('Année 2027-2026')).toBe('Année 2026-2027');
  });

  it('leaves a name in order, or without two years, as it is', () => {
    expect(orderedYearName('2026-2027')).toBe('2026-2027');
    expect(orderedYearName('Rentrée 2026')).toBe('Rentrée 2026');
  });
});
