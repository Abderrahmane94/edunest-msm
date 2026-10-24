import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireSchoolContext } from './school-context.middleware';

function req(user: Record<string, unknown> | undefined, path = '/'): Partial<Request> {
  return { user: user as Request['user'], path };
}
function res(): Partial<Response> {
  const r: Partial<Response> = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json = vi.fn().mockReturnValue(r);
  return r;
}

describe('requireSchoolContext — a school’s routes need a school', () => {
  it('lets a school user through', () => {
    const next = vi.fn() as NextFunction;
    const r = res();
    requireSchoolContext()(req({ role: 'admin', schoolId: 'school-A' }) as Request, r as Response, next);
    expect(next).toHaveBeenCalled();
    expect(r.status).not.toHaveBeenCalled();
  });

  it('answers 400 to the platform account, which has no school (instead of a 500 further on)', () => {
    const next = vi.fn() as NextFunction;
    const r = res();
    requireSchoolContext()(req({ role: 'super_admin', schoolId: null }, '/children') as Request, r as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'NO_SCHOOL_CONTEXT' }) }));
  });

  it('lets the platform account use the paths it works on (except)', () => {
    const guard = requireSchoolContext({ except: [/^\/branches(\/[^/]+(\/config)?)?\/?$/] });
    for (const path of ['/branches', '/branches/b1', '/branches/b1/config']) {
      const next = vi.fn() as NextFunction;
      guard(req({ role: 'super_admin', schoolId: null }, path) as Request, res() as Response, next);
      expect(next).toHaveBeenCalled();
    }
    // A branch's fees are the school's: not an exception.
    const next = vi.fn() as NextFunction;
    const r = res();
    guard(req({ role: 'super_admin', schoolId: null }, '/branches/b1/fees') as Request, r as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('leaves unauthenticated (public) requests to the routes', () => {
    const next = vi.fn() as NextFunction;
    requireSchoolContext()(req(undefined) as Request, res() as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
