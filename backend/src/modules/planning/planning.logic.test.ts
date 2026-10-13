import { describe, it, expect } from 'vitest';
import { addDays, monthHours, openingGap, shiftsOn, shiftsProblem, weekStartOf, weekTypeOf, weekdayOf, type Shift } from './planning.logic';

const every = (weekdays: number[], start: string, end: string): Shift[] => weekdays.map((weekday) => ({ weekday, week: 'all', start, end }));

describe('the team planning', () => {
  it('starts its weeks on Sunday', () => {
    expect(weekdayOf('2026-10-13')).toBe(2); // a Tuesday
    expect(weekStartOf('2026-10-13')).toBe('2026-10-11');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-11');
    expect(weekStartOf('2026-10-17')).toBe('2026-10-11');
  });

  it('alternates week A and week B without a gap, also over new year', () => {
    let day = '2026-11-01';
    let previous = weekTypeOf(day);
    for (let i = 0; i < 20; i++) {
      day = addDays(day, 7);
      const type = weekTypeOf(day);
      expect(type).not.toBe(previous);
      expect(weekTypeOf(addDays(day, 6))).toBe(type);
      previous = type;
    }
  });

  it('gives the shifts of a day: every week, or of its week A or B', () => {
    const sunday = '2026-10-11';
    const type = weekTypeOf(sunday);
    const other = type === 'a' ? 'b' : 'a';
    const shifts: Shift[] = [
      { weekday: 0, week: type, start: '07:30', end: '12:30' },
      { weekday: 0, week: other, start: '12:30', end: '17:30' },
    ];
    expect(shiftsOn(shifts, sunday)).toEqual([shifts[0]]);
    expect(shiftsOn(shifts, addDays(sunday, 7))).toEqual([shifts[1]]);
    expect(shiftsOn(every([0, 1], '08:00', '16:00'), addDays(sunday, 2))).toEqual([]);
  });

  it('refuses a usual week that makes no sense', () => {
    expect(shiftsProblem(every([0, 1, 2], '08:00', '16:00'))).toBeNull();
    expect(shiftsProblem([{ weekday: 0, week: 'all', start: '08:00', end: '12:00' }, { weekday: 0, week: 'all', start: '13:00', end: '17:00' }])).toBeNull();
    expect(shiftsProblem([{ weekday: 0, week: 'all', start: '16:00', end: '08:00' }])).toMatch(/end after/);
    expect(shiftsProblem([{ weekday: 0, week: 'all', start: '08:00', end: '13:00' }, { weekday: 0, week: 'all', start: '12:00', end: '17:00' }])).toMatch(/overlap/);
    expect(shiftsProblem([{ weekday: 0, week: 'all', start: '08:00', end: '12:00' }, { weekday: 1, week: 'a', start: '08:00', end: '12:00' }])).toMatch(/not both/);
  });

  it('counts a month: hours planned, away and worked', () => {
    // October 2026: 21 days from Sunday to Thursday.
    const week = every([0, 1, 2, 3, 4], '08:00', '16:00');
    const full = monthHours(week, [], '2026-10');
    expect(full.plannedMinutes).toBe(21 * 480);
    expect(full.workedMinutes).toBe(21 * 480);
    // Away from Tuesday 13 to Monday 19: five days due (Friday and Saturday are not).
    const away = monthHours(week, [{ startDate: '2026-10-13', endDate: '2026-10-19', reason: 'illness' }], '2026-10');
    expect(away.absentDays).toEqual({ illness: 5 });
    expect(away.absentMinutes).toBe(5 * 480);
    expect(away.workedMinutes).toBe(16 * 480);
    // The month in progress stops at today.
    expect(monthHours(week, [], '2026-10', '2026-10-13').plannedMinutes).toBe(9 * 480);
    // Nobody's usual week recorded: the days away still count, Sunday to Thursday.
    expect(monthHours([], [{ startDate: '2026-10-13', endDate: '2026-10-19', reason: 'leave' }], '2026-10')).toMatchObject({ plannedMinutes: 0, absentDaysTotal: 5 });
  });

  it('says when the day no longer opens or closes as usual', () => {
    const opener = { userId: 'a', shifts: [{ start: '07:30', end: '15:30' }], away: false };
    const closer = { userId: 'b', shifts: [{ start: '09:00', end: '17:30' }], away: false };
    expect(openingGap([opener, closer])).toBeNull();
    expect(openingGap([{ ...opener, away: true }, closer])).toEqual({ opening: { usual: '07:30', actual: '09:00' } });
    expect(openingGap([opener, { ...closer, away: true }])).toEqual({ closing: { usual: '17:30', actual: '15:30' } });
    expect(openingGap([{ ...opener, away: true }])).toEqual({ opening: { usual: '07:30', actual: null }, closing: { usual: '15:30', actual: null } });
    expect(openingGap([{ userId: 'c', shifts: [], away: false }])).toBeNull();
  });
});
