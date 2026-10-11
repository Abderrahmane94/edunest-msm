import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../modules/access/access.service', () => ({ accessService: { permissionsOf: vi.fn() } }));

import { accessService } from '../modules/access/access.service';
import { requirePermission, requireAnyPermission } from './permission.middleware';
import { FULL_PERMISSIONS, normalizePermissions } from '../modules/access/permissions';

const permissionsOf = accessService.permissionsOf as unknown as ReturnType<typeof vi.fn>;
const clerk = normalizePermissions({ areas: { children: 'edit', collections: 'view' } });

async function run(mw: ReturnType<typeof requirePermission>, role: string) {
  const req = { user: { userId: 'u', role, schoolId: 's' } } as unknown as Request;
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn();
  await mw(req, res, next);
  return next.mock.calls.length === 1 && next.mock.calls[0].length === 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  permissionsOf.mockImplementation(async (u: { role: string }) => (u.role === 'admin' ? FULL_PERMISSIONS : clerk));
});

describe('requirePermission', () => {
  it('lets the director in everywhere', async () => {
    expect(await run(requirePermission('payroll', 'edit'), 'admin')).toBe(true);
    expect(await run(requirePermission('children', 'edit', { delete: true }), 'admin')).toBe(true);
  });

  it("follows the office staff's profile: edit includes view, nothing beyond", async () => {
    expect(await run(requirePermission('children', 'edit'), 'administrative')).toBe(true);
    expect(await run(requirePermission('children', 'view'), 'administrative')).toBe(true);
    expect(await run(requirePermission('collections', 'view'), 'administrative')).toBe(true);
    expect(await run(requirePermission('collections', 'edit'), 'administrative')).toBe(false);
    expect(await run(requirePermission('payroll', 'view'), 'administrative')).toBe(false);
  });

  it('asks for the delete right on top', async () => {
    expect(await run(requirePermission('children', 'edit', { delete: true }), 'administrative')).toBe(false);
  });

  it('lets teachers in only where their own rules apply', async () => {
    expect(await run(requirePermission('classes', 'edit', { alsoRoles: ['teacher'] }), 'teacher')).toBe(true);
    expect(await run(requirePermission('classes', 'edit'), 'teacher')).toBe(false);
    expect(await run(requirePermission('children', 'view'), 'parent')).toBe(false);
  });

  it('any one of several rights is enough for shared lists', async () => {
    expect(await run(requireAnyPermission([['fees', 'view'], ['children', 'view']]), 'administrative')).toBe(true);
    expect(await run(requireAnyPermission([['fees', 'view'], ['payroll', 'view']]), 'administrative')).toBe(false);
  });
});

describe('normalizePermissions', () => {
  it('keeps known areas and levels only', () => {
    const p = normalizePermissions({ areas: { children: 'edit', payroll: 'admin', unknown: 'edit' }, delete: 'yes' });
    expect(p.areas.children).toBe('edit');
    expect(p.areas.payroll).toBe('none');
    expect(p.delete).toBe(false);
    expect(Object.keys(p.areas)).not.toContain('unknown');
  });
});
