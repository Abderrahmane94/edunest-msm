import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/prisma', () => ({ default: {} }));
vi.mock('../substitutions/teaching-access', () => ({ asDay: () => new Date('2026-10-12T00:00:00.000Z') }));

import { withExceptions } from './access.service';
import { OFFICE_DEFAULT_PERMISSIONS } from './permissions';

describe('withExceptions', () => {
  it("replaces the profile's level, up or down, area by area", () => {
    const p = withExceptions(OFFICE_DEFAULT_PERMISSIONS, [
      { area: 'payroll', level: 'edit' },
      { area: 'collections', level: 'none' },
    ]);
    expect(p.areas.payroll).toBe('edit');
    expect(p.areas.collections).toBe('none');
    expect(p.areas.children).toBe('edit');
    // The profile itself is left as it was.
    expect(OFFICE_DEFAULT_PERMISSIONS.areas.payroll).toBe('none');
  });

  it('turns the two separate rights on or off', () => {
    const p = withExceptions(OFFICE_DEFAULT_PERMISSIONS, [{ area: 'correctPayments', level: 'edit' }]);
    expect(p.correctPayments).toBe(true);
    expect(withExceptions({ ...OFFICE_DEFAULT_PERMISSIONS, delete: true }, [{ area: 'delete', level: 'none' }]).delete).toBe(false);
  });

  it('ignores unknown areas or levels', () => {
    const p = withExceptions(OFFICE_DEFAULT_PERMISSIONS, [{ area: 'root', level: 'edit' }, { area: 'payroll', level: 'all' }]);
    expect(p).toEqual(OFFICE_DEFAULT_PERMISSIONS);
  });
});
