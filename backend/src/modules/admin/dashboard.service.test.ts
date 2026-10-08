import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { attendanceWeeks, collectedByMonth, schoolToday, summarizePeriods } from './dashboard.service';

const d = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dec = (n: number) => new Prisma.Decimal(n);

describe('schoolToday', () => {
  it("uses the school's date (Algiers, UTC+1), not the server's", () => {
    // 23:30 UTC on Oct 7 is already Oct 8 in Algiers.
    expect(schoolToday(new Date('2026-10-07T23:30:00Z'))).toBe('2026-10-08');
    expect(schoolToday(new Date('2026-10-07T22:30:00Z'))).toBe('2026-10-07');
  });
});

describe('summarizePeriods', () => {
  const period = (over: Partial<Parameters<typeof summarizePeriods>[0][number]>) => ({
    childId: 'c1',
    academicYearId: 'y1',
    amountDue: dec(1000),
    paid: dec(0),
    dueDate: d('2026-09-01'),
    graceEndDate: d('2026-09-10'),
    ...over,
  });

  it('counts what is still owed after the grace date, and each child once', () => {
    const { late } = summarizePeriods(
      [
        period({ paid: dec(400) }),
        period({ dueDate: d('2026-10-01'), graceEndDate: d('2026-10-05') }),
        period({ childId: 'c2', paid: dec(1000) }), // paid
        period({ childId: 'c3', graceEndDate: d('2026-10-20') }), // still in its grace period
      ],
      '2026-10-08',
      'y1',
    );
    expect(late).toEqual({ amount: 1600, children: 1 });
  });

  it("gives the share paid of what has fallen due this school year", () => {
    const { recoveryRate } = summarizePeriods(
      [
        period({ paid: dec(1000) }),
        period({ paid: dec(500) }),
        period({ paid: dec(1500) }), // overpaid: counts as fully paid, not more
        period({ academicYearId: 'old', paid: dec(0) }), // another year
        period({ dueDate: d('2026-11-01'), graceEndDate: d('2026-11-10') }), // not due yet
      ],
      '2026-10-08',
      'y1',
    );
    expect(recoveryRate).toBe(83.3);
  });

  it('has no rate when nothing is due yet', () => {
    expect(summarizePeriods([], '2026-10-08', 'y1').recoveryRate).toBeNull();
  });
});

describe('collectedByMonth', () => {
  it('adds payments and corrections (negative) per month', () => {
    expect(
      collectedByMonth(
        [
          { valueDate: d('2026-09-15'), totalAmount: dec(3000) },
          { valueDate: d('2026-10-02'), totalAmount: dec(5000) },
          { valueDate: d('2026-10-03'), totalAmount: dec(-1000) },
        ],
        ['2026-08', '2026-09', '2026-10'],
      ),
    ).toEqual([
      { month: '2026-08', collected: 0 },
      { month: '2026-09', collected: 3000 },
      { month: '2026-10', collected: 4000 },
    ]);
  });
});

describe('attendanceWeeks', () => {
  it('gives the share of present or late marks per week, ending today', () => {
    const weeks = attendanceWeeks(
      [
        { date: d('2026-10-08'), status: 'present', count: 6 },
        { date: d('2026-10-05'), status: 'late', count: 2 },
        { date: d('2026-10-04'), status: 'absent', count: 2 },
        { date: d('2026-09-30'), status: 'absent', count: 1 },
        { date: d('2026-09-28'), status: 'present', count: 3 },
      ],
      '2026-10-08',
    );
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-09-11', '2026-09-18', '2026-09-25', '2026-10-02']);
    expect(weeks.map((w) => w.rate)).toEqual([null, null, 75, 80]);
  });
});
