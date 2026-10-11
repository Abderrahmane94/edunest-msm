import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/prisma', () => ({ default: { substitution: { findMany: vi.fn() } } }));

import prisma from '../../lib/prisma';
import { payrollService } from './payroll.service';

const findMany = (prisma as unknown as { substitution: { findMany: ReturnType<typeof vi.fn> } }).substitution.findMany;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const SUN_THU = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

describe('substitutionDays', () => {
  it("counts each replacement's class working days within the month, as substitute and as the teacher away", async () => {
    findMany.mockResolvedValue([
      {
        // Thu 29 Oct → Tue 3 Nov 2026: in November, Sun 1, Mon 2, Tue 3.
        id: 'r1', substituteUserId: 'u1', absentTeacherId: 't9', reason: 'illness',
        startDate: day('2026-10-29'), endDate: day('2026-11-03'),
        classroom: { name: 'Poussins', workingDays: SUN_THU },
        substitute: { firstName: 'Fatima', lastName: 'H' }, absentTeacher: { firstName: 'Khadidja', lastName: 'M' },
      },
      {
        // Fri 13 → Sat 14 Nov: no working day.
        id: 'r2', substituteUserId: null, absentTeacherId: 'u1', reason: 'leave',
        startDate: day('2026-11-13'), endDate: day('2026-11-14'),
        classroom: { name: 'Papillons', workingDays: SUN_THU },
        substitute: null, absentTeacher: { firstName: 'Fatima', lastName: 'H' },
      },
    ]);
    const r = await payrollService.substitutionDays('s1', 'u1', 2026, 11);
    expect(r.replacingDays).toBe(3);
    expect(r.replacing[0]).toMatchObject({ classroom: 'Poussins', otherName: 'Khadidja M', days: 3 });
    expect(r.awayDays).toBe(0);
    expect(r.away[0]).toMatchObject({ classroom: 'Papillons', otherName: null });
  });
});
