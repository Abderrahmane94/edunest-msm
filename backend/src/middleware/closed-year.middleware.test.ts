import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../lib/prisma', () => ({ default: {} }));
vi.mock('../modules/academic-years/academic-years.service', () => ({
  academicYearsService: { isClosed: vi.fn() },
}));

import { academicYearsService } from '../modules/academic-years/academic-years.service';
import { rejectClosedYear, CLOSED_YEAR_MESSAGE } from './closed-year.middleware';

const isClosed = academicYearsService.isClosed as unknown as ReturnType<typeof vi.fn>;

function run(yearIds: Array<string | undefined>) {
  const req = { user: { schoolId: 's1' } } as unknown as Request;
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn();
  return rejectClosedYear(() => yearIds)(req, res, next).then(() => ({ res, json, next }));
}

beforeEach(() => vi.clearAllMocks());

describe('rejectClosedYear', () => {
  it('lets a change to an open year through', async () => {
    isClosed.mockResolvedValue(false);
    const { next, res } = await run(['y26']);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('refuses a change touching a closed year', async () => {
    isClosed.mockImplementation(async (_s: string, id: string) => id === 'y25');
    const { next, res, json } = await run(['y26', 'y25']);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'YEAR_CLOSED', message: CLOSED_YEAR_MESSAGE }) }));
  });

  it('lets through a request with no year to check', async () => {
    const { next } = await run([undefined]);
    expect(isClosed).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
