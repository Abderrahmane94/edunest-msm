import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: { academicYear: { findMany: vi.fn(), findFirst: vi.fn() } },
}));

import prisma from '../../lib/prisma';
import { academicYearsService } from './academic-years.service';

const db = prisma as unknown as { academicYear: { findMany: ReturnType<typeof vi.fn> } };
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

// Two years with a summer between them, sorted by start (as the query asks).
const years = [
  { id: 'y25', startDate: day('2025-09-01'), endDate: day('2026-06-30') },
  { id: 'y26', startDate: day('2026-09-01'), endDate: day('2027-06-30') },
];

beforeEach(() => {
  vi.clearAllMocks();
  db.academicYear.findMany.mockResolvedValue(years);
});

describe('yearForDate', () => {
  it.each([
    ['2025-12-01', 'y25', 'inside a year'],
    ['2026-06-30', 'y25', 'its last day'],
    ['2026-07-15', 'y26', 'the summer goes to the next year'],
    ['2026-09-01', 'y26', 'its first day'],
    ['2027-08-01', 'y26', 'after the last year: the last one'],
    ['2024-01-01', 'y25', 'before the first year: the first one'],
  ])('%s → %s (%s)', async (date, expected) => {
    expect(await academicYearsService.yearForDate('s1', day(date))).toBe(expected);
  });

  it('is null for a school without years', async () => {
    db.academicYear.findMany.mockResolvedValue([]);
    expect(await academicYearsService.yearForDate('s1', day('2026-01-01'))).toBeNull();
  });
});

describe('yearWindow', () => {
  it('first year: from the beginning to the end of its last day', async () => {
    expect(await academicYearsService.yearWindow('s1', 'y25')).toEqual({ from: undefined, to: day('2026-07-01') });
  });

  it('last year: from the day after the previous one, without end', async () => {
    expect(await academicYearsService.yearWindow('s1', 'y26')).toEqual({ from: day('2026-07-01'), to: undefined });
  });

  it('is null for a year of another school', async () => {
    expect(await academicYearsService.yearWindow('s1', 'other')).toBeNull();
  });
});
